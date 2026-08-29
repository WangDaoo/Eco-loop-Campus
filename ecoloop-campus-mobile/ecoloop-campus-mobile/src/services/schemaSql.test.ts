import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Supabase schema defines mobile operating tables without public demo seed rows', () => {
  const schemaPath = resolve('../../frontend/eco-loop-campus-admin/supabase/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  assert.match(schema, /latitude double precision/i);
  assert.match(schema, /longitude double precision/i);
  assert.doesNotMatch(schema, /insert into public\.(avatar_presets|settings|bins|waste_types|rewards|missions)\b/i);
  assert.doesNotMatch(schema, /student@school\.edu\.vn/);
  assert.doesNotMatch(schema, /volunteer@school\.edu\.vn/);
  assert.doesNotMatch(schema, /STATION-E1|QR-A1-RECYCLE|ECO-SUB-001/i);
  assert.match(schema, /proof-images/);
  assert.match(schema, /bucket_id = 'proof-images'/);
  assert.match(schema, /create table if not exists public\.rewards/i);
  assert.match(schema, /create table if not exists public\.missions/i);
  assert.match(schema, /create table if not exists public\.user_missions/i);
  assert.match(schema, /student insert own redemptions/i);
  assert.match(schema, /student insert own predictions/i);
  assert.match(schema, /student upload prediction images/i);
  assert.match(schema, /name like \('mobile-ai\/' \|\| public\.current_profile_id\(\) \|\| '\/%'\)/i);
  assert.match(schema, /with check \(user_id = public\.current_profile_id\(\)\)/i);
});

test('Supabase demo seed and admin bootstrap are separate from production schema', () => {
  const seedPath = resolve('../../frontend/eco-loop-campus-admin/supabase/demo_seed.sql');
  const adminPath = resolve('../../frontend/eco-loop-campus-admin/supabase/bootstrap_admin.sql');
  assert.equal(existsSync(seedPath), true);
  assert.equal(existsSync(adminPath), true);

  const seed = readFileSync(seedPath, 'utf8');
  const admin = readFileSync(adminPath, 'utf8');
  assert.match(seed, /Chỉ chạy khi cần demo/i);
  assert.match(seed, /insert into public\.bins/i);
  assert.match(seed, /insert into public\.waste_types/i);
  assert.match(seed, /insert into public\.rewards/i);
  assert.match(seed, /insert into public\.missions/i);
  assert.match(seed, /ECL-ST-/i);
  assert.match(admin, /insert into public\.users/i);
  assert.doesNotMatch(admin, /insert into public\.(bins|waste_types|rewards|missions)\b/i);
});

test('Supabase schema defines atomic mobile QR and Ecopoint RPC functions', () => {
  const schemaPath = resolve('../../frontend/eco-loop-campus-admin/supabase/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  assert.match(schema, /create or replace function public\.create_recycling_submission/i);
  assert.match(schema, /create or replace function public\.scan_recycling_qr/i);
  assert.match(schema, /ECL-SUB-/i);
  assert.doesNotMatch(schema, /'ECO-' \|\| v_suffix/i);
  assert.match(schema, /create or replace function public\.confirm_recycling_submission/i);
  assert.match(schema, /create or replace function public\.reject_recycling_submission/i);
  assert.match(schema, /create or replace function public\.request_recycling_review/i);
  assert.match(schema, /for update skip locked/i);
  assert.match(schema, /grant execute on function public\.create_recycling_submission/i);
  assert.match(schema, /grant execute on function public\.confirm_recycling_submission/i);
});

test('Supabase schema enables realtime bin map synchronization', () => {
  const schemaPath = resolve('../../frontend/eco-loop-campus-admin/supabase/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  assert.match(schema, /alter table public\.bins replica identity full/i);
  assert.match(schema, /alter publication supabase_realtime add table public\.bins/i);
});

test('Supabase schema defines admin-managed avatar presets', () => {
  const schemaPath = resolve('../../frontend/eco-loop-campus-admin/supabase/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  assert.match(schema, /create table if not exists public\.avatar_presets/i);
  assert.match(schema, /avatar-presets/i);
  assert.match(schema, /alter publication supabase_realtime add table public\.avatar_presets/i);
});
