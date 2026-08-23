import { EcoPointTransaction } from '../types';

type ResolveWalletPointsInput = {
  profilePoints: number;
  pointTransactions: EcoPointTransaction[];
  syncSource: 'supabase';
};

export function resolveWalletPoints({ profilePoints, pointTransactions, syncSource }: ResolveWalletPointsInput) {
  return profilePoints;
}
