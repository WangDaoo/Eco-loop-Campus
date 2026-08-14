import assert from 'node:assert/strict';
import test from 'node:test';
import { EcoPointTransaction } from '../types';
import { resolveWalletPoints } from './walletPoints';

const transactions: EcoPointTransaction[] = [
  { id: 'earn-1', userId: 'student-1', points: 50, type: 'earn', status: 'confirmed', description: 'Earn', createdAt: new Date() },
  { id: 'spend-1', userId: 'student-1', points: 20, type: 'spend', status: 'confirmed', description: 'Spend', createdAt: new Date() },
  { id: 'pending-1', userId: 'student-1', points: 999, type: 'earn', status: 'pending', description: 'Pending', createdAt: new Date() }
];

test('Supabase wallet uses authoritative users.points without double-counting point history', () => {
  assert.equal(resolveWalletPoints({ profilePoints: 120, pointTransactions: transactions, syncSource: 'supabase' }), 120);
});

test('Mock wallet derives visible points from local point transactions', () => {
  assert.equal(resolveWalletPoints({ profilePoints: 100, pointTransactions: transactions, syncSource: 'mock' }), 130);
});