import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'MapScreen.tsx'), 'utf8');

test('MapScreen renders Vietnamese station map UI from presentation helpers', () => {
  assert.doesNotMatch(source, /QuÃ|Tráº|ChÆ|Ä‘|Ã¡|Ã©|Ã´|Ãª|áº|á»/);
  assert.match(source, /Bản đồ GIS campus/);
  assert.match(source, /CampusMapSVG/);
  assert.match(source, /getStationStatusLabel/);
  assert.match(source, /getStationCapacityLevel/);
});

test('MapScreen does not render fallback coordinates for every missing station marker', () => {
  assert.doesNotMatch(source, /station\.latitude \?\? 10\.7627/);
  assert.doesNotMatch(source, /station\.longitude \?\? 106\.6822/);
});
