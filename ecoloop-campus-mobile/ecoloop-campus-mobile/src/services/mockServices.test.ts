import assert from 'node:assert/strict';
import test from 'node:test';
import { RecyclingSubmission, WasteType } from '../types';
import { submissionService } from './mockServices';

const wasteTypes: WasteType[] = [
  { id: 'paper', name: 'Giay sach', unit: 'kg', pointPerUnit: 40, recycleMethod: 'Giu kho', status: 'active' }
];

const createdSubmission: RecyclingSubmission = {
  id: 'sub-created',
  userId: 'student-1',
  binId: 'bin-1',
  wasteTypeId: 'paper',
  quantity: 1,
  unit: 'kg',
  qrToken: 'ECO-CREATED',
  status: 'CREATED',
  createdAt: new Date(Date.now() - 15 * 60 * 1000),
  expiredAt: new Date(Date.now() + 45 * 60 * 1000)
};

test('mock submission service blocks confirmation before a valid QR scan', () => {
  assert.throws(
    () => submissionService.confirm([createdSubmission], createdSubmission.id, 1, 'vol-1', 'Hop le'),
    /QR chua duoc quet hop le/
  );
});

test('mock submission service confirms after QR scan marks the submission', () => {
  const scanned = submissionService.markScanned([createdSubmission], createdSubmission.qrToken);
  const confirmed = submissionService.confirm(scanned, createdSubmission.id, 1.5, 'vol-1', 'Hop le');

  assert.equal(confirmed[0].status, 'POINT_CONFIRMED');
  assert.equal(confirmed[0].actualQuantity, 1.5);
  assert.equal(confirmed[0].verifiedBy, 'vol-1');
});

test('mock submission service marks expired QR submissions during scan', () => {
  const expiredSubmission: RecyclingSubmission = {
    ...createdSubmission,
    id: 'sub-expired',
    qrToken: 'ECO-EXPIRED',
    expiredAt: new Date('2000-01-01T00:45:00.000Z')
  };

  const scanned = submissionService.markScanned([expiredSubmission], expiredSubmission.qrToken);

  assert.equal(scanned[0].status, 'EXPIRED');
});

test('mock submission service creates QR submissions with configured waste unit', () => {
  const submission = submissionService.createSubmission('student-1', { binId: 'bin-1', wasteTypeId: 'paper', quantity: 2 }, wasteTypes);

  assert.equal(submission.unit, 'kg');
  assert.equal(submission.status, 'CREATED');
});
