import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Supabase schema seeds mobile collection stations used by Eco-loop Campus app', () => {
  const schemaPath = resolve('../../frontend/eco-loop-campus-admin/supabase/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  assert.match(schema, /latitude double precision/i);
  assert.match(schema, /longitude double precision/i);
  assert.match(schema, /insert into public\.bins/i);
  assert.match(schema, /station-e1/);
  assert.match(schema, /station-lib/);
  assert.match(schema, /station-caf/);
  assert.match(schema, /proof-images/);
  assert.match(schema, /bucket_id = 'proof-images'/);
  assert.match(schema, /create table if not exists public\.rewards/i);
  assert.match(schema, /insert into public\.rewards/i);
  assert.match(schema, /create table if not exists public\.missions/i);
  assert.match(schema, /create table if not exists public\.user_missions/i);
  assert.match(schema, /insert into public\.missions/i);
  assert.match(schema, /student insert own redemptions/i);
  assert.match(schema, /student insert own predictions/i);
  assert.match(schema, /student upload prediction images/i);
  assert.match(schema, /name like \('mobile-ai\/' \|\| public\.current_profile_id\(\) \|\| '\/%'\)/i);
  assert.match(schema, /with check \(user_id = public\.current_profile_id\(\)\)/i);
  assert.match(schema, /coffee/);
  assert.match(schema, /book/);
  assert.match(schema, /tree/);
  assert.match(schema, /student@school\.edu\.vn/);
  assert.match(schema, /volunteer@school\.edu\.vn/);
});

test('Supabase schema defines atomic mobile QR and Ecopoint RPC functions', () => {
  const schemaPath = resolve('../../frontend/eco-loop-campus-admin/supabase/schema.sql');
  const schema = readFileSync(schemaPath, 'utf8');

  assert.match(schema, /create or replace function public\.create_recycling_submission/i);
  assert.match(schema, /create or replace function public\.scan_recycling_qr/i);
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
