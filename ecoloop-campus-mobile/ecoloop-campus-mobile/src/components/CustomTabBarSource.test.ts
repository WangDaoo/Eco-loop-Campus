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

test('CustomTabBar does not draw a shadow seam above the rounded bar', () => {
  assert.doesNotMatch(source, /shadowOffset:\s*\{\s*width:\s*0,\s*height:\s*-/);
  assert.doesNotMatch(source, /elevation:\s*(?:[1-9]|[1-9][0-9])/);
  assert.match(source, /overflow:\s*'hidden'/);
});

test('CustomTabBar keeps the outer wrapper transparent so rounded corners do not show a stray edge', () => {
  assert.doesNotMatch(source, /container:\s*\{[^}]*backgroundColor:\s*colors\.ecoNav/s);
  assert.match(source, /navBar:\s*\{[^}]*backgroundColor:\s*colors\.ecoNav/s);
});

test('CustomTabBar uses a straight top edge without rounded menu corners', () => {
  assert.match(source, /borderTopLeftRadius:\s*0/);
  assert.match(source, /borderTopRightRadius:\s*0/);
  assert.doesNotMatch(source, /borderTopLeftRadius:\s*32/);
  assert.doesNotMatch(source, /borderTopRightRadius:\s*32/);
});
