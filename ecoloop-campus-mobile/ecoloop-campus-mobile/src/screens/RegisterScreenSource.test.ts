import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'RegisterScreen.tsx'), 'utf8');

test('RegisterScreen collects only the approved HYUTE student profile fields', () => {
  assert.match(source, /Mã sinh viên/);
  assert.match(source, /Số điện thoại/);
  assert.match(source, /faculties\.map/);
  assert.match(source, /facultyCode/);
  assert.doesNotMatch(source, /Chuyên ngành|chuyên ngành|specialization/);
  assert.doesNotMatch(source, /Mã lớp|classCode/);
  assert.doesNotMatch(source, /Ngành học|major/);
});

test('RegisterScreen sanitizes broken faculty names from the backend catalog', () => {
  assert.match(source, /resolveFacultyDisplayName/);
  assert.match(source, /facultyCode: faculty\.code/);
  assert.match(source, /facultyName: faculty\.name/);
});

test('RegisterScreen explains the school email requirement instead of showing an API code', () => {
  assert.match(source, /INVALID_SCHOOL_EMAIL/);
  assert.match(source, /Email không hợp lệ, vui lòng thử lại/);
});
