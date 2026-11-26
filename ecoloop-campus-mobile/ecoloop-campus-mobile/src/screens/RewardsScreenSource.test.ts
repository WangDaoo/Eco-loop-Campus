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

test('RewardsScreen lets students cancel an active reward QR before it is scanned', () => {
  assert.match(source, /cancelRewardRedemption/);
  assert.match(source, /title="Hủy mã"/);
  assert.match(source, /Mã đổi thưởng đã được hủy/);
});

test('RewardsScreen reports redeem and cancel errors instead of failing silently', () => {
  assert.match(source, /catch \(error\) \{\s*Alert\.alert\('Không thể tạo mã', messageOf\(error\)\)/);
  assert.match(source, /catch \(error\) \{\s*Alert\.alert\('Không thể hủy mã'/);
  assert.match(source, /if \(redeemingRef\.current\) return;/);
  assert.match(source, /if \(cancellingRef\.current\) return;/);
  assert.match(source, /Hủy mã đổi thưởng\?/);
});

test('RewardsScreen only offers active, in-stock rewards and explains why redeem is disabled', () => {
  assert.match(source, /getRedeemableRewards\(rewards\)/);
  assert.match(source, /isRewardOutOfStock\(reward\)/);
  assert.match(source, /Hết hàng/);
  assert.match(source, /getRedeemBlockReason\(selectedVoucher/);
  assert.match(source, /disabled=\{Boolean\(selectedBlockReason\) \|\| redeeming\}/);
  assert.match(source, /selectedBlockMessage/);
});

test('RewardsScreen shows pending codes past their deadline as expired in history', () => {
  assert.match(source, /getRedemptionDisplayStatus\(item, now\)/);
  assert.match(source, /redemptionStatusLabel\(displayStatus\)/);
});
