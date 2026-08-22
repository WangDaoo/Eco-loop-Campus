import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalAiService, parseTfliteClassification, rgbBytesToFloatTensor } from './localAiService';

test('local AI service is disabled in Expo Go until a native TFLite runtime is installed', async () => {
  const service = createLocalAiService();
  assert.equal(service.isAvailable(), false);
  await assert.rejects(
    () => service.predictImage({ uri: 'file:///tmp/bottle.jpg' }),
    /AI trên thiết bị chưa sẵn sàng/
  );
});

test('local AI output parser maps model scores to labels and confidence percent', () => {
  const result = parseTfliteClassification(new Float32Array([0.01, 0.02, 0.03, 0.04, 0.9, 0.1, 0.2, 0.3, 0.4, 0.5]));

  assert.equal(result.className, 'glass');
  assert.equal(result.confidence, 0.9);
  assert.equal(result.confidencePercent, 90);
});

test('local AI preprocess converts RGB bytes to normalized float tensor', () => {
  const tensor = rgbBytesToFloatTensor([0, 127.5, 255, 255, 0, 0]);

  assert.deepEqual(Array.from(tensor), [0, 0.5, 1, 1, 0, 0]);
});
