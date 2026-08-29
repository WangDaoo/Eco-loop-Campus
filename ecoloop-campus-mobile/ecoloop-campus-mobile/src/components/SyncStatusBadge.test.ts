import assert from 'node:assert/strict';
import test from 'node:test';
import { getSyncStatusCopy } from './syncStatusCopy';

test('sync status copy highlights backend PostgreSQL polling when connected', () => {
  assert.deepEqual(getSyncStatusCopy('backend', ''), {
    title: 'Đang đồng bộ',
    detail: 'Dữ liệu đang đồng bộ từ backend PostgreSQL.',
    tone: 'success'
  });
});

test('sync status copy shows backend setup error without local fallback', () => {
  const errorCopy = getSyncStatusCopy('backend', 'Backend thiếu dữ liệu vận hành: bins');
  assert.equal(errorCopy.title, 'Cần đồng bộ dữ liệu');
  assert.equal(errorCopy.tone, 'warning');
  assert.match(errorCopy.detail, /bins/);
});
