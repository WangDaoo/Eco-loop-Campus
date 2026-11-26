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

test('ScannerScreen uses a square camera preview instead of a rectangle', () => {
  assert.match(source, /useWindowDimensions/);
  assert.match(source, /scannerSize\s*=\s*Math\.max\(220,\s*Math\.min\(300,\s*windowWidth - 96\)\)/);
  assert.match(source, /scanFrameSize\s*=\s*Math\.min\(210,\s*scannerSize - 48\)/);
  assert.match(source, /style=\{\[styles\.scannerBox,\s*\{ width:\s*scannerSize,\s*height:\s*scannerSize \}\]\}/);
  assert.match(source, /ratio="1:1"/);
  assert.match(source, /style=\{\[styles\.targetFrame,\s*\{ width:\s*scanFrameSize,\s*height:\s*scanFrameSize \}\]\}/);
  assert.doesNotMatch(source, /scannerBox:\s*\{[\s\S]*aspectRatio:\s*1/);
  assert.doesNotMatch(source, /scannerBox:\s*\{[\s\S]*height:\s*240/);
});

test('ScannerScreen disables accept action until the QR scan is valid', () => {
  assert.match(source, /canConfirmSubmission/);
  assert.match(source, /selectedSubmission\?\.status === 'QR_SCANNED'/);
  assert.match(source, /title=\{canConfirmSubmission \? 'Xác nhận & Cộng điểm' : 'Chưa scan hợp lệ'\}/);
  assert.match(source, /disabled=\{!canConfirmSubmission \|\| isBusy\}/);
});

test('ScannerScreen reopens QR_SCANNED pending submissions without scanning the QR again', () => {
  assert.match(source, /openSubmissionForReview/);
  assert.match(source, /openPendingSubmission/);
  assert.match(source, /submission\.status === 'QR_SCANNED'/);
  assert.match(source, /onPress=\{\(\) => void openPendingSubmission\(item\)\}/);
  assert.doesNotMatch(source, /onPress=\{\(\) => void loadQr\(item\.qrToken\)\}/);
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

test('ScannerScreen clears stale confirmation state when QR lookup fails', () => {
  assert.match(source, /const clearSubmissionReview = \(\) =>/);
  assert.match(source, /clearSubmissionReview\(\);\s*const rewardToken/);
  assert.match(source, /if \(!submission\) \{\s*clearSubmissionReview\(\)/);
  assert.match(source, /if \(outcome\.result !== 'SUCCESS' \|\| submission\.status !== 'QR_SCANNED'\)/);
});

test('ScannerScreen keeps Vietnamese UI text readable', () => {
  assert.doesNotMatch(source, mojibakePattern);
  assert.match(source, /Xác nhận QR Giao dịch/);
  assert.match(source, /Chụp ảnh minh chứng/);
});

test('ScannerScreen retries proof image picker with legacy mode when Android PhotoPicker fails', () => {
  assert.match(source, /launchImageLibraryWithFallback/);
  assert.doesNotMatch(source, /ImagePicker\.launchImageLibraryAsync\(\{ mediaTypes: ImagePicker\.MediaTypeOptions\.Images, quality: 0\.72 \}\)/);
});

test('ScannerScreen reports proof upload errors instead of failing silently before confirm', () => {
  assert.match(source, /ensureProofImageSafely/);
  assert.match(source, /return await ensureProofImage\(\)/);
  assert.match(source, /Không lưu được ảnh minh chứng/);
  assert.match(source, /if \(!\(await ensureProofImageSafely\(\)\)\) return;/);
});

test('ScannerScreen locks QR loading so repeated camera events only scan once', () => {
  assert.match(source, /scanLockRef = useRef\(false\)/);
  assert.match(source, /if \(scanLockRef\.current\) return;/);
  assert.match(source, /void runQrLoad\(data\)/);
  assert.match(source, /void runQrLoad\(manualQrToken\)/);
  assert.doesNotMatch(source, /void loadQr\(data\)/);
});

test('ScannerScreen requires a duty station and hides expired QR codes from the pending list', () => {
  assert.match(source, /getPendingDutySubmissions\(submissions, dutyStationId\)/);
  assert.match(source, /if \(!dutyStationId\) \{/);
  assert.match(source, /Chưa chọn trạm trực/);
});

test('ScannerScreen resumes a review the same volunteer already started', () => {
  assert.match(source, /canVolunteerActOnSubmission\(submission, currentUser\)/);
  assert.match(source, /submission\.status === 'QR_SCANNED' && canVolunteerActOnSubmission/);
  assert.match(source, /tình nguyện viên khác/);
});

test('ScannerScreen reports reject and review failures and guards every action against double taps', () => {
  assert.match(source, /runBusyAction\('accept'/);
  assert.match(source, /runBusyAction\('reject'/);
  assert.match(source, /runBusyAction\('review'/);
  assert.match(source, /Không từ chối được/);
  assert.match(source, /Không gửi được yêu cầu kiểm tra/);
  assert.match(source, /Từ chối giao dịch\?/);
  assert.match(source, /if \(busyRef\.current\) return;/);
});

test('ScannerScreen closes the review after requesting a recheck and shows the student name', () => {
  assert.match(source, /await requestReview\([\s\S]*?clearSubmissionReview\(\);/);
  assert.match(source, /users\.find\(item => item\.id === selectedSubmission\.userId\)/);
  assert.doesNotMatch(source, /Sinh viên: \{selectedSubmission\.userId\}/);
});
