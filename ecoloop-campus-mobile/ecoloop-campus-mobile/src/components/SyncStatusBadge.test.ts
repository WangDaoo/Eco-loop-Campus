import assert from 'node:assert/strict';
import test from 'node:test';
import { getSyncStatusCopy } from './syncStatusCopy';

test('sync status copy highlights realtime Supabase when connected', () => {
  assert.deepEqual(getSyncStatusCopy('supabase', ''), {
    title: 'Realtime Supabase',
    detail: 'Dữ liệu đang đồng bộ trực tiếp.',
    tone: 'success'
  });
});

test('sync status copy explains offline demo and setup error', () => {
  assert.deepEqual(getSyncStatusCopy('mock', ''), {
    title: 'Demo offline',
    detail: 'App đang dùng dữ liệu mẫu trên máy.',
    tone: 'neutral'
  });

  const errorCopy = getSyncStatusCopy('mock', 'Supabase thiếu dữ liệu vận hành: bins');
  assert.equal(errorCopy.title, 'Cần kiểm tra Supabase');
  assert.equal(errorCopy.tone, 'warning');
  assert.match(errorCopy.detail, /bins/);
});
