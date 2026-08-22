export const seedUsers = [
  { id: "SV001", name: "Nguyễn Minh Anh", email: "minhanh@school.edu.vn", role: "Sinh viên", group: "CNTT K18", points: 245, status: "active", avatarKey: "sprout" },
  { id: "SV002", name: "Trần Hoàng Nam", email: "hoangnam@school.edu.vn", role: "Sinh viên", group: "Môi trường K17", points: 190, status: "active", avatarKey: "sunny" },
  { id: "GV001", name: "Lê Thu Hà", email: "thuha@school.edu.vn", role: "Giáo viên", group: "Khoa Môi trường", points: 80, status: "active", avatarKey: "berry" },
  { id: "TN001", name: "Phạm Khánh Linh", email: "khanhlinh@school.edu.vn", role: "Tình nguyện viên", group: "CLB Xanh", points: 320, status: "active", avatarKey: "wave" },
  { id: "AD001", name: "Quản trị Eco-loop Campus", email: "admin@school.edu.vn", role: "Admin", group: "Ban vận hành", points: 0, status: "active", avatarKey: "sprout" },
];

export const seedBins = [
  { id: "BIN-A1-ORGANIC", name: "Thùng hữu cơ A1", binGroup: "Hữu cơ", location: "Nhà A1 - tầng 1", building: "A1", floor: "1", qrCode: "QR-A1-ORGANIC", status: "active", capacity: 72, mapX: 27, mapY: 78 },
  { id: "BIN-A1-RECYCLE", name: "Thùng tái chế A1", binGroup: "Tái chế", location: "Nhà A1 - tầng 1", building: "A1", floor: "1", qrCode: "QR-A1-RECYCLE", status: "active", capacity: 54, mapX: 30, mapY: 78 },
  { id: "BIN-CANTEEN-REMAIN", name: "Thùng còn lại căn tin", binGroup: "Còn lại", location: "Căn tin", building: "Canteen", floor: "1", qrCode: "QR-CANTEEN-REMAIN", status: "maintenance", capacity: 88, mapX: 54, mapY: 72 },
  { id: "BOX-LIB-BATTERY", name: "Hộp thu pin thư viện", binGroup: "Pin / nguy hại", location: "Thư viện", building: "Library", floor: "2", qrCode: "QR-LIB-BATTERY", status: "active", capacity: 31, mapX: 39, mapY: 86 },
];

export const seedFeedback = [
  { id: "FB001", userName: "Nguyễn Minh Anh", category: "Sai phân loại", message: "Ảnh chai nhựa đôi lúc bị nhận là thủy tinh.", status: "unread", priority: "medium", binId: "BIN-A1-RECYCLE", adminNote: "", timestamp: "2026-07-07T07:20:00.000Z" },
  { id: "FB002", userName: "Trần Hoàng Nam", category: "Thùng đầy", message: "Thùng tái chế ở A1 gần đầy vào giờ trưa.", status: "in_progress", priority: "high", binId: "BIN-A1-RECYCLE", adminNote: "Đã giao đội vệ sinh kiểm tra sau giờ trưa.", timestamp: "2026-07-06T15:40:00.000Z" },
  { id: "FB003", userName: "Phạm Khánh Linh", category: "QR", message: "QR tại thư viện hơi mờ, cần in lại.", status: "unread", priority: "low", binId: "BOX-LIB-BATTERY", adminNote: "", timestamp: "2026-07-06T09:10:00.000Z" },
];

export const seedPointHistory = [
  { id: "P001", user: "Nguyễn Minh Anh", action: "Duyệt rác tái chế", points: 5, timestamp: "2026-07-07T09:05:00.000Z" },
  { id: "P002", user: "Phạm Khánh Linh", action: "Nộp pin đúng điểm", points: 8, timestamp: "2026-07-07T08:25:00.000Z" },
  { id: "P003", user: "Trần Hoàng Nam", action: "Rác hữu cơ đúng thùng", points: 3, timestamp: "2026-07-06T13:15:00.000Z" },
];

export const seedRewardProducts = [
  { id: "coffee", title: "Cà phê căn tin", description: "Giảm 50% cho 1 ly bất kỳ", costPoints: 300, status: "active", color: "#F6B83F" },
  { id: "book", title: "Voucher nhà sách", description: "Giảm 20% dụng cụ học tập", costPoints: 500, status: "active", color: "#78C96D" },
  { id: "tree", title: "Trồng 1 cây xanh", description: "Ghi tên bạn vào vườn Eco-loop", costPoints: 800, status: "active", color: "#2F8F5B" },
];
