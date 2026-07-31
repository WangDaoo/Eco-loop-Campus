import { buildReportSummary, filterReportData, makeDailyReportData, makeReportCsvRows } from "./reportMetrics";

const predictions = [
  { id: "S1", binGroup: "Tái chế", status: "approved", confidence: 0.91, timestamp: "2026-07-07T08:00:00.000Z", binId: "BIN-A1" },
  { id: "S2", binGroup: "Pin / nguy hại", status: "pending", confidence: 0.42, timestamp: "2026-07-08T08:00:00.000Z", binId: "BIN-B2" },
];

const bins = [
  { id: "BIN-A1", building: "A1", binGroup: "Tái chế", capacity: 54, status: "active", name: "Thùng A1" },
  { id: "BIN-B2", building: "B2", binGroup: "Pin / nguy hại", capacity: 91, status: "full", name: "Thùng B2" },
];

const feedback = [
  { id: "FB1", status: "unread", binId: "BIN-B2", timestamp: "2026-07-08T09:00:00.000Z" },
];

const pointHistory = [
  { id: 1, userId: "SV001", binId: "BIN-A1", binGroup: "Tái chế", points: 5, timestamp: "2026-07-07T10:00:00.000Z" },
];

test("filters report data by date, building and bin group", () => {
  const result = filterReportData(
    { predictions, bins, feedback, pointHistory },
    { dateFrom: "2026-07-08", dateTo: "2026-07-08", building: "B2", binGroup: "Pin / nguy hại" }
  );

  expect(result.predictions.map(item => item.id)).toEqual(["S2"]);
  expect(result.bins.map(item => item.id)).toEqual(["BIN-B2"]);
  expect(result.feedback.map(item => item.id)).toEqual(["FB1"]);
  expect(result.pointHistory).toEqual([]);
});

test("builds report summary from filtered data", () => {
  const summary = buildReportSummary({ predictions, bins, feedback, pointHistory });

  expect(summary.totalScans).toBe(2);
  expect(summary.totalPoints).toBe(5);
  expect(summary.openFeedback).toBe(1);
  expect(summary.fullBins).toBe(1);
});

test("counts only unresolved workflow feedback as open in report summary", () => {
  const summary = buildReportSummary({
    predictions: [],
    bins: [],
    pointHistory: [],
    feedback: [
      { id: "FB-UNREAD", status: "unread" },
      { id: "FB-PROCESSING", status: "in_progress" },
      { id: "FB-RESOLVED", status: "resolved" },
      { id: "FB-REJECTED", status: "rejected" },
      { id: "FB-READ", status: "read" },
    ],
  });

  expect(summary.openFeedback).toBe(2);
});

test("builds daily chart and csv rows", () => {
  const chart = makeDailyReportData({ predictions, pointHistory, feedback });
  const csvRows = makeReportCsvRows({ predictions, bins, feedback, pointHistory });

  expect(chart.labels).toEqual(["07/07", "08/07"]);
  expect(chart.datasets[0].label).toBe("Lượt quét");
  expect(csvRows[0]).toEqual(expect.objectContaining({ loai: "scan", ma: "S1", nhom: "Tái chế" }));
});
test("report filters ignore invalid dates instead of crashing", () => {
  const dirtyData = {
    predictions: [{ id: "BAD-SCAN", binGroup: "Tái chế", status: "approved", timestamp: "not-a-date", binId: "BIN-A1" }],
    pointHistory: [{ id: "BAD-POINT", binGroup: "Tái chế", points: 5, timestamp: "invalid-date", binId: "BIN-A1" }],
    feedback: [{ id: "BAD-FB", status: "unread", timestamp: "wrong-date", binId: "BIN-A1" }],
    bins,
  };

  const result = filterReportData(dirtyData, { dateFrom: "2026-07-07", dateTo: "2026-07-07" });
  const chart = makeDailyReportData(result);

  expect(result.predictions).toEqual([]);
  expect(result.pointHistory).toEqual([]);
  expect(result.feedback).toEqual([]);
  expect(chart.labels).toEqual([]);
});

test("report filters ignore invalid date filter bounds", () => {
  const result = filterReportData(
    { predictions, bins, feedback, pointHistory },
    { dateFrom: "not-a-date", dateTo: "also-not-a-date" }
  );

  expect(result.predictions.map(item => item.id)).toEqual(["S1", "S2"]);
  expect(result.feedback.map(item => item.id)).toEqual(["FB1"]);
  expect(result.pointHistory.map(item => item.id)).toEqual([1]);
});
test("report filters exclude records with missing bins when bin filters are active", () => {
  const result = filterReportData(
    {
      predictions: [...predictions, { id: "ORPHAN-SCAN", binGroup: "Tái chế", timestamp: "2026-07-07T11:00:00.000Z", binId: "MISSING-BIN" }],
      pointHistory: [...pointHistory, { id: "ORPHAN-POINT", binGroup: "Tái chế", points: 5, timestamp: "2026-07-07T11:00:00.000Z", binId: "MISSING-BIN" }],
      feedback: [...feedback, { id: "ORPHAN-FB", status: "unread", timestamp: "2026-07-07T11:00:00.000Z", binId: "MISSING-BIN" }],
      bins,
    },
    { building: "A1", binGroup: "Tái chế" }
  );

  expect(result.predictions.map(item => item.id)).toEqual(["S1"]);
  expect(result.pointHistory.map(item => item.id)).toEqual([1]);
  expect(result.feedback).toEqual([]);
});

test("report filters normalize dirty building and bin group labels", () => {
  const dirtyBins = [
    { id: "BIN-DIRTY-A1", building: " A1 ", binGroup: " TÁI CHẾ ", capacity: 10, status: "active", name: "Thùng A1 bẩn" },
    { id: "BIN-B2", building: "B2", binGroup: "Pin / nguy hại", capacity: 10, status: "active", name: "Thùng B2" },
  ];
  const result = filterReportData(
    {
      predictions: [{ id: "SCAN-DIRTY-BIN", binGroup: "Tái chế", timestamp: "2026-07-07T08:00:00.000Z", binId: "BIN-DIRTY-A1" }],
      pointHistory: [{ id: "POINT-DIRTY-BIN", binGroup: "Tái chế", points: 5, timestamp: "2026-07-07T09:00:00.000Z", binId: "BIN-DIRTY-A1" }],
      feedback: [{ id: "FB-DIRTY-BIN", status: "unread", timestamp: "2026-07-07T10:00:00.000Z", binId: "BIN-DIRTY-A1" }],
      bins: dirtyBins,
    },
    { building: "A1", binGroup: "Tái chế" }
  );

  expect(result.bins.map(item => item.id)).toEqual(["BIN-DIRTY-A1"]);
  expect(result.predictions.map(item => item.id)).toEqual(["SCAN-DIRTY-BIN"]);
  expect(result.pointHistory.map(item => item.id)).toEqual(["POINT-DIRTY-BIN"]);
  expect(result.feedback.map(item => item.id)).toEqual(["FB-DIRTY-BIN"]);
});

test("empty report data returns zero summary and empty csv fallback data", () => {
  const empty = { predictions: [], bins: [], feedback: [], pointHistory: [] };

  expect(buildReportSummary(empty)).toEqual({ totalScans: 0, totalPoints: 0, openFeedback: 0, fullBins: 0 });
  expect(makeDailyReportData(empty).labels).toEqual([]);
  expect(makeReportCsvRows(empty)).toEqual([]);
});

test("report metrics treat malformed point values as zero", () => {
  const dirtyPointHistory = [
    { id: "BAD-POINTS", binGroup: "Tái chế", points: "bad-points", timestamp: "2026-07-07T10:00:00.000Z", binId: "BIN-A1" },
    { id: "GOOD-POINTS", binGroup: "Tái chế", points: 4, timestamp: "2026-07-07T11:00:00.000Z", binId: "BIN-A1" },
  ];
  const summary = buildReportSummary({ predictions: [], bins, feedback: [], pointHistory: dirtyPointHistory });
  const chart = makeDailyReportData({ predictions: [], pointHistory: dirtyPointHistory, feedback: [] });

  expect(summary.totalPoints).toBe(4);
  expect(chart.datasets[1].data).toEqual([4]);
});

test("report csv treats malformed bin capacity as zero percent", () => {
  const rows = makeReportCsvRows({
    predictions: [],
    pointHistory: [],
    feedback: [],
    bins: [{ id: "BIN-BAD-CAPACITY", binGroup: "Tái chế", status: "active", capacity: "bad-capacity" }],
  });

  expect(rows[0]).toEqual(expect.objectContaining({ ma: "BIN-BAD-CAPACITY", thoi_gian: "0%" }));
});

test("report summary treats dirty full bin status as full", () => {
  const summary = buildReportSummary({
    predictions: [],
    pointHistory: [],
    feedback: [],
    bins: [
      { id: "BIN-DIRTY-FULL", status: " FULL ", capacity: 10 },
      { id: "BIN-ACTIVE", status: "active", capacity: 10 },
    ],
  });

  expect(summary.fullBins).toBe(1);
});

test("report filters return empty rows for malformed collection inputs", () => {
  const result = filterReportData(
    { predictions: "bad-predictions", bins: "bad-bins", feedback: "bad-feedback", pointHistory: "bad-points" },
    { building: "A1", binGroup: "Tái chế" }
  );

  expect(result).toEqual({ predictions: [], pointHistory: [], feedback: [], bins: [] });
});

test("report summary returns zero metrics for malformed collection inputs", () => {
  const summary = buildReportSummary({ predictions: "bad-predictions", bins: "bad-bins", feedback: "bad-feedback", pointHistory: "bad-points" });

  expect(summary).toEqual({ totalScans: 0, totalPoints: 0, openFeedback: 0, fullBins: 0 });
});
