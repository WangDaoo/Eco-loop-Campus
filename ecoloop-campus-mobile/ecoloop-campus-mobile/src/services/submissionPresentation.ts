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
  'pet-bottle': 'plastic-pet',
  'aluminum-can': 'metal-can',
  'metal-can-small': 'metal-can'
};

export function getWasteTypeDisplayName(wasteTypes: WasteType[], wasteTypeId: string) {
  const normalizedId = wasteTypeId.trim().toLowerCase();
  const directMatch = wasteTypes.find(item => item.id.toLowerCase() === normalizedId);
  if (directMatch) return directMatch.name;

  const aliasId = legacyWasteTypeAliases[normalizedId];
  const aliasMatch = aliasId ? wasteTypes.find(item => item.id.toLowerCase() === aliasId) : undefined;
  return aliasMatch?.name ?? wasteTypeId;
}
