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
import { downloadStudentContributionReport, listBins, listFeedback, listPointHistory, listPredictions, listStudentContributionReport } from "../services/supabaseStore";

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
  const dateFromFilter = searchParams.get("dateFrom") || "";
  const dateToFilter = searchParams.get("dateTo") || "";
  const dateFilters = {
    dateFrom: dateFromFilter,
    dateTo: dateToFilter,
  };
  const [predictions, setPredictions] = useState([]);
  const [bins, setBins] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [pointHistory, setPointHistory] = useState([]);
  const [studentReport, setStudentReport] = useState({ summary: {}, dailyRows: [], studentRows: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      const [predictionResult, binResult, feedbackResult, pointResult, studentReportResult] = await Promise.all([
        listPredictions(),
        listBins(),
        listFeedback(),
        listPointHistory(),
        listStudentContributionReport({ dateFrom: dateFromFilter, dateTo: dateToFilter }),
      ]);
      if (!active) return;
      setPredictions(predictionResult.data);
      setBins(binResult.data);
      setFeedback(feedbackResult.data);
      setPointHistory(pointResult.data);
      setStudentReport(studentReportResult.data);
      setError([predictionResult, binResult, feedbackResult, pointResult, studentReportResult].find(item => item.error)?.error || null);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, [dateFromFilter, dateToFilter]);

  const buildingOptions = uniqueValues(bins, "building");
  const binGroupOptions = BIN_GROUPS.map(group => group.label);
  const filters = {
    dateFrom: dateFilters.dateFrom,
    dateTo: dateFilters.dateTo,
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
  const studentSummary = studentReport.summary || {};
  const dailyRows = Array.isArray(studentReport.dailyRows) ? studentReport.dailyRows : [];
  const studentRows = Array.isArray(studentReport.studentRows) ? studentReport.studentRows : [];
  const studentTrendData = {
    labels: dailyRows.map(row => row.date),
    datasets: [
      { label: "Lượt đóng góp", data: dailyRows.map(row => row.contributions), borderColor: "#2f80ed", backgroundColor: "rgba(47,128,237,0.12)", tension: 0.35, fill: true },
      { label: "Ecopoint", data: dailyRows.map(row => row.points), borderColor: "#16a34a", backgroundColor: "rgba(22,163,74,0.12)", tension: 0.35, fill: true },
      { label: "Đổi thưởng", data: dailyRows.map(row => row.rewardRedemptions), borderColor: "#b45309", backgroundColor: "rgba(180,83,9,0.12)", tension: 0.35, fill: true },
    ],
  };

  const columns = [
    { key: "group", label: "Nhóm thùng", render: row => <StatusBadge group={row.group}>{row.group}</StatusBadge> },
    { key: "scans", label: "Lượt quét" },
    { key: "points", label: "Ecopoint" },
    { key: "feedback", label: "Phản hồi" },
    { key: "fullBins", label: "Thùng đầy" },
  ];
  const studentColumns = [
    { key: "fullName", label: "Họ tên" },
    { key: "studentCode", label: "Mã sinh viên" },
    { key: "faculty", label: "Khoa" },
    { key: "group", label: "Lớp" },
    { key: "contributionCount", label: "Số lần đóng góp" },
    { key: "totalPoints", label: "Tổng điểm" },
  ];
  const dailyColumns = [
    { key: "date", label: "Ngày" },
    { key: "contributions", label: "Lượt đóng góp" },
    { key: "activeStudents", label: "Số sinh viên tham gia" },
    { key: "points", label: "Ecopoint" },
    { key: "feedback", label: "Phản hồi" },
    { key: "rewardRedemptions", label: "Đổi thưởng" },
  ];
  const downloadStudentReport = async format => {
    const response = await downloadStudentContributionReport(format, dateFilters);
    if (response.error || !response.data?.blob) {
      setError(response.error || new Error("Không xuất được danh sách"));
      return;
    }
    const extension = format === "xlsx" ? "xlsx" : "csv";
    const url = URL.createObjectURL(response.data.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eco-loop-diem-ren-luyen.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
      {error && <section className="eg-alert">Không tải được dữ liệu từ backend PostgreSQL. Kiểm tra cấu hình hoặc quyền truy cập.</section>}

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

      <section className="eg-card">
        <div className="eg-card-head">
          <div>
            <h2>Danh sách điểm rèn luyện</h2>
            <p>Xuất danh sách sinh viên theo khoảng thời gian đang lọc.</p>
          </div>
          <div className="eg-button-row">
            <button type="button" className="eg-secondary-btn" onClick={() => void downloadStudentReport("csv")}><DownloadSimple size={18} /> Tải danh sách CSV</button>
            <button type="button" className="eg-primary-btn" onClick={() => void downloadStudentReport("xlsx")}><DownloadSimple size={18} /> Tải danh sách Excel</button>
          </div>
        </div>
        <div className="eg-stat-grid">
          <StatCard title="Lượt đóng góp" value={studentSummary.totalContributions || 0} hint="Lượt nộp rác đã xác nhận" />
          <StatCard title="Sinh viên tham gia" value={studentSummary.activeStudents || 0} hint="Có ít nhất 1 lượt đóng góp" tone="green" />
          <StatCard title="Tổng điểm" value={studentSummary.totalPoints || 0} hint="Trong khoảng thời gian lọc" tone="orange" />
          <StatCard title="Trung bình/ngày" value={studentSummary.averageContributionsPerDay || 0} hint="Theo ngày có hoạt động" tone="red" />
        </div>
        <DataTable columns={studentColumns} rows={studentRows} emptyText="Chưa có sinh viên đóng góp trong khoảng thời gian này" />
      </section>

      <section className="eg-card">
        <div className="eg-card-head"><h2>Biến động theo ngày</h2></div>
        <DataTable columns={dailyColumns} rows={dailyRows} emptyText="Chưa có dữ liệu theo ngày" />
      </section>
      <div className="eg-dashboard-grid">
        <ChartPanel title="Thống kê theo ngày" subtitle="Lượt đóng góp, Ecopoint và đổi thưởng" type="line" data={studentTrendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }} />
      </div>
    </div>
  );
}
