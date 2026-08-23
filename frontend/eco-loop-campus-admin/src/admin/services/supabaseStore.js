import { isSupabaseConfigured, supabase } from "../../supabaseClient";
import {
  BIN_GROUPS,
  WASTE_CLASSES,
  getBinGroup,
  getWasteLabel,
  normalizePrediction,
} from "../data/wasteConfig";
import { FEEDBACK_PRIORITIES, FEEDBACK_STATUSES, normalizeFeedback } from "../data/feedbackConfig";

const SUPABASE = "supabase";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREDICTION_IMAGE_BUCKET = "prediction-images";
const AVATAR_PRESET_BUCKET = "avatar-presets";

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
const REWARD_CATALOG_STATUSES = ["active", "inactive"];
const USER_ROLES = ["student", "teacher", "volunteer", "admin"];
const USER_STATUS_ACTIONS = ["active", "locked", "pending", "rejected"];
const BIN_STATUS_ACTIONS = ["active", "full", "maintenance"];

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
  if (!isSupabaseConfigured || !supabase || typeof supabase.channel !== "function") return () => {};
  const channel = supabase
    .channel("ecoloop-admin-bins")
    .on("postgres_changes", { event: "*", schema: "public", table: "bins" }, payload => onChange(payload))
    .subscribe();
  return () => {
    if (typeof supabase.removeChannel === "function") supabase.removeChannel(channel);
  };
}

function fromUser(row) {
  const { created_at: createdAtSnake, avatar_key: avatarKeySnake, avatar_url: avatarUrlSnake, ...rest } = row;
  const points = Number(row.points ?? 0);
  return {
    ...rest,
    points: Number.isFinite(points) ? points : 0,
    createdAt: row.createdAt || createdAtSnake,
    avatarKey: row.avatarKey || avatarKeySnake || '',
    avatarUrl: row.avatarUrl || avatarUrlSnake || '',
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

function fromPrediction(row) {
  return normalizePrediction({
    ...row,
    binGroup: row.binGroup || row.bin_group,
    userId: row.userId || row.user_id,
    binId: row.binId || row.bin_id,
    imageName: row.imageName || row.image_name,
    imageUrl: row.imageUrl || row.image_url,
    thumbnailUrl: row.thumbnailUrl || row.thumbnail_url,
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

function fromRewardCatalog(row) {
  const { cost_points: costPointsSnake, created_at: createdAtSnake, ...rest } = row;
  const costPoints = Number(row.costPoints ?? costPointsSnake ?? 0);
  return {
    ...rest,
    id: row.id,
    title: row.title || "",
    description: row.description || "",
    costPoints: Number.isFinite(costPoints) ? costPoints : 0,
    status: normalizedRewardCatalogStatus(row.status),
    color: row.color || "#2F8F5B",
    createdAt: row.createdAt || createdAtSnake,
  };
}

function fromAvatarPreset(row = {}) {
  const { image_url: imageUrlSnake, sort_order: sortOrderSnake, created_at: createdAtSnake, updated_at: updatedAtSnake, ...rest } = row;
  const sortOrder = Number(row.sortOrder ?? sortOrderSnake ?? 0);
  const status = normalizedRewardCatalogStatus(row.status || "active");
  return {
    ...rest,
    key: row.key || row.id || "",
    label: row.label || "Avatar Eco-loop",
    imageUrl: row.imageUrl || imageUrlSnake || "",
    background: row.background || "#cbf9e4",
    tile: row.tile || "#a8f2ab",
    accent: row.accent || "#8bc34a",
    face: row.face || "#2c6e6e",
    status,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    createdAt: row.createdAt || createdAtSnake,
    updatedAt: row.updatedAt || updatedAtSnake,
  };
}

function fromWasteType(row) {
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

function fromProofImage(row) {
  const {
    submission_id: submissionIdSnake,
    image_url: imageUrlSnake,
    image_hash: imageHashSnake,
    captured_at: capturedAtSnake,
    verification_code: verificationCodeSnake,
    ...rest
  } = row || {};
  return {
    ...rest,
    id: row?.id || "",
    submissionId: row?.submissionId || submissionIdSnake || "",
    imageUrl: row?.imageUrl || imageUrlSnake || "",
    imageHash: row?.imageHash || imageHashSnake || "",
    capturedAt: row?.capturedAt || capturedAtSnake || "",
    verificationCode: row?.verificationCode || verificationCodeSnake || "",
    status: row?.status || "pending",
    note: row?.note || "",
  };
}

function fromRecyclingSubmission(row) {
  const {
    user_id: userIdSnake,
    bin_id: binIdSnake,
    waste_type_id: wasteTypeIdSnake,
    actual_quantity: actualQuantitySnake,
    qr_token: qrTokenSnake,
    expired_at: expiredAtSnake,
    created_at: createdAtSnake,
    verified_by: verifiedBySnake,
    verified_at: verifiedAtSnake,
    volunteer_note: volunteerNoteSnake,
    ...rest
  } = row || {};
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
    cost_points: Number(normalized.costPoints || 0),
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
    background: normalized.background || "#cbf9e4",
    tile: normalized.tile || "#a8f2ab",
    accent: normalized.accent || "#8bc34a",
    face: normalized.face || "#2c6e6e",
    status: normalized.status || "active",
    sort_order: Number(normalized.sortOrder || 0),
    updated_at: new Date().toISOString(),
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

async function readTable(tableName, mapper = item => item) {
  try {
    const response = await client().from(tableName).select("*");
    if (response.error) throw response.error;
    return result((response.data || []).map(mapper), SUPABASE);
  } catch (error) {
    return result([], SUPABASE, error);
  }
}

async function upsert(tableName, dbPayload, appPayload) {
  try {
    const response = await client().from(tableName).upsert(dbPayload);
    if (response.error) throw response.error;
    return result(appPayload, SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

async function mutationWithOptionalSingleSelect(query) {
  const selectedQuery = typeof query?.select === "function" ? query.select("*").single() : query;
  const response = await selectedQuery;
  if (response.error) throw response.error;
  return Array.isArray(response.data) ? response.data[0] : response.data;
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
  if (!user?.email) return result(null, SUPABASE);
  const users = await listUsers();
  const email = user.email.trim().toLowerCase();
  const profile = users.data.find(item => (item.email || "").trim().toLowerCase() === email || item.id === user.id);
  const role = (profile?.role || "").trim().toLowerCase();
  const status = (profile?.status || "active").trim().toLowerCase();
  const isAdmin = role === "admin" || role === "quản trị" || role === "quan tri";
  return result(isAdmin && status === "active" ? { ...profile, uid: user.id } : null, users.source, users.error);
}

export async function listPredictions() {
  const rows = await readTable("predictions", fromPrediction);
  return result([...rows.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), rows.source, rows.error);
}

export async function savePredictionRecord(record) {
  const rawClass = typeof record?.class === "string" ? record.class : typeof record?.className === "string" ? record.className : "";
  const classKey = rawClass.trim().toLowerCase();
  const source = typeof record?.source === "string" ? record.source.trim().toLowerCase() : "";
  const confidence = Number(record?.confidence);
  const status = normalizedStatus(record?.status, "pending");
  if (!classKey || !PREDICTION_SOURCES.includes(source) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1 || !PREDICTION_STATUSES.includes(status)) {
    return result(null, SUPABASE, new Error("Invalid prediction record"));
  }
  const appRecord = fromPrediction({ ...record, class: classKey, source, confidence, status });
  return upsert("predictions", toPrediction(appRecord), appRecord);
}

export async function uploadPredictionImage(file) {
  const imageName = typeof file?.name === "string" && file.name.trim() ? file.name.trim() : "capture.jpg";
  const imageType = typeof file?.type === "string" ? file.type : "";
  if (!file || (imageType && !imageType.startsWith("image/"))) {
    return result(null, SUPABASE, new Error("Invalid prediction image"));
  }
  try {
    const storage = client().storage;
    if (!storage?.from) throw new Error("Supabase Storage unavailable");
    const path = buildPredictionImagePath(imageName);
    const bucket = storage.from(PREDICTION_IMAGE_BUCKET);
    const uploadResponse = await bucket.upload(path, file, {
      cacheControl: "3600",
      contentType: imageType || undefined,
      upsert: false,
    });
    if (uploadResponse.error) throw uploadResponse.error;
    const publicResponse = bucket.getPublicUrl(path);
    const publicUrl = publicResponse?.data?.publicUrl || "";
    if (!publicUrl) throw new Error("Prediction image URL unavailable");
    return result({ imageName, imageUrl: publicUrl, thumbnailUrl: "", storagePath: path }, SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function uploadAvatarPresetImage(file, presetKey = "avatar") {
  const imageName = typeof file?.name === "string" && file.name.trim() ? file.name.trim() : "avatar.png";
  const imageType = typeof file?.type === "string" ? file.type : "";
  if (!file || (imageType && !imageType.startsWith("image/"))) {
    return result(null, SUPABASE, new Error("Invalid avatar image"));
  }
  try {
    const storage = client().storage;
    if (!storage?.from) throw new Error("Supabase Storage unavailable");
    const safeKey = buildAvatarPresetKey(presetKey);
    const path = `${safeKey}/${Date.now()}-${safeImageFileName(imageName)}`;
    const bucket = storage.from(AVATAR_PRESET_BUCKET);
    const uploadResponse = await bucket.upload(path, file, {
      cacheControl: "86400",
      contentType: imageType || undefined,
      upsert: true,
    });
    if (uploadResponse.error) throw uploadResponse.error;
    const publicUrl = bucket.getPublicUrl(path)?.data?.publicUrl || "";
    if (!publicUrl) throw new Error("Avatar image URL unavailable");
    return result({ imageName, imageUrl: publicUrl, storagePath: path }, SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function setPredictionStatus(record, status) {
  const nextStatus = normalizedPredictionStatusAction(status);
  const currentRecord = { ...record, status: normalizedStatus(record.status) };
  if (!nextStatus) return result(currentRecord, SUPABASE, new Error("Invalid prediction status"));
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
    return result(null, SUPABASE, error);
  }
}

export async function listUsers() {
  return readTable("users", fromUser);
}

export async function saveUser(user) {
  const name = typeof user.name === "string" ? user.name.trim() : "";
  const email = typeof user.email === "string" ? user.email.trim() : "";
  const role = normalizedUserRole(user.role);
  const status = normalizedUserStatusAction(user.status || "active");
  if (!name || !EMAIL_PATTERN.test(email) || !role || !status) return result(null, SUPABASE, new Error("Invalid user profile"));
  const payload = fromUser({ ...user, name, email, role, status, group: typeof user.group === "string" ? user.group.trim() : user.group, createdAt: user.createdAt || new Date().toISOString() });
  return upsert("users", toUser(payload), payload);
}

export async function updateUserStatus(user, status) {
  const nextStatus = normalizedUserStatusAction(status);
  if (!nextStatus) return result(user, SUPABASE, new Error("Invalid user status"));
  try {
    const response = await client().from("users").update({ status: nextStatus }).eq("id", user.id);
    if (response.error) throw response.error;
    return result({ ...user, status: nextStatus }, SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function listBins() {
  return readTable("bins", fromBin);
}

export async function saveBin(bin) {
  const id = typeof bin.id === "string" ? bin.id.trim() : "";
  const name = typeof bin.name === "string" ? bin.name.trim() : "";
  const location = typeof bin.location === "string" ? bin.location.trim() : "";
  const binGroup = normalizedBinGroup(bin.binGroup);
  const status = normalizedBinStatusAction(bin.status || "active");
  if (!id || !name || !location || !binGroup || !status) return result(null, SUPABASE, new Error("Invalid bin station"));
  const payload = {
    ...bin,
    id,
    name,
    binGroup,
    location,
    status,
    building: typeof bin.building === "string" ? bin.building.trim() : bin.building,
    floor: typeof bin.floor === "string" ? bin.floor.trim() : bin.floor,
    qrCode: buildStationQrCode(bin.qrCode || id || name),
    capacity: normalizePercent(bin.capacity, 0),
    mapX: normalizePercent(bin.mapX),
    mapY: normalizePercent(bin.mapY),
  };
  try {
    const row = await mutationWithOptionalSingleSelect(client().from("bins").upsert(toBin(payload)));
    return result(fromBin(row || toBin(payload)), SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function updateBinStatus(bin, status) {
  const nextStatus = normalizedBinStatusAction(status);
  if (!nextStatus) return result(bin, SUPABASE, new Error("Invalid bin status"));
  try {
    const row = await mutationWithOptionalSingleSelect(client().from("bins").update({ status: nextStatus }).eq("id", bin.id));
    return result(fromBin(row || { ...toBin(bin), status: nextStatus }), SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function listFeedback() {
  const rows = await readTable("feedback", fromFeedback);
  return result([...rows.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)), rows.source, rows.error);
}

export async function saveFeedbackItem(feedback) {
  const message = typeof feedback.message === "string" ? feedback.message.trim() : "";
  const status = normalizedFeedbackStatusAction(feedback.status || "unread");
  const priority = normalizedFeedbackPriorityAction(feedback.priority || "medium");
  if (!message || !status || !priority) return result(null, SUPABASE, new Error("Invalid feedback message"));
  const payload = normalizeFeedback({
    ...feedback,
    message,
    id: feedback.id || `FB-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    status,
    priority,
    timestamp: feedback.timestamp || new Date().toISOString(),
  });
  return upsert("feedback", toFeedback(payload), payload);
}

export async function updateFeedbackItem(feedback, updates) {
  const currentFeedback = normalizeFeedback(feedback);
  const hasStatusUpdate = Object.prototype.hasOwnProperty.call(updates, "status");
  const hasPriorityUpdate = Object.prototype.hasOwnProperty.call(updates, "priority");
  const hasMessageUpdate = Object.prototype.hasOwnProperty.call(updates, "message");
  const nextStatus = hasStatusUpdate ? normalizedFeedbackStatusAction(updates.status) : "";
  const nextPriority = hasPriorityUpdate ? normalizedFeedbackPriorityAction(updates.priority) : "";
  const nextMessage = hasMessageUpdate && typeof updates.message === "string" ? updates.message.trim() : "";
  if (hasStatusUpdate && !nextStatus) return result(currentFeedback, SUPABASE, new Error("Invalid feedback status"));
  if (hasPriorityUpdate && !nextPriority) return result(currentFeedback, SUPABASE, new Error("Invalid feedback priority"));
  if (hasMessageUpdate && !nextMessage) return result(currentFeedback, SUPABASE, new Error("Invalid feedback message"));
  const nextFeedback = normalizeFeedback({ ...feedback, ...updates, ...(hasStatusUpdate ? { status: nextStatus } : {}), ...(hasPriorityUpdate ? { priority: nextPriority } : {}), ...(hasMessageUpdate ? { message: nextMessage } : {}) });
  try {
    const response = await client().from("feedback").update(toFeedback(nextFeedback)).eq("id", feedback.id);
    if (response.error) throw response.error;
    return result(nextFeedback, SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function updateFeedbackStatus(feedback, status) {
  const nextStatus = normalizedFeedbackStatusAction(status);
  if (!nextStatus) return result(normalizeFeedback(feedback), SUPABASE, new Error("Invalid feedback status"));
  const updates = nextStatus === "resolved"
    ? { status: nextStatus, resolvedAt: new Date().toISOString() }
    : { status: nextStatus };
  return updateFeedbackItem(feedback, updates);
}

export async function listPointRules() {
  return readTable("point_rules", fromPointRule);
}

export async function savePointRules(rules) {
  if (!Array.isArray(rules)) return result([], SUPABASE, new Error("Invalid point rules"));
  try {
    const response = await client().from("point_rules").upsert(rules.map(toPointRule));
    if (response.error) throw response.error;
    return result(rules, SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function listPointHistory() {
  const [history, users, bins] = await Promise.all([
    readTable("point_history", fromPointHistory),
    listUsers(),
    listBins(),
  ]);
  const sources = [history, users, bins];
  const error = sources.find(item => item.error)?.error || null;
  const data = enrichPointHistory(history.data, users.data, bins.data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return result(data, SUPABASE, error);
}

export async function saveManualPointHistory(record) {
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";
  const action = typeof record.action === "string" ? record.action.trim() : "";
  const points = Number(record.points);
  if (!userId || !action || !Number.isFinite(points) || points === 0) {
    return result(null, SUPABASE, new Error("Invalid manual point record"));
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
    return result(null, SUPABASE, error);
  }
}

export async function listRewardRedemptions() {
  const [rewards, users] = await Promise.all([
    readTable("reward_redemptions", fromRewardRedemption),
    listUsers(),
  ]);
  const error = rewards.error || users.error || null;
  const data = rewards.data.map(item => {
    const user = users.data.find(row => row.id === item.userId);
    return {
      ...item,
      userName: user?.name || item.userId || "Chưa rõ người dùng",
      userGroup: user?.group || "",
    };
  }).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  return result(data, SUPABASE, error);
}

export async function listRewards() {
  const rows = await readTable("rewards", fromRewardCatalog);
  return result([...rows.data].sort((a, b) => Number(a.costPoints || 0) - Number(b.costPoints || 0)), rows.source, rows.error);
}

export async function listAvatarPresets() {
  const rows = await readTable("avatar_presets", fromAvatarPreset);
  return result([...rows.data].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)), rows.source, rows.error);
}

export async function listRecyclingSubmissions() {
  const [submissions, users, bins, wasteTypes, proofImages] = await Promise.all([
    readTable("recycling_submissions", fromRecyclingSubmission),
    listUsers(),
    listBins(),
    readTable("waste_types", fromWasteType),
    readTable("proof_images", fromProofImage),
  ]);
  const sources = [submissions, users, bins, wasteTypes, proofImages];
  const error = sources.find(item => item.error)?.error || null;
  const data = enrichRecyclingSubmissions(submissions.data, users.data, bins.data, wasteTypes.data, proofImages.data)
    .sort((a, b) => new Date(b.createdAt || b.verifiedAt || 0) - new Date(a.createdAt || a.verifiedAt || 0));
  return result(data, SUPABASE, error);
}

export async function updateRecyclingSubmissionReview(item, updates) {
  const current = fromRecyclingSubmission(item);
  const nextStatus = String(updates.status || current.status || "").trim().toUpperCase();
  if (!nextStatus || ["POINT_CONFIRMED", "LOCKED"].includes(String(current.status || "").trim().toUpperCase())) {
    return result(current, SUPABASE, new Error("Invalid recycling submission status"));
  }
  const next = fromRecyclingSubmission({
    ...current,
    status: nextStatus,
    volunteerNote: typeof updates.volunteerNote === "string" ? updates.volunteerNote.trim() : current.volunteerNote,
    verifiedAt: updates.verifiedAt || new Date().toISOString(),
  });
  try {
    const response = await client().from("recycling_submissions").update(toRecyclingSubmissionUpdate(next)).eq("id", current.id);
    if (response.error) throw response.error;
    return result(next, SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function saveRewardProduct(item) {
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const description = typeof item.description === "string" ? item.description.trim() : "";
  const costPoints = Number(item.costPoints);
  const status = normalizedRewardCatalogStatus(item.status || "active", "");
  if (!title || !Number.isFinite(costPoints) || costPoints < 0 || !status) {
    return result(null, SUPABASE, new Error("Invalid reward product"));
  }
  const payload = fromRewardCatalog({
    ...item,
    id: item.id || buildRewardProductId(title),
    title,
    description,
    costPoints,
    status,
    color: item.color || "#2F8F5B",
  });
  return upsert("rewards", toRewardCatalog(payload), payload);
}

export async function saveAvatarPreset(item) {
  const label = typeof item.label === "string" ? item.label.trim() : "";
  const status = normalizedRewardCatalogStatus(item.status || "active", "");
  const key = buildAvatarPresetKey(item.key || label);
  if (!key || !label || !status) {
    return result(null, SUPABASE, new Error("Invalid avatar preset"));
  }
  const payload = fromAvatarPreset({
    ...item,
    key,
    label,
    imageUrl: typeof item.imageUrl === "string" ? item.imageUrl.trim() : "",
    status,
    sortOrder: normalizeNumber(item.sortOrder, 0),
  });
  return upsert("avatar_presets", toAvatarPreset(payload), payload);
}

export async function saveRewardRedemption(item) {
  const userId = typeof item.userId === "string" ? item.userId.trim() : "";
  const rewardLabel = typeof item.rewardLabel === "string" ? item.rewardLabel.trim() : "";
  const costPoints = Number(item.costPoints);
  if (!userId || !rewardLabel || !Number.isFinite(costPoints) || costPoints <= 0) {
    return result(null, SUPABASE, new Error("Invalid reward redemption"));
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
  return upsert("reward_redemptions", toRewardRedemption(payload), payload);
}

export async function updateRewardRedemption(item, updates) {
  const currentItem = fromRewardRedemption(item);
  const hasStatusUpdate = Object.prototype.hasOwnProperty.call(updates, "status");
  if (hasStatusUpdate && !normalizedRewardStatusAction(updates.status)) {
    return result(currentItem, SUPABASE, new Error("Invalid reward status"));
  }
  const nextItem = fromRewardRedemption({ ...item, ...updates, ...(hasStatusUpdate ? { status: normalizedRewardStatusAction(updates.status) } : {}) });
  try {
    const response = await client().from("reward_redemptions").update(toRewardRedemption(nextItem)).eq("id", item.id);
    if (response.error) throw response.error;
    return result(nextItem, SUPABASE);
  } catch (error) {
    return result(null, SUPABASE, error);
  }
}

export async function getModelSettings() {
  try {
    const response = await client().from("settings").select("*").eq("id", "model").maybeSingle();
    if (response.error) throw response.error;
    if (response.data) return result(fromSettings(response.data), SUPABASE);
  } catch (error) {
    return result({ threshold: 0.65, modelName: "MobileNetV2", classCount: WASTE_CLASSES.length }, SUPABASE, error);
  }
  return result({ threshold: 0.65, modelName: "MobileNetV2", classCount: WASTE_CLASSES.length }, SUPABASE);
}

export async function saveModelThreshold(threshold) {
  const payload = { threshold: normalizeModelThreshold(threshold), modelName: "MobileNetV2", classCount: WASTE_CLASSES.length, updatedAt: new Date().toISOString() };
  return upsert("settings", toSettings(payload), payload);
}

export async function loadDashboardData() {
  const [predictions, bins, users, pointRules, feedback, pointHistory, settings] = await Promise.all([listPredictions(), listBins(), listUsers(), listPointRules(), listFeedback(), listPointHistory(), getModelSettings()]);
  const sources = [predictions, bins, users, pointRules, feedback, pointHistory, settings];
  const error = sources.find(item => item.error)?.error || null;
  return result({ predictions: predictions.data, bins: bins.data, users: users.data, pointRules: pointRules.data, feedback: feedback.data, pointHistory: pointHistory.data, settings: settings.data }, SUPABASE, error);
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
};
