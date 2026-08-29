import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBackendAssetUrl,
  createBackendAvatarService,
  normalizeBackendAvatarPreset,
} from './backendAvatarService';

test('backend avatar service lists presets from FastAPI backend', async () => {
  const calls: string[] = [];
  const service = createBackendAvatarService({
    baseUrl: 'https://api.example.test/',
    fetcher: async url => {
      calls.push(url);
      return {
        ok: true,
        json: async () => [
          { key: 'e2e-avatar-test', label: 'E2E Avatar Test', imageUrl: '/uploads/avatars/e2e/avatar.png' },
        ],
      };
    },
  });

  const avatars = await service.listAvatarPresets();

  assert.deepEqual(calls, ['https://api.example.test/api/avatar-presets']);
  assert.equal(avatars.length, 1);
  assert.equal(avatars[0].key, 'e2e-avatar-test');
  assert.equal(avatars[0].label, 'E2E Avatar Test');
  assert.equal(avatars[0].imageUrl, 'https://api.example.test/uploads/avatars/e2e/avatar.png');
});

test('backend avatar service keeps absolute avatar image URLs unchanged', () => {
  assert.equal(buildBackendAssetUrl('https://cdn.example/avatar.png', 'https://api.example.test'), 'https://cdn.example/avatar.png');
  assert.equal(buildBackendAssetUrl('', 'https://api.example.test'), undefined);
});

test('backend avatar service maps backend rows to mobile avatar presets without fake list data', () => {
  assert.deepEqual(normalizeBackendAvatarPreset({ key: 'leaf', label: 'Lá xanh' }, 'http://127.0.0.1:8000'), {
    key: 'leaf',
    label: 'Lá xanh',
    imageUrl: undefined,
    background: '#ffffff',
    tile: '#ffffff',
    accent: '#2c6e6e',
    face: '#2c6e6e',
    status: 'active',
    sortOrder: 0,
  });
});

test('backend avatar service returns an empty list when backend has no avatars', async () => {
  const service = createBackendAvatarService({
    baseUrl: 'http://127.0.0.1:8000',
    fetcher: async () => ({ ok: true, json: async () => [] }),
  });

  assert.deepEqual(await service.listAvatarPresets(), []);
});
