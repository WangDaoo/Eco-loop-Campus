import assert from 'node:assert/strict';
import test from 'node:test';
import { canVolunteerActOnSubmission, getPendingDutySubmissions, isSubmissionQrExpired } from './scannerFlow';

const now = new Date('2026-11-26T08:00:00.000Z');
const later = new Date('2026-11-26T08:30:00.000Z');
const earlier = new Date('2026-11-26T07:30:00.000Z');

const base = { binId: 'st-1', verifiedBy: undefined as string | undefined };

test('QR expiry compares the expiry time with now', () => {
  assert.equal(isSubmissionQrExpired({ expiredAt: earlier }, now), true);
  assert.equal(isSubmissionQrExpired({ expiredAt: now }, now), true);
  assert.equal(isSubmissionQrExpired({ expiredAt: later }, now), false);
});

test('duty pending list hides expired CREATED codes but keeps scanned reviews', () => {
  const items = [
    { ...base, id: 'fresh', status: 'CREATED' as const, expiredAt: later },
    { ...base, id: 'stale', status: 'CREATED' as const, expiredAt: earlier },
    { ...base, id: 'scanned', status: 'QR_SCANNED' as const, expiredAt: earlier, verifiedBy: 'vol-1' },
    { ...base, id: 'done', status: 'POINT_CONFIRMED' as const, expiredAt: later },
    { ...base, id: 'other-station', binId: 'st-2', status: 'CREATED' as const, expiredAt: later }
  ];
  assert.deepEqual(
    getPendingDutySubmissions(items, 'st-1', now).map(item => item.id),
    ['fresh', 'scanned']
  );
  assert.deepEqual(getPendingDutySubmissions(items, '', now), []);
});

test('only the volunteer who scanned the QR (or an admin) can act on it', () => {
  assert.equal(canVolunteerActOnSubmission({ verifiedBy: 'vol-1' }, { id: 'vol-1', role: 'volunteer' }), true);
  assert.equal(canVolunteerActOnSubmission({ verifiedBy: 'vol-1' }, { id: 'vol-2', role: 'volunteer' }), false);
  assert.equal(canVolunteerActOnSubmission({ verifiedBy: 'vol-1' }, { id: 'admin-1', role: 'admin' }), true);
  assert.equal(canVolunteerActOnSubmission({ verifiedBy: undefined }, { id: 'vol-2', role: 'volunteer' }), true);
});
