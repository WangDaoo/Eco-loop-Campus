import { BinStation } from '../types';

export type StationCapacityLevel = 'normal' | 'warning' | 'full';

const fallbackRegion = {
  latitude: 10.7627,
  longitude: 106.6822,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getStationStatusLabel(status: BinStation['status']) {
  switch (status) {
    case 'full':
      return 'Đầy';
    case 'maintenance':
      return 'Bảo trì';
    case 'closed':
      return 'Tạm đóng';
    case 'open':
    default:
      return 'Hoạt động';
  }
}

export function getStationCapacityLevel(station: Pick<BinStation, 'capacity' | 'status'>): StationCapacityLevel {
  if (station.status === 'full' || station.capacity >= 95) return 'full';
  if (station.capacity >= 85) return 'warning';
  return 'normal';
}

export function getStationCoordinate(station: Pick<BinStation, 'latitude' | 'longitude'>) {
  if (!isFiniteNumber(station.latitude) || !isFiniteNumber(station.longitude)) return undefined;
  return { latitude: station.latitude, longitude: station.longitude };
}

export function getVisibleMapStations(stations: BinStation[]) {
  return stations.filter(station => Boolean(getStationCoordinate(station)));
}

export function getStationMapRegion(stations: BinStation[]) {
  const coordinates = getVisibleMapStations(stations).map(getStationCoordinate).filter(Boolean) as Array<{
    latitude: number;
    longitude: number;
  }>;
  if (!coordinates.length) return fallbackRegion;

  const latitudes = coordinates.map(item => item.latitude);
  const longitudes = coordinates.map(item => item.longitude);
  const latitude = latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length;
  const longitude = longitudes.reduce((sum, value) => sum + value, 0) / longitudes.length;
  const latitudeDelta = clamp((Math.max(...latitudes) - Math.min(...latitudes)) * 2.4, 0.006, 0.02);
  const longitudeDelta = clamp((Math.max(...longitudes) - Math.min(...longitudes)) * 2.4, 0.006, 0.02);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
}

export function getStationSubtitle(station: BinStation) {
  const building = station.building ? `Tòa ${station.building}` : 'Chưa rõ tòa';
  const floor = station.floor ? `tầng ${station.floor}` : 'chưa rõ tầng';
  return `${station.location} - ${building}, ${floor} - ${station.binGroup} - ${station.capacity}% sức chứa`;
}
