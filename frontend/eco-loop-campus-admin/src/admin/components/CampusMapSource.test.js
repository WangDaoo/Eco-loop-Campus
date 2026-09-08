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

test("CampusMap edits bin position by dragging the selected map marker", () => {
  expect(source).toMatch(/draggable: editingStationId === station\.id/);
  expect(source).toMatch(/marker\.on\("dragend", event => onDraftPosition\?\.\(station\.id, latLngToStationPosition\(event\.target\.getLatLng\(\)\)\)\)/);
  expect(source).toMatch(/kéo marker trên bản đồ/);
  expect(source).not.toMatch(/moveDraftPosition/);
});

test("CampusMap keeps edit mode active when dragging the editable marker", () => {
  expect(source).not.toMatch(/marker\.on\("click", \(\) => onSelect\?\.\(station\)\)/);
  expect(source).toMatch(/marker\.on\("click", \(\) => \{\s*if \(editingStationId !== station\.id\) onSelect\?\.\(station\);\s*\}\)/s);
  expect(source).not.toMatch(/marker\.on\("dragstart", \(\) => onSelect\?\.\(station\)\)/);
  expect(source).toMatch(/marker\.on\("dragstart", \(\) => \{\s*if \(editingStationId !== station\.id\) onSelect\?\.\(station\);\s*\}\)/s);
});

test("CampusMap lets admins drag anywhere on the map while editing a station position", () => {
  expect(source).toMatch(/map\.dragging\.disable\(\)/);
  expect(source).toMatch(/map\.on\("mousedown", startMapPositionDrag\)/);
  expect(source).toMatch(/map\.on\("mousemove", updateMapPositionDraft\)/);
  expect(source).toMatch(/map\.once\("mouseup", stopMapPositionDrag\)/);
  expect(source).toMatch(/setDraftPosition\(latLngToStationPosition\(event\.latlng\)\)/);
});

test("CampusMap provides a gamepad-style position control when drag is unreliable", () => {
  expect(source).toMatch(/const POSITION_NUDGE_STEP = 1;/);
  expect(source).toMatch(/const nudgeDraftPosition = useCallback/);
  expect(source).toMatch(/aria-label="Tay cầm chỉnh vị trí thùng"/);
  expect(source).toMatch(/Di chuyển lên trên/);
  expect(source).toMatch(/Di chuyển sang trái/);
  expect(source).toMatch(/Đưa về vị trí ban đầu/);
  expect(source).toMatch(/Di chuyển sang phải/);
  expect(source).toMatch(/Di chuyển xuống dưới/);
});
