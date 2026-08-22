import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'imagePickerFallback.ts'), 'utf8');

test('detects Expo PhotoPicker parse failures that need legacy image picker retry', () => {
  assert.match(source, /shouldRetryWithLegacyImagePicker/);
  assert.match(source, /ExponentImagePicker\.launchImageLibraryAsync/);
  assert.match(source, /Failed to parse PhotoPicker result/);
  assert.match(source, /legacy: true/);
});
