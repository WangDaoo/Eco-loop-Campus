import assert from 'node:assert/strict';
import test from 'node:test';
import { mockWasteTypes } from '../data/mockData';
import { getSubmissionStatusLabel, getSubmissionStatusTone, getWasteTypeDisplayName } from './submissionPresentation';

test('maps recycling submission statuses to Vietnamese labels', () => {
  assert.equal(getSubmissionStatusLabel('CREATED'), 'Chờ tình nguyện viên');
  assert.equal(getSubmissionStatusLabel('QR_SCANNED'), 'Đã quét QR');
  assert.equal(getSubmissionStatusLabel('ACCEPTED'), 'Đã tiếp nhận');
  assert.equal(getSubmissionStatusLabel('REJECTED'), 'Từ chối');
  assert.equal(getSubmissionStatusLabel('PENDING_REVIEW'), 'Chờ admin kiểm tra');
  assert.equal(getSubmissionStatusLabel('POINT_PENDING'), 'Chờ cộng điểm');
  assert.equal(getSubmissionStatusLabel('POINT_CONFIRMED'), 'Đã cộng điểm');
  assert.equal(getSubmissionStatusLabel('EXPIRED'), 'Hết hạn');
  assert.equal(getSubmissionStatusLabel('LOCKED'), 'Đã khóa');
});

test('maps recycling submission statuses to UI tones', () => {
  assert.equal(getSubmissionStatusTone('CREATED'), 'warning');
  assert.equal(getSubmissionStatusTone('QR_SCANNED'), 'info');
  assert.equal(getSubmissionStatusTone('POINT_CONFIRMED'), 'success');
  assert.equal(getSubmissionStatusTone('REJECTED'), 'danger');
  assert.equal(getSubmissionStatusTone('EXPIRED'), 'danger');
});

test('maps legacy waste type ids to current Vietnamese labels', () => {
  assert.equal(getWasteTypeDisplayName(mockWasteTypes, 'plastic-bottle'), 'Nhựa PET');
  assert.equal(getWasteTypeDisplayName(mockWasteTypes, 'plastic-pet'), 'Nhựa PET');
});
