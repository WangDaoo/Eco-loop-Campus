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

function isStudentUser(user) {
  const role = labelCode(user?.role || "student");
  return !role || role === "student" || role === "sinh viên" || role === "sinh vien";
}

function matchesUserGroup(user, userGroup) {
  return !userGroup || labelCode(user?.group) === labelCode(userGroup);
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
  const userRows = Array.isArray(users) ? users : [];
  const userMap = new Map(userRows.map(user => [user.id, user]));
  const historyRows = Array.isArray(history) ? history : [];
  return historyRows.filter(item => {
    const user = userMap.get(item.userId);
    if (filters.userId && item.userId !== filters.userId) return false;
    if (filters.userGroup && labelCode(user?.group) !== labelCode(filters.userGroup)) return false;
    if (filters.binGroup && labelCode(item.binGroup) !== labelCode(filters.binGroup)) return false;
    return inDateRange(item.timestamp || item.createdAt, filters);
  });
}

export function buildUserLeaderboard(users, history, options = {}) {
  const userRows = Array.isArray(users) ? users : [];
  const historyRows = Array.isArray(history) ? history : [];
  const useProfilePoints = Boolean(options.useProfilePoints);

  return userRows
    .filter(isStudentUser)
    .filter(user => matchesUserGroup(user, options.userGroup))
    .map(user => {
      const rows = historyRows.filter(item => item.userId === user.id);
      return {
        userId: user.id,
        name: user.name,
        group: user.group,
        totalPoints: useProfilePoints ? safeNumber(user.points) : rows.reduce((sum, item) => sum + safeNumber(item.points), 0),
        scanCount: rows.length,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints || String(a.name || "").localeCompare(String(b.name || ""), "vi-VN"));
}

export function buildGroupLeaderboard(users, history, options = {}) {
  const userRows = Array.isArray(users) ? users : [];
  const historyRows = Array.isArray(history) ? history : [];
  const leaderboardUsers = userRows.filter(isStudentUser).filter(user => matchesUserGroup(user, options.userGroup));

  if (options.useProfilePoints) {
    const groups = new Map();
    const rowsByUser = new Map();
    historyRows.forEach(item => {
      rowsByUser.set(item.userId, (rowsByUser.get(item.userId) || 0) + 1);
    });

    leaderboardUsers.forEach(user => {
      const group = user.group || "Chưa phân nhóm";
      const current = groups.get(group) || { group, totalPoints: 0, scanCount: 0 };
      current.totalPoints += safeNumber(user.points);
      current.scanCount += rowsByUser.get(user.id) || 0;
      groups.set(group, current);
    });

    return Array.from(groups.values()).sort((a, b) => b.totalPoints - a.totalPoints || String(a.group || "").localeCompare(String(b.group || ""), "vi-VN"));
  }

  const userMap = new Map(leaderboardUsers.map(user => [user.id, user]));
  const groups = new Map();

  historyRows.forEach(item => {
    const user = userMap.get(item.userId);
    if (options.userGroup && !user) return;
    const group = user?.group || "Chưa phân nhóm";
    const current = groups.get(group) || { group, totalPoints: 0, scanCount: 0 };
    current.totalPoints += safeNumber(item.points);
    current.scanCount += 1;
    groups.set(group, current);
  });

  return Array.from(groups.values()).sort((a, b) => b.totalPoints - a.totalPoints || String(a.group || "").localeCompare(String(b.group || ""), "vi-VN"));
}
