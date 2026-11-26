import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dutyStationStorageKey,
  loadDutyStationPreference,
  resolveDutyStationId,
  saveDutyStationPreference
} from './dutyStation';
import { isStationAcceptingWaste } from './stationPresentation';

const stations = [
  { id: 'st-open-a', status: 'open' as const },
  { id: 'st-open-b', status: 'open' as const },
  { id: 'st-full', status: 'full' as const },
  { id: 'st-maint', status: 'maintenance' as const }
];

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    async setItem(key: string, value: string) {
      data.set(key, value);
    },
    async removeItem(key: string) {
      data.delete(key);
    }
  };
}

test('only open stations accept waste submissions', () => {
  assert.equal(isStationAcceptingWaste({ status: 'open' }), true);
  assert.equal(isStationAcceptingWaste({ status: 'full' }), false);
  assert.equal(isStationAcceptingWaste({ status: 'maintenance' }), false);
  assert.equal(isStationAcceptingWaste({ status: 'closed' }), false);
  assert.equal(isStationAcceptingWaste(undefined), false);
});

test('duty station keeps the current choice while it still exists, even when it becomes full', () => {
  assert.equal(resolveDutyStationId(stations, { current: 'st-full', persisted: 'st-open-a' }), 'st-full');
});

test('duty station restores a persisted choice only when that station is still open', () => {
  assert.equal(resolveDutyStationId(stations, { persisted: 'st-open-b' }), 'st-open-b');
  assert.equal(resolveDutyStationId(stations, { persisted: 'st-maint' }), '');
  assert.equal(resolveDutyStationId(stations, { current: 'st-deleted', persisted: 'st-open-a' }), 'st-open-a');
});

test('duty station never guesses between several open stations', () => {
  assert.equal(resolveDutyStationId(stations), '');
  assert.equal(resolveDutyStationId([stations[0], stations[2]]), 'st-open-a');
  assert.equal(resolveDutyStationId([]), '');
});

test('duty station preference is stored per user and tolerates storage failures', async () => {
  const storage = memoryStorage();
  await saveDutyStationPreference(storage, 'vol-1', 'st-open-a');
  assert.equal(storage.data.get(dutyStationStorageKey('vol-1')), 'st-open-a');
  assert.equal(await loadDutyStationPreference(storage, 'vol-1'), 'st-open-a');
  assert.equal(await loadDutyStationPreference(storage, 'vol-2'), '');

  await saveDutyStationPreference(storage, 'vol-1', '');
  assert.equal(storage.data.has(dutyStationStorageKey('vol-1')), false);

  const broken = {
    async getItem(): Promise<string | null> {
      throw new Error('disk');
    },
    async setItem() {
      throw new Error('disk');
    },
    async removeItem() {
      throw new Error('disk');
    }
  };
  assert.equal(await loadDutyStationPreference(broken, 'vol-1'), '');
  await saveDutyStationPreference(broken, 'vol-1', 'st-open-a');
});
