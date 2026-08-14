import { BinStation, EcoPointTransaction, Feedback, Mission, PredictionRecord, RecyclingSubmission, Reward, QRScanLog, RewardRedemption, UserProfile, WasteType } from '../types';
import { colors } from '../theme/colors';

export const mockUsers: UserProfile[] = [
  {
    id: 'student-001',
    name: 'Eco Hero',
    email: 'student@ecoloop.edu.vn',
    role: 'student',
    group: 'Khoa Cong nghe thong tin',
    points: 8386,
    status: 'active'
  },
  {
    id: 'volunteer-001',
    name: 'Tinh nguyen vien E1',
    email: 'volunteer@ecoloop.edu.vn',
    role: 'volunteer',
    group: 'CLB Moi truong',
    points: 0,
    status: 'active'
  }
];

export const mockStations: BinStation[] = [
  {
    id: 'station-e1',
    name: 'Tram thu gom E1',
    binGroup: 'Plastic, Paper, Metal',
    location: 'Sanh toa E1',
    building: 'E1',
    floor: '1',
    qrCode: 'STATION-E1',
    status: 'open',
    capacity: 62,
    latitude: 10.7627,
    longitude: 106.6822,
    mapX: 35,
    mapY: 42
  },
  {
    id: 'station-lib',
    name: 'Thu vien trung tam',
    binGroup: 'Paper, Plastic',
    location: 'Tang tret thu vien',
    building: 'LIB',
    floor: 'G',
    qrCode: 'STATION-LIB',
    status: 'open',
    capacity: 48,
    latitude: 10.764,
    longitude: 106.684,
    mapX: 62,
    mapY: 28
  },
  {
    id: 'station-caf',
    name: 'Canteen xanh',
    binGroup: 'Plastic, Metal',
    location: 'Khu canteen',
    building: 'CAF',
    floor: '1',
    qrCode: 'STATION-CAF',
    status: 'full',
    capacity: 91,
    latitude: 10.7615,
    longitude: 106.6851,
    mapX: 50,
    mapY: 68
  }
];

export const mockWasteTypes: WasteType[] = [
  { id: 'plastic-pet', name: 'Nhựa PET', unit: 'item', pointPerUnit: 1, recycleMethod: 'Chai nước, chai nước ngọt (Làm sạch, tháo nắp).', status: 'active' },
  { id: 'metal-can', name: 'Lon kim loại', unit: 'item', pointPerUnit: 2, recycleMethod: 'Lon nước giải khát (Rửa sạch, để ráo).', status: 'active' },
  { id: 'paper', name: 'Giấy', unit: 'kg', pointPerUnit: 5, recycleMethod: 'Giấy in, giấy học tập (Giữ khô, không dính dầu mỡ).', status: 'active' },
  { id: 'cardboard', name: 'Bìa carton', unit: 'kg', pointPerUnit: 4, recycleMethod: 'Thùng carton, hộp giao hàng (Gấp gọn).', status: 'active' },
  { id: 'clean-cup', name: 'Cốc nhựa sạch', unit: 'item', pointPerUnit: 1, recycleMethod: 'Cốc nhựa dùng một lần (Rửa sạch).', status: 'active' },
  { id: 'organic', name: 'Rác hữu cơ', unit: 'kg', pointPerUnit: 0, recycleMethod: 'Thức ăn thừa (Dành cho phase sau).', status: 'active' },
  { id: 'hazardous', name: 'Pin/nguy hại nhỏ', unit: 'item', pointPerUnit: 5, recycleMethod: 'Pin, bóng đèn nhỏ (Cần duyệt riêng).', status: 'active' }
];

export const mockSubmissions: RecyclingSubmission[] = [
  {
    id: 'sub-001',
    userId: 'student-001',
    binId: 'station-e1',
    wasteTypeId: 'plastic-bottle',
    quantity: 5,
    unit: 'item',
    qrToken: 'ECO-SUB-001',
    status: 'CREATED',
    createdAt: new Date(Date.now() - 1000 * 60 * 20),
    expiredAt: new Date(Date.now() + 1000 * 60 * 40)
  },
  {
    id: 'sub-002',
    userId: 'student-001',
    binId: 'station-lib',
    wasteTypeId: 'paper',
    quantity: 1.2,
    unit: 'kg',
    qrToken: 'ECO-SUB-002',
    status: 'POINT_CONFIRMED',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
    expiredAt: new Date(Date.now() - 1000 * 60 * 60 * 25),
    verifiedBy: 'volunteer-001',
    verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 25),
    actualQuantity: 1.2
  },
  {
    id: 'sub-003',
    userId: 'student-001',
    binId: 'station-caf',
    wasteTypeId: 'metal-can',
    quantity: 3,
    unit: 'item',
    qrToken: 'ECO-SUB-003',
    status: 'PENDING_REVIEW',
    createdAt: new Date(Date.now() - 1000 * 60 * 50),
    expiredAt: new Date(Date.now() + 1000 * 60 * 30),
    verifiedBy: 'volunteer-001',
    verifiedAt: new Date(Date.now() - 1000 * 60 * 5),
    volunteerNote: 'Nghi ngo sai loai, yeu cau review'
  }
];

export const mockAiPredictions: PredictionRecord[] = [];

export const mockPointTransactions: EcoPointTransaction[] = [
  {
    id: 'point-001',
    userId: 'student-001',
    submissionId: 'sub-002',
    points: 48,
    type: 'earn',
    status: 'confirmed',
    description: 'Xac nhan 1.2 kg giay sach tai Thu vien trung tam',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25)
  },
  {
    id: 'point-002',
    userId: 'student-001',
    points: 200,
    type: 'spend',
    status: 'confirmed',
    description: 'Doi Voucher Shopee 20%',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48)
  }
];

export const mockMissions: Mission[] = [
  { id: 'submit-3', title: 'Gui rac tai che 3 lan', description: 'Tao va duoc xac nhan 3 giao dich trong tuan.', current: 1, target: 3, rewardPoints: 100, actionLabel: 'Gửi rác', completed: false, status: 'active' },
  { id: 'paper-week', title: 'Tuan giay sach', description: 'Nop it nhat 2 kg giay sach.', current: 1.2, target: 2, rewardPoints: 120, actionLabel: 'Tiep tuc', completed: false, status: 'active' }
];

export const mockRewards: Reward[] = [
  { id: 'coffee', title: 'Ca phe canteen', description: 'Giam 50% cho 1 ly bat ky', costPoints: 300, status: 'active', color: colors.gold },
  { id: 'book', title: 'Voucher nha sach', description: 'Giam 20% dung cu hoc tap', costPoints: 500, status: 'active', color: colors.leaf },
  { id: 'tree', title: 'Trong 1 cay xanh', description: 'Ghi ten ban vao vuon Ecoloop', costPoints: 800, status: 'active', color: colors.green }
];

export const mockFeedbacks: Feedback[] = [];

export const mockRewardRedemptions: RewardRedemption[] = [];

export const mockQrScanLogs: QRScanLog[] = [
  {
    id: 'scan-demo-001',
    qrToken: 'ECO-SUB-001',
    scannedBy: 'volunteer-001',
    stationId: 'station-e1',
    result: 'SUCCESS',
    note: 'Quet QR demo tai ca truc',
    scannedAt: new Date(Date.now() - 1000 * 60 * 8)
  }
];
