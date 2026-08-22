import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'SubmitScreen.tsx'), 'utf8');
const mojibakePattern = /QuÃ|Tráº|ChÆ|Ä‘|Ã¡|Ã©|Ã´|Ãª|áº|á»/;

test('SubmitScreen saves AI prediction results after FastAPI returns a class', () => {
  assert.match(source, /saveAiPrediction/);
  assert.match(source, /predictionId/);
  assert.match(source, /Đã lưu AI/);
});

test('SubmitScreen keeps a live square station QR camera ready for students', () => {
  assert.match(source, /CameraView/);
  assert.match(source, /useCameraPermissions/);
  assert.match(source, /useIsFocused/);
  assert.match(source, /extractStationQrCode/);
  assert.match(source, /onBarcodeScanned/);
  assert.match(source, /ratio="1:1"/);
  assert.match(source, /useWindowDimensions/);
  assert.match(source, /stationScannerSize\s*=\s*Math\.max\(220,\s*Math\.min\(300,\s*windowWidth - 96\)\)/);
  assert.match(source, /stationScanFrameSize\s*=\s*Math\.min\(210,\s*stationScannerSize - 48\)/);
  assert.match(source, /style=\{\[styles\.stationScannerBox,\s*\{ width:\s*stationScannerSize,\s*height:\s*stationScannerSize \}\]\}/);
  assert.match(source, /style=\{\[styles\.studentScanFrame,\s*\{ width:\s*stationScanFrameSize,\s*height:\s*stationScanFrameSize \}\]\}/);
  assert.doesNotMatch(source, /stationScannerBox:\s*\{[\s\S]*aspectRatio:\s*1/);
  assert.doesNotMatch(source, /stationScannerBox:\s*\{[\s\S]*height:\s*240/);
});

test('SubmitScreen uses a dropdown for manual station selection instead of a horizontal chip list', () => {
  assert.match(source, /stationDropdownOpen/);
  assert.match(source, /selectedStation/);
  assert.match(source, /styles\.stationDropdownButton/);
  assert.match(source, /styles\.stationDropdownMenu/);
  assert.match(source, /setStationDropdownOpen\(!stationDropdownOpen\)/);
  assert.doesNotMatch(source, /<ScrollView horizontal[\s\S]*stations\.map/);
});

test('SubmitScreen station dropdown opens as an overlay without stretching the form', () => {
  assert.match(source, /stationDropdownWrap:\s*\{[\s\S]*position:\s*'relative'[\s\S]*zIndex:\s*30/);
  assert.match(source, /stationDropdownMenu:\s*\{[\s\S]*position:\s*'absolute'[\s\S]*top:\s*76[\s\S]*left:\s*0[\s\S]*right:\s*0/);
  assert.match(source, /stationDropdownMenu:\s*\{[\s\S]*zIndex:\s*40[\s\S]*elevation:\s*12/);
  assert.doesNotMatch(source, /stationDropdownMenu:\s*\{\s*marginTop:\s*8/);
});

test('SubmitScreen retries image library with legacy picker when Android PhotoPicker cannot parse the result', () => {
  assert.match(source, /launchImageLibraryWithFallback/);
  assert.doesNotMatch(source, /ImagePicker\.launchImageLibraryAsync\(\{ mediaTypes: ImagePicker\.MediaTypeOptions\.Images, quality: 0\.75 \}\)/);
});

test('SubmitScreen keeps QR submission flow and readable Vietnamese copy', () => {
  assert.doesNotMatch(source, mojibakePattern);
  assert.match(source, /Tạo mã QR giao dịch dùng một lần/);
  assert.match(source, /Phân loại AI/);
  assert.match(source, /buildSubmitAiSuggestion/);
  assert.match(source, /AI đã nhận diện/);
  assert.match(source, /Chạy trên thiết bị/);
});

test('SubmitScreen explains QR expiry with remaining time instead of a bare clock value', () => {
  assert.match(source, /getSubmissionExpiryInfo/);
  assert.match(source, /Mã QR đã hết hạn/);
  assert.match(source, /Tạo mã QR mới/);
  assert.doesNotMatch(source, /Hết hạn:\s*\{latestSubmission\.expiredAt\.toLocaleTimeString/);
});

test('SubmitScreen QR card uses natural Vietnamese confirmation copy', () => {
  assert.match(source, /Điểm được cộng sau khi lượt gửi rác được xác nhận\./);
  assert.doesNotMatch(source, /Điểm vẫn cần volunteer xác nhận/);
});
