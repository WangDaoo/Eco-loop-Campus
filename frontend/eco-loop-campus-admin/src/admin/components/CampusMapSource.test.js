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
