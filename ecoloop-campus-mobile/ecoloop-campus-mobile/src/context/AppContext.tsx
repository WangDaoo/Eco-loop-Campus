import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AvatarPreset,
  BinStation,
  CreateFeedbackInput,
  CreateProofImageInput,
  CreateSubmissionInput,
  EcoPointTransaction,
  Faculty,
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
  StudentProfileInput,
  UserProfile,
  WasteType
} from '../types';
import { createBackendMobileStore, isSessionExpiredError } from '../services/backendMobileStore';
import { loadDutyStationPreference, resolveDutyStationId, saveDutyStationPreference } from '../services/dutyStation';
import { resolveWalletPoints } from '../services/walletPoints';
import { resolveRemoteHydrationState } from './remoteHydration';

type SyncSource = 'backend';

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
  faculties: Faculty[];
  dutyStationId: string;
  signIn: (role: UserProfile['role'], email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, role: UserProfile['role'], profile: StudentProfileInput) => Promise<UserProfile | undefined>;
  completeProfile: (profile: StudentProfileInput) => Promise<void>;
  signOut: () => Promise<void>;
  updateAvatar: (avatarKey: string) => Promise<void>;
  updatePassword: (email: string, currentPassword: string, newPassword: string) => Promise<void>;
  requestReward: (reward: Reward) => Promise<boolean>;
  requestRewardBatch: (items: Array<{ rewardId: string; quantity: number }>) => Promise<boolean>;
  cancelRewardRedemption: (batchId: string) => Promise<boolean>;
  createSubmission: (input: CreateSubmissionInput) => Promise<RecyclingSubmission>;
  uploadSubmissionPhoto: (input: { imageUri: string; imageName?: string; mimeType?: string }) => Promise<string>;
  saveAiPrediction: (input: SavePredictionInput) => Promise<PredictionRecord | undefined>;
  submitFeedback: (input: CreateFeedbackInput) => Promise<Feedback | undefined>;
  setDutyStation: (stationId: string) => void;
  findSubmissionByQr: (qrToken: string) => RecyclingSubmission | undefined;
  markSubmissionScanned: (qrToken: string) => Promise<QRScanOutcome>;
  confirmSubmission: (submissionId: string, actualQuantity: number, volunteerNote?: string) => Promise<void>;
  rejectSubmission: (submissionId: string, volunteerNote?: string) => Promise<void>;
  requestReview: (submissionId: string, volunteerNote?: string) => Promise<void>;
  attachProofImage: (submissionId: string, input: CreateProofImageInput) => Promise<RecyclingSubmission | undefined>;
  scanRewardRedemption: (qrToken: string) => Promise<boolean>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);
const POLL_INTERVAL_MS = 5000;

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(EMPTY_USER);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncSource, setSyncSource] = useState<SyncSource>('backend');
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
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [dutyStationId, setDutyStationId] = useState('');
  const remoteStore = useMemo(() => createBackendMobileStore(), []);
  // Mỗi lần hydrate có số thứ tự; dữ liệu trả về muộn (đã có lần tải mới hơn,
  // vừa có thao tác ghi, hoặc đã đăng xuất) sẽ bị bỏ qua để không ghi đè state mới.
  const hydrationSequenceRef = useRef(0);
  const hydrationInFlightRef = useRef(0);
  const mutationVersionRef = useRef(0);
  const stationsRef = useRef<BinStation[]>([]);
  const persistedDutyStationRef = useRef('');

  useEffect(() => {
    let active = true;
    remoteStore.loadFaculties()
      .then(items => {
        if (active) setFaculties(items);
      })
      .catch(error => {
        if (active) setSyncError(messageOf(error));
      });
    return () => {
      active = false;
    };
  }, [remoteStore]);

  const clearSessionState = (message = '') => {
    hydrationSequenceRef.current += 1;
    mutationVersionRef.current += 1;
    stationsRef.current = [];
    persistedDutyStationRef.current = '';
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
    setSyncSource('backend');
    setSyncError(message);
  };

  const markLocalMutation = () => {
    mutationVersionRef.current += 1;
  };

  const failRemoteMutation = (error: unknown): never => {
    const message = messageOf(error);
    if (isSessionExpiredError(error)) clearSessionState(message);
    else setSyncError(message);
    throw error instanceof Error ? error : new Error(message);
  };

  const hydrateRemoteData = useCallback(
    async (profile: UserProfile, options: { background?: boolean } = {}) => {
      // Polling nền không chồng thêm request khi lần tải trước chưa xong (mạng chậm).
      if (options.background && hydrationInFlightRef.current > 0) return;
      const sequence = ++hydrationSequenceRef.current;
      const mutationVersion = mutationVersionRef.current;
      const isStale = () => sequence !== hydrationSequenceRef.current || mutationVersion !== mutationVersionRef.current;
      hydrationInFlightRef.current += 1;
      try {
        const schemaHealth = await remoteStore.checkSchema();
        if (!schemaHealth.ok) throw new Error(schemaHealth.message);

        const data = await remoteStore.loadInitialData(profile);
        if (isStale()) return;
        const state = resolveRemoteHydrationState(data, remoteStore.getOperatingReadiness(data));
        stationsRef.current = state.stations;
        setUsers(state.users);
        const refreshedProfile = data.currentUser ?? state.users.find(item => item.id === profile.id);
        if (refreshedProfile) setCurrentUser(current => current.id === refreshedProfile.id ? { ...current, ...refreshedProfile } : current);
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
        setDutyStationId(current => resolveDutyStationId(state.stations, { current, persisted: persistedDutyStationRef.current }));
        setSyncSource(state.syncSource);
        setSyncError(state.syncError);
      } catch (error) {
        if (isStale()) return;
        if (isSessionExpiredError(error)) {
          clearSessionState(messageOf(error));
          return;
        }
        // Giữ nguyên dữ liệu đã tải gần nhất: mất mạng tạm thời không được làm trống ví điểm, QR đang chờ hay danh sách trạm.
        setSyncSource('backend');
        setSyncError(messageOf(error));
      } finally {
        hydrationInFlightRef.current = Math.max(0, hydrationInFlightRef.current - 1);
      }
    },
    [remoteStore]
  );

  useEffect(() => {
    let active = true;
    persistedDutyStationRef.current = '';
    if (!currentUser.id) return undefined;
    loadDutyStationPreference(AsyncStorage, currentUser.id).then(stationId => {
      if (!active) return;
      persistedDutyStationRef.current = stationId;
      setDutyStationId(current => resolveDutyStationId(stationsRef.current, { current, persisted: stationId }));
    });
    return () => {
      active = false;
    };
  }, [currentUser.id]);

  useEffect(() => {
    let active = true;
    async function loadSession() {
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
        if (!profile.requiresProfileCompletion) await hydrateRemoteData(profile);
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
    if (!isAuthenticated || !currentUser.id || currentUser.requiresProfileCompletion) return undefined;
    const timer = setInterval(() => {
      void hydrateRemoteData(currentUser, { background: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [currentUser.id, currentUser.role, currentUser.requiresProfileCompletion, hydrateRemoteData, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser.id || currentUser.requiresProfileCompletion) return undefined;
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') void hydrateRemoteData(currentUser, { background: true });
    });
    return () => {
      subscription.remove();
    };
  }, [currentUser.id, currentUser.role, currentUser.requiresProfileCompletion, hydrateRemoteData, isAuthenticated]);

  const points = useMemo(
    () => resolveWalletPoints({ profilePoints: currentUser.points, pointTransactions, syncSource }),
    [currentUser.points, pointTransactions, syncSource]
  );

  const signIn = async (role: UserProfile['role'], email: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await remoteStore.signIn(role, email, password);
      setCurrentUser(user);
      setIsAuthenticated(true);
      if (!user.requiresProfileCompletion) await hydrateRemoteData(user);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string, role: UserProfile['role'], profile: StudentProfileInput) => {
    setIsLoading(true);
    try {
      const user = await remoteStore.signUp(name, email, password, role, profile);
      if (user.status !== 'active') {
        setCurrentUser(user);
        setIsAuthenticated(false);
        setSyncSource('backend');
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
      await remoteStore.signOut();
    } catch {
      // Token cục bộ đã được xóa trong store; lỗi mạng khi báo đăng xuất không được giữ người dùng ở lại phiên cũ.
    } finally {
      clearSessionState('');
      setIsLoading(false);
    }
  };

  const updateAvatar = async (avatarKey: string) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để đổi avatar.');
      const nextUser = await remoteStore.updateAvatar(currentUser.id, avatarKey);
      markLocalMutation();
      setCurrentUser(nextUser);
      setUsers(items => items.map(item => (item.id === nextUser.id ? nextUser : item)));
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const updatePassword = async (email: string, currentPassword: string, newPassword: string) => {
    setIsLoading(true);
    try {
      if (!isAuthenticated) throw new Error('Đổi mật khẩu cần đăng nhập bằng tài khoản Eco-loop Campus.');
      await remoteStore.updatePassword(email, currentPassword, newPassword);
    } finally {
      setIsLoading(false);
    }
  };

  const requestReward = async (reward: Reward) => {
    if (points < reward.costPoints) return false;
    try {
      if (!isAuthenticated) return false;
      const redemption = await remoteStore.requestReward(currentUser.id, reward);
      markLocalMutation();
      setRewardRedemptions(items => [redemption, ...items.filter(item => item.id !== redemption.id)]);
      return true;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const saveAiPrediction = async (input: SavePredictionInput) => {
    try {
      if (!isAuthenticated) return undefined;
      const prediction = await remoteStore.saveAiPrediction(currentUser.id, input);
      markLocalMutation();
      setAiPredictions(items => [prediction, ...items.filter(item => item.id !== prediction.id)]);
      return prediction;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const createSubmission = async (input: CreateSubmissionInput) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để tạo QR giao dịch.');
      const submission = await remoteStore.createSubmission(currentUser.id, input, wasteTypes);
      markLocalMutation();
      setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
      return submission;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const uploadSubmissionPhoto = async (input: { imageUri: string; imageName?: string; mimeType?: string }) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để lưu ảnh rác.');
      return await remoteStore.uploadSubmissionPhoto(input);
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const submitFeedback = async (input: CreateFeedbackInput) => {
    if (!input.message.trim()) return undefined;

    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để gửi phản hồi.');
      const feedback = await remoteStore.submitFeedback(currentUser, input);
      markLocalMutation();
      setFeedbacks(items => [feedback, ...items.filter(item => item.id !== feedback.id)]);
      await hydrateRemoteData(currentUser);
      return feedback;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const setDutyStation = (stationId: string) => {
    setDutyStationId(stationId);
    persistedDutyStationRef.current = stationId;
    void saveDutyStationPreference(AsyncStorage, currentUser.id, stationId);
  };

  const findSubmissionByQr = (qrToken: string) => submissions.find(item => item.qrToken.trim().toUpperCase() === qrToken.trim().toUpperCase());

  const markSubmissionScanned = async (qrToken: string): Promise<QRScanOutcome> => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để quét QR giao dịch.');
      const outcome = await remoteStore.markSubmissionScanned(qrToken, currentUser.id, dutyStationId);
      markLocalMutation();
      if (outcome.submission) setSubmissions(items => [outcome.submission!, ...items.filter(item => item.id !== outcome.submission!.id)]);
      return outcome;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const confirmSubmission = async (submissionId: string, actualQuantity: number, volunteerNote?: string) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để xác nhận QR.');
      const result = await remoteStore.confirmSubmission(submissionId, actualQuantity, currentUser.id, volunteerNote, wasteTypes);
      markLocalMutation();
      setSubmissions(items => [result.submission, ...items.filter(item => item.id !== result.submission.id)]);
      setPointTransactions(items => [result.point, ...items.filter(item => item.id !== result.point.id)]);
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const rejectSubmission = async (submissionId: string, volunteerNote?: string) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để từ chối QR.');
      const submission = await remoteStore.rejectSubmission(submissionId, currentUser.id, volunteerNote);
      markLocalMutation();
      setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const requestReview = async (submissionId: string, volunteerNote?: string) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để yêu cầu kiểm tra lại.');
      const submission = await remoteStore.requestReview(submissionId, currentUser.id, volunteerNote);
      markLocalMutation();
      setSubmissions(items => [submission, ...items.filter(item => item.id !== submission.id)]);
    } catch (error) {
      failRemoteMutation(error);
    }
  };

  const attachProofImage = async (submissionId: string, input: CreateProofImageInput) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để lưu ảnh minh chứng.');
      const proofImage = await remoteStore.attachProofImage(submissionId, input);
      markLocalMutation();
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

  const completeProfile = async (profile: StudentProfileInput) => {
    setIsLoading(true);
    try {
      const nextUser = await remoteStore.updateProfile(profile);
      setCurrentUser(nextUser);
      setSyncError('');
      await hydrateRemoteData(nextUser);
    } finally {
      setIsLoading(false);
    }
  };

  const requestRewardBatch = async (items: Array<{ rewardId: string; quantity: number }>) => {
    try {
      if (!isAuthenticated || !items.length) return false;
      const redemption = await remoteStore.requestRewardBatch(currentUser.id, items, rewards);
      markLocalMutation();
      setRewardRedemptions(current => [redemption, ...current.filter(item => item.id !== redemption.id)]);
      return true;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const cancelRewardRedemption = async (batchId: string) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để hủy mã đổi thưởng.');
      const redemption = await remoteStore.cancelRewardRedemption(batchId);
      markLocalMutation();
      setRewardRedemptions(current => [redemption, ...current.filter(item => item.id !== redemption.id)]);
      await hydrateRemoteData(currentUser);
      return true;
    } catch (error) {
      return failRemoteMutation(error);
    }
  };

  const scanRewardRedemption = async (qrToken: string) => {
    try {
      if (!isAuthenticated) throw new Error('Cần đăng nhập backend để quét mã đổi thưởng.');
      await remoteStore.scanRewardRedemption(qrToken);
      markLocalMutation();
      await hydrateRemoteData(currentUser);
      return true;
    } catch (error) {
      return failRemoteMutation(error);
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
      faculties,
      rewardRedemptions,
      qrScanLogs,
      dutyStationId,
      signIn,
      signUp,
      completeProfile,
      signOut,
      updateAvatar,
      updatePassword,
      requestReward,
      requestRewardBatch,
      cancelRewardRedemption,
      createSubmission,
      uploadSubmissionPhoto,
      saveAiPrediction,
      submitFeedback,
      setDutyStation,
      findSubmissionByQr,
      markSubmissionScanned,
      confirmSubmission,
      rejectSubmission,
      requestReview,
      attachProofImage,
      scanRewardRedemption
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
      cancelRewardRedemption,
      faculties,
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
