export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  History: undefined;
  Rewards: undefined;
  Leaderboard: undefined;
  About: undefined;
};

export type StudentTabParamList = {
  Home: undefined;
  Rewards: undefined;
  Submit: undefined;
  Map: undefined;
  Profile: undefined;
};

export type VolunteerTabParamList = {
  Duty: undefined;
  Scanner: undefined;
  History: undefined;
  Profile: undefined;
};

export type MainTabParamList = StudentTabParamList & VolunteerTabParamList;

export type UserRole = 'student' | 'volunteer' | 'admin';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  group: string;
  points: number;
  status: 'active' | 'locked' | 'pending' | 'rejected';
  avatarKey?: string;
  avatarUrl?: string;
};

export type AvatarPreset = {
  key: string;
  label: string;
  imageUrl?: string;
  background: string;
  tile: string;
  accent: string;
  face: string;
  status: 'active' | 'inactive';
  sortOrder: number;
};

export type BinStation = {
  id: string;
  name: string;
  binGroup: string;
  location: string;
  building: string;
  floor: string;
  qrCode: string;
  status: 'open' | 'full' | 'maintenance' | 'closed';
  capacity: number;
  latitude?: number;
  longitude?: number;
  mapX?: number;
  mapY?: number;
};

export type WasteType = {
  id: string;
  name: string;
  unit: 'item' | 'kg' | 'g';
  pointPerUnit: number;
  recycleMethod: string;
  status: 'active' | 'inactive';
};

export type SubmissionStatus =
  | 'CREATED'
  | 'QR_SCANNED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PENDING_REVIEW'
  | 'POINT_PENDING'
  | 'POINT_CONFIRMED'
  | 'EXPIRED'
  | 'LOCKED';

export type RecyclingSubmission = {
  id: string;
  userId: string;
  binId: string;
  wasteTypeId: string;
  quantity: number;
  unit: WasteType['unit'];
  qrToken: string;
  status: SubmissionStatus;
  createdAt: Date;
  expiredAt: Date;
  proofImage?: ProofImage;
  verifiedBy?: string;
  verifiedAt?: Date;
  actualQuantity?: number;
  volunteerNote?: string;
};

export type CreateSubmissionInput = {
  binId: string;
  wasteTypeId: string;
  quantity: number;
};

export type CreateFeedbackInput = {
  stationId?: string;
  type: Feedback['type'];
  message: string;
};

export type CreateProofImageInput = {
  imageUrl?: string;
  imageUri?: string;
  fileName?: string;
  mimeType?: string;
  imageHash?: string;
  verificationCode?: string;
  note?: string;
  status?: ProofImage['status'];
};

export type PredictionSource = 'upload' | 'camera';

export type PredictionStatus = 'pending' | 'approved' | 'rejected';

export type PredictionRecord = {
  id: string;
  className: string;
  confidence: number;
  source: PredictionSource;
  timestamp: Date;
  binGroup: string;
  status: PredictionStatus;
  userId?: string;
  binId?: string;
  imageName?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
};

export type SavePredictionInput = {
  className: string;
  confidence: number;
  source: PredictionSource;
  binId?: string;
  imageUri?: string;
  imageName?: string;
  mimeType?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
};

export type EcoPointTransaction = {
  id: string;
  userId: string;
  submissionId?: string;
  points: number;
  type: 'earn' | 'spend' | 'adjust';
  status: 'pending' | 'confirmed' | 'rejected';
  description: string;
  source?: string;
  createdAt: Date;
};

export type Mission = {
  id: string;
  title: string;
  description: string;
  current: number;
  target: number;
  rewardPoints: number;
  actionLabel: string;
  completed: boolean;
  status: 'active' | 'completed' | 'expired';
};


export type UserMission = {
  id: string;
  userId: string;
  missionId: string;
  current: number;
  completed: boolean;
  status: Mission['status'];
};
export type Reward = {
  id: string;
  title: string;
  description: string;
  categoryId?: string;
  categoryName?: string;
  costPoints: number;
  status: 'active' | 'inactive';
  color: string;
  stock?: number;
};

export type RewardRedemption = {
  id: string;
  userId: string;
  rewardId: string;
  rewardLabel: string;
  costPoints: number;
  status: 'requested' | 'approved' | 'rejected' | 'delivered' | 'pending' | 'scanned' | 'fulfilled' | 'expired' | 'cancelled';
  requestedAt: Date;
  reviewedAt?: Date;
  adminNote?: string;
  qrToken?: string;
  expiresAt?: Date;
  totalPoints?: number;
  items?: Array<{ rewardId: string; rewardLabel: string; quantity: number; pointsEach: number; pointsTotal: number }>;
};

export type Feedback = {
  id: string;
  userId: string;
  stationId?: string;
  type: 'bin_full' | 'qr_error' | 'wrong_sorting' | 'damage' | 'other';
  message: string;
  status: 'new' | 'in_progress' | 'resolved';
  createdAt: Date;
};

export type ProofImage = {
  id: string;
  submissionId: string;
  imageUrl: string;
  imageHash?: string;
  status: 'pending' | 'accepted' | 'rejected';
  verificationCode?: string;
  note?: string;
};

export type QRScanResult =
  | 'SUCCESS'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'INVALID_TOKEN'
  | 'WRONG_STATION'
  | 'INVALID_ROLE'
  | 'SUSPECTED_FRAUD';

export type QRScanLog = {
  id: string;
  qrToken: string;
  scannedBy: string;
  stationId?: string;
  result: QRScanResult;
  note: string;
  scannedAt: Date;
};

export type QRScanOutcome = {
  result: QRScanResult;
  submission?: RecyclingSubmission;
  note: string;
};
