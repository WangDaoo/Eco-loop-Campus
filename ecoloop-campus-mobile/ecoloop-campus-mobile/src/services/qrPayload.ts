import { RecyclingSubmission } from '../types';

type SubmissionQrInput = Pick<RecyclingSubmission, 'qrToken' | 'id' | 'binId'> & { expiredAt?: Date | string };
type StationQrInput = { id: string; qrCode?: string };

function normalizeToken(value: string) {
  return value.trim().toUpperCase();
}

function readStringFields(value: Record<string, unknown>, keys: string[]) {
  return keys
    .map(key => value[key])
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
}

function uniqueNormalized(values: string[]) {
  return Array.from(new Set(values.map(normalizeToken).filter(Boolean)));
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'STATION';
}

function findEcoToken(value: string) {
  return value.match(/ECL-SUB-[A-Z0-9-]+/i)?.[0] ?? value.match(/ECO-[A-Z0-9-]+/i)?.[0];
}

export function buildStationQrCode(stationId: string) {
  return `ECL-ST-${slug(stationId)}`;
}

export function buildStationQrPayload(station: StationQrInput) {
  return JSON.stringify({
    type: 'eco-loop-station',
    version: 1,
    stationId: station.id,
    qrCode: station.qrCode || buildStationQrCode(station.id)
  });
}

export function extractSubmissionQrToken(payload: string) {
  const raw = payload.trim();
  if (!raw) return '';

  const direct = findEcoToken(raw);
  if (direct && direct.length === raw.length) return normalizeToken(direct);

  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const token = json.qrToken ?? json.qr_token ?? json.token;
    if (typeof token === 'string') return normalizeToken(token);
  } catch {
    // QR có thể là token thuần hoặc deep link, không phải JSON.
  }

  try {
    const url = new URL(raw);
    const token = url.searchParams.get('token') ?? url.searchParams.get('qrToken') ?? url.searchParams.get('qr_token');
    if (token) return normalizeToken(token);
  } catch {
    // Không phải URL hợp lệ, tiếp tục tìm token trong chuỗi.
  }

  return direct ? normalizeToken(direct) : normalizeToken(raw);
}

export function buildSubmissionQrPayload(submission: SubmissionQrInput) {
  return JSON.stringify({
    type: 'eco-loop-submission',
    version: 1,
    qrToken: submission.qrToken,
    submissionId: submission.id,
    binId: submission.binId,
    expiredAt: submission.expiredAt instanceof Date ? submission.expiredAt.toISOString() : submission.expiredAt
  });
}

export function extractStationQrCode(payload: string) {
  return extractStationQrCandidates(payload)[0] ?? '';
}

export function extractStationQrCandidates(payload: string) {
  const raw = payload.trim();
  if (!raw) return [];

  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const codes = readStringFields(json, ['qrCode', 'qr_code', 'stationQr', 'station_qr', 'stationId', 'station_id', 'binId', 'bin_id']);
    if (codes.length) return uniqueNormalized(codes);
  } catch {
    // QR trạm có thể là mã thuần hoặc deep link, không phải JSON.
  }

  try {
    const url = new URL(raw);
    const codes = ['station', 'stationId', 'station_id', 'qrCode', 'qr_code', 'binId', 'bin_id']
      .map(key => url.searchParams.get(key))
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()));
    if (codes.length) return uniqueNormalized(codes);
  } catch {
    // Không phải URL hợp lệ, dùng chuỗi gốc.
  }

  return uniqueNormalized([raw]);
}
