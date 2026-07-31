function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function safeNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function labelCode(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("vi-VN") : "";
}

function inDateRange(value, filters = {}) {
  const current = dateOnly(value);
  const dateFrom = dateOnly(filters.dateFrom);
  const dateTo = dateOnly(filters.dateTo);
  const hasDateFilter = Boolean(dateFrom || dateTo);
  if (!current) return !hasDateFilter;
  if (dateFrom && current < dateFrom) return false;
  if (dateTo && current > dateTo) return false;
  return true;
}

export function filterPointHistory(history, users, filters = {}) {
  const userMap = new Map(users.map(user => [user.id, user]));
  return (history || []).filter(item => {
    const user = userMap.get(item.userId);
    if (filters.userId && item.userId !== filters.userId) return false;
    if (filters.userGroup && labelCode(user?.group) !== labelCode(filters.userGroup)) return false;
    if (filters.binGroup && labelCode(item.binGroup) !== labelCode(filters.binGroup)) return false;
    return inDateRange(item.timestamp || item.createdAt, filters);
  });
}

export function buildUserLeaderboard(users, history) {
  return (users || []).map(user => {
    const rows = (history || []).filter(item => item.userId === user.id);
    return {
      userId: user.id,
      name: user.name,
      group: user.group,
      totalPoints: rows.reduce((sum, item) => sum + safeNumber(item.points), 0),
      scanCount: rows.length,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
}

export function buildGroupLeaderboard(users, history) {
  const userMap = new Map((users || []).map(user => [user.id, user]));
  const groups = new Map();

  (history || []).forEach(item => {
    const group = userMap.get(item.userId)?.group || "Chưa phân nhóm";
    const current = groups.get(group) || { group, totalPoints: 0, scanCount: 0 };
    current.totalPoints += safeNumber(item.points);
    current.scanCount += 1;
    groups.set(group, current);
  });

  return Array.from(groups.values()).sort((a, b) => b.totalPoints - a.totalPoints);
}
