import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRemoteHydrationState } from './remoteHydration';
import { MobileInitialData } from '../services/supabaseMobileStore';

const baseData: MobileInitialData = {
  users: [{ id: 'user-real', name: 'Real user', points: 99 } as any],
  stations: [{ id: 'station-real', name: 'Real station' } as any],
  wasteTypes: [{ id: 'paper', name: 'Giay sach' } as any],
  predictions: [{ id: 'ai-real', className: 'paper' } as any],
  submissions: [],
  pointTransactions: [],
  feedbacks: [],
  missions: [{ id: 'mission-real', title: 'Real mission' } as any],
  rewards: [{ id: 'reward-real', title: 'Real reward' } as any],
  rewardRedemptions: [{ id: 'redeem-real', userId: 'user-real' } as any],
  qrScanLogs: [{ id: 'scan-real', scannedBy: 'vol-1' } as any],
  proofImages: [],
  avatarOptions: []
};

test('remote hydration keeps Supabase only when station and waste type data are ready', () => {
  const state = resolveRemoteHydrationState(baseData, { ok: true, missing: [] });

  assert.equal(state.syncSource, 'supabase');
  assert.equal(state.syncError, '');
  assert.equal(state.users[0].id, 'user-real');
  assert.equal(state.stations[0].id, 'station-real');
  assert.equal(state.wasteTypes[0].id, 'paper');
  assert.equal(state.predictions[0].id, 'ai-real');
  assert.equal(state.rewards[0].id, 'reward-real');
  assert.equal(state.missions[0].id, 'mission-real');
  assert.equal((state as any).rewardRedemptions[0].id, 'redeem-real');
  assert.equal((state as any).qrScanLogs[0].id, 'scan-real');
});

test('remote hydration falls back to mock data when operating data is incomplete', () => {
  const state = resolveRemoteHydrationState({ ...baseData, stations: [] }, { ok: false, missing: ['bins'] });

  assert.equal(state.syncSource, 'supabase');
  assert.match(state.syncError, /bins/);
  assert.deepEqual(state.stations, []);
  assert.deepEqual(state.wasteTypes, baseData.wasteTypes);
  assert.deepEqual(state.rewards, baseData.rewards);
  assert.deepEqual(state.missions, baseData.missions);
  assert.ok(Array.isArray((state as any).rewardRedemptions));
});
