import {
  BinStation,
  CreateFeedbackInput,
  CreateSubmissionInput,
  EcoPointTransaction,
  Feedback,
  ProofImage,
  RecyclingSubmission,
  Reward,
  UserProfile,
  UserRole,
  WasteType
} from '../types';

export type AuthService = {
  signIn: (role: UserRole, email: string, password: string) => UserProfile;
  signUp: (name: string, email: string, password: string, role: UserRole) => UserProfile;
  loadProfile: (userId: string) => UserProfile | undefined;
};

export type StationService = {
  listStations: () => BinStation[];
};

export type WasteGuideService = {
  listWasteTypes: () => WasteType[];
};

export type SubmissionService = {
  createSubmission: (userId: string, input: CreateSubmissionInput, wasteTypes: WasteType[]) => RecyclingSubmission;
  findByQr: (submissions: RecyclingSubmission[], qrToken: string) => RecyclingSubmission | undefined;
  markScanned: (submissions: RecyclingSubmission[], qrToken: string) => RecyclingSubmission[];
  confirm: (
    submissions: RecyclingSubmission[],
    submissionId: string,
    actualQuantity: number,
    volunteerId: string,
    volunteerNote?: string
  ) => RecyclingSubmission[];
  reject: (
    submissions: RecyclingSubmission[],
    submissionId: string,
    volunteerId: string,
    volunteerNote?: string
  ) => RecyclingSubmission[];
  requestReview: (
    submissions: RecyclingSubmission[],
    submissionId: string,
    volunteerId: string,
    volunteerNote?: string
  ) => RecyclingSubmission[];
  attachProofImage: (
    submissions: RecyclingSubmission[],
    submissionId: string,
    proofImage: ProofImage
  ) => RecyclingSubmission[];
};

export type PointService = {
  createEarnTransaction: (
    submission: RecyclingSubmission,
    wasteType: WasteType,
    actualQuantity: number
  ) => EcoPointTransaction;
  createSpendTransaction: (userId: string, reward: Reward) => EcoPointTransaction;
};

export type RewardService = {
  listRewards: () => Reward[];
};

export type FeedbackService = {
  createFeedback: (userId: string, input: CreateFeedbackInput) => Feedback;
};
