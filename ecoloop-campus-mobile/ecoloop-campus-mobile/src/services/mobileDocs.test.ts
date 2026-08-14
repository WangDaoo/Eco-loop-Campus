import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

test('mobile README documents real Supabase smoke verification path', () => {
  const readme = read('README.md');

  assert.match(readme, /## Supabase backend/);
  assert.match(readme, /frontend\/eco-loop-campus-admin\/supabase\/schema\.sql/);
  assert.match(readme, /EXPO_PUBLIC_TEST_STUDENT_EMAIL/);
  assert.match(readme, /EXPO_PUBLIC_TEST_VOLUNTEER_EMAIL/);
  assert.match(readme, /npm run smoke:supabase/);
  assert.match(readme, /Supabase Auth/);
});

test('mobile env example contains only placeholders for public config and smoke accounts', () => {
  const envExample = read('.env.example');

  assert.match(envExample, /EXPO_PUBLIC_SUPABASE_URL=https:\/\/your-project\.supabase\.co/);
  assert.match(envExample, /EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key/);
  assert.match(envExample, /EXPO_PUBLIC_TEST_STUDENT_PASSWORD=change-me/);
  assert.match(envExample, /EXPO_PUBLIC_SMOKE_WRITE=0/);
  assert.doesNotMatch(envExample, /sb_publishable_[A-Za-z0-9_\-]+/);
  assert.doesNotMatch(envExample, /tnnywbshfnjbflbbfzkc/);
});
