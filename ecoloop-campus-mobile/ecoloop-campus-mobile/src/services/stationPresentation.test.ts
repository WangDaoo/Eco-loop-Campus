import assert from 'node:assert/strict';
import test from 'node:test';
import { BinStation } from '../types';
import {
  getStationCapacityLevel,
  getStationCoordinate,
  getStationMapRegion,
  getStationStatusLabel,
  getStationSubtitle,
  getVisibleMapStations
} from './stationPresentation';

const stations: BinStation[] = [
  {
    id: 'station-e1',
    name: 'Trạm E1',
    binGroup: 'Tái chế',
    location: 'Sảnh E1',
    building: 'E1',
    floor: '1',
    qrCode: 'ECL-ST-STATION-E1',
    status: 'open',
    capacity: 62,
    latitude: 10.7627,
    longitude: 106.6822
  },
  {
    id: 'station-caf',
    name: 'Canteen xanh',
    binGroup: 'Tái chế',
    location: 'Khu canteen',
    building: 'CAF',
    floor: '1',
    qrCode: 'ECL-ST-STATION-CAF',
    status: 'full',
    capacity: 91,
    latitude: 10.7615,
    longitude: 106.6851
  },
  {
    id: 'station-missing',
    name: 'Trạm chưa định vị',
    binGroup: 'Còn lại',
    location: 'Kho tạm',
    building: 'STO',
    floor: 'B1',
    qrCode: 'ECL-ST-STATION-MISS',
    status: 'maintenance',
    capacity: 20
  }
];

test('station presentation maps backend status into Vietnamese labels', () => {
  assert.equal(getStationStatusLabel('open'), 'Hoạt động');
  assert.equal(getStationStatusLabel('full'), 'Đầy');
  assert.equal(getStationStatusLabel('maintenance'), 'Bảo trì');
  assert.equal(getStationStatusLabel('closed'), 'Tạm đóng');
});

test('station presentation flags capacity warning from real bin capacity', () => {
  assert.equal(getStationCapacityLevel({ ...stations[0], capacity: 84 }), 'normal');
  assert.equal(getStationCapacityLevel({ ...stations[0], capacity: 85 }), 'warning');
  assert.equal(getStationCapacityLevel(stations[1]), 'full');
});

test('station map uses only bins with real coordinates and computes campus region', () => {
  assert.deepEqual(getStationCoordinate(stations[0]), { latitude: 10.7627, longitude: 106.6822 });
  assert.equal(getStationCoordinate(stations[2]), undefined);
  assert.deepEqual(getVisibleMapStations(stations).map(item => item.id), ['station-e1', 'station-caf']);

  const region = getStationMapRegion(stations);
  assert.equal(Number(region.latitude.toFixed(4)), 10.7621);
  assert.equal(Number(region.longitude.toFixed(4)), 106.6837);
  assert.ok(region.latitudeDelta >= 0.006);
  assert.ok(region.longitudeDelta >= 0.006);
});

test('station subtitle keeps location, building, floor, bin group and capacity readable', () => {
  assert.equal(getStationSubtitle(stations[1]), 'Khu canteen - Tòa CAF, tầng 1 - Tái chế - 91% sức chứa');
});
