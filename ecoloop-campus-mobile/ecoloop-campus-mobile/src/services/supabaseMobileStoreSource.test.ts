import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'supabaseMobileStore.ts'), 'utf8');

test('Supabase mobile store copies Android content proof images to cache before upload', () => {
  assert.match(source, /content:\/\//);
  assert.match(source, /expo-file-system/);
  assert.match(source, /copyAsync/);
  assert.match(source, /cacheDirectory/);
  assert.match(source, /response\.arrayBuffer\(\)/);
});
