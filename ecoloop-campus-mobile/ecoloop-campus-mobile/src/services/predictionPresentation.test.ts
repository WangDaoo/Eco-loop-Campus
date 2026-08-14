import assert from 'node:assert/strict';
import test from 'node:test';
import { PredictionRecord } from '../types';
import {
  formatPredictionConfidence,
  getPredictionStatusText,
  getPredictionStatusTone,
  getPredictionSubtitle
} from './predictionPresentation';

const prediction: PredictionRecord = {
  id: 'ai-1',
  className: 'plastic',
  confidence: 0.876,
  source: 'camera',
  timestamp: new Date('2026-08-02T07:00:00.000Z'),
  binGroup: 'Tái chế',
  status: 'pending',
  userId: 'student-1',
  binId: 'station-e1',
  imageName: 'bottle.jpg'
};

test('prediction presentation maps admin review status to Vietnamese copy', () => {
  assert.equal(getPredictionStatusText('pending'), 'Chờ duyệt');
  assert.equal(getPredictionStatusText('approved'), 'Đã duyệt');
  assert.equal(getPredictionStatusText('rejected'), 'Bị từ chối');
});

test('prediction presentation provides visual tones without relying on color alone', () => {
  assert.equal(getPredictionStatusTone('pending'), 'warning');
  assert.equal(getPredictionStatusTone('approved'), 'success');
  assert.equal(getPredictionStatusTone('rejected'), 'danger');
});

test('prediction presentation formats confidence and subtitle from realtime row', () => {
  assert.equal(formatPredictionConfidence(0.876), '88% tin cậy');
  assert.equal(formatPredictionConfidence(2), '100% tin cậy');
  assert.equal(getPredictionSubtitle(prediction, 'Trạm E1'), 'Tái chế - 88% tin cậy - Trạm E1');
});
