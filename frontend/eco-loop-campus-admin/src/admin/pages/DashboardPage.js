import { ChartLineUp, Clock, Coins, Trash } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ChartPanel from "../components/ChartPanel";
import CampusMap from "../components/CampusMap";
import DataTable from "../components/DataTable";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { isOpenFeedback } from "../data/feedbackConfig";
import { BIN_GROUPS, getWasteLabel } from "../data/wasteConfig";
import { loadDashboardData, saveBin, seedDefaults, sourceText } from "../services/supabaseStore";

const LOW_CONFIDENCE_THRESHOLD = 0.65;
const BIN_CAPACITY_WARNING = 85;
const dateFormatter = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const safeNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const safePercent = value => Math.min(100, Math.max(0, safeNumber(value)));

const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không rõ" : dateFormatter.format(date);
};
const formatPercent = value => `${Math.round(safeNumber(value) * 100)}%`;
const statusCode = value => String(value || "").trim().toLowerCase();
const groupCode = value => String(value || "").trim().toLocaleLowerCase("vi-VN");
const normalizeBinGroup = value => BIN_GROUPS.find(group => groupCode(group.label) === groupCode(value))?.label || String(value || "").trim();
const safeList = items => Array.isArray(items) ? items.filter(Boolean) : [];
const isPendingScan = item => Boolean(item) && statusCode(item.status) === "pending";
const isMaintenanceBin = bin => Boolean(bin) && statusCode(bin.status) === "maintenance";
const isBinAttention = bin => Boolean(bin) && (isMaintenanceBin(bin) || statusCode(bin.status) === "full" || safePercent(bin.capacity) >= BIN_CAPACITY_WARNING);

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function makeDailyScanData(predictions, pointHistory = []) {
  const labels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
  const fallback = [6, 9, 12, 8, 14, 10, 7];
  const values = predictions.length ? labels.map((_, index) => predictions.filter((__, itemIndex) => itemIndex % 7 === index).length) : fallback;
  const pointValues = labels.map((_, index) => pointHistory
    .filter((__, itemIndex) => itemIndex % 7 === index)
    .reduce((sum, item) => sum + Number(item.points || 0), 0));

  return {
    labels,
    datasets: [
      {
        label: "Lượt quét",
        data: values,
        borderColor: "#4680ff",
        backgroundColor: "rgba(70, 128, 255, 0.12)",
        borderWidth: 3,
        fill: true,
        tension: 0.38,
      },
      {
        label: "Ecopoint đã cấp",
        data: pointValues,
        borderColor: "#2ca87f",
        backgroundColor: "rgba(44, 168, 127, 0.12)",
        borderWidth: 3,
        fill: true,
        tension: 0.38,
      },
    ],
  };
}

function makeGroupData(groupCounts) {
  return {
    labels: BIN_GROUPS.map(group => group.label),
    datasets: [
      {
        data: BIN_GROUPS.map(group => groupCounts[group.label] || 0),
        backgroundColor: BIN_GROUPS.map(group => group.color),
        borderWidth: 0,
      },
    ],
  };
}

function makePriorityItems(predictions, bins, feedback, confidenceThreshold = LOW_CONFIDENCE_THRESHOLD) {
  const safePredictions = safeList(predictions);
  const safeBins = safeList(bins);
  const safeFeedback = safeList(feedback);
  const openFeedback = safeFeedback.filter(isOpenFeedback);
  const threshold = safeNumber(confidenceThreshold) || LOW_CONFIDENCE_THRESHOLD;
  const lowConfidenceScans = safePredictions.filter(item => isPendingScan(item) && safeNumber(item.confidence) < threshold);
  const pendingScans = safePredictions.filter(isPendingScan);
  const binAlerts = safeBins.filter(isBinAttention);
  const items = [];

  if (openFeedback.length) {
    items.push({
      id: "feedback",
      href: "/feedback?status=open",
      tone: "red",
      title: `${openFeedback.length} phản hồi chưa xử lý`,
      detail: "Ưu tiên phản hồi chưa đọc hoặc đang xử lý",
      meta: `${openFeedback[0].category || "Phản hồi"} · ${openFeedback[0].userName || "Chưa rõ người gửi"}`,
    });
  }

  if (lowConfidenceScans.length) {
    const first = lowConfidenceScans[0];
    items.push({
      id: "low-confidence",
      href: "/scans?status=pending&confidence=low",
      tone: "orange",
      title: `${lowConfidenceScans.length} lượt quét độ tin cậy thấp`,
      detail: "Cần admin kiểm tra trước khi cộng điểm",
      meta: `${first.id} · ${getWasteLabel(first.class)} · ${formatPercent(first.confidence)}`,
    });
  }

  if (pendingScans.length) {
    items.push({
      id: "pending-scans",
      href: "/scans?status=pending",
      tone: "blue",
      title: `${pendingScans.length} lượt quét chờ duyệt`,
      detail: "Đi tới Lượt quét để duyệt hoặc từ chối",
      meta: pendingScans[0].id,
    });
  }

  if (binAlerts.length) {
    const first = binAlerts[0];
    items.push({
      id: "bin-alerts",
      href: "/bins?status=attention",
      tone: "green",
      title: `${binAlerts.length} thùng cần kiểm tra`,
      detail: `Bảo trì hoặc sức chứa từ ${BIN_CAPACITY_WARNING}%`,
      meta: `${first.name} · ${first.location}`,
    });
  }

  return items;
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState({ predictions: [], bins: [], users: [], pointRules: [], feedback: [], pointHistory: [], settings: { threshold: LOW_CONFIDENCE_THRESHOLD } });
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const response = await loadDashboardData();
    setDashboard(response.data);
    setSource(response.source);
    setError(response.error);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const seedData = async () => {
    await seedDefaults();
    await loadData();
  };

  const updateBinPosition = async (bin, position) => {
    const updatedBin = { ...bin, ...position };
    const response = await saveBin(updatedBin);
    setDashboard(current => ({
      ...current,
      bins: safeList(current.bins).map(item => item.id === bin.id ? response.data : item),
    }));
    setSource(response.source);
    setError(response.error);
    return response.data;
  };

  const predictions = safeList(dashboard.predictions);
  const bins = safeList(dashboard.bins);
  const users = safeList(dashboard.users);
  const feedback = safeList(dashboard.feedback);
  const pointHistory = safeList(dashboard.pointHistory);
  const modelThreshold = safeNumber(dashboard.settings?.threshold) || LOW_CONFIDENCE_THRESHOLD;
  const groupCounts = countBy(predictions, item => normalizeBinGroup(item.binGroup));
  const pendingCount = predictions.filter(isPendingScan).length;
  const maintenanceCount = bins.filter(isMaintenanceBin).length;
  const binAttentionCount = bins.filter(isBinAttention).length;
  const totalUserPoints = users.reduce((sum, user) => sum + safeNumber(user.points), 0);
  const totalAwardedPoints = pointHistory.reduce((sum, item) => sum + safeNumber(item.points), 0);
  const avgCapacity = bins.length ? Math.round(bins.reduce((sum, bin) => sum + safePercent(bin.capacity), 0) / bins.length) : 0;
  const avgConfidence = predictions.length ? Math.round(predictions.reduce((sum, item) => sum + safeNumber(item.confidence), 0) / predictions.length * 100) : 0;
  const latestScans = predictions.slice(0, 6);
  const latestPointHistory = pointHistory.slice(0, 6);
  const priorityItems = makePriorityItems(predictions, bins, feedback, modelThreshold);

  const tableColumns = [
    { key: "class", label: "Loại AI", render: row => getWasteLabel(row.class) },
    { key: "group", label: "Nhóm thùng", render: row => <StatusBadge group={row.binGroup}>{row.binGroup}</StatusBadge> },
    { key: "confidence", label: "Tin cậy", render: row => formatPercent(row.confidence) },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={row.status} /> },
    { key: "timestamp", label: "Thời gian", render: row => formatDate(row.timestamp) },
  ];

  const pointColumns = [
    { key: "action", label: "Hoạt động", render: row => row.action || "Cộng điểm" },
    { key: "user", label: "Người nhận", render: row => row.userName || row.userId || "Chưa rõ" },
    { key: "bin", label: "Trạm", render: row => row.binName || row.binId || "Chưa gắn thùng" },
    { key: "points", label: "Điểm", render: row => <strong className="eg-positive-points">+{safeNumber(row.points)}</strong> },
    { key: "timestamp", label: "Thời gian", render: row => formatDate(row.timestamp || row.createdAt) },
  ];

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Eco-loop Campus</span>
          <h1>Tổng quan quản trị</h1>
        </div>
        <div className="eg-button-row">
          {source && <span className={`eg-source-pill ${source === "local" ? "is-local" : ""}`}>{sourceText(source)}</span>}
          <button type="button" className="eg-secondary-btn" onClick={seedData}>Khởi tạo dữ liệu mẫu</button>
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải dữ liệu quản trị...</section>}
      {error && <section className="eg-alert">Supabase chưa sẵn sàng, đang dùng dữ liệu dự phòng localStorage.</section>}

      <section className="eg-command-panel" aria-labelledby="ops-center-title">
        <div>
          <span className="eg-section-kicker">Datta Able Operations</span>
          <h2 id="ops-center-title">Trung tâm điều phối</h2>
          <p>Theo dõi AI, thùng rác, cảnh báo và điểm thưởng trong một màn hình quản trị.</p>
        </div>
        <div className="eg-command-metrics" aria-label="Tóm tắt vận hành campus">
          <article>
            <span>Mức độ đầy trung bình</span>
            <strong>{avgCapacity}%</strong>
          </article>
          <article>
            <span>Cảnh báo bảo trì</span>
            <strong>{maintenanceCount}</strong>
          </article>
          <article>
            <span>Độ tin cậy AI</span>
            <strong>{avgConfidence}%</strong>
          </article>
          <article>
            <span>Đang chờ duyệt</span>
            <strong>{pendingCount}</strong>
          </article>
        </div>
      </section>

      <section className="eg-card eg-priority-panel" aria-labelledby="priority-work-title">
        <div className="eg-card-head compact">
          <div>
            <h2 id="priority-work-title">Việc cần xử lý hôm nay</h2>
            <p>Cảnh báo tổng hợp từ phản hồi, lượt quét AI và trạng thái thùng rác.</p>
          </div>
        </div>
        {priorityItems.length ? (
          <div className="eg-priority-list">
            {priorityItems.map(item => (
              <Link key={item.id} to={item.href} className={`eg-priority-item tone-${item.tone}`}>
                <span>{item.title}</span>
                <strong>{item.detail}</strong>
                <small>{item.meta}</small>
              </Link>
            ))}
          </div>
        ) : (
          <div className="eg-priority-empty">Không có cảnh báo cần xử lý ngay.</div>
        )}
      </section>

      <div className="eg-stat-grid">
        <StatCard title="Tổng lượt quét" value={predictions.length} hint={source ? sourceText(source) : "Đang tải"} tone="blue" icon={ChartLineUp} />
        <StatCard title="Chờ duyệt" value={pendingCount} hint="Cần admin kiểm tra" tone="orange" icon={Clock} />
        <StatCard title="Thùng cần kiểm tra" value={binAttentionCount} hint={`${bins.length} điểm thu gom`} tone="red" icon={Trash} />
        <StatCard title="Ecopoint đã cấp" value={totalAwardedPoints} hint={`${pointHistory.length} lượt cộng điểm · ${totalUserPoints} điểm người dùng`} tone="green" icon={Coins} />
      </div>

      <div className="eg-dashboard-grid">
        <ChartPanel title="Lượt quét & Ecopoint theo tuần" subtitle="Dựa trên lịch sử quét và lịch sử cộng điểm" type="line" data={makeDailyScanData(predictions, pointHistory)} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }} />
        <ChartPanel title="Phân bổ nhóm thùng" subtitle="4 nhóm dùng trong trường" type="doughnut" data={makeGroupData(groupCounts)} options={{ responsive: true, maintainAspectRatio: false, cutout: "68%" }} />
      </div>

      <div className="eg-group-strip">
        {BIN_GROUPS.map(group => (
          <article key={group.id} className="eg-group-card" style={{ "--group-color": group.color }}>
            <span>{group.label}</span>
            <strong>{groupCounts[group.label] || 0}</strong>
          </article>
        ))}
      </div>

      <div className="eg-ops-grid">
        <CampusMap bins={bins} feedback={feedback} onUpdateBinPosition={updateBinPosition} />

        <section className="eg-card eg-latest-card">
          <div className="eg-card-head">
            <div>
              <h2>Lượt quét mới nhất</h2>
              <p>Dữ liệu chờ duyệt và kết quả đã xử lý</p>
            </div>
          </div>
          <DataTable columns={tableColumns} rows={latestScans} emptyText="Chưa có lượt quét nào. Dùng trang Kiểm thử AI để tạo dữ liệu." />
        </section>
      </div>

      <section className="eg-card eg-latest-card">
        <div className="eg-card-head">
          <div>
            <h2>Hoạt động cộng điểm mới nhất</h2>
            <p>Dựa trên lịch sử cộng điểm thật từ quy trình duyệt AI</p>
          </div>
        </div>
        <DataTable columns={pointColumns} rows={latestPointHistory} emptyText="Chưa có lịch sử cộng điểm. Duyệt lượt quét hợp lệ để tạo dữ liệu." />
      </section>
    </div>
  );
}

export const __testing = {
  isMaintenanceBin,
  isBinAttention,
  makePriorityItems,
};
