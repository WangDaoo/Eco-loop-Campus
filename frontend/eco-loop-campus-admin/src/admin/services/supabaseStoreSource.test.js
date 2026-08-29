const { readFileSync } = require("fs");
const { join } = require("path");

const source = readFileSync(join(__dirname, "supabaseStore.js"), "utf8");
const dashboardSource = readFileSync(join(__dirname, "../pages/DashboardPage.js"), "utf8");

test("supabaseStore does not use localStorage fallback for operational data", () => {
  expect(source).not.toMatch(/\.\/storage/);
  expect(source).not.toMatch(/localStore/);
  expect(source).not.toMatch(/Chế độ dự phòng localStorage/);
  expect(source).not.toMatch(/export async function seedDefaults/);
  expect(source).not.toMatch(/export function sourceText/);
});

test("DashboardPage does not expose runtime demo seeding or source fallback pills", () => {
  expect(dashboardSource).not.toMatch(/seedDefaults/);
  expect(dashboardSource).not.toMatch(/Khởi tạo dữ liệu mẫu/);
  expect(dashboardSource).not.toMatch(/sourceText/);
  expect(dashboardSource).not.toMatch(/eg-source-pill/);
});

test("avatar preset upload fails clearly when Supabase Storage policy blocks admin uploads", () => {
  const uploadStart = source.indexOf("export async function uploadAvatarPresetImage");
  const uploadEnd = source.indexOf("export async function setPredictionStatus");
  const uploadSource = source.slice(uploadStart, uploadEnd);
  expect(uploadSource).toMatch(/storage\.from\(AVATAR_PRESET_BUCKET\)/);
  expect(uploadSource).toMatch(/Storage avatar chưa mở quyền upload cho admin/);
  expect(uploadSource).not.toMatch(/fileToDataUrl|storageFallback|data:image/);
});
