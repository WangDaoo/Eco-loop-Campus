import assert from 'node:assert/strict';
import test from 'node:test';
import { binGroupForAiClass, createPredictionService, suggestWasteTypeFromClass } from './predictionService';
import { WasteType } from '../types';

class FakeFormData {
  entries: { name: string; value: unknown }[] = [];

  append(name: string, value: unknown) {
    this.entries.push({ name, value });
  }
}

const wasteTypes: WasteType[] = [
  { id: 'plastic-bottle', name: 'Chai nhua', unit: 'item', pointPerUnit: 10, recycleMethod: 'Lam sach', status: 'active' },
  { id: 'paper', name: 'Giay sach', unit: 'kg', pointPerUnit: 40, recycleMethod: 'Giu kho', status: 'active' },
  { id: 'metal-can', name: 'Lon kim loai', unit: 'item', pointPerUnit: 12, recycleMethod: 'Rua sach', status: 'active' },
  { id: 'organic', name: 'Rac huu co', unit: 'kg', pointPerUnit: 20, recycleMethod: 'De rieng', status: 'active' }
];

test('prediction service posts image file to FastAPI /predict and normalizes confidence', async () => {
  const calls: { url: string; init: { method: string; body: FakeFormData } }[] = [];
  const service = createPredictionService({
    baseUrl: 'http://127.0.0.1:8000/',
    FormDataCtor: FakeFormData,
    fetcher: async (url, init) => {
      calls.push({ url, init: init as { method: string; body: FakeFormData } });
      return { ok: true, status: 200, json: async () => ({ class: 'plastic', confidence: 0.9234 }) };
    }
  });

  const result = await service.predictImage({ uri: 'file:///tmp/bottle.jpg', name: 'bottle.jpg', mimeType: 'image/jpeg' });

  assert.equal(calls[0].url, 'http://127.0.0.1:8000/predict');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(calls[0].init.body.entries[0], {
    name: 'file',
    value: { uri: 'file:///tmp/bottle.jpg', name: 'bottle.jpg', type: 'image/jpeg' }
  });
  assert.deepEqual(result, { className: 'plastic', confidence: 0.9234, confidencePercent: 92, runtime: 'remote', fallbackReason: undefined });
});

test('prediction service throws useful message when backend returns an error payload', async () => {
  const service = createPredictionService({
    baseUrl: 'http://127.0.0.1:8000',
    FormDataCtor: FakeFormData,
    fetcher: async () => ({ ok: true, status: 200, json: async () => ({ error: 'Model not loaded' }) })
  });

  await assert.rejects(
    () => service.predictImage({ uri: 'file:///tmp/bottle.jpg', name: 'bottle.jpg', mimeType: 'image/jpeg' }),
    /Model not loaded/
  );
});

test('prediction service defaults to Android Studio Emulator host URL', async () => {
  const previousApiUrl = process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_API_URL;
  const calls: string[] = [];
  const service = createPredictionService({
    FormDataCtor: FakeFormData,
    fetcher: async (url) => {
      calls.push(url);
      return { ok: true, status: 200, json: async () => ({ class: 'paper', confidence: 0.8 }) };
    }
  });

  try {
    await service.predictImage({ uri: 'file:///tmp/paper.jpg', name: 'paper.jpg', mimeType: 'image/jpeg' });
  } finally {
    if (previousApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previousApiUrl;
  }

  assert.equal(calls[0], 'http://10.0.2.2:8000/predict');
});

test('suggestWasteTypeFromClass maps 10 AI classes to current mobile waste types', () => {
  assert.equal(suggestWasteTypeFromClass('plastic', wasteTypes)?.id, 'plastic-bottle');
  assert.equal(suggestWasteTypeFromClass('paper', wasteTypes)?.id, 'paper');
  assert.equal(suggestWasteTypeFromClass('cardboard', wasteTypes)?.id, 'paper');
  assert.equal(suggestWasteTypeFromClass('metal', wasteTypes)?.id, 'metal-can');
  assert.equal(suggestWasteTypeFromClass('biological', wasteTypes)?.id, 'organic');
  assert.equal(suggestWasteTypeFromClass('glass', wasteTypes), undefined);
});

test('binGroupForAiClass maps AI classes into school bin groups', () => {
  assert.equal(binGroupForAiClass('biological'), 'Hữu cơ');
  assert.equal(binGroupForAiClass('paper'), 'Tái chế');
  assert.equal(binGroupForAiClass('cardboard'), 'Tái chế');
  assert.equal(binGroupForAiClass('plastic'), 'Tái chế');
  assert.equal(binGroupForAiClass('glass'), 'Tái chế');
  assert.equal(binGroupForAiClass('metal'), 'Tái chế');
  assert.equal(binGroupForAiClass('battery'), 'Pin / nguy hại');
  assert.equal(binGroupForAiClass('clothes'), 'Còn lại');
  assert.equal(binGroupForAiClass('shoes'), 'Còn lại');
  assert.equal(binGroupForAiClass('trash'), 'Còn lại');
});

test('prediction service can prefer on-device AI and avoid FastAPI when local engine is available', async () => {
  let remoteCalls = 0;
  const service = createPredictionService({
    aiMode: 'local-first',
    localEngine: {
      isAvailable: () => true,
      predictImage: async () => ({ className: 'glass', confidence: 0.81, confidencePercent: 81 })
    },
    FormDataCtor: FakeFormData,
    fetcher: async () => {
      remoteCalls += 1;
      return { ok: true, status: 200, json: async () => ({ class: 'plastic', confidence: 0.6 }) };
    }
  });

  const result = await service.predictImage({ uri: 'file:///tmp/glass.jpg', name: 'glass.jpg', mimeType: 'image/jpeg' });

  assert.equal(result.className, 'glass');
  assert.equal(result.runtime, 'local');
  assert.equal(remoteCalls, 0);
});

test('prediction service falls back to FastAPI when local-first has no native engine', async () => {
  const service = createPredictionService({
    aiMode: 'local-first',
    localEngine: {
      isAvailable: () => false,
      predictImage: async () => {
        throw new Error('should not run');
      }
    },
    FormDataCtor: FakeFormData,
    fetcher: async () => ({ ok: true, status: 200, json: async () => ({ class: 'plastic', confidence: 0.6 }) })
  });

  const result = await service.predictImage({ uri: 'file:///tmp/bottle.jpg', name: 'bottle.jpg', mimeType: 'image/jpeg' });

  assert.equal(result.className, 'plastic');
  assert.equal(result.runtime, 'remote');
  assert.match(result.fallbackReason ?? '', /On-device AI/);
});
