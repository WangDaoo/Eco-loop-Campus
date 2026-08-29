const { readFileSync } = require("fs");
const { join } = require("path");

const source = readFileSync(join(__dirname, "supabaseStore.js"), "utf8");
const dashboardSource = readFileSync(join(__dirname, "../pages/DashboardPage.js"), "utf8");
const adminUiSources = [
  "../AdminApp.js",
  "../components/Sidebar.js",
  "../pages/AiTesterPage.js",
  "../pages/BinsPage.js",
  "../pages/DashboardPage.js",
  "../pages/EcoPointsPage.js",
  "../pages/FeedbackPage.js",
  "../pages/ModelSettingsPage.js",
  "../pages/ReportsPage.js",
  "../pages/ScansPage.js",
  "../pages/UsersPage.js",
].map(file => readFileSync(join(__dirname, file), "utf8").replace(/from "\.\.\/services\/supabaseStore"/g, ""));

test("supabaseStore does not use localStorage fallback for operational data", () => {
  expect(source).not.toMatch(/supabaseClient/);
  expect(source).not.toMatch(/@supabase\/supabase-js/);
  expect(source).not.toMatch(/\.\/storage/);
  expect(source).not.toMatch(/localStore/);
  expect(source).not.toMatch(/Chế độ dự phòng localStorage/);
  expect(source).not.toMatch(/export async function seedDefaults/);
  expect(source).not.toMatch(/export function sourceText/);
});

test("supabaseStore routes runtime data through backend PostgreSQL API", () => {
  expect(source).toMatch(/const BACKEND = "backend"/);
  expect(source).toMatch(/REACT_APP_API_URL/);
  expect(source).toMatch(/Authorization/);
  expect(source).toMatch(/\/api\/admin\/bins/);
  expect(source).toMatch(/\/api\/auth\/login/);
});

test("DashboardPage does not expose runtime demo seeding or source fallback pills", () => {
  expect(dashboardSource).not.toMatch(/seedDefaults/);
  expect(dashboardSource).not.toMatch(/Khởi tạo dữ liệu mẫu/);
  expect(dashboardSource).not.toMatch(/sourceText/);
  expect(dashboardSource).not.toMatch(/eg-source-pill/);
});

test("avatar preset upload uses backend upload instead of Supabase Storage", () => {
  const uploadStart = source.indexOf("export async function uploadAvatarPresetImage");
  const uploadEnd = source.indexOf("export async function setPredictionStatus");
  const uploadSource = source.slice(uploadStart, uploadEnd);
  expect(uploadSource).toMatch(/\/api\/avatar-presets/);
  expect(uploadSource).not.toMatch(/storage\.from|Storage avatar|fileToDataUrl|storageFallback|data:image/);
});

test("auth context uses backend session instead of Supabase Auth listeners", () => {
  const authSource = readFileSync(join(__dirname, "authContext.js"), "utf8");
  expect(authSource).not.toMatch(/supabaseClient|onAuthStateChange|getSession/);
  expect(authSource).toMatch(/loadAdminSession/);
});

test("admin runtime UI copy names PostgreSQL backend instead of Supabase fallback", () => {
  const combinedSource = adminUiSources.join("\n");
  expect(combinedSource).not.toMatch(/Supabase|Chế độ dự phòng localStorage|dữ liệu trên máy|localStorage fallback/);
  expect(combinedSource).toMatch(/PostgreSQL|backend/);
});
