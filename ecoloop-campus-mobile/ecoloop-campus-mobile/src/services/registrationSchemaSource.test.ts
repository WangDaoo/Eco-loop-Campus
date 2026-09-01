import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const runtimeSchema = readFileSync(resolve('../../backend/local_db/schema.sql'), 'utf8');

test('runtime PostgreSQL schema defines backend user roles and statuses', () => {
  assert.match(runtimeSchema, /create table if not exists users/);
  assert.match(runtimeSchema, /role text not null default 'student'/);
  assert.match(runtimeSchema, /status text not null default 'active'/);
});
