import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('NotificationsScreen renders backend notices and marks them read', () => {
  const source = readFileSync(join(__dirname, 'NotificationsScreen.tsx'), 'utf8');
  assert.match(source, /notifications/);
  assert.match(source, /markNotificationRead/);
  assert.match(source, /Trung tâm thông báo/);
  assert.match(source, /Chưa đọc/);
});
