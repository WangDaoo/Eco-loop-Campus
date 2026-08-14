import assert from 'node:assert/strict';
import test from 'node:test';
import { readSupabaseSmokeConfig } from './supabaseSmokeConfig';

test('Supabase smoke config reads public project and test account env', () => {
  const config = readSupabaseSmokeConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_secret-value',
    EXPO_PUBLIC_TEST_STUDENT_EMAIL: 'student@school.edu.vn',
    EXPO_PUBLIC_TEST_STUDENT_PASSWORD: 'secret',
    EXPO_PUBLIC_TEST_VOLUNTEER_EMAIL: 'volunteer@school.edu.vn',
    EXPO_PUBLIC_TEST_VOLUNTEER_PASSWORD: 'secret2'
  });

  assert.equal(config.ok, true);
  if (!config.ok) return;
  assert.equal(config.url, 'https://project.supabase.co');
  assert.equal(config.student.email, 'student@school.edu.vn');
  assert.equal(config.volunteer?.email, 'volunteer@school.edu.vn');
  assert.equal(config.writeMode, false);
});

test('Supabase smoke config enables guarded write mode when volunteer account is present', () => {
  const config = readSupabaseSmokeConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_secret-value',
    EXPO_PUBLIC_TEST_STUDENT_EMAIL: 'student@school.edu.vn',
    EXPO_PUBLIC_TEST_STUDENT_PASSWORD: 'secret',
    EXPO_PUBLIC_TEST_VOLUNTEER_EMAIL: 'volunteer@school.edu.vn',
    EXPO_PUBLIC_TEST_VOLUNTEER_PASSWORD: 'secret2',
    EXPO_PUBLIC_SMOKE_WRITE: '1'
  });

  assert.equal(config.ok, true);
  if (!config.ok) return;
  assert.equal(config.writeMode, true);
});

test('Supabase smoke config requires volunteer account for write mode', () => {
  const config = readSupabaseSmokeConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_secret-value',
    EXPO_PUBLIC_TEST_STUDENT_EMAIL: 'student@school.edu.vn',
    EXPO_PUBLIC_TEST_STUDENT_PASSWORD: 'secret',
    EXPO_PUBLIC_SMOKE_WRITE: '1'
  });

  assert.equal(config.ok, false);
  if (config.ok) return;
  assert.deepEqual(config.missing, ['EXPO_PUBLIC_TEST_VOLUNTEER_EMAIL', 'EXPO_PUBLIC_TEST_VOLUNTEER_PASSWORD']);
});

test('Supabase smoke config reports missing values without leaking key material', () => {
  const config = readSupabaseSmokeConfig({
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_secret-value'
  });

  assert.equal(config.ok, false);
  if (config.ok) return;
  assert.match(config.message, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(config.message, /secret-value/);
});

test('Supabase smoke config tells developer to create Auth users for real verification', () => {
  const config = readSupabaseSmokeConfig({
    EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_secret-value'
  });

  assert.equal(config.ok, false);
  if (config.ok) return;
  assert.match(config.message, /Supabase Auth/);
  assert.match(config.message, /student/);
  assert.match(config.message, /volunteer/);
  assert.doesNotMatch(config.message, /secret-value/);
});
