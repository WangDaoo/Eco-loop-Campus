export const LOCAL_PREDICTIONS_KEY = "smartWastePredictions";
export const POINT_RULES_KEY = "ecoGuardianPointRules";
export const POINT_HISTORY_KEY = "ecoGuardianPointHistory";
export const REWARDS_KEY = "ecoGuardianRewards";
export const REWARD_REDEMPTIONS_KEY = "ecoGuardianRewardRedemptions";
export const USERS_KEY = "ecoGuardianUsers";
export const BINS_KEY = "ecoGuardianBins";
export const FEEDBACK_KEY = "ecoGuardianFeedback";
export const MODEL_THRESHOLD_KEY = "ecoGuardianModelThreshold";

export const BIN_GROUPS = [
  { id: "organic", label: "Hữu cơ", color: "#2ca87f" },
  { id: "recycle", label: "Tái chế", color: "#4680ff" },
  { id: "hazard", label: "Pin / nguy hại", color: "#e58a00" },
  { id: "remain", label: "Còn lại", color: "#6b7280" },
];

export const WASTE_CLASSES = [
  { key: "battery", label: "Pin", binGroup: "Pin / nguy hại" },
  { key: "biological", label: "Rác hữu cơ", binGroup: "Hữu cơ" },
  { key: "cardboard", label: "Bìa carton", binGroup: "Tái chế" },
  { key: "clothes", label: "Quần áo", binGroup: "Còn lại" },
  { key: "glass", label: "Thủy tinh", binGroup: "Tái chế" },
  { key: "metal", label: "Kim loại", binGroup: "Tái chế" },
  { key: "paper", label: "Giấy", binGroup: "Tái chế" },
  { key: "plastic", label: "Nhựa", binGroup: "Tái chế" },
  { key: "shoes", label: "Giày dép", binGroup: "Còn lại" },
  { key: "trash", label: "Rác còn lại", binGroup: "Còn lại" },
];

export const DEFAULT_POINT_RULES = [
  {
    id: "recycle",
    label: "Rác tái chế hợp lệ",
    classKeys: ["paper", "cardboard", "plastic", "glass", "metal"],
    binGroup: "Tái chế",
    points: 5,
    enabled: true,
  },
  {
    id: "organic",
    label: "Rác hữu cơ đúng thùng",
    classKeys: ["biological"],
    binGroup: "Hữu cơ",
    points: 3,
    enabled: true,
  },
  {
    id: "hazard",
    label: "Pin / rác nguy hại nộp đúng điểm",
    classKeys: ["battery"],
    binGroup: "Pin / nguy hại",
    points: 8,
    enabled: true,
  },
  {
    id: "remain",
    label: "Lượt bị admin từ chối",
    classKeys: ["clothes", "shoes", "trash"],
    binGroup: "Còn lại",
    points: 0,
    enabled: false,
  },
];

export const STATUS_LABELS = {
  pending: "Cần duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  active: "Hoạt động",
  full: "Đầy",
  maintenance: "Bảo trì",
  locked: "Đã khóa",
  read: "Đã đọc",
  unread: "Chưa đọc",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
};

export function getWasteClass(classKey) {
  const normalizedKey = typeof classKey === "string" ? classKey.trim().toLowerCase() : "";
  return WASTE_CLASSES.find(item => item.key === normalizedKey) || {
    key: normalizedKey || "unknown",
    label: normalizedKey || "Không rõ",
    binGroup: "Còn lại",
  };
}

export function getWasteLabel(classKey) {
  return getWasteClass(classKey).label;
}

export function getBinGroup(classKey) {
  return getWasteClass(classKey).binGroup;
}

export function getGroupColor(groupLabel) {
  const normalizedLabel = typeof groupLabel === "string" ? groupLabel.trim().toLocaleLowerCase("vi-VN") : "";
  return (BIN_GROUPS.find(group => group.label.toLocaleLowerCase("vi-VN") === normalizedLabel) || BIN_GROUPS[3]).color;
}

function normalizeConfidence(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeStatus(value, fallback = "pending") {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : fallback;
}

function normalizeImageUrl(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function normalizePrediction(record) {
  const rawClass = typeof record.class === "string" ? record.class : typeof record.className === "string" ? record.className : "trash";
  const classKey = rawClass.trim().toLowerCase() || "trash";
  const confidence = normalizeConfidence(record.confidence);

  return {
    id: record.id || `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    class: classKey,
    confidence,
    source: record.source || "upload",
    timestamp: record.timestamp || new Date().toISOString(),
    binGroup: record.binGroup || getBinGroup(classKey),
    status: normalizeStatus(record.status),
    userId: record.userId ?? null,
    binId: record.binId ?? null,
    imageName: record.imageName || record.fileName || "Ảnh kiểm thử",
    imageUrl: normalizeImageUrl(record.imageUrl || record.image_url),
    thumbnailUrl: normalizeImageUrl(record.thumbnailUrl || record.thumbnail_url),
  };
}
