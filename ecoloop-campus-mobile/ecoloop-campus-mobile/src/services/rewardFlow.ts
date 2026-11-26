import type { Reward, RewardRedemption } from '../types';

/** Students can only redeem rewards the admin has left active. */
export function getRedeemableRewards<T extends Pick<Reward, 'status'>>(rewards: T[]) {
  return rewards.filter(reward => reward.status === 'active');
}

/** A reward without a stock value is unlimited; zero stock means it is sold out. */
export function isRewardOutOfStock(reward: Pick<Reward, 'stock'>) {
  return typeof reward.stock === 'number' && reward.stock <= 0;
}

export type RedeemBlockReason = 'active-code' | 'out-of-stock' | 'not-enough-points' | '';

export function getRedeemBlockReason(
  reward: Pick<Reward, 'costPoints' | 'stock'>,
  { points, hasActiveCode }: { points: number; hasActiveCode: boolean }
): RedeemBlockReason {
  if (hasActiveCode) return 'active-code';
  if (isRewardOutOfStock(reward)) return 'out-of-stock';
  if (reward.costPoints > points) return 'not-enough-points';
  return '';
}

/**
 * Pending codes are only expired on the server once a volunteer tries to scan them,
 * so the history shows them as expired as soon as their deadline passes.
 */
export function getRedemptionDisplayStatus(
  redemption: Pick<RewardRedemption, 'status' | 'expiresAt'>,
  now = Date.now()
): RewardRedemption['status'] {
  const waiting = redemption.status === 'pending' || redemption.status === 'requested';
  if (waiting && redemption.expiresAt && redemption.expiresAt.getTime() <= now) return 'expired';
  return redemption.status;
}
