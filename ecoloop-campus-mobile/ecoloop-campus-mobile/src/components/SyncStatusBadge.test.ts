import assert from 'node:assert/strict';
import test from 'node:test';
import { getSyncStatusCopy } from './syncStatusCopy';

test('sync status copy highlights realtime Supabase when connected', () => {
  assert.deepEqual(getSyncStatusCopy('supabase', ''), {
    title: 'Đang đồng bộ',
    detail: 'Dữ liệu đang đồng bộ trực tiếp.',
    tone: 'success'
  });
});

test('sync status copy shows Supabase setup error without local fallback', () => {
  const errorCopy = getSyncStatusCopy('supabase', 'Supabase thiếu dữ liệu vận hành: bins');
  assert.equal(errorCopy.title, 'Cần đồng bộ dữ liệu');
  assert.equal(errorCopy.tone, 'warning');
  assert.match(errorCopy.detail, /bins/);
});
