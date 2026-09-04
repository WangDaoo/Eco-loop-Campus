import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { mapPointHistoryRow, mapRewardRedemptionRow, mapSubmissionRow, mapUserRow } from './supabaseAdapters';
import { createBackendMobileStore } from './backendMobileStore';

const fixtures = JSON.parse(readFileSync(resolve(__dirname, '../../../../contracts/backend_contract_fixtures.json'), 'utf8'));

test('mobile adapters consume the canonical backend payload without losing fields', () => {
  const user = mapUserRow({ ...fixtures.user, futureOptionalField: 'ignored safely' });
  const submission = mapSubmissionRow(fixtures.submission);
  const point = mapPointHistoryRow({ ...fixtures.pointHistory, points: '25' });
  const reward = mapRewardRedemptionRow(fixtures.rewardBatch);

  assert.equal(user.facultyName, fixtures.user.facultyName);
  assert.equal(submission.verifiedAt?.toISOString(), '2026-09-05T01:10:03.000Z');
  assert.equal(submission.actualQuantity, 2.5);
  assert.equal(point.points, 25);
  assert.equal(reward.status, 'fulfilled');
  assert.deepEqual(reward.items, fixtures.rewardBatch.items.map((item: any) => ({
    rewardId: item.rewardId,
    rewardLabel: item.rewardTitle,
    quantity: item.quantity,
    pointsEach: item.pointsEach,
    pointsTotal: item.pointsTotal,
  })));
});

test('mobile backend errors never become local success', async () => {
  for (const error of fixtures.errors) {
    const store = createBackendMobileStore({
      fetcher: async () => ({ ok: false, status: error.status, json: async () => error }),
      storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    });
    await assert.rejects(() => store.checkSchema(), new RegExp(error.detail));
  }

  const malformed = createBackendMobileStore({
    fetcher: async () => ({ ok: false, status: 503, json: async () => { throw new SyntaxError('bad json'); } }),
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
  });
  await assert.rejects(() => malformed.checkSchema(), /503/);

  const offline = createBackendMobileStore({
    fetcher: async () => { throw new Error('network offline'); },
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
  });
  await assert.rejects(() => offline.checkSchema(), /network offline/);

  const timedOut = createBackendMobileStore({
    fetcher: async () => { throw new Error('request timeout'); },
    storage: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
  });
  await assert.rejects(() => timedOut.checkSchema(), /request timeout/);
});
