import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

test('Android gradle wrapper keeps classpath variable intact for release builds', () => {
  const wrapper = readFileSync(resolve(__dirname, '../../android/gradlew.bat'), 'utf8');

  assert.match(wrapper, /set CLASSPATH=gradle\\wrapper\\gradle-wrapper\.jar/);
  assert.match(wrapper, /-classpath "%CLASSPATH%" org\.gradle\.wrapper\.GradleWrapperMain/);
  assert.doesNotMatch(wrapper, /-classpath "%CLASSPATH\s+%"/);
});
