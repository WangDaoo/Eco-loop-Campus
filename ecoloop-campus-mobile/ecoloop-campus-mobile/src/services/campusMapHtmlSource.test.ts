import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'campusMapHtml.ts'), 'utf8');

test('campusMapHtml uses backend map_x/map_y as the only marker source', () => {
  assert.match(source, /hasMapPosition/);
  assert.match(source, /stations\.filter\(hasMapPosition\)/);
  assert.doesNotMatch(source, /fixedPositions/);
  assert.doesNotMatch(source, /fallbackPositions/);
});

test('campusMapHtml exposes Leaflet focus behavior like the web map', () => {
  assert.match(source, /STATION_FOCUS_ZOOM = 19/);
  assert.match(source, /var STATION_FOCUS_ZOOM = \$\{STATION_FOCUS_ZOOM\}/);
  assert.match(source, /function focusStation\(stationId\)/);
  assert.match(source, /map\.flyTo\(stationLatLng\(station\), Math\.max\(map\.getZoom\(\), STATION_FOCUS_ZOOM\)/);
  assert.match(source, /window\.focusStation=focusStation/);
});

test('campusMapHtml keeps selected marker styling and reset controls', () => {
  assert.match(source, /selectedStationId/);
  assert.match(source, /is-selected/);
  assert.match(source, /Căn giữa/);
  assert.doesNotMatch(source, /Căn giữa campus/);
  assert.match(source, /zoomControl:true/);
});

test('campusMapHtml scales station markers with Leaflet zoom level', () => {
  assert.match(source, /function markerScaleForZoom\(zoom\)/);
  assert.match(source, /--pin-scale/);
  assert.match(source, /map\.on\("zoom zoomend", updateMarkerScale\)/);
  assert.match(source, /updateMarkerScale\(\);/);
  assert.match(source, /transform:scale\(var\(--pin-scale,1\)\)/);
  assert.match(source, /transform:scale\(calc\(var\(--pin-scale,1\) \* 1\.18\)\)/);
});

test('campusMapHtml hides the default Leaflet attribution label in mobile app', () => {
  assert.match(source, /attributionControl:false/);
  assert.match(source, /\.leaflet-control-attribution\{display:none!important\}/);
});
