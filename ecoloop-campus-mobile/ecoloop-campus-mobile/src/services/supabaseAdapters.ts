import {
  AvatarPreset,
  BinStation,
  CreateSubmissionInput,
  EcoPointTransaction,
  Feedback,
  Mission,
  PredictionRecord,
  ProofImage,
  QRScanLog,
  Reward,
  RecyclingSubmission,
  RewardRedemption,
  SavePredictionInput,
  SubmissionStatus,
  UserProfile,
  UserMission,
  UserRole,
  WasteType
} from '../types';
import { binGroupForAiClass } from './predictionService';

type Row = Record<string, unknown>;
type RealtimeChange<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T;
  old?: Partial<T>;
};

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : value === null || value === undefined ? fallback : String(value);
}

function number(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(value: unknown, fallback = 0) {
  return Math.max(0, Math.min(100, number(value, fallback)));
}

function optionalPercent(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : undefined;
}

function date(value: unknown, fallback = new Date()) {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function role(value: unknown): UserRole {
  const normalized = text(value, 'student').trim().toLowerCase();
  if (normalized === 'volunteer' || normalized === 'admin') return normalized;
  return 'student';
}

function userStatus(value: unknown): UserProfile['status'] {
  const normalized = text(value, 'active').trim().toLowerCase();
  if (normalized === 'locked' || normalized === 'pending' || normalized === 'rejected') return normalized;
  return 'active';
}

function activeStatus(value: unknown): AvatarPreset['status'] {
  return text(value, 'active').trim().toLowerCase() === 'active' ? 'active' : 'inactive';
}

function binStatus(value: unknown): BinStation['status'] {
  const normalized = text(value, 'open').trim().toLowerCase();
  if (normalized === 'active') return 'open';
  if (normalized === 'full' || normalized === 'maintenance' || normalized === 'closed') return normalized;
  return 'open';
}

function feedbackType(value: unknown): Feedback['type'] {
  const normalized = text(value, 'other').trim().toLowerCase();
  if (normalized === 'bin_full' || normalized === 'qr_error' || normalized === 'wrong_sorting' || normalized === 'damage') return normalized;
  return 'other';
}

function feedbackStatus(value: unknown): Feedback['status'] {
  const normalized = text(value, 'new').trim().toLowerCase();
  if (normalized === 'unread') return 'new';
  if (normalized === 'in_progress' || normalized === 'resolved') return normalized;
  return 'new';
}

function missionStatus(value: unknown): Mission['status'] {
  const normalized = text(value, 'active').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'expired') return normalized;
  return 'active';
}
function proofStatus(value: unknown): ProofImage['status'] {
  const normalized = text(value, 'pending').trim().toLowerCase();
  if (normalized === 'accepted' || normalized === 'rejected') return normalized;
  return 'pending';
}
function qrScanResult(value: unknown): QRScanLog['result'] {
  const normalized = text(value, 'INVALID_TOKEN').trim().toUpperCase();
  const allowed: QRScanLog['result'][] = [
    'SUCCESS',
    'EXPIRED',
    'ALREADY_USED',
    'INVALID_TOKEN',
    'WRONG_STATION',
    'INVALID_ROLE',
    'SUSPECTED_FRAUD'
  ];
  return allowed.includes(normalized as QRScanLog['result']) ? (normalized as QRScanLog['result']) : 'INVALID_TOKEN';
}

function predictionSource(value: unknown): PredictionRecord['source'] {
  return text(value, 'upload').trim().toLowerCase() === 'camera' ? 'camera' : 'upload';
}

function predictionStatus(value: unknown): PredictionRecord['status'] {
  const normalized = text(value, 'pending').trim().toLowerCase();
  if (normalized === 'approved' || normalized === 'rejected') return normalized;
  return 'pending';
}

function submissionStatus(value: unknown): SubmissionStatus {
  const normalized = text(value, 'CREATED').trim().toUpperCase();
  const allowed: SubmissionStatus[] = [
    'CREATED',
    'QR_SCANNED',
    'ACCEPTED',
    'REJECTED',
    'PENDING_REVIEW',
    'POINT_PENDING',
    'POINT_CONFIRMED',
    'EXPIRED',
    'LOCKED'
  ];
  return allowed.includes(normalized as SubmissionStatus) ? (normalized as SubmissionStatus) : 'CREATED';
}

function compactTimestamp(now: Date) {
  return now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function nonce(random: () => number) {
  return String(Math.floor(Math.max(0, Math.min(0.999999, random())) * 1000000)).padStart(6, '0');
}

export function mapUserRow(row: Row): UserProfile {
  const profile: UserProfile = {
    id: text(row.id),
    name: text(row.name, 'Nguoi dung Eco-loop'),
    email: text(row.email),
    role: role(row.role),
    group: text(row.group),
    points: number(row.points),
    status: userStatus(row.status)
  };
  const avatarKey = text(row.avatarKey ?? row.avatar_key).trim();
  const avatarUrl = text(row.avatarUrl ?? row.avatar_url).trim();
  const studentCode = text(row.studentCode ?? row.student_code).trim();
  const facultyCode = text(row.facultyCode ?? row.faculty_code).trim();
  const facultyName = text(row.facultyName ?? row.faculty_name).trim();
  const phoneNumber = text(row.phoneNumber ?? row.phone_number).trim();
  if (avatarKey) profile.avatarKey = avatarKey;
  if (avatarUrl) profile.avatarUrl = avatarUrl;
  if (studentCode) profile.studentCode = studentCode;
  if (facultyCode) profile.facultyCode = facultyCode;
  if (facultyName) profile.facultyName = facultyName;
  if (phoneNumber) profile.phoneNumber = phoneNumber;
  const profileCompleted = row.profileCompleted ?? row.profile_completed;
  const requiresProfileCompletion = row.requiresProfileCompletion ?? row.requires_profile_completion;
  if (typeof profileCompleted === 'boolean') profile.profileCompleted = profileCompleted;
  if (typeof requiresProfileCompletion === 'boolean') profile.requiresProfileCompletion = requiresProfileCompletion;
  return profile;
}

export function toUserRow(user: UserProfile): Row {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    group: user.group,
    points: user.points,
    status: user.status,
    avatar_key: user.avatarKey ?? null,
    avatar_url: user.avatarUrl ?? null,
    student_code: user.studentCode ?? null,
    faculty_code: user.facultyCode ?? null,
    phone_number: user.phoneNumber ?? null
  };
}

export function mapAvatarPresetRow(row: Row): AvatarPreset {
  return {
    key: text(row.key ?? row.id).trim(),
    label: text(row.label, 'Avatar Eco-loop').trim(),
    imageUrl: text(row.imageUrl ?? row.image_url).trim() || undefined,
    background: text(row.background, '#cbf9e4').trim() || '#cbf9e4',
    tile: text(row.tile, '#a8f2ab').trim() || '#a8f2ab',
    accent: text(row.accent, '#8bc34a').trim() || '#8bc34a',
    face: text(row.face, '#2c6e6e').trim() || '#2c6e6e',
    status: activeStatus(row.status),
    sortOrder: number(row.sortOrder ?? row.sort_order)
  };
}

export function mapBinRow(row: Row): BinStation {
  const station: BinStation = {
    id: text(row.id),
    name: text(row.name, 'Tram thu gom'),
    binGroup: text(row.binGroup ?? row.bin_group),
    location: text(row.location),
    building: text(row.building),
    floor: text(row.floor),
    qrCode: text(row.qrCode ?? row.qr_code),
    status: binStatus(row.status),
    capacity: percent(row.capacity)
  };
  if (row.latitude !== undefined) station.latitude = number(row.latitude);
  if (row.longitude !== undefined) station.longitude = number(row.longitude);
  const mapX = optionalPercent(row.mapX ?? row.map_x);
  const mapY = optionalPercent(row.mapY ?? row.map_y);
  if (mapX !== undefined) station.mapX = mapX;
  if (mapY !== undefined) station.mapY = mapY;
  return station;
}

export function mapWasteTypeRow(row: Row): WasteType {
  const unit = text(row.unit, 'item');
  return {
    id: text(row.id),
    name: text(row.name, 'Loai rac'),
    unit: unit === 'kg' || unit === 'g' ? unit : 'item',
    pointPerUnit: number(row.pointPerUnit ?? row.point_per_unit),
    recycleMethod: text(row.recycleMethod ?? row.recycle_method),
    status: text(row.status, 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active'
  };
}

export function buildSubmissionDraft({
  userId,
  input,
  wasteType,
  now = new Date(),
  random = Math.random
}: {
  userId: string;
  input: CreateSubmissionInput;
  wasteType: WasteType;
  now?: Date;
  random?: () => number;
}): RecyclingSubmission {
  const suffix = `${compactTimestamp(now)}-${nonce(random)}`;
  return {
    id: `sub-${suffix}`,
    userId,
    binId: input.binId,
    wasteTypeId: input.wasteTypeId,
    quantity: input.quantity,
    unit: wasteType.unit,
    qrToken: `ECL-SUB-${suffix}`,
    status: 'CREATED',
    createdAt: now,
    expiredAt: new Date(now.getTime() + 45 * 60 * 1000)
  };
}

export function mapSubmissionRow(row: Row): RecyclingSubmission {
  return {
    id: text(row.id),
    userId: text(row.userId ?? row.user_id),
    binId: text(row.binId ?? row.bin_id ?? row.station_id),
    wasteTypeId: text(row.wasteTypeId ?? row.waste_type_id),
    quantity: number(row.quantity),
    unit: mapWasteTypeRow({ unit: row.unit }).unit,
    qrToken: text(row.qrToken ?? row.qr_token),
    status: submissionStatus(row.status),
    createdAt: date(row.createdAt ?? row.created_at),
    expiredAt: date(row.expiredAt ?? row.expired_at),
    verifiedBy: text(row.verifiedBy ?? row.verified_by) || undefined,
    verifiedAt: row.verifiedAt || row.verified_at ? date(row.verifiedAt ?? row.verified_at) : undefined,
    actualQuantity: row.actualQuantity !== undefined || row.actual_quantity !== undefined ? number(row.actualQuantity ?? row.actual_quantity) : undefined,
    volunteerNote: text(row.volunteerNote ?? row.volunteer_note) || undefined
  };
}

export function buildPredictionDraft({
  userId,
  input,
  now = new Date(),
  random = Math.random
}: {
  userId: string;
  input: SavePredictionInput;
  now?: Date;
  random?: () => number;
}): PredictionRecord {
  const className = text(input.className).trim().toLowerCase();
  return {
    id: `ai-${compactTimestamp(now)}-${nonce(random)}`,
    className,
    confidence: Math.max(0, Math.min(1, number(input.confidence))),
    source: predictionSource(input.source),
    timestamp: now,
    binGroup: binGroupForAiClass(className),
    status: 'pending',
    userId,
    binId: input.binId,
    imageName: input.imageName,
    imageUrl: input.imageUrl,
    thumbnailUrl: input.thumbnailUrl
  };
}

export function mapPredictionRow(row: Row): PredictionRecord {
  const className = text(row.className ?? row.class).trim().toLowerCase();
  return {
    id: text(row.id),
    className,
    confidence: Math.max(0, Math.min(1, number(row.confidence))),
    source: predictionSource(row.source),
    timestamp: date(row.timestamp),
    binGroup: text(row.binGroup ?? row.bin_group, binGroupForAiClass(className)),
    status: predictionStatus(row.status),
    userId: text(row.userId ?? row.user_id) || undefined,
    binId: text(row.binId ?? row.bin_id) || undefined,
    imageName: text(row.imageName ?? row.image_name) || undefined,
    imageUrl: text(row.imageUrl ?? row.image_url) || undefined,
    thumbnailUrl: text(row.thumbnailUrl ?? row.thumbnail_url) || undefined
  };
}

export function toPredictionRow(prediction: PredictionRecord): Row {
  return {
    id: prediction.id,
    class: prediction.className,
    confidence: prediction.confidence,
    source: prediction.source,
    timestamp: prediction.timestamp.toISOString(),
    bin_group: prediction.binGroup,
    status: prediction.status,
    user_id: prediction.userId ?? null,
    bin_id: prediction.binId ?? null,
    image_name: prediction.imageName ?? null,
    image_url: prediction.imageUrl ?? null,
    thumbnail_url: prediction.thumbnailUrl ?? null
  };
}

export function mapProofImageRow(row: Row): ProofImage {
  return {
    id: text(row.id),
    submissionId: text(row.submissionId ?? row.submission_id),
    imageUrl: text(row.imageUrl ?? row.image_url),
    imageHash: text(row.imageHash ?? row.image_hash) || undefined,
    status: proofStatus(row.status),
    verificationCode: text(row.verificationCode ?? row.verification_code) || undefined,
    note: text(row.note) || undefined
  };
}

export function attachProofImagesToSubmissions(submissions: RecyclingSubmission[], proofImages: ProofImage[]) {
  return submissions.map(submission => {
    const proofImage = proofImages.find(item => item.submissionId === submission.id);
    return proofImage ? { ...submission, proofImage } : submission;
  });
}

export function toSubmissionRow(submission: RecyclingSubmission): Row {
  return {
    id: submission.id,
    user_id: submission.userId,
    bin_id: submission.binId,
    waste_type_id: submission.wasteTypeId,
    quantity: submission.quantity,
    unit: submission.unit,
    qr_token: submission.qrToken,
    status: submission.status,
    created_at: submission.createdAt.toISOString(),
    expired_at: submission.expiredAt.toISOString(),
    verified_by: submission.verifiedBy ?? null,
    verified_at: submission.verifiedAt?.toISOString() ?? null,
    actual_quantity: submission.actualQuantity ?? null,
    volunteer_note: submission.volunteerNote ?? null
  };
}

export function mapPointHistoryRow(row: Row): EcoPointTransaction {
  const points = number(row.points);
  return {
    id: text(row.id),
    userId: text(row.userId ?? row.user_id),
    submissionId: text(row.submissionId ?? row.submission_id ?? row.predictionId ?? row.prediction_id) || undefined,
    points: Math.abs(points),
    type: points < 0 ? 'spend' : text(row.source).includes('manual') ? 'adjust' : 'earn',
    status: text(row.status, 'confirmed') === 'rejected' ? 'rejected' : text(row.status, 'confirmed') === 'pending' ? 'pending' : 'confirmed',
    description: text(row.description ?? row.action, 'Cap nhat Ecopoint'),
    createdAt: date(row.createdAt ?? row.created_at ?? row.timestamp)
  };
}


export function mapFeedbackRow(row: Row): Feedback {
  return {
    id: text(row.id),
    userId: text(row.userId ?? row.user_id),
    stationId: text(row.stationId ?? row.station_id ?? row.binId ?? row.bin_id) || undefined,
    type: feedbackType(row.type ?? row.category),
    message: text(row.message),
    status: feedbackStatus(row.status),
    createdAt: date(row.createdAt ?? row.created_at ?? row.timestamp)
  };
}
export function mapQrScanLogRow(row: Row): QRScanLog {
  return {
    id: text(row.id),
    qrToken: text(row.qrToken ?? row.qr_token),
    scannedBy: text(row.scannedBy ?? row.scanned_by),
    stationId: text(row.stationId ?? row.station_id) || undefined,
    result: qrScanResult(row.result),
    note: text(row.note),
    scannedAt: date(row.scannedAt ?? row.scanned_at)
  };
}
export function mapMissionRow(row: Row): Mission {
  const target = Math.max(1, number(row.target, 1));
  const status = missionStatus(row.status);
  const current = Math.min(target, Math.max(0, number(row.current)));
  const completed = Boolean(row.completed) || status === 'completed' || current >= target;
  return {
    id: text(row.id),
    title: text(row.title, 'Nhiem vu xanh'),
    description: text(row.description),
    current,
    target,
    rewardPoints: number(row.rewardPoints ?? row.reward_points),
    actionLabel: completed ? 'Xong' : text(row.actionLabel ?? row.action_label, 'Tiep tuc'),
    completed,
    status: completed ? 'completed' : status
  };
}

export function mapUserMissionRow(row: Row): UserMission {
  const completed = Boolean(row.completed) || missionStatus(row.status) === 'completed';
  return {
    id: text(row.id),
    userId: text(row.userId ?? row.user_id),
    missionId: text(row.missionId ?? row.mission_id),
    current: Math.max(0, number(row.current)),
    completed,
    status: completed ? 'completed' : missionStatus(row.status)
  };
}

export function mergeMissionProgress(missions: Mission[], progressRows: UserMission[], userId: string): Mission[] {
  return missions.map(mission => {
    const progress = progressRows.find(item => item.userId === userId && item.missionId === mission.id);
    if (!progress) return mission;
    const current = Math.min(mission.target, Math.max(0, progress.current));
    const completed = progress.completed || current >= mission.target;
    return {
      ...mission,
      current,
      completed,
      status: completed ? 'completed' : progress.status,
      actionLabel: completed ? 'Xong' : mission.actionLabel
    };
  });
}
export function mapRewardRow(row: Row): Reward {
  const status = text(row.status, 'active').trim().toLowerCase();
  return {
    id: text(row.id),
    title: text(row.title, 'Qua tang Eco-loop'),
    description: text(row.description),
    categoryId: text(row.categoryId ?? row.category_id) || undefined,
    categoryName: text(row.categoryName ?? row.category_name) || undefined,
    costPoints: number(row.costPoints ?? row.cost_points),
    status: status === 'active' ? 'active' : 'inactive',
    color: text(row.color, '#2F8F5B')
  };
}
export function mapRewardRedemptionRow(row: Row): RewardRedemption {
  const status = text(row.status, 'requested').trim().toLowerCase();
  const items = Array.isArray(row.items)
    ? row.items.map((item: Row) => ({
        rewardId: text(item.rewardId ?? item.reward_id),
        rewardLabel: text(item.rewardLabel ?? item.reward_label ?? item.rewardTitle ?? item.reward_title),
        quantity: number(item.quantity),
        pointsEach: number(item.pointsEach ?? item.points_each),
        pointsTotal: number(item.pointsTotal ?? item.points_total)
      }))
    : undefined;
  return {
    id: text(row.id),
    userId: text(row.userId ?? row.user_id),
    rewardId: text(row.rewardId ?? row.reward_id ?? row.reward_label),
    rewardLabel: text(row.rewardLabel ?? row.reward_label),
    costPoints: number(row.costPoints ?? row.cost_points),
    status: ['approved', 'rejected', 'delivered', 'pending', 'scanned', 'fulfilled', 'expired', 'cancelled'].includes(status) ? status as RewardRedemption['status'] : 'requested',
    requestedAt: date(row.requestedAt ?? row.requested_at),
    reviewedAt: row.reviewedAt || row.reviewed_at ? date(row.reviewedAt ?? row.reviewed_at) : undefined,
    adminNote: text(row.adminNote ?? row.admin_note) || undefined,
    qrToken: text(row.qrToken ?? row.qr_token) || undefined,
    expiresAt: row.expiresAt || row.expires_at ? date(row.expiresAt ?? row.expires_at) : undefined,
    totalPoints: row.totalPoints ?? row.total_points ? number(row.totalPoints ?? row.total_points) : undefined,
    ...(items ? { items } : {})
  };
}

export function applyRealtimeChange<T extends { id: string }>(items: T[], payload: RealtimeChange<T>) {
  if (payload.eventType === 'DELETE') {
    const deletedId = payload.old?.id;
    return deletedId ? items.filter(item => item.id !== deletedId) : items;
  }
  if (!payload.new?.id) return items;
  const withoutCurrent = items.filter(item => item.id !== payload.new?.id);
  return [payload.new, ...withoutCurrent];
}
