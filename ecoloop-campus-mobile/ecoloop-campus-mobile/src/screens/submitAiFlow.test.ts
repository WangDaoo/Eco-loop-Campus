import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSubmitAiSuggestion,
  ensureSubmissionPhotoUrl,
  estimateSubmissionPoints,
  findRestorableSubmission,
  toSubmissionPhoto
} from './submitAiFlow';
import { WasteType } from '../types';

const wasteTypes: WasteType[] = [
  { id: 'plastic-bottle', name: 'Chai nhua', unit: 'item', pointPerUnit: 10, recycleMethod: 'Lam sach', status: 'active' }
];

test('AI suggestion still returns when saving prediction to Supabase fails', async () => {
  const result = await buildSubmitAiSuggestion({
    asset: { uri: 'file:///tmp/bottle.jpg', fileName: 'bottle.jpg', mimeType: 'image/jpeg' },
    source: 'upload',
    stationId: 'bin-1',
    wasteTypes,
    predictImage: async () => ({ className: 'plastic', confidence: 0.91, confidencePercent: 91 }),
    saveAiPrediction: async () => {
      throw new Error('storage timeout');
    },
    suggestWasteTypeFromClass: () => wasteTypes[0],
    messageOf: error => error instanceof Error ? error.message : String(error)
  });

  assert.equal(result.predictedClass, 'Nhựa');
  assert.equal(result.predictionId, undefined);
  assert.equal(result.wasteType?.id, 'plastic-bottle');
  assert.match(result.saveWarning ?? '', /AI đã nhận diện thành công/);
  assert.match(result.saveWarning ?? '', /storage timeout/);
  assert.equal(result.sourceUri, undefined);
});


test('AI suggestion keeps runtime metadata so the UI can prove on-device inference', async () => {
  const result = await buildSubmitAiSuggestion({
    asset: { uri: 'file:///tmp/paper.jpg', fileName: 'paper.jpg', mimeType: 'image/jpeg' },
    source: 'upload',
    stationId: 'bin-1',
    wasteTypes,
    predictImage: async () => ({ className: 'plastic', confidence: 0.91, confidencePercent: 91, runtime: 'local' }),
    saveAiPrediction: async () => undefined,
    suggestWasteTypeFromClass: () => wasteTypes[0],
    messageOf: error => error instanceof Error ? error.message : String(error)
  });

  assert.equal(result.runtime, 'local');
});

test('AI suggestion displays Vietnamese class names even when no waste type matches', async () => {
  const result = await buildSubmitAiSuggestion({
    asset: { uri: 'file:///tmp/battery.jpg', fileName: 'battery.jpg', mimeType: 'image/jpeg' },
    source: 'upload',
    stationId: 'bin-1',
    wasteTypes: [],
    predictImage: async () => ({ className: 'battery', confidence: 0.75, confidencePercent: 75, runtime: 'remote' }),
    saveAiPrediction: async () => undefined,
    suggestWasteTypeFromClass: () => undefined,
    messageOf: error => error instanceof Error ? error.message : String(error)
  });

  assert.equal(result.className, 'battery');
  assert.equal(result.predictedClass, 'Pin / rác nguy hại');
  assert.match(result.note ?? '', /Pin \/ rác nguy hại/);
  assert.doesNotMatch(result.note ?? '', /map|Class AI/i);
});

test('submission photo uses the AI-saved upload when available and uploads the raw photo otherwise', async () => {
  const uploads: Array<{ imageUri: string; imageName?: string; mimeType?: string }> = [];
  const upload = async (input: { imageUri: string; imageName?: string; mimeType?: string }) => {
    uploads.push(input);
    return '/uploads/predictions/2026-11-26/raw.jpg';
  };

  const saved = { ...toSubmissionPhoto({ uri: 'file:///tmp/a.jpg' }), uploadedUrl: '/uploads/predictions/2026-11-26/ai.jpg' };
  assert.equal(await ensureSubmissionPhotoUrl(saved, upload), '/uploads/predictions/2026-11-26/ai.jpg');
  assert.equal(uploads.length, 0);

  const raw = toSubmissionPhoto({ uri: 'file:///tmp/b.png', fileName: 'b.png', mimeType: 'image/png' });
  assert.equal(await ensureSubmissionPhotoUrl(raw, upload), '/uploads/predictions/2026-11-26/raw.jpg');
  assert.deepEqual(uploads, [{ imageUri: 'file:///tmp/b.png', imageName: 'b.png', mimeType: 'image/png' }]);

  await assert.rejects(() => ensureSubmissionPhotoUrl(null, upload), /chụp ảnh hoặc tải ảnh rác/);
});

test('estimated Ecopoint matches the backend ceil formula without floating point noise', async () => {
  assert.equal(estimateSubmissionPoints(1.5, 10), 15);
  assert.equal(estimateSubmissionPoints(0.25, 3), 1);
  assert.equal(estimateSubmissionPoints(1.1, 10), 11);
  assert.equal(estimateSubmissionPoints(0.7, 10), 7);
  assert.equal(estimateSubmissionPoints(0, 10), 0);
  assert.equal(estimateSubmissionPoints(Number.NaN, 10), 0);
  assert.equal(estimateSubmissionPoints(2, undefined), 0);
});

test('restorable submission is the newest unexpired QR of the signed-in student', async () => {
  const now = new Date('2026-11-26T10:00:00Z');
  const base = { binId: 'bin-1', wasteTypeId: 'paper', quantity: 1, unit: 'kg' as const, qrToken: 'T' };
  const items = [
    { ...base, id: 'old-active', userId: 'stu-1', status: 'CREATED' as const, createdAt: new Date('2026-11-26T09:30:00Z'), expiredAt: new Date('2026-11-26T10:15:00Z') },
    { ...base, id: 'new-active', userId: 'stu-1', status: 'QR_SCANNED' as const, createdAt: new Date('2026-11-26T09:50:00Z'), expiredAt: new Date('2026-11-26T10:35:00Z') },
    { ...base, id: 'expired', userId: 'stu-1', status: 'CREATED' as const, createdAt: new Date('2026-11-26T09:55:00Z'), expiredAt: new Date('2026-11-26T09:59:00Z') },
    { ...base, id: 'done', userId: 'stu-1', status: 'POINT_CONFIRMED' as const, createdAt: new Date('2026-11-26T09:58:00Z'), expiredAt: new Date('2026-11-26T10:43:00Z') },
    { ...base, id: 'other-user', userId: 'stu-2', status: 'CREATED' as const, createdAt: new Date('2026-11-26T09:59:00Z'), expiredAt: new Date('2026-11-26T10:44:00Z') }
  ];
  assert.equal(findRestorableSubmission(items, 'stu-1', now)?.id, 'new-active');
  assert.equal(findRestorableSubmission(items, 'stu-3', now), undefined);
  assert.equal(findRestorableSubmission(items, '', now), undefined);
});
