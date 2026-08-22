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

test('AppProvider exposes explicit local preview login without pretending to use remote data', () => {
  assert.match(source, /signInDemo: \(role: UserProfile\['role'\]\) => Promise<void>/);
  assert.match(source, /resetMockSession/);
  assert.match(source, /setSyncSource\('mock'\)/);
  assert.match(source, /dữ liệu lưu trên thiết bị/);
});
test('AppProvider exposes avatar updates and keeps current user plus leaderboard users in sync', () => {
  assert.match(source, /updateAvatar: \(avatarKey: string\) => Promise<void>/);
  assert.match(source, /remoteStore\.updateAvatar/);
  assert.match(source, /avatarKey/);
  assert.match(source, /setCurrentUser\(nextUser\)/);
  assert.match(source, /setUsers\(items => items\.map/);
});

test('AppProvider exposes password updates through Supabase Auth', () => {
  assert.match(source, /updatePassword: \(email: string, currentPassword: string, newPassword: string\) => Promise<void>/);
  assert.match(source, /remoteStore\.updatePassword\(email, currentPassword, newPassword\)/);
});

test('AppProvider keeps pending volunteer registrations outside the authenticated app shell', () => {
  assert.match(source, /user\.status !== 'active'/);
  assert.match(source, /setIsAuthenticated\(false\)/);
  assert.match(source, /await remoteStore\.signOut\(\)/);
});

test('AppProvider surfaces Supabase mutation errors instead of falling back to local success', () => {
  assert.match(source, /const failRemoteMutation = \(error: unknown\): never => \{/);
  assert.match(source, /catch \(error\) \{\s*failRemoteMutation\(error\);\s*\}/);
  assert.match(source, /remoteStore\.confirmSubmission[\s\S]*catch \(error\) \{\s*failRemoteMutation\(error\);\s*\}/);
  assert.match(source, /remoteStore\.attachProofImage[\s\S]*catch \(error\) \{\s*failRemoteMutation\(error\);\s*\}/);
});
