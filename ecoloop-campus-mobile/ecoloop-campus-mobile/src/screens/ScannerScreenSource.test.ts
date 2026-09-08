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
  assert.match(source, /selectedSubmission\?\.status === 'PENDING_REVIEW'[\s\S]*selectedSubmission\?\.manualReviewUnlockedAt/);
  assert.match(source, /title=\{canConfirmSubmission \? 'Xác nhận & Cộng điểm' : 'Chưa scan hợp lệ'\}/);
  assert.match(source, /disabled=\{!canConfirmSubmission\}/);
});

test('ScannerScreen opens queue details without fabricating a successful QR scan', () => {
  assert.match(source, /openSubmissionForReview/);
  assert.match(source, /openPendingSubmission/);
  assert.match(source, /openPendingSubmission = \(submission:[\s\S]*openSubmissionForReview\(submission\)/);
  assert.match(source, /onPress=\{\(\) => openPendingSubmission\(item\)\}/);
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

test('ScannerScreen keeps Vietnamese UI text readable', () => {
  assert.doesNotMatch(source, mojibakePattern);
  assert.match(source, /Xác nhận QR Giao dịch/);
  assert.match(source, /Ảnh minh chứng sinh viên/);
});

test('ScannerScreen retries proof image picker with legacy mode when Android PhotoPicker fails', () => {
  assert.match(source, /launchImageLibraryWithFallback/);
  assert.doesNotMatch(source, /ImagePicker\.launchImageLibraryAsync\(\{ mediaTypes: ImagePicker\.MediaTypeOptions\.Images, quality: 0\.72 \}\)/);
});

test('ScannerScreen reports proof upload errors instead of failing silently before confirm', () => {
  assert.match(source, /uploadReviewerProofSafely/);
  assert.match(source, /return await uploadReviewerProofIfSelected\(\)/);
  assert.match(source, /Không lưu được ảnh minh chứng/);
  assert.match(source, /if \(!\(await uploadReviewerProofSafely\(\)\)\) return;/);
});

test('ScannerScreen keeps QR primary and only unlocks manual review with a reason', () => {
  assert.match(source, /unlockManualReview/);
  assert.match(source, /Không thể quét QR/);
  assert.match(source, /Nhập lý do không thể quét QR/);
  assert.match(source, /selectedSubmission\?\.status === 'PENDING_REVIEW'/);
  assert.doesNotMatch(source, /loadQr\(submission\.qrToken\)/);
});

test('ScannerScreen shows student proof and requires an explicit rejection reason', () => {
  assert.match(source, /STUDENT_PROOF/);
  assert.match(source, /Ảnh minh chứng sinh viên/);
  assert.match(source, /Lý do từ chối là bắt buộc/);
  assert.doesNotMatch(source, /Không đạt điều kiện tiếp nhận/);
});

test('ScannerScreen reconciles the all-station pending count with the duty-station count', () => {
  assert.match(source, /allPendingSubmissions/);
  assert.match(source, /pendingAtDuty\.length/);
  assert.match(source, /allPendingSubmissions\.length/);
  assert.match(source, /Giao dịch ở trạm khác/);
});
