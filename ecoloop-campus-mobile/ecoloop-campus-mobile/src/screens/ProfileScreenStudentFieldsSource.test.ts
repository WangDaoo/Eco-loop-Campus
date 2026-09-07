import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'ProfileScreen.tsx'), 'utf8');

test('ProfileScreen shows the authoritative student code faculty and phone fields', () => {
  assert.match(source, /user\.studentCode/);
  assert.match(source, /user\.facultyName/);
  assert.match(source, /user\.phoneNumber/);
  assert.match(source, /Mã sinh viên/);
  assert.match(source, /Số điện thoại/);
});
