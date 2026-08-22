import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'AboutScreen.tsx'), 'utf8');

test('AboutScreen uses polished Vietnamese Eco-loop copy', () => {
  assert.match(source, /Về Eco-loop Campus/);
  assert.match(source, /sinh viên/);
  assert.match(source, /trạm thu gom/);
  assert.match(source, /điểm/);
  assert.doesNotMatch(source, /Ve Ecoloop|giup sinh vien|phan loai rac|quet QR|doi thuong|Back/);
});

