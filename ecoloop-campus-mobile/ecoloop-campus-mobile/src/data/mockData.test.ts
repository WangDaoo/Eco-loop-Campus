import assert from 'node:assert/strict';
import test from 'node:test';
import { mockMissions, mockRewards, mockStations, mockSubmissions, mockWasteTypes } from './mockData';

test('mock submissions reference visible waste type labels', () => {
  const wasteTypeIds = new Set(mockWasteTypes.map(item => item.id));
  const missingWasteTypeIds = mockSubmissions
    .map(item => item.wasteTypeId)
    .filter(wasteTypeId => !wasteTypeIds.has(wasteTypeId));

  assert.deepEqual(missingWasteTypeIds, []);
});

test('mock data visible labels are localized for mobile audit screens', () => {
  assert.equal(mockWasteTypes[0].name, 'Nhựa PET');
  assert.equal(mockRewards[0].title, 'Cà phê canteen');
  assert.equal(mockMissions[0].title, 'Gửi rác tái chế 3 lần');
  assert.equal(mockStations[0].name, 'Trạm thu gom E1');
});
