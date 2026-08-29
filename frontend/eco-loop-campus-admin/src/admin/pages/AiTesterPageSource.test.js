const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = readFileSync(join(__dirname, "AiTesterPage.js"), "utf8");

test("AiTesterPage checks backend health before uploading to the AI model", () => {
  expect(source).toMatch(/checkBackendHealth/);
  expect(source).toMatch(/Backend AI public chưa kết nối hoặc tunnel đã hết hạn/);
  expect(source).toMatch(/\/predict\/queue/);
  expect(source.indexOf("await checkBackendHealth()")).toBeLessThan(source.indexOf("await predictWithQueue()"));
});

test("AiTesterPage does not collapse expired tunnel failures into the generic predict error", () => {
  expect(source).toMatch(/BACKEND_HEALTH_MESSAGE/);
  expect(source).toMatch(/isBackendConnectionError/);
  expect(source).not.toMatch(/Không gọi được backend \/predict"\);/);
});
