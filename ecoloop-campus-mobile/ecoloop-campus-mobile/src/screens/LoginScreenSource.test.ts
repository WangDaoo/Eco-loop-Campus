import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'LoginScreen.tsx'), 'utf8');

test('LoginScreen does not expose local preview or demo data login', () => {
  assert.doesNotMatch(source, /signInDemo/);
  assert.doesNotMatch(source, /Xem trước bằng dữ liệu trên máy/);
  assert.doesNotMatch(source, /dữ liệu lưu trên thiết bị/);
  assert.doesNotMatch(source, /handleDemo/);
  assert.match(source, /await signIn\(role, email, password\)/);
});

test('LoginScreen uses refreshed Eco-loop framing without mojibake', () => {
  assert.doesNotMatch(source, /Ã|Â|Ä/);
  assert.match(source, /Eco-loop Campus/);
  assert.match(source, /Sinh viên/);
  assert.match(source, /Tình nguyện viên/);
});
