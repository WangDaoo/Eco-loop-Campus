import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

process.env.REACT_APP_SUPABASE_URL = "https://school.supabase.co";
delete process.env.REACT_APP_SUPABASE_ANON_KEY;
process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

let App;
let mockAuthUser = null;
let mockSupabaseFailure = false;
let mockSupabaseUpdateFailure = false;
let mockTables = {};

const mockSupabaseFrom = jest.fn();
const mockSupabaseUpsert = jest.fn();
const mockSupabaseUpdate = jest.fn();
const mockSupabaseInsert = jest.fn();
let createdSupabaseClientArgs = [];

const seedSupabase = () => {
  mockTables = {
    users: [
      { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
      { id: "SV001", name: "Nguyễn Minh Anh", email: "minhanh@school.edu.vn", role: "student", group: "CNTT K18", points: 245, status: "active" },
    ],
    bins: [
      { id: "BIN-A1-RECYCLE", name: "Thùng tái chế A1", bin_group: "Tái chế", location: "Nhà A1", building: "A1", floor: "1", qr_code: "QR-A1", status: "active", capacity: 54, map_x: 30, map_y: 78 },
    ],
    predictions: [
      { id: "scan-low", class: "battery", confidence: 0.42, source: "upload", timestamp: "2026-07-07T08:00:00.000Z", bin_group: "Pin / nguy hại", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
      { id: "scan-recycle", class: "plastic", confidence: 0.91, source: "camera", timestamp: "2026-07-07T09:00:00.000Z", bin_group: "Tái chế", status: "approved", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
    ],
    point_rules: [
      { id: "recycle", label: "Rác tái chế hợp lệ", class_keys: ["paper", "cardboard", "plastic", "glass", "metal"], bin_group: "Tái chế", points: 5, enabled: true },
      { id: "hazard", label: "Pin / rác nguy hại nộp đúng điểm", class_keys: ["battery"], bin_group: "Pin / nguy hại", points: 8, enabled: true },
    ],
    feedback: [
      { id: "FB001", user_name: "Nguyễn Minh Anh", category: "Thùng đầy", message: "Thùng tái chế A1 gần đầy vào giờ trưa.", status: "unread", priority: "high", bin_id: "BIN-A1-RECYCLE", admin_note: "", timestamp: "2026-07-07T07:20:00.000Z" },
    ],
    settings: [
      { id: "model", threshold: 0.65, model_name: "MobileNetV2", class_count: 10 },
    ],
    point_history: [
      { id: 901, prediction_id: "scan-recycle", user_id: "SV001", bin_id: "BIN-A1-RECYCLE", class: "plastic", bin_group: "Tái chế", action: "Duyệt Nhựa", points: 5, timestamp: "2026-07-07T09:30:00.000Z", created_at: "2026-07-07T09:30:00.000Z" },
    ],
  };
};

function makeQuery(tableName) {
  const query = {
    operation: "select",
    payload: null,
    filters: {},
    select: jest.fn(() => query),
    order: jest.fn(() => Promise.resolve(readRows(tableName))),
    eq: jest.fn((column, value) => {
      query.filters[column] = value;
      if (query.operation === "update") return Promise.resolve(updateRows(tableName, query.filters, query.payload));
      return query;
    }),
    maybeSingle: jest.fn(() => Promise.resolve(readSingle(tableName, query.filters))),
    single: jest.fn(() => Promise.resolve(readSingle(tableName, query.filters))),
    upsert: jest.fn(payload => {
      mockSupabaseUpsert(payload);
      if (mockSupabaseFailure) return Promise.resolve({ data: null, error: new Error("permission-denied") });
      const rows = Array.isArray(payload) ? payload : [payload];
      rows.forEach(row => upsertRow(tableName, row));
      return Promise.resolve({ data: rows, error: null });
    }),
    update: jest.fn(payload => {
      mockSupabaseUpdate(tableName, payload);
      query.operation = "update";
      query.payload = payload;
      return query;
    }),
    insert: jest.fn(payload => {
      mockSupabaseInsert(tableName, payload);
      if (mockSupabaseFailure) return Promise.resolve({ data: null, error: new Error("permission-denied") });
      const rows = Array.isArray(payload) ? payload : [payload];
      mockTables[tableName] = [...(mockTables[tableName] || []), ...rows];
      return Promise.resolve({ data: rows, error: null });
    }),
  };
  query.then = (resolve, reject) => readRows(tableName).then(resolve, reject);
  return query;
}

function readRows(tableName) {
  if (mockSupabaseFailure) return Promise.resolve({ data: null, error: new Error("permission-denied") });
  return Promise.resolve({ data: mockTables[tableName] || [], error: null });
}

function readSingle(tableName, filters) {
  if (mockSupabaseFailure) return Promise.resolve({ data: null, error: new Error("permission-denied") });
  const rows = mockTables[tableName] || [];
  const found = rows.find(row => Object.entries(filters).every(([key, value]) => row[key] === value));
  return Promise.resolve({ data: found || null, error: null });
}

function updateRows(tableName, filters, payload) {
  if (mockSupabaseFailure || mockSupabaseUpdateFailure) return { data: null, error: new Error("permission-denied") };
  mockTables[tableName] = (mockTables[tableName] || []).map(row => Object.entries(filters).every(([key, value]) => row[key] === value) ? { ...row, ...payload } : row);
  return { data: mockTables[tableName], error: null };
}

function upsertRow(tableName, row) {
  const rows = mockTables[tableName] || [];
  mockTables[tableName] = [row, ...rows.filter(item => item.id !== row.id)];
}

const mockSupabaseClient = {
  from: mockSupabaseFrom,
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: mockAuthUser ? { user: mockAuthUser } : null }, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { id: "AD001", email: "admin@school.edu.vn" } }, error: null })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
  },
};

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn((url, key) => {
    createdSupabaseClientArgs = [url, key];
    return mockSupabaseClient;
  }),
}), { virtual: true });

jest.mock("axios", () => ({
  post: jest.fn(),
}));

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({ name: "firebase-app" })),
}), { virtual: true });

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ name: "auth" })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    callback(mockAuthUser);
    return jest.fn();
  }),
  signInWithEmailAndPassword: jest.fn(() => Promise.resolve({ user: { uid: "AD001", email: "admin@school.edu.vn" } })),
  signOut: jest.fn(() => Promise.resolve()),
}), { virtual: true });

jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({ name: "db" })),
  collection: jest.fn((db, name) => ({ type: "collection", name })),
  doc: jest.fn((db, collectionName, id) => ({ type: "doc", collectionName, id })),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => ({}) })),
  setDoc: jest.fn(() => Promise.resolve()),
  updateDoc: jest.fn(() => Promise.resolve()),
  addDoc: jest.fn(() => Promise.resolve({ id: "new-doc" })),
  serverTimestamp: jest.fn(() => "SERVER_TIME"),
}), { virtual: true });

jest.mock("react-chartjs-2", () => ({
  Line: () => <div data-testid="line-chart" />,
  Doughnut: () => <div data-testid="doughnut-chart" />,
  Bar: () => <div data-testid="bar-chart" />,
}));

beforeAll(() => {
  App = require("./App").default;
});

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "";
  mockAuthUser = { id: "AD001", email: "admin@school.edu.vn" };
  mockSupabaseFailure = false;
  mockSupabaseUpdateFailure = false;
  seedSupabase();
  jest.clearAllMocks();
  mockSupabaseClient.auth.getSession.mockImplementation(() => Promise.resolve({ data: { session: mockAuthUser ? { user: mockAuthUser } : null }, error: null }));
  mockSupabaseClient.auth.onAuthStateChange.mockImplementation(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }));
  mockSupabaseClient.auth.signInWithPassword.mockImplementation(() => Promise.resolve({ data: { user: { id: "AD001", email: "admin@school.edu.vn" } }, error: null }));
  mockSupabaseClient.auth.signOut.mockImplementation(() => Promise.resolve({ error: null }));
  mockSupabaseFrom.mockImplementation(tableName => makeQuery(tableName));
});

test("uses CRA Supabase publishable key env", () => {
  expect(createdSupabaseClientArgs).toEqual(["https://school.supabase.co", "publishable-key"]);
});

test("Supabase store list functions read configured tables with select star", async () => {
  const store = require("./admin/services/supabaseStore");
  mockSupabaseFrom.mockClear();

  await store.listUsers();
  await store.listBins();
  await store.listPredictions();
  await store.listFeedback();
  await store.listPointRules();
  await store.listPointHistory();
  await store.listRewardRedemptions();
  await store.getModelSettings();

  const entries = mockSupabaseFrom.mock.calls.map(([tableName], index) => ({
    tableName,
    query: mockSupabaseFrom.mock.results[index].value,
  }));
  expect(entries.map(item => item.tableName)).toEqual(expect.arrayContaining([
    "users",
    "bins",
    "predictions",
    "feedback",
    "point_rules",
    "point_history",
    "reward_redemptions",
    "settings",
  ]));
  ["users", "bins", "predictions", "feedback", "point_rules", "point_history", "reward_redemptions", "settings"].forEach(tableName => {
    expect(entries.find(item => item.tableName === tableName).query.select).toHaveBeenCalledWith("*");
  });
  const settingsQuery = entries.find(item => item.tableName === "settings").query;
  expect(settingsQuery.eq).toHaveBeenCalledWith("id", "model");
  expect(settingsQuery.maybeSingle).toHaveBeenCalled();
});

test("Supabase store save and update functions use table-specific snake_case payloads", async () => {
  const store = require("./admin/services/supabaseStore");
  mockSupabaseFrom.mockClear();

  await store.saveUser({ id: "SV002", name: "Trần Hoàng Nam", email: "nam@school.edu.vn", role: "student", group: "CNTT K19", points: "7", status: "active", createdAt: "2026-07-07T08:00:00.000Z" });
  await store.saveBin({ id: "BIN-B2", name: "Thùng B2", binGroup: "Hữu cơ", location: "Nhà B2", building: "B2", floor: "1", qrCode: "QR-B2", status: "active", capacity: 44, mapX: 41, mapY: 62 });
  await store.savePredictionRecord({ id: "scan-2", class: "plastic", confidence: 0.88, source: "camera", timestamp: "2026-07-07T10:00:00.000Z", status: "pending", userId: "SV001", binId: "BIN-A1-RECYCLE", imageName: "camera-capture.jpg" });
  await store.saveFeedbackItem({ id: "FB002", userName: "Giám thị A1", category: "QR lỗi", message: "QR bong góc.", status: "unread", priority: "high", binId: "BIN-A1-RECYCLE", adminNote: "", timestamp: "2026-07-07T10:00:00.000Z" });
  await store.savePointRules([{ id: "recycle", label: "Rác tái chế", classKeys: ["paper", "plastic"], binGroup: "Tái chế", points: 5, enabled: true }]);
  await store.saveRewardRedemption({ id: "RW002", userId: "SV001", rewardLabel: "Voucher căn tin", costPoints: 100, status: "pending", requestedAt: "2026-07-07T10:00:00.000Z" });
  await store.saveModelThreshold(0.72);
  await store.saveManualPointHistory({ userId: "SV001", binId: "BIN-A1-RECYCLE", binGroup: "Tái chế", action: "Nộp rác sự kiện", points: 4, adminNote: "Ghi nhận sự kiện" });
  await store.updateUserStatus({ id: "SV001", name: "Nguyễn Minh Anh", points: 245 }, "locked");
  await store.updateBinStatus({ id: "BIN-A1-RECYCLE", name: "Thùng tái chế A1" }, "maintenance");
  await store.updateFeedbackItem({ id: "FB001", userName: "Nguyễn Minh Anh", category: "Thùng đầy", message: "Thùng đầy.", status: "unread", priority: "high", timestamp: "2026-07-07T09:00:00.000Z" }, { status: "resolved", adminNote: "Đã xử lý" });
  await store.updateRewardRedemption({ id: "RW001", userId: "SV001", rewardLabel: "Voucher căn tin", costPoints: 100, status: "pending", requestedAt: "2026-07-07T09:00:00.000Z" }, { status: "approved", adminNote: "Đã nhận" });

  const entries = mockSupabaseFrom.mock.calls.map(([tableName], index) => ({
    tableName,
    query: mockSupabaseFrom.mock.results[index].value,
  }));
  const upserts = entries
    .filter(item => item.query.upsert.mock.calls.length)
    .map(item => ({ tableName: item.tableName, payload: item.query.upsert.mock.calls[0][0] }));
  const inserts = entries
    .filter(item => item.query.insert.mock.calls.length)
    .map(item => ({ tableName: item.tableName, payload: item.query.insert.mock.calls[0][0] }));
  const updates = entries
    .filter(item => item.query.update.mock.calls.length)
    .map(item => ({ tableName: item.tableName, payload: item.query.update.mock.calls[0][0] }));

  expect(upserts).toEqual(expect.arrayContaining([
    expect.objectContaining({ tableName: "users", payload: expect.objectContaining({ id: "SV002", created_at: "2026-07-07T08:00:00.000Z", points: 7 }) }),
    expect.objectContaining({ tableName: "bins", payload: expect.objectContaining({ id: "BIN-B2", bin_group: "Hữu cơ", qr_code: "QR-B2", map_x: 41, map_y: 62 }) }),
    expect.objectContaining({ tableName: "predictions", payload: expect.objectContaining({ id: "scan-2", bin_group: "Tái chế", user_id: "SV001", bin_id: "BIN-A1-RECYCLE", image_name: "camera-capture.jpg" }) }),
    expect.objectContaining({ tableName: "feedback", payload: expect.objectContaining({ id: "FB002", user_name: "Giám thị A1", bin_id: "BIN-A1-RECYCLE", admin_note: "" }) }),
    expect.objectContaining({ tableName: "point_rules", payload: [expect.objectContaining({ id: "recycle", class_keys: ["paper", "plastic"], bin_group: "Tái chế" })] }),
    expect.objectContaining({ tableName: "reward_redemptions", payload: expect.objectContaining({ id: "RW002", user_id: "SV001", reward_label: "Voucher căn tin", cost_points: 100 }) }),
    expect.objectContaining({ tableName: "settings", payload: expect.objectContaining({ id: "model", threshold: 0.72, model_name: "MobileNetV2", class_count: 10 }) }),
  ]));
  expect(inserts).toEqual(expect.arrayContaining([
    expect.objectContaining({ tableName: "point_history", payload: [expect.objectContaining({ user_id: "SV001", bin_id: "BIN-A1-RECYCLE", bin_group: "Tái chế", points: 4, source: "manual_adjustment", admin_note: "Ghi nhận sự kiện" })] }),
  ]));
  expect(updates).toEqual(expect.arrayContaining([
    expect.objectContaining({ tableName: "users", payload: { points: 249 } }),
    expect.objectContaining({ tableName: "users", payload: { status: "locked" } }),
    expect.objectContaining({ tableName: "bins", payload: { status: "maintenance" } }),
    expect.objectContaining({ tableName: "feedback", payload: expect.objectContaining({ status: "resolved", admin_note: "Đã xử lý" }) }),
    expect.objectContaining({ tableName: "reward_redemptions", payload: expect.objectContaining({ status: "approved", admin_note: "Đã nhận" }) }),
  ]));
});

test("setPredictionStatus awards points once when approval is repeated", async () => {
  const store = require("./admin/services/supabaseStore");
  const predictions = await store.listPredictions();
  const scan = predictions.data.find(item => item.id === "scan-low");

  await store.setPredictionStatus(scan, "approved");
  await store.setPredictionStatus(scan, "approved");

  const awardedRows = (mockTables.point_history || []).filter(row => row.prediction_id === "scan-low");
  const student = mockTables.users.find(user => user.id === "SV001");
  expect(awardedRows).toHaveLength(1);
  expect(student.points).toBe(253);
});

test("setPredictionStatus rejects unsupported statuses before writing predictions", async () => {
  const store = require("./admin/services/supabaseStore");
  const predictions = await store.listPredictions();
  const scan = predictions.data.find(item => item.id === "scan-low");

  const result = await store.setPredictionStatus(scan, " archived ");

  expect(result.data.status).toBe("pending");
  expect(result.error).toEqual(expect.any(Error));
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("predictions", expect.objectContaining({ status: " archived " }));
  expect(mockTables.predictions.find(item => item.id === "scan-low").status).toBe("pending");
  expect(localStorage.getItem("smartWastePredictions")).toBeNull();
});


test("updateRewardRedemption rejects unsupported statuses before writing rewards", async () => {
  const store = require("./admin/services/supabaseStore");
  mockTables.reward_redemptions = [{ id: "RW-BAD-STATUS", user_id: "SV001", reward_label: "Voucher căn tin", cost_points: 100, status: "pending", requested_at: "2026-07-07T10:00:00.000Z" }];

  const result = await store.updateRewardRedemption({ id: "RW-BAD-STATUS", userId: "SV001", rewardLabel: "Voucher căn tin", costPoints: 100, status: "pending", requestedAt: "2026-07-07T10:00:00.000Z" }, { status: " archived " });

  expect(result.data.status).toBe("pending");
  expect(result.error).toEqual(expect.any(Error));
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("reward_redemptions", expect.objectContaining({ status: " archived " }));
  expect(mockTables.reward_redemptions.find(item => item.id === "RW-BAD-STATUS").status).toBe("pending");
  expect(localStorage.getItem("ecoGuardianRewardRedemptions")).toBeNull();
});


test("updateUserStatus rejects unsupported statuses before writing users", async () => {
  const store = require("./admin/services/supabaseStore");
  const user = { id: "SV001", name: "Nguyễn Minh Anh", email: "minhanh@school.edu.vn", role: "student", group: "CNTT K18", points: 245, status: "active" };

  const result = await store.updateUserStatus(user, " archived ");

  expect(result.data.status).toBe("active");
  expect(result.error).toEqual(expect.any(Error));
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("users", { status: " archived " });
  expect(mockTables.users.find(item => item.id === "SV001").status).toBe("active");
  expect(localStorage.getItem("ecoGuardianUsers")).toBeNull();
});

test("updateBinStatus rejects unsupported statuses before writing bins", async () => {
  const store = require("./admin/services/supabaseStore");
  const bin = { id: "BIN-A1-RECYCLE", name: "Thùng tái chế A1", binGroup: "Tái chế", location: "Nhà A1", building: "A1", floor: "1", qrCode: "QR-A1", status: "active", capacity: 54, mapX: 30, mapY: 78 };

  const result = await store.updateBinStatus(bin, " archived ");

  expect(result.data.status).toBe("active");
  expect(result.error).toEqual(expect.any(Error));
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("bins", { status: " archived " });
  expect(mockTables.bins.find(item => item.id === "BIN-A1-RECYCLE").status).toBe("active");
  expect(localStorage.getItem("ecoGuardianBins")).toBeNull();
});

test("updateFeedbackStatus rejects unsupported statuses before writing feedback", async () => {
  const store = require("./admin/services/supabaseStore");
  const feedback = { id: "FB001", userName: "Nguyễn Minh Anh", category: "Thùng đầy", message: "Thùng tái chế A1 gần đầy.", status: "unread", priority: "high", binId: "BIN-A1-RECYCLE", adminNote: "", timestamp: "2026-07-07T07:20:00.000Z" };

  const result = await store.updateFeedbackStatus(feedback, " archived ");

  expect(result.data.status).toBe("unread");
  expect(result.error).toEqual(expect.any(Error));
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("feedback", expect.objectContaining({ status: " archived " }));
  expect(mockTables.feedback.find(item => item.id === "FB001").status).toBe("unread");
  expect(localStorage.getItem("ecoGuardianFeedback")).toBeNull();
});

test("savePointRules rejects non-array rules before writing point rules", async () => {
  const store = require("./admin/services/supabaseStore");
  const existingRules = JSON.stringify(mockTables.point_rules);

  const result = await store.savePointRules("bad-rules");

  expect(result.data).toEqual([]);
  expect(result.error).toEqual(expect.any(Error));
  expect(mockSupabaseFrom).not.toHaveBeenCalledWith("point_rules");
  expect(JSON.stringify(mockTables.point_rules)).toBe(existingRules);
  expect(localStorage.getItem("ecoGuardianPointRules")).toBeNull();
});

test("saveManualPointHistory rejects invalid manual point records before writing point history", async () => {
  const store = require("./admin/services/supabaseStore");
  const invalidRecords = [
    { userId: "", action: "Nộp rác sự kiện", points: 5 },
    { userId: "SV001", action: "   ", points: 5 },
    { userId: "SV001", action: "Điều chỉnh sai", points: 0 },
    { userId: "SV001", action: "Điều chỉnh sai", points: "bad-points" },
  ];

  const results = [];
  for (const record of invalidRecords) {
    results.push(await store.saveManualPointHistory(record));
  }

  results.forEach(response => {
    expect(response.data).toBeNull();
    expect(response.error).toEqual(expect.any(Error));
  });
  expect(mockSupabaseFrom).not.toHaveBeenCalledWith("point_history");
  expect(mockSupabaseInsert).not.toHaveBeenCalledWith("point_history", expect.anything());
  expect(mockTables.point_history).toHaveLength(1);
  expect(mockTables.users.find(user => user.id === "SV001").points).toBe(245);
  expect(localStorage.getItem("ecoGuardianPointHistory")).toBeNull();
  expect(localStorage.getItem("ecoGuardianUsers")).toBeNull();
});

test("Supabase store save and update failures persist every local fallback table", async () => {
  const store = require("./admin/services/supabaseStore");
  mockSupabaseFailure = true;

  const userResult = await store.saveUser({ id: "SV002", name: "Trần Hoàng Nam", email: "nam@school.edu.vn", role: "student", group: "CNTT K19", points: 7, status: "active", createdAt: "2026-07-07T08:00:00.000Z" });
  const binResult = await store.saveBin({ id: "BIN-FALLBACK", name: "Thùng fallback", binGroup: "Tái chế", location: "Nhà F", building: "F", floor: "1", qrCode: "QR-F", status: "active", capacity: 44, mapX: 41, mapY: 62 });
  const predictionResult = await store.savePredictionRecord({ id: "scan-fallback", class: "plastic", confidence: 0.88, source: "upload", timestamp: "2026-07-07T10:00:00.000Z", status: "pending", userId: "SV002", binId: "BIN-FALLBACK", imageName: "fallback.jpg" });
  const feedbackResult = await store.saveFeedbackItem({ id: "FB-FALLBACK", userName: "Giám thị F", category: "Thùng đầy", message: "Thùng fallback đầy.", status: "unread", priority: "high", binId: "BIN-FALLBACK", adminNote: "", timestamp: "2026-07-07T10:00:00.000Z" });
  const rulesResult = await store.savePointRules([{ id: "fallback-rule", label: "Fallback rule", classKeys: ["plastic"], binGroup: "Tái chế", points: 4, enabled: true }]);
  const rewardResult = await store.saveRewardRedemption({ id: "RW-FALLBACK", userId: "SV002", rewardLabel: "Voucher fallback", costPoints: 50, status: "pending", requestedAt: "2026-07-07T10:00:00.000Z" });
  const settingsResult = await store.saveModelThreshold(0.73);
  const manualPointResult = await store.saveManualPointHistory({ userId: "SV002", binId: "BIN-FALLBACK", binGroup: "Tái chế", action: "Nộp rác sự kiện", points: 4, adminNote: "Ghi fallback point" });
  const predictionStatusResult = await store.setPredictionStatus({ id: "scan-fallback", class: "plastic", confidence: 0.88, source: "upload", timestamp: "2026-07-07T10:00:00.000Z", status: "pending", userId: "SV002", binId: "BIN-FALLBACK" }, "rejected");
  const userStatusResult = await store.updateUserStatus({ id: "SV002", name: "Trần Hoàng Nam", email: "nam@school.edu.vn", role: "student", group: "CNTT K19", points: 11, status: "active" }, "locked");
  const binStatusResult = await store.updateBinStatus({ id: "BIN-FALLBACK", name: "Thùng fallback", binGroup: "Tái chế", location: "Nhà F", building: "F", floor: "1", qrCode: "QR-F", status: "active", capacity: 44, mapX: 41, mapY: 62 }, "full");
  const feedbackUpdateResult = await store.updateFeedbackItem({ id: "FB-FALLBACK", userName: "Giám thị F", category: "Thùng đầy", message: "Thùng fallback đầy.", status: "unread", priority: "high", binId: "BIN-FALLBACK", adminNote: "", timestamp: "2026-07-07T10:00:00.000Z" }, { status: "resolved", adminNote: "Đã xử lý fallback" });
  const rewardUpdateResult = await store.updateRewardRedemption({ id: "RW-FALLBACK", userId: "SV002", rewardLabel: "Voucher fallback", costPoints: 50, status: "pending", requestedAt: "2026-07-07T10:00:00.000Z" }, { status: "approved", adminNote: "Đã nhận fallback" });

  [
    userResult,
    binResult,
    predictionResult,
    feedbackResult,
    rulesResult,
    rewardResult,
    settingsResult,
    manualPointResult,
    predictionStatusResult,
    userStatusResult,
    binStatusResult,
    feedbackUpdateResult,
    rewardUpdateResult,
  ].forEach(response => expect(response.source).toBe("local"));

  expect(JSON.parse(localStorage.getItem("ecoGuardianUsers") || "[]")).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "SV002", points: 11, status: "locked" }),
  ]));
  expect(JSON.parse(localStorage.getItem("ecoGuardianBins") || "[]")).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "BIN-FALLBACK", status: "full", mapX: 41, mapY: 62 }),
  ]));
  expect(JSON.parse(localStorage.getItem("smartWastePredictions") || "[]")).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "scan-fallback", status: "rejected", binId: "BIN-FALLBACK", imageName: "fallback.jpg" }),
  ]));
  expect(JSON.parse(localStorage.getItem("ecoGuardianFeedback") || "[]")).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "FB-FALLBACK", status: "resolved", adminNote: "Đã xử lý fallback", binId: "BIN-FALLBACK" }),
  ]));
  expect(JSON.parse(localStorage.getItem("ecoGuardianPointRules") || "[]")).toEqual([
    expect.objectContaining({ id: "fallback-rule", classKeys: ["plastic"], points: 4 }),
  ]);
  expect(JSON.parse(localStorage.getItem("ecoGuardianRewardRedemptions") || "[]")).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "RW-FALLBACK", status: "approved", adminNote: "Đã nhận fallback" }),
  ]));
  expect(localStorage.getItem("ecoGuardianModelThreshold")).toBe("0.73");
  expect(JSON.parse(localStorage.getItem("ecoGuardianPointHistory") || "[]")).toEqual(expect.arrayContaining([
    expect.objectContaining({ userId: "SV002", binId: "BIN-FALLBACK", points: 4, source: "manual_adjustment", adminNote: "Ghi fallback point" }),
  ]));
});
test("redirects unauthenticated users to Supabase login", async () => {
  mockAuthUser = null;
  render(<App />);

  expect(await screen.findByRole("heading", { name: /đăng nhập quản trị/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /đăng nhập/i })).toBeInTheDocument();
});

test("redirects to login when initial Supabase session check fails", async () => {
  mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
    data: null,
    error: new Error("Auth session unavailable"),
  });

  render(<App />);

  expect(await screen.findByRole("heading", { name: /đăng nhập quản trị/i })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /tổng quan quản trị/i })).not.toBeInTheDocument();
});

test("loads admin dashboard when Supabase auth listener registration fails", async () => {
  mockSupabaseClient.auth.onAuthStateChange.mockImplementationOnce(() => {
    throw new Error("Auth listener unavailable");
  });

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
});

test("login page rejects blank credentials before calling Supabase Auth", async () => {
  mockAuthUser = null;
  render(<App />);

  expect(await screen.findByRole("heading", { name: /đăng nhập quản trị/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "   " } });
  fireEvent.change(screen.getByLabelText(/mật khẩu/i), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));

  expect(await screen.findByText(/nhập email và mật khẩu/i)).toBeInTheDocument();
  expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: /tổng quan quản trị/i })).not.toBeInTheDocument();
});

test("login page rejects invalid email format before calling Supabase Auth", async () => {
  mockAuthUser = null;
  render(<App />);

  expect(await screen.findByRole("heading", { name: /đăng nhập quản trị/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "admin-school" } });
  fireEvent.change(screen.getByLabelText(/mật khẩu/i), { target: { value: "admin-demo" } });
  fireEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));

  expect(await screen.findByText(/email không hợp lệ/i)).toBeInTheDocument();
  expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
  expect(screen.queryByRole("heading", { name: /tổng quan quản trị/i })).not.toBeInTheDocument();
});
test("shows Supabase login errors from Auth", async () => {
  mockAuthUser = null;
  mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
    data: null,
    error: new Error("Invalid login credentials"),
  });

  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /đăng nhập/i }));

  expect(await screen.findByText(/Invalid login credentials/i)).toBeInTheDocument();
});

test("loads admin dashboard after login even when auth listener has not fired yet", async () => {
  mockAuthUser = null;
  mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
    data: { user: { id: "AD001", email: "admin@school.edu.vn" } },
    error: null,
  });

  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /đăng nhập/i }));

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /đăng nhập quản trị/i })).not.toBeInTheDocument();
});

test("blocks successful Supabase login when profile is not admin", async () => {
  mockAuthUser = null;
  mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
    data: { user: { id: "SV001", email: "minhanh@school.edu.vn" } },
    error: null,
  });

  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /đăng nhập/i }));

  expect(await screen.findByText(/tài khoản chưa có quyền admin/i)).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /tổng quan quản trị/i })).not.toBeInTheDocument();
});

test("blocks authenticated non-admin users", async () => {
  mockAuthUser = { id: "SV001", email: "minhanh@school.edu.vn" };
  render(<App />);

  expect(await screen.findByRole("heading", { name: /không có quyền truy cập/i })).toBeInTheDocument();
});

test("blocks admin users whose profile is not active", async () => {
  mockTables.users = mockTables.users.map(user => user.id === "AD001" ? { ...user, status: "locked" } : user);

  render(<App />);

  expect(await screen.findByRole("heading", { name: /không có quyền truy cập/i })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /tổng quan quản trị/i })).not.toBeInTheDocument();
});

test("accepts admin profile with dirty role and active status whitespace", async () => {
  mockTables.users = mockTables.users.map(user => user.id === "AD001" ? { ...user, role: " Admin ", status: " active " } : user);

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /không có quyền truy cập/i })).not.toBeInTheDocument();
});

test("matches admin profile by trimmed case-insensitive email when auth id differs", async () => {
  mockAuthUser = { id: "auth-uuid-admin", email: "admin@school.edu.vn" };
  mockTables.users = mockTables.users.map(user => user.id === "AD001" ? { ...user, email: " Admin@School.edu.vn " } : user);

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: /không có quyền truy cập/i })).not.toBeInTheDocument();
});

test("loads dashboard data from Supabase for admin users", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect((await screen.findAllByText(/nguồn dữ liệu Supabase/i)).length).toBeGreaterThan(0);
  const adminNav = screen.getByRole("navigation", { name: /menu/i });
  expect(within(adminNav).getByRole("link", { name: /lượt quét/i })).toBeInTheDocument();
  expect(screen.getAllByText("Pin / nguy hại").length).toBeGreaterThan(0);
  expect(screen.getByTestId("line-chart")).toBeInTheDocument();
});

test("logs out admin users and returns to login", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /đăng xuất/i }));

  await waitFor(() => expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled());
  expect(await screen.findByRole("heading", { name: /đăng nhập quản trị/i })).toBeInTheDocument();
});

test("returns to login when Supabase signOut fails", async () => {
  mockSupabaseClient.auth.signOut.mockImplementationOnce(() => Promise.resolve({ error: new Error("network-down") }));

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /đăng xuất/i }));

  await waitFor(() => expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled());
  expect(await screen.findByRole("heading", { name: /đăng nhập quản trị/i })).toBeInTheDocument();
});
test("dashboard uses point history for awarded Ecopoint KPI and activity", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();

  const ecopointCard = screen.getByText(/ecopoint đã cấp/i).closest("article");
  expect(ecopointCard).toBeInTheDocument();
  await waitFor(() => expect(within(ecopointCard).getByText("5")).toBeInTheDocument());
  expect(within(ecopointCard).getByText(/1 lượt cộng điểm/i)).toBeInTheDocument();

  expect(screen.getByRole("heading", { name: /hoạt động cộng điểm mới nhất/i })).toBeInTheDocument();
  expect(screen.getByText("Duyệt Nhựa")).toBeInTheDocument();
  expect(screen.getByText("Nguyễn Minh Anh")).toBeInTheDocument();
  expect(screen.getAllByText("Thùng tái chế A1").length).toBeGreaterThan(0);
});


test("report filters do not treat operation record ids as linked bin ids", () => {
  const { buildReportSummary, filterReportData } = require("./admin/services/reportMetrics");
  const data = {
    bins: [{ id: "BIN-A1-RECYCLE", building: "A1", binGroup: "Tái chế", status: "active", capacity: 20 }],
    predictions: [{ id: "BIN-A1-RECYCLE", class: "plastic", timestamp: "2026-07-07T08:00:00.000Z" }],
    pointHistory: [{ id: "BIN-A1-RECYCLE", points: 5, timestamp: "2026-07-07T08:10:00.000Z" }],
    feedback: [{ id: "BIN-A1-RECYCLE", status: "unread", timestamp: "2026-07-07T08:20:00.000Z" }],
  };

  const filtered = filterReportData(data, { building: "A1" });
  const summary = buildReportSummary(filtered);

  expect(filtered.predictions).toEqual([]);
  expect(filtered.pointHistory).toEqual([]);
  expect(filtered.feedback).toEqual([]);
  expect(summary).toEqual(expect.objectContaining({ totalScans: 0, totalPoints: 0, openFeedback: 0 }));
});

test("reports page filters real operations data and exports filtered csv", async () => {
  window.location.hash = "#/reports?building=A1&binGroup=T%C3%A1i%20ch%E1%BA%BF";
  URL.createObjectURL = jest.fn(() => "blob:report");
  URL.revokeObjectURL = jest.fn();
  const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  render(<App />);

  expect(await screen.findByRole("heading", { name: /báo cáo/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText(/tòa nhà/i)).toHaveValue("A1"));
  expect(screen.getByLabelText(/nhóm rác/i)).toHaveValue("Tái chế");
  expect(await screen.findByText(/ecopoint đã cấp/i)).toBeInTheDocument();
  expect(screen.getByText(/phản hồi mở/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /xuất csv/i }));

  expect(URL.createObjectURL).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  clickSpy.mockRestore();
});

test("reports page normalizes dirty building and bin group query filters in the UI", async () => {
  window.location.hash = "#/reports?building=%20a1%20&binGroup=%20T%C3%81I%20CH%E1%BA%BE%20";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /báo cáo/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText(/tòa nhà/i)).toHaveValue("A1"));
  expect(screen.getByLabelText(/nhóm rác/i)).toHaveValue("Tái chế");
  const scanCard = screen.getAllByText("Lượt quét").map(item => item.closest("article")).find(Boolean);
  await waitFor(() => expect(within(scanCard).getByText("2")).toBeInTheDocument());
});

test("reports page ignores invalid date query filters", async () => {
  window.location.hash = "#/reports?dateFrom=bad-date&dateTo=also-bad";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /báo cáo/i })).toBeInTheDocument();
  const scanCard = screen.getAllByText("Lượt quét").map(item => item.closest("article")).find(Boolean);
  const pointCard = screen.getAllByText(/ecopoint đã cấp/i).map(item => item.closest("article")).find(Boolean);

  await waitFor(() => expect(within(scanCard).getByText("2")).toBeInTheDocument());
  expect(within(pointCard).getByText("5")).toBeInTheDocument();
  expect(screen.getAllByText("Tái chế").length).toBeGreaterThan(0);
});

test("reports page grouped table counts dirty full bin status", async () => {
  mockTables.predictions = [];
  mockTables.feedback = [];
  mockTables.point_history = [];
  mockTables.bins = [
    { id: "BIN-DIRTY-FULL-REPORT", name: "Trạm đầy status bẩn", bin_group: "Tái chế", location: "Nhà A", building: "A", floor: "1", qr_code: "QR-DIRTY-FULL-REPORT", status: " FULL ", capacity: 20, map_x: 40, map_y: 40 },
  ];
  window.location.hash = "#/reports";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /báo cáo/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/theo bộ lọc hiện tại/i)).toBeInTheDocument());
  const reportsTable = screen.getByRole("table");
  const recycleRow = within(reportsTable).getByText("Tái chế").closest("tr");
  expect(within(recycleRow).getByText("1")).toBeInTheDocument();
});

test("reports page handles empty operations data and exports empty csv", async () => {
  mockTables.predictions = [];
  mockTables.bins = [];
  mockTables.feedback = [];
  mockTables.point_history = [];
  window.location.hash = "#/reports";
  URL.createObjectURL = jest.fn(() => "blob:empty-report");
  URL.revokeObjectURL = jest.fn();
  const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  render(<App />);

  expect(await screen.findByRole("heading", { name: /báo cáo/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/theo bộ lọc hiện tại/i)).toBeInTheDocument());
  expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(4);

  fireEvent.click(screen.getByRole("button", { name: /xuất csv/i }));

  expect(URL.createObjectURL).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  clickSpy.mockRestore();
});

test("users page searches by user id", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/tên, email, lớp/i), { target: { value: "SV001" } });

  const usersTable = screen.getByRole("table");
  expect(await within(usersTable).findByText("Nguyễn Minh Anh")).toBeInTheDocument();
  expect(within(usersTable).queryByText("Quản trị EcoGuardian")).not.toBeInTheDocument();
});

test("users page trims search text before filtering", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/tên, email, lớp/i), { target: { value: "  SV001  " } });

  const usersTable = screen.getByRole("table");
  expect(await within(usersTable).findByText("Nguyễn Minh Anh")).toBeInTheDocument();
  expect(within(usersTable).queryByText("Quản trị EcoGuardian")).not.toBeInTheDocument();
});

test("users page filters Supabase role codes with Vietnamese role labels", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/vai trò/i), { target: { value: "admin" } });

  const usersTable = screen.getByRole("table");
  expect(await within(usersTable).findByText("Quản trị EcoGuardian")).toBeInTheDocument();
  expect(within(usersTable).queryByText("Nguyễn Minh Anh")).not.toBeInTheDocument();
});

test("users page rejects duplicate email before saving", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm người dùng/i }));
  fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: "Sinh viên trùng email" } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "minhanh@school.edu.vn" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu người dùng/i }));

  expect(await screen.findByText(/email đã tồn tại/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseUpsert).not.toHaveBeenCalled();
});

test("users page rejects blank required user fields after trimming", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm người dùng/i }));
  fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: "   " } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "new-user@school.edu.vn" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu người dùng/i }));

  expect(await screen.findByText(/nhập họ tên và email/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseUpsert).not.toHaveBeenCalled();
});

test("users page rejects invalid email format before saving", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm người dùng/i }));
  fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: "Sinh viên email lỗi" } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "not-an-email" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu người dùng/i }));

  expect(await screen.findByText(/email không hợp lệ/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseUpsert).not.toHaveBeenCalled();
});

test("users page filters users by account status", async () => {
  mockTables.users = [
    ...mockTables.users,
    { id: "SV002", name: "Trần Hoàng Nam", email: "hoangnam@school.edu.vn", role: "student", group: "CNTT K19", points: 17, status: "locked" },
  ];
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/trạng thái/i), { target: { value: "locked" } });

  const usersTable = screen.getByRole("table");
  expect(await within(usersTable).findByText("Trần Hoàng Nam")).toBeInTheDocument();
  expect(within(usersTable).queryByText("Nguyễn Minh Anh")).not.toBeInTheDocument();
});

test("users page normalizes dirty account status values", async () => {
  mockTables.users = [
    { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
    { id: "SV009", name: "Sinh viên status bẩn", email: "dirty-status@school.edu.vn", role: "student", group: "CNTT K20", points: 9, status: " LOCKED " },
  ];
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/trạng thái/i), { target: { value: "locked" } });

  const usersTable = screen.getByRole("table");
  const dirtyStatusRow = (await within(usersTable).findByText("Sinh viên status bẩn")).closest("tr");
  expect(within(dirtyStatusRow).getByText("Đã khóa")).toBeInTheDocument();
  expect(within(dirtyStatusRow).getByRole("button", { name: "Mở khóa" })).toBeInTheDocument();
});

test("users page filters users by class or faculty group", async () => {
  mockTables.users = [
    ...mockTables.users,
    { id: "SV002", name: "Trần Hoàng Nam", email: "hoangnam@school.edu.vn", role: "student", group: "CNTT K19", points: 17, status: "active" },
  ];
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  expect(await screen.findByText("Nguyễn Minh Anh")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/lớp \/ khoa/i), { target: { value: "CNTT K19" } });

  const usersTable = screen.getByRole("table");
  expect(await within(usersTable).findByText("Trần Hoàng Nam")).toBeInTheDocument();
  expect(within(usersTable).queryByText("Nguyễn Minh Anh")).not.toBeInTheDocument();
});

test("users page normalizes dirty class or faculty group labels", async () => {
  mockTables.users = [
    { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
    { id: "SV010", name: "Sinh viên nhóm bẩn", email: "dirty-group@school.edu.vn", role: "student", group: " CNTT K19 ", points: 19, status: "active" },
    { id: "SV011", name: "Sinh viên nhóm sạch", email: "clean-group@school.edu.vn", role: "student", group: "CNTT K18", points: 18, status: "active" },
  ];
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  expect(await screen.findByText("Sinh viên nhóm bẩn")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/lớp \/ khoa/i), { target: { value: "CNTT K19" } });

  const usersTable = screen.getByRole("table");
  expect(await within(usersTable).findByText("Sinh viên nhóm bẩn")).toBeInTheDocument();
  expect(within(usersTable).queryByText("Sinh viên nhóm sạch")).not.toBeInTheDocument();
});

test("users page generates the next unused student id when creating users", async () => {
  mockTables.users = [
    { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
    { id: "SV003", name: "Sinh viên đã có", email: "existing@school.edu.vn", role: "student", group: "CNTT K18", points: 12, status: "active" },
  ];
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm người dùng/i }));
  fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: "Sinh viên mới" } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "new@school.edu.vn" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu người dùng/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "SV004",
    name: "Sinh viên mới",
    email: "new@school.edu.vn",
  })));
});

test("users create failure saves the new user to local fallback", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm người dùng/i }));
  fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: "Sinh viên fallback" } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "fallback@school.edu.vn" } });
  fireEvent.change(screen.getAllByLabelText(/lớp \/ khoa/i).at(-1), { target: { value: "CNTT K21" } });

  mockSupabaseFailure = true;
  fireEvent.click(screen.getByRole("button", { name: /lưu người dùng/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "SV002",
    name: "Sinh viên fallback",
    email: "fallback@school.edu.vn",
    role: "student",
    group: "CNTT K21",
    points: 0,
    status: "active",
  })));
  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();
  expect(await screen.findByText("Sinh viên fallback")).toBeInTheDocument();

  const storedUsers = JSON.parse(localStorage.getItem("ecoGuardianUsers") || "[]");
  expect(storedUsers).toEqual(expect.arrayContaining([expect.objectContaining({
    id: "SV002",
    name: "Sinh viên fallback",
    email: "fallback@school.edu.vn",
    role: "student",
    group: "CNTT K21",
    points: 0,
    status: "active",
  })]));
});
test("users page edits user details without changing id points or status", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  const studentRow = (await screen.findByText("Nguyễn Minh Anh")).closest("tr");
  fireEvent.click(within(studentRow).getByRole("button", { name: /sửa sv001/i }));

  const dialog = await screen.findByRole("dialog", { name: /sửa người dùng/i });
  fireEvent.change(within(dialog).getByLabelText(/họ tên/i), { target: { value: "Nguyễn Minh Anh Eco" } });
  fireEvent.change(within(dialog).getByLabelText(/email/i), { target: { value: "minhanh.eco@school.edu.vn" } });
  fireEvent.change(within(dialog).getByLabelText(/vai trò/i), { target: { value: "volunteer" } });
  fireEvent.change(within(dialog).getByLabelText(/lớp \/ khoa/i), { target: { value: "CLB Môi trường" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /lưu thay đổi/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "SV001",
    name: "Nguyễn Minh Anh Eco",
    email: "minhanh.eco@school.edu.vn",
    role: "volunteer",
    group: "CLB Môi trường",
    points: 245,
    status: "active",
  })));
  const updatedRow = (await screen.findByText("Nguyễn Minh Anh Eco")).closest("tr");
  expect(within(updatedRow).getByText("Tình nguyện viên")).toBeInTheDocument();
  expect(within(updatedRow).getByText("CLB Môi trường")).toBeInTheDocument();
  expect(within(updatedRow).getByText("245")).toBeInTheDocument();
});
test("users page rejects duplicate email when editing another user", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  const studentRow = (await screen.findByText("Nguyễn Minh Anh")).closest("tr");
  fireEvent.click(within(studentRow).getByRole("button", { name: /sửa sv001/i }));

  const dialog = await screen.findByRole("dialog", { name: /sửa người dùng/i });
  fireEvent.change(within(dialog).getByLabelText(/email/i), { target: { value: "admin@school.edu.vn" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /lưu thay đổi/i }));

  expect(await screen.findByText(/email đã tồn tại trong danh sách người dùng/i)).toBeInTheDocument();
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({
    id: "SV001",
    email: "admin@school.edu.vn",
  }));
  expect(screen.getByRole("dialog", { name: /sửa người dùng/i })).toBeInTheDocument();
  expect(await screen.findByText("Nguyễn Minh Anh")).toBeInTheDocument();
});
test("users page locks and unlocks a user account", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  const studentRow = (await screen.findByText("Nguyễn Minh Anh")).closest("tr");
  fireEvent.click(within(studentRow).getByRole("button", { name: "Khóa" }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("users", { status: "locked" }));
  expect(await within(studentRow).findByText("Đã khóa")).toBeInTheDocument();

  fireEvent.click(within(studentRow).getByRole("button", { name: "Mở khóa" }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("users", { status: "active" }));
  expect(await within(studentRow).findByText("Hoạt động")).toBeInTheDocument();
});

test("users page resets toast tone after a successful status update", async () => {
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm người dùng/i }));
  fireEvent.change(screen.getByLabelText(/họ tên/i), { target: { value: "Sinh viên lỗi" } });
  fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: "bad-email" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu người dùng/i }));

  expect(await screen.findByText(/email không hợp lệ/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");

  fireEvent.click(screen.getByRole("button", { name: /đóng modal/i }));
  const studentRow = (await screen.findByText("Nguyễn Minh Anh")).closest("tr");
  fireEvent.click(within(studentRow).getByRole("button", { name: "Khóa" }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("users", { status: "locked" }));
  expect(await screen.findByText(/đã cập nhật trạng thái người dùng/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-success");
  expect(screen.getByRole("status")).not.toHaveClass("tone-danger");
});

test("users status update failure persists live users to local fallback", async () => {
  mockSupabaseUpdateFailure = true;
  mockTables.users = [
    { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
    { id: "SV777", name: "Sinh viên Supabase Live", email: "live@school.edu.vn", role: "student", group: "CNTT K20", points: 33, status: "active" },
  ];
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  const liveRow = (await screen.findByText("Sinh viên Supabase Live")).closest("tr");
  fireEvent.click(within(liveRow).getByRole("button", { name: "Khóa" }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("users", { status: "locked" }));
  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();
  expect(await within(liveRow).findByText("Đã khóa")).toBeInTheDocument();

  const storedUsers = JSON.parse(localStorage.getItem("ecoGuardianUsers") || "[]");
  expect(storedUsers).toEqual(expect.arrayContaining([expect.objectContaining({
    id: "SV777",
    status: "locked",
  })]));
});

test("users page displays malformed point values as zero", async () => {
  mockTables.users = [
    { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
    { id: "SV001", name: "Nguyễn Minh Anh", email: "minhanh@school.edu.vn", role: "student", group: "CNTT K18", points: null, status: "active" },
  ];
  window.location.hash = "#/users";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /người dùng \/ lớp \/ khoa/i })).toBeInTheDocument();
  const studentRow = (await screen.findByText("Nguyễn Minh Anh")).closest("tr");

  expect(within(studentRow).getByText("0")).toBeInTheDocument();
});

test("model settings clamps invalid saved confidence threshold", async () => {
  mockTables.settings = [
    { id: "model", threshold: 1.8, model_name: "MobileNetV2", class_count: 10 },
  ];
  window.location.hash = "#/model";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /cài đặt model/i })).toBeInTheDocument();
  expect(await screen.findByText(/ngưỡng cảnh báo confidence: 95%/i)).toBeInTheDocument();
});

test("model settings clamps negative saved threshold to the minimum", async () => {
  mockTables.settings = [
    { id: "model", threshold: -0.2, model_name: "MobileNetV2", class_count: 10 },
  ];
  window.location.hash = "#/model";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /cài đặt model/i })).toBeInTheDocument();
  expect(await screen.findByText(/ngưỡng cảnh báo confidence: 30%/i)).toBeInTheDocument();
});

test("model settings falls back non-numeric saved threshold to default", async () => {
  mockTables.settings = [
    { id: "model", threshold: "not-a-number", model_name: "MobileNetV2", class_count: 10 },
  ];
  window.location.hash = "#/model";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /cài đặt model/i })).toBeInTheDocument();
  expect(await screen.findByText(/ngưỡng cảnh báo confidence: 65%/i)).toBeInTheDocument();
});
test("model settings writes clamped threshold payload to Supabase", async () => {
  window.location.hash = "#/model";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /cài đặt model/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/ngưỡng cảnh báo confidence/i), { target: { value: "1.8" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu cài đặt/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "model",
    threshold: 0.95,
    model_name: "MobileNetV2",
    class_count: 10,
  })));
  expect(await screen.findByText(/đã lưu cài đặt model/i)).toBeInTheDocument();
});

test("redesigned admin shell shows grouped navigation and command bar", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect(screen.getByText("Vận hành")).toBeInTheDocument();
  expect(screen.getByText("Dữ liệu")).toBeInTheDocument();
  expect(screen.getByText("Hệ thống")).toBeInTheDocument();
  expect(screen.getByText(/trực tuyến/i)).toBeInTheDocument();
  expect(screen.getByText(/tình trạng campus/i)).toBeInTheDocument();
});

test("dashboard highlights the operations summary panel", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /trung tâm điều phối/i })).toBeInTheDocument();
  expect(screen.getByText(/mức độ đầy trung bình/i)).toBeInTheDocument();
  expect(screen.getByText(/cảnh báo bảo trì/i)).toBeInTheDocument();
});

test("dashboard shows today's priority work from real operations data", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /việc cần xử lý hôm nay/i })).toBeInTheDocument();
  expect(await screen.findByText(/1 phản hồi chưa xử lý/i)).toBeInTheDocument();
  expect(screen.getByText(/1 lượt quét độ tin cậy thấp/i)).toBeInTheDocument();
  expect(screen.getByText(/1 lượt quét chờ duyệt/i)).toBeInTheDocument();
  expect(screen.getAllByText(/scan-low/i).length).toBeGreaterThan(0);
});

test("dashboard uses model threshold settings for low-confidence priority work", async () => {
  mockTables.settings = [{ id: "model", threshold: 0.8, model_name: "MobileNetV2", class_count: 10 }];
  mockTables.predictions = [
    { id: "scan-threshold-dashboard", class: "plastic", confidence: 0.72, source: "upload", timestamp: "2026-07-07T08:00:00.000Z", bin_group: "Tái chế", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
  ];
  mockTables.feedback = [];
  mockTables.bins = [];
  mockTables.point_history = [];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /việc cần xử lý hôm nay/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("link", { name: /1 lượt quét độ tin cậy thấp/i }));

  expect(await screen.findByRole("heading", { name: /duyệt kết quả ai/i })).toBeInTheDocument();
  expect(window.location.hash).toContain("status=pending");
  expect(window.location.hash).toContain("confidence=low");
  expect(screen.getByLabelText(/độ tin cậy/i)).toHaveValue("low");
  expect(await screen.findByText("scan-threshold-dashboard")).toBeInTheDocument();
});

test("dashboard handles malformed confidence and timestamps safely", async () => {
  mockTables.predictions = [
    { id: "scan-bad-data", class: "plastic", confidence: "bad", source: "upload", timestamp: "not-a-date", bin_group: "Tái chế", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
  ];
  mockTables.point_history = [
    { id: 902, prediction_id: "scan-bad-data", user_id: "SV001", bin_id: "BIN-A1-RECYCLE", class: "plastic", bin_group: "Tái chế", action: "Duyệt Nhựa", points: "bad", timestamp: "not-a-date", created_at: "not-a-date" },
  ];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect(await screen.findByText("scan-bad-data")).toBeInTheDocument();
  expect(screen.getAllByText("0%").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Không rõ").length).toBeGreaterThan(0);
  expect(screen.queryByText(/nan%/i)).not.toBeInTheDocument();
});

test("dashboard normalizes dirty prediction bin groups before counting group cards", async () => {
  mockTables.predictions = [
    { id: "scan-dirty-group-dashboard", class: "plastic", confidence: 0.91, source: "upload", timestamp: "2026-07-07T08:00:00.000Z", bin_group: " TÁI CHẾ ", status: "approved", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
  ];
  mockTables.feedback = [];
  mockTables.bins = [];
  mockTables.point_history = [];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect(await screen.findByText("Nhựa")).toBeInTheDocument();
  const recycleCard = screen.getAllByText("Tái chế")
    .map(item => item.closest("article"))
    .find(item => item?.classList.contains("eg-group-card"));
  expect(within(recycleCard).getByText("1")).toBeInTheDocument();
});


test("dashboard clamps malformed bin capacity before summary metrics", async () => {
  mockTables.predictions = [];
  mockTables.feedback = [];
  mockTables.point_history = [];
  mockTables.bins = [
    { id: "BIN-CAPACITY-DIRTY", name: "Trạm sức chứa bẩn", bin_group: "Tái chế", location: "Nhà A", building: "A", floor: "1", qr_code: "QR-CAPACITY-DIRTY", status: "active", capacity: 150, map_x: 20, map_y: 20 },
  ];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  const capacityMetric = screen.getByText(/mức độ đầy trung bình/i).closest("article");
  await waitFor(() => expect(within(capacityMetric).getByText("100%")).toBeInTheDocument());
  expect(screen.queryByText("150%")).not.toBeInTheDocument();
});

test("dashboard seed button fills empty operation tables when admin user already exists", async () => {
  mockTables.users = [
    { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
  ];
  mockTables.bins = [];
  mockTables.feedback = [];
  mockTables.point_rules = [];
  mockTables.settings = [];
  mockTables.predictions = [];
  mockTables.point_history = [];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /khởi tạo dữ liệu mẫu/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ id: "BIN-A1-RECYCLE", bin_group: "Tái chế" }),
  ])));
  expect(await screen.findByText("Thùng tái chế A1")).toBeInTheDocument();
});

test("dashboard renders empty operations data without crashing", async () => {
  mockTables.users = [
    { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
  ];
  mockTables.predictions = [];
  mockTables.bins = [];
  mockTables.feedback = [];
  mockTables.point_history = [];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect(screen.getByText(/không có cảnh báo cần xử lý ngay/i)).toBeInTheDocument();
  expect(screen.getByText(/chưa có lượt quét nào/i)).toBeInTheDocument();
  expect(screen.getByText(/chưa có lịch sử cộng điểm/i)).toBeInTheDocument();
  expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(4);
});

test("dashboard priority cards navigate to filtered admin pages", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /việc cần xử lý hôm nay/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("link", { name: /1 phản hồi chưa xử lý/i }));

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect(window.location.hash).toContain("status=open");
  expect(screen.getByLabelText(/trạng thái/i)).toHaveValue("open");
});

test("dashboard counts full and dirty maintenance bins as attention work", async () => {
  mockTables.predictions = [];
  mockTables.feedback = [];
  mockTables.point_history = [];
  mockTables.bins = [
    { id: "BIN-HIGH-CAPACITY", name: "Trạm gần đầy", bin_group: "Tái chế", location: "Nhà A", building: "A", floor: "1", qr_code: "QR-HIGH", status: "active", capacity: 90, map_x: 20, map_y: 20 },
    { id: "BIN-DIRTY-MAINTENANCE", name: "Trạm bảo trì bẩn", bin_group: "Còn lại", location: "Nhà B", building: "B", floor: "1", qr_code: "QR-DIRTY-MAINT", status: " Maintenance ", capacity: 30, map_x: 30, map_y: 30 },
  ];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /việc cần xử lý hôm nay/i })).toBeInTheDocument();
  expect((await screen.findAllByText(/trạm gần đầy/i)).length).toBeGreaterThan(0);
  const attentionCard = screen.getByText("Thùng cần kiểm tra").closest("article");
  expect(within(attentionCard).getByText("2")).toBeInTheDocument();

  fireEvent.click(await screen.findByRole("link", { name: /2 thùng cần kiểm tra/i }));

  expect(await screen.findByRole("heading", { name: /thùng rác/i })).toBeInTheDocument();
  expect(window.location.hash).toContain("status=attention");
  expect(screen.getByLabelText(/trạng thái/i)).toHaveValue("attention");
  expect(await screen.findByText("Trạm gần đầy")).toBeInTheDocument();
  expect(await screen.findByText("Trạm bảo trì bẩn")).toBeInTheDocument();
});

test("bins page highlights full bins and supports full status", async () => {
  mockTables.bins = [
    ...mockTables.bins,
    { id: "BIN-C3-FULL", name: "Thùng còn lại C3", bin_group: "Còn lại", location: "Nhà C3", building: "C3", floor: "1", qr_code: "QR-C3", status: "full", capacity: 92, map_x: 50, map_y: 50 },
  ];
  window.location.hash = "#/bins?status=attention";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/trạng thái/i)).toHaveValue("attention");
  expect(await screen.findByText("Thùng còn lại C3")).toBeInTheDocument();
  expect(screen.getByText(/cần thu gom/i)).toBeInTheDocument();
});

test("bins status update failure persists live bins to local fallback", async () => {
  mockSupabaseUpdateFailure = true;
  mockTables.bins = [
    { id: "BIN-LIVE-STATUS", name: "Thùng live Supabase", bin_group: "Tái chế", location: "Nhà Live", building: "Live", floor: "1", qr_code: "QR-LIVE", status: "active", capacity: 44, map_x: 22, map_y: 33 },
  ];
  window.location.hash = "#/bins";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  const liveRow = (await screen.findByText("Thùng live Supabase")).closest("tr");
  fireEvent.click(within(liveRow).getByRole("button", { name: "Bảo trì" }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("bins", { status: "maintenance" }));
  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();
  expect(await within(liveRow).findByText("Bảo trì")).toBeInTheDocument();

  const storedBins = JSON.parse(localStorage.getItem("ecoGuardianBins") || "[]");
  expect(storedBins).toEqual(expect.arrayContaining([expect.objectContaining({
    id: "BIN-LIVE-STATUS",
    status: "maintenance",
  })]));
});

test("dashboard shows a campus bin map with station details", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /bản đồ gis campus/i })).toBeInTheDocument();
  expect(screen.getByRole("application", { name: /bản đồ gis khuôn viên trường/i })).toBeInTheDocument();
  expect(screen.queryByText(/leaflet \+ proj4/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/epsg:32648/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/233 tòa nhà/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/64 tuyến đường/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/đã tải .*geojson/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/nguồn: geojson topoexport/i)).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /dữ liệu quy hoạch khuôn viên/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/chú giải lớp gis/i)).toBeInTheDocument();
  expect(screen.getByText(/ranh giới campus/i)).toBeInTheDocument();
  expect(screen.queryByLabelText(/bảng bật tắt lớp gis/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /hiện lớp bản đồ/i }));
  expect(screen.getByLabelText(/bảng bật tắt lớp gis/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /phóng to bản đồ/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /thu nhỏ bản đồ/i })).toBeInTheDocument();
  expect(screen.queryByText("100%")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^zoom in$/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /^zoom out$/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /căn giữa campus/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /lớp tòa nhà/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /lớp đường sá/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /lớp địa hình/i })).toBeInTheDocument();
  const zoomInButton = screen.getByRole("button", { name: /phóng to bản đồ/i });
  for (let i = 0; i < 12; i += 1) fireEvent.click(zoomInButton);
  expect(screen.queryByText("300%")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/điểm đặt thùng rác trên bản đồ gis/i)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/chi tiết điểm đặt thùng rác/i)).toBeInTheDocument();
  expect(await screen.findByText(/khu mô phỏng/i)).toBeInTheDocument();
  expect(await screen.findByText(/sức chứa 54%/i)).toBeInTheDocument();
});

test("dashboard campus map normalizes malformed bin capacity and map coordinates", async () => {
  mockTables.bins = [
    { id: "BIN-MALFORMED", name: "Thùng dữ liệu lỗi", bin_group: "Tái chế", location: "Khu chưa định vị", building: "Unknown", floor: "1", qr_code: "QR-BAD", status: "active", capacity: "not-a-number", map_x: "bad-x", map_y: "bad-y" },
  ];
  mockTables.feedback = [];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /bản đồ gis campus/i })).toBeInTheDocument();
  expect((await screen.findAllByText("Thùng dữ liệu lỗi")).length).toBeGreaterThan(0);
  expect(await screen.findByText(/sức chứa 0% - ổn định/i)).toBeInTheDocument();
  expect(screen.getByText(/X 43%.*Y 73%/i)).toBeInTheDocument();
  expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/not-a-number/i)).not.toBeInTheDocument();
});

test("dashboard campus map summary normalizes dirty station statuses", async () => {
  mockTables.bins = [
    { id: "BIN-DIRTY-ACTIVE", name: "Trạm active bẩn map", bin_group: "Tái chế", location: "Nhà A", building: "A", floor: "1", qr_code: "QR-DIRTY-ACTIVE", status: " Active ", capacity: 20, map_x: 20, map_y: 20 },
    { id: "BIN-DIRTY-MAINT", name: "Trạm bảo trì bẩn map", bin_group: "Còn lại", location: "Nhà B", building: "B", floor: "1", qr_code: "QR-DIRTY-MAINT", status: " Maintenance ", capacity: 30, map_x: 40, map_y: 40 },
  ];
  mockTables.feedback = [];
  window.location.hash = "#/dashboard";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /bản đồ gis campus/i })).toBeInTheDocument();
  expect((await screen.findAllByText("Trạm active bẩn map")).length).toBeGreaterThan(0);
  expect(screen.getByText("1 điểm hoạt động")).toBeInTheDocument();
  expect(screen.getByText("1 điểm cần kiểm tra")).toBeInTheDocument();
  expect(screen.getByText("Bảo trì")).toBeInTheDocument();
});
test("bins page creates a station and exposes QR scan link", async () => {
  window.location.hash = "#/bins";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm trạm/i }));

  fireEvent.change(screen.getByLabelText(/mã thùng/i), { target: { value: "BIN-B2-ORGANIC" } });
  fireEvent.change(screen.getByLabelText(/tên trạm/i), { target: { value: "Thùng hữu cơ B2" } });
  fireEvent.change(screen.getByLabelText(/nhóm rác/i), { target: { value: "Hữu cơ" } });
  fireEvent.change(screen.getByLabelText(/vị trí/i), { target: { value: "Nhà B2 - tầng 1" } });
  fireEvent.change(screen.getByLabelText(/tòa nhà/i), { target: { value: "B2" } });
  fireEvent.change(screen.getByLabelText(/tầng/i), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText(/mã qr/i), { target: { value: "QR-B2-ORGANIC" } });
  fireEvent.change(screen.getByLabelText(/sức chứa/i), { target: { value: "21" } });
  fireEvent.change(screen.getByLabelText(/tọa độ x/i), { target: { value: "44" } });
  fireEvent.change(screen.getByLabelText(/tọa độ y/i), { target: { value: "68" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu trạm/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-B2-ORGANIC",
    name: "Thùng hữu cơ B2",
    bin_group: "Hữu cơ",
    location: "Nhà B2 - tầng 1",
    building: "B2",
    floor: "1",
    qr_code: "QR-B2-ORGANIC",
    status: "active",
    capacity: 21,
    map_x: 44,
    map_y: 68,
  })));

  expect(await screen.findByText("Thùng hữu cơ B2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /qr bin-b2-organic/i }));

  expect(await screen.findByText("#/ai-test?binId=BIN-B2-ORGANIC")).toBeInTheDocument();
});

test("bins page rejects duplicate station ids when creating a station", async () => {
  window.location.hash = "#/bins";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm trạm/i }));

  fireEvent.change(screen.getByLabelText(/mã thùng/i), { target: { value: "BIN-A1-RECYCLE" } });
  fireEvent.change(screen.getByLabelText(/tên trạm/i), { target: { value: "Trạm ghi đè không hợp lệ" } });
  fireEvent.change(screen.getByLabelText(/vị trí/i), { target: { value: "Nhà A1 - vị trí trùng" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu trạm/i }));

  expect(await screen.findByText(/mã thùng đã tồn tại/i)).toBeInTheDocument();
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-A1-RECYCLE",
    name: "Trạm ghi đè không hợp lệ",
  }));
  expect(screen.getByRole("dialog", { name: /thêm trạm qr/i })).toBeInTheDocument();
  expect(screen.getByText("Thùng tái chế A1")).toBeInTheDocument();
});
test("bins page rejects duplicate QR codes when creating a station", async () => {
  window.location.hash = "#/bins";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm trạm/i }));

  fireEvent.change(screen.getByLabelText(/mã thùng/i), { target: { value: "BIN-NEW-DUP-QR" } });
  fireEvent.change(screen.getByLabelText(/tên trạm/i), { target: { value: "Trạm QR trùng" } });
  fireEvent.change(screen.getByLabelText(/vị trí/i), { target: { value: "Nhà A1 - QR trùng" } });
  fireEvent.change(screen.getByLabelText(/mã qr/i), { target: { value: "QR-A1" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu trạm/i }));

  expect(await screen.findByText(/mã qr đã tồn tại/i)).toBeInTheDocument();
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-NEW-DUP-QR",
    qr_code: "QR-A1",
  }));
  expect(screen.getByRole("dialog", { name: /thêm trạm qr/i })).toBeInTheDocument();
});

test("bins page rejects blank required station fields after trimming", async () => {
  window.location.hash = "#/bins";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm trạm/i }));

  const dialog = await screen.findByRole("dialog", { name: /thêm trạm qr/i });
  fireEvent.change(within(dialog).getByLabelText(/mã thùng/i), { target: { value: "   " } });
  fireEvent.change(within(dialog).getByLabelText(/tên trạm/i), { target: { value: "   " } });
  fireEvent.change(within(dialog).getByLabelText(/vị trí/i), { target: { value: "   " } });
  fireEvent.click(within(dialog).getByRole("button", { name: /lưu trạm/i }));

  expect(await screen.findByText(/nhập đầy đủ mã thùng, tên trạm và vị trí/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ id: "" }));
  expect(screen.getByRole("dialog", { name: /thêm trạm qr/i })).toBeInTheDocument();
});

test("bins page rejects duplicate QR codes when editing another station", async () => {
  mockTables.bins = [
    ...mockTables.bins,
    { id: "BIN-B2-RECYCLE", name: "Thùng tái chế B2", bin_group: "Tái chế", location: "Nhà B2", building: "B2", floor: "1", qr_code: "QR-B2", status: "active", capacity: 40, map_x: 42, map_y: 66 },
  ];
  window.location.hash = "#/bins";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  const secondRow = (await screen.findByText("Thùng tái chế B2")).closest("tr");
  fireEvent.click(within(secondRow).getByRole("button", { name: /sửa bin-b2-recycle/i }));

  const dialog = await screen.findByRole("dialog", { name: /sửa trạm qr/i });
  fireEvent.change(within(dialog).getByLabelText(/mã qr/i), { target: { value: "QR-A1" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /lưu trạm/i }));

  expect(await screen.findByText(/mã qr đã tồn tại/i)).toBeInTheDocument();
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-B2-RECYCLE",
    qr_code: "QR-A1",
  }));
  expect(screen.getByRole("dialog", { name: /sửa trạm qr/i })).toBeInTheDocument();
  expect(await screen.findByText("Thùng tái chế B2")).toBeInTheDocument();
});
test("bins page edits a station without changing its id", async () => {
  window.location.hash = "#/bins";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  const row = (await screen.findByText("Thùng tái chế A1")).closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /sửa bin-a1-recycle/i }));

  const dialog = await screen.findByRole("dialog", { name: /sửa trạm qr/i });
  expect(within(dialog).getByLabelText(/mã thùng/i)).toBeDisabled();
  expect(within(dialog).getByLabelText(/mã thùng/i)).toHaveValue("BIN-A1-RECYCLE");

  fireEvent.change(within(dialog).getByLabelText(/tên trạm/i), { target: { value: "Thùng tái chế A1 cập nhật" } });
  fireEvent.change(within(dialog).getByLabelText(/nhóm rác/i), { target: { value: "Hữu cơ" } });
  fireEvent.change(within(dialog).getByLabelText(/vị trí/i), { target: { value: "Nhà A1 - tầng 2" } });
  fireEvent.change(within(dialog).getByLabelText(/tòa nhà/i), { target: { value: "A1" } });
  fireEvent.change(within(dialog).getByLabelText(/tầng/i), { target: { value: "2" } });
  fireEvent.change(within(dialog).getByLabelText(/mã qr/i), { target: { value: "QR-A1-UPDATED" } });
  fireEvent.change(within(dialog).getByLabelText(/sức chứa/i), { target: { value: "86" } });
  fireEvent.change(within(dialog).getByLabelText(/trạng thái/i), { target: { value: "full" } });
  fireEvent.change(within(dialog).getByLabelText(/tọa độ x/i), { target: { value: "31" } });
  fireEvent.change(within(dialog).getByLabelText(/tọa độ y/i), { target: { value: "79" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /lưu trạm/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-A1-RECYCLE",
    name: "Thùng tái chế A1 cập nhật",
    bin_group: "Hữu cơ",
    location: "Nhà A1 - tầng 2",
    building: "A1",
    floor: "2",
    qr_code: "QR-A1-UPDATED",
    status: "full",
    capacity: 86,
    map_x: 31,
    map_y: 79,
  })));
  expect(await screen.findByText("Thùng tái chế A1 cập nhật")).toBeInTheDocument();
  expect(screen.getByText("BIN-A1-RECYCLE")).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: /sửa trạm qr/i })).not.toBeInTheDocument();
});
test("bins page attention filter shows full maintenance and high-capacity stations", async () => {
  mockTables.bins = [
    { id: "BIN-ACTIVE-LOW", name: "Trạm đang ổn", bin_group: "Tái chế", location: "Nhà A", building: "A", floor: "1", qr_code: "QR-ACTIVE-LOW", status: "active", capacity: 30, map_x: 20, map_y: 20 },
    { id: "BIN-ACTIVE-HIGH", name: "Trạm gần đầy", bin_group: "Tái chế", location: "Nhà B", building: "B", floor: "1", qr_code: "QR-ACTIVE-HIGH", status: "active", capacity: 88, map_x: 30, map_y: 30 },
    { id: "BIN-FULL", name: "Trạm đã đầy", bin_group: "Hữu cơ", location: "Nhà C", building: "C", floor: "1", qr_code: "QR-FULL", status: "full", capacity: 76, map_x: 40, map_y: 40 },
    { id: "BIN-MAINTENANCE", name: "Trạm bảo trì", bin_group: "Còn lại", location: "Nhà D", building: "D", floor: "1", qr_code: "QR-MAINTENANCE", status: "maintenance", capacity: 15, map_x: 50, map_y: 50 },
  ];
  window.location.hash = "#/bins?status=attention";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  expect(await screen.findByText("Trạm gần đầy")).toBeInTheDocument();
  expect(screen.getByText("Trạm đã đầy")).toBeInTheDocument();
  expect(screen.getByText("Trạm bảo trì")).toBeInTheDocument();
  expect(screen.queryByText("Trạm đang ổn")).not.toBeInTheDocument();
});

test("bins page attention filter normalizes dirty bin statuses", async () => {
  mockTables.bins = [
    { id: "BIN-DIRTY-FULL", name: "Trạm status đầy bẩn", bin_group: "Tái chế", location: "Nhà E", building: "E", floor: "1", qr_code: "QR-DIRTY-FULL", status: " FULL ", capacity: 20, map_x: 40, map_y: 40 },
    { id: "BIN-DIRTY-MAINTENANCE", name: "Trạm status bảo trì bẩn", bin_group: "Còn lại", location: "Nhà F", building: "F", floor: "1", qr_code: "QR-DIRTY-MAINT", status: " Maintenance ", capacity: 15, map_x: 50, map_y: 50 },
    { id: "BIN-ACTIVE-LOW", name: "Trạm active thấp", bin_group: "Tái chế", location: "Nhà A", building: "A", floor: "1", qr_code: "QR-ACTIVE-LOW", status: "active", capacity: 30, map_x: 20, map_y: 20 },
  ];
  window.location.hash = "#/bins?status=attention";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  expect(await screen.findByText("Trạm status đầy bẩn")).toBeInTheDocument();
  expect(screen.getByText("Trạm status bảo trì bẩn")).toBeInTheDocument();
  expect(screen.queryByText("Trạm active thấp")).not.toBeInTheDocument();
});

test("bins page normalizes dirty status query filter params", async () => {
  mockTables.bins = [
    { id: "BIN-QUERY-LOW", name: "Trạm query đang ổn", bin_group: "Tái chế", location: "Nhà A", building: "A", floor: "1", qr_code: "QR-QUERY-LOW", status: "active", capacity: 20, map_x: 20, map_y: 20 },
    { id: "BIN-QUERY-HIGH", name: "Trạm query gần đầy", bin_group: "Tái chế", location: "Nhà B", building: "B", floor: "1", qr_code: "QR-QUERY-HIGH", status: "active", capacity: 91, map_x: 30, map_y: 30 },
    { id: "BIN-QUERY-MAINT", name: "Trạm query bảo trì", bin_group: "Còn lại", location: "Nhà C", building: "C", floor: "1", qr_code: "QR-QUERY-MAINT", status: "maintenance", capacity: 12, map_x: 40, map_y: 40 },
  ];
  window.location.hash = "#/bins?status=%20ATTENTION%20";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  expect(await screen.findByText("Trạm query gần đầy")).toBeInTheDocument();
  expect(screen.getByText("Trạm query bảo trì")).toBeInTheDocument();
  expect(screen.queryByText("Trạm query đang ổn")).not.toBeInTheDocument();
});

test("bins page allows editing a station while keeping its own QR code", async () => {
  window.location.hash = "#/bins";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  const row = (await screen.findByText("Thùng tái chế A1")).closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: /sửa bin-a1-recycle/i }));

  const dialog = await screen.findByRole("dialog", { name: /sửa trạm qr/i });
  expect(within(dialog).getByLabelText(/mã qr/i)).toHaveValue("QR-A1");
  fireEvent.change(within(dialog).getByLabelText(/sức chứa/i), { target: { value: "64" } });
  fireEvent.click(within(dialog).getByRole("button", { name: /lưu trạm/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-A1-RECYCLE",
    qr_code: "QR-A1",
    capacity: 64,
  })));
  expect(screen.queryByText(/mã qr đã tồn tại/i)).not.toBeInTheDocument();
});
test("bins page clamps invalid capacity and map coordinates before saving", async () => {
  window.location.hash = "#/bins";
  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác \/ trạm qr/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /thêm trạm/i }));

  fireEvent.change(screen.getByLabelText(/mã thùng/i), { target: { value: "BIN-INVALID-RANGE" } });
  fireEvent.change(screen.getByLabelText(/tên trạm/i), { target: { value: "Thùng kiểm tra biên" } });
  fireEvent.change(screen.getByLabelText(/vị trí/i), { target: { value: "Nhà D - tầng 1" } });
  fireEvent.change(screen.getByLabelText(/sức chứa/i), { target: { value: "150" } });
  fireEvent.change(screen.getByLabelText(/tọa độ x/i), { target: { value: "-10" } });
  fireEvent.change(screen.getByLabelText(/tọa độ y/i), { target: { value: "140" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu trạm/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-INVALID-RANGE",
    capacity: 100,
    map_x: 0,
    map_y: 100,
  })));
});
test("feedback page links reports to bins and moves items through workflow", async () => {
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect((await screen.findAllByText("Thùng tái chế A1")).length).toBeGreaterThan(0);
  expect(screen.getByText(/Nhà A1/)).toBeInTheDocument();
  expect(screen.getAllByText("Cao").length).toBeGreaterThan(0);
  expect(screen.getByText(/ưu tiên cao/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /nhận xử lý FB001/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("feedback", expect.objectContaining({ status: "in_progress" })));
  expect((await screen.findAllByText("Đang xử lý")).length).toBeGreaterThan(0);

  fireEvent.click(await screen.findByRole("button", { name: /mở chi tiết FB001/i }));
  fireEvent.change(screen.getByLabelText(/ghi chú xử lý/i), { target: { value: "Đã báo đội vệ sinh kiểm tra A1." } });
  fireEvent.click(screen.getByRole("button", { name: /lưu ghi chú/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("feedback", expect.objectContaining({ admin_note: "Đã báo đội vệ sinh kiểm tra A1." })));

  fireEvent.click(screen.getByRole("button", { name: /hoàn tất FB001/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("feedback", expect.objectContaining({ status: "resolved", resolved_at: expect.any(String) })));
});

test("admins create bin-linked feedback from the feedback page", async () => {
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /tạo phản hồi/i }));
  fireEvent.change(screen.getByLabelText(/người gửi/i), { target: { value: "Giám thị A1" } });
  fireEvent.change(screen.getByLabelText(/loại phản hồi/i), { target: { value: "QR lỗi" } });
  fireEvent.change(screen.getByLabelText(/thùng liên quan/i), { target: { value: "BIN-A1-RECYCLE" } });
  fireEvent.change(screen.getByLabelText(/mức ưu tiên/i), { target: { value: "high" } });
  fireEvent.change(screen.getByLabelText(/nội dung phản hồi/i), { target: { value: "QR ở A1 bị bong góc." } });
  fireEvent.click(screen.getByRole("button", { name: /lưu phản hồi/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    user_name: "Giám thị A1",
    category: "QR lỗi",
    message: "QR ở A1 bị bong góc.",
    status: "unread",
    priority: "high",
    bin_id: "BIN-A1-RECYCLE",
  })));
  expect(await screen.findByText("QR ở A1 bị bong góc.")).toBeInTheDocument();
});

test("feedback create failure saves the new item to local fallback", async () => {
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /tạo phản hồi/i }));
  fireEvent.change(screen.getByLabelText(/người gửi/i), { target: { value: "Giám thị A1" } });
  fireEvent.change(screen.getByLabelText(/loại phản hồi/i), { target: { value: "QR lỗi" } });
  fireEvent.change(screen.getByLabelText(/thùng liên quan/i), { target: { value: "BIN-A1-RECYCLE" } });
  fireEvent.change(screen.getByLabelText(/mức ưu tiên/i), { target: { value: "high" } });
  fireEvent.change(screen.getByLabelText(/nội dung phản hồi/i), { target: { value: "QR dự phòng tại A1 cần in lại." } });

  mockSupabaseFailure = true;
  fireEvent.click(screen.getByRole("button", { name: /lưu phản hồi/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    user_name: "Giám thị A1",
    category: "QR lỗi",
    message: "QR dự phòng tại A1 cần in lại.",
    status: "unread",
    priority: "high",
    bin_id: "BIN-A1-RECYCLE",
  })));
  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();
  expect(await screen.findByText("QR dự phòng tại A1 cần in lại.")).toBeInTheDocument();

  const stored = JSON.parse(localStorage.getItem("ecoGuardianFeedback") || "[]");
  expect(stored).toEqual(expect.arrayContaining([expect.objectContaining({
    userName: "Giám thị A1",
    category: "QR lỗi",
    message: "QR dự phòng tại A1 cần in lại.",
    status: "unread",
    priority: "high",
    binId: "BIN-A1-RECYCLE",
  })]));
});
test("feedback page rejects empty messages without saving", async () => {
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /tạo phản hồi/i }));
  fireEvent.change(screen.getByLabelText(/người gửi/i), { target: { value: "Giám thị A1" } });
  fireEvent.change(screen.getByLabelText(/nội dung phản hồi/i), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("button", { name: /lưu phản hồi/i }));

  expect(await screen.findByText(/nhập nội dung phản hồi trước khi lưu/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseUpsert).not.toHaveBeenCalled();
});
test("feedback page renders invalid timestamps without crashing", async () => {
  mockTables.feedback = [
    { id: "FB-BAD-TIME", user_name: "Sinh viên", category: "Khác", message: "Phản hồi timestamp lỗi.", status: "unread", priority: "medium", bin_id: "", admin_note: "", timestamp: "not-a-date" },
  ];
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect(await screen.findByText("Phản hồi timestamp lỗi.")).toBeInTheDocument();
  expect(screen.getByText("Không rõ")).toBeInTheDocument();
});
test("feedback page filters by open resolved and rejected status", async () => {
  mockTables.feedback = [
    { id: "FB-UNREAD", user_name: "Sinh viên A", category: "Thùng đầy", message: "Phản hồi mới chưa xử lý.", status: "unread", priority: "high", bin_id: "BIN-A1-RECYCLE", admin_note: "", timestamp: "2026-07-07T07:20:00.000Z" },
    { id: "FB-PROCESSING", user_name: "Sinh viên B", category: "QR lỗi", message: "Phản hồi đang xử lý.", status: "in_progress", priority: "medium", bin_id: "", admin_note: "", timestamp: "2026-07-07T08:20:00.000Z" },
    { id: "FB-RESOLVED", user_name: "Sinh viên C", category: "Khác", message: "Phản hồi đã xử lý.", status: "resolved", priority: "low", bin_id: "", admin_note: "", timestamp: "2026-07-07T09:20:00.000Z" },
    { id: "FB-REJECTED", user_name: "Sinh viên D", category: "Khác", message: "Phản hồi bị từ chối.", status: "rejected", priority: "low", bin_id: "", admin_note: "", timestamp: "2026-07-07T10:20:00.000Z" },
  ];
  window.location.hash = "#/feedback?status=open";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect(await screen.findByText("Phản hồi mới chưa xử lý.")).toBeInTheDocument();
  expect(screen.getByText("Phản hồi đang xử lý.")).toBeInTheDocument();
  expect(screen.queryByText("Phản hồi đã xử lý.")).not.toBeInTheDocument();
  expect(screen.queryByText("Phản hồi bị từ chối.")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/trạng thái/i), { target: { value: "resolved" } });

  expect(await screen.findByText("Phản hồi đã xử lý.")).toBeInTheDocument();
  expect(screen.queryByText("Phản hồi mới chưa xử lý.")).not.toBeInTheDocument();
  expect(screen.queryByText("Phản hồi đang xử lý.")).not.toBeInTheDocument();
  expect(screen.queryByText("Phản hồi bị từ chối.")).not.toBeInTheDocument();
  expect(window.location.hash).toContain("status=resolved");

  fireEvent.change(screen.getByLabelText(/trạng thái/i), { target: { value: "rejected" } });

  expect(await screen.findByText("Phản hồi bị từ chối.")).toBeInTheDocument();
  expect(screen.queryByText("Phản hồi đã xử lý.")).not.toBeInTheDocument();
  expect(window.location.hash).toContain("status=rejected");
});

test("feedback page open filter normalizes dirty workflow statuses", async () => {
  mockTables.feedback = [
    { id: "FB-DIRTY-UNREAD", user_name: "Sinh viên A", category: "Thùng đầy", message: "Phản hồi status unread bẩn.", status: " UNREAD ", priority: "high", bin_id: "BIN-A1-RECYCLE", admin_note: "", timestamp: "2026-07-07T07:20:00.000Z" },
    { id: "FB-DIRTY-PROCESSING", user_name: "Sinh viên B", category: "QR lỗi", message: "Phản hồi status đang xử lý bẩn.", status: " IN_PROGRESS ", priority: "medium", bin_id: "", admin_note: "", timestamp: "2026-07-07T08:20:00.000Z" },
    { id: "FB-DIRTY-REJECTED", user_name: "Sinh viên C", category: "Khác", message: "Phản hồi status từ chối bẩn.", status: " REJECTED ", priority: "low", bin_id: "", admin_note: "", timestamp: "2026-07-07T09:20:00.000Z" },
  ];
  window.location.hash = "#/feedback?status=open";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect(await screen.findByText("Phản hồi status unread bẩn.")).toBeInTheDocument();
  expect(screen.getByText("Phản hồi status đang xử lý bẩn.")).toBeInTheDocument();
  expect(screen.queryByText("Phản hồi status từ chối bẩn.")).not.toBeInTheDocument();
});

test("feedback page normalizes dirty status query filter params", async () => {
  mockTables.feedback = [
    { id: "FB-QUERY-OPEN", user_name: "Sinh viên A", category: "Thùng đầy", message: "Phản hồi query open cần hiện.", status: "unread", priority: "high", bin_id: "BIN-A1-RECYCLE", admin_note: "", timestamp: "2026-07-07T07:20:00.000Z" },
    { id: "FB-QUERY-RESOLVED", user_name: "Sinh viên B", category: "Khác", message: "Phản hồi query resolved cần ẩn.", status: "resolved", priority: "low", bin_id: "", admin_note: "", timestamp: "2026-07-07T08:20:00.000Z" },
  ];
  window.location.hash = "#/feedback?status=%20OPEN%20";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect(await screen.findByText("Phản hồi query open cần hiện.")).toBeInTheDocument();
  expect(screen.queryByText("Phản hồi query resolved cần ẩn.")).not.toBeInTheDocument();
});

test("feedback page uses Admin EcoGuardian when sender is blank", async () => {
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /tạo phản hồi/i }));
  fireEvent.change(screen.getByLabelText(/người gửi/i), { target: { value: "   " } });
  fireEvent.change(screen.getByLabelText(/nội dung phản hồi/i), { target: { value: "Cần bổ sung poster hướng dẫn tại Nhà A1." } });
  fireEvent.click(screen.getByRole("button", { name: /lưu phản hồi/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    user_name: "Admin EcoGuardian",
    message: "Cần bổ sung poster hướng dẫn tại Nhà A1.",
    status: "unread",
  })));
  expect(await screen.findByText("Admin EcoGuardian")).toBeInTheDocument();
  expect(screen.getByText("Cần bổ sung poster hướng dẫn tại Nhà A1.")).toBeInTheDocument();
});
test("feedback page filters by priority", async () => {
  mockTables.feedback = [
    { id: "FB-HIGH", user_name: "Giám thị A1", category: "Thùng đầy", message: "Thùng tái chế cần xử lý gấp.", status: "unread", priority: "high", bin_id: "BIN-A1-RECYCLE", admin_note: "", timestamp: "2026-07-07T07:20:00.000Z" },
    { id: "FB-LOW", user_name: "Sinh viên", category: "Khác", message: "Đề xuất thêm poster hướng dẫn.", status: "unread", priority: "low", bin_id: "", admin_note: "", timestamp: "2026-07-07T08:20:00.000Z" },
  ];
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect(await screen.findByText("Thùng tái chế cần xử lý gấp.")).toBeInTheDocument();
  expect(await screen.findByText("Đề xuất thêm poster hướng dẫn.")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/ưu tiên/i), { target: { value: "high" } });

  expect(await screen.findByText("Thùng tái chế cần xử lý gấp.")).toBeInTheDocument();
  expect(screen.queryByText("Đề xuất thêm poster hướng dẫn.")).not.toBeInTheDocument();
});

test("feedback page normalizes dirty priorities for labels and filters", async () => {
  mockTables.feedback = [
    { id: "FB-DIRTY-HIGH", user_name: "Giám thị A1", category: "Thùng đầy", message: "Phản hồi priority high bẩn.", status: "unread", priority: " HIGH ", bin_id: "BIN-A1-RECYCLE", admin_note: "", timestamp: "2026-07-07T07:20:00.000Z" },
    { id: "FB-DIRTY-LOW", user_name: "Sinh viên", category: "Khác", message: "Phản hồi priority low bẩn.", status: "unread", priority: " LOW ", bin_id: "", admin_note: "", timestamp: "2026-07-07T08:20:00.000Z" },
  ];
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  const highRow = (await screen.findByText("Phản hồi priority high bẩn.")).closest("tr");
  expect(within(highRow).getByText("Cao")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/ưu tiên/i), { target: { value: "high" } });

  expect(await screen.findByText("Phản hồi priority high bẩn.")).toBeInTheDocument();
  expect(screen.queryByText("Phản hồi priority low bẩn.")).not.toBeInTheDocument();
});

test("feedback page filters by linked bin station", async () => {
  mockTables.bins = [
    ...mockTables.bins,
    { id: "BIN-LIB-BATTERY", name: "Hộp pin thư viện", bin_group: "Pin / nguy hại", location: "Thư viện", building: "Library", floor: "2", qr_code: "QR-LIB", status: "active", capacity: 31, map_x: 39, map_y: 86 },
  ];
  mockTables.feedback = [
    { id: "FB-A1", user_name: "Giám thị A1", category: "Thùng đầy", message: "Thùng tái chế A1 cần xử lý.", status: "unread", priority: "high", bin_id: "BIN-A1-RECYCLE", admin_note: "", timestamp: "2026-07-07T07:20:00.000Z" },
    { id: "FB-LIB", user_name: "Thư viện", category: "QR lỗi", message: "QR hộp pin thư viện bị mờ.", status: "unread", priority: "medium", bin_id: "BIN-LIB-BATTERY", admin_note: "", timestamp: "2026-07-07T08:20:00.000Z" },
  ];
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect(await screen.findByText("Thùng tái chế A1 cần xử lý.")).toBeInTheDocument();
  expect(await screen.findByText("QR hộp pin thư viện bị mờ.")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/^thùng$/i), { target: { value: "BIN-LIB-BATTERY" } });

  expect(await screen.findByText("QR hộp pin thư viện bị mờ.")).toBeInTheDocument();
  expect(screen.queryByText("Thùng tái chế A1 cần xử lý.")).not.toBeInTheDocument();
});

test("feedback update failure persists the live feedback item to local fallback", async () => {
  mockSupabaseUpdateFailure = true;
  mockTables.feedback = [
    { id: "FB-LIVE", user_name: "Sinh viên trực trạm", category: "QR lỗi", message: "QR trạm mới bị mờ.", status: "unread", priority: "medium", bin_id: "BIN-A1-RECYCLE", admin_note: "", timestamp: "2026-07-07T08:20:00.000Z" },
  ];
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /nhận xử lý FB-LIVE/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("feedback", expect.objectContaining({ status: "in_progress" })));
  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();

  const stored = JSON.parse(localStorage.getItem("ecoGuardianFeedback") || "[]");
  expect(stored).toEqual(expect.arrayContaining([expect.objectContaining({ id: "FB-LIVE", status: "in_progress" })]));
});

test("feedback page saves admin note and rejects feedback", async () => {
  window.location.hash = "#/feedback";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /mở chi tiết FB001/i }));
  fireEvent.change(screen.getByLabelText(/ghi chú xử lý/i), { target: { value: "Ảnh phản hồi không đủ rõ, cần gửi lại." } });
  fireEvent.click(screen.getByRole("button", { name: /lưu ghi chú/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("feedback", expect.objectContaining({ admin_note: "Ảnh phản hồi không đủ rõ, cần gửi lại." })));

  fireEvent.click(screen.getByRole("button", { name: /từ chối FB001/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("feedback", expect.objectContaining({ status: "rejected" })));
  expect((await screen.findAllByText("Từ chối")).length).toBeGreaterThan(0);
});
test("dashboard map highlights bins that have open feedback", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /bản đồ gis campus/i })).toBeInTheDocument();
  expect(await screen.findByText(/1 phản hồi cần xử lý/i)).toBeInTheDocument();
  expect(screen.getByText(/1 phản hồi mở/i)).toBeInTheDocument();
});

test("dashboard map opens bin details and saves draggable position after confirmation", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /bản đồ gis campus/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /chọn thùng BIN-A1-RECYCLE/i }));

  expect(screen.getByRole("heading", { name: /thùng tái chế A1/i })).toBeInTheDocument();
  expect(screen.getByText(/1 phản hồi mở/i)).toBeInTheDocument();
  expect(screen.getByText(/thùng tái chế A1 gần đầy/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /chỉnh vị trí/i }));
  fireEvent.click(screen.getByRole("button", { name: /di chuyển sang phải/i }));
  expect(screen.getByText(/có thay đổi vị trí/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /hủy thay đổi vị trí/i }));
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ id: "BIN-A1-RECYCLE", map_x: expect.any(Number) }));

  fireEvent.click(screen.getByRole("button", { name: /chỉnh vị trí/i }));
  fireEvent.click(screen.getByRole("button", { name: /di chuyển sang phải/i }));
  fireEvent.click(screen.getByRole("button", { name: /xác nhận vị trí/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-A1-RECYCLE",
    map_x: 35,
    map_y: 78,
  })));
});

test("dashboard map save failure falls back to localStorage and warns admins", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /bản đồ gis campus/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("button", { name: /chọn thùng BIN-A1-RECYCLE/i }));
  fireEvent.click(screen.getByRole("button", { name: /chỉnh vị trí/i }));
  fireEvent.click(screen.getByRole("button", { name: /di chuyển sang phải/i }));

  mockSupabaseFailure = true;
  fireEvent.click(screen.getByRole("button", { name: /xác nhận vị trí/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    id: "BIN-A1-RECYCLE",
    map_x: 35,
    map_y: 78,
  })));
  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();
  expect(await screen.findByText(/x 35% · y 78%/i)).toBeInTheDocument();

  const storedBins = JSON.parse(localStorage.getItem("ecoGuardianBins") || "[]");
  expect(storedBins).toEqual(expect.arrayContaining([expect.objectContaining({
    id: "BIN-A1-RECYCLE",
    mapX: 35,
    mapY: 78,
  })]));
});

test("falls back to localStorage when Supabase is unavailable", async () => {
  mockSupabaseFailure = true;
  localStorage.setItem("smartWastePredictions", JSON.stringify([{ id: "offline-scan", class: "paper", confidence: 0.8, source: "upload", timestamp: "2026-07-07T08:00:00.000Z", status: "pending" }]));

  render(<App />);

  expect(await screen.findByRole("heading", { name: /tổng quan quản trị/i })).toBeInTheDocument();
  expect((await screen.findAllByText(/chế độ dự phòng localStorage/i)).length).toBeGreaterThan(0);
  expect(screen.getByText("Giấy")).toBeInTheDocument();
});

test("AI tester writes predictions to Supabase after backend returns a result", async () => {
  const axios = require("axios");
  axios.post.mockResolvedValueOnce({ data: { class: "paper", confidence: 0.88 } });
  window.location.hash = "#/ai-test";

  render(<App />);

  const file = new File(["paper"], "paper.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /nhận diện thử/i }));

  await waitFor(() => expect(screen.getByText(/giấy/i)).toBeInTheDocument());
  expect(mockSupabaseFrom).toHaveBeenCalledWith("predictions");
  expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({ class: "paper", bin_group: "Tái chế", status: "pending" }));
});

test("AI tester handles camera permission errors without enabling capture", async () => {
  const axios = require("axios");
  const originalMediaDevices = navigator.mediaDevices;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockRejectedValue(new Error("Permission denied")),
    },
  });
  window.location.hash = "#/ai-test";

  try {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /kiểm thử ai/i })).toBeInTheDocument();
    const captureButton = screen.getByRole("button", { name: /chụp kiểm thử/i });
    fireEvent.click(screen.getByRole("button", { name: /mở camera/i }));

    expect(await screen.findByText(/không mở được camera/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("tone-danger");
    expect(captureButton).toBeDisabled();
    expect(axios.post).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
  }
});
test("AI tester warns when the browser does not support camera", async () => {
  const axios = require("axios");
  const originalMediaDevices = navigator.mediaDevices;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
  window.location.hash = "#/ai-test";

  try {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /kiểm thử ai/i })).toBeInTheDocument();
    const captureButton = screen.getByRole("button", { name: /chụp kiểm thử/i });
    fireEvent.click(screen.getByRole("button", { name: /mở camera/i }));

    expect(await screen.findByText(/trình duyệt không hỗ trợ camera/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("tone-danger");
    expect(captureButton).toBeDisabled();
    expect(axios.post).not.toHaveBeenCalled();
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
  }
});
test("AI tester captures camera frames and saves camera predictions", async () => {
  const axios = require("axios");
  const trackStop = jest.fn();
  const drawImage = jest.fn();
  const originalMediaDevices = navigator.mediaDevices;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] }),
    },
  });
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage }));
  HTMLCanvasElement.prototype.toBlob = jest.fn(callback => callback(new Blob(["camera"], { type: "image/jpeg" })));
  axios.post.mockResolvedValueOnce({ data: { class: "plastic", confidence: 0.88 } });
  window.location.hash = "#/ai-test";

  try {
    render(<App />);

    expect(await screen.findByRole("heading", { name: /kiểm thử ai/i })).toBeInTheDocument();
    const captureButton = screen.getByRole("button", { name: /chụp kiểm thử/i });
    expect(captureButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /mở camera/i }));

    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "environment" } }));
    await waitFor(() => expect(screen.getByRole("button", { name: /chụp kiểm thử/i })).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: /chụp kiểm thử/i }));

    await waitFor(() => expect(axios.post).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/predict",
      expect.any(FormData),
      { headers: { "Content-Type": "multipart/form-data" } }
    ));
    await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
      class: "plastic",
      source: "camera",
      image_name: "camera-capture.jpg",
      bin_group: "Tái chế",
      status: "pending",
    })));
    expect(drawImage).toHaveBeenCalled();
    expect(await screen.findByText("Nhựa")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /tắt camera/i }));
    expect(trackStop).toHaveBeenCalled();
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  }
});
test("AI tester warns when camera capture cannot create an image", async () => {
  const axios = require("axios");
  const originalMediaDevices = navigator.mediaDevices;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: jest.fn() }] }),
    },
  });
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ drawImage: jest.fn() }));
  HTMLCanvasElement.prototype.toBlob = jest.fn(callback => callback(null));
  window.location.hash = "#/ai-test";

  try {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /camera/i }));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    fireEvent.click(document.querySelectorAll("button.eg-primary-btn")[1]);

    expect(await screen.findByText(/không chụp được ảnh từ camera/i)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("tone-danger");
    expect(axios.post).not.toHaveBeenCalled();
    expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ source: "camera", status: "pending" }));
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  }
});
test("AI tester saves uploaded files as upload source even when camera is on", async () => {
  const axios = require("axios");
  const originalMediaDevices = navigator.mediaDevices;

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: jest.fn().mockResolvedValue({ getTracks: () => [{ stop: jest.fn() }] }),
    },
  });
  axios.post.mockResolvedValueOnce({ data: { class: "paper", confidence: 0.86 } });
  window.location.hash = "#/ai-test";

  try {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /camera/i }));
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());

    const file = new File(["paper"], "paper.jpg", { type: "image/jpeg" });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });
    fireEvent.click(document.querySelectorAll("button.eg-primary-btn")[0]);

    await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
      class: "paper",
      source: "upload",
      image_name: "paper.jpg",
      status: "pending",
    })));
  } finally {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: originalMediaDevices });
  }
});
test("AI tester keeps upload prediction disabled until a file is selected", async () => {
  const axios = require("axios");
  window.location.hash = "#/ai-test";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /kiểm thử ai/i })).toBeInTheDocument();
  const predictButton = screen.getByRole("button", { name: /nhận diện thử/i });
  expect(predictButton).toBeDisabled();
  fireEvent.click(predictButton);
  expect(axios.post).not.toHaveBeenCalled();

  const file = new File(["paper"], "paper.jpg", { type: "image/jpeg" });
  fireEvent.change(screen.getByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });

  expect(predictButton).not.toBeDisabled();
});

test("AI tester rejects non-image upload files before calling backend", async () => {
  const axios = require("axios");
  window.location.hash = "#/ai-test";

  render(<App />);

  await screen.findByRole("button", { name: /camera/i });
  const file = new File(["not image"], "notes.txt", { type: "text/plain" });
  fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } });

  expect(await screen.findByText(/chỉ chọn file ảnh/i)).toBeInTheDocument();
  expect(document.querySelector(".eg-preview-image")).toBeNull();
  const predictButton = document.querySelectorAll("button.eg-primary-btn")[0];
  expect(predictButton).toBeDisabled();
  fireEvent.click(predictButton);
  expect(axios.post).not.toHaveBeenCalled();
});
test("AI tester maps unknown backend classes to the fallback bin group", async () => {
  const axios = require("axios");
  axios.post.mockResolvedValueOnce({ data: { class: "styrofoam", confidence: 0.77 } });
  window.location.hash = "#/ai-test";

  render(<App />);

  const file = new File(["foam"], "foam.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /nhận diện thử/i }));

  expect(await screen.findByText("styrofoam")).toBeInTheDocument();
  expect(screen.getByText("Còn lại")).toBeInTheDocument();
  expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    class: "styrofoam",
    bin_group: "Còn lại",
    status: "pending",
  }));
});

test("AI tester shows backend error response without saving a prediction", async () => {
  const axios = require("axios");
  axios.post.mockResolvedValueOnce({ data: { error: "Model not loaded" } });
  window.location.hash = "#/ai-test";

  render(<App />);

  const file = new File(["paper"], "paper.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /nhận diện thử/i }));

  expect(await screen.findByText(/Model not loaded/i)).toBeInTheDocument();
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
  expect(screen.queryByText(/không xác định/i)).not.toBeInTheDocument();
});

test("AI tester rejects malformed backend responses without saving a prediction", async () => {
  const axios = require("axios");
  axios.post.mockResolvedValueOnce({ data: { confidence: 0.72 } });
  window.location.hash = "#/ai-test";

  render(<App />);

  const file = new File(["paper"], "paper.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /nhận diện thử/i }));

  expect(await screen.findByText(/backend trả kết quả không hợp lệ/i)).toBeInTheDocument();
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
});

test("AI tester rejects non-numeric backend confidence without saving a prediction", async () => {
  const axios = require("axios");
  axios.post.mockResolvedValueOnce({ data: { class: "plastic", confidence: "bad-confidence" } });
  window.location.hash = "#/ai-test";

  render(<App />);

  const file = new File(["plastic"], "plastic.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /nhận diện thử/i }));

  expect(await screen.findByText(/backend trả kết quả không hợp lệ/i)).toBeInTheDocument();
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
  expect(screen.queryByText("NaN%")).not.toBeInTheDocument();
});
test("AI tester rejects out-of-range backend confidence without saving a prediction", async () => {
  const axios = require("axios");
  axios.post.mockResolvedValueOnce({ data: { class: "plastic", confidence: 1.4 } });
  window.location.hash = "#/ai-test";

  render(<App />);

  const file = new File(["plastic"], "plastic.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /nhận diện thử/i }));

  await waitFor(() => expect(screen.getByRole("status")).toHaveClass("tone-danger"));
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
  expect(screen.queryByText("100%")).not.toBeInTheDocument();
});
test("AI tester shows request failures without saving a prediction", async () => {
  const axios = require("axios");
  axios.post.mockRejectedValueOnce(new Error("Network down"));
  window.location.hash = "#/ai-test";

  render(<App />);

  const file = new File(["paper"], "paper.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /nhận diện thử/i }));

  expect(await screen.findByText(/Không gọi được backend \/predict/i)).toBeInTheDocument();
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
});
test("AI tester reads QR binId and saves predictions against that station", async () => {
  const axios = require("axios");
  axios.post.mockResolvedValueOnce({ data: { class: "plastic", confidence: 0.91 } });
  window.location.hash = "#/ai-test?binId=BIN-A1-RECYCLE";

  render(<App />);

  expect(await screen.findByText(/đang quét cho trạm/i)).toBeInTheDocument();
  expect(await screen.findByText("Thùng tái chế A1")).toBeInTheDocument();

  const file = new File(["plastic"], "plastic.jpg", { type: "image/jpeg" });
  fireEvent.change(await screen.findByLabelText(/chọn ảnh kiểm thử/i), { target: { files: [file] } });
  fireEvent.click(screen.getByRole("button", { name: /nhận diện thử/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    class: "plastic",
    bin_id: "BIN-A1-RECYCLE",
    bin_group: "Tái chế",
  })));
});

test("scans page filters status class and low confidence independently", async () => {
  mockTables.predictions = [
    { id: "scan-low", class: "battery", confidence: 0.42, source: "upload", timestamp: "2026-07-07T08:00:00.000Z", bin_group: "Pin / nguy hại", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
    { id: "scan-paper", class: "paper", confidence: 0.9, source: "upload", timestamp: "2026-07-07T10:00:00.000Z", bin_group: "Tái chế", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
    { id: "scan-recycle", class: "plastic", confidence: 0.91, source: "camera", timestamp: "2026-07-07T09:00:00.000Z", bin_group: "Tái chế", status: "approved", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
  ];
  window.location.hash = "#/scans?status=pending";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /duyệt kết quả ai/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/trạng thái/i)).toHaveValue("pending");
  expect(await screen.findByText("scan-low")).toBeInTheDocument();
  expect(screen.getByText("scan-paper")).toBeInTheDocument();
  expect(screen.queryByText("scan-recycle")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/loại rác/i), { target: { value: "paper" } });
  expect(await screen.findByText("scan-paper")).toBeInTheDocument();
  expect(screen.queryByText("scan-low")).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/độ tin cậy/i), { target: { value: "low" } });
  expect(await screen.findByText(/chưa có lượt quét phù hợp bộ lọc/i)).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/loại rác/i), { target: { value: "all" } });
  expect(await screen.findByText("scan-low")).toBeInTheDocument();
  expect(screen.queryByText("scan-paper")).not.toBeInTheDocument();
  expect(screen.queryByText("scan-recycle")).not.toBeInTheDocument();
});

test("scans page normalizes dirty pending status for filters and actions", async () => {
  mockTables.predictions = [
    { id: "scan-dirty-pending", class: "plastic", confidence: 0.72, source: "upload", timestamp: "2026-07-07T08:00:00.000Z", bin_group: "Tái chế", status: " PENDING ", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
    { id: "scan-dirty-approved", class: "paper", confidence: 0.9, source: "upload", timestamp: "2026-07-07T09:00:00.000Z", bin_group: "Tái chế", status: " APPROVED ", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
  ];
  window.location.hash = "#/scans?status=pending";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /duyệt kết quả ai/i })).toBeInTheDocument();
  expect(await screen.findByText("scan-dirty-pending")).toBeInTheDocument();
  expect(screen.queryByText("scan-dirty-approved")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /duyệt scan-dirty-pending/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /từ chối scan-dirty-pending/i })).toBeInTheDocument();
});

test("scans page normalizes dirty query filter params", async () => {
  mockTables.predictions = [
    { id: "scan-query-low", class: "battery", confidence: 0.42, source: "upload", timestamp: "2026-07-07T08:00:00.000Z", bin_group: "Pin / nguy hại", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
    { id: "scan-query-high", class: "paper", confidence: 0.9, source: "upload", timestamp: "2026-07-07T10:00:00.000Z", bin_group: "Tái chế", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
  ];
  window.location.hash = "#/scans?status=%20PENDING%20&confidence=%20LOW%20";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /duyệt kết quả ai/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/trạng thái/i)).toHaveValue("pending");
  expect(screen.getByLabelText(/độ tin cậy/i)).toHaveValue("low");
  expect(await screen.findByText("scan-query-low")).toBeInTheDocument();
  expect(screen.queryByText("scan-query-high")).not.toBeInTheDocument();
});
test("scan status update failure falls back to localStorage and warns admins", async () => {
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  mockSupabaseUpdateFailure = true;
  fireEvent.click(await screen.findByRole("button", { name: /từ chối scan-low/i }));

  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();
  expect(await screen.findByText(/chế độ dự phòng localStorage/i)).toBeInTheDocument();
  expect(await screen.findByText(/đã từ chối lượt quét/i)).toBeInTheDocument();
  const stored = JSON.parse(localStorage.getItem("smartWastePredictions"));
  expect(stored).toEqual(expect.arrayContaining([expect.objectContaining({ id: "scan-low", status: "rejected" })]));
  expect(mockSupabaseInsert).not.toHaveBeenCalledWith("point_history", expect.anything());
});

test("approve update failure stores approved scan and awarded points in local fallback", async () => {
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  mockSupabaseUpdateFailure = true;
  fireEvent.click(await screen.findByRole("button", { name: /duyệt scan-low/i }));

  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();
  expect(await screen.findByText(/chế độ dự phòng localStorage/i)).toBeInTheDocument();
  const storedPredictions = JSON.parse(localStorage.getItem("smartWastePredictions"));
  expect(storedPredictions).toEqual(expect.arrayContaining([expect.objectContaining({ id: "scan-low", status: "approved" })]));
  const storedHistory = JSON.parse(localStorage.getItem("ecoGuardianPointHistory"));
  expect(storedHistory).toEqual(expect.arrayContaining([expect.objectContaining({ predictionId: "scan-low", points: 8 })]));
  const storedUsers = JSON.parse(localStorage.getItem("ecoGuardianUsers"));
  expect(storedUsers).toEqual(expect.arrayContaining([expect.objectContaining({ id: "SV001", points: 253 })]));
});

test("scan approve update fallback treats string false local point rules as disabled", async () => {
  const localRules = mockTables.point_rules.map(rule => ({
    id: rule.id,
    label: rule.label,
    classKeys: rule.class_keys,
    binGroup: rule.bin_group,
    points: rule.points,
    enabled: rule.id === "hazard" ? " false " : rule.enabled,
  }));
  localStorage.setItem("ecoGuardianPointRules", JSON.stringify(localRules));
  window.location.hash = "#/scans";

  render(<App />);

  const scanRow = (await screen.findByText("scan-low")).closest("tr");
  mockSupabaseUpdateFailure = true;
  fireEvent.click(within(scanRow).getAllByRole("button")[0]);

  await waitFor(() => expect(JSON.parse(localStorage.getItem("smartWastePredictions") || "[]")).toEqual(expect.arrayContaining([expect.objectContaining({ id: "scan-low", status: "approved" })])));
  const storedHistory = JSON.parse(localStorage.getItem("ecoGuardianPointHistory") || "[]");
  expect(storedHistory).not.toEqual(expect.arrayContaining([expect.objectContaining({ predictionId: "scan-low" })]));
  const storedUsers = JSON.parse(localStorage.getItem("ecoGuardianUsers") || "[]");
  expect(storedUsers).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: "SV001", points: 253 })]));
});
test("approve update fallback treats malformed local user points as zero", async () => {
  mockTables.users = mockTables.users.map(user => user.id === "SV001" ? { ...user, points: "bad-points" } : user);
  localStorage.setItem("ecoGuardianUsers", JSON.stringify(mockTables.users));
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  mockSupabaseUpdateFailure = true;
  fireEvent.click(await screen.findByRole("button", { name: /duyệt scan-low/i }));

  expect(await screen.findByText(/chế độ dự phòng localStorage/i)).toBeInTheDocument();
  const storedUsers = JSON.parse(localStorage.getItem("ecoGuardianUsers"));
  expect(storedUsers).toEqual(expect.arrayContaining([expect.objectContaining({ id: "SV001", points: 8 })]));
  expect(JSON.stringify(storedUsers)).not.toContain("NaN");
});
test("approving a scan updates Supabase and writes point history", async () => {
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  fireEvent.click(await screen.findByRole("button", { name: /duyệt scan-low/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("predictions", expect.objectContaining({ status: "approved" })));
  expect(mockSupabaseInsert).toHaveBeenCalledWith("point_history", expect.arrayContaining([expect.objectContaining({ prediction_id: "scan-low", points: 8 })]));
  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("users", expect.objectContaining({ points: 253 })));
});

test("approving a scan matches dirty point rule class keys", async () => {
  mockTables.point_rules = [
    { id: "hazard-dirty", label: "Pin bẩn key", class_keys: [" Battery "], bin_group: "Pin / nguy hại", points: 8, enabled: true },
  ];
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  fireEvent.click(await screen.findByRole("button", { name: /duyệt scan-low/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("predictions", expect.objectContaining({ status: "approved" })));
  expect(mockSupabaseInsert).toHaveBeenCalledWith("point_history", expect.arrayContaining([expect.objectContaining({ prediction_id: "scan-low", points: 8 })]));
  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("users", expect.objectContaining({ points: 253 })));
});

test("rejecting a pending scan does not write point history or change user points", async () => {
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  fireEvent.click(await screen.findByRole("button", { name: /từ chối scan-low/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("predictions", expect.objectContaining({ status: "rejected" })));
  expect(mockSupabaseInsert).not.toHaveBeenCalledWith("point_history", expect.anything());
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("users", expect.objectContaining({ points: expect.any(Number) }));
});

test("approving a scan with a disabled point rule does not award points", async () => {
  mockTables.point_rules = mockTables.point_rules.map(rule => rule.id === "hazard" ? { ...rule, enabled: false } : rule);
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  fireEvent.click(await screen.findByRole("button", { name: /duyệt scan-low/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("predictions", expect.objectContaining({ status: "approved" })));
  expect(mockSupabaseInsert).not.toHaveBeenCalledWith("point_history", expect.anything());
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("users", expect.objectContaining({ points: expect.any(Number) }));
});

test("approving a scan with a string false point rule does not award points", async () => {
  mockTables.point_rules = mockTables.point_rules.map(rule => rule.id === "hazard" ? { ...rule, enabled: " false " } : rule);
  window.location.hash = "#/scans";

  render(<App />);

  const scanRow = (await screen.findByText("scan-low")).closest("tr");
  fireEvent.click(within(scanRow).getAllByRole("button")[0]);

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("predictions", expect.objectContaining({ status: "approved" })));
  expect(mockSupabaseInsert).not.toHaveBeenCalledWith("point_history", expect.anything());
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("users", expect.objectContaining({ points: expect.any(Number) }));
});
test("scans page handles malformed confidence and timestamp without crashing", async () => {
  mockTables.predictions = [
    { id: "scan-malformed", class: "paper", confidence: "not-a-number", source: "upload", timestamp: "not-a-date", bin_group: "Tái chế", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
  ];
  window.location.hash = "#/scans";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /duyệt kết quả ai/i })).toBeInTheDocument();
  expect(await screen.findByText("scan-malformed")).toBeInTheDocument();
  expect(screen.getByText("0%")).toBeInTheDocument();
  expect(screen.getByText("Không rõ")).toBeInTheDocument();
});

test("scans page handles non-string class values without crashing", async () => {
  mockTables.predictions = [
    { id: "scan-bad-class", class: 123, confidence: 0.71, source: "upload", timestamp: "2026-07-07T08:00:00.000Z", bin_group: "Còn lại", status: "pending", user_id: "SV001", bin_id: "BIN-A1-RECYCLE" },
  ];
  window.location.hash = "#/scans";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /duyệt kết quả ai/i })).toBeInTheDocument();
  expect(await screen.findByText("scan-bad-class")).toBeInTheDocument();
  expect(screen.getAllByText("Rác còn lại").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Còn lại").length).toBeGreaterThan(0);
  expect(screen.getByText("71%")).toBeInTheDocument();
});
test("approving a scan without user or bin does not award points to fallback records", async () => {
  mockTables.predictions = [
    { id: "scan-orphan", class: "plastic", confidence: 0.82, source: "upload", timestamp: "2026-07-07T10:00:00.000Z", bin_group: "Tái chế", status: "pending", user_id: null, bin_id: null },
  ];
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  fireEvent.click(await screen.findByRole("button", { name: /duyệt scan-orphan/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("predictions", expect.objectContaining({ status: "approved" })));
  expect(mockSupabaseInsert).not.toHaveBeenCalledWith("point_history", expect.anything());
  expect(mockSupabaseUpdate).not.toHaveBeenCalledWith("users", expect.objectContaining({ points: expect.any(Number) }));
});

test("processed scans do not expose approval actions again", async () => {
  window.location.hash = "#/scans";

  render(<App />);

  await screen.findByRole("heading", { name: /duyệt kết quả ai/i });
  expect(await screen.findByText("scan-recycle")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /duyệt scan-recycle/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /từ chối scan-recycle/i })).not.toBeInTheDocument();
});
test("ecopoints page renders invalid history and reward timestamps without crashing", async () => {
  mockTables.point_history = [
    { id: "POINT-BAD-TIME", prediction_id: null, user_id: "SV001", bin_id: "BIN-A1-RECYCLE", class: "manual_adjustment", bin_group: "Tái chế", action: "Điểm có timestamp lỗi", points: 5, timestamp: "not-a-date", created_at: "not-a-date" },
  ];
  mockTables.reward_redemptions = [
    { id: "RW-BAD-TIME", user_id: "SV001", reward_label: "Voucher căn tin 100 điểm", cost_points: 100, status: "pending", requested_at: "bad-date" },
  ];
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  expect(await screen.findByText("Điểm có timestamp lỗi")).toBeInTheDocument();
  expect((await screen.findAllByText("Voucher căn tin 100 điểm")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Không rõ").length).toBeGreaterThanOrEqual(2);
});
test("ecopoints page reads point history from Supabase", async () => {
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  expect(await screen.findByText("Duyệt Nhựa")).toBeInTheDocument();
  expect(screen.getAllByText("Nguyễn Minh Anh").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Thùng tái chế A1").length).toBeGreaterThan(0);
});

test("ecopoints page shows local fallback alert when Supabase data fails", async () => {
  mockSupabaseFailure = true;
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  expect(await screen.findByText(/supabase chưa sẵn sàng/i)).toBeInTheDocument();
  expect(await screen.findByText(/chế độ dự phòng localStorage/i)).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: /rác tái chế hợp lệ/i })).toBeInTheDocument();
});
test("ecopoints page shows filters and leaderboards", async () => {
  window.location.hash = "#/ecopoints?group=CNTT%20K18";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/lớp.?khoa/i)).toHaveValue("CNTT K18");
  expect(screen.getByRole("heading", { name: /bảng xếp hạng cá nhân/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /bảng xếp hạng lớp.?khoa/i })).toBeInTheDocument();
  expect((await screen.findAllByText("Nguyễn Minh Anh")).length).toBeGreaterThan(0);
});

test("ecopoints page normalizes dirty group and bin group query filters in the UI", async () => {
  window.location.hash = "#/ecopoints?group=%20cntt%20k18%20&binGroup=%20T%C3%81I%20CH%E1%BA%BE%20";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText(/lớp.?khoa/i)).toHaveValue("CNTT K18"));
  expect(screen.getByLabelText(/nhóm rác/i)).toHaveValue("Tái chế");
  expect(await screen.findByText("Duyệt Nhựa")).toBeInTheDocument();
});

test("admins can add manual Ecopoint adjustments", async () => {
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText(/người nhận điểm/i), { target: { value: "SV001" } });
  fireEvent.change(screen.getByLabelText(/số điểm/i), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: "Nộp rác sự kiện xanh" } });
  fireEvent.click(screen.getByRole("button", { name: /cộng điểm thủ công/i }));

  await waitFor(() => expect(mockSupabaseInsert).toHaveBeenCalledWith("point_history", expect.arrayContaining([
    expect.objectContaining({ user_id: "SV001", points: 10, action: "Nộp rác sự kiện xanh" }),
  ])));
});

test("ecopoints page rejects invalid manual point adjustments", async () => {
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /cộng điểm thủ công/i }));

  expect(await screen.findByText(/chọn người nhận và nhập lý do trước khi cộng điểm/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseInsert).not.toHaveBeenCalledWith("point_history", expect.anything());

  fireEvent.change(await screen.findByLabelText(/người nhận điểm/i), { target: { value: "SV001" } });
  fireEvent.change(screen.getByLabelText(/số điểm/i), { target: { value: "0" } });
  fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: "Điều chỉnh không hợp lệ" } });
  fireEvent.click(screen.getByRole("button", { name: /cộng điểm thủ công/i }));

  expect(await screen.findByText(/số điểm phải khác 0/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseInsert).not.toHaveBeenCalledWith("point_history", expect.anything());
});

test("ecopoints page blocks negative point rule values", async () => {
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  const recycleRuleCard = (await screen.findByRole("heading", { name: /rác tái chế hợp lệ/i })).closest("section");
  fireEvent.change(within(recycleRuleCard).getByRole("spinbutton"), { target: { value: "-9" } });
  fireEvent.click(screen.getByRole("button", { name: /lưu quy tắc điểm/i }));

  expect(await screen.findByText(/điểm quy tắc không được âm/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.arrayContaining([
    expect.objectContaining({ points: -9 }),
  ]));
});

test("admins can subtract manual Ecopoint adjustments", async () => {
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText(/người nhận điểm/i), { target: { value: "SV001" } });
  fireEvent.change(screen.getByLabelText(/số điểm/i), { target: { value: "-15" } });
  fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: "Điều chỉnh sai lượt cộng" } });
  fireEvent.click(screen.getByRole("button", { name: /cộng điểm thủ công/i }));

  await waitFor(() => expect(mockSupabaseInsert).toHaveBeenCalledWith("point_history", expect.arrayContaining([
    expect.objectContaining({ user_id: "SV001", points: -15, action: "Điều chỉnh sai lượt cộng" }),
  ])));
  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("users", expect.objectContaining({ points: 230 })));
  expect(await screen.findByText("-15")).toBeInTheDocument();
  expect(screen.queryByText("+-15")).not.toBeInTheDocument();
});

test("ecopoints page blocks reward requests when user has insufficient points", async () => {
  mockTables.reward_redemptions = [];
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText(/người đổi thưởng/i), { target: { value: "SV001" } });
  fireEvent.change(screen.getByLabelText(/mốc phần thưởng/i), { target: { value: "Giấy chứng nhận xanh 300 điểm" } });
  fireEvent.click(screen.getByRole("button", { name: /tạo yêu cầu đổi thưởng/i }));

  expect(await screen.findByText(/người dùng chưa đủ ecopoint/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ reward_label: "Giấy chứng nhận xanh 300 điểm" }));
});

test("ecopoints page treats malformed user points as zero for reward requests", async () => {
  mockTables.users = [
    { id: "AD001", name: "Quản trị EcoGuardian", email: "admin@school.edu.vn", role: "admin", group: "Ban vận hành", points: 0, status: "active" },
    { id: "SV-BAD-POINTS", name: "Sinh viên điểm lỗi", email: "bad-points@school.edu.vn", role: "student", group: "CNTT K20", points: "bad-points", status: "active" },
  ];
  mockTables.reward_redemptions = [];
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText(/người đổi thưởng/i), { target: { value: "SV-BAD-POINTS" } });
  fireEvent.change(screen.getByLabelText(/mốc phần thưởng/i), { target: { value: "Voucher căn tin 100 điểm" } });
  fireEvent.click(screen.getByRole("button", { name: /tạo yêu cầu đổi thưởng/i }));

  expect(await screen.findByText(/người dùng chưa đủ ecopoint/i)).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveClass("tone-danger");
  expect(mockSupabaseUpsert).not.toHaveBeenCalledWith(expect.objectContaining({ user_id: "SV-BAD-POINTS" }));
});

test("admins can reject pending reward redemptions", async () => {
  mockTables.reward_redemptions = [{ id: "RW-REJECT", user_id: "SV001", reward_label: "Voucher căn tin 100 điểm", cost_points: 100, status: "pending", requested_at: "2026-07-07T10:00:00.000Z" }];
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  expect((await screen.findAllByText("Voucher căn tin 100 điểm")).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /^từ chối$/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("reward_redemptions", expect.objectContaining({ status: "rejected" })));
  expect(await screen.findByText(/đã xử lý/i)).toBeInTheDocument();
});

test("ecopoints page keeps reward actions for dirty pending statuses", async () => {
  mockTables.reward_redemptions = [{ id: "RW-DIRTY-PENDING", user_id: "SV001", reward_label: "Voucher căn tin 100 điểm", cost_points: 100, status: " PENDING ", requested_at: "2026-07-07T10:00:00.000Z" }];
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  expect((await screen.findAllByText("Voucher căn tin 100 điểm")).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /^duyệt$/i }));

  await waitFor(() => expect(mockSupabaseUpdate).toHaveBeenCalledWith("reward_redemptions", expect.objectContaining({ status: "approved" })));
});

test("reward review update failure stores live Supabase reward in local fallback", async () => {
  mockTables.reward_redemptions = [{ id: "RW-LIVE-FALLBACK", user_id: "SV001", reward_label: "Voucher căn tin 100 điểm", cost_points: 100, status: "pending", requested_at: "2026-07-07T10:00:00.000Z" }];
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  expect((await screen.findAllByText("Voucher căn tin 100 điểm")).length).toBeGreaterThan(0);
  mockSupabaseUpdateFailure = true;
  fireEvent.click(screen.getByRole("button", { name: /^duyệt$/i }));

  expect(await screen.findByText(/chế độ dự phòng localStorage/i)).toBeInTheDocument();
  expect(JSON.parse(localStorage.getItem("ecoGuardianRewardRedemptions") || "[]")).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "RW-LIVE-FALLBACK", status: "approved", adminNote: "" }),
  ]));
});
test("admins can request and approve reward redemptions", async () => {
  mockTables.reward_redemptions = [];
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText(/người đổi thưởng/i), { target: { value: "SV001" } });
  fireEvent.change(screen.getByLabelText(/mốc phần thưởng/i), { target: { value: "Voucher căn tin 100 điểm" } });
  fireEvent.click(screen.getByRole("button", { name: /tạo yêu cầu đổi thưởng/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({
    reward_label: "Voucher căn tin 100 điểm",
    cost_points: 100,
    status: "pending",
  })));
});

test("mobile handoff document keeps Eco-loop operation-first contract", () => {
  const fs = require("fs");
  const path = require("path");
  const content = fs.readFileSync(path.join(process.cwd(), "..", "..", "MOBILE_APP_HANDOFF.md"), "utf8");
  const requiredText = [
    "Eco-loop Campus", "operation-first", "Sinh vi\u00ean g\u1eedi r\u00e1c", "QR giao d\u1ecbch",
    "T\u00ecnh nguy\u1ec7n vi\u00ean x\u00e1c nh\u1eadn", "Ecopoint", "Admin b\u00e1o c\u00e1o",
    "AI kh\u00f4ng t\u1ef1 c\u1ed9ng \u0111i\u1ec3m", "AI MobileNetV2", "kh\u00f4ng t\u1ef1 c\u1ed9ng Ecopoint",
    "React admin", "Supabase", "FastAPI", "POST /predict", "MobileNetV2",
    "battery, biological, cardboard, clothes, glass, metal, paper, plastic, shoes, trash",
    "recycling_submissions", "qr_scan_logs", "proof_images", "missions", "rewards",
  ];
  const forbiddenText = ["tnny" + "wbshfnjbflbbfzkc", "sb_" + "publishable", "REACT_APP_SUPABASE_URL=https", "NEXT_PUBLIC_SUPABASE_URL=https"];

  expect(requiredText.filter(text => !content.includes(text))).toEqual([]);
  expect(forbiddenText.filter(text => content.includes(text))).toEqual([]);
  expect(content).not.toMatch(/[\u00c3\u00c4\u00c6]|\u00e1[\u00ba\u00bb]/);
});
test("admin source files do not contain mojibake markers", () => {
  const fs = require("fs");
  const path = require("path");
  const root = path.join(process.cwd(), "src", "admin");
  const files = [];
  const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && full.endsWith(".js")) files.push(full);
  });
  walk(root);
  const offenders = files.filter(file => /TÃ|ThÃ|RÃ|NhÃ|MÃ|Ä|Æ|áº|á»|Ã¡|Ã |Ã³|Ã´|Ãª|Ã¨|Ã©|Ã­|Ã¬|Ãº|Ã¹|Ã½|Ã¢/.test(fs.readFileSync(file, "utf8")));
  expect(offenders).toEqual([]);
});
