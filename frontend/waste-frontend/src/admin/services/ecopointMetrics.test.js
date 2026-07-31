import { buildGroupLeaderboard, buildUserLeaderboard, filterPointHistory } from "./ecopointMetrics";

const users = [
  { id: "SV001", name: "Nguyễn Minh Anh", group: "CNTT K18", points: 245 },
  { id: "SV002", name: "Trần Bình", group: "Môi trường K18", points: 120 },
];

const history = [
  { id: 1, userId: "SV001", userName: "Nguyễn Minh Anh", binGroup: "Tái chế", points: 5, timestamp: "2026-07-07T09:00:00.000Z" },
  { id: 2, userId: "SV002", userName: "Trần Bình", binGroup: "Hữu cơ", points: 3, timestamp: "2026-07-08T09:00:00.000Z" },
];

test("filters point history by group, bin group and date", () => {
  const rows = filterPointHistory(history, users, {
    userGroup: "CNTT K18",
    binGroup: "Tái chế",
    dateFrom: "2026-07-07",
    dateTo: "2026-07-07",
  });

  expect(rows.map(row => row.id)).toEqual([1]);
});

test("filters point history normalize dirty group and bin group labels", () => {
  const dirtyUsers = [
    { id: "SV001", name: "Nguyễn Minh Anh", group: " CNTT K18 ", points: 245 },
    { id: "SV002", name: "Trần Bình", group: "Môi trường K18", points: 120 },
  ];
  const dirtyHistory = [
    { id: "DIRTY-MATCH", userId: "SV001", userName: "Nguyễn Minh Anh", binGroup: " TÁI CHẾ ", points: 5, timestamp: "2026-07-07T09:00:00.000Z" },
    { id: "DIRTY-NO-MATCH", userId: "SV002", userName: "Trần Bình", binGroup: "Hữu cơ", points: 3, timestamp: "2026-07-07T10:00:00.000Z" },
  ];

  const rows = filterPointHistory(dirtyHistory, dirtyUsers, {
    userGroup: "CNTT K18",
    binGroup: "Tái chế",
  });

  expect(rows.map(row => row.id)).toEqual(["DIRTY-MATCH"]);
});

test("builds user and group leaderboards", () => {
  expect(buildUserLeaderboard(users, history)[0]).toEqual(expect.objectContaining({ userId: "SV001", totalPoints: 5 }));
  expect(buildGroupLeaderboard(users, history)[0]).toEqual(expect.objectContaining({ group: "CNTT K18", totalPoints: 5 }));
});

test("leaderboards treat malformed point values as zero", () => {
  const dirtyHistory = [
    { id: "BAD-POINTS", userId: "SV001", userName: "Nguyễn Minh Anh", binGroup: "Tái chế", points: "bad-points", timestamp: "2026-07-07T09:00:00.000Z" },
    { id: "GOOD-POINTS", userId: "SV001", userName: "Nguyễn Minh Anh", binGroup: "Tái chế", points: 4, timestamp: "2026-07-07T10:00:00.000Z" },
  ];

  expect(buildUserLeaderboard(users, dirtyHistory)[0]).toEqual(expect.objectContaining({ userId: "SV001", totalPoints: 4 }));
  expect(buildGroupLeaderboard(users, dirtyHistory)[0]).toEqual(expect.objectContaining({ group: "CNTT K18", totalPoints: 4 }));
});

test("filters point history ignore invalid dates instead of crashing", () => {
  const dirtyHistory = [
    ...history,
    { id: "BAD-DATE", userId: "SV001", userName: "Nguyễn Minh Anh", binGroup: "Tái chế", points: 99, timestamp: "not-a-date" },
  ];

  const rows = filterPointHistory(dirtyHistory, users, { dateFrom: "2026-07-07", dateTo: "2026-07-08" });

  expect(rows.map(row => row.id)).toEqual([1, 2]);
});

test("filters point history ignore invalid date filter bounds", () => {
  const rows = filterPointHistory(history, users, { dateFrom: "bad", dateTo: "also-bad" });

  expect(rows.map(row => row.id)).toEqual([1, 2]);
});

test("filterPointHistory handles missing users array", () => {
  const dirtyHistory = [
    { id: "POINT-RECYCLE", userId: "SV-MISSING", binGroup: "Tái chế", points: 5, timestamp: "2026-07-07T08:00:00.000Z" },
    { id: "POINT-ORGANIC", userId: "SV-MISSING", binGroup: "Hữu cơ", points: 3, timestamp: "2026-07-07T09:00:00.000Z" },
  ];

  const result = filterPointHistory(dirtyHistory, undefined, { binGroup: " TÁI CHẾ " });

  expect(result.map(item => item.id)).toEqual(["POINT-RECYCLE"]);
});

test("filterPointHistory returns empty rows for malformed history", () => {
  const result = filterPointHistory("bad-history", users, { binGroup: "Tái chế" });

  expect(result).toEqual([]);
});
