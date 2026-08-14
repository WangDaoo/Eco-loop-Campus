import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'LoginScreen.tsx'), 'utf8');

test('LoginScreen offers an explicit offline demo path with clear copy', () => {
  assert.match(source, /signInDemo/);
  assert.match(source, /Dùng demo offline/);
  assert.match(source, /không ghi Supabase/);
  assert.match(source, /handleDemo/);
});

test('LoginScreen keeps real Supabase login separate from demo login', () => {
  assert.match(source, /await signIn\(role, email, password\)/);
  assert.match(source, /await signInDemo\(role\)/);
});

test('LoginScreen uses refreshed Eco-loop framing without mojibake', () => {
  assert.doesNotMatch(source, /Ã|Â|Ä/);
  assert.match(source, /Eco-loop Campus/);
  assert.match(source, /Sinh viên/);
  assert.match(source, /Tình nguyện viên/);
});
