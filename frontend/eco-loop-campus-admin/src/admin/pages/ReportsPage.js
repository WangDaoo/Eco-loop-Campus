import { DownloadSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ChartPanel from "../components/ChartPanel";
import DataTable from "../components/DataTable";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { BIN_GROUPS } from "../data/wasteConfig";
import { downloadCsv } from "../services/csv";
import { buildReportSummary, filterReportData, makeDailyReportData, makeReportCsvRows } from "../services/reportMetrics";
import { listBins, listFeedback, listPointHistory, listPredictions } from "../services/supabaseStore";

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function uniqueValues(items, key) {
  return Array.from(new Set(items.map(item => item[key]).filter(Boolean))).sort();
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function statusCode(value) {
  return String(value || "").trim().toLowerCase();
}

function labelCode(value) {
  return String(value || "").trim().toLocaleLowerCase("vi-VN");
}

function normalizeLabelFilter(value, options) {
  const normalized = labelCode(value);
  if (!normalized) return "";
  return options.find(option => labelCode(option) === normalized) || "";
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [predictions, setPredictions] = useState([]);
  const [bins, setBins] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [pointHistory, setPointHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      const [predictionResult, binResult, feedbackResult, pointResult] = await Promise.all([
        listPredictions(),
        listBins(),
        listFeedback(),
        listPointHistory(),
      ]);
      if (!active) return;
      setPredictions(predictionResult.data);
      setBins(binResult.data);
      setFeedback(feedbackResult.data);
      setPointHistory(pointResult.data);
      setError([predictionResult, binResult, feedbackResult, pointResult].find(item => item.error)?.error || null);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const buildingOptions = uniqueValues(bins, "building");
  const binGroupOptions = BIN_GROUPS.map(group => group.label);
  const filters = {
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    building: normalizeLabelFilter(searchParams.get("building"), buildingOptions),
    binGroup: normalizeLabelFilter(searchParams.get("binGroup"), binGroupOptions),
  };

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const filtered = filterReportData({ predictions, bins, feedback, pointHistory }, filters);
  const summary = buildReportSummary(filtered);
  const dailyChartData = makeDailyReportData(filtered);
  const csvRows = makeReportCsvRows(filtered);
  const groupCounts = countBy(filtered.predictions, item => item.binGroup);
  const pointCounts = countBy(filtered.pointHistory, item => item.binGroup);
  const binMap = filtered.bins.reduce((acc, bin) => ({ ...acc, [bin.id]: bin }), {});
  const feedbackCounts = countBy(filtered.feedback, item => binMap[item.binId]?.binGroup || "Chưa gắn thùng");
  const fullBinCounts = countBy(filtered.bins.filter(bin => statusCode(bin.status) === "full" || safeNumber(bin.capacity) >= 85), item => item.binGroup);
  const groupRows = BIN_GROUPS.map(group => ({
    id: group.id,
    group: group.label,
    scans: groupCounts[group.label] || 0,
    points: pointCounts[group.label] || 0,
    feedback: feedbackCounts[group.label] || 0,
    fullBins: fullBinCounts[group.label] || 0,
  }));
  const groupChartData = {
    labels: groupRows.map(row => row.group),
    datasets: [{ label: "Lượt quét", data: groupRows.map(row => row.scans), backgroundColor: BIN_GROUPS.map(group => group.color), borderRadius: 8 }],
  };

  const columns = [
    { key: "group", label: "Nhóm thùng", render: row => <StatusBadge group={row.group}>{row.group}</StatusBadge> },
    { key: "scans", label: "Lượt quét" },
    { key: "points", label: "Ecopoint" },
    { key: "feedback", label: "Phản hồi" },
    { key: "fullBins", label: "Thùng đầy" },
  ];

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Tổng hợp vận hành</span>
          <h1>Báo cáo</h1>
        </div>
        <div className="eg-button-row">
          <button type="button" className="eg-primary-btn" onClick={() => downloadCsv("eco-loop-campus-report.csv", csvRows)}><DownloadSimple size={18} /> Xuất CSV</button>
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải báo cáo...</section>}
      {error && <section className="eg-alert">Không tải được dữ liệu từ Supabase. Kiểm tra cấu hình hoặc quyền truy cập.</section>}

      <section className="eg-card eg-filter-panel" aria-label="Bộ lọc báo cáo">
        <label>Từ ngày<input aria-label="Từ ngày" type="date" value={filters.dateFrom} onChange={event => updateFilter("dateFrom", event.target.value)} /></label>
        <label>Đến ngày<input aria-label="Đến ngày" type="date" value={filters.dateTo} onChange={event => updateFilter("dateTo", event.target.value)} /></label>
        <label>Tòa nhà<select aria-label="Tòa nhà" value={filters.building} onChange={event => updateFilter("building", event.target.value)}><option value="">Tất cả</option>{buildingOptions.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Nhóm rác<select aria-label="Nhóm rác" value={filters.binGroup} onChange={event => updateFilter("binGroup", event.target.value)}><option value="">Tất cả</option>{BIN_GROUPS.map(group => <option key={group.id} value={group.label}>{group.label}</option>)}</select></label>
      </section>

      <div className="eg-stat-grid">
        <StatCard title="Lượt quét" value={summary.totalScans} hint="Theo bộ lọc hiện tại" />
        <StatCard title="Ecopoint đã cấp" value={summary.totalPoints} hint="Từ lịch sử cộng điểm" tone="green" />
        <StatCard title="Phản hồi mở" value={summary.openFeedback} hint="Chưa hoàn tất xử lý" tone="orange" />
        <StatCard title="Thùng đầy" value={summary.fullBins} hint="Sức chứa từ 85% hoặc trạng thái đầy" tone="red" />
      </div>

      <div className="eg-dashboard-grid">
        <ChartPanel title="Vận hành theo ngày" subtitle="Lượt quét, điểm và phản hồi theo bộ lọc" type="line" data={dailyChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }} />
        <ChartPanel title="Lượt quét theo nhóm" subtitle="4 nhóm thùng trong trường" type="bar" data={groupChartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
      </div>

      <section className="eg-card">
        <div className="eg-card-head"><h2>Bảng tổng hợp</h2></div>
        <DataTable columns={columns} rows={groupRows} />
      </section>
    </div>
  );
}
