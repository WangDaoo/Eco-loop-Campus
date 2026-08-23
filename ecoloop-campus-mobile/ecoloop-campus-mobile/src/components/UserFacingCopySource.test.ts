import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const userFacingSources = [
  join(__dirname, '../screens/LoginScreen.tsx'),
  join(__dirname, '../screens/AboutScreen.tsx'),
  join(__dirname, '../screens/ScannerScreen.tsx'),
  join(__dirname, '../screens/SubmitScreen.tsx'),
  join(__dirname, '../context/AppContext.tsx'),
  join(__dirname, '../context/remoteHydration.ts'),
  join(__dirname, '../services/localAiService.ts'),
  join(__dirname, '../services/predictionService.ts'),
  join(__dirname, '../services/supabaseMobileStore.ts'),
  join(__dirname, './syncStatusCopy.ts')
];

const source = userFacingSources.map(file => readFileSync(file, 'utf8')).join('\n');

test('mobile user-facing copy avoids developer and demo wording', () => {
  assert.doesNotMatch(source, /demo offline/i);
  assert.doesNotMatch(source, /Supabase Auth/i);
  assert.doesNotMatch(source, /FastAPI/i);
  assert.doesNotMatch(source, /Android Studio Emulator/i);
  assert.doesNotMatch(source, /LDPlayer/i);
  assert.doesNotMatch(source, /schema\.sql/i);
  assert.doesNotMatch(source, /flow app/i);
  assert.doesNotMatch(source, /Dịch vụ AI dự phòng/i);
  assert.doesNotMatch(source, /Class AI/i);
});
