import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'ScannerScreen.tsx'), 'utf8');
const mojibakePattern = /QuÃ|Tráº|ChÆ|Ä‘|Ã¡|Ã©|Ã´|Ãª|áº|á»/;

test('ScannerScreen shows a clear error when confirmation is blocked by QR validation', () => {
  assert.match(source, /messageOf/);
  assert.match(source, /try \{[\s\S]*await confirmSubmission\(selectedSubmission\.id, parsedQuantity, volunteerNote\)/);
  assert.match(source, /Không xác nhận được/);
});

test('ScannerScreen disables accept action until the QR scan is valid', () => {
  assert.match(source, /canConfirmSubmission/);
  assert.match(source, /selectedSubmission\?\.status === 'QR_SCANNED'/);
  assert.match(source, /title=\{canConfirmSubmission \? 'Xác nhận & Cộng điểm' : 'Chưa scan hợp lệ'\}/);
  assert.match(source, /disabled=\{!canConfirmSubmission\}/);
});

test('ScannerScreen tells volunteers when a scanned QR has expired', () => {
  assert.match(source, /submission\.status === 'EXPIRED'/);
  assert.match(source, /QR đã hết hạn/);
});

test('ScannerScreen reports anti-fraud scan outcomes immediately', () => {
  assert.match(source, /outcome\.result/);
  assert.match(source, /WRONG_STATION/);
  assert.match(source, /ALREADY_USED/);
  assert.match(source, /INVALID_TOKEN/);
  assert.match(source, /QR sai trạm/);
  assert.match(source, /QR đã được sử dụng/);
});

test('ScannerScreen keeps Vietnamese UI text readable', () => {
  assert.doesNotMatch(source, mojibakePattern);
  assert.match(source, /Xác nhận QR Giao dịch/);
  assert.match(source, /Chụp ảnh minh chứng/);
});
