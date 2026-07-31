import {
  BINS_KEY,
  DEFAULT_POINT_RULES,
  FEEDBACK_KEY,
  LOCAL_PREDICTIONS_KEY,
  MODEL_THRESHOLD_KEY,
  POINT_HISTORY_KEY,
  normalizePrediction,
  POINT_RULES_KEY,
  REWARD_REDEMPTIONS_KEY,
  USERS_KEY,
} from "../data/wasteConfig";
import { seedBins, seedFeedback, seedPointHistory, seedUsers } from "../data/seedData";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function normalizeStoredThreshold(value) {
  const threshold = Number(value);
  return Number.isFinite(threshold) ? threshold : 0.65;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function getStoredPredictions() {
  return readJson(LOCAL_PREDICTIONS_KEY, []).map(normalizePrediction);
}

export function savePredictions(predictions) {
  const safePredictions = Array.isArray(predictions) ? predictions : [];
  return writeJson(LOCAL_PREDICTIONS_KEY, safePredictions.map(normalizePrediction));
}

export function savePredictionRecord(record) {
  const next = [normalizePrediction(record), ...getStoredPredictions()];
  writeJson(LOCAL_PREDICTIONS_KEY, next);
  return next[0];
}

export function updatePredictionStatus(id, status) {
  const next = getStoredPredictions().map(item => item.id === id ? { ...item, status } : item);
  return savePredictions(next);
}

export function getUsers() {
  return readJson(USERS_KEY, seedUsers);
}

export function saveUsers(users) {
  return writeJson(USERS_KEY, safeArray(users));
}

export function getBins() {
  return readJson(BINS_KEY, seedBins);
}

export function saveBins(bins) {
  return writeJson(BINS_KEY, safeArray(bins));
}

export function getFeedback() {
  return readJson(FEEDBACK_KEY, seedFeedback);
}

export function saveFeedback(feedback) {
  return writeJson(FEEDBACK_KEY, safeArray(feedback));
}

export function getPointRules() {
  return readJson(POINT_RULES_KEY, DEFAULT_POINT_RULES);
}

export function savePointRules(rules) {
  return writeJson(POINT_RULES_KEY, safeArray(rules));
}

export function getPointHistory() {
  return readJson(POINT_HISTORY_KEY, seedPointHistory);
}

export function savePointHistory(history) {
  return writeJson(POINT_HISTORY_KEY, safeArray(history));
}

export function savePointHistoryRecord(record) {
  const next = [record, ...getPointHistory()];
  writeJson(POINT_HISTORY_KEY, next);
  return next[0];
}

export function getRewardRedemptions() {
  return readJson(REWARD_REDEMPTIONS_KEY, []);
}

export function saveRewardRedemptions(items) {
  return writeJson(REWARD_REDEMPTIONS_KEY, safeArray(items));
}

export function saveRewardRedemption(item) {
  const next = [item, ...getRewardRedemptions().filter(row => row.id !== item.id)];
  writeJson(REWARD_REDEMPTIONS_KEY, next);
  return item;
}

export function getModelThreshold() {
  return normalizeStoredThreshold(localStorage.getItem(MODEL_THRESHOLD_KEY) || 0.65);
}

export function saveModelThreshold(value) {
  const threshold = normalizeStoredThreshold(value);
  localStorage.setItem(MODEL_THRESHOLD_KEY, String(threshold));
  return threshold;
}
