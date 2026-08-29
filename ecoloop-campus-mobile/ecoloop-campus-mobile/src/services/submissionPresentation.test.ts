import assert from 'node:assert/strict';
import test from 'node:test';
import { WasteType } from '../types';
import { getSubmissionStatusLabel, getSubmissionStatusTone, getWasteTypeDisplayName, getWasteUnitDisplayLabel } from './submissionPresentation';

const wasteTypes: WasteType[] = [
  { id: 'plastic-pet', name: 'Nhựa PET', unit: 'kg', pointPerUnit: 10, recycleMethod: '', status: 'active' }
];

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
  assert.equal(getWasteTypeDisplayName(wasteTypes, 'plastic-bottle'), 'Nhựa PET');
  assert.equal(getWasteTypeDisplayName(wasteTypes, 'plastic-pet'), 'Nhựa PET');
});

test('normalizes common unaccented waste type names from Supabase for mobile display', () => {
  const liveRows: WasteType[] = [
    { id: 'plastic-bottle', name: 'Chai nhua', unit: 'item', pointPerUnit: 10, recycleMethod: '', status: 'active' },
    { id: 'paper', name: 'Giay sach', unit: 'kg', pointPerUnit: 40, recycleMethod: '', status: 'active' },
    { id: 'metal-can', name: 'Lon kim loai', unit: 'item', pointPerUnit: 12, recycleMethod: '', status: 'active' },
    { id: 'organic', name: 'Rac huu co', unit: 'kg', pointPerUnit: 20, recycleMethod: '', status: 'active' }
  ];

  assert.equal(getWasteTypeDisplayName(liveRows, 'plastic-bottle'), 'Chai nhựa');
  assert.equal(getWasteTypeDisplayName(liveRows, 'paper'), 'Giấy sạch');
  assert.equal(getWasteTypeDisplayName(liveRows, 'metal-can'), 'Lon kim loại');
  assert.equal(getWasteTypeDisplayName(liveRows, 'organic'), 'Rác hữu cơ');
});

test('localizes waste units for mobile cards', () => {
  assert.equal(getWasteUnitDisplayLabel('item'), 'cái');
  assert.equal(getWasteUnitDisplayLabel('kg'), 'kg');
  assert.equal(getWasteUnitDisplayLabel('g'), 'g');
});