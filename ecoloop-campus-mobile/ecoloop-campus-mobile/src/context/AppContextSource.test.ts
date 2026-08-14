import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'AppContext.tsx'), 'utf8');

test('AppProvider hydrates mission state from Supabase remote data', () => {
  assert.match(source, /setMissions\(state\.missions\)/);
});

test('AppProvider wires Supabase realtime mission catalog and user progress changes', () => {
  assert.match(source, /missions:\s*payload\s*=>/);
  assert.match(source, /user_missions:\s*payload\s*=>/);
});
test('AppProvider hydrates user list from Supabase remote data for leaderboard', () => {
  assert.match(source, /setUsers\(state\.users\)/);
  assert.match(source, /setUsers\(mockUsers\)/);
});
test('AppProvider exposes reward redemption history with Supabase realtime updates', () => {
  assert.match(source, /rewardRedemptions: RewardRedemption\[\]/);
  assert.match(source, /setRewardRedemptions\(state\.rewardRedemptions\)/);
  assert.match(source, /reward_redemptions:\s*payload\s*=>/);
});
test('AppProvider exposes QR scan logs with Supabase realtime updates', () => {
  assert.match(source, /qrScanLogs: QRScanLog\[\]/);
  assert.match(source, /setQrScanLogs\(state\.qrScanLogs\)/);
  assert.match(source, /qr_scan_logs:\s*payload\s*=>/);
});
test('AppProvider returns QR scan outcomes and records offline scan logs', () => {
  assert.match(source, /QRScanOutcome/);
  assert.match(source, /markSubmissionScanned: \(qrToken: string\) => Promise<QRScanOutcome>/);
  assert.match(source, /result: 'WRONG_STATION'/);
  assert.match(source, /setQrScanLogs\(items => \[log, \.\.\.items\]\)/);
});
test('AppProvider exposes mobile AI predictions with Supabase realtime updates', () => {
  assert.match(source, /aiPredictions: PredictionRecord\[\]/);
  assert.match(source, /setAiPredictions\(state\.predictions\)/);
  assert.match(source, /predictions:\s*payload\s*=>/);
});
test('AppProvider auto-progresses missions after real submission and feedback actions', () => {
  assert.match(source, /missionIdsForSubmission/);
  assert.match(source, /missionIdsForFeedback/);
  assert.match(source, /advanceMissionsForAction/);
});

test('AppProvider creates offline Ecopoint rewards when missions complete', () => {
  assert.match(source, /createMissionRewardPoint/);
  assert.match(source, /mission\.rewardPoints/);
  assert.match(source, /source: 'mission_reward'/);
  assert.match(source, /setPointTransactions\(items => \[rewardPoint, \.\.\.items\]\)/);
});

test('AppProvider exposes explicit offline demo login without pretending to use Supabase', () => {
  assert.match(source, /signInDemo: \(role: UserProfile\['role'\]\) => Promise<void>/);
  assert.match(source, /resetMockSession/);
  assert.match(source, /setSyncSource\('mock'\)/);
  assert.match(source, /Demo offline/);
});
