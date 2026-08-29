import { AvatarPreset, BinStation, EcoPointTransaction, Feedback, Mission, PredictionRecord, RecyclingSubmission, Reward, QRScanLog, RewardRedemption, UserProfile, WasteType } from '../types';
import { MobileInitialData, OperatingReadiness } from '../services/backendMobileStore';

type RemoteHydrationState = {
  syncSource: 'backend';
  syncError: string;
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
  qrScanLogs: QRScanLog[];
  avatarOptions: AvatarPreset[];
  dutyStationId: string;
};

export function resolveRemoteHydrationState(data: MobileInitialData, readiness: OperatingReadiness): RemoteHydrationState {
  return {
    syncSource: 'backend',
    syncError: readiness.ok ? '' : `Backend PostgreSQL chưa có đủ dữ liệu trạm hoặc loại rác để vận hành (${readiness.missing.join(', ')}). Vui lòng tạo dữ liệu quản lý trước khi tiếp tục.`,
    users: data.users,
    stations: data.stations,
    wasteTypes: data.wasteTypes,
    predictions: data.predictions,
    submissions: data.submissions,
    pointTransactions: data.pointTransactions,
    feedbacks: data.feedbacks,
    missions: data.missions,
    rewards: data.rewards,
    rewardRedemptions: data.rewardRedemptions,
    qrScanLogs: data.qrScanLogs,
    avatarOptions: data.avatarOptions,
    dutyStationId: data.stations[0]?.id ?? ''
  };
}
