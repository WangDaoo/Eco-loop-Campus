import { UserProfile } from '../types';

export type LeaderboardRow = {
  id: string;
  rank: number;
  name: string;
  points: number;
  displayMeta: string;
};

export function selectLeaderboardUsers(users: UserProfile[], limit = 10): LeaderboardRow[] {
  return users
    .filter(user => user.status === 'active')
    .sort((left, right) => right.points - left.points || left.name.localeCompare(right.name))
    .slice(0, Math.max(0, limit))
    .map((user, index) => ({
      id: user.id,
      rank: index + 1,
      name: user.name,
      points: user.points,
      displayMeta: user.group || user.role,
    }));
}