import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'CampusMapSVG.tsx'), 'utf8');

test('CampusMapSVG exposes visible zoom controls for mobile map use', () => {
  assert.match(source, /zoomIn/);
  assert.match(source, /zoomOut/);
  assert.match(source, /accessibilityLabel="Phóng to bản đồ"/);
  assert.match(source, /accessibilityLabel="Thu nhỏ bản đồ"/);
  assert.match(source, />\+<\/Text>/);
  assert.match(source, />-<\/Text>/);
});

test('CampusMapSVG pinch zoom keeps refs in sync instead of reading stale React state', () => {
  assert.match(source, /applyViewport/);
  assert.doesNotMatch(source, /lastScale\.current\s*=\s*scale/);
  assert.doesNotMatch(source, /lastTx\.current\s*=\s*tx/);
  assert.doesNotMatch(source, /lastTy\.current\s*=\s*ty/);
});

test('CampusMapSVG only draws station markers with backend map coordinates', () => {
  assert.doesNotMatch(source, /const FIXED/);
  assert.doesNotMatch(source, /FALLBACKS/);
  assert.match(source, /typeof s\.mapX !== 'number' \|\| typeof s\.mapY !== 'number'/);
  assert.match(source, /if \(!position\) return null/);
});

test('CampusMapSVG focuses tapped stations and supports stronger Leaflet-like zoom', () => {
  assert.match(source, /const MIN_SCALE = 1;/);
  assert.match(source, /const INIT_SCALE = 1\.45;/);
  assert.match(source, /const MAX_SCALE = 8;/);
  assert.match(source, /const ZOOM_STEP = 1\.35;/);
  assert.match(source, /function zoomAroundCenter/);
  assert.match(source, /function centerOnStation\(station: BinStation/);
  assert.match(source, /Math\.max\(lastScale\.current, 3\)/);
  assert.match(source, /function selectStationMarker\(station: BinStation\)/);
  assert.match(source, /centerOnStation\(station\);[\s\S]*onSelect\?\.\(station\)/);
  assert.match(source, /onPress=\{\(\) => selectStationMarker\(s\)\}/);
});

test('CampusMapSVG keeps map vectors sharp and selected markers visually stronger', () => {
  assert.match(source, /selectedStationId\?: string/);
  assert.match(source, /const isSelected = s\.id === selectedStationId/);
  assert.match(source, /r=\{isSelected \? 20 : 14\}/);
  assert.match(source, /strokeWidth=\{isSelected \? 3 : 2\}/);
  assert.match(source, /<G transform=\{mapTransform\}>/);
  assert.doesNotMatch(source, /style=\{\{\s*transform:\s*\[/);
});
