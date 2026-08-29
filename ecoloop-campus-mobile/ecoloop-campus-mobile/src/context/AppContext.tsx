import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
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
  WasteType
} from '../types';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { missionIdsForFeedback, missionIdsForSubmission } from '../services/missionAutomation';
import { createSupabaseMobileStore } from '../services/supabaseMobileStore';
import { resolveWalletPoints } from '../services/walletPoints';
import {
  applyRealtimeChange,
  mapBinRow,
  mapFeedbackRow,
  mapMissionRow,
  mapPointHistoryRow,
  mapPredictionRow,
  mapProofImageRow,
  mapQrScanLogRow,
  mapAvatarPresetRow,
  mapRewardRow,
  mapRewardRedemptionRow,
  mapUserMissionRow,
  mergeMissionProgress,
  mapSubmissionRow,
  mapUserRow,
  mapWasteTypeRow
} from '../services/supabaseAdapters';
import { resolveRemoteHydrationState } from './remoteHydration';

type SyncSource = 'supabase';

type AppContextValue = {
  currentUser: UserProfile;
  isAuthenticated: boolean;
  isLoading: boolean;
  syncSource: SyncSource;
  syncError: string;
  users: UserProfile[];
  points: number;
  pointTransactions: EcoPointTransaction[];
  aiPredictions: PredictionRecord[];
  submissions: RecyclingSubmission[];
  stations: BinStation[];
  wasteTypes: WasteType[];
  missions: Mission[];
  rewards: Reward[];
  rewardRedemptions: RewardRedemption[];
  qrScanLogs: QRScanLog[];
  feedbacks: Feedback[];
  avatarOptions: AvatarPreset[];
  dutyStationId: string;
  signIn: (role: UserProfile['role'], email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, role: UserProfile['role']) => Promise<UserProfile | undefined>;
  signOut: () => Promise<void>;
  updateAvatar: (avatarKey: string) => Promise<void>;
  updatePassword: (email: string, currentPassword: string, newPassword: string) => Promise<void>;
  requestReward: (reward: Reward) => Promise<boolean>;
  handleMissionAction: (id: string) => void;
  createSubmission: (input: CreateSubmissionInput) => Promise<RecyclingSubmission>;
  saveAiPrediction: (input: SavePredictionInput) => Promise<PredictionRecord | undefined>;
  submitFeedback: (input: CreateFeedbackInput) => Promise<Feedback | undefined>;
  setDutyStation: (stationId: string) => void;
  findSubmissionByQr: (qrToken: string) => RecyclingSubmission | undefined;
  markSubmissionScanned: (qrToken: string) => Promise<QRScanOutcome>;
  confirmSubmission: (submissionId: string, actualQuantity: number, volunteerNote?: string) => Promise<void>;
  rejectSubmission: (submissionId: string, volunteerNote?: string) => Promise<void>;
  requestReview: (submissionId: string, volunteerNote?: string) => Promise<void>;
  attachProofImage: (submissionId: string, input: CreateProofImageInput) => Promise<RecyclingSubmission | undefined>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

const EMPTY_USER: UserProfile = {
  id: '',
  name: '',
  email: '',
  role: 'student',
  group: '',
  points: 0,
  status: 'active'
};

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function applyProofImage(items: RecyclingSubmission[], proofImage: ProofImage | undefined, submissionId?: string) {
  const targetId = proofImage?.submissionId ?? submissionId;
  if (!targetId) return items;
  return items.map(item => (item.id === targetId ? { ...item, proofImage } : item));
}

function createMissionRewardPoint(userId: string, mission: Mission): EcoPointTransaction {
  return {
    id: `mission-point-${mission.id}-${Date.now()}`,
    userId,
    points: mission.rewardPoints,
    type: 'earn',
    status: 'confirmed',
    description: `Hoàn thành nhiệm vụ ${mission.title}`,
    source: 'mission_reward',
    createdAt: new Date()
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(EMPTY_USER);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncSource, setSyncSource] = useState<SyncSource>('supabase');
  const [syncError, setSyncError] = useState('');
  const [aiPredictions, setAiPredictions] = useState<PredictionRecord[]>([]);
  const [submissions, setSubmissions] = useState<RecyclingSubmission[]>([]);
  const [pointTransactions, setPointTransactions] = useState<EcoPointTransaction[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardRedemptions, setRewardRedemptions] = useState<RewardRedemption[]>([]);
  const [qrScanLogs, setQrScanLogs] = useState<QRScanLog[]>([]);
  const [stations, setStations] = useState<BinStation[]>([]);
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [avatarOptions, setAvatarOptions] = useState<AvatarPreset[]>([]);
  const [dutyStationId, setDutyStationId] = useState('');
  const remoteStore = useMemo(() => (isSupabaseConfigured && supabase ? createSupabaseMobileStore(supabase) : null), []);

  const failRemoteMutation = (error: unknown): never => {
    const message = messageOf(error);
    setSyncError(message);
    throw error instanceof Error ? error : new Error(message);
  };

  const hydrateRemoteData = useCallback(
    async (profile: UserProfile) => {
      if (!remoteStore) return;
      try {
        const schemaHealth = await remoteStore.checkSchema();
        if (!schemaHealth.ok) throw new Error(schemaHealth.message);

        const data = await remoteStore.loadInitialData(profile);
        const state = resolveRemoteHydrationState(data, remoteStore.getOperatingReadiness(data));
        setUsers(state.users);
        setStations(state.stations);
        setWasteTypes(state.wasteTypes);
        setAiPredictions(state.predictions);
        setSubmissions(state.submissions);
        setPointTransactions(state.pointTransactions);
        setFeedbacks(state.feedbacks);
        setAvatarOptions(state.avatarOptions);
        setMissions(state.missions);
        setRewards(state.rewards);
        setRewardRedemptions(state.rewardRedemptions);
        setQrScanLogs(state.qrScanLogs);
        setDutyStationId(state.dutyStationId);
        setSyncSource(state.syncSource);
        setSyncError(state.syncError);
      } catch (error) {
        setUsers([]);
        setStations([]);
        setWasteTypes([]);
        setAiPredictions([]);
        setSubmissions([]);
        setPointTransactions([]);
        setFeedbacks([]);
        setAvatarOptions([]);
        setMissions([]);
        setRewards([]);
        setRewardRedemptions([]);
        setQrScanLogs([]);
        setDutyStationId('');
        setSyncSource('supabase');
        setSyncError(messageOf(error));
      }
    },
    [remoteStore]
  );

  useEffect(() => {
    let active = true;
    async function loadSession() {
      if (!remoteStore) return;
      setIsLoading(true);
      try {
        const profile = await remoteStore.loadSessionProfile();
        if (!active || !profile) return;
        if (profile.status !== 'active') {
          await remoteStore.signOut();
          setIsAuthenticated(false);
          setSyncError('Tài khoản đang chờ phê duyệt hoặc chưa được mở để sử dụng.');
          return;
        }
        setCurrentUser(profile);
        setIsAuthenticated(true);
        await hydrateRemoteData(profile);
      } catch (error) {
        if (active) setSyncError(messageOf(error));
      } finally {
        if (active) setIsLoading(false);
      }
    }
    loadSession();
    return () => {
      active = false;
    };
  }, [hydrateRemoteData, remoteStore]);

  useEffect(() => {
    if (!remoteStore || !isAuthenticated || !remoteStore.subscribeRealtime) return undefined;
    return remoteStore.subscribeRealtime({
      users: payload => {
        const row = payload.new ?? payload.old;
        if (!row?.id) return;
        if (payload.eventType !== 'DELETE' && row.id === currentUser.id) setCurrentUser(mapUserRow(row));
        setUsers(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: payload.new ? mapUserRow(payload.new) : undefined,
            old: payload.old ? ({ id: String(payload.old.id) } as UserProfile) : undefined
          })
        );
      },
      bins: payload => {
        setStations(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: payload.new ? mapBinRow(payload.new) : undefined,
            old: payload.old ? ({ id: String(payload.old.id) } as BinStation) : undefined
          })
        );
      },
      waste_types: payload => {
        setWasteTypes(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: payload.new ? mapWasteTypeRow(payload.new) : undefined,
            old: payload.old ? ({ id: String(payload.old.id) } as WasteType) : undefined
          })
        );
      },
      predictions: payload => {
        const mapped = payload.new ? mapPredictionRow(payload.new) : undefined;
        if (mapped && currentUser.role === 'student' && mapped.userId !== currentUser.id) return;
        setAiPredictions(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: mapped,
            old: payload.old ? ({ id: String(payload.old.id) } as PredictionRecord) : undefined
          })
        );
      },
      recycling_submissions: payload => {
        if (!payload.new && !payload.old) return;
        const mapped = payload.new ? mapSubmissionRow(payload.new) : undefined;
        if (mapped && currentUser.role === 'student' && mapped.userId !== currentUser.id) return;
        setSubmissions(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: mapped,
            old: payload.old ? ({ id: String(payload.old.id) } as RecyclingSubmission) : undefined
          })
        );
      },
      point_history: payload => {
        const mapped = payload.new ? mapPointHistoryRow(payload.new) : undefined;
        if (mapped && currentUser.role === 'student' && mapped.userId !== currentUser.id) return;
        setPointTransactions(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: mapped,
            old: payload.old ? ({ id: String(payload.old.id) } as EcoPointTransaction) : undefined
          })
        );
      },
      feedback: payload => {
        setFeedbacks(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: payload.new ? mapFeedbackRow(payload.new) : undefined,
            old: payload.old ? ({ id: String(payload.old.id) } as Feedback) : undefined
          })
        );
      },
      avatar_presets: payload => {
        setAvatarOptions(items => {
          const oldKey = String(payload.old?.key ?? payload.old?.id ?? '');
          if (payload.eventType === 'DELETE') return oldKey ? items.filter(item => item.key !== oldKey) : items;
          if (!payload.new) return items;
          const nextOption = mapAvatarPresetRow(payload.new);
          const nextItems = [nextOption, ...items.filter(item => item.key !== nextOption.key)];
          return nextItems.filter(option => option.status === 'active');
        });
      },
      missions: payload => {
        const mapped = payload.new ? mapMissionRow(payload.new) : undefined;
        setMissions(items => {
          const existing = mapped ? items.find(item => item.id === mapped.id) : undefined;
          const nextMission = mapped && existing
            ? {
                ...mapped,
                current: existing.current,
                completed: existing.completed,
                status: existing.completed ? 'completed' as const : mapped.status,
                actionLabel: existing.completed ? 'Xong' : mapped.actionLabel
              }
            : mapped;
          return applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: nextMission,
            old: payload.old ? ({ id: String(payload.old.id) } as Mission) : undefined
          });
        });
      },
      user_missions: payload => {
        const row = payload.new ?? payload.old;
        const userId = String(row?.user_id ?? row?.userId ?? '');
        const missionId = String(row?.mission_id ?? row?.missionId ?? '');
        if (!missionId || userId !== currentUser.id) return;

        if (payload.eventType === 'DELETE') {
          setMissions(items =>
            items.map(item =>
              item.id === missionId
                ? {
                    ...item,
                    current: 0,
                    completed: false,
                    status: item.status === 'completed' ? 'active' : item.status,
                    actionLabel: item.actionLabel === 'Xong' ? 'Tiep tuc' : item.actionLabel
                  }
                : item
            )
          );
          return;
        }

        if (!payload.new) return;
        const progress = mapUserMissionRow(payload.new);
        setMissions(items => mergeMissionProgress(items, [progress], currentUser.id));
      },      rewards: payload => {
        setRewards(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: payload.new ? mapRewardRow(payload.new) : undefined,
            old: payload.old ? ({ id: String(payload.old.id) } as Reward) : undefined
          })
        );
      },
      reward_redemptions: payload => {
        const mapped = payload.new ? mapRewardRedemptionRow(payload.new) : undefined;
        if (mapped && currentUser.role === 'student' && mapped.userId !== currentUser.id) return;
        setRewardRedemptions(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: mapped,
            old: payload.old ? ({ id: String(payload.old.id) } as RewardRedemption) : undefined
          })
        );
      },      qr_scan_logs: payload => {
        const mapped = payload.new ? mapQrScanLogRow(payload.new) : undefined;
        if (mapped && currentUser.role === 'student') return;
        if (mapped && currentUser.role === 'volunteer' && mapped.scannedBy !== currentUser.id && mapped.stationId !== dutyStationId) return;
        setQrScanLogs(items =>
          applyRealtimeChange(items, {
            eventType: payload.eventType,
            new: mapped,
            old: payload.old ? ({ id: String(payload.old.id) } as QRScanLog) : undefined
          })
        );
      },      proof_images: payload => {
        if (payload.eventType === 'DELETE') {
          const submissionId = String(payload.old?.submission_id ?? payload.old?.submissionId ?? '');
          setSubmissions(items => applyProofImage(items, undefined, submissionId));
          return;
        }
        if (!payload.new) return;
        const row = payload.new;
        setSubmissions(items => applyProofImage(items, mapProofImageRow(row)));
      }
    });
  }, [currentUser.id, currentUser.role, dutyStationId, isAuthenticated, remoteStore]);

  useEffect(() => {
    if (!remoteStore || !isAuthenticated || !currentUser.id) return undefined;
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') void hydrateRemoteData(currentUser);
    });
    return () => {
      subscription.remove();
    };
  }, [currentUser, hydrateRemoteData, isAuthenticated, remoteStore]);

  const points = useMemo(
    () => resolveWalletPoints({ profilePoints: currentUser.points, pointTransactions, syncSource }),
    [currentUser.points, pointTransactions, syncSource]
  );

  const signIn = async (role: UserProfile['role'], email: string, password: string) => {
    setIsLoading(true);
    try {
      if (!remoteStore) throw new Error('Supabase chưa được cấu hình. Không thể đăng nhập.');
      const user = await remoteStore.signIn(role, email, password);
      setCurrentUser(user);
      setIsAuthenticated(true);
      await hydrateRemoteData(user);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string, role: UserProfile['role']) => {
    setIsLoading(true);
    try {
      if (!remoteStore) throw new Error('Supabase chưa được cấu hình. Không thể đăng ký.');
      const user = await remoteStore.signUp(name, email, password, role);
      if ((user as UserProfile & { requiresEmailConfirmation?: boolean }).requiresEmailConfirmation) {
        setCurrentUser(user);
        setIsAuthenticated(false);
        setSyncSource('supabase');
        setSyncError('Tài khoản đã được tạo. Vui lòng xác nhận email hoặc đăng nhập lại khi tài khoản sẵn sàng.');
        return user;
      }
      if (user.status !== 'active') {
        setCurrentUser(user);
        setIsAuthenticated(false);
        setSyncSource('supabase');
        setSyncError('Tài khoản tình nguyện viên đang chờ admin phê duyệt.');
        await remoteStore.signOut();
        return user;
      }
      setCurrentUser(user);
      setIsAuthenticated(true);
      await hydrateRemoteData(user);
      return user;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (remoteStore) await remoteStore.signOut();
      setIsAuthenticated(false);
      setCurrentUser(EMPTY_USER);
      setUsers([]);
      setAiPredictions([]);
      setSubmissions([]);
      setPointTransactions([]);
      setRewards([]);
      setRewardRedemptions([]);
      setQrScanLogs([]);
      setMissions([]);
      setFeedbacks([]);
      setAvatarOptions([]);
      setStations([]);
      setWasteTypes([]);
      setDutyStationId('');
      setSyncSource('supabase');
      setSyncError('');
    } finally {
      setIsLoading(false);
    }
  };

  const updateAvatar = async (avatarKey: string) => {
    try {
      if (!remoteStore || !isAuthenticated) throw new Error('Cần đăng nhập Supabase để đổi avatar.');
      const nextUser = await remoteStore.updateAvatar(currentUser.id, avatarKey);
      setCurrentUser(nextUser);
      setUsers(items => items.map(item => (item.id === nextUser.id ? nextUser : item)));
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const updatePassword = async (email: string, currentPassword: string, newPassword: string) => {
    setIsLoading(true);
    try {
      if (!remoteStore || !isAuthenticated) throw new Error('Đổi mật khẩu cần đăng nhập bằng tài khoản Eco-loop Campus.');
      await remoteStore.updatePassword(email, currentPassword, newPassword);
    } finally {
      setIsLoading(false);
    }
  };

  const requestReward = async (reward: Reward) => {
    if (points < reward.costPoints) return false;
    try {
      if (!remoteStore || !isAuthenticated) return false;
      const redemption = await remoteStore.requestReward(currentUser.id, reward);
      setRewardRedemptions(items => [redemption, ...items.filter(item => item.id !== redemption.id)]);
      return true;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const handleMissionAction = async (id: string) => {
    try {
      if (!remoteStore || !isAuthenticated) return;
      const mission = await remoteStore.advanceMission(currentUser.id, id, missions);
      setMissions(items => [mission, ...items.filter(item => item.id !== mission.id)]);
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const advanceMissionsForAction = async (missionIds: string[]) => {
    try {
      for (const missionId of missionIds) {
        await handleMissionAction(missionId);
      }
    } catch (error) {
      setSyncError(messageOf(error));
    }
  };

  const saveAiPrediction = async (input: SavePredictionInput) => {
    try {
      if (!remoteStore || !isAuthenticated) return undefined;
      const prediction = await remoteStore.saveAiPrediction(currentUser.id, input);
      setAiPredictions(items => [prediction, ...items.filter(item => item.id !== prediction.id)]);
      return prediction;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const createSubmission = async (input: CreateSubmissionInput) => {
    try {
      if (!remoteStore || !isAuthenticated) throw new Error('Cần đăng nhập Supabase để tạo QR giao dịch.');
      const submission = await remoteStore.createSubmission(currentUser.id, input, wasteTypes);
      setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
      await advanceMissionsForAction(missionIdsForSubmission(submission));
      return submission;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const submitFeedback = async (input: CreateFeedbackInput) => {
    if (!input.message.trim()) return undefined;

    try {
      if (!remoteStore || !isAuthenticated) throw new Error('Cần đăng nhập Supabase để gửi phản hồi.');
      const feedback = await remoteStore.submitFeedback(currentUser, input);
      setFeedbacks(items => [feedback, ...items.filter(item => item.id !== feedback.id)]);
      await advanceMissionsForAction(missionIdsForFeedback());
      return feedback;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const setDutyStation = (stationId: string) => {
    setDutyStationId(stationId);
  };

  const findSubmissionByQr = (qrToken: string) => submissions.find(item => item.qrToken.trim().toUpperCase() === qrToken.trim().toUpperCase());

  const markSubmissionScanned = async (qrToken: string): Promise<QRScanOutcome> => {
    try {
      if (!remoteStore || !isAuthenticated) throw new Error('Cần đăng nhập Supabase để quét QR giao dịch.');
      const outcome = await remoteStore.markSubmissionScanned(qrToken, currentUser.id, dutyStationId);
      if (outcome.submission) setSubmissions(items => [outcome.submission!, ...items.filter(item => item.id !== outcome.submission!.id)]);
      return outcome;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const confirmSubmission = async (submissionId: string, actualQuantity: number, volunteerNote?: string) => {
    try {
      const submission = submissions.find(item => item.id === submissionId);
      const wasteType = wasteTypes.find(item => item.id === submission?.wasteTypeId);
      if (!submission || !wasteType) return;

      if (!remoteStore || !isAuthenticated) throw new Error('Cần đăng nhập Supabase để xác nhận QR.');
      const result = await remoteStore.confirmSubmission(submissionId, actualQuantity, currentUser.id, volunteerNote, wasteTypes);
      setSubmissions(items => [result.submission, ...items.filter(item => item.id !== result.submission.id)]);
      setPointTransactions(items => [result.point, ...items.filter(item => item.id !== result.point.id)]);
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const rejectSubmission = async (submissionId: string, volunteerNote?: string) => {
    try {
      if (!remoteStore || !isAuthenticated) throw new Error('Cần đăng nhập Supabase để từ chối QR.');
      const submission = await remoteStore.rejectSubmission(submissionId, currentUser.id, volunteerNote);
      setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const requestReview = async (submissionId: string, volunteerNote?: string) => {
    try {
      if (!remoteStore || !isAuthenticated) throw new Error('Cần đăng nhập Supabase để yêu cầu kiểm tra lại.');
      const submission = await remoteStore.requestReview(submissionId, currentUser.id, volunteerNote);
      setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const attachProofImage = async (submissionId: string, input: CreateProofImageInput) => {
    try {
      if (!remoteStore || !isAuthenticated) throw new Error('Cần đăng nhập Supabase để lưu ảnh minh chứng.');
      const proofImage = await remoteStore.attachProofImage(submissionId, input);
      let updatedSubmission: RecyclingSubmission | undefined;
      setSubmissions(items => {
        const next = applyProofImage(items, proofImage);
        updatedSubmission = next.find(item => item.id === submissionId);
        return next;
      });
      return updatedSubmission;
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const value = useMemo(
    () => ({
      currentUser,
      users,
      isAuthenticated,
      isLoading,
      syncSource,
      syncError,
      points,
      pointTransactions,
      aiPredictions,
      submissions,
      stations,
      wasteTypes,
      missions,
      rewards,
      feedbacks,
      avatarOptions,
      rewardRedemptions,
      qrScanLogs,
      dutyStationId,
      signIn,
      signUp,
      signOut,
      updateAvatar,
      updatePassword,
      requestReward,
      handleMissionAction,
      createSubmission,
      saveAiPrediction,
      submitFeedback,
      setDutyStation,
      findSubmissionByQr,
      markSubmissionScanned,
      confirmSubmission,
      rejectSubmission,
      requestReview,
      attachProofImage
    }),
    [
      currentUser,
      users,
      isAuthenticated,
      isLoading,
      syncSource,
      syncError,
      points,
      pointTransactions,
      aiPredictions,
      submissions,
      stations,
      wasteTypes,
      missions,
      rewards,
      feedbacks,
      avatarOptions,
      rewardRedemptions,
      qrScanLogs,
      dutyStationId,
      updateAvatar,
      updatePassword
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext must be used within AppProvider');
  return value;
}
