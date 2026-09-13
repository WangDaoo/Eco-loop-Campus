const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = readFileSync(join(__dirname, "ReportsPage.js"), "utf8");

test("reports page exposes student contribution exports", () => {
  expect(source).toMatch(/Danh sách điểm rèn luyện/);
  expect(source).toMatch(/Tải danh sách CSV/);
  expect(source).toMatch(/Tải danh sách Excel/);
  expect(source).toMatch(/downloadStudentContributionReport/);
  expect(source).toMatch(/studentReport\.studentRows/);
});

test("reports page exposes daily operational trend table", () => {
  expect(source).toMatch(/Biến động theo ngày/);
  expect(source).toMatch(/studentReport\.dailyRows/);
  expect(source).toMatch(/Số sinh viên tham gia/);
});
