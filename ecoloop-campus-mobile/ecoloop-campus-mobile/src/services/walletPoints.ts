import { EcoPointTransaction } from '../types';

type ResolveWalletPointsInput = {
  profilePoints: number;
  pointTransactions: EcoPointTransaction[];
  syncSource: 'mock' | 'supabase';
};

export function resolveWalletPoints({ profilePoints, pointTransactions, syncSource }: ResolveWalletPointsInput) {
  if (syncSource === 'supabase') return profilePoints;

  return pointTransactions.reduce((total, item) => {
    if (item.status !== 'confirmed') return total;
    return item.type === 'spend' ? total - item.points : total + item.points;
  }, profilePoints);
}