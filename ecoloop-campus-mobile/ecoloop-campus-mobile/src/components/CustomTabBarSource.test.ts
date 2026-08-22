import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'CustomTabBar.tsx'), 'utf8');

test('CustomTabBar uses safe area insets and stable press targets', () => {
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /BOTTOM_TAB_BAR_HEIGHT/);
  assert.match(source, /const bottomPadding\s*=\s*insets\.bottom/);
  assert.match(source, /Pressable/);
  assert.match(source, /hitSlop/);
  assert.match(source, /paddingHorizontal:\s*0/);
  assert.match(source, /backgroundColor:\s*colors\.ecoNav/);
  assert.doesNotMatch(source, /maxWidth:\s*400/);
  assert.doesNotMatch(source, /FLOATING_TAB_BAR_TOP_GAP/);
  assert.doesNotMatch(source, /centerButton/);
  assert.doesNotMatch(source, /centerItemWrapper/);
  assert.doesNotMatch(source, /centerLabel/);
  assert.doesNotMatch(source, /Math\.max\(insets\.bottom,\s*10\)\s*\+\s*8/);
  assert.doesNotMatch(source, /position:\s*'absolute'/);
  assert.doesNotMatch(source, /top:\s*-[0-9]/);
  assert.doesNotMatch(source, /TouchableOpacity/);
});
