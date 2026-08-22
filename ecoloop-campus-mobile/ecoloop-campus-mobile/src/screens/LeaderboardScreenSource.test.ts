import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'LeaderboardScreen.tsx'), 'utf8');

test('LeaderboardScreen shows user avatars and highlights the current profile', () => {
  assert.match(source, /UserAvatar/);
  assert.match(source, /currentUser/);
  assert.match(source, /styles\.currentUserRow/);
  assert.match(source, /row\.id === currentUser\.id/);
});

test('LeaderboardScreen keeps long names and scores from overlapping', () => {
  assert.match(source, /styles\.avatarSlot/);
  assert.match(source, /numberOfLines=\{1\}/);
  assert.match(source, /ellipsizeMode="tail"/);
  assert.match(source, /point:\s*\{[\s\S]*minWidth:\s*66/);
  assert.match(source, /rowBody:\s*\{[\s\S]*minWidth:\s*0/);
});

test('LeaderboardScreen uses a narrower but balanced white ranking card', () => {
  assert.match(source, /<UserAvatar[^>]*size=\{50\}/);
  assert.match(source, /row:\s*\{[\s\S]*width:\s*'92%'[\s\S]*alignSelf:\s*'center'/);
  assert.match(source, /row:\s*\{[\s\S]*minHeight:\s*76/);
  assert.match(source, /row:\s*\{[\s\S]*paddingVertical:\s*12/);
  assert.match(source, /row:\s*\{[\s\S]*gap:\s*10/);
  assert.match(source, /avatarSlot:\s*\{\s*width:\s*56,\s*height:\s*56/);
  assert.match(source, /rank:\s*\{\s*width:\s*38,\s*height:\s*38/);
  assert.doesNotMatch(source, /paddingVertical:\s*8/);
  assert.doesNotMatch(source, /<UserAvatar[^>]*size=\{54\}/);
});
