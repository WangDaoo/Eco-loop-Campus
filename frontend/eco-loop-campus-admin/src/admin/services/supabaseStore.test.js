import { USERS_KEY } from "../data/wasteConfig";
import { getUsers } from "./storage";
import { __testing, saveManualPointHistory } from "./supabaseStore";

beforeEach(() => {
  localStorage.clear();
});

test("maps Supabase users created_at into admin user createdAt", () => {
  expect(__testing.fromUser({
    id: "SV001",
    name: "Nguyễn Minh Anh",
    email: "minhanh@school.edu.vn",
    role: "student",
    group: "CNTT K18",
    points: 245,
    status: "active",
    created_at: "2026-07-07T07:00:00.000Z",
  })).toEqual(expect.objectContaining({
    id: "SV001",
    createdAt: "2026-07-07T07:00:00.000Z",
  }));
});

test("maps admin users createdAt into Supabase created_at", () => {
  const payload = __testing.toUser({
    id: "SV002",
    name: "Trần Hoàng Nam",
    email: "hoangnam@school.edu.vn",
    role: "student",
    group: "CNTT K19",
    points: 17,
    status: "active",
    createdAt: "2026-07-07T08:00:00.000Z",
  });

  expect(payload).toEqual(expect.objectContaining({
    id: "SV002",
    created_at: "2026-07-07T08:00:00.000Z",
  }));
  expect(payload.createdAt).toBeUndefined();
});

test("maps non-numeric admin user points to zero for Supabase", () => {
  const payload = __testing.toUser({
    id: "SV-BAD-POINTS",
    name: "Người dùng lỗi điểm",
    email: "badpoints@school.edu.vn",
    role: "student",
    group: "CNTT K20",
    points: "bad-points",
    status: "active",
    createdAt: "2026-07-07T08:00:00.000Z",
  });

  expect(payload.points).toBe(0);
});

test("maps Supabase bins snake_case into clean admin bin fields", () => {
  const bin = __testing.fromBin({
    id: "BIN-A1-RECYCLE",
    name: "Thùng tái chế A1",
    bin_group: "Tái chế",
    location: "Nhà A1",
    building: "A1",
    floor: "1",
    qr_code: "QR-A1",
    status: "active",
    capacity: 54,
    map_x: 30,
    map_y: 78,
  });

  expect(bin).toEqual(expect.objectContaining({
    binGroup: "Tái chế",
    qrCode: "QR-A1",
    mapX: 30,
    mapY: 78,
  }));
  expect(bin.bin_group).toBeUndefined();
  expect(bin.qr_code).toBeUndefined();
  expect(bin.map_x).toBeUndefined();
  expect(bin.map_y).toBeUndefined();
});

test("maps admin bins camelCase into Supabase snake_case fields", () => {
  const payload = __testing.toBin({
    id: "BIN-A1-RECYCLE",
    name: "Thùng tái chế A1",
    binGroup: "Tái chế",
    location: "Nhà A1",
    building: "A1",
    floor: "1",
    qrCode: "QR-A1",
    status: "active",
    capacity: 54,
    mapX: 30,
    mapY: 78,
  });

  expect(payload).toEqual(expect.objectContaining({
    bin_group: "Tái chế",
    qr_code: "QR-A1",
    map_x: 30,
    map_y: 78,
  }));
  expect(payload.binGroup).toBeUndefined();
  expect(payload.qrCode).toBeUndefined();
  expect(payload.mapX).toBeUndefined();
  expect(payload.mapY).toBeUndefined();
});

test("maps Supabase predictions snake_case into clean normalized admin predictions", () => {
  const prediction = __testing.fromPrediction({
    id: "scan-1",
    class: "plastic",
    confidence: 1.8,
    source: "camera",
    timestamp: "2026-07-07T09:00:00.000Z",
    bin_group: "Tái chế",
    status: "pending",
    user_id: "SV001",
    bin_id: "BIN-A1-RECYCLE",
    image_name: "plastic.jpg",
    image_url: "https://storage.example/full.jpg",
    thumbnail_url: "https://storage.example/thumb.jpg",
  });

  expect(prediction).toEqual(expect.objectContaining({
    id: "scan-1",
    confidence: 1,
    binGroup: "Tái chế",
    userId: "SV001",
    binId: "BIN-A1-RECYCLE",
    imageName: "plastic.jpg",
    imageUrl: "https://storage.example/full.jpg",
    thumbnailUrl: "https://storage.example/thumb.jpg",
  }));
  expect(prediction.bin_group).toBeUndefined();
  expect(prediction.user_id).toBeUndefined();
  expect(prediction.bin_id).toBeUndefined();
  expect(prediction.image_name).toBeUndefined();
  expect(prediction.image_url).toBeUndefined();
  expect(prediction.thumbnail_url).toBeUndefined();
});

test("maps admin predictions camelCase into Supabase snake_case fields", () => {
  const payload = __testing.toPrediction({
    id: "scan-1",
    class: "plastic",
    confidence: 0.91,
    source: "camera",
    timestamp: "2026-07-07T09:00:00.000Z",
    binGroup: "Tái chế",
    status: "pending",
    userId: "SV001",
    binId: "BIN-A1-RECYCLE",
    imageName: "plastic.jpg",
    imageUrl: "https://storage.example/full.jpg",
    thumbnailUrl: "https://storage.example/thumb.jpg",
  });

  expect(payload).toEqual(expect.objectContaining({
    bin_group: "Tái chế",
    user_id: "SV001",
    bin_id: "BIN-A1-RECYCLE",
    image_name: "plastic.jpg",
    image_url: "https://storage.example/full.jpg",
    thumbnail_url: "https://storage.example/thumb.jpg",
  }));
  expect(payload.binGroup).toBeUndefined();
  expect(payload.userId).toBeUndefined();
  expect(payload.binId).toBeUndefined();
  expect(payload.imageName).toBeUndefined();
  expect(payload.imageUrl).toBeUndefined();
  expect(payload.thumbnailUrl).toBeUndefined();
});

test("builds safe Supabase Storage paths for AI review images", () => {
  const path = __testing.buildPredictionImagePath("Ảnh chai nhựa #1.JPG", new Date("2026-08-02T08:10:00.000Z"), 0.5);

  expect(path).toBe("ai-reviews/2026-08-02/500000-anh-chai-nhua-1.jpg");
  expect(path).not.toMatch(/[\s#À-ỹ]/);
});

test("maps Supabase point rules snake_case into clean admin point rules", () => {
  const rule = __testing.fromPointRule({
    id: "recycle",
    label: "Rác tái chế hợp lệ",
    class_keys: ["paper", "plastic"],
    bin_group: "Tái chế",
    points: 5,
    enabled: true,
  });

  expect(rule).toEqual(expect.objectContaining({
    classKeys: ["paper", "plastic"],
    binGroup: "Tái chế",
  }));
  expect(rule.class_keys).toBeUndefined();
  expect(rule.bin_group).toBeUndefined();
});

test("maps admin point rules camelCase into Supabase snake_case fields", () => {
  const payload = __testing.toPointRule({
    id: "recycle",
    label: "Rác tái chế hợp lệ",
    classKeys: ["paper", "plastic"],
    binGroup: "Tái chế",
    points: 5,
    enabled: true,
  });

  expect(payload).toEqual(expect.objectContaining({
    class_keys: ["paper", "plastic"],
    bin_group: "Tái chế",
  }));
  expect(payload.classKeys).toBeUndefined();
  expect(payload.binGroup).toBeUndefined();
});

test("maps Supabase point history snake_case into clean admin point history", () => {
  const history = __testing.fromPointHistory({
    id: 901,
    prediction_id: "scan-1",
    user_id: "SV001",
    bin_id: "BIN-A1-RECYCLE",
    class: "plastic",
    bin_group: "Tái chế",
    action: "Duyệt Nhựa",
    points: 5,
    timestamp: "2026-07-07T09:00:00.000Z",
    created_at: "2026-07-07T09:30:00.000Z",
    admin_note: "OK",
    source: "ai_approval",
  });

  expect(history).toEqual(expect.objectContaining({
    predictionId: "scan-1",
    userId: "SV001",
    binId: "BIN-A1-RECYCLE",
    binGroup: "Tái chế",
    createdAt: "2026-07-07T09:30:00.000Z",
    adminNote: "OK",
  }));
  expect(history.prediction_id).toBeUndefined();
  expect(history.user_id).toBeUndefined();
  expect(history.bin_id).toBeUndefined();
  expect(history.bin_group).toBeUndefined();
  expect(history.created_at).toBeUndefined();
  expect(history.admin_note).toBeUndefined();
});

test("maps malformed point history points to zero", () => {
  const history = __testing.fromPointHistory({
    id: 902,
    prediction_id: "scan-bad-points",
    user_id: "SV001",
    bin_id: "BIN-A1-RECYCLE",
    class: "plastic",
    bin_group: "Tái chế",
    action: "Duyệt Nhựa",
    points: "bad-points",
    timestamp: "2026-07-07T09:00:00.000Z",
  });

  expect(history.points).toBe(0);
});

test("maps admin point history camelCase into Supabase snake_case fields", () => {
  const payload = __testing.toPointHistory({
    predictionId: "scan-1",
    userId: "SV001",
    binId: "BIN-A1-RECYCLE",
    class: "plastic",
    binGroup: "Tái chế",
    action: "Duyệt Nhựa",
    points: 5,
    timestamp: "2026-07-07T09:00:00.000Z",
    createdAt: "2026-07-07T09:30:00.000Z",
    adminNote: "OK",
    source: "ai_approval",
  });

  expect(payload).toEqual(expect.objectContaining({
    prediction_id: "scan-1",
    user_id: "SV001",
    bin_id: "BIN-A1-RECYCLE",
    bin_group: "Tái chế",
    created_at: "2026-07-07T09:30:00.000Z",
    admin_note: "OK",
  }));
  expect(payload.predictionId).toBeUndefined();
  expect(payload.userId).toBeUndefined();
  expect(payload.binId).toBeUndefined();
  expect(payload.binGroup).toBeUndefined();
  expect(payload.createdAt).toBeUndefined();
  expect(payload.adminNote).toBeUndefined();
});

test("maps Supabase feedback snake_case into clean admin feedback", () => {
  const feedback = __testing.fromFeedback({
    id: "FB001",
    user_name: "Nguyễn Minh Anh",
    category: "Thùng đầy",
    message: "Thùng đầy.",
    status: "unread",
    priority: "high",
    bin_id: "BIN-A1-RECYCLE",
    admin_note: "Đã xử lý",
    resolved_at: "2026-07-07T10:00:00.000Z",
    timestamp: "2026-07-07T09:00:00.000Z",
  });

  expect(feedback).toEqual(expect.objectContaining({
    userName: "Nguyễn Minh Anh",
    binId: "BIN-A1-RECYCLE",
    adminNote: "Đã xử lý",
    resolvedAt: "2026-07-07T10:00:00.000Z",
  }));
  expect(feedback.user_name).toBeUndefined();
  expect(feedback.bin_id).toBeUndefined();
  expect(feedback.admin_note).toBeUndefined();
  expect(feedback.resolved_at).toBeUndefined();
});

test("maps admin feedback camelCase into Supabase snake_case fields", () => {
  const payload = __testing.toFeedback({
    id: "FB001",
    userName: "Nguyễn Minh Anh",
    category: "Thùng đầy",
    message: "Thùng đầy.",
    status: "resolved",
    priority: "high",
    binId: "BIN-A1-RECYCLE",
    adminNote: "Đã xử lý",
    resolvedAt: "2026-07-07T10:00:00.000Z",
    timestamp: "2026-07-07T09:00:00.000Z",
  });

  expect(payload).toEqual(expect.objectContaining({
    user_name: "Nguyễn Minh Anh",
    bin_id: "BIN-A1-RECYCLE",
    admin_note: "Đã xử lý",
    resolved_at: "2026-07-07T10:00:00.000Z",
  }));
  expect(payload.userName).toBeUndefined();
  expect(payload.binId).toBeUndefined();
  expect(payload.adminNote).toBeUndefined();
  expect(payload.resolvedAt).toBeUndefined();
});

test("maps Supabase reward redemptions snake_case into clean admin rewards", () => {
  const reward = __testing.fromRewardRedemption({
    id: "RW001",
    user_id: "SV001",
    reward_label: "Voucher căn tin",
    cost_points: "100",
    status: "pending",
    requested_at: "2026-07-07T09:00:00.000Z",
    reviewed_at: "2026-07-07T10:00:00.000Z",
    admin_note: "OK",
  });

  expect(reward).toEqual(expect.objectContaining({
    userId: "SV001",
    rewardLabel: "Voucher căn tin",
    costPoints: 100,
    requestedAt: "2026-07-07T09:00:00.000Z",
    reviewedAt: "2026-07-07T10:00:00.000Z",
    adminNote: "OK",
  }));
  expect(reward.user_id).toBeUndefined();
  expect(reward.reward_label).toBeUndefined();
  expect(reward.cost_points).toBeUndefined();
  expect(reward.requested_at).toBeUndefined();
  expect(reward.reviewed_at).toBeUndefined();
  expect(reward.admin_note).toBeUndefined();
});

test("maps malformed reward redemption cost points to zero", () => {
  const reward = __testing.fromRewardRedemption({
    id: "RW-BAD-COST",
    user_id: "SV001",
    reward_label: "Voucher lỗi điểm",
    cost_points: "bad-cost",
    status: "pending",
    requested_at: "2026-07-07T09:00:00.000Z",
  });

  expect(reward.costPoints).toBe(0);
});

test("maps admin reward redemptions camelCase into Supabase snake_case fields", () => {
  const payload = __testing.toRewardRedemption({
    id: "RW001",
    userId: "SV001",
    rewardLabel: "Voucher căn tin",
    costPoints: 100,
    status: "pending",
    requestedAt: "2026-07-07T09:00:00.000Z",
    reviewedAt: "2026-07-07T10:00:00.000Z",
    adminNote: "OK",
  });

  expect(payload).toEqual(expect.objectContaining({
    user_id: "SV001",
    reward_label: "Voucher căn tin",
    cost_points: 100,
    requested_at: "2026-07-07T09:00:00.000Z",
    reviewed_at: "2026-07-07T10:00:00.000Z",
    admin_note: "OK",
  }));
  expect(payload.userId).toBeUndefined();
  expect(payload.rewardLabel).toBeUndefined();
  expect(payload.costPoints).toBeUndefined();
  expect(payload.requestedAt).toBeUndefined();
  expect(payload.reviewedAt).toBeUndefined();
  expect(payload.adminNote).toBeUndefined();
});

test("maps Supabase reward catalog snake_case into admin reward products", () => {
  const reward = __testing.fromRewardCatalog({
    id: "coffee",
    title: "Cà phê căn tin",
    description: "Giảm 50% một ly bất kỳ",
    cost_points: "300",
    status: "active",
    color: "#F6B83F",
  });

  expect(reward).toEqual(expect.objectContaining({
    id: "coffee",
    title: "Cà phê căn tin",
    description: "Giảm 50% một ly bất kỳ",
    costPoints: 300,
    status: "active",
    color: "#F6B83F",
  }));
  expect(reward.cost_points).toBeUndefined();
});

test("maps admin reward products into Supabase reward catalog fields", () => {
  const payload = __testing.toRewardCatalog({
    id: "coffee",
    title: "Cà phê căn tin",
    description: "Giảm 50% một ly bất kỳ",
    costPoints: 300,
    status: "active",
    color: "#F6B83F",
  });

  expect(payload).toEqual(expect.objectContaining({
    id: "coffee",
    title: "Cà phê căn tin",
    description: "Giảm 50% một ly bất kỳ",
    cost_points: 300,
    status: "active",
    color: "#F6B83F",
  }));
  expect(payload.costPoints).toBeUndefined();
});

test("maps Supabase model settings snake_case and clamps invalid threshold", () => {
  const settings = __testing.fromSettings({
    id: "model",
    threshold: 1.8,
    model_name: "MobileNetV2",
    class_count: 10,
    updated_at: "2026-07-07T09:00:00.000Z",
  });

  expect(settings).toEqual(expect.objectContaining({
    threshold: 0.95,
    modelName: "MobileNetV2",
    classCount: 10,
    updatedAt: "2026-07-07T09:00:00.000Z",
  }));
  expect(settings.model_name).toBeUndefined();
  expect(settings.class_count).toBeUndefined();
  expect(settings.updated_at).toBeUndefined();
});

test("maps admin model settings camelCase into Supabase snake_case fields", () => {
  const payload = __testing.toSettings({
    threshold: "bad",
    modelName: "MobileNetV2",
    classCount: 10,
    updatedAt: "2026-07-07T09:00:00.000Z",
  });

  expect(payload).toEqual(expect.objectContaining({
    id: "model",
    threshold: 0.65,
    model_name: "MobileNetV2",
    class_count: 10,
    updated_at: "2026-07-07T09:00:00.000Z",
  }));
  expect(payload.modelName).toBeUndefined();
  expect(payload.classCount).toBeUndefined();
  expect(payload.updatedAt).toBeUndefined();
});

test("maps non-numeric model class count to the configured AI class count", () => {
  const payload = __testing.toSettings({
    threshold: 0.72,
    modelName: "MobileNetV2",
    classCount: "bad-count",
    updatedAt: "2026-07-07T09:00:00.000Z",
  });

  expect(payload.class_count).toBe(10);
});

test("manual point fallback treats malformed local user points as zero", async () => {
  localStorage.setItem(USERS_KEY, JSON.stringify([
    {
      id: "SV-BAD-LOCAL-POINTS",
      name: "Người dùng lỗi điểm local",
      email: "bad-local-points@school.edu.vn",
      role: "student",
      group: "CNTT K20",
      points: "bad-points",
      status: "active",
    },
  ]));

  const response = await saveManualPointHistory({
    userId: "SV-BAD-LOCAL-POINTS",
    points: 12,
    action: "Điều chỉnh dữ liệu lỗi",
    adminNote: "Kiểm tra fallback",
  });

  expect(response.source).toBe("local");
  expect(getUsers()[0].points).toBe(12);
});
test("maps avatar fields between Supabase and admin users", () => {
  const user = __testing.fromUser({
    id: "SV003",
    name: "Avatar User",
    email: "avatar@school.edu.vn",
    role: "student",
    group: "CNTT K20",
    points: 12,
    status: "active",
    avatar_key: "wave",
    avatar_url: "https://cdn.example/avatar.png",
  });

  expect(user).toEqual(expect.objectContaining({ avatarKey: "wave", avatarUrl: "https://cdn.example/avatar.png" }));
  expect(__testing.toUser(user)).toEqual(expect.objectContaining({ avatar_key: "wave", avatar_url: "https://cdn.example/avatar.png" }));
});
