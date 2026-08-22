import { mockRewards, mockStations, mockUsers, mockWasteTypes } from '../data/mockData';
import {
  AuthService,
  FeedbackService,
  PointService,
  RewardService,
  StationService,
  SubmissionService,
  WasteGuideService
} from './contracts';

const expiresInMinutes = 45;

export const authService: AuthService = {
  signIn: (role, email, password) => {
    const matched = mockUsers.find(user => user.role === role && user.email.toLowerCase() === email.trim().toLowerCase());
    if (matched?.status === 'pending') throw new Error('Tài khoản tình nguyện viên đang chờ admin phê duyệt.');
    if (matched?.status === 'rejected') throw new Error('Yêu cầu cấp quyền tình nguyện viên đã bị từ chối.');
    if (matched?.status === 'locked') throw new Error('Tài khoản đang bị khóa.');
    if (matched) return matched;
    return mockUsers.find(user => user.role === role) ?? mockUsers[0];
  },
  signUp: (name, email, password, role) => ({
    id: `${role}-${Date.now()}`,
    name,
    email,
    role,
    group: role === 'student' ? 'Sinh vien Eco-loop' : 'Tinh nguyen vien Eco-loop',
    points: 0,
    status: role === 'volunteer' ? 'pending' : 'active'
  }),
  loadProfile: userId => mockUsers.find(user => user.id === userId)
};

export const stationService: StationService = {
  listStations: () => mockStations
};

export const wasteGuideService: WasteGuideService = {
  listWasteTypes: () => mockWasteTypes
};

export const submissionService: SubmissionService = {
  createSubmission: (userId, input, wasteTypes) => {
    const wasteType = wasteTypes.find(item => item.id === input.wasteTypeId) ?? wasteTypes[0];
    const createdAt = new Date();
    const id = `sub-${Date.now()}`;

    return {
      id,
      userId,
      binId: input.binId,
      wasteTypeId: input.wasteTypeId,
      quantity: input.quantity,
      unit: wasteType.unit,
      qrToken: `ECO-${Date.now().toString().slice(-8)}`,
      status: 'CREATED',
      createdAt,
      expiredAt: new Date(createdAt.getTime() + expiresInMinutes * 60 * 1000)
    };
  },
  findByQr: (submissions, qrToken) => submissions.find(item => item.qrToken.trim().toUpperCase() === qrToken.trim().toUpperCase()),
  markScanned: (submissions, qrToken) =>
    submissions.map(item => {
      if (item.qrToken.trim().toUpperCase() !== qrToken.trim().toUpperCase() || item.status !== 'CREATED') return item;
      if (item.expiredAt.getTime() < Date.now()) return { ...item, status: 'EXPIRED' };
      return { ...item, status: 'QR_SCANNED' };
    }),
  confirm: (submissions, submissionId, actualQuantity, volunteerId, volunteerNote) =>
    submissions.map(item => {
      if (item.id !== submissionId) return item;
      if (item.status !== 'QR_SCANNED') throw new Error('QR chua duoc quet hop le, khong the xac nhan diem');
      return {
        ...item,
        status: 'POINT_CONFIRMED',
        actualQuantity,
        volunteerNote,
        verifiedBy: volunteerId,
        verifiedAt: new Date()
      };
    }),
  reject: (submissions, submissionId, volunteerId, volunteerNote) =>
    submissions.map(item =>
      item.id === submissionId
        ? { ...item, status: 'REJECTED', volunteerNote, verifiedBy: volunteerId, verifiedAt: new Date() }
        : item
    ),
  requestReview: (submissions, submissionId, volunteerId, volunteerNote) =>
    submissions.map(item =>
      item.id === submissionId
        ? {
            ...item,
            status: 'PENDING_REVIEW',
            volunteerNote,
            verifiedBy: volunteerId,
            verifiedAt: new Date()
          }
        : item
    ),
  attachProofImage: (submissions, submissionId, proofImage) =>
    submissions.map(item =>
      item.id === submissionId
        ? {
            ...item,
            proofImage
          }
        : item
    )
};

export const pointService: PointService = {
  createEarnTransaction: (submission, wasteType, actualQuantity) => ({
    id: `point-${Date.now()}`,
    userId: submission.userId,
    submissionId: submission.id,
    points: Math.round(actualQuantity * wasteType.pointPerUnit),
    type: 'earn',
    status: 'confirmed',
    description: `Xac nhan ${actualQuantity} ${wasteType.unit} ${wasteType.name}`,
    createdAt: new Date()
  }),
  createSpendTransaction: (userId, reward) => ({
    id: `point-${Date.now()}`,
    userId,
    points: reward.costPoints,
    type: 'spend',
    status: 'confirmed',
    description: `Doi ${reward.title}`,
    createdAt: new Date()
  })
};

export const rewardService: RewardService = {
  listRewards: () => mockRewards
};

export const feedbackService: FeedbackService = {
  createFeedback: (userId, input) => ({
    id: `feedback-${Date.now()}`,
    userId,
    stationId: input.stationId,
    type: input.type,
    message: input.message.trim(),
    status: 'new',
    createdAt: new Date()
  })
};
