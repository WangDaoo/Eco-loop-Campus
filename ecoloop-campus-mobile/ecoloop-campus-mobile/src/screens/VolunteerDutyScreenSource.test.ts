import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'VolunteerDutyScreen.tsx'), 'utf8');

test('VolunteerDutyScreen renders recent QR scan logs from context', () => {
  assert.match(source, /qrScanLogs/);
  assert.match(source, /Log quét QR gần đây/);
  assert.match(source, /scannedAt/);
});

test('VolunteerDutyScreen keeps Vietnamese UI text readable', () => {
  assert.doesNotMatch(source, /Há»|Háº|Ä|Ä‘|ChÆ|tráº|viÃªn|quÃ©t|gian láº­n|khÃ´ng/);
  assert.match(source, /Ca trực tình nguyện viên/);
  assert.match(source, /Hợp lệ/);
  assert.match(source, /Nghi gian lận/);
});

test('VolunteerDutyScreen only lets volunteers pick stations that accept waste and hides expired codes', () => {
  assert.match(source, /getPendingDutySubmissions\(submissions, dutyStationId\)/);
  assert.match(source, /isStationAcceptingWaste\(station\)/);
  assert.match(source, /disabled=\{!canPick\}/);
  assert.match(source, /chưa nhận ca/);
  assert.match(source, /Chọn một trạm đang hoạt động/);
});
