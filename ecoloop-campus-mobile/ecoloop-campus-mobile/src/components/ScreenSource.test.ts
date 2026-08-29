import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'Screen.tsx'), 'utf8');

test('Screen respects real device safe areas and floating tab clearance', () => {
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /BOTTOM_TAB_BAR_HEIGHT\s*=\s*96/);
  assert.match(source, /DEFAULT_BOTTOM_CLEARANCE/);
  assert.match(source, /DEFAULT_BOTTOM_CLEARANCE\s*=\s*BOTTOM_TAB_BAR_HEIGHT\s*\+\s*24/);
  assert.doesNotMatch(source, /FLOATING_TAB_BAR_TOP_GAP/);
  assert.doesNotMatch(source, /FLOATING_TAB_BAR_BODY_HEIGHT/);
  assert.doesNotMatch(source, /DEFAULT_BOTTOM_CLEARANCE\s*=\s*32/);
  assert.doesNotMatch(source, /paddingBottom:\s*220/);
});

test('Screen keeps computed tab clearance after caller content styles', () => {
  assert.match(
    source,
    /contentContainerStyle=\{\[styles\.scrollContent,\s*contentContainerStyle,\s*\{ paddingBottom: bottomPadding \}\]\}/
  );
});

test('Screen lets gesture-heavy children temporarily disable page scrolling', () => {
  assert.match(source, /scrollEnabled\?: boolean/);
  assert.match(source, /scrollEnabled = true/);
  assert.match(source, /<ScrollView[\s\S]*scrollEnabled=\{scrollEnabled\}/);
});
