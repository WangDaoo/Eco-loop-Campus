import { SubmissionStatus, WasteType } from '../types';

export type SubmissionStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

export function getSubmissionStatusLabel(status: SubmissionStatus) {
  switch (status) {
    case 'CREATED':
      return 'Chờ tình nguyện viên';
    case 'QR_SCANNED':
      return 'Đã quét QR';
    case 'ACCEPTED':
      return 'Đã tiếp nhận';
    case 'REJECTED':
      return 'Từ chối';
    case 'PENDING_REVIEW':
      return 'Chờ admin kiểm tra';
    case 'POINT_PENDING':
      return 'Chờ cộng điểm';
    case 'POINT_CONFIRMED':
      return 'Đã cộng điểm';
    case 'EXPIRED':
      return 'Hết hạn';
    case 'LOCKED':
      return 'Đã khóa';
    default:
      return 'Chưa rõ';
  }
}

export function getSubmissionStatusTone(status: SubmissionStatus): SubmissionStatusTone {
  switch (status) {
    case 'POINT_CONFIRMED':
    case 'ACCEPTED':
      return 'success';
    case 'QR_SCANNED':
    case 'POINT_PENDING':
      return 'info';
    case 'REJECTED':
    case 'EXPIRED':
    case 'LOCKED':
      return 'danger';
    case 'PENDING_REVIEW':
    case 'CREATED':
    default:
      return 'warning';
  }
}

const legacyWasteTypeAliases: Record<string, string> = {
  'plastic-bottle': 'plastic-pet',
  'pet-bottle': 'plastic-bottle',
  'aluminum-can': 'metal-can',
  'metal-can-small': 'metal-can'
};

const canonicalWasteTypeNames: Record<string, string> = {
  'plastic-bottle': 'Chai nhựa',
  'plastic-pet': 'Nhựa PET',
  paper: 'Giấy sạch',
  cardboard: 'Bìa carton',
  'metal-can': 'Lon kim loại',
  metal: 'Kim loại',
  organic: 'Rác hữu cơ',
  biological: 'Rác hữu cơ',
  hazardous: 'Pin / rác nguy hại',
  battery: 'Pin / rác nguy hại',
  glass: 'Thủy tinh',
  clothes: 'Quần áo / vải',
  shoes: 'Giày dép',
  trash: 'Rác còn lại'
};

const unaccentedWasteNameAliases: Record<string, string> = {
  'chai nhua': 'Chai nhựa',
  'giay sach': 'Giấy sạch',
  'bia carton': 'Bìa carton',
  'lon kim loai': 'Lon kim loại',
  'kim loai': 'Kim loại',
  'rac huu co': 'Rác hữu cơ',
  'pin nguy hai': 'Pin / rác nguy hại',
  'pin/nguy hai nho': 'Pin / rác nguy hại',
  'thuy tinh': 'Thủy tinh',
  'quan ao vai': 'Quần áo / vải',
  'giay dep': 'Giày dép',
  'rac con lai': 'Rác còn lại'
};

function searchable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9/ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function displayNameForWasteType(wasteType: WasteType) {
  const normalizedId = wasteType.id.trim().toLowerCase();
  return canonicalWasteTypeNames[normalizedId] ?? unaccentedWasteNameAliases[searchable(wasteType.name)] ?? wasteType.name;
}

export function getWasteUnitDisplayLabel(unit: WasteType['unit']) {
  return unit === 'item' ? 'cái' : unit;
}

export function getWasteTypeDisplayName(wasteTypes: WasteType[], wasteTypeId: string) {
  const normalizedId = wasteTypeId.trim().toLowerCase();
  const directMatch = wasteTypes.find(item => item.id.toLowerCase() === normalizedId);
  if (directMatch) return displayNameForWasteType(directMatch);

  const aliasId = legacyWasteTypeAliases[normalizedId];
  const aliasMatch = aliasId ? wasteTypes.find(item => item.id.toLowerCase() === aliasId) : undefined;
  return aliasMatch ? displayNameForWasteType(aliasMatch) : canonicalWasteTypeNames[aliasId ?? normalizedId] ?? wasteTypeId;
}
