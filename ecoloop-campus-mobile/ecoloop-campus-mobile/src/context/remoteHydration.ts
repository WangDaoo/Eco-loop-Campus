import { mockAiPredictions, mockFeedbacks, mockMissions, mockPointTransactions, mockQrScanLogs, mockRewardRedemptions, mockRewards, mockStations, mockSubmissions, mockUsers, mockWasteTypes } from '../data/mockData';
import { BinStation, EcoPointTransaction, Feedback, Mission, PredictionRecord, RecyclingSubmission, Reward, QRScanLog, RewardRedemption, UserProfile, WasteType } from '../types';
import { MobileInitialData, OperatingReadiness } from '../services/supabaseMobileStore';

type RemoteHydrationState = {
  syncSource: 'mock' | 'supabase';
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
  dutyStationId: string;
};

export function resolveRemoteHydrationState(data: MobileInitialData, readiness: OperatingReadiness): RemoteHydrationState {
  if (!readiness.ok) {
    return {
      syncSource: 'mock',
      syncError: `Chưa có đủ dữ liệu trạm hoặc loại rác để vận hành (${readiness.missing.join(', ')}). Vui lòng đồng bộ dữ liệu trước khi tiếp tục.`,
      users: mockUsers,
      stations: mockStations,
      wasteTypes: mockWasteTypes,
      predictions: mockAiPredictions,
      submissions: mockSubmissions,
      pointTransactions: mockPointTransactions,
      feedbacks: mockFeedbacks,
      missions: mockMissions,
      rewards: mockRewards,
      rewardRedemptions: mockRewardRedemptions,
      qrScanLogs: mockQrScanLogs,
      dutyStationId: mockStations[0]?.id ?? ''
    };
  }

  return {
    syncSource: 'supabase',
    syncError: '',
    users: data.users.length ? data.users : mockUsers,
    stations: data.stations,
    wasteTypes: data.wasteTypes,
    predictions: data.predictions ?? mockAiPredictions,
    submissions: data.submissions,
    pointTransactions: data.pointTransactions,
    feedbacks: data.feedbacks,
    missions: data.missions?.length ? data.missions : mockMissions,
    rewards: data.rewards?.length ? data.rewards : mockRewards,
    rewardRedemptions: data.rewardRedemptions ?? mockRewardRedemptions,
    qrScanLogs: data.qrScanLogs ?? mockQrScanLogs,
    dutyStationId: data.stations[0]?.id ?? ''
  };
}
