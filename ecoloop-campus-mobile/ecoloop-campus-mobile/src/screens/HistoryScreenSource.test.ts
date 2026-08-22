import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'HistoryScreen.tsx'), 'utf8');

test('HistoryScreen renders reward redemption requests from context', () => {
  assert.match(source, /rewardRedemptions/);
  assert.match(source, /Yêu cầu đổi thưởng/);
  assert.match(source, /costPoints/);
});

test('HistoryScreen uses a dedicated reward redemption empty state', () => {
  assert.match(source, /Ionicons/);
  assert.match(source, /rewardEmptyCard/);
  assert.match(source, /gift-outline/);
  assert.match(source, /Khi bạn đổi quà, yêu cầu sẽ xuất hiện tại đây để theo dõi trạng thái\./);
  assert.doesNotMatch(source, /eco_cloud\.png/);
});

test('HistoryScreen renders realtime AI prediction review history from context', () => {
  assert.match(source, /aiPredictions/);
  assert.match(source, /Lịch sử AI/);
  assert.match(source, /getPredictionStatusText/);
  assert.match(source, /getPredictionSubtitle/);
});

test('HistoryScreen keeps Vietnamese UI text readable', () => {
  assert.doesNotMatch(source, /Lá»|YÃªu|Ä‘|ChÆ|tÃ¡i|VÃ|áº¢nh|chá»©ng|Ä/);
  assert.match(source, /Lịch sử của bạn/);
  assert.match(source, /Giao dịch tái chế/);
});
