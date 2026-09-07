const { readFileSync } = require("fs");
const { join } = require("path");

const source = readFileSync(join(__dirname, "CampusMap.js"), "utf8");

test("CampusMap focuses a selected station like Leaflet instead of only changing detail state", () => {
  expect(source).toMatch(/const STATION_FOCUS_ZOOM = 19;/);
  expect(source).toMatch(/const focusStationOnMap = useCallback\(\(station\) =>/);
  expect(source).toMatch(/flyTo\(stationToLatLng\(station\), Math\.max\(map\.getZoom\(\), STATION_FOCUS_ZOOM\)/);
  expect(source).toMatch(/onSelect: station => selectStation\(station, true\)/);
  expect(source).toMatch(/onClick=\{\(\) => selectStation\(station, true\)\}/);
});

test("CampusMap keeps reset bounds separate from station focus", () => {
  expect(source).toMatch(/hasFitInitialBoundsRef/);
  expect(source).toMatch(/latestBoundsRef\.current = bounds/);
  expect(source).toMatch(/if \(!hasFitInitialBoundsRef\.current\)/);
  expect(source).toMatch(/fitBounds\(latestBoundsRef\.current/);
});

test("CampusMap edits bin position by dragging the selected map marker instead of arrow buttons", () => {
  expect(source).toMatch(/draggable: editingStationId === station\.id/);
  expect(source).toMatch(/marker\.on\("dragend", event => onDraftPosition\?\.\(station\.id, latLngToStationPosition\(event\.target\.getLatLng\(\)\)\)\)/);
  expect(source).toMatch(/Kéo marker trên bản đồ/);
  expect(source).not.toMatch(/Di chuyển sang trái|Di chuyển lên trên|Di chuyển xuống dưới|Di chuyển sang phải/);
  expect(source).not.toMatch(/moveDraftPosition/);
});

test("CampusMap keeps edit mode active when dragging the editable marker", () => {
  expect(source).not.toMatch(/marker\.on\("dragstart", \(\) => onSelect\?\.\(station\)\)/);
  expect(source).toMatch(/marker\.on\("dragstart", \(\) => \{\s*if \(editingStationId !== station\.id\) onSelect\?\.\(station\);\s*\}\)/s);
});
