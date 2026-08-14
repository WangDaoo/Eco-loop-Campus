import assert from 'node:assert/strict';
import test from 'node:test';
import { createAiRuntime } from './aiRuntime';

test('AI runtime uses on-device engine first when enabled and available', async () => {
  let remoteCalls = 0;
  const runtime = createAiRuntime({
    mode: 'local-first',
    localEngine: {
      isAvailable: () => true,
      predictImage: async () => ({ className: 'paper', confidence: 0.88, confidencePercent: 88, runtime: 'local' })
    },
    remoteEngine: {
      predictImage: async () => {
        remoteCalls += 1;
        return { className: 'plastic', confidence: 0.7, confidencePercent: 70 };
      }
    }
  });

  const result = await runtime.predictImage({ uri: 'file:///tmp/paper.jpg' });

  assert.equal(result.className, 'paper');
  assert.equal(result.runtime, 'local');
  assert.equal(remoteCalls, 0);
});

test('AI runtime falls back to FastAPI when on-device engine is unavailable', async () => {
  const runtime = createAiRuntime({
    mode: 'local-first',
    localEngine: {
      isAvailable: () => false,
      predictImage: async () => {
        throw new Error('should not call local');
      }
    },
    remoteEngine: {
      predictImage: async () => ({ className: 'plastic', confidence: 0.72, confidencePercent: 72 })
    }
  });

  const result = await runtime.predictImage({ uri: 'file:///tmp/bottle.jpg' });

  assert.equal(result.className, 'plastic');
  assert.equal(result.runtime, 'remote');
  assert.equal(result.fallbackReason, 'On-device AI chưa khả dụng trong runtime hiện tại.');
});

test('AI runtime falls back to FastAPI when on-device prediction fails', async () => {
  const runtime = createAiRuntime({
    mode: 'local-first',
    localEngine: {
      isAvailable: () => true,
      predictImage: async () => {
        throw new Error('TFLite model load failed');
      }
    },
    remoteEngine: {
      predictImage: async () => ({ className: 'metal', confidence: 0.66, confidencePercent: 66 })
    }
  });

  const result = await runtime.predictImage({ uri: 'file:///tmp/can.jpg' });

  assert.equal(result.className, 'metal');
  assert.equal(result.runtime, 'remote');
  assert.match(result.fallbackReason ?? '', /TFLite model load failed/);
});
