import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'AppContext.tsx'), 'utf8');

test('AppProvider hydrates mission state from backend PostgreSQL data', () => {
  assert.match(source, /setMissions\(state\.missions\)/);
});

test('AppProvider polls backend PostgreSQL instead of wiring Supabase realtime', () => {
  assert.match(source, /POLL_INTERVAL_MS/);
  assert.match(source, /setInterval\(\(\) => \{/);
  assert.doesNotMatch(source, /subscribeRealtime/);
});
test('AppProvider hydrates user list from backend remote data for leaderboard', () => {
  assert.match(source, /setUsers\(state\.users\)/);
  assert.doesNotMatch(source, /setUsers\(mockUsers\)/);
});
test('AppProvider exposes reward redemption history with backend polling updates', () => {
  assert.match(source, /rewardRedemptions: RewardRedemption\[\]/);
  assert.match(source, /setRewardRedemptions\(state\.rewardRedemptions\)/);
  assert.doesNotMatch(source, /reward_redemptions:\s*payload\s*=>/);
});
test('AppProvider exposes QR scan logs with backend polling updates', () => {
  assert.match(source, /qrScanLogs: QRScanLog\[\]/);
  assert.match(source, /setQrScanLogs\(state\.qrScanLogs\)/);
  assert.doesNotMatch(source, /qr_scan_logs:\s*payload\s*=>/);
});
test('AppProvider returns QR scan outcomes without offline scan fallback', () => {
  assert.match(source, /QRScanOutcome/);
  assert.match(source, /markSubmissionScanned: \(qrToken: string\) => Promise<QRScanOutcome>/);
  assert.doesNotMatch(source, /recordOfflineQrLog/);
  assert.doesNotMatch(source, /QR không tồn tại trong dữ liệu trên thiết bị/);
});
test('AppProvider exposes mobile AI predictions with backend polling updates', () => {
  assert.match(source, /aiPredictions: PredictionRecord\[\]/);
  assert.match(source, /setAiPredictions\(state\.predictions\)/);
  assert.doesNotMatch(source, /predictions:\s*payload\s*=>/);
});
test('AppProvider leaves mission progress to verified backend events', () => {
  assert.doesNotMatch(source, /missionIdsForSubmission/);
  assert.doesNotMatch(source, /missionIdsForFeedback/);
  assert.doesNotMatch(source, /advanceMissionsForAction/);
  assert.doesNotMatch(source, /remoteStore\.advanceMission/);
  assert.match(source, /remoteStore\.submitFeedback[\s\S]*hydrateRemoteData\(currentUser\)/);
});

test('AppProvider does not create offline Ecopoint rewards when missions complete', () => {
  assert.doesNotMatch(source, /createMissionRewardPoint/);
  assert.doesNotMatch(source, /source: 'mission_reward'/);
  assert.doesNotMatch(source, /setPointTransactions\(items => \[rewardPoint, \.\.\.items\]\)/);
});

test('AppProvider removes explicit local preview login and mock runtime mode', () => {
  assert.doesNotMatch(source, /signInDemo/);
  assert.doesNotMatch(source, /resetMockSession/);
  assert.doesNotMatch(source, /setSyncSource\('mock'\)/);
  assert.doesNotMatch(source, /mockServices/);
  assert.doesNotMatch(source, /\.\.\/data\/mockData/);
  assert.doesNotMatch(source, /supabaseClient/);
  assert.doesNotMatch(source, /createSupabaseMobileStore/);
});
test('AppProvider exposes avatar updates and keeps current user plus leaderboard users in sync', () => {
  assert.match(source, /avatarOptions: AvatarPreset\[\]/);
  assert.match(source, /setAvatarOptions\(state\.avatarOptions\)/);
  assert.doesNotMatch(source, /backendAvatarService/);
  assert.doesNotMatch(source, /refreshBackendAvatars/);
  assert.doesNotMatch(source, /avatar_presets:\s*payload\s*=>/);
  assert.match(source, /updateAvatar: \(avatarKey: string\) => Promise<void>/);
  assert.match(source, /remoteStore\.updateAvatar/);
  assert.match(source, /avatarKey/);
  assert.match(source, /setCurrentUser\(nextUser\)/);
  assert.match(source, /setUsers\(items => items\.map/);
});

test('AppProvider exposes password updates through backend Auth', () => {
  assert.match(source, /updatePassword: \(email: string, currentPassword: string, newPassword: string\) => Promise<void>/);
  assert.match(source, /remoteStore\.updatePassword\(email, currentPassword, newPassword\)/);
});

test('AppProvider keeps pending volunteer registrations outside the authenticated app shell', () => {
  assert.match(source, /user\.status !== 'active'/);
  assert.match(source, /setIsAuthenticated\(false\)/);
  assert.match(source, /await remoteStore\.signOut\(\)/);
});

test('AppProvider surfaces backend mutation errors instead of falling back to local success', () => {
  assert.match(source, /const failRemoteMutation = \(error: unknown\): never => \{/);
  assert.match(source, /remoteStore\.confirmSubmission[\s\S]*failRemoteMutation\(error\);/);
  assert.match(source, /remoteStore\.attachProofImage[\s\S]*failRemoteMutation\(error\);/);
  assert.match(source, /remoteStore\.createSubmission[\s\S]*failRemoteMutation\(error\);/);
  assert.match(source, /remoteStore\.requestReward[\s\S]*failRemoteMutation\(error\);/);
});

test('AppProvider refreshes backend data when the mobile app returns to foreground', () => {
  assert.match(source, /AppState/);
  assert.match(source, /addEventListener\('change'/);
  assert.match(source, /nextState === 'active'/);
  assert.match(source, /hydrateRemoteData\(currentUser\)/);
});
