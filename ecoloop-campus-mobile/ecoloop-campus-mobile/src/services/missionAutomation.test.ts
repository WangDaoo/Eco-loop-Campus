import assert from 'node:assert/strict';
import test from 'node:test';
import { missionIdsForFeedback, missionIdsForSubmission } from './missionAutomation';
import { RecyclingSubmission } from '../types';

const baseSubmission: RecyclingSubmission = {
  id: 'sub-1',
  userId: 'student-1',
  binId: 'bin-1',
  wasteTypeId: 'plastic-bottle',
  quantity: 1,
  unit: 'item',
  qrToken: 'ECO-1',
  status: 'CREATED',
  createdAt: new Date(),
  expiredAt: new Date()
};

test('submission creation advances submit mission for any waste type', () => {
  assert.deepEqual(missionIdsForSubmission(baseSubmission), ['submit-3']);
});

test('paper submission also advances paper weekly mission', () => {
  assert.deepEqual(missionIdsForSubmission({ ...baseSubmission, wasteTypeId: 'paper' }), ['submit-3', 'paper-week']);
});

test('student feedback advances feedback-good mission', () => {
  assert.deepEqual(missionIdsForFeedback(), ['feedback-good']);
});