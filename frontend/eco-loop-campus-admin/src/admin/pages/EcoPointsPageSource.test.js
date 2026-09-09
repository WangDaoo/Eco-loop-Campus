const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = readFileSync(join(__dirname, "EcoPointsPage.js"), "utf8");

test("EcoPointsPage does not let admins create reward redemptions manually", () => {
  expect(source).not.toMatch(/Quy đổi phần thưởng/);
  expect(source).not.toMatch(/Tạo yêu cầu đổi thưởng/);
  expect(source).not.toMatch(/eg-reward-redemption-form/);
  expect(source).not.toMatch(/saveRewardRedemption/);
  expect(source).not.toMatch(/const submitReward =/);
  expect(source).not.toMatch(/onSubmit=\{submitReward\}/);
  expect(source).not.toMatch(/rewardUserQuery/);
});

test("EcoPointsPage keeps reward catalog and redemption history management", () => {
  expect(source).toMatch(/Sản phẩm đổi thưởng/);
  expect(source).toMatch(/Lưu danh mục quà tặng/);
  expect(source).toMatch(/Lưu sản phẩm đổi thưởng/);
  expect(source).toMatch(/Yêu cầu đổi thưởng/);
  expect(source).toMatch(/Mã QR đổi thưởng/);
  expect(source).toMatch(/updateRewardRedemption/);
  expect(source).toMatch(/finalizeRewardRedemptionBatch/);
});

test("EcoPointsPage groups management areas into focused tabs", () => {
  expect(source).toMatch(/const ECOPOINT_TABS = \[/);
  for (const label of ["Tổng quan", "Cộng điểm", "Quy tắc điểm", "Sản phẩm", "Gửi rác", "Đổi thưởng", "Xếp hạng"]) {
    expect(source).toMatch(new RegExp(`label: "${label}"`));
  }
  expect(source).toMatch(/role="tablist"/);
  expect(source).toMatch(/role="tab"/);
  expect(source).toMatch(/aria-selected=\{activeTab === tab\.id\}/);
  expect(source).toMatch(/activeTab === "overview"/);
  expect(source).toMatch(/activeTab === "manual"/);
  expect(source).toMatch(/activeTab === "rules"/);
  expect(source).toMatch(/activeTab === "catalog"/);
  expect(source).toMatch(/activeTab === "submissions"/);
  expect(source).toMatch(/activeTab === "redemptions"/);
  expect(source).toMatch(/activeTab === "rankings"/);
});
