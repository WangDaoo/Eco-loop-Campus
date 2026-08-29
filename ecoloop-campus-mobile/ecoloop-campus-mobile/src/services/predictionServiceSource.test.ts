import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'predictionService.ts'), 'utf8');

test('default prediction service wires the native V2 local AI engine for local-first APK builds', () => {
  assert.match(source, /import\s+\{\s*localAiService\s*\}\s+from\s+['"]\.\/localAiService['"]/);
  assert.match(source, /export\s+const\s+predictionService\s*=\s*createPredictionService\(\{\s*localEngine:\s*localAiService\s*\}\)/);
});
