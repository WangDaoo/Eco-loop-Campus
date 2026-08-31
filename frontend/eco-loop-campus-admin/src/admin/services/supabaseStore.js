import {
  BIN_GROUPS,
  WASTE_CLASSES,
  getBinGroup,
  getWasteLabel,
  normalizePrediction,
} from "../data/wasteConfig";
import { FEEDBACK_PRIORITIES, FEEDBACK_STATUSES, normalizeFeedback } from "../data/feedbackConfig";

const BACKEND = "backend";
const TOKEN_KEY = "ecoloop_admin_token";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREDICTION_STATUSES = ["pending", "approved", "rejected"];
const PREDICTION_STATUS_ACTIONS = ["approved", "rejected"];
const PREDICTION_SOURCES = ["upload", "camera", "mobile"];
const REWARD_STATUSES = ["pending", "approved", "rejected"];
const REWARD_STATUS_ACTIONS = ["approved", "rejected"];
const REWARD_CATALOG_STATUSES = ["active", "inactive"];
const USER_ROLES = ["student", "teacher", "volunteer", "admin"];
const USER_STATUS_ACTIONS = ["active", "locked", "pending", "rejected"];
const BIN_STATUS_ACTIONS = ["active", "full", "maintenance", "closed"];

const RESOURCE_PATHS = {
  users: "/api/admin/users",
  bins: "/api/admin/bins",
  "waste-types": "/api/admin/waste-types",
  predictions: "/api/admin/predictions",
  "point-rules": "/api/admin/point-rules",
  "point-history": "/api/admin/point-history",
  feedback: "/api/admin/feedback",
  rewards: "/api/admin/rewards",
  "reward-categories": "/api/admin/reward-categories",
  "reward-redemptions": "/api/admin/reward-redemptions",
  "recycling-submissions": "/api/admin/recycling-submissions",
  "proof-images": "/api/admin/proof-images",
  settings: "/api/admin/settings",
};

function apiUrl() {
  return (process.env.REACT_APP_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

function result(data, source = BACKEND, error = null) {
  return { data, source, error };
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem(TOKEN_KEY) || "";
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readError(response) {
  try {
    const payload = await response.json();
    return payload?.detail || payload?.error || payload?.message || `Backend lỗi HTTP ${response.status}`;
  } catch {
    return `Backend lỗi HTTP ${response.status}`;
  }
}

async function requestBackend(path, options = {}) {
  const headers = authHeaders(options.headers || {});
  const init = { ...options, headers };
  if (init.body && !(init.body instanceof FormData)) {
    init.headers = { "Content-Type": "application/json", ...headers };
    init.body = JSON.stringify(init.body);
  }
  const response = await fetch(`${apiUrl()}${path}`, init);
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function listResource(resource, mapper = item => item) {
  try {
    const payload = await requestBackend(RESOURCE_PATHS[resource]);
    return result((payload.data || []).map(mapper));
  } catch (error) {
    return result([], BACKEND, error);
  }
}

async function saveResource(resource, payload, mapper = item => item) {
  try {
    const response = await requestBackend(RESOURCE_PATHS[resource], { method: "POST", body: payload });
    return result(mapper(response.data || payload));
  } catch (error) {
    return result(null, BACKEND, error);
  }
}

async function deleteResource(resource, itemId) {
  try {
    await requestBackend(`${RESOURCE_PATHS[resource]}/${encodeURIComponent(itemId)}`, { method: "DELETE" });
    return result({ ok: true });
  } catch (error) {
    return result({ ok: false }, BACKEND, error);
  }
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

function normalizedPredictionStatusAction(value) {
  const status = normalizedStatus(value, "");
  return PREDICTION_STATUS_ACTIONS.includes(status) ? status : "";
}

function normalizedRewardStatus(value, fallback = "pending") {
  const status = normalizedStatus(value, "");
  return REWARD_STATUSES.includes(status) ? status : fallback;
}

function normalizedRewardCatalogStatus(value, fallback = "active") {
  const status = normalizedStatus(value, "");
  return REWARD_CATALOG_STATUSES.includes(status) ? status : fallback;
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

function isActiveAdminProfile(profile = {}) {
  return normalizedUserRole(profile.role) === "admin" && normalizedStatus(profile.status) === "active";
}

function safeImageFileName(fileName = "scan.jpg") {
  const rawName = String(fileName || "scan.jpg").trim() || "scan.jpg";
  const parts = rawName.split(".");
  const extension = parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
  const baseName = parts.join(".") || "scan";
  const asciiBase = baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "scan";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
  return `${asciiBase}.${safeExtension}`;
}

function buildPredictionImagePath(fileName, now = new Date(), random = Math.random()) {
  const date = Number.isNaN(now.getTime()) ? new Date().toISOString().slice(0, 10) : now.toISOString().slice(0, 10);
  const nonce = String(Math.floor(Math.max(0, Math.min(0.999999, Number(random) || 0)) * 1000000)).padStart(6, "0");
  return `ai-reviews/${date}/${nonce}-${safeImageFileName(fileName)}`;
}

function buildRewardProductId(title = "reward") {
  const slug = String(title || "reward")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "reward";
  return `${slug}-${Date.now()}`;
}

function buildAvatarPresetKey(label = "avatar") {
  const slug = String(label || "avatar")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "avatar";
  return slug;
}

function buildQrSlug(value = "station") {
  return String(value || "station")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "STATION";
}

function absoluteAssetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path || "";
  return `${apiUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildStationQrCode(value = "station") {
  const normalized = String(value || "").trim();
  if (/^ECL-ST-[A-Z0-9-]+$/i.test(normalized)) return normalized.toUpperCase();
  return `ECL-ST-${buildQrSlug(normalized)}`;
}

export function buildStationQrPayload(station = {}) {
  return JSON.stringify({
    type: "eco-loop-station",
    version: 1,
    stationId: station.id || "",
    qrCode: buildStationQrCode(station.qrCode || station.id || station.name),
  });
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

function fromBin(row = {}) {
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

export function applyBinRealtimeChange(current, payload) {
  if (payload?.eventType === "DELETE") {
    const deletedId = payload.old?.id;
    return deletedId ? current.filter(item => item.id !== deletedId) : current;
  }
  if (!payload?.new?.id) return current;
  const nextBin = fromBin(payload.new);
  return [nextBin, ...current.filter(item => item.id !== nextBin.id)];
}

export function subscribeBins(onChange) {
  let active = true;
  let lastSnapshot = "";
  async function poll() {
    if (!active) return;
    const response = await listBins();
    const snapshot = JSON.stringify(response.data);
    if (snapshot !== lastSnapshot) {
      lastSnapshot = snapshot;
      onChange({ eventType: "UPDATE", new: null, data: response.data });
    }
  }
  poll();
  const timer = setInterval(poll, 5000);
  return () => {
    active = false;
    clearInterval(timer);
  };
}

function fromUser(row = {}) {
  const { created_at: createdAtSnake, avatar_key: avatarKeySnake, avatar_url: avatarUrlSnake, ...rest } = row;
  const points = Number(row.points ?? 0);
  return {
    ...rest,
    points: Number.isFinite(points) ? points : 0,
    createdAt: row.createdAt || createdAtSnake,
    avatarKey: row.avatarKey || avatarKeySnake || "",
    avatarUrl: absoluteAssetUrl(row.avatarUrl || avatarUrlSnake || ""),
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
    avatar_key: user.avatarKey || null,
    avatar_url: user.avatarUrl || null,
  };
}

function fromPrediction(row = {}) {
  return normalizePrediction({
    ...row,
    binGroup: row.binGroup || row.bin_group,
    userId: row.userId || row.user_id,
    binId: row.binId || row.bin_id,
    imageName: row.imageName || row.image_name,
    imageUrl: absoluteAssetUrl(row.imageUrl || row.image_url || ""),
    thumbnailUrl: absoluteAssetUrl(row.thumbnailUrl || row.thumbnail_url || ""),
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
    image_url: normalized.imageUrl || null,
    thumbnail_url: normalized.thumbnailUrl || null,
  };
}

function fromPointRule(row = {}) {
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

function fromPointHistory(row = {}) {
  const { prediction_id: predictionIdSnake, user_id: userIdSnake, bin_id: binIdSnake, bin_group: binGroupSnake, user_name: userNameSnake, bin_name: binNameSnake, created_at: createdAtSnake, admin_note: adminNoteSnake, ...rest } = row;
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
    description: normalized.description || normalized.action || "",
    status: normalized.status || "confirmed",
  };
}

function fromRewardRedemption(row = {}) {
  const { user_id: userIdSnake, reward_id: rewardIdSnake, reward_label: rewardLabelSnake, cost_points: costPointsSnake, requested_at: requestedAtSnake, reviewed_at: reviewedAtSnake, admin_note: adminNoteSnake, ...rest } = row;
  const costPoints = Number(row.costPoints ?? costPointsSnake ?? 0);
  return {
    ...rest,
    userId: row.userId || userIdSnake,
    rewardId: row.rewardId || rewardIdSnake,
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
    reward_id: normalized.rewardId,
    reward_label: normalized.rewardLabel,
    cost_points: Number(normalized.costPoints || 0),
    status: normalized.status || "pending",
    requested_at: normalized.requestedAt || new Date().toISOString(),
    reviewed_at: normalized.reviewedAt || null,
    admin_note: normalized.adminNote || "",
  };
}

function fromRewardCatalog(row = {}) {
  const { cost_points: costPointsSnake, category_id: categoryIdSnake, category_name: categoryNameSnake, created_at: createdAtSnake, ...rest } = row;
  const costPoints = Number(row.costPoints ?? costPointsSnake ?? 0);
  return {
    ...rest,
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    categoryId: row.categoryId || categoryIdSnake || "",
    categoryName: row.categoryName || categoryNameSnake || "",
    costPoints: Number.isFinite(costPoints) ? costPoints : 0,
    status: normalizedRewardCatalogStatus(row.status),
    color: row.color || "#2F8F5B",
    createdAt: row.createdAt || createdAtSnake,
  };
}

function fromRewardCategory(row = {}) {
  const { created_at: createdAtSnake, updated_at: updatedAtSnake, ...rest } = row || {};
  return {
    ...rest,
    id: row?.id || "",
    name: row?.name || "",
    description: row?.description || "",
    status: normalizedRewardCatalogStatus(row?.status || "active"),
    color: row?.color || "#2F8F5B",
    createdAt: row?.createdAt || createdAtSnake,
    updatedAt: row?.updatedAt || updatedAtSnake,
  };
}

function fromAvatarPreset(row = {}) {
  const { image_url: imageUrlSnake, created_at: createdAtSnake, updated_at: updatedAtSnake, ...rest } = row;
  const sortOrder = Number(row.sortOrder ?? row.sort_order ?? 0);
  return {
    ...rest,
    key: row.key || row.id || "",
    label: row.label || "Avatar Eco-loop",
    imageUrl: absoluteAssetUrl(row.imageUrl || imageUrlSnake || ""),
    background: "#cbf9e4",
    tile: "#a8f2ab",
    accent: "#8bc34a",
    face: "#2c6e6e",
    status: "active",
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    createdAt: row.createdAt || createdAtSnake,
    updatedAt: row.updatedAt || updatedAtSnake,
  };
}

function fromWasteType(row = {}) {
  const { point_per_unit: pointPerUnitSnake, recycle_method: recycleMethodSnake, ...rest } = row || {};
  const pointPerUnit = Number(row?.pointPerUnit ?? pointPerUnitSnake ?? 0);
  return {
    ...rest,
    id: row?.id || "",
    name: row?.name || row?.id || "",
    unit: row?.unit || "",
    pointPerUnit: Number.isFinite(pointPerUnit) ? pointPerUnit : 0,
    recycleMethod: row?.recycleMethod || recycleMethodSnake || "",
    status: row?.status || "active",
  };
}

function fromProofImage(row = {}) {
  const { submission_id: submissionIdSnake, image_url: imageUrlSnake, image_hash: imageHashSnake, captured_at: capturedAtSnake, verification_code: verificationCodeSnake, ...rest } = row || {};
  return {
    ...rest,
    id: row?.id || "",
    submissionId: row?.submissionId || submissionIdSnake || "",
    imageUrl: absoluteAssetUrl(row?.imageUrl || imageUrlSnake || ""),
    imageHash: row?.imageHash || imageHashSnake || "",
    capturedAt: row?.capturedAt || capturedAtSnake || "",
    verificationCode: row?.verificationCode || verificationCodeSnake || "",
    status: row?.status || "pending",
    note: row?.note || "",
  };
}

function fromRecyclingSubmission(row = {}) {
  const { user_id: userIdSnake, bin_id: binIdSnake, waste_type_id: wasteTypeIdSnake, actual_quantity: actualQuantitySnake, qr_token: qrTokenSnake, expired_at: expiredAtSnake, created_at: createdAtSnake, verified_by: verifiedBySnake, verified_at: verifiedAtSnake, volunteer_note: volunteerNoteSnake, ...rest } = row || {};
  const quantity = Number(row?.quantity ?? 0);
  const actualQuantity = normalizeNumber(row?.actualQuantity ?? actualQuantitySnake, null);
  return {
    ...rest,
    id: row?.id || "",
    userId: row?.userId || userIdSnake || "",
    binId: row?.binId || binIdSnake || "",
    wasteTypeId: row?.wasteTypeId || wasteTypeIdSnake || "",
    quantity: Number.isFinite(quantity) ? quantity : 0,
    actualQuantity,
    status: row?.status || "CREATED",
    qrToken: row?.qrToken || qrTokenSnake || "",
    expiredAt: row?.expiredAt || expiredAtSnake || "",
    createdAt: row?.createdAt || createdAtSnake || "",
    verifiedBy: row?.verifiedBy || verifiedBySnake || "",
    verifiedAt: row?.verifiedAt || verifiedAtSnake || "",
    volunteerNote: row?.volunteerNote || volunteerNoteSnake || "",
  };
}

function toRecyclingSubmissionUpdate(item) {
  return {
    id: item.id,
    status: item.status,
    actual_quantity: item.actualQuantity ?? null,
    verified_at: item.verifiedAt || null,
    volunteer_note: item.volunteerNote || "",
  };
}

function toRewardCatalog(item) {
  const normalized = fromRewardCatalog(item);
  return {
    id: normalized.id || buildRewardProductId(normalized.title),
    title: normalized.title,
    description: normalized.description || "",
    category_id: normalized.categoryId || null,
    category_name: normalized.categoryName || "",
    cost_points: Number(normalized.costPoints || 0),
    status: normalized.status || "active",
    color: normalized.color || "#2F8F5B",
  };
}

function toRewardCategory(item) {
  const normalized = fromRewardCategory(item);
  return {
    id: normalized.id || buildRewardProductId(normalized.name || "category"),
    name: normalized.name,
    description: normalized.description || "",
    status: normalized.status || "active",
    color: normalized.color || "#2F8F5B",
  };
}

function toAvatarPreset(item) {
  const normalized = fromAvatarPreset(item);
  return {
    key: normalized.key || buildAvatarPresetKey(normalized.label),
    label: normalized.label,
    image_url: normalized.imageUrl || null,
    sort_order: Number(normalized.sortOrder || 0),
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

function enrichRecyclingSubmissions(submissions, users, bins, wasteTypes, proofImages) {
  return submissions.map(item => {
    const user = users.find(row => row.id === item.userId);
    const bin = bins.find(row => row.id === item.binId);
    const wasteType = wasteTypes.find(row => row.id === item.wasteTypeId);
    const proofs = proofImages.filter(row => row.submissionId === item.id);
    return {
      ...item,
      userName: user?.name || item.userId || "Không rõ người dùng",
      userGroup: user?.group || "",
      binName: bin?.name || item.binId || "Chưa gắn trạm",
      binLocation: bin?.location || "",
      wasteTypeName: wasteType?.name || item.wasteTypeId || "Chưa rõ loại rác",
      wasteTypeUnit: wasteType?.unit || "",
      pointPerUnit: wasteType?.pointPerUnit || 0,
      proofImages: proofs,
      proofCount: proofs.length,
      proofImageUrl: proofs.find(row => row.imageUrl)?.imageUrl || "",
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

function fromFeedback(row = {}) {
  const { user_name: userNameSnake, bin_id: binIdSnake, admin_note: adminNoteSnake, resolved_at: resolvedAtSnake, ...rest } = row;
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

function fromSettings(row = {}) {
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

export async function signInAdmin(email, password) {
  const payload = await requestBackend("/api/auth/login", { method: "POST", body: { email, password } });
  const profile = fromUser(payload.user || {});
  if (!isActiveAdminProfile(profile)) throw new Error("Tài khoản chưa có quyền admin hoặc đang bị khóa.");
  localStorage.setItem(TOKEN_KEY, payload.token || "");
  return { user: profile, token: payload.token, session: { user: profile } };
}

export async function signOutAdmin() {
  try {
    await requestBackend("/api/auth/logout", { method: "POST" });
  } catch {
    // Local token is the source of the browser session; clear it even if backend logout is unreachable.
  } finally {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function loadAdminSession() {
  if (!localStorage.getItem(TOKEN_KEY)) return result(null);
  try {
    const payload = await requestBackend("/api/auth/me");
    const profile = fromUser(payload.user || {});
    return result({ user: profile, profile: isActiveAdminProfile(profile) ? profile : null });
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    return result(null, BACKEND, error);
  }
}

export async function getAdminProfile(user) {
  if (!user) return result(null);
  const profile = fromUser(user);
  return result(isActiveAdminProfile(profile) ? profile : null);
}

export async function listPredictions() {
  const rows = await listResource("predictions", fromPrediction);
  return result([...rows.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), rows.source, rows.error);
}

export async function savePredictionRecord(record) {
  const rawClass = typeof record?.class === "string" ? record.class : typeof record?.className === "string" ? record.className : "";
  const classKey = rawClass.trim().toLowerCase();
  const source = typeof record?.source === "string" ? record.source.trim().toLowerCase() : "";
  const confidence = Number(record?.confidence);
  const status = normalizedStatus(record?.status, "pending");
  if (!classKey || !PREDICTION_SOURCES.includes(source) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !PREDICTION_STATUSES.includes(status)) {
    return result(null, BACKEND, new Error("Invalid prediction record"));
  }
  const appRecord = fromPrediction({ ...record, class: classKey, source, confidence, status });
  return saveResource("predictions", toPrediction(appRecord), fromPrediction);
}

export async function uploadPredictionImage(file) {
  const imageName = typeof file?.name === "string" && file.name.trim() ? file.name.trim() : "capture.jpg";
  const imageType = typeof file?.type === "string" ? file.type : "";
  if (!file || (imageType && !imageType.startsWith("image/"))) {
    return result(null, BACKEND, new Error("Invalid prediction image"));
  }
  try {
    const formData = new FormData();
    formData.append("file", file, imageName);
    const payload = await requestBackend("/api/uploads/predictions", { method: "POST", body: formData });
    return result({ ...payload.data, imageUrl: absoluteAssetUrl(payload.data?.imageUrl || ""), thumbnailUrl: absoluteAssetUrl(payload.data?.thumbnailUrl || "") });
  } catch (error) {
    return result(null, BACKEND, error);
  }
}

export async function uploadAvatarPresetImage(file, presetKey = "avatar") {
  const imageName = typeof file?.name === "string" && file.name.trim() ? file.name.trim() : "avatar.png";
  const imageType = typeof file?.type === "string" ? file.type : "";
  if (!file || (imageType && !imageType.startsWith("image/"))) {
    return result(null, BACKEND, new Error("Invalid avatar image"));
  }
  try {
    const formData = new FormData();
    formData.append("key", buildAvatarPresetKey(presetKey));
    formData.append("label", presetKey || "Avatar");
    formData.append("file", file, imageName);
    const payload = await requestBackend("/api/avatar-presets", { method: "POST", body: formData });
    return result({ imageName, imageUrl: absoluteAssetUrl(payload.imageUrl || ""), storagePath: payload.key || "" });
  } catch (error) {
    return result(null, BACKEND, error);
  }
}

export async function setPredictionStatus(record, status) {
  const nextStatus = normalizedPredictionStatusAction(status);
  const currentRecord = { ...record, status: normalizedStatus(record.status) };
  if (!nextStatus) return result(currentRecord, BACKEND, new Error("Invalid prediction status"));
  const nextRecord = { ...record, status: nextStatus };
  const saved = await saveResource("predictions", toPrediction(nextRecord), fromPrediction);
  if (saved.error || !saved.data) return saved;
  if (nextStatus === "approved" && record.userId && record.binId) {
    const history = await listPointHistory();
    const alreadyAwarded = hasPointHistoryForPrediction(history.data, record.id);
    const rules = await listPointRules();
    const rule = rules.data.find(item => normalizedEnabled(item.enabled) && ruleMatchesClass(item, record.class));
    if (!alreadyAwarded && rule && rule.points > 0) {
      await saveManualPointHistory(buildPointHistoryRecord(record, rule));
    }
  }
  return result(saved.data);
}

export async function listUsers() {
  return listResource("users", fromUser);
}

export async function saveUser(user) {
  const name = typeof user.name === "string" ? user.name.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const role = normalizedUserRole(user.role);
  const status = normalizedUserStatusAction(user.status || "active");
  if (!name || !EMAIL_PATTERN.test(email) || !role || !status) return result(null, BACKEND, new Error("Invalid user profile"));
  const payload = fromUser({ ...user, name, email, role, status, group: typeof user.group === "string" ? user.group.trim() : user.group, createdAt: user.createdAt || new Date().toISOString() });
  return saveResource("users", toUser(payload), fromUser);
}

export async function updateUserStatus(user, status) {
  const nextStatus = normalizedUserStatusAction(status);
  if (!nextStatus) return result(user, BACKEND, new Error("Invalid user status"));
  try {
    const payload = await requestBackend(`/api/users/${encodeURIComponent(user.id)}/status`, { method: "PATCH", body: { status: nextStatus } });
    return result(fromUser(payload.user || { ...user, status: nextStatus }));
  } catch (error) {
    return result(null, BACKEND, error);
  }
}

export async function listBins() {
  return listResource("bins", fromBin);
}

export async function saveBin(bin) {
  const id = typeof bin.id === "string" ? bin.id.trim() : "";
  const name = typeof bin.name === "string" ? bin.name.trim() : "";
  const location = typeof bin.location === "string" ? bin.location.trim() : "";
  const binGroup = normalizedBinGroup(bin.binGroup);
  const status = normalizedBinStatusAction(bin.status || "active");
  if (!id || !name || !location || !binGroup || !status) return result(null, BACKEND, new Error("Invalid bin station"));
  const payload = { ...bin, id, name, binGroup, location, status, building: typeof bin.building === "string" ? bin.building.trim() : bin.building, floor: typeof bin.floor === "string" ? bin.floor.trim() : bin.floor, qrCode: buildStationQrCode(bin.qrCode || id || name), capacity: normalizePercent(bin.capacity, 0), mapX: normalizePercent(bin.mapX), mapY: normalizePercent(bin.mapY) };
  return saveResource("bins", toBin(payload), fromBin);
}

export async function updateBinStatus(bin, status) {
  const nextStatus = normalizedBinStatusAction(status);
  if (!nextStatus) return result(bin, BACKEND, new Error("Invalid bin status"));
  return saveBin({ ...bin, status: nextStatus });
}

export async function listFeedback() {
  const rows = await listResource("feedback", fromFeedback);
  return result([...rows.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), rows.source, rows.error);
}

export async function saveFeedbackItem(feedback) {
  const message = typeof feedback.message === "string" ? feedback.message.trim() : "";
  const status = normalizedFeedbackStatusAction(feedback.status || "unread");
  const priority = normalizedFeedbackPriorityAction(feedback.priority || "medium");
  if (!message || !status || !priority) return result(null, BACKEND, new Error("Invalid feedback message"));
  const payload = normalizeFeedback({ ...feedback, message, id: feedback.id || `FB-${Date.now()}-${Math.random().toString(16).slice(2)}`, status, priority, timestamp: feedback.timestamp || new Date().toISOString() });
  return saveResource("feedback", toFeedback(payload), fromFeedback);
}

export async function updateFeedbackItem(feedback, updates) {
  const currentFeedback = normalizeFeedback(feedback);
  const hasStatusUpdate = Object.prototype.hasOwnProperty.call(updates, "status");
  const hasPriorityUpdate = Object.prototype.hasOwnProperty.call(updates, "priority");
  const hasMessageUpdate = Object.prototype.hasOwnProperty.call(updates, "message");
  const nextStatus = hasStatusUpdate ? normalizedFeedbackStatusAction(updates.status) : "";
  const nextPriority = hasPriorityUpdate ? normalizedFeedbackPriorityAction(updates.priority) : "";
  const nextMessage = hasMessageUpdate && typeof updates.message === "string" ? updates.message.trim() : "";
  if (hasStatusUpdate && !nextStatus) return result(currentFeedback, BACKEND, new Error("Invalid feedback status"));
  if (hasPriorityUpdate && !nextPriority) return result(currentFeedback, BACKEND, new Error("Invalid feedback priority"));
  if (hasMessageUpdate && !nextMessage) return result(currentFeedback, BACKEND, new Error("Invalid feedback message"));
  const nextFeedback = normalizeFeedback({ ...feedback, ...updates, ...(hasStatusUpdate ? { status: nextStatus } : {}), ...(hasPriorityUpdate ? { priority: nextPriority } : {}), ...(hasMessageUpdate ? { message: nextMessage } : {}) });
  return saveResource("feedback", toFeedback(nextFeedback), fromFeedback);
}

export async function updateFeedbackStatus(feedback, status) {
  const nextStatus = normalizedFeedbackStatusAction(status);
  if (!nextStatus) return result(normalizeFeedback(feedback), BACKEND, new Error("Invalid feedback status"));
  const updates = nextStatus === "resolved" ? { status: nextStatus, resolvedAt: new Date().toISOString() } : { status: nextStatus };
  return updateFeedbackItem(feedback, updates);
}

export async function listPointRules() {
  return listResource("point-rules", fromPointRule);
}

export async function savePointRules(rules) {
  if (!Array.isArray(rules)) return result([], BACKEND, new Error("Invalid point rules"));
  try {
    const saved = await Promise.all(rules.map(rule => saveResource("point-rules", toPointRule(rule), fromPointRule)));
    const error = saved.find(item => item.error)?.error || null;
    return result(saved.map(item => item.data).filter(Boolean), BACKEND, error);
  } catch (error) {
    return result(null, BACKEND, error);
  }
}

export async function listPointHistory() {
  const [history, users, bins] = await Promise.all([listResource("point-history", fromPointHistory), listUsers(), listBins()]);
  const sources = [history, users, bins];
  const error = sources.find(item => item.error)?.error || null;
  const data = enrichPointHistory(history.data, users.data, bins.data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return result(data, BACKEND, error);
}

export async function saveManualPointHistory(record) {
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";
  const action = typeof record.action === "string" ? record.action.trim() : "";
  const points = Number(record.points);
  if (!userId || !action || !Number.isFinite(points) || points === 0) return result(null, BACKEND, new Error("Invalid manual point record"));
  const timestamp = new Date().toISOString();
  const pointRecord = fromPointHistory({ predictionId: record.predictionId || null, userId, binId: record.binId || null, class: record.class || "manual_adjustment", binGroup: record.binGroup || "Điều chỉnh", action, points, timestamp, createdAt: timestamp, source: record.source || "manual_adjustment", adminNote: record.adminNote || "", description: record.description || action, status: "confirmed" });
  const saved = await saveResource("point-history", toPointHistory(pointRecord), fromPointHistory);
  if (saved.error || !saved.data) return saved;
  const users = await listUsers();
  const user = users.data.find(item => item.id === pointRecord.userId);
  if (user) await saveUser({ ...user, points: addPoints(user.points, pointRecord.points) });
  return result(pointRecord);
}

export async function listRewardRedemptions() {
  const [rewards, users] = await Promise.all([listResource("reward-redemptions", fromRewardRedemption), listUsers()]);
  const error = rewards.error || users.error || null;
  const data = rewards.data.map(item => {
    const user = users.data.find(row => row.id === item.userId);
    return { ...item, userName: user?.name || item.userId || "Chưa rõ người dùng", userGroup: user?.group || "" };
  }).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  return result(data, BACKEND, error);
}

export async function listRewards() {
  const rows = await listResource("rewards", fromRewardCatalog);
  return result([...rows.data].sort((a, b) => Number(a.costPoints || 0) - Number(b.costPoints || 0)), rows.source, rows.error);
}

export async function listRewardCategories() {
  const rows = await listResource("reward-categories", fromRewardCategory);
  return result([...rows.data].sort((a, b) => a.name.localeCompare(b.name, "vi")), rows.source, rows.error);
}

export async function listAvatarPresets() {
  try {
    const payload = await requestBackend("/api/avatar-presets");
    return result((payload || []).map(fromAvatarPreset).sort((a, b) => a.label.localeCompare(b.label, "vi")));
  } catch (error) {
    return result([], BACKEND, error);
  }
}

export async function listRecyclingSubmissions() {
  const [submissions, users, bins, wasteTypes, proofImages] = await Promise.all([
    listResource("recycling-submissions", fromRecyclingSubmission),
    listUsers(),
    listBins(),
    listResource("waste-types", fromWasteType),
    listResource("proof-images", fromProofImage),
  ]);
  const sources = [submissions, users, bins, wasteTypes, proofImages];
  const error = sources.find(item => item.error)?.error || null;
  const data = enrichRecyclingSubmissions(submissions.data, users.data, bins.data, wasteTypes.data, proofImages.data)
    .sort((a, b) => new Date(b.createdAt || b.verifiedAt || 0) - new Date(a.createdAt || a.verifiedAt || 0));
  return result(data, BACKEND, error);
}

export async function updateRecyclingSubmissionReview(item, updates) {
  const current = fromRecyclingSubmission(item);
  const nextStatus = String(updates.status || current.status || "").trim().toUpperCase();
  if (!nextStatus || ["POINT_CONFIRMED", "LOCKED"].includes(String(current.status || "").trim().toUpperCase())) {
    return result(current, BACKEND, new Error("Invalid recycling submission status"));
  }
  const next = fromRecyclingSubmission({ ...current, status: nextStatus, volunteerNote: typeof updates.volunteerNote === "string" ? updates.volunteerNote.trim() : current.volunteerNote, verifiedAt: updates.verifiedAt || new Date().toISOString() });
  return saveResource("recycling-submissions", toRecyclingSubmissionUpdate(next), fromRecyclingSubmission);
}

export async function saveRewardProduct(item) {
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const description = typeof item.description === "string" ? item.description.trim() : "";
  const costPoints = Number(item.costPoints);
  const status = normalizedRewardCatalogStatus(item.status || "active", "");
  if (!title || !Number.isFinite(costPoints) || costPoints < 0 || !status) return result(null, BACKEND, new Error("Invalid reward product"));
  const payload = fromRewardCatalog({ ...item, id: item.id || buildRewardProductId(title), title, description, costPoints, status, color: item.color || "#2F8F5B" });
  return saveResource("rewards", toRewardCatalog(payload), fromRewardCatalog);
}

export async function saveRewardCategory(item) {
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const status = normalizedRewardCatalogStatus(item.status || "active", "");
  if (!name || !status) return result(null, BACKEND, new Error("Invalid reward category"));
  const payload = fromRewardCategory({ ...item, id: item.id || buildRewardProductId(name), name, status, color: item.color || "#2F8F5B" });
  return saveResource("reward-categories", toRewardCategory(payload), fromRewardCategory);
}

export async function deleteRewardCategory(categoryId) {
  return deleteResource("reward-categories", categoryId);
}

export async function saveAvatarPreset(item) {
  const label = typeof item.label === "string" ? item.label.trim() : "";
  const key = buildAvatarPresetKey(item.key || label);
  const file = item.file;
  if (!key || !label || !file) return result(null, BACKEND, new Error("Invalid avatar preset"));
  try {
    const formData = new FormData();
    formData.append("key", key);
    formData.append("label", label);
    formData.append("file", file, file.name || "avatar.png");
    const payload = await requestBackend("/api/avatar-presets", { method: "POST", body: formData });
    return result(fromAvatarPreset(payload));
  } catch (error) {
    return result(null, BACKEND, error);
  }
}

export async function saveRewardRedemption(item) {
  const userId = typeof item.userId === "string" ? item.userId.trim() : "";
  const rewardLabel = typeof item.rewardLabel === "string" ? item.rewardLabel.trim() : "";
  const costPoints = Number(item.costPoints);
  if (!userId || !rewardLabel || !Number.isFinite(costPoints) || costPoints <= 0) return result(null, BACKEND, new Error("Invalid reward redemption"));
  const payload = fromRewardRedemption({ ...item, userId, rewardLabel, costPoints, id: item.id || `RW-${Date.now()}`, status: item.status || "pending", requestedAt: item.requestedAt || new Date().toISOString() });
  return saveResource("reward-redemptions", toRewardRedemption(payload), fromRewardRedemption);
}

export async function updateRewardRedemption(item, updates) {
  const currentItem = fromRewardRedemption(item);
  const hasStatusUpdate = Object.prototype.hasOwnProperty.call(updates, "status");
  if (hasStatusUpdate && !normalizedRewardStatusAction(updates.status)) return result(currentItem, BACKEND, new Error("Invalid reward status"));
  const nextItem = fromRewardRedemption({ ...item, ...updates, ...(hasStatusUpdate ? { status: normalizedRewardStatusAction(updates.status), reviewedAt: new Date().toISOString() } : {}) });
  return saveResource("reward-redemptions", toRewardRedemption(nextItem), fromRewardRedemption);
}

export async function getModelSettings() {
  const rows = await listResource("settings", fromSettings);
  return result(rows.data[0] || { threshold: 0.65, modelName: "MobileNetV2", classCount: WASTE_CLASSES.length }, BACKEND, rows.error);
}

export async function saveModelThreshold(threshold) {
  const payload = { threshold: normalizeModelThreshold(threshold), modelName: "MobileNetV2", classCount: WASTE_CLASSES.length, updatedAt: new Date().toISOString() };
  return saveResource("settings", toSettings(payload), fromSettings);
}

export async function loadDashboardData() {
  const [predictions, bins, users, pointRules, feedback, pointHistory, settings] = await Promise.all([listPredictions(), listBins(), listUsers(), listPointRules(), listFeedback(), listPointHistory(), getModelSettings()]);
  const sources = [predictions, bins, users, pointRules, feedback, pointHistory, settings];
  const error = sources.find(item => item.error)?.error || null;
  return result({ predictions: predictions.data, bins: bins.data, users: users.data, pointRules: pointRules.data, feedback: feedback.data, pointHistory: pointHistory.data, settings: settings.data }, BACKEND, error);
}

export const __testing = {
  fromBin,
  toBin,
  applyBinRealtimeChange,
  fromPrediction,
  toPrediction,
  buildPredictionImagePath,
  fromPointRule,
  toPointRule,
  fromPointHistory,
  toPointHistory,
  fromFeedback,
  toFeedback,
  fromRewardRedemption,
  toRewardRedemption,
  fromRewardCatalog,
  toRewardCatalog,
  fromRewardCategory,
  toRewardCategory,
  fromAvatarPreset,
  toAvatarPreset,
  buildStationQrCode,
  buildStationQrPayload,
  fromWasteType,
  fromProofImage,
  fromRecyclingSubmission,
  toRecyclingSubmissionUpdate,
  fromSettings,
  toSettings,
  fromUser,
  toUser,
  requestBackend,
};
