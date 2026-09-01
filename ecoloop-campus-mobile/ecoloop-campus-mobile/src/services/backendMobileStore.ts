import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AvatarPreset,
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
  WasteType,
} from '../types';
import {
  attachProofImagesToSubmissions,
  mapAvatarPresetRow,
  mapBinRow,
  mapFeedbackRow,
  mapMissionRow,
  mapPointHistoryRow,
  mapPredictionRow,
  mapProofImageRow,
  mapQrScanLogRow,
  mapRewardRedemptionRow,
  mapRewardRow,
  mapSubmissionRow,
  mapUserRow,
  mapWasteTypeRow,
} from './supabaseAdapters';
import { buildBackendAssetUrl } from './backendAvatarService';

type Row = Record<string, any>;
type FetchLike = (url: string, init?: any) => Promise<{ ok?: boolean; status?: number; json(): Promise<unknown> }>;
type StorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
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
  avatarOptions: AvatarPreset[];
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

export type BackendMobileStore = {
  checkSchema(): Promise<SchemaHealth>;
  getOperatingReadiness(data: Pick<MobileInitialData, 'stations' | 'wasteTypes'>): OperatingReadiness;
  signIn(role: UserRole, email: string, password: string): Promise<UserProfile>;
  signUp(name: string, email: string, password: string, role: UserRole): Promise<UserProfile>;
  updatePassword(email: string, currentPassword: string, newPassword: string): Promise<void>;
  signOut(): Promise<void>;
  loadSessionProfile(): Promise<UserProfile | undefined>;
  loadInitialData(profile: UserProfile): Promise<MobileInitialData>;
  updateAvatar(userId: string, avatarKey: string): Promise<UserProfile>;
  createSubmission(userId: string, input: CreateSubmissionInput, wasteTypes: WasteType[]): Promise<RecyclingSubmission>;
  saveAiPrediction(userId: string, input: SavePredictionInput): Promise<PredictionRecord>;
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
  attachProofImage(submissionId: string, input: CreateProofImageInput): Promise<ProofImage>;
  submitFeedback(user: UserProfile, input: CreateFeedbackInput): Promise<Feedback>;
  advanceMission(userId: string, missionId: string, missions: Mission[]): Promise<Mission>;
  requestReward(userId: string, reward: Reward): Promise<RewardRedemption>;
  requestRewardBatch(userId: string, items: Array<{ rewardId: string; quantity: number }>, rewards: Reward[]): Promise<RewardRedemption>;
  scanRewardRedemption(qrToken: string): Promise<{ id: string; status: string; pointsSpent: number; studentId: string }>;
};

const DEFAULT_API_URL = 'http://10.0.2.2:8000';
const TOKEN_KEY = 'ecoloop_backend_token';

function normalizedBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeAvatar(row: Row, baseUrl: string) {
  const mapped = mapAvatarPresetRow(row);
  return { ...mapped, imageUrl: buildBackendAssetUrl(mapped.imageUrl, baseUrl) };
}

function normalizeUser(row: Row, baseUrl: string) {
  const mapped = mapUserRow(row);
  return { ...mapped, avatarUrl: buildBackendAssetUrl(mapped.avatarUrl, baseUrl) };
}

function readiness(data: Pick<MobileInitialData, 'stations' | 'wasteTypes'>): OperatingReadiness {
  const missing: string[] = [];
  if (data.stations.length === 0) missing.push('bins');
  if (data.wasteTypes.length === 0) missing.push('waste_types');
  return { ok: missing.length === 0, missing };
}

async function readError(response: { status?: number; json(): Promise<unknown> }) {
  try {
    const payload = (await response.json()) as Row;
    return String(payload.detail ?? payload.error ?? payload.message ?? `Backend chưa sẵn sàng (${response.status ?? 0})`);
  } catch {
    return `Backend chưa sẵn sàng (${response.status ?? 0})`;
  }
}

function fallbackSubmission(id: string, status: RecyclingSubmission['status']): RecyclingSubmission {
  const now = new Date();
  return {
    id,
    userId: '',
    binId: '',
    wasteTypeId: '',
    quantity: 0,
    unit: 'item',
    qrToken: '',
    status,
    createdAt: now,
    expiredAt: now,
  };
}

function fallbackPoint(submissionId: string, points: number): EcoPointTransaction {
  return {
    id: `point-${submissionId}-${Date.now()}`,
    userId: '',
    submissionId,
    points: Math.abs(points),
    type: points < 0 ? 'spend' : 'earn',
    status: 'confirmed',
    description: 'Cập nhật Ecopoint',
    source: 'qr_submission',
    createdAt: new Date(),
  };
}

export function createBackendMobileStore({
  baseUrl = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL,
  fetcher = fetch as FetchLike,
  storage = AsyncStorage as StorageLike,
  initialToken = '',
}: { baseUrl?: string; fetcher?: FetchLike; storage?: StorageLike; initialToken?: string } = {}): BackendMobileStore {
  const endpointBaseUrl = normalizedBaseUrl(baseUrl);
  let token = initialToken;

  async function getToken() {
    if (token) return token;
    token = (await storage.getItem(TOKEN_KEY)) ?? '';
    return token;
  }

  async function setToken(nextToken: string) {
    token = nextToken;
    if (nextToken) await storage.setItem(TOKEN_KEY, nextToken);
    else await storage.removeItem(TOKEN_KEY);
  }

  async function request(path: string, init: any = {}) {
    const headers: Record<string, string> = { ...(init.headers ?? {}) };
    if (init.body !== undefined && !(typeof FormData !== 'undefined' && init.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(init.body);
    }
    const currentToken = await getToken();
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
    const response = await fetcher(`${endpointBaseUrl}${path}`, { ...init, headers });
    if (!response.ok) throw new Error(await readError(response));
    return response.json() as Promise<Row>;
  }

  return {
    async checkSchema() {
      const payload = await request('/api/health/db');
      const ok = payload.status === 'ok';
      return {
        ok,
        missingTables: [],
        message: ok ? 'Backend PostgreSQL đã sẵn sàng.' : `Backend PostgreSQL chưa sẵn sàng: ${payload.status ?? 'unknown'}`,
      };
    },

    getOperatingReadiness(data) {
      return readiness(data);
    },

    async signIn(role, email, password) {
      const payload = await request('/api/auth/login', { method: 'POST', body: { email: email.trim(), password } });
      await setToken(String(payload.token ?? ''));
      const user = normalizeUser(payload.user ?? {}, endpointBaseUrl);
      if (user.status === 'pending') throw new Error('Tài khoản tình nguyện viên đang chờ admin phê duyệt.');
      if (user.status !== 'active') throw new Error('Tài khoản không được phép đăng nhập');
      if (user.role !== role) throw new Error('Tài khoản này không thuộc vai trò đang chọn');
      return user;
    },

    async signUp(name, email, password, role) {
      const payload = await request('/api/auth/register', { method: 'POST', body: { name: name.trim(), email: email.trim(), password, role } });
      return normalizeUser(payload.user ?? {}, endpointBaseUrl);
    },

    async updatePassword(_email, currentPassword, newPassword) {
      await request('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
    },

    async signOut() {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        if (!messageOf(error).includes('401')) throw error;
      } finally {
        await setToken('');
      }
    },

    async loadSessionProfile() {
      if (!(await getToken())) return undefined;
      const payload = await request('/api/auth/me');
      return normalizeUser(payload.user ?? {}, endpointBaseUrl);
    },

    async loadInitialData(profile) {
      const payload = await request('/api/mobile/initial-data');
      const proofImages = (payload.proofImages ?? []).map((row: Row) => mapProofImageRow(row));
      const submissions = attachProofImagesToSubmissions(
        (payload.submissions ?? []).map((row: Row) => mapSubmissionRow(row)),
        proofImages
      );
      const predictions = (payload.predictions ?? []).map((row: Row) => mapPredictionRow(row));
      const pointTransactions = (payload.pointTransactions ?? []).map((row: Row) => mapPointHistoryRow(row));
      const rewardRedemptions = (payload.rewardRedemptions ?? []).map((row: Row) => mapRewardRedemptionRow(row));
      const qrScanLogs = (payload.qrScanLogs ?? []).map((row: Row) => mapQrScanLogRow(row));
      return {
        users: (payload.users ?? []).map((row: Row) => normalizeUser(row, endpointBaseUrl)),
        stations: (payload.stations ?? []).map((row: Row) => mapBinRow(row)),
        wasteTypes: (payload.wasteTypes ?? []).map((row: Row) => mapWasteTypeRow(row)),
        predictions: profile.role === 'student' ? predictions.filter((item: PredictionRecord) => item.userId === profile.id) : predictions,
        submissions: profile.role === 'student' ? submissions.filter((item: RecyclingSubmission) => item.userId === profile.id) : submissions,
        pointTransactions: profile.role === 'student' ? pointTransactions.filter((item: EcoPointTransaction) => item.userId === profile.id) : pointTransactions,
        feedbacks: (payload.feedbacks ?? []).map((row: Row) => mapFeedbackRow(row)),
        missions: (payload.missions ?? []).map((row: Row) => mapMissionRow(row)),
        rewards: (payload.rewards ?? []).map((row: Row) => mapRewardRow(row)),
        rewardRedemptions: profile.role === 'student' ? rewardRedemptions.filter((item: RewardRedemption) => item.userId === profile.id) : rewardRedemptions,
        proofImages,
        qrScanLogs: profile.role === 'student' ? [] : qrScanLogs,
        avatarOptions: (payload.avatarOptions ?? []).map((row: Row) => normalizeAvatar(row, endpointBaseUrl)).filter((item: AvatarPreset) => item.status === 'active'),
      };
    },

    async updateAvatar(_userId, avatarKey) {
      const payload = await request('/api/mobile/users/me/avatar', { method: 'PATCH', body: { avatarKey } });
      return normalizeUser(payload.user ?? payload.data ?? {}, endpointBaseUrl);
    },

    async createSubmission(_userId, input) {
      const payload = await request('/api/mobile/recycling-submissions', { method: 'POST', body: input });
      return mapSubmissionRow(payload.data ?? {});
    },

    async saveAiPrediction(_userId, input) {
      const payload = await request('/api/mobile/predictions', { method: 'POST', body: input });
      return mapPredictionRow(payload.data ?? {});
    },

    async markSubmissionScanned(qrToken, _volunteerId, stationId) {
      const payload = await request('/api/mobile/recycling-submissions/scan', { method: 'POST', body: { qrToken, stationId } });
      const data = payload.data ?? {};
      return {
        result: String(data.result ?? 'INVALID_TOKEN') as QRScanOutcome['result'],
        submission: data.submission ? mapSubmissionRow(data.submission) : undefined,
        note: String(data.note ?? ''),
      };
    },

    async confirmSubmission(submissionId, actualQuantity, _volunteerId, volunteerNote) {
      const payload = await request(`/api/mobile/recycling-submissions/${encodeURIComponent(submissionId)}/confirm`, {
        method: 'POST',
        body: { actualQuantity, note: volunteerNote ?? '' },
      });
      const data = payload.data ?? {};
      return {
        submission: data.submission ? mapSubmissionRow(data.submission) : fallbackSubmission(String(data.submissionId ?? submissionId), 'POINT_CONFIRMED'),
        point: data.point ? mapPointHistoryRow(data.point) : fallbackPoint(String(data.submissionId ?? submissionId), Number(data.points ?? 0)),
      };
    },

    async rejectSubmission(submissionId, _volunteerId, volunteerNote) {
      const payload = await request(`/api/mobile/recycling-submissions/${encodeURIComponent(submissionId)}/reject`, {
        method: 'POST',
        body: { note: volunteerNote ?? '' },
      });
      return (payload.data?.submission ? mapSubmissionRow(payload.data.submission) : fallbackSubmission(submissionId, 'REJECTED'));
    },

    async requestReview(submissionId, _volunteerId, volunteerNote) {
      const payload = await request(`/api/mobile/recycling-submissions/${encodeURIComponent(submissionId)}/review`, {
        method: 'POST',
        body: { note: volunteerNote ?? '' },
      });
      return (payload.data?.submission ? mapSubmissionRow(payload.data.submission) : fallbackSubmission(submissionId, 'PENDING_REVIEW'));
    },

    async attachProofImage(submissionId, input) {
      const formData = new FormData();
      const uri = input.imageUri ?? input.imageUrl ?? '';
      formData.append('note', input.note ?? '');
      formData.append('file', { uri, name: input.fileName ?? 'proof.jpg', type: input.mimeType ?? 'image/jpeg' } as any);
      const payload = await request(`/api/mobile/recycling-submissions/${encodeURIComponent(submissionId)}/proof`, {
        method: 'POST',
        body: formData,
      });
      return mapProofImageRow(payload.data ?? {});
    },

    async submitFeedback(_user, input) {
      const payload = await request('/api/mobile/feedback', { method: 'POST', body: input });
      return mapFeedbackRow(payload.data ?? {});
    },

    async advanceMission(_userId, missionId, missions) {
      const payload = await request(`/api/mobile/missions/${encodeURIComponent(missionId)}/advance`, { method: 'POST', body: {} });
      return payload.data ? mapMissionRow(payload.data) : missions.find(item => item.id === missionId)!;
    },

    async requestReward(_userId, reward) {
      const payload = await request('/api/mobile/reward-redemptions', { method: 'POST', body: { rewardId: reward.id } });
      const batch = payload.data ?? {};
      return {
        ...mapRewardRedemptionRow({ ...batch, status: batch.status ?? 'pending', rewardId: reward.id, rewardLabel: reward.title, costPoints: batch.totalPoints ?? reward.costPoints }),
        qrToken: batch.qrToken,
        expiresAt: batch.expiresAt ? new Date(batch.expiresAt) : undefined,
        totalPoints: Number(batch.totalPoints ?? reward.costPoints),
      };
    },
    async requestRewardBatch(userId, items, rewardCatalog) {
      const payload = await request('/api/mobile/reward-redemptions', { method: 'POST', body: { items } });
      const batch = payload.data ?? {};
      const normalizedItems = items.map(item => {
        const reward = rewardCatalog.find(row => row.id === item.rewardId);
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const pointsEach = Number(reward?.costPoints || 0);
        return { rewardId: item.rewardId, rewardLabel: reward?.title || item.rewardId, quantity, pointsEach, pointsTotal: quantity * pointsEach };
      });
      return {
        ...mapRewardRedemptionRow({ ...batch, userId, rewardId: normalizedItems[0]?.rewardId, rewardLabel: normalizedItems.map(item => `${item.rewardLabel} x${item.quantity}`).join(', '), costPoints: batch.totalPoints ?? normalizedItems.reduce((sum, item) => sum + item.pointsTotal, 0), status: batch.status ?? 'pending' }),
        qrToken: batch.qrToken,
        expiresAt: batch.expiresAt ? new Date(batch.expiresAt) : undefined,
        totalPoints: Number(batch.totalPoints ?? normalizedItems.reduce((sum, item) => sum + item.pointsTotal, 0)),
        items: normalizedItems,
      };
    },
    async scanRewardRedemption(qrToken) {
      const payload = await request('/api/mobile/reward-redemptions/scan', { method: 'POST', body: { qrToken } });
      return payload.data ?? {};
    },
  };
}
