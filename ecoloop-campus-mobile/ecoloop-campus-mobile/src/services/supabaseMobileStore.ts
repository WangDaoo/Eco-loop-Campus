import {
  BinStation,
  CreateFeedbackInput,
  CreateProofImageInput,
  CreateSubmissionInput,
  EcoPointTransaction,
  Feedback,
  Mission,
  PredictionRecord,
  ProofImage,
  QRScanLog,
  QRScanOutcome,
  RecyclingSubmission,
  Reward,
  RewardRedemption,
  SavePredictionInput,
  UserProfile,
  UserRole,
  WasteType
} from '../types';
import {
  attachProofImagesToSubmissions,
  buildPredictionDraft,
  buildSubmissionDraft,
  mapBinRow,
  mapFeedbackRow,
  mapMissionRow,
  mapPointHistoryRow,
  mapPredictionRow,
  mapProofImageRow,
  mapQrScanLogRow,
  mapRewardRedemptionRow,
  mapRewardRow,
  mapUserMissionRow,
  mergeMissionProgress,
  mapSubmissionRow,
  mapUserRow,
  mapWasteTypeRow,
  toSubmissionRow,
  toPredictionRow
} from './supabaseAdapters';

type Row = Record<string, any>;
type SupabaseError = { message?: string } | null | undefined;

type SupabaseLike = {
  auth: {
    signInWithPassword(input: { email: string; password: string }): Promise<{ data: { user?: { id: string; email?: string | null } | null }; error: SupabaseError }>;
    signUp(input: { email: string; password: string; options?: { data?: Row } }): Promise<{ data: { user?: { id: string; email?: string | null } | null }; error: SupabaseError }>;
    updateUser(input: { password?: string }): Promise<{ data: { user?: { id: string; email?: string | null } | null }; error: SupabaseError }>;
    signOut(): Promise<{ error: SupabaseError }>;
    getSession(): Promise<{ data: { session?: { user: { id: string; email?: string | null } } | null }; error: SupabaseError }>;
  };
  from(table: string): any;
  storage?: {
    from(bucket: string): {
      upload(path: string, body: unknown, options?: Row): Promise<{ data?: Row | null; error: SupabaseError }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
  rpc?: (name: string, params?: Row) => PromiseLike<{ data: Row | null; error: SupabaseError }>;
  channel?: (name: string) => any;
  removeChannel?: (channel: any) => Promise<unknown>;
};

export type MobileInitialData = {
  users: UserProfile[];
  stations: BinStation[];
  wasteTypes: WasteType[];
  predictions: PredictionRecord[];
  submissions: RecyclingSubmission[];
  pointTransactions: EcoPointTransaction[];
  feedbacks: Feedback[];
  missions: Mission[];
  rewards: Reward[];
  rewardRedemptions: RewardRedemption[];
  proofImages: ProofImage[];
  qrScanLogs: QRScanLog[];
};

export type SchemaHealth = {
  ok: boolean;
  missingTables: string[];
  message: string;
};

export type OperatingReadiness = {
  ok: boolean;
  missing: string[];
};

export type SupabaseMobileStore = {
  checkSchema(): Promise<SchemaHealth>;
  getOperatingReadiness(data: Pick<MobileInitialData, 'stations' | 'wasteTypes'>): OperatingReadiness;
  signIn(role: UserRole, email: string, password: string): Promise<UserProfile>;
  signUp(name: string, email: string, password: string, role: UserRole): Promise<UserProfile>;
  updatePassword(email: string, currentPassword: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
  loadSessionProfile(): Promise<UserProfile | undefined>;
  loadInitialData(profile: UserProfile): Promise<MobileInitialData>;
  updateAvatar(userId: string, avatarKey: string): Promise<UserProfile>;
  createSubmission(
    userId: string,
    input: CreateSubmissionInput,
    wasteTypes: WasteType[],
    now?: Date,
    random?: () => number
  ): Promise<RecyclingSubmission>;
  saveAiPrediction(userId: string, input: SavePredictionInput, now?: Date, random?: () => number): Promise<PredictionRecord>;
  markSubmissionScanned(qrToken: string, volunteerId: string, stationId?: string): Promise<QRScanOutcome>;
  confirmSubmission(
    submissionId: string,
    actualQuantity: number,
    volunteerId: string,
    volunteerNote: string | undefined,
    wasteTypes: WasteType[]
  ): Promise<{ submission: RecyclingSubmission; point: EcoPointTransaction }>;
  rejectSubmission(submissionId: string, volunteerId: string, volunteerNote?: string): Promise<RecyclingSubmission>;
  requestReview(submissionId: string, volunteerId: string, volunteerNote?: string): Promise<RecyclingSubmission>;
  attachProofImage(submissionId: string, input: CreateProofImageInput, now?: Date, random?: () => number): Promise<ProofImage>;
  submitFeedback(user: UserProfile, input: CreateFeedbackInput): Promise<Feedback>;
  advanceMission(userId: string, missionId: string, missions: Mission[]): Promise<Mission>;
  requestReward(userId: string, reward: Reward): Promise<RewardRedemption>;
  subscribeRealtime?(handlers: Partial<Record<RealtimeTable, (payload: RealtimePayload) => void>>): () => void;
};

type RealtimeTable = 'users' | 'bins' | 'waste_types' | 'predictions' | 'recycling_submissions' | 'point_history' | 'feedback' | 'missions' | 'user_missions' | 'rewards' | 'reward_redemptions' | 'qr_scan_logs' | 'proof_images';
type RealtimePayload = { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new?: Row; old?: Row; table?: string };

const mobileSchemaTables = [
  'users',
  'bins',
  'predictions',
  'waste_types',
  'recycling_submissions',
  'qr_scan_logs',
  'point_history',
  'feedback',
  'missions',
  'user_missions',
  'rewards',
  'reward_redemptions',
  'proof_images'
];

function compactTimestamp(now: Date) {
  return now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function nonce(random: () => number) {
  return String(Math.floor(Math.max(0, Math.min(0.999999, random())) * 1000000)).padStart(6, '0');
}

function extensionFrom(input: CreateProofImageInput) {
  const fileNameExtension = input.fileName?.split('.').pop()?.trim().toLowerCase();
  if (fileNameExtension) return fileNameExtension;
  if (input.mimeType?.includes('png')) return 'png';
  if (input.mimeType?.includes('webp')) return 'webp';
  return 'jpg';
}

function predictionExtensionFrom(input: SavePredictionInput) {
  const fileNameExtension = input.imageName?.split('.').pop()?.trim().toLowerCase();
  if (fileNameExtension) return fileNameExtension;
  if (input.mimeType?.includes('png')) return 'png';
  if (input.mimeType?.includes('webp')) return 'webp';
  return 'jpg';
}

function unknownMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function normalizeProofUploadUri(uri: string, submissionId: string, proofId: string, extension: string) {
  if (!uri.startsWith('content://')) return uri;
  try {
    const fileSystem = require('expo-file-system') as { cacheDirectory?: string; copyAsync?: (input: { from: string; to: string }) => Promise<void> };
    const cacheDirectory = typeof fileSystem.cacheDirectory === 'string' ? fileSystem.cacheDirectory : '';
    if (!cacheDirectory || typeof fileSystem.copyAsync !== 'function') return uri;
    const targetUri = `${cacheDirectory}ecoloop-proof-${submissionId}-${proofId}.${extension}`;
    await fileSystem.copyAsync({ from: uri, to: targetUri });
    return targetUri;
  } catch (error) {
    throw new Error(`Khong chuan bi duoc anh minh chung: ${unknownMessage(error)}`);
  }
}

async function resolveProofImageUrl(client: SupabaseLike, submissionId: string, proofId: string, input: CreateProofImageInput) {
  if (input.imageUrl?.trim()) return input.imageUrl.trim();
  if (!input.imageUri?.trim()) throw new Error('Chua co anh minh chung');
  if (!client.storage) return input.imageUri.trim();

  const extension = extensionFrom(input);
  const uploadUri = await normalizeProofUploadUri(input.imageUri.trim(), submissionId, proofId, extension);
  const response = await fetch(uploadUri);
  const fileBody = await response.arrayBuffer();
  const path = `${submissionId}/${proofId}.${extension}`;
  const bucket = client.storage.from('proof-images');
  const upload = await bucket.upload(path, fileBody, {
    contentType: input.mimeType ?? 'image/jpeg',
    upsert: true
  });
  if (upload.error) throw new Error(errorMessage(upload.error, 'Khong upload duoc anh minh chung'));
  return bucket.getPublicUrl(path).data.publicUrl;
}

async function resolvePredictionImageUrl(client: SupabaseLike, userId: string, predictionId: string, input: SavePredictionInput) {
  if (input.imageUrl?.trim()) return input.imageUrl.trim();
  if (!input.imageUri?.trim()) return undefined;
  if (!client.storage) return input.imageUri.trim();

  const response = await fetch(input.imageUri);
  const blob = await response.blob();
  const path = `mobile-ai/${userId}/${predictionId}.${predictionExtensionFrom(input)}`;
  const bucket = client.storage.from('prediction-images');
  const upload = await bucket.upload(path, blob, {
    contentType: input.mimeType ?? 'image/jpeg',
    upsert: true
  });
  if (upload.error) throw new Error(errorMessage(upload.error, 'Khong upload duoc anh AI'));
  return bucket.getPublicUrl(path).data.publicUrl;
}

function errorMessage(error: SupabaseError, fallback: string) {
  const message = error?.message;
  if (!message) return fallback;
  if (message.toLowerCase().includes('invalid login credentials')) {
    return `${fallback}: email hoặc mật khẩu chưa đúng, hoặc tài khoản chưa được cấp quyền trong Eco-loop Campus.`;
  }
  return `${fallback}: ${message}`;
}

function ensureOk<T>(result: { data: T; error: SupabaseError }, fallback: string): T {
  if (result.error) throw new Error(errorMessage(result.error, fallback));
  return result.data;
}

function isMissingRpc(error: SupabaseError) {
  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('function') && (message.includes('does not exist') || message.includes('could not find'));
}

async function tryRpc(client: SupabaseLike, name: string, params: Row, fallback: string) {
  if (!client.rpc) return undefined;
  const result = await client.rpc(name, params);
  if (result.error) {
    if (isMissingRpc(result.error)) {
      throw new Error(`RPC ${name} chưa được triển khai trên Supabase. Cần cập nhật schema SQL trước khi chạy luồng QR/Ecopoint.`);
    }
    throw new Error(errorMessage(result.error, fallback));
  }
  return result.data ?? undefined;
}

function mapRpcScanOutcome(row: Row): QRScanOutcome {
  const result = String(row.result ?? 'INVALID_TOKEN').trim().toUpperCase() as QRScanOutcome['result'];
  const submission = row.submission && typeof row.submission === 'object' ? mapSubmissionRow(row.submission as Row) : undefined;
  return {
    result,
    submission,
    note: typeof row.note === 'string' ? row.note : ''
  };
}


async function checkTable(client: SupabaseLike, table: string) {
  const result = await client.from(table).select('*');
  return result.error ? String(result.error.message ?? result.error) : '';
}

function isMissingOrBlockedTable(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes('does not exist') || normalized.includes('permission denied') || normalized.includes('not found');
}

function getOperatingReadiness(data: Pick<MobileInitialData, 'stations' | 'wasteTypes'>): OperatingReadiness {
  const missing: string[] = [];
  if (data.stations.length === 0) missing.push('bins');
  if (data.wasteTypes.length === 0) missing.push('waste_types');
  return { ok: missing.length === 0, missing };
}
async function selectRows(client: SupabaseLike, table: string, orderColumn?: string) {
  let query = client.from(table).select('*');
  if (orderColumn) query = query.order(orderColumn, { ascending: false });
  const result = await query;
  return ensureOk<Row[]>(result, `Khong doc duoc bang ${table}`) ?? [];
}

async function maybeSingle(client: SupabaseLike, table: string, column: string, value: string) {
  const result = await client.from(table).select('*').eq(column, value).maybeSingle();
  return ensureOk<Row | null>(result, `Khong doc duoc ${table}`);
}

async function singleBy(client: SupabaseLike, table: string, column: string, value: string) {
  const row = await maybeSingle(client, table, column, value);
  if (!row) throw new Error(`Khong tim thay ${table}.${column}=${value}`);
  return row;
}

async function insertRow(client: SupabaseLike, table: string, row: Row) {
  const result = await client.from(table).insert(row).select('*').single();
  return ensureOk<Row>(result, `Khong ghi duoc bang ${table}`);
}

function toUserRegistrationRow(profile: UserProfile): Row {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    group: profile.group,
    points: profile.points,
    status: profile.status
  };
}

async function updateRow(client: SupabaseLike, table: string, column: string, value: string, patch: Row) {
  const result = await client.from(table).update(patch).eq(column, value).select('*').single();
  return ensureOk<Row>(result, `Khong cap nhat duoc bang ${table}`);
}

async function updateMaybeRow(client: SupabaseLike, table: string, column: string, value: string, patch: Row) {
  const result = await client.from(table).update(patch).eq(column, value).select('*').maybeSingle();
  return ensureOk<Row | null>(result, `Khong cap nhat duoc bang ${table}`);
}

async function findProfile(client: SupabaseLike, authUser: { id: string; email?: string | null }) {
  const byId = await maybeSingle(client, 'users', 'id', authUser.id);
  if (byId) return mapUserRow(byId);
  if (!authUser.email) return undefined;
  const byEmail = await maybeSingle(client, 'users', 'email', authUser.email);
  return byEmail ? mapUserRow(byEmail) : undefined;
}

async function maybeUserMission(client: SupabaseLike, userId: string, missionId: string) {
  const result = await client.from('user_missions').select('*').eq('user_id', userId).eq('mission_id', missionId).maybeSingle();
  return ensureOk<Row | null>(result, 'Khong doc duoc user_missions');
}
async function writeQrLog(client: SupabaseLike, qrToken: string, scannedBy: string, stationId: string | undefined, result: string, note = '') {
  await insertRow(client, 'qr_scan_logs', {
    id: `scan-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    qr_token: qrToken,
    scanned_by: scannedBy,
    station_id: stationId ?? null,
    result,
    note,
    scanned_at: new Date().toISOString()
  });
}

export function createSupabaseMobileStore(client: SupabaseLike): SupabaseMobileStore {
  return {
    async checkSchema() {
      const checks = await Promise.all(
        mobileSchemaTables.map(async table => ({ table, message: await checkTable(client, table) }))
      );
      const missingTables = checks.filter(item => item.message && isMissingOrBlockedTable(item.message)).map(item => item.table);
      const unexpectedErrors = checks.filter(item => item.message && !isMissingOrBlockedTable(item.message));
      const ok = missingTables.length === 0 && unexpectedErrors.length === 0;

      return {
        ok,
        missingTables,
        message: ok
          ? 'Dữ liệu vận hành đã sẵn sàng cho Eco-loop Campus mobile.'
          : `Hệ thống chưa sẵn sàng cho mobile: thiếu hoặc chưa cấp quyền các bảng ${missingTables.join(', ')}. Vui lòng đồng bộ dữ liệu vận hành trước khi tiếp tục.`
      };
    },

    getOperatingReadiness(data) {
      return getOperatingReadiness(data);
    },

    async signIn(role, email, password) {
      const authResult = await client.auth.signInWithPassword({ email: email.trim(), password });
      const user = ensureOk(authResult, 'Đăng nhập không thành công').user;
      if (!user) throw new Error('Không nhận được thông tin tài khoản');

      const profile = await findProfile(client, user);
      if (!profile) throw new Error('Tài khoản chưa có hồ sơ Eco-loop Campus');
      if (profile.status === 'pending') throw new Error('Tài khoản tình nguyện viên đang chờ admin phê duyệt.');
      if (profile.status === 'rejected') throw new Error('Yêu cầu cấp quyền tình nguyện viên đã bị từ chối. Vui lòng liên hệ ban vận hành nếu cần kiểm tra lại.');
      if (profile.status === 'locked') throw new Error('Tài khoản đang bị khóa');
      if (profile.role !== role) throw new Error(`Tài khoản này không thuộc vai trò đang chọn`);
      return profile;
    },

    async signUp(name, email, password, role) {
      const authResult = await client.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim(), role } }
      });
      const user = ensureOk(authResult, 'Không tạo được tài khoản').user;
      if (!user) throw new Error('Không nhận được thông tin tài khoản mới');

      const profile: UserProfile = {
        id: user.id,
        name: name.trim(),
        email: email.trim(),
        role,
        group: role === 'student' ? 'Sinh viên Eco-loop' : 'Tình nguyện viên Eco-loop',
        points: 0,
        status: role === 'volunteer' ? 'pending' : 'active'
      };
      const row = await insertRow(client, 'users', toUserRegistrationRow(profile));
      return mapUserRow(row);
    },

    async updatePassword(email, currentPassword, newPassword) {
      const cleanedEmail = email.trim();
      const cleanedCurrentPassword = currentPassword.trim();
      const cleaned = newPassword.trim();
      if (!cleanedEmail) throw new Error('Không tìm thấy email tài khoản hiện tại');
      if (!cleanedCurrentPassword) throw new Error('Nhập mật khẩu hiện tại trước khi đổi mật khẩu');
      if (cleaned.length < 6) throw new Error('Mật khẩu mới cần có ít nhất 6 ký tự');
      const verification = await client.auth.signInWithPassword({ email: cleanedEmail, password: cleanedCurrentPassword });
      if (verification.error) throw new Error(errorMessage(verification.error, 'Mật khẩu hiện tại chưa đúng'));
      const result = await client.auth.updateUser({ password: cleaned });
      if (result.error) throw new Error(errorMessage(result.error, 'Không đổi được mật khẩu'));
    },

    async signOut() {
      const result = await client.auth.signOut();
      if (result.error) throw new Error(errorMessage(result.error, 'Không đăng xuất được'));
    },

    async loadSessionProfile() {
      const sessionResult = await client.auth.getSession();
      const session = ensureOk(sessionResult, 'Không đọc được phiên đăng nhập').session;
      if (!session?.user) return undefined;
      return findProfile(client, session.user);
    },

    async loadInitialData(profile) {
      const [users, bins, wasteTypes, predictions, submissions, points, feedbacks, missions, userMissions, rewards, redemptions, qrScanLogs, proofImages] = await Promise.all([
        selectRows(client, 'users'),
        selectRows(client, 'bins'),
        selectRows(client, 'waste_types'),
        selectRows(client, 'predictions', 'timestamp'),
        selectRows(client, 'recycling_submissions', 'created_at'),
        selectRows(client, 'point_history', 'created_at'),
        selectRows(client, 'feedback', 'timestamp'),
        selectRows(client, 'missions'),
        selectRows(client, 'user_missions'),
        selectRows(client, 'rewards'),
        selectRows(client, 'reward_redemptions', 'requested_at'),
        selectRows(client, 'qr_scan_logs', 'scanned_at'),
        selectRows(client, 'proof_images', 'captured_at')
      ]);

      const mappedProofImages = proofImages.map(mapProofImageRow);
      const mappedSubmissions = attachProofImagesToSubmissions(submissions.map(mapSubmissionRow), mappedProofImages);
      const visibleSubmissions = profile.role === 'student' ? mappedSubmissions.filter(item => item.userId === profile.id) : mappedSubmissions;
      const mappedPoints = points.map(mapPointHistoryRow);
      const visiblePoints = profile.role === 'student' ? mappedPoints.filter(item => item.userId === profile.id) : mappedPoints;
      const mappedRedemptions = redemptions.map(mapRewardRedemptionRow);
      const mappedQrScanLogs = qrScanLogs.map(mapQrScanLogRow);
      const mappedPredictions = predictions.map(mapPredictionRow);

      return {
        users: users.map(mapUserRow),
        stations: bins.map(mapBinRow),
        wasteTypes: wasteTypes.map(mapWasteTypeRow),
        predictions: profile.role === 'student' ? mappedPredictions.filter(item => item.userId === profile.id) : mappedPredictions,
        submissions: visibleSubmissions,
        pointTransactions: visiblePoints,
        feedbacks: feedbacks.map(mapFeedbackRow),
        missions: mergeMissionProgress(missions.map(mapMissionRow), userMissions.map(mapUserMissionRow), profile.id),
        rewards: rewards.map(mapRewardRow),
        rewardRedemptions: profile.role === 'student' ? mappedRedemptions.filter(item => item.userId === profile.id) : mappedRedemptions,
        qrScanLogs: profile.role === 'student' ? [] : profile.role === 'volunteer' ? mappedQrScanLogs.filter(item => item.scannedBy === profile.id) : mappedQrScanLogs,
        proofImages: mappedProofImages
      };
    },

    async updateAvatar(userId, avatarKey) {
      const row = await updateRow(client, 'users', 'id', userId, { avatar_key: avatarKey });
      return mapUserRow(row);
    },

    async createSubmission(userId, input, wasteTypes, now = new Date(), random = Math.random) {
      const wasteType = wasteTypes.find(item => item.id === input.wasteTypeId);
      if (!wasteType) throw new Error('Loai rac khong hop le');
      const rpcRow = await tryRpc(client, 'create_recycling_submission', {
        p_bin_id: input.binId,
        p_waste_type_id: input.wasteTypeId,
        p_quantity: input.quantity
      }, 'Khong tao duoc giao dich gui rac');
      if (rpcRow) return mapSubmissionRow(rpcRow);
      const draft = buildSubmissionDraft({ userId, input, wasteType, now, random });
      const row = await insertRow(client, 'recycling_submissions', toSubmissionRow(draft));
      return mapSubmissionRow(row);
    },

    async saveAiPrediction(userId, input, now = new Date(), random = Math.random) {
      const draft = buildPredictionDraft({ userId, input, now, random });
      const imageUrl = await resolvePredictionImageUrl(client, userId, draft.id, input);
      const row = await insertRow(client, 'predictions', toPredictionRow({ ...draft, imageUrl: imageUrl ?? draft.imageUrl }));
      return mapPredictionRow(row);
    },

    async markSubmissionScanned(qrToken, volunteerId, stationId) {
      const token = qrToken.trim().toUpperCase();
      const rpcOutcome = await tryRpc(client, 'scan_recycling_qr', {
        p_qr_token: token,
        p_station_id: stationId ?? null
      }, 'Khong quet duoc QR giao dich');
      if (rpcOutcome) return mapRpcScanOutcome(rpcOutcome);
      const current = await maybeSingle(client, 'recycling_submissions', 'qr_token', token);
      if (!current) {
        await writeQrLog(client, token, volunteerId, stationId, 'INVALID_TOKEN');
        return { result: 'INVALID_TOKEN', note: 'QR khong ton tai trong he thong' };
      }

      const submission = mapSubmissionRow(current);
      if (submission.expiredAt.getTime() < Date.now()) {
        const row = await updateRow(client, 'recycling_submissions', 'id', submission.id, {
          status: 'EXPIRED',
          verified_by: volunteerId,
          verified_at: new Date().toISOString()
        });
        await writeQrLog(client, token, volunteerId, stationId, 'EXPIRED');
        return { result: 'EXPIRED', submission: mapSubmissionRow(row), note: 'QR da het han' };
      }
      if (stationId && submission.binId !== stationId) {
        await writeQrLog(client, token, volunteerId, stationId, 'WRONG_STATION');
        return { result: 'WRONG_STATION', submission, note: 'QR khong thuoc tram dang truc' };
      }
      if (submission.status !== 'CREATED') {
        await writeQrLog(client, token, volunteerId, stationId, 'ALREADY_USED');
        return { result: 'ALREADY_USED', submission, note: 'QR da duoc xu ly truoc do' };
      }

      const row = await updateRow(client, 'recycling_submissions', 'id', submission.id, {
        status: 'QR_SCANNED',
        verified_by: volunteerId,
        verified_at: new Date().toISOString()
      });
      await writeQrLog(client, token, volunteerId, stationId, 'SUCCESS');
      return { result: 'SUCCESS', submission: mapSubmissionRow(row), note: 'QR hop le' };
    },

    async confirmSubmission(submissionId, actualQuantity, volunteerId, volunteerNote, wasteTypes) {
      const rpcResult = await tryRpc(client, 'confirm_recycling_submission', {
        p_submission_id: submissionId,
        p_actual_quantity: actualQuantity,
        p_volunteer_note: volunteerNote ?? ''
      }, 'Khong xac nhan duoc giao dich');
      if (rpcResult) {
        const submissionRow = rpcResult.submission && typeof rpcResult.submission === 'object' ? rpcResult.submission as Row : undefined;
        const pointRow = rpcResult.point && typeof rpcResult.point === 'object' ? rpcResult.point as Row : undefined;
        if (!submissionRow || !pointRow) throw new Error('RPC confirm khong tra du thong tin giao dich va diem');
        return { submission: mapSubmissionRow(submissionRow), point: mapPointHistoryRow(pointRow) };
      }
      const current = mapSubmissionRow(await singleBy(client, 'recycling_submissions', 'id', submissionId));
      const wasteType = wasteTypes.find(item => item.id === current.wasteTypeId);
      if (!wasteType) throw new Error('Loai rac khong hop le');
      if (current.status !== 'QR_SCANNED') throw new Error('QR chua duoc quet hop le, khong the xac nhan diem');

      const points = Math.max(0, Math.round(actualQuantity * wasteType.pointPerUnit));
      const now = new Date().toISOString();
      const updatedSubmission = await updateRow(client, 'recycling_submissions', 'id', submissionId, {
        status: 'POINT_CONFIRMED',
        actual_quantity: actualQuantity,
        verified_by: volunteerId,
        verified_at: now,
        volunteer_note: volunteerNote ?? ''
      });
      const pointRow = await insertRow(client, 'point_history', {
        user_id: current.userId,
        bin_id: current.binId,
        submission_id: current.id,
        class: wasteType.id,
        bin_group: wasteType.name,
        action: `Xac nhan ${actualQuantity} ${wasteType.unit} ${wasteType.name}`,
        description: `Xac nhan ${actualQuantity} ${wasteType.unit} ${wasteType.name}`,
        points,
        status: 'confirmed',
        source: 'volunteer_verification',
        admin_note: volunteerNote ?? '',
        timestamp: now,
        created_at: now
      });

      const userRow = await maybeSingle(client, 'users', 'id', current.userId);
      if (userRow) {
        await updateMaybeRow(client, 'users', 'id', current.userId, { points: Number(userRow.points ?? 0) + points });
      }

      return { submission: mapSubmissionRow(updatedSubmission), point: mapPointHistoryRow(pointRow) };
    },

    async rejectSubmission(submissionId, volunteerId, volunteerNote) {
      const rpcRow = await tryRpc(client, 'reject_recycling_submission', {
        p_submission_id: submissionId,
        p_volunteer_note: volunteerNote ?? ''
      }, 'Khong tu choi duoc giao dich');
      if (rpcRow) return mapSubmissionRow(rpcRow.submission && typeof rpcRow.submission === 'object' ? rpcRow.submission as Row : rpcRow);
      const row = await updateRow(client, 'recycling_submissions', 'id', submissionId, {
        status: 'REJECTED',
        verified_by: volunteerId,
        verified_at: new Date().toISOString(),
        volunteer_note: volunteerNote ?? 'Khong dat dieu kien tiep nhan'
      });
      return mapSubmissionRow(row);
    },

    async requestReview(submissionId, volunteerId, volunteerNote) {
      const rpcRow = await tryRpc(client, 'request_recycling_review', {
        p_submission_id: submissionId,
        p_volunteer_note: volunteerNote ?? ''
      }, 'Khong gui duoc yeu cau admin review');
      if (rpcRow) return mapSubmissionRow(rpcRow.submission && typeof rpcRow.submission === 'object' ? rpcRow.submission as Row : rpcRow);
      const row = await updateRow(client, 'recycling_submissions', 'id', submissionId, {
        status: 'PENDING_REVIEW',
        verified_by: volunteerId,
        verified_at: new Date().toISOString(),
        volunteer_note: volunteerNote ?? 'Can admin review'
      });
      return mapSubmissionRow(row);
    },

    async attachProofImage(submissionId, input, now = new Date(), random = Math.random) {
      const nonceValue = nonce(random);
      const proofId = `proof-${compactTimestamp(now)}-${nonceValue}`;
      const imageUrl = await resolveProofImageUrl(client, submissionId, proofId, input);
      const row = await insertRow(client, 'proof_images', {
        id: proofId,
        submission_id: submissionId,
        image_url: imageUrl,
        image_hash: input.imageHash ?? null,
        captured_at: now.toISOString(),
        verification_code: input.verificationCode ?? `RVW-${nonceValue}`,
        status: input.status ?? 'pending',
        note: input.note ?? ''
      });
      return mapProofImageRow(row);
    },

    async submitFeedback(user, input) {
      if (!input.message.trim()) throw new Error('Noi dung phan hoi dang trong');
      const now = new Date().toISOString();
      const row = await insertRow(client, 'feedback', {
        id: `feedback-${Date.now()}`,
        user_id: user.id,
        user_name: user.name,
        category: input.type,
        message: input.message.trim(),
        status: 'unread',
        priority: input.type === 'bin_full' || input.type === 'damage' ? 'high' : 'medium',
        bin_id: input.stationId ?? null,
        admin_note: '',
        timestamp: now
      });
      return mapFeedbackRow(row);
    },

    async advanceMission(userId, missionId, missions) {
      const mission = missions.find(item => item.id === missionId);
      if (!mission) throw new Error('Khong tim thay nhiem vu xanh');
      const existing = await maybeUserMission(client, userId, missionId);
      const previous = existing ? mapUserMissionRow(existing) : undefined;
      const current = Math.min(mission.target, (previous?.current ?? 0) + 1);
      const completed = current >= mission.target;
      const rowPayload = {
        id: previous?.id ?? `${userId}-${missionId}`,
        user_id: userId,
        mission_id: missionId,
        current,
        completed,
        status: completed ? 'completed' : 'active',
        updated_at: new Date().toISOString()
      };
      const row = existing
        ? await updateRow(client, 'user_missions', 'id', String(existing.id), rowPayload)
        : await insertRow(client, 'user_missions', rowPayload);
      if (completed && !previous?.completed && mission.rewardPoints > 0) {
        const now = new Date().toISOString();
        await insertRow(client, 'point_history', {
          user_id: userId,
          submission_id: null,
          class: mission.id,
          bin_group: 'Nhiem vu xanh',
          action: `Hoan thanh nhiem vu ${mission.title}`,
          description: `Hoan thanh nhiem vu ${mission.title}`,
          points: mission.rewardPoints,
          status: 'confirmed',
          source: 'mission_reward',
          admin_note: '',
          timestamp: now,
          created_at: now
        });
        const userRow = await maybeSingle(client, 'users', 'id', userId);
        if (userRow) await updateMaybeRow(client, 'users', 'id', userId, { points: Number(userRow.points ?? 0) + mission.rewardPoints });
      }
      return mergeMissionProgress([mission], [mapUserMissionRow(row)], userId)[0];
    },
    async requestReward(userId, reward) {
      const row = await insertRow(client, 'reward_redemptions', {
        id: `reward-${Date.now()}`,
        user_id: userId,
        reward_id: reward.id,
        reward_label: reward.title,
        cost_points: reward.costPoints,
        status: 'requested',
        requested_at: new Date().toISOString(),
        admin_note: ''
      });
      return mapRewardRedemptionRow(row);
    },

    subscribeRealtime(handlers) {
      if (!client.channel) return () => undefined;
      const channel = client.channel('ecoloop-mobile-realtime');
      const tables: RealtimeTable[] = ['users', 'bins', 'waste_types', 'predictions', 'recycling_submissions', 'point_history', 'feedback', 'missions', 'user_missions', 'rewards', 'reward_redemptions', 'qr_scan_logs', 'proof_images'];
      tables.forEach(table => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload: RealtimePayload) => {
          handlers[table]?.({ ...payload, table });
        });
      });
      channel.subscribe();
      return () => {
        client.removeChannel?.(channel);
      };
    }
  };
}
