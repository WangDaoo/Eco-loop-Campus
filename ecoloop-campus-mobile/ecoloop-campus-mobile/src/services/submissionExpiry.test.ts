import assert from 'node:assert/strict';
import test from 'node:test';
import { getSubmissionExpiryInfo } from './submissionExpiry';

test('formats active QR expiry as remaining minutes plus deadline', () => {
  const info = getSubmissionExpiryInfo(
    new Date('2026-08-21T17:48:00.000Z'),
    new Date('2026-08-21T17:00:00.000Z')
  );

  assert.equal(info.expired, false);
  assert.equal(info.label, 'Còn 48 phút');
  assert.match(info.detail, /Có hiệu lực đến/);
});

test('formats expired QR as a clear renewal state', () => {
  const info = getSubmissionExpiryInfo(
    new Date('2026-08-21T17:00:00.000Z'),
    new Date('2026-08-21T17:01:00.000Z')
  );

  assert.equal(info.expired, true);
  assert.equal(info.label, 'Mã QR đã hết hạn');
  assert.equal(info.detail, 'Tạo mã QR mới để gửi lại tại trạm.');
});

test('formats active QR expiry with hours when it has more than an hour left', () => {
  const info = getSubmissionExpiryInfo(
    new Date('2026-08-21T19:15:00.000Z'),
    new Date('2026-08-21T17:00:00.000Z')
  );

  assert.equal(info.label, 'Còn 2 giờ 15 phút');
});
