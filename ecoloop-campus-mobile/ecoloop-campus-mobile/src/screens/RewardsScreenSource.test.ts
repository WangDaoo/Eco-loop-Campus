import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(__dirname, 'RewardsScreen.tsx'), 'utf8');

test('RewardsScreen renders reward redemption history from context', () => {
  assert.match(source, /rewardRedemptions/);
  assert.match(source, /Yeu cau doi thuong|Yêu cầu đổi thưởng/);
});

test('RewardsScreen reward modal keeps a single redeem action', () => {
  assert.match(source, /requestReward/);
  assert.match(source, /title="Đổi"/);
  assert.doesNotMatch(source, /requestRewardBatch/);
  assert.doesNotMatch(source, /Số lượng/);
  assert.doesNotMatch(source, /quantityRow/);
  assert.doesNotMatch(source, /Thêm sản phẩm khác/);
  assert.doesNotMatch(source, /Tạo 1 mã/);
});
