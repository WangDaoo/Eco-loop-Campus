import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSubmitAiSuggestion } from './submitAiFlow';
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
