import React, { useMemo, useState } from "react";

const LOCAL_PREDICTIONS_KEY = "smartWastePredictions";

const wasteLabels = {
  battery: "Pin / nguy hại",
  biological: "Rác hữu cơ",
  cardboard: "Bìa carton",
  clothes: "Quần áo",
  glass: "Thủy tinh",
  metal: "Kim loại",
  paper: "Giấy",
  plastic: "Nhựa",
  shoes: "Giày dép",
  trash: "Rác còn lại",
};

const binGroups = {
  biological: "Hữu cơ",
  paper: "Tái chế",
  cardboard: "Tái chế",
  plastic: "Tái chế",
  glass: "Tái chế",
  metal: "Tái chế",
  battery: "Pin / nguy hại",
  clothes: "Còn lại",
  shoes: "Còn lại",
  trash: "Còn lại",
};

const sampleUsers = [
  { id: "SV001", name: "Nguyễn Minh Anh", group: "CNTT K18", points: 245, role: "Sinh viên" },
  { id: "SV002", name: "Trần Hoàng Nam", group: "Môi trường K17", points: 190, role: "Sinh viên" },
  { id: "TN001", name: "Lê Thu Hà", group: "CLB Xanh", points: 320, role: "Tình nguyện viên" },
];

const sampleBins = [
  { id: "BIN-A1-01-ORGANIC", name: "Thùng hữu cơ A1", type: "Hữu cơ", location: "Nhà A1 - tầng 1", status: "Hoạt động" },
  { id: "BIN-A1-01-RECYCLE", name: "Thùng tái chế A1", type: "Tái chế", location: "Nhà A1 - tầng 1", status: "Hoạt động" },
  { id: "BIN-CANTEEN-REMAIN", name: "Thùng còn lại căn tin", type: "Còn lại", location: "Căn tin", status: "Cần kiểm tra" },
  { id: "BOX-LIB-BATTERY", name: "Hộp thu pin thư viện", type: "Pin / nguy hại", location: "Thư viện", status: "Hoạt động" },
];

const tabs = ["Tổng quan", "Người dùng", "Thùng rác", "Lượt quét", "Ecopoint", "Báo cáo"];

const readPredictions = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PREDICTIONS_KEY) || "[]");
  } catch {
    return [];
  }
};

const countBy = (items, getKey) => {
  return items.reduce((acc, item) => {
    const key = getKey(item) || "Không rõ";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
};

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("Tổng quan");
  const predictions = useMemo(readPredictions, []);
  const classCounts = countBy(predictions, item => wasteLabels[item.class] || item.class);
  const groupCounts = countBy(predictions, item => binGroups[item.class] || "Còn lại");
  const latestScans = predictions.slice(-6).reverse();
  const totalPoints = sampleUsers.reduce((sum, user) => sum + user.points, 0);

  return (
    <section className="admin-shell" aria-label="Khu vực quản trị">
      <div className="admin-header">
        <div>
          <p className="admin-eyebrow">Eco-loop Campus</p>
          <h2>Dashboard quản trị</h2>
        </div>
        <div className="admin-summary-pill">MVP trường học</div>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Menu quản trị">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Tổng quan" && (
        <div className="admin-grid">
          <div className="admin-metric"><span>Tổng lượt quét</span><strong>{predictions.length}</strong></div>
          <div className="admin-metric"><span>Người dùng mẫu</span><strong>{sampleUsers.length}</strong></div>
          <div className="admin-metric"><span>Thùng / điểm thu gom</span><strong>{sampleBins.length}</strong></div>
          <div className="admin-metric"><span>Ecopoint đã ghi nhận</span><strong>{totalPoints}</strong></div>

          <div className="admin-panel wide">
            <h3>Phân bổ theo nhóm thùng</h3>
            {Object.keys(groupCounts).length ? (
              Object.entries(groupCounts).map(([group, count]) => (
                <div className="admin-row" key={group}><span>{group}</span><strong>{count}</strong></div>
              ))
            ) : <p>Chưa có lượt quét nào. Hãy thử nhận diện rác từ trang chính.</p>}
          </div>

          <div className="admin-panel wide">
            <h3>Phân bổ theo loại AI</h3>
            {Object.keys(classCounts).length ? (
              Object.entries(classCounts).map(([name, count]) => (
                <div className="admin-row" key={name}><span>{name}</span><strong>{count}</strong></div>
              ))
            ) : <p>Dữ liệu sẽ tự cập nhật sau khi người dùng quét ảnh.</p>}
          </div>
        </div>
      )}

      {activeTab === "Người dùng" && (
        <div className="admin-panel">
          <h3>Quản lý người dùng</h3>
          {sampleUsers.map(user => (
            <div className="admin-list-item" key={user.id}>
              <div><strong>{user.name}</strong><span>{user.id} - {user.group}</span></div>
              <div><span>{user.role}</span><strong>{user.points} điểm</strong></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Thùng rác" && (
        <div className="admin-panel">
          <h3>Quản lý thùng rác / QR</h3>
          {sampleBins.map(bin => (
            <div className="admin-list-item" key={bin.id}>
              <div><strong>{bin.name}</strong><span>{bin.location}</span></div>
              <div><span>{bin.type}</span><strong>{bin.status}</strong></div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Lượt quét" && (
        <div className="admin-panel">
          <h3>Quản lý lượt quét</h3>
          {latestScans.length ? latestScans.map((scan, index) => (
            <div className="admin-list-item" key={`${scan.timestamp}-${index}`}>
              <div><strong>{wasteLabels[scan.class] || scan.class}</strong><span>{scan.source === "camera" ? "Máy ảnh" : "Tải ảnh"}</span></div>
              <div><span>{new Date(scan.timestamp).toLocaleString("vi-VN")}</span><strong>{Math.round(scan.confidence * 100)}%</strong></div>
            </div>
          )) : <p>Chưa có lượt quét nào để duyệt.</p>}
        </div>
      )}

      {activeTab === "Ecopoint" && (
        <div className="admin-panel">
          <h3>Quản lý Ecopoint</h3>
          <div className="admin-row"><span>Rác tái chế hợp lệ</span><strong>+5 điểm</strong></div>
          <div className="admin-row"><span>Rác hữu cơ đúng thùng</span><strong>+3 điểm</strong></div>
          <div className="admin-row"><span>Pin / rác nguy hại nộp đúng điểm</span><strong>+8 điểm</strong></div>
          <div className="admin-row"><span>Lượt bị admin từ chối</span><strong>0 điểm</strong></div>
        </div>
      )}

      {activeTab === "Báo cáo" && (
        <div className="admin-panel">
          <h3>Báo cáo vận hành</h3>
          <div className="admin-report-grid">
            <div><span>Lượt quét tháng này</span><strong>{predictions.length}</strong></div>
            <div><span>Số nhóm thùng đang theo dõi</span><strong>4</strong></div>
            <div><span>Thùng cần kiểm tra</span><strong>{sampleBins.filter(bin => bin.status !== "Hoạt động").length}</strong></div>
          </div>
          <p>Bước sau có thể xuất Excel/PDF và lọc theo lớp, khoa, tòa nhà.</p>
        </div>
      )}
    </section>
  );
}

export default AdminDashboard;
