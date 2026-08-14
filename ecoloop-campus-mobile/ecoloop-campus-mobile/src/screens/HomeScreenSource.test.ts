import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'HomeScreen.tsx'), 'utf8');

test('HomeScreen does not let students manually advance mission progress', () => {
  assert.doesNotMatch(source, /handleMissionAction/);
  assert.match(source, /Tự động cập nhật/);
});

test('HomeScreen uses the refreshed campus task frame', () => {
  assert.doesNotMatch(source, /Ã|Â|Ä/);
  assert.match(source, /Nhiệm vụ tuần/);
  assert.match(source, /navigation\.navigate\('Submit'\)/);
});
