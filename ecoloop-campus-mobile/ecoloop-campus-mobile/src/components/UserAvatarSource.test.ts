import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'UserAvatar.tsx'), 'utf8');

test('UserAvatar scales its white frame with avatar size so small leaderboard avatars do not overlap rank badges', () => {
  assert.match(source, /avatarFrameBleed\s*=\s*Math\.max\(4,\s*Math\.round\(size \* 0\.07\)\)/);
  assert.match(source, /avatarInnerPadding\s*=\s*Math\.max\(4,\s*Math\.round\(size \* 0\.055\)\)/);
  assert.match(source, /top:\s*-avatarFrameBleed/);
  assert.match(source, /left:\s*-avatarFrameBleed/);
  assert.match(source, /right:\s*-avatarFrameBleed/);
  assert.match(source, /bottom:\s*-avatarFrameBleed/);
  assert.match(source, /padding:\s*avatarInnerPadding/);
  assert.doesNotMatch(source, /top:\s*-16/);
  assert.doesNotMatch(source, /left:\s*-16/);
  assert.doesNotMatch(source, /padding:\s*12/);
});
