import { RecyclingSubmission } from '../types';

type SubmissionQrInput = Pick<RecyclingSubmission, 'qrToken' | 'id' | 'binId'>;

function normalizeToken(value: string) {
  return value.trim().toUpperCase();
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
