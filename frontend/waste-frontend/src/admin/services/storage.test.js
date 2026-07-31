import { LOCAL_PREDICTIONS_KEY, MODEL_THRESHOLD_KEY } from "../data/wasteConfig";
import { getModelThreshold, getRewardRedemptions, getStoredPredictions, saveModelThreshold, savePredictions, saveRewardRedemption, saveRewardRedemptions } from "./storage";

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
