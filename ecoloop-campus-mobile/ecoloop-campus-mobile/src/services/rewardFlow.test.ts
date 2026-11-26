import assert from 'node:assert/strict';
import test from 'node:test';
import { getRedeemBlockReason, getRedeemableRewards, getRedemptionDisplayStatus, isRewardOutOfStock } from './rewardFlow';

test('only active rewards are offered for redemption', () => {
  const rewards = [
    { id: 'a', status: 'active' as const },
    { id: 'b', status: 'inactive' as const }
  ];
  assert.deepEqual(getRedeemableRewards(rewards).map(item => item.id), ['a']);
});

test('reward stock: missing stock is unlimited, zero stock is sold out', () => {
  assert.equal(isRewardOutOfStock({}), false);
  assert.equal(isRewardOutOfStock({ stock: 3 }), false);
  assert.equal(isRewardOutOfStock({ stock: 0 }), true);
});

test('redeem is blocked by an active code first, then stock, then points', () => {
  const reward = { costPoints: 300, stock: 0 };
  assert.equal(getRedeemBlockReason(reward, { points: 100, hasActiveCode: true }), 'active-code');
  assert.equal(getRedeemBlockReason(reward, { points: 100, hasActiveCode: false }), 'out-of-stock');
  assert.equal(getRedeemBlockReason({ costPoints: 300 }, { points: 100, hasActiveCode: false }), 'not-enough-points');
  assert.equal(getRedeemBlockReason({ costPoints: 300 }, { points: 300, hasActiveCode: false }), '');
});

test('pending reward codes past their deadline are shown as expired', () => {
  const now = new Date('2026-11-26T08:00:00.000Z').getTime();
  const past = new Date('2026-11-26T07:50:00.000Z');
  const future = new Date('2026-11-26T08:10:00.000Z');
  assert.equal(getRedemptionDisplayStatus({ status: 'pending', expiresAt: past }, now), 'expired');
  assert.equal(getRedemptionDisplayStatus({ status: 'pending', expiresAt: future }, now), 'pending');
  assert.equal(getRedemptionDisplayStatus({ status: 'fulfilled', expiresAt: past }, now), 'fulfilled');
  assert.equal(getRedemptionDisplayStatus({ status: 'requested' }, now), 'requested');
});
