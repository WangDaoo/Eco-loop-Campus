import { RecyclingSubmission } from '../types';

type SubmissionQrInput = Pick<RecyclingSubmission, 'qrToken' | 'id' | 'binId'>;

function normalizeToken(value: string) {
  return value.trim().toUpperCase();
}

function readStringField(value: Record<string, unknown>, keys: string[]) {
  const result = keys.map(key => value[key]).find(item => typeof item === 'string');
  return typeof result === 'string' ? result : '';
}

function findEcoToken(value: string) {
  return value.match(/ECO-[A-Z0-9-]+/i)?.[0];
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
    qrToken: submission.qrToken,
    submissionId: submission.id,
    binId: submission.binId,
    version: 1
  });
}

export function extractStationQrCode(payload: string) {
  const raw = payload.trim();
  if (!raw) return '';

  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const code = readStringField(json, ['qrCode', 'qr_code', 'stationQr', 'station_qr', 'stationId', 'station_id', 'binId', 'bin_id']);
    if (code) return normalizeToken(code);
  } catch {
    // QR trạm có thể là mã thuần hoặc deep link, không phải JSON.
  }

  try {
    const url = new URL(raw);
    const code =
      url.searchParams.get('station') ??
      url.searchParams.get('stationId') ??
      url.searchParams.get('station_id') ??
      url.searchParams.get('qrCode') ??
      url.searchParams.get('qr_code') ??
      url.searchParams.get('binId') ??
      url.searchParams.get('bin_id');
    if (code) return normalizeToken(code);
  } catch {
    // Không phải URL hợp lệ, dùng chuỗi gốc.
  }

  return normalizeToken(raw);
}
