import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'SplashScreen.tsx'), 'utf8');

test('SplashScreen shows mascot logo with Vietnamese tagline', () => {
  assert.match(source, /Image/);
  assert.match(source, /mascot_2\.png/);
  assert.match(source, /Tái chế thông minh\. Sống xanh hơn\./);
  assert.doesNotMatch(source, /Recycle smarter\. Earn greener\./);
  assert.doesNotMatch(source, /logoText/);
});

test('SplashScreen keeps Vietnamese text clean', () => {
  assert.doesNotMatch(source, /Ã|Â|Ä/);
  assert.match(source, /Eco-loop Campus/);
});