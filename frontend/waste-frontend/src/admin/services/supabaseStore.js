import { isSupabaseConfigured, supabase } from "../../supabaseClient";
import {
  BIN_GROUPS,
  DEFAULT_POINT_RULES,
  WASTE_CLASSES,
  getBinGroup,
  getWasteLabel,
  normalizePrediction,
} from "../data/wasteConfig";
import { FEEDBACK_PRIORITIES, FEEDBACK_STATUSES, normalizeFeedback } from "../data/feedbackConfig";
import { seedBins, seedFeedback, seedUsers } from "../data/seedData";
import * as localStore from "./storage";

const SUPABASE = "supabase";
const LOCAL = "local";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function result(data, source = SUPABASE, error = null) {
  return { data, source, error };
}

function client() {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase chưa cấu hình");
  return supabase;
}

function normalizedStatus(value, fallback = "pending") {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  return status || fallback;
}

function normalizeNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePercent(value, fallback = null) {
  const parsed = normalizeNumber(value, fallback);
  if (parsed === null || parsed === undefined) return parsed;
  return Math.max(0, Math.min(100, parsed));
}

function normalizedBinGroup(value) {
  const normalized = typeof value === "string" ? value.trim().toLocaleLowerCase("vi-VN") : "";
  return (BIN_GROUPS.find(group => group.label.toLocaleLowerCase("vi-VN") === normalized) || {}).label || "";
}

const PREDICTION_STATUSES = ["pending", "approved", "rejected"];
const PREDICTION_STATUS_ACTIONS = ["approved", "rejected"];
const PREDICTION_SOURCES = ["upload", "camera"];
const REWARD_STATUSES = ["pending", "approved", "rejected"];
const REWARD_STATUS_ACTIONS = ["approved", "rejected"];
const USER_ROLES = ["student", "teacher", "volunteer", "admin"];
const USER_STATUS_ACTIONS = ["active", "locked"];
const BIN_STATUS_ACTIONS = ["active", "full", "maintenance"];

function normalizedPredictionStatusAction(value) {
  const status = normalizedStatus(value, "");
  return PREDICTION_STATUS_ACTIONS.includes(status) ? status : "";
}

function normalizedRewardStatus(value, fallback = "pending") {
  const status = normalizedStatus(value, "");
  return REWARD_STATUSES.includes(status) ? status : fallback;
}

function normalizedRewardStatusAction(value) {
  const status = normalizedStatus(value, "");
  return REWARD_STATUS_ACTIONS.includes(status) ? status : "";
}

function normalizedUserRole(value) {
  const role = normalizedStatus(value, "");
  return USER_ROLES.includes(role) ? role : "";
}

function normalizedUserStatusAction(value) {
  const status = normalizedStatus(value, "");
  return USER_STATUS_ACTIONS.includes(status) ? status : "";
}

function normalizedBinStatusAction(value) {
  const status = normalizedStatus(value, "");
  return BIN_STATUS_ACTIONS.includes(status) ? status : "";
}

function normalizedFeedbackStatusAction(value) {
  const status = normalizedStatus(value, "");
  return Object.prototype.hasOwnProperty.call(FEEDBACK_STATUSES, status) ? status : "";
}

function normalizedFeedbackPriorityAction(value) {
  const priority = normalizedStatus(value, "");
  return Object.prototype.hasOwnProperty.call(FEEDBACK_PRIORITIES, priority) ? priority : "";
}

function normalizedEnabled(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "enabled", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "disabled", "off", ""].includes(normalized)) return false;
  }
  return false;
}

function addPoints(currentPoints, deltaPoints) {
  const current = Number(currentPoints ?? 0);
  const delta = Number(deltaPoints ?? 0);
  return (Number.isFinite(current) ? current : 0) + (Number.isFinite(delta) ? delta : 0);
}

function normalizedClassKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeClassKeys(keys) {
  return Array.isArray(keys) ? keys.map(normalizedClassKey).filter(Boolean) : [];
}

function ruleMatchesClass(rule, className) {
  const classKey = normalizedClassKey(className);
  return Boolean(classKey) && normalizeClassKeys(rule.classKeys).includes(classKey);
}

function hasPointHistoryForPrediction(history, predictionId) {
  const targetId = String(predictionId || "");
  return Boolean(targetId) && history.some(item => String(item.predictionId || item.prediction_id || "") === targetId);
}

function fromBin(row) {
  const { bin_group: binGroupSnake, qr_code: qrCodeSnake, map_x: mapXSnake, map_y: mapYSnake, ...rest } = row;
  return {
    ...rest,
    binGroup: row.binGroup || binGroupSnake,
    qrCode: row.qrCode || qrCodeSnake,
    mapX: row.mapX ?? mapXSnake,
    mapY: row.mapY ?? mapYSnake,
  };
}

function toBin(bin) {
  return {
    id: bin.id,
    name: bin.name,
    bin_group: bin.binGroup,
    location: bin.location,
    building: bin.building,
    floor: bin.floor,
    qr_code: bin.qrCode,
    status: bin.status,
    capacity: bin.capacity,
    map_x: bin.mapX,
    map_y: bin.mapY,
  };
}

function fromUser(row) {
  const { created_at: createdAtSnake, ...rest } = row;
  const points = Number(row.points ?? 0);
  return {
    ...rest,
    points: Number.isFinite(points) ? points : 0,
    createdAt: row.createdAt || createdAtSnake,
  };
}

function toUser(user) {
  const points = Number(user.points || 0);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    group: user.group,
    points: Number.isFinite(points) ? points : 0,
    status: user.status,
    created_at: user.createdAt || new Date().toISOString(),
  };
}

function fromPrediction(row) {
  return normalizePrediction({
    ...row,
    binGroup: row.binGroup || row.bin_group,
    userId: row.userId || row.user_id,
    binId: row.binId || row.bin_id,
    imageName: row.imageName || row.image_name,
  });
}

function toPrediction(record) {
  const normalized = normalizePrediction(record);
  return {
    id: normalized.id,
    class: normalized.class,
    confidence: normalized.confidence,
    source: normalized.source,
    timestamp: normalized.timestamp,
    bin_group: normalized.binGroup,
    status: normalized.status,
    user_id: normalized.userId,
    bin_id: normalized.binId,
    image_name: normalized.imageName,
  };
}

function fromPointRule(row) {
  const { class_keys: classKeysSnake, bin_group: binGroupSnake, ...rest } = row;
  return {
    ...rest,
    classKeys: normalizeClassKeys(row.classKeys || classKeysSnake || []),
    binGroup: row.binGroup || binGroupSnake,
    enabled: normalizedEnabled(row.enabled),
  };
}

function toPointRule(rule) {
  return {
    id: rule.id,
    label: rule.label,
    class_keys: normalizeClassKeys(rule.classKeys),
    bin_group: rule.binGroup,
    points: rule.points,
    enabled: normalizedEnabled(rule.enabled),
  };
}

function fromPointHistory(row) {
  const {
    prediction_id: predictionIdSnake,
    user_id: userIdSnake,
    bin_id: binIdSnake,
    bin_group: binGroupSnake,
    user_name: userNameSnake,
    bin_name: binNameSnake,
    created_at: createdAtSnake,
    admin_note: adminNoteSnake,
    ...rest
  } = row;
  const points = Number(row.points ?? 0);
  return {
    ...rest,
    id: row.id,
    predictionId: row.predictionId || predictionIdSnake,
    userId: row.userId || userIdSnake,
    binId: row.binId || binIdSnake,
    binGroup: row.binGroup || binGroupSnake,
    points: Number.isFinite(points) ? points : 0,
    userName: row.userName || userNameSnake || row.user || "",
    binName: row.binName || binNameSnake || "",
    createdAt: row.createdAt || createdAtSnake,
    adminNote: row.adminNote || adminNoteSnake || "",
    source: row.source || "ai_approval",
  };
}

function toPointHistory(record) {
  const normalized = fromPointHistory(record);
  return {
    prediction_id: normalized.predictionId,
    user_id: normalized.userId,
    bin_id: normalized.binId,
    class: normalized.class,
    bin_group: normalized.binGroup,
    action: normalized.action,
    points: normalized.points,
    timestamp: normalized.timestamp,
    created_at: normalized.createdAt || normalized.timestamp,
    admin_note: normalized.adminNote || "",
    source: normalized.source || "ai_approval",
  };
}

function fromRewardRedemption(row) {
  const {
    user_id: userIdSnake,
    reward_label: rewardLabelSnake,
    cost_points: costPointsSnake,
    requested_at: requestedAtSnake,
    reviewed_at: reviewedAtSnake,
    admin_note: adminNoteSnake,
    ...rest
  } = row;
  const costPoints = Number(row.costPoints ?? costPointsSnake ?? 0);
  return {
    ...rest,
    userId: row.userId || userIdSnake,
    rewardLabel: row.rewardLabel || rewardLabelSnake,
    costPoints: Number.isFinite(costPoints) ? costPoints : 0,
    status: normalizedRewardStatus(row.status),
    requestedAt: row.requestedAt || requestedAtSnake,
    reviewedAt: row.reviewedAt || reviewedAtSnake,
    adminNote: row.adminNote || adminNoteSnake || "",
  };
}

function toRewardRedemption(item) {
  const normalized = fromRewardRedemption(item);
  return {
    id: normalized.id,
    user_id: normalized.userId,
    reward_label: normalized.rewardLabel,
    cost_points: Number(normalized.costPoints || 0),
    status: normalized.status || "pending",
    requested_at: normalized.requestedAt || new Date().toISOString(),
    reviewed_at: normalized.reviewedAt || null,
    admin_note: normalized.adminNote || "",
  };
}

function enrichPointHistory(history, users, bins) {
  return history.map(item => {
    const user = users.find(row => row.id === item.userId);
    const bin = bins.find(row => row.id === item.binId);
    return {
      ...item,
      userName: item.userName || user?.name || item.userId || "Không rõ người dùng",
      binName: item.binName || bin?.name || item.binId || "Chưa gắn thùng",
      binLocation: bin?.location || "",
    };
  });
}

function buildPointHistoryRecord(record, rule) {
  const timestamp = new Date().toISOString();
  return {
    predictionId: record.id,
    userId: record.userId,
    binId: record.binId,
    class: record.class,
    binGroup: getBinGroup(record.class),
    action: `Duyệt ${getWasteLabel(record.class)}`,
    points: rule.points,
    timestamp,
    createdAt: timestamp,
  };
}

function fromFeedback(row) {
  const {
    user_name: userNameSnake,
    bin_id: binIdSnake,
    admin_note: adminNoteSnake,
    resolved_at: resolvedAtSnake,
    ...rest
  } = row;
  return normalizeFeedback({
    ...rest,
    userName: row.userName || userNameSnake,
    binId: row.binId || binIdSnake,
    adminNote: row.adminNote || adminNoteSnake,
    resolvedAt: row.resolvedAt || resolvedAtSnake,
  });
}

function toFeedback(feedback) {
  const normalized = normalizeFeedback(feedback);
  return {
    id: normalized.id,
    user_name: normalized.userName,
    category: normalized.category,
    message: normalized.message,
    status: normalized.status,
    priority: normalized.priority,
    bin_id: normalized.binId,
    admin_note: normalized.adminNote,
    resolved_at: normalized.resolvedAt || null,
    timestamp: normalized.timestamp,
  };
}

function fromSettings(row) {
  return {
    id: row.id || "model",
    threshold: normalizeModelThreshold(row.threshold),
    modelName: row.modelName || row.model_name || "MobileNetV2",
    classCount: normalizeClassCount(row.classCount || row.class_count),
    updatedAt: row.updatedAt || row.updated_at,
  };
}

function normalizeModelThreshold(value) {
  const threshold = Number(value);
  if (!Number.isFinite(threshold)) return 0.65;
  return Math.min(0.95, Math.max(0.3, threshold));
}

function normalizeClassCount(value) {
  const classCount = Number(value);
  return Number.isFinite(classCount) && classCount > 0 ? classCount : WASTE_CLASSES.length;
}

function toSettings(settings) {
  return {
    id: "model",
    threshold: normalizeModelThreshold(settings.threshold),
    model_name: settings.modelName || "MobileNetV2",
    class_count: normalizeClassCount(settings.classCount),
    updated_at: settings.updatedAt || new Date().toISOString(),
  };
}

async function readTable(tableName, fallback, mapper = item => item) {
  try {
    const response = await client().from(tableName).select("*");
    if (response.error) throw response.error;
    return result((response.data || []).map(mapper), SUPABASE);
  } catch (error) {
    return result(fallback().map(mapper), LOCAL, error);
  }
}

async function upsert(tableName, dbPayload, appPayload, fallbackWrite) {
  try {
    const response = await client().from(tableName).upsert(dbPayload);
    if (response.error) throw response.error;
    return result(appPayload, SUPABASE);
  } catch (error) {
    const data = fallbackWrite ? fallbackWrite(appPayload) : appPayload;
    return result(data, LOCAL, error);
  }
}

export async function signInAdmin(email, password) {
  const response = await client().auth.signInWithPassword({ email, password });
  if (response.error) throw response.error;
  return response.data;
}

export async function signOutAdmin() {
  if (!isSupabaseConfigured || !supabase) return;
  const response = await supabase.auth.signOut();
  if (response.error) throw response.error;
}

export async function getAdminProfile(user) {
  if (!user?.email) return result(null, LOCAL);
  const users = await listUsers();
  const email = user.email.trim().toLowerCase();
  const profile = users.data.find(item => (item.email || "").trim().toLowerCase() === email || item.id === user.id);
  const role = (profile?.role || "").trim().toLowerCase();
  const status = (profile?.status || "active").trim().toLowerCase();
  const isAdmin = role === "admin" || role === "quản trị" || role === "quan tri";
  return result(isAdmin && status === "active" ? { ...profile, uid: user.id } : null, users.source, users.error);
}

export async function listPredictions() {
  const rows = await readTable("predictions", localStore.getStoredPredictions, fromPrediction);
  return result([...rows.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), rows.source, rows.error);
}

export async function savePredictionRecord(record) {
  const rawClass = typeof record?.class === "string" ? record.class : typeof record?.className === "string" ? record.className : "";
  const classKey = rawClass.trim().toLowerCase();
  const source = typeof record?.source === "string" ? record.source.trim().toLowerCase() : "";
  const confidence = Number(record?.confidence);
  const status = normalizedStatus(record?.status, "pending");
  if (!classKey || !PREDICTION_SOURCES.includes(source) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !PREDICTION_STATUSES.includes(status)) {
    return result(null, LOCAL, new Error("Invalid prediction record"));
  }
  const appRecord = fromPrediction({ ...record, class: classKey, source, confidence, status });
  return upsert("predictions", toPrediction(appRecord), appRecord, payload => localStore.savePredictionRecord(payload));
}

export async function setPredictionStatus(record, status) {
  const nextStatus = normalizedPredictionStatusAction(status);
  const currentRecord = { ...record, status: normalizedStatus(record.status) };
  if (!nextStatus) return result(currentRecord, LOCAL, new Error("Invalid prediction status"));
  const nextRecord = { ...record, status: nextStatus };
  try {
    const response = await client().from("predictions").update({ status: nextStatus }).eq("id", record.id);
    if (response.error) throw response.error;
    if (nextStatus === "approved" && record.userId && record.binId) {
      const history = await listPointHistory();
      const alreadyAwarded = hasPointHistoryForPrediction(history.data, record.id);
      const rules = await listPointRules();
      const rule = rules.data.find(item => normalizedEnabled(item.enabled) && ruleMatchesClass(item, record.class));
      if (!alreadyAwarded && rule && rule.points > 0) {
        const pointRecord = buildPointHistoryRecord(record, rule);
        const insertResponse = await client().from("point_history").insert([toPointHistory(pointRecord)]);
        if (insertResponse.error) throw insertResponse.error;
        const users = await listUsers();
        const user = users.data.find(item => item.id === pointRecord.userId);
        if (user) {
          const userResponse = await client().from("users").update({ points: addPoints(user.points, rule.points) }).eq("id", user.id);
          if (userResponse.error) throw userResponse.error;
        }
      }
    }
    return result(nextRecord, SUPABASE);
  } catch (error) {
    const storedPredictions = localStore.getStoredPredictions();
    const updated = storedPredictions.some(item => item.id === record.id)
      ? localStore.updatePredictionStatus(record.id, nextStatus)
      : [localStore.savePredictionRecord(nextRecord), ...storedPredictions];
    if (nextStatus === "approved" && record.userId && record.binId) {
      const alreadyAwarded = hasPointHistoryForPrediction(localStore.getPointHistory(), record.id);
      const rule = localStore.getPointRules().find(item => normalizedEnabled(item.enabled) && ruleMatchesClass(item, record.class));
      if (!alreadyAwarded && rule && rule.points > 0) {
        const pointRecord = buildPointHistoryRecord(record, rule);
        localStore.savePointHistoryRecord(pointRecord);
        const users = localStore.getUsers();
        localStore.saveUsers(users.map(user => user.id === pointRecord.userId ? { ...user, points: addPoints(user.points, rule.points) } : user));
      }
    }
    return result(updated.find(item => item.id === record.id) || nextRecord, LOCAL, error);
  }
}

export async function listUsers() {
  return readTable("users", localStore.getUsers, fromUser);
}

export async function saveUser(user) {
  const name = typeof user.name === "string" ? user.name.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const role = normalizedUserRole(user.role);
  const status = normalizedUserStatusAction(user.status || "active");
  if (!name || !EMAIL_PATTERN.test(email) || !role || !status) return result(null, LOCAL, new Error("Invalid user profile"));
  const payload = fromUser({ ...user, name, email, role, status, group: typeof user.group === "string" ? user.group.trim() : user.group, createdAt: user.createdAt || new Date().toISOString() });
  return upsert("users", toUser(payload), payload, item => {
    const users = localStore.getUsers();
    const next = [item, ...users.filter(user => user.id !== item.id)];
    localStore.saveUsers(next);
    return item;
  });
}

export async function updateUserStatus(user, status) {
  const nextStatus = normalizedUserStatusAction(status);
  if (!nextStatus) return result(user, LOCAL, new Error("Invalid user status"));
  try {
    const response = await client().from("users").update({ status: nextStatus }).eq("id", user.id);
    if (response.error) throw response.error;
    return result({ ...user, status: nextStatus }, SUPABASE);
  } catch (error) {
    const nextUser = { ...user, status: nextStatus };
    const localUsers = localStore.getUsers();
    const existsLocally = localUsers.some(item => item.id === user.id);
    const next = existsLocally
      ? localUsers.map(item => item.id === user.id ? nextUser : item)
      : [nextUser, ...localUsers];
    localStore.saveUsers(next);
    return result(nextUser, LOCAL, error);
  }
}

export async function listBins() {
  return readTable("bins", localStore.getBins, fromBin);
}

export async function saveBin(bin) {
  const id = typeof bin.id === "string" ? bin.id.trim() : "";
  const name = typeof bin.name === "string" ? bin.name.trim() : "";
  const location = typeof bin.location === "string" ? bin.location.trim() : "";
  const binGroup = normalizedBinGroup(bin.binGroup);
  const status = normalizedBinStatusAction(bin.status || "active");
  if (!id || !name || !location || !binGroup || !status) return result(null, LOCAL, new Error("Invalid bin station"));
  const payload = {
    ...bin,
    id,
    name,
    binGroup,
    location,
    status,
    building: typeof bin.building === "string" ? bin.building.trim() : bin.building,
    floor: typeof bin.floor === "string" ? bin.floor.trim() : bin.floor,
    qrCode: typeof bin.qrCode === "string" ? bin.qrCode.trim() : bin.qrCode,
    capacity: normalizePercent(bin.capacity, 0),
    mapX: normalizePercent(bin.mapX),
    mapY: normalizePercent(bin.mapY),
  };
  return upsert("bins", toBin(payload), payload, item => {
    const bins = localStore.getBins();
    const next = [item, ...bins.filter(bin => bin.id !== item.id)];
    localStore.saveBins(next);
    return item;
  });
}

export async function updateBinStatus(bin, status) {
  const nextStatus = normalizedBinStatusAction(status);
  if (!nextStatus) return result(bin, LOCAL, new Error("Invalid bin status"));
  try {
    const response = await client().from("bins").update({ status: nextStatus }).eq("id", bin.id);
    if (response.error) throw response.error;
    return result({ ...bin, status: nextStatus }, SUPABASE);
  } catch (error) {
    const nextBin = { ...bin, status: nextStatus };
    const localBins = localStore.getBins();
    const existsLocally = localBins.some(item => item.id === bin.id);
    const next = existsLocally
      ? localBins.map(item => item.id === bin.id ? nextBin : item)
      : [nextBin, ...localBins];
    localStore.saveBins(next);
    return result(nextBin, LOCAL, error);
  }
}

export async function listFeedback() {
  const rows = await readTable("feedback", localStore.getFeedback, fromFeedback);
  return result([...rows.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), rows.source, rows.error);
}

export async function saveFeedbackItem(feedback) {
  const message = typeof feedback.message === "string" ? feedback.message.trim() : "";
  const status = normalizedFeedbackStatusAction(feedback.status || "unread");
  const priority = normalizedFeedbackPriorityAction(feedback.priority || "medium");
  if (!message || !status || !priority) return result(null, LOCAL, new Error("Invalid feedback message"));
  const payload = normalizeFeedback({
    ...feedback,
    message,
    id: feedback.id || `FB-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status,
    priority,
    timestamp: feedback.timestamp || new Date().toISOString(),
  });
  return upsert("feedback", toFeedback(payload), payload, item => {
    const next = [item, ...localStore.getFeedback().filter(row => row.id !== item.id)];
    localStore.saveFeedback(next);
    return item;
  });
}

export async function updateFeedbackItem(feedback, updates) {
  const currentFeedback = normalizeFeedback(feedback);
  const hasStatusUpdate = Object.prototype.hasOwnProperty.call(updates, "status");
  const nextStatus = hasStatusUpdate ? normalizedFeedbackStatusAction(updates.status) : "";
  if (hasStatusUpdate && !nextStatus) return result(currentFeedback, LOCAL, new Error("Invalid feedback status"));
  const nextFeedback = normalizeFeedback({ ...feedback, ...updates, ...(hasStatusUpdate ? { status: nextStatus } : {}) });
  try {
    const response = await client().from("feedback").update(toFeedback(nextFeedback)).eq("id", feedback.id);
    if (response.error) throw response.error;
    return result(nextFeedback, SUPABASE);
  } catch (error) {
    const localFeedback = localStore.getFeedback();
    const existsLocally = localFeedback.some(item => item.id === feedback.id);
    const next = existsLocally
      ? localFeedback.map(item => item.id === feedback.id ? nextFeedback : item)
      : [nextFeedback, ...localFeedback];
    localStore.saveFeedback(next);
    return result(nextFeedback, LOCAL, error);
  }
}

export async function updateFeedbackStatus(feedback, status) {
  const nextStatus = normalizedFeedbackStatusAction(status);
  if (!nextStatus) return result(normalizeFeedback(feedback), LOCAL, new Error("Invalid feedback status"));
  const updates = nextStatus === "resolved"
    ? { status: nextStatus, resolvedAt: new Date().toISOString() }
    : { status: nextStatus };
  return updateFeedbackItem(feedback, updates);
}

export async function listPointRules() {
  return readTable("point_rules", localStore.getPointRules, fromPointRule);
}

export async function savePointRules(rules) {
  if (!Array.isArray(rules)) return result([], LOCAL, new Error("Invalid point rules"));
  try {
    const response = await client().from("point_rules").upsert(rules.map(toPointRule));
    if (response.error) throw response.error;
    return result(rules, SUPABASE);
  } catch (error) {
    localStore.savePointRules(rules);
    return result(rules, LOCAL, error);
  }
}

export async function listPointHistory() {
  const [history, users, bins] = await Promise.all([
    readTable("point_history", localStore.getPointHistory, fromPointHistory),
    listUsers(),
    listBins(),
  ]);
  const sources = [history, users, bins];
  const source = sources.some(item => item.source === LOCAL) ? LOCAL : SUPABASE;
  const error = sources.find(item => item.error)?.error || null;
  const data = enrichPointHistory(history.data, users.data, bins.data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return result(data, source, error);
}

export async function saveManualPointHistory(record) {
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";
  const action = typeof record.action === "string" ? record.action.trim() : "";
  const points = Number(record.points);
  if (!userId || !action || !Number.isFinite(points) || points === 0) {
    return result(null, LOCAL, new Error("Invalid manual point record"));
  }
  const timestamp = new Date().toISOString();
  const pointRecord = fromPointHistory({
    predictionId: null,
    userId,
    binId: record.binId || null,
    class: "manual_adjustment",
    binGroup: record.binGroup || "Điều chỉnh",
    action,
    points,
    timestamp,
    createdAt: timestamp,
    source: "manual_adjustment",
    adminNote: record.adminNote || "",
  });

  try {
    const insertResponse = await client().from("point_history").insert([toPointHistory(pointRecord)]);
    if (insertResponse.error) throw insertResponse.error;
    const users = await listUsers();
    const user = users.data.find(item => item.id === pointRecord.userId);
    if (user) {
      const userResponse = await client().from("users").update({ points: addPoints(user.points, pointRecord.points) }).eq("id", user.id);
      if (userResponse.error) throw userResponse.error;
    }
    return result(pointRecord, SUPABASE);
  } catch (error) {
    localStore.savePointHistoryRecord(pointRecord);
    const users = localStore.getUsers();
    localStore.saveUsers(users.map(user => user.id === pointRecord.userId ? { ...user, points: addPoints(user.points, pointRecord.points) } : user));
    return result(pointRecord, LOCAL, error);
  }
}

export async function listRewardRedemptions() {
  const [rewards, users] = await Promise.all([
    readTable("reward_redemptions", localStore.getRewardRedemptions, fromRewardRedemption),
    listUsers(),
  ]);
  const source = rewards.source === LOCAL || users.source === LOCAL ? LOCAL : SUPABASE;
  const error = rewards.error || users.error || null;
  const data = rewards.data.map(item => {
    const user = users.data.find(row => row.id === item.userId);
    return {
      ...item,
      userName: user?.name || item.userId || "Chưa rõ người dùng",
      userGroup: user?.group || "",
    };
  }).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  return result(data, source, error);
}

export async function saveRewardRedemption(item) {
  const userId = typeof item.userId === "string" ? item.userId.trim() : "";
  const rewardLabel = typeof item.rewardLabel === "string" ? item.rewardLabel.trim() : "";
  const costPoints = Number(item.costPoints);
  if (!userId || !rewardLabel || !Number.isFinite(costPoints) || costPoints <= 0) {
    return result(null, LOCAL, new Error("Invalid reward redemption"));
  }
  const payload = fromRewardRedemption({
    ...item,
    userId,
    rewardLabel,
    costPoints,
    id: item.id || `RW-${Date.now()}`,
    status: item.status || "pending",
    requestedAt: item.requestedAt || new Date().toISOString(),
  });
  return upsert("reward_redemptions", toRewardRedemption(payload), payload, row => localStore.saveRewardRedemption(row));
}

export async function updateRewardRedemption(item, updates) {
  const currentItem = fromRewardRedemption(item);
  const hasStatusUpdate = Object.prototype.hasOwnProperty.call(updates, "status");
  if (hasStatusUpdate && !normalizedRewardStatusAction(updates.status)) {
    return result(currentItem, LOCAL, new Error("Invalid reward status"));
  }
  const nextItem = fromRewardRedemption({ ...item, ...updates, ...(hasStatusUpdate ? { status: normalizedRewardStatusAction(updates.status) } : {}) });
  try {
    const response = await client().from("reward_redemptions").update(toRewardRedemption(nextItem)).eq("id", item.id);
    if (response.error) throw response.error;
    return result(nextItem, SUPABASE);
  } catch (error) {
    const localRewards = localStore.getRewardRedemptions();
    const existsLocally = localRewards.some(row => row.id === item.id);
    const next = existsLocally
      ? localRewards.map(row => row.id === item.id ? nextItem : row)
      : [nextItem, ...localRewards];
    localStore.saveRewardRedemptions(next);
    return result(nextItem, LOCAL, error);
  }
}

export async function getModelSettings() {
  try {
    const response = await client().from("settings").select("*").eq("id", "model").maybeSingle();
    if (response.error) throw response.error;
    if (response.data) return result(fromSettings(response.data), SUPABASE);
  } catch (error) {
    return result({ threshold: normalizeModelThreshold(localStore.getModelThreshold()), modelName: "MobileNetV2", classCount: WASTE_CLASSES.length }, LOCAL, error);
  }
  return result({ threshold: normalizeModelThreshold(localStore.getModelThreshold()), modelName: "MobileNetV2", classCount: WASTE_CLASSES.length }, SUPABASE);
}

export async function saveModelThreshold(threshold) {
  const payload = { threshold: normalizeModelThreshold(threshold), modelName: "MobileNetV2", classCount: WASTE_CLASSES.length, updatedAt: new Date().toISOString() };
  return upsert("settings", toSettings(payload), payload, item => {
    localStore.saveModelThreshold(item.threshold);
    return item;
  });
}

async function seedMissingRows(tableName, seedRows, mapper) {
  const response = await client().from(tableName).select("*");
  if (response.error) throw response.error;
  const existingIds = new Set((response.data || []).map(item => item.id));
  const missingRows = seedRows.filter(item => !existingIds.has(item.id));
  if (!missingRows.length) return 0;
  const upsertResponse = await client().from(tableName).upsert(missingRows.map(mapper));
  if (upsertResponse.error) throw upsertResponse.error;
  return missingRows.length;
}

async function seedModelSettingsIfMissing() {
  const response = await client().from("settings").select("*");
  if (response.error) throw response.error;
  const hasModelSettings = (response.data || []).some(item => item.id === "model");
  if (hasModelSettings) return 0;
  const upsertResponse = await client().from("settings").upsert(toSettings({ threshold: 0.65, modelName: "MobileNetV2", classCount: WASTE_CLASSES.length }));
  if (upsertResponse.error) throw upsertResponse.error;
  return 1;
}

export async function loadDashboardData() {
  const [predictions, bins, users, pointRules, feedback, pointHistory, settings] = await Promise.all([listPredictions(), listBins(), listUsers(), listPointRules(), listFeedback(), listPointHistory(), getModelSettings()]);
  const sources = [predictions, bins, users, pointRules, feedback, pointHistory, settings];
  const source = sources.some(item => item.source === LOCAL) ? LOCAL : SUPABASE;
  const error = sources.find(item => item.error)?.error || null;
  return result({ predictions: predictions.data, bins: bins.data, users: users.data, pointRules: pointRules.data, feedback: feedback.data, pointHistory: pointHistory.data, settings: settings.data }, source, error);
}

export async function seedDefaults() {
  try {
    const seededCounts = await Promise.all([
      seedMissingRows("users", seedUsers, toUser),
      seedMissingRows("bins", seedBins, toBin),
      seedMissingRows("feedback", seedFeedback, toFeedback),
      seedMissingRows("point_rules", DEFAULT_POINT_RULES, toPointRule),
      seedModelSettingsIfMissing(),
    ]);
    return result(seededCounts.some(Boolean), SUPABASE);
  } catch (error) {
    return result(false, LOCAL, error);
  }
}

export function sourceText(source) {
  return source === SUPABASE ? "Nguồn dữ liệu Supabase" : "Chế độ dự phòng localStorage";
}

export const __testing = {
  fromBin,
  toBin,
  fromPrediction,
  toPrediction,
  fromPointRule,
  toPointRule,
  fromPointHistory,
  toPointHistory,
  fromFeedback,
  toFeedback,
  fromRewardRedemption,
  toRewardRedemption,
  fromSettings,
  toSettings,
  fromUser,
  toUser,
};
