import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
  WasteType
} from '../types';
import {
  mockAiPredictions,
  mockMissions,
  mockPointTransactions,
  mockQrScanLogs,
  mockRewardRedemptions,
  mockRewards,
  mockStations,
  mockSubmissions,
  mockUsers,
  mockWasteTypes,
  mockFeedbacks
} from '../data/mockData';
import {
  authService,
  feedbackService,
  pointService,
  rewardService,
  stationService,
  submissionService,
  wasteGuideService
} from '../services/mockServices';
import { isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { missionIdsForFeedback, missionIdsForSubmission } from '../services/missionAutomation';
import { createSupabaseMobileStore } from '../services/supabaseMobileStore';
import { resolveWalletPoints } from '../services/walletPoints';
import {
  applyRealtimeChange,
  buildPredictionDraft,
  mapBinRow,
  mapFeedbackRow,
  mapMissionRow,
  mapPointHistoryRow,
  mapPredictionRow,
  mapProofImageRow,
  mapQrScanLogRow,
  mapRewardRow,
  mapRewardRedemptionRow,
  mapUserMissionRow,
  mergeMissionProgress,
  mapSubmissionRow,
  mapUserRow,
  mapWasteTypeRow
} from '../services/supabaseAdapters';
import { resolveRemoteHydrationState } from './remoteHydration';

type SyncSource = 'mock' | 'supabase';

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
  dutyStationId: string;
  signIn: (role: UserProfile['role'], email: string, password: string) => Promise<void>;
  signInDemo: (role: UserProfile['role']) => Promise<void>;
  signUp: (name: string, email: string, password: string, role: UserProfile['role']) => Promise<void>;
  signOut: () => Promise<void>;
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
  const [currentUser, setCurrentUser] = useState<UserProfile>(mockUsers[0]);
  const [users, setUsers] = useState<UserProfile[]>(mockUsers);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncSource, setSyncSource] = useState<SyncSource>('mock');
  const [syncError, setSyncError] = useState('');
  const [aiPredictions, setAiPredictions] = useState<PredictionRecord[]>(mockAiPredictions);
  const [submissions, setSubmissions] = useState<RecyclingSubmission[]>(mockSubmissions);
  const [pointTransactions, setPointTransactions] = useState<EcoPointTransaction[]>(mockPointTransactions);
  const [missions, setMissions] = useState<Mission[]>(mockMissions);
  const [rewards, setRewards] = useState<Reward[]>(rewardService.listRewards());
  const [rewardRedemptions, setRewardRedemptions] = useState<RewardRedemption[]>(mockRewardRedemptions);
  const [qrScanLogs, setQrScanLogs] = useState<QRScanLog[]>(mockQrScanLogs);
  const [stations, setStations] = useState<BinStation[]>(stationService.listStations());
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>(wasteGuideService.listWasteTypes());
  const [feedbacks, setFeedbacks] = useState<Feedback[]>(mockFeedbacks);
  const [dutyStationId, setDutyStationId] = useState(mockStations[0]?.id ?? '');
  const remoteStore = useMemo(() => (isSupabaseConfigured && supabase ? createSupabaseMobileStore(supabase) : null), []);

  const resetMockSession = useCallback((role: UserProfile['role'] = 'student') => {
    const user = mockUsers.find(item => item.role === role) ?? mockUsers[0];
    setCurrentUser(user);
    setUsers(mockUsers);
    setStations(mockStations);
    setWasteTypes(mockWasteTypes);
    setAiPredictions(mockAiPredictions);
    setSubmissions(mockSubmissions);
    setPointTransactions(mockPointTransactions);
    setFeedbacks(mockFeedbacks);
    setMissions(mockMissions);
    setRewards(mockRewards);
    setRewardRedemptions(mockRewardRedemptions);
    setQrScanLogs(mockQrScanLogs);
    setDutyStationId(mockStations[0]?.id ?? '');
    setSyncSource('mock');
    setSyncError('Demo offline - dữ liệu mẫu trên máy, không ghi Supabase.');
  }, []);

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
        setMissions(state.missions);
        setRewards(state.rewards);
        setRewardRedemptions(state.rewardRedemptions);
        setQrScanLogs(state.qrScanLogs);
        setDutyStationId(state.dutyStationId);
        setSyncSource(state.syncSource);
        setSyncError(state.syncError);
      } catch (error) {
        setUsers(mockUsers);
        setStations(mockStations);
        setWasteTypes(mockWasteTypes);
        setAiPredictions(mockAiPredictions);
        setSubmissions(mockSubmissions);
        setPointTransactions(mockPointTransactions);
        setFeedbacks(mockFeedbacks);
        setMissions(mockMissions);
        setRewards(mockRewards);
        setRewardRedemptions(mockRewardRedemptions);
        setQrScanLogs(mockQrScanLogs);
        setDutyStationId(mockStations[0]?.id ?? '');
        setSyncSource('mock');
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

  const points = useMemo(
    () => resolveWalletPoints({ profilePoints: currentUser.points, pointTransactions, syncSource }),
    [currentUser.points, pointTransactions, syncSource]
  );

  const signIn = async (role: UserProfile['role'], email: string, password: string) => {
    setIsLoading(true);
    try {
      if (remoteStore) {
        const user = await remoteStore.signIn(role, email, password);
        setCurrentUser(user);
        setIsAuthenticated(true);
        await hydrateRemoteData(user);
        return;
      }

      const user = authService.signIn(role, email, password);
      setCurrentUser(user);
      setIsAuthenticated(true);
      setSyncSource('mock');
    } finally {
      setIsLoading(false);
    }
  };

  const signInDemo = async (role: UserProfile['role']) => {
    setIsLoading(true);
    try {
      resetMockSession(role);
      setIsAuthenticated(true);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string, role: UserProfile['role']) => {
    setIsLoading(true);
    try {
      if (remoteStore) {
        const user = await remoteStore.signUp(name, email, password, role);
        setCurrentUser(user);
        setIsAuthenticated(true);
        await hydrateRemoteData(user);
        return;
      }

      const user = authService.signUp(name, email, password, role);
      setCurrentUser(user);
      setIsAuthenticated(true);
      setSyncSource('mock');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (remoteStore) await remoteStore.signOut();
      setIsAuthenticated(false);
      setCurrentUser(mockUsers[0]);
      setUsers(mockUsers);
      setAiPredictions(mockAiPredictions);
      setSubmissions(mockSubmissions);
      setPointTransactions(mockPointTransactions);
      setRewards(mockRewards);
        setRewardRedemptions(mockRewardRedemptions);
      setPointTransactions(mockPointTransactions);
      setRewards(mockRewards);
        setRewardRedemptions(mockRewardRedemptions);
      setQrScanLogs(mockQrScanLogs);
      setMissions(mockMissions);
      setFeedbacks(mockFeedbacks);
      setStations(mockStations);
      setWasteTypes(mockWasteTypes);
      setDutyStationId(mockStations[0]?.id ?? '');
      setSyncSource(remoteStore ? 'supabase' : 'mock');
    } finally {
      setIsLoading(false);
    }
  };

  const requestReward = async (reward: Reward) => {
    if (points < reward.costPoints) return false;

    if (remoteStore && syncSource === 'supabase') {
      try {
        const redemption = await remoteStore.requestReward(currentUser.id, reward);
        setRewardRedemptions(items => [redemption, ...items.filter(item => item.id !== redemption.id)]);
        return true;
      } catch (error) {
        setSyncError(messageOf(error));
        return false;
      }
    }

    setPointTransactions(items => [pointService.createSpendTransaction(currentUser.id, reward), ...items]);
    const redemption: RewardRedemption = {
      id: `reward-redemption-${Date.now()}`,
      userId: currentUser.id,
      rewardId: reward.id,
      rewardLabel: reward.title,
      costPoints: reward.costPoints,
      status: 'requested',
      requestedAt: new Date()
    };
    setRewardRedemptions(items => [redemption, ...items]);
    return true;
  };

  const handleMissionAction = async (id: string) => {
    if (remoteStore && syncSource === 'supabase') {
      try {
        const mission = await remoteStore.advanceMission(currentUser.id, id, missions);
        setMissions(items => [mission, ...items.filter(item => item.id !== mission.id)]);
        return;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    const targetMission = missions.find(mission => mission.id === id);
    const willComplete = Boolean(targetMission && !targetMission.completed && targetMission.current + 1 >= targetMission.target);
    if (targetMission && willComplete && targetMission.rewardPoints > 0) {
      const rewardPoint = createMissionRewardPoint(currentUser.id, targetMission);
      setPointTransactions(items => [rewardPoint, ...items]);
    }

    setMissions(items =>
      items.map(mission => {
        if (mission.id !== id || mission.completed) return mission;
        const current = mission.current + 1;
        const completed = current >= mission.target;
        return {
          ...mission,
          current,
          completed,
          status: completed ? 'completed' : mission.status,
          actionLabel: completed ? 'Xong' : mission.actionLabel
        };
      })
    );
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
    if (remoteStore && syncSource === 'supabase') {
      try {
        const prediction = await remoteStore.saveAiPrediction(currentUser.id, input);
        setAiPredictions(items => [prediction, ...items.filter(item => item.id !== prediction.id)]);
        return prediction;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    const prediction = buildPredictionDraft({ userId: currentUser.id, input });
    setAiPredictions(items => [prediction, ...items]);
    return prediction;
  };

  const createSubmission = async (input: CreateSubmissionInput) => {
    if (remoteStore && syncSource === 'supabase') {
      try {
        const submission = await remoteStore.createSubmission(currentUser.id, input, wasteTypes);
        setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
        await advanceMissionsForAction(missionIdsForSubmission(submission));
        return submission;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    const submission = submissionService.createSubmission(currentUser.id, input, wasteTypes);
    setSubmissions(items => [submission, ...items]);
    await advanceMissionsForAction(missionIdsForSubmission(submission));
    return submission;
  };

  const submitFeedback = async (input: CreateFeedbackInput) => {
    if (!input.message.trim()) return undefined;

    if (remoteStore && syncSource === 'supabase') {
      try {
        const feedback = await remoteStore.submitFeedback(currentUser, input);
        setFeedbacks(items => [feedback, ...items.filter(item => item.id !== feedback.id)]);
        await advanceMissionsForAction(missionIdsForFeedback());
        return feedback;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    const feedback = feedbackService.createFeedback(currentUser.id, input);
    setFeedbacks(items => [feedback, ...items]);
    await advanceMissionsForAction(missionIdsForFeedback());
    return feedback;
  };

  const setDutyStation = (stationId: string) => {
    setDutyStationId(stationId);
  };

  const findSubmissionByQr = (qrToken: string) => submissionService.findByQr(submissions, qrToken);

  const markSubmissionScanned = async (qrToken: string): Promise<QRScanOutcome> => {
    const token = qrToken.trim().toUpperCase();
    const recordOfflineQrLog = (result: QRScanLog['result'], note: string) => {
      const log: QRScanLog = {
        id: `scan-${Date.now()}`,
        qrToken: token,
        scannedBy: currentUser.id,
        stationId: dutyStationId,
        result,
        note,
        scannedAt: new Date()
      };
      setQrScanLogs(items => [log, ...items]);
    };

    if (remoteStore && syncSource === 'supabase') {
      try {
        const outcome = await remoteStore.markSubmissionScanned(qrToken, currentUser.id, dutyStationId);
        if (outcome.submission) setSubmissions(items => [outcome.submission!, ...items.filter(item => item.id !== outcome.submission!.id)]);
        return outcome;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    const submission = findSubmissionByQr(token);
    if (!submission) {
      recordOfflineQrLog('INVALID_TOKEN', 'QR không tồn tại trong dữ liệu demo');
      return { result: 'INVALID_TOKEN', note: 'QR không tồn tại trong hệ thống' };
    }
    if (submission.expiredAt.getTime() < Date.now()) {
      const expiredSubmission = { ...submission, status: 'EXPIRED' as const };
      setSubmissions(items => submissionService.markScanned(items, token));
      recordOfflineQrLog('EXPIRED', 'QR đã hết hạn');
      return { result: 'EXPIRED', submission: expiredSubmission, note: 'QR đã hết hạn' };
    }
    if (dutyStationId && submission.binId !== dutyStationId) {
      recordOfflineQrLog('WRONG_STATION', 'QR không thuộc trạm đang trực');
      return { result: 'WRONG_STATION', submission, note: 'QR không thuộc trạm đang trực' };
    }
    if (submission.status !== 'CREATED') {
      recordOfflineQrLog('ALREADY_USED', 'QR đã được xử lý trước đó');
      return { result: 'ALREADY_USED', submission, note: 'QR đã được xử lý trước đó' };
    }

    const scannedSubmission = { ...submission, status: 'QR_SCANNED' as const };
    setSubmissions(items => submissionService.markScanned(items, token));
    recordOfflineQrLog('SUCCESS', 'QR hợp lệ');
    return { result: 'SUCCESS', submission: scannedSubmission, note: 'QR hợp lệ' };
  };

  const confirmSubmission = async (submissionId: string, actualQuantity: number, volunteerNote?: string) => {
    const submission = submissions.find(item => item.id === submissionId);
    const wasteType = wasteTypes.find(item => item.id === submission?.wasteTypeId);
    if (!submission || !wasteType) return;

    if (remoteStore && syncSource === 'supabase') {
      try {
        const result = await remoteStore.confirmSubmission(submissionId, actualQuantity, currentUser.id, volunteerNote, wasteTypes);
        setSubmissions(items => [result.submission, ...items.filter(item => item.id !== result.submission.id)]);
        setPointTransactions(items => [result.point, ...items.filter(item => item.id !== result.point.id)]);
        return;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    setSubmissions(items => submissionService.confirm(items, submissionId, actualQuantity, currentUser.id, volunteerNote));
    setPointTransactions(items => [pointService.createEarnTransaction(submission, wasteType, actualQuantity), ...items]);
  };

  const rejectSubmission = async (submissionId: string, volunteerNote?: string) => {
    if (remoteStore && syncSource === 'supabase') {
      try {
        const submission = await remoteStore.rejectSubmission(submissionId, currentUser.id, volunteerNote);
        setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
        return;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    setSubmissions(items => submissionService.reject(items, submissionId, currentUser.id, volunteerNote));
  };

  const requestReview = async (submissionId: string, volunteerNote?: string) => {
    if (remoteStore && syncSource === 'supabase') {
      try {
        const submission = await remoteStore.requestReview(submissionId, currentUser.id, volunteerNote);
        setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
        return;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    setSubmissions(items => submissionService.requestReview(items, submissionId, currentUser.id, volunteerNote));
  };

  const attachProofImage = async (submissionId: string, input: CreateProofImageInput) => {
    if (remoteStore && syncSource === 'supabase') {
      try {
        const proofImage = await remoteStore.attachProofImage(submissionId, input);
        let updatedSubmission: RecyclingSubmission | undefined;
        setSubmissions(items => {
          const next = applyProofImage(items, proofImage);
          updatedSubmission = next.find(item => item.id === submissionId);
          return next;
        });
        return updatedSubmission;
      } catch (error) {
        setSyncError(messageOf(error));
      }
    }

    const proofImage: ProofImage = {
      id: `proof-${Date.now()}`,
      submissionId,
      imageUrl: input.imageUrl ?? input.imageUri ?? '',
      imageHash: input.imageHash,
      status: input.status ?? 'pending',
      verificationCode: input.verificationCode ?? `RVW-${Math.floor(1000 + Math.random() * 9000)}`,
      note: input.note
    };
    let updatedSubmission: RecyclingSubmission | undefined;
    setSubmissions(items => {
      const next = submissionService.attachProofImage(items, submissionId, proofImage);
      updatedSubmission = next.find(item => item.id === submissionId);
      return next;
    });
    return updatedSubmission;
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
      rewardRedemptions,
      qrScanLogs,
      dutyStationId,
      signIn,
      signInDemo,
      signUp,
      signOut,
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
      rewardRedemptions,
      qrScanLogs,
      dutyStationId
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppContext must be used within AppProvider');
  return value;
}
