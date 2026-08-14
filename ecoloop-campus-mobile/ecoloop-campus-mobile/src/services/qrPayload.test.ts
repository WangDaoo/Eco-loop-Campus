import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubmissionQrPayload, extractSubmissionQrToken } from './qrPayload';

test('extractSubmissionQrToken accepts a plain Eco-loop token', () => {
  assert.equal(extractSubmissionQrToken(' eco-20260812112233-123456 '), 'ECO-20260812112233-123456');
});

test('extractSubmissionQrToken reads token from JSON QR payload', () => {
  const payload = JSON.stringify({ type: 'eco-loop-submission', qrToken: 'ECO-SUB-001' });

  assert.equal(extractSubmissionQrToken(payload), 'ECO-SUB-001');
});

test('extractSubmissionQrToken reads token from deep link URL payload', () => {
  const payload = 'ecoloop://submission/verify?token=ECO-SUB-002&station=bin-1';

  assert.equal(extractSubmissionQrToken(payload), 'ECO-SUB-002');
});

test('buildSubmissionQrPayload keeps token scan-compatible', () => {
  const payload = buildSubmissionQrPayload({ qrToken: 'ECO-SUB-003', id: 'sub-3', binId: 'bin-1' });

  assert.equal(extractSubmissionQrToken(payload), 'ECO-SUB-003');
  assert.match(payload, /eco-loop-submission/);
});
