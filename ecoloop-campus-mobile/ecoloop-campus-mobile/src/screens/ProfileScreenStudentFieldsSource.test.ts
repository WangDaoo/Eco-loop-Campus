import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'ProfileScreen.tsx'), 'utf8');

test('ProfileScreen shows the authoritative student code faculty and phone fields', () => {
  assert.match(source, /user\.studentCode/);
  assert.match(source, /resolveFacultyDisplayName/);
  assert.match(source, /user\.phoneNumber/);
  assert.match(source, /Mã sinh viên/);
  assert.match(source, /Số điện thoại/);
});

test('ProfileScreen keeps the profile title separate from the selected avatar label', () => {
  assert.match(source, /styles\.summaryTitle\}>\{user\.name/);
  assert.doesNotMatch(source, /styles\.summaryTitle\}>\{selectedAvatar\.label\}/);
});

test('ProfileScreen uses the cleaned faculty label in summary metadata', () => {
  assert.match(source, /styles\.summaryMeta\}>\{facultyLabel/);
  assert.doesNotMatch(source, /styles\.summaryMeta\}>\{user\.group \|\|/);
});
