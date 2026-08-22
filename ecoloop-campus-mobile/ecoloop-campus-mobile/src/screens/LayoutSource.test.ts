import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function sourceOf(fileName: string) {
  return readFileSync(join(__dirname, fileName), 'utf8');
}

test('RewardsScreen keeps the pastel mobile template and vector icons', () => {
  const source = sourceOf('RewardsScreen.tsx');
  assert.match(source, /Ionicons/);
  assert.match(source, /colors\.bgPink/);
  assert.doesNotMatch(source, /#f4f7f9/);
  assert.doesNotMatch(source, /🎁|🎉|💸|🎮|🥤|💊|🔍|ℹ️/);
});

test('VolunteerDutyScreen uses scroll layout and localized station status labels', () => {
  const source = sourceOf('VolunteerDutyScreen.tsx');
  assert.match(source, /<Screen\s+scroll/);
  assert.match(source, /getStationStatusLabel/);
  assert.doesNotMatch(source, /\{station\.status\}/);
});

test('HistoryScreen uses scroll layout and localized submission status labels', () => {
  const source = sourceOf('HistoryScreen.tsx');
  assert.match(source, /<Screen\s+scroll/);
  assert.match(source, /getSubmissionStatusLabel/);
  assert.doesNotMatch(source, /\{item\.status\}/);
});

test('ScannerScreen keeps pending QR review visible and modal usable on LD4', () => {
  const source = sourceOf('ScannerScreen.tsx');
  assert.match(source, /ScrollView/);
  assert.match(source, /getSubmissionStatusLabel/);
  assert.match(source, /maxHeight:\s*'94%'/);
  assert.match(source, /styles\.modalScrollContent/);
  assert.match(source, /useWindowDimensions/);
  assert.match(source, /scannerSize\s*=\s*Math\.max\(220,\s*Math\.min\(300,\s*windowWidth - 96\)\)/);
  assert.match(source, /scanFrameSize\s*=\s*Math\.min\(210,\s*scannerSize - 48\)/);
  assert.match(source, /style=\{\[styles\.scannerBox,\s*\{ width:\s*scannerSize,\s*height:\s*scannerSize \}\]\}/);
  assert.match(source, /style=\{\[styles\.targetFrame,\s*\{ width:\s*scanFrameSize,\s*height:\s*scanFrameSize \}\]\}/);
  assert.doesNotMatch(source, /scannerBox:\s*\{[\s\S]*aspectRatio:\s*1/);
  assert.doesNotMatch(source, /height:\s*300/);
  assert.doesNotMatch(source, /height:\s*240/);
  assert.doesNotMatch(source, /maxHeight:\s*'88%'/);
  assert.doesNotMatch(source, /\{selectedSubmission\.status\}/);
});

test('ProfileScreen ends after the logout action without extra decoration', () => {
  const source = sourceOf('ProfileScreen.tsx');
  assert.doesNotMatch(source, /profileBottomSpacer/);
  assert.doesNotMatch(source, /cloudContainer/);
  assert.doesNotMatch(source, /<Svg/);
  assert.match(source, /<Screen scroll style=\{styles\.container\} bottomClearance=\{24\}>/);
  assert.match(source, /logoutButton:/);
});
test('ProfileScreen keeps the avatar area clean without visible labels over it', () => {
  const source = sourceOf('ProfileScreen.tsx');
  assert.doesNotMatch(source, /styles\.titleBubble|titleBubble:/);
  assert.doesNotMatch(source, /bubbleTailWrap|bubbleTailBorder|bubbleTail:/);
  assert.doesNotMatch(source, /styles\.avatarEditBadge|avatarEditBadge:|avatarEditText:/);
  assert.doesNotMatch(source, /<Text style=\{styles\.avatarEditText\}>Đổi avatar<\/Text>/);
});
test('ProfileScreen uses live rank and avatar editor instead of hard-coded profile UI', () => {
  const source = sourceOf('ProfileScreen.tsx');
  assert.match(source, /getUserLeaderboardRank/);
  assert.match(source, /AVATAR_OPTIONS/);
  assert.match(source, /updateAvatar/);
  assert.match(source, /Modal/);
  assert.doesNotMatch(source, /Thứ hạng hiện tại của bạn: 12|Thá»© háº¡ng hiá»‡n táº¡i cá»§a báº¡n: 12/);
  assert.doesNotMatch(source, /left:\s*'50%'/);
});

test('ProfileScreen offers password change without leaving the profile template', () => {
  const source = sourceOf('ProfileScreen.tsx');
  assert.match(source, /updatePassword/);
  assert.match(source, /passwordModalVisible/);
  assert.match(source, /Đổi mật khẩu/);
  assert.match(source, /currentPassword/);
  assert.match(source, /Mật khẩu hiện tại/);
  assert.match(source, /Mật khẩu mới/);
  assert.match(source, /Xác nhận mật khẩu/);
  assert.match(source, /updatePassword\(user\.email, currentPassword\.trim\(\), cleaned\)/);
});
