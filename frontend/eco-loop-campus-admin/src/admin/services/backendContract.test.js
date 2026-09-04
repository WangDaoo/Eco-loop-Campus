import fs from "fs";
import path from "path";
import { __testing } from "./supabaseStore";

const fixtures = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../../../contracts/backend_contract_fixtures.json"), "utf8"));

test("admin adapters consume canonical camelCase payloads and tolerate optional fields", () => {
  const user = __testing.fromUser({ ...fixtures.user, futureOptionalField: "kept safely" });
  const submission = __testing.fromRecyclingSubmission(fixtures.submission);
  const point = __testing.fromPointHistory({ ...fixtures.pointHistory, points: "25" });
  const reward = __testing.fromRewardRedemption(fixtures.rewardBatch);

  expect(user).toEqual(expect.objectContaining({ studentCode: "SV20260001", facultyCode: "information-technology", phoneNumber: "0912345678" }));
  expect(submission).toEqual(expect.objectContaining({ status: "POINT_CONFIRMED", actualQuantity: 2.5 }));
  expect(point).toEqual(expect.objectContaining({ points: 25, referenceId: "submission-contract-1" }));
  expect(reward).toEqual(expect.objectContaining({ status: "fulfilled", items: fixtures.rewardBatch.items }));
});

test.each(fixtures.errors)("admin surfaces $status $code instead of reporting local success", async error => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: error.status, json: async () => error });
  await expect(__testing.requestBackend("/contract-error")).rejects.toThrow(error.detail);
});

test("admin surfaces malformed JSON and offline backend errors", async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, json: async () => { throw new SyntaxError("bad json"); } });
  await expect(__testing.requestBackend("/bad-json")).rejects.toThrow(/503/);
  global.fetch = jest.fn().mockRejectedValue(new Error("network offline"));
  await expect(__testing.requestBackend("/offline")).rejects.toThrow("network offline");
});

test("admin submission review uses state-machine endpoints, not generic resource writes", () => {
  const source = fs.readFileSync(path.join(__dirname, "supabaseStore.js"), "utf8");
  expect(source).toMatch(/recycling-submissions\/\$\{encodeURIComponent\(item\.id\)\}\/reject/);
  expect(source).toMatch(/recycling-submissions\/\$\{encodeURIComponent\(item\.id\)\}\/review/);
  expect(source).not.toMatch(/saveResource\("recycling-submissions"/);
  expect(source).toMatch(/\/api\/admin\/point-adjustments/);
  expect(source).toMatch(/reward-redemption-batches\/\$\{encodeURIComponent\(batchId\)\}\/finalize/);
});
