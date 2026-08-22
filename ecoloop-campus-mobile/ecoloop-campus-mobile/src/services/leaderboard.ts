import { UserProfile } from '../types';

export type LeaderboardRow = {
  id: string;
  rank: number;
  name: string;
  points: number;
  displayMeta: string;
};

function safePoints(value: unknown) {
  const points = Number(value ?? 0);
  return Number.isFinite(points) ? points : 0;
}

export function selectLeaderboardUsers(users: UserProfile[], limit = 10): LeaderboardRow[] {
  return users
    .filter(user => user.status === 'active' && user.role === 'student')
    .sort((left, right) => safePoints(right.points) - safePoints(left.points) || left.name.localeCompare(right.name, 'vi-VN'))
    .slice(0, Math.max(0, limit))
    .map((user, index) => ({
      id: user.id,
      rank: index + 1,
      name: user.name,
      points: safePoints(user.points),
      displayMeta: user.group || user.role,
    }));
}

export function getUserLeaderboardRank(users: UserProfile[], userId: string) {
  return selectLeaderboardUsers(users, Number.MAX_SAFE_INTEGER).find(row => row.id === userId);
}