import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'MapScreen.tsx'), 'utf8');

test('MapScreen renders Vietnamese station map UI from presentation helpers', () => {
  assert.doesNotMatch(source, /QuÃ|Tráº|ChÆ|Ä‘|Ã¡|Ã©|Ã´|Ãª|áº|á»/);
  assert.match(source, /Bản đồ/);
  assert.doesNotMatch(source, /Bản đồ GIS campus/);
  assert.match(source, /CampusLeafletMap/);
  assert.doesNotMatch(source, /CampusMapSVG/);
  assert.match(source, /getStationStatusLabel/);
  assert.match(source, /getStationCapacityLevel/);
});

test('MapScreen uses the same pastel pink app background as other mobile pages', () => {
  assert.match(source, /safe:\s*\{\s*flex:\s*1,\s*backgroundColor:\s*colors\.bgPink\s*\}/);
  assert.doesNotMatch(source, /backgroundColor:\s*'#f0faf4'/);
});

test('MapScreen does not render fallback coordinates for every missing station marker', () => {
  assert.doesNotMatch(source, /station\.latitude \?\? 10\.7627/);
  assert.doesNotMatch(source, /station\.longitude \?\? 106\.6822/);
});

test('MapScreen keeps map and station cards in one page scroll so cards are not clipped into white strips', () => {
  assert.match(source, /<Screen\s+scroll[\s\S]*contentContainerStyle=\{styles\.pageContent\}/);
  assert.doesNotMatch(source, /<ScrollView[\s\S]*styles\.scrollArea/);
  assert.doesNotMatch(source, /scrollArea:/);
});

test('MapScreen keeps the map compact enough that station cards do not peek behind the tab bar', () => {
  assert.match(source, /const MAP_CARD_HEIGHT = 280;/);
  assert.match(source, /height:\s*MAP_CARD_HEIGHT/);
  assert.doesNotMatch(source, /height:\s*340/);
});

test('MapScreen keeps selected station synced with realtime bin updates', () => {
  assert.match(source, /useEffect/);
  assert.match(source, /stations\.find\(station => station\.id === selected\.id\)/);
  assert.match(source, /setSelected\(latest \?\? null\)/);
});

test('MapScreen tells users when a backend station has no map position yet', () => {
  assert.match(source, /hasMapPosition/);
  assert.match(source, /Chưa đặt vị trí trên bản đồ/);
});

test('MapScreen removes the small map instruction subtitle from the header', () => {
  assert.doesNotMatch(source, /Kéo để di chuyển · Pinch để zoom · Nhấn marker xem chi tiết/);
  assert.doesNotMatch(source, /styles\.subtitle/);
});

test('MapScreen keeps the mobile map title short without GIS campus wording', () => {
  assert.match(source, />Bản đồ<\/Text>/);
  assert.doesNotMatch(source, /GIS campus/);
});

test('MapScreen asks the Leaflet map to focus when a station row is selected', () => {
  assert.match(source, /focusRequestId/);
  assert.match(source, /setFocusRequestId\(value => value \+ 1\)/);
  assert.match(source, /selectedStationId=\{selected\?\.id\}/);
  assert.match(source, /focusRequestId=\{focusRequestId\}/);
  assert.match(source, /onPress=\{\(\) => selectStation\(s, true\)\}/);
});
