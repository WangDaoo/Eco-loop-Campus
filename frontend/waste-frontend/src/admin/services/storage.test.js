import { BINS_KEY, FEEDBACK_KEY, LOCAL_PREDICTIONS_KEY, MODEL_THRESHOLD_KEY, POINT_HISTORY_KEY, POINT_RULES_KEY, REWARD_REDEMPTIONS_KEY, USERS_KEY } from "../data/wasteConfig";
import { getModelThreshold, getRewardRedemptions, getStoredPredictions, saveBins, saveFeedback, saveModelThreshold, savePointHistory, savePointRules, savePredictions, saveRewardRedemption, saveRewardRedemptions, saveUsers } from "./storage";

beforeEach(() => {
  localStorage.clear();
});

test("stores reward redemptions in localStorage fallback", () => {
  saveRewardRedemptions([]);
  saveRewardRedemption({
    id: "RW001",
    userId: "SV001",
    rewardLabel: "Voucher căn tin 100 điểm",
    costPoints: 100,
    status: "pending",
  });

  expect(getRewardRedemptions()).toEqual([
    { id: "RW001", userId: "SV001", rewardLabel: "Voucher căn tin 100 điểm", costPoints: 100, status: "pending" },
  ]);
});

test("falls back when stored predictions JSON is not an array", () => {
  localStorage.setItem(LOCAL_PREDICTIONS_KEY, JSON.stringify({ id: "broken" }));

  expect(getStoredPredictions()).toEqual([]);
});

test("falls back when stored model threshold is not numeric", () => {
  localStorage.setItem(MODEL_THRESHOLD_KEY, "bad-threshold");

  expect(getModelThreshold()).toBe(0.65);
});

test("does not save a non-numeric model threshold", () => {
  expect(saveModelThreshold("bad-threshold")).toBe(0.65);
  expect(localStorage.getItem(MODEL_THRESHOLD_KEY)).toBe("0.65");
});
test("saves missing predictions as an empty fallback array", () => {
  expect(savePredictions()).toEqual([]);
  expect(getStoredPredictions()).toEqual([]);
});

test("collection save helpers store empty arrays for non-array input", () => {
  expect(saveUsers()).toEqual([]);
  expect(saveBins("bad-bins")).toEqual([]);
  expect(saveFeedback({ id: "bad-feedback" })).toEqual([]);
  expect(savePointRules("bad-rules")).toEqual([]);
  expect(savePointHistory(null)).toEqual([]);
  expect(saveRewardRedemptions({ id: "bad-reward" })).toEqual([]);

  [USERS_KEY, BINS_KEY, FEEDBACK_KEY, POINT_RULES_KEY, POINT_HISTORY_KEY, REWARD_REDEMPTIONS_KEY].forEach(key => {
    expect(JSON.parse(localStorage.getItem(key))).toEqual([]);
  });
});
