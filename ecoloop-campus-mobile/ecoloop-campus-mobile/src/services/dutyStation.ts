import { BinStation } from '../types';
import { isStationAcceptingWaste } from './stationPresentation';

type DutyStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const DUTY_STATION_KEY_PREFIX = 'ecoloop_duty_station:';

export function dutyStationStorageKey(userId: string) {
  return `${DUTY_STATION_KEY_PREFIX}${userId}`;
}

/**
 * Chọn trạm trực cho tình nguyện viên:
 * - giữ trạm đang chọn nếu trạm còn tồn tại (kể cả khi tạm đầy, để xử lý nốt giao dịch đang chờ);
 * - nếu chưa chọn, khôi phục trạm đã lưu khi trạm đó vẫn đang hoạt động;
 * - nếu chỉ có đúng một trạm hoạt động thì chọn trạm đó;
 * - còn lại để trống để tình nguyện viên tự nhận ca, tránh quét nhầm trạm.
 */
export function resolveDutyStationId(
  stations: Array<Pick<BinStation, 'id' | 'status'>>,
  { current = '', persisted = '' }: { current?: string; persisted?: string } = {}
) {
  if (current && stations.some(station => station.id === current)) return current;
  if (persisted && stations.some(station => station.id === persisted && isStationAcceptingWaste(station))) return persisted;
  const openStations = stations.filter(isStationAcceptingWaste);
  return openStations.length === 1 ? openStations[0].id : '';
}

export async function loadDutyStationPreference(storage: DutyStorage, userId: string) {
  if (!userId) return '';
  try {
    return (await storage.getItem(dutyStationStorageKey(userId))) ?? '';
  } catch {
    return '';
  }
}

export async function saveDutyStationPreference(storage: DutyStorage, userId: string, stationId: string) {
  if (!userId) return;
  try {
    if (stationId) await storage.setItem(dutyStationStorageKey(userId), stationId);
    else await storage.removeItem(dutyStationStorageKey(userId));
  } catch {
    // Lưu lựa chọn trạm chỉ để tiện dùng lại, lỗi lưu trữ không được chặn ca trực.
  }
}
