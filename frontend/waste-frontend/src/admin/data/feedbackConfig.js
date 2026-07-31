export const FEEDBACK_STATUSES = {
  unread: "Chưa xử lý",
  in_progress: "Đang xử lý",
  resolved: "Đã xử lý",
  rejected: "Từ chối",
  read: "Đã đọc",
};

export const FEEDBACK_PRIORITIES = {
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
};

export const OPEN_FEEDBACK_STATUSES = ["unread", "in_progress"];

function statusCode(status) {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

function priorityCode(priority) {
  return typeof priority === "string" ? priority.trim().toLowerCase() : "";
}

export function normalizeFeedback(item = {}) {
  return {
    ...item,
    id: item.id || `FB-${Date.now()}`,
    userName: item.userName || item.user_name || "Người dùng",
    category: item.category || "Khác",
    message: item.message || "",
    status: statusCode(item.status) || "unread",
    priority: priorityCode(item.priority) || "medium",
    binId: item.binId || item.bin_id || "",
    adminNote: item.adminNote || item.admin_note || "",
    resolvedAt: item.resolvedAt || item.resolved_at || "",
    timestamp: item.timestamp || new Date().toISOString(),
  };
}

export function isOpenFeedback(item) {
  return OPEN_FEEDBACK_STATUSES.includes(statusCode(item?.status) || "unread");
}

export function getFeedbackStatusLabel(status) {
  const normalizedStatus = statusCode(status);
  return FEEDBACK_STATUSES[normalizedStatus] || status || "Không rõ";
}

export function getFeedbackPriorityLabel(priority) {
  return FEEDBACK_PRIORITIES[priorityCode(priority)] || FEEDBACK_PRIORITIES.medium;
}
