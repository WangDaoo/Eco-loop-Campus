import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'CampusLeafletMap.tsx'), 'utf8');

test('CampusLeafletMap renders the offline Leaflet HTML inside WebView', () => {
  assert.match(source, /from 'react-native-webview'/);
  assert.match(source, /buildCampusMapHtml\(stations, selectedStationId\)/);
  assert.match(source, /originWhitelist=\{\['\*'\]\}/);
  assert.match(source, /javaScriptEnabled/);
});

test('CampusLeafletMap handles station selection messages from Leaflet', () => {
  assert.match(source, /SELECT_STATION/);
  assert.match(source, /JSON\.parse\(event\.nativeEvent\.data\)/);
  assert.match(source, /stations\.find\(station => station\.id === message\.stationId\)/);
  assert.match(source, /onSelect\?\.\(station\)/);
});

test('CampusLeafletMap focuses the selected station from mobile list taps', () => {
  assert.match(source, /focusRequestId/);
  assert.match(source, /injectJavaScript/);
  assert.match(source, /window\.focusStation/);
  assert.match(source, /selectedStationId/);
});

test('CampusLeafletMap reports touch ownership so parent page does not scroll while panning the map', () => {
  assert.match(source, /onGestureActiveChange\?: \(active: boolean\) => void/);
  assert.match(source, /onTouchStart=\{\(\) => onGestureActiveChange\?\.\(true\)\}/);
  assert.match(source, /onTouchEnd=\{endMapGesture\}/);
  assert.match(source, /onTouchCancel=\{endMapGesture\}/);
});
