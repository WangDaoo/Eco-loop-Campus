import assert from 'node:assert/strict';
import test from 'node:test';
import { getUserLeaderboardRank, selectLeaderboardUsers } from './leaderboard';
import { UserProfile } from '../types';

const users: UserProfile[] = [
  { id: 'u1', name: 'Lan', email: 'lan@school.edu.vn', role: 'student', group: 'CNTT', points: 120, status: 'active' },
  { id: 'u2', name: 'Minh', email: 'minh@school.edu.vn', role: 'student', group: 'Kinh te', points: 300, status: 'active' },
  { id: 'u3', name: 'Khoa', email: 'khoa@school.edu.vn', role: 'student', group: 'CNTT', points: 260, status: 'locked' },
  { id: 'u4', name: 'Vy', email: 'vy@school.edu.vn', role: 'volunteer', group: 'CLB Moi truong', points: 90, status: 'active' }
];

test('selectLeaderboardUsers sorts active users by points and hides locked users', () => {
  const rows = selectLeaderboardUsers(users);

  assert.deepEqual(rows.map(row => row.id), ['u2', 'u1']);
  assert.deepEqual(rows.map(row => row.rank), [1, 2]);
  assert.equal(rows[0].displayMeta, 'Kinh te');
});

test('selectLeaderboardUsers limits rows for compact mobile screens', () => {
  const rows = selectLeaderboardUsers(users, 2);

  assert.equal(rows.length, 2);
  assert.equal(rows[1].name, 'Lan');
});
test('getUserLeaderboardRank returns the current student rank and ignores volunteers', () => {
  const rank = getUserLeaderboardRank(users, 'u1');

  assert.equal(rank?.rank, 2);
  assert.equal(rank?.name, 'Lan');
  assert.equal(getUserLeaderboardRank(users, 'u4'), undefined);
});
