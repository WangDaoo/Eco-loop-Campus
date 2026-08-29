import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const mobileSchema = readFileSync(resolve('supabase/schema.sql'), 'utf8');
const adminSchema = readFileSync(resolve('../../frontend/eco-loop-campus-admin/supabase/schema.sql'), 'utf8');

for (const [label, source] of [
  ['mobile schema', mobileSchema],
  ['admin schema', adminSchema]
] as const) {
  test(`${label} creates public user profiles from Supabase Auth signups`, () => {
    assert.match(source, /create or replace function public\.handle_new_auth_user\(\)/);
    assert.match(source, /security definer/);
    assert.match(source, /new\.raw_user_meta_data\s*->>\s*'role'/);
    assert.match(source, /status[\s\S]*case[\s\S]*volunteer[\s\S]*pending[\s\S]*active/);
    assert.match(source, /after insert on auth\.users/);
    assert.match(source, /execute function public\.handle_new_auth_user\(\)/);
  });
}
