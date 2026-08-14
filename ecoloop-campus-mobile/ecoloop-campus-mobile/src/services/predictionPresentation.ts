import { PredictionRecord, PredictionStatus } from '../types';

export type PredictionStatusTone = 'success' | 'warning' | 'danger';

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function getPredictionStatusText(status: PredictionStatus) {
  switch (status) {
    case 'approved':
      return 'Đã duyệt';
    case 'rejected':
      return 'Bị từ chối';
    case 'pending':
    default:
      return 'Chờ duyệt';
  }
}

export function getPredictionStatusTone(status: PredictionStatus): PredictionStatusTone {
  switch (status) {
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    case 'pending':
    default:
      return 'warning';
  }
}

export function formatPredictionConfidence(confidence: number) {
  return `${Math.round(clampConfidence(confidence) * 100)}% tin cậy`;
}

export function getPredictionSubtitle(prediction: PredictionRecord, stationName?: string) {
  const station = stationName?.trim() || prediction.binId || 'Chưa chọn trạm';
  return `${prediction.binGroup} - ${formatPredictionConfidence(prediction.confidence)} - ${station}`;
}
