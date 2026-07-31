import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { getBinGroup, getWasteLabel } from "../data/wasteConfig";
import { getModelSettings, listPredictions, setPredictionStatus, sourceText } from "../services/supabaseStore";

const formatDate = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không rõ";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
};
const formatPercent = value => `${Math.round(Number(value || 0) * 100)}%`;

const normalizeFilter = (value, allowedValues) => {
  const normalized = String(value || "all").trim().toLowerCase();
  return allowedValues.includes(normalized) ? normalized : "all";
};

export default function ScansPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [predictions, setPredictions] = useState([]);
  const [statusFilter, setStatusFilter] = useState(() => normalizeFilter(searchParams.get("status"), ["all", "pending", "approved", "rejected"]));
  const [classFilter, setClassFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState(() => normalizeFilter(searchParams.get("confidence"), ["all", "low"]));
  const [threshold, setThreshold] = useState(0.65);
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      const [predictionResult, settingsResult] = await Promise.all([listPredictions(), getModelSettings()]);
      if (!active) return;
      setPredictions(predictionResult.data);
      setThreshold(settingsResult.data.threshold || 0.65);
      setSource(predictionResult.source);
      setError(predictionResult.error || settingsResult.error);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const visibleRows = useMemo(() => predictions.filter(item => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesClass = classFilter === "all" || item.class === classFilter;
    const matchesConfidence = confidenceFilter === "all" || (confidenceFilter === "low" && Number(item.confidence || 0) < threshold);
    return matchesStatus && matchesClass && matchesConfidence;
  }), [classFilter, confidenceFilter, predictions, statusFilter, threshold]);

  const updateQueryFilter = (key, value, setter) => {
    setter(value);
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next);
  };

  const updateStatus = async (record, status) => {
    const response = await setPredictionStatus(record, status);
    setPredictions(current => current.map(item => item.id === record.id ? response.data : item));
    setSource(response.source);
    setError(response.error);
    setToast(status === "approved" ? "Đã duyệt lượt quét" : "Đã từ chối lượt quét");
  };

  const columns = [
    { key: "id", label: "Mã", render: row => <strong>{row.id}</strong> },
    { key: "class", label: "Loại AI", render: row => getWasteLabel(row.class) },
    { key: "binGroup", label: "Nhóm thùng", render: row => <StatusBadge group={getBinGroup(row.class)}>{getBinGroup(row.class)}</StatusBadge> },
    { key: "confidence", label: "Tin cậy", render: row => <span className={row.confidence < threshold ? "eg-warning-text" : ""}>{formatPercent(row.confidence)}</span> },
    { key: "source", label: "Nguồn", render: row => row.source === "camera" ? "Camera" : "Tải ảnh" },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={row.status} /> },
    { key: "timestamp", label: "Thời gian", render: row => formatDate(row.timestamp) },
    {
      key: "actions",
      label: "Thao tác",
      render: row => row.status === "pending" ? (
        <div className="eg-table-actions">
          <button type="button" className="eg-small-btn success" onClick={() => updateStatus(row, "approved")} aria-label={`Duyệt ${row.id}`}>Duyệt</button>
          <button type="button" className="eg-small-btn danger" onClick={() => updateStatus(row, "rejected")} aria-label={`Từ chối ${row.id}`}>Từ chối</button>
        </div>
      ) : <span className="eg-muted-block">Đã xử lý</span>,
    },
  ];

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Kiểm soát chất lượng AI</span>
          <h1>Duyệt kết quả AI</h1>
        </div>
        <div className="eg-button-row">
          {source && <span className={`eg-source-pill ${source === "local" ? "is-local" : ""}`}>{sourceText(source)}</span>}
          <button type="button" className="eg-secondary-btn">Ngưỡng cảnh báo {formatPercent(threshold)}</button>
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải lượt quét...</section>}
      {error && <section className="eg-alert">Supabase chưa sẵn sàng, đang dùng dữ liệu dự phòng localStorage.</section>}

      <section className="eg-card">
        <div className="eg-filter-row">
          <label>
            Trạng thái
            <select value={statusFilter} onChange={event => updateQueryFilter("status", event.target.value, setStatusFilter)}>
              <option value="all">Tất cả</option>
              <option value="pending">Cần duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
            </select>
          </label>
          <label>
            Loại rác
            <select value={classFilter} onChange={event => setClassFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              {Array.from(new Set(predictions.map(item => item.class))).map(className => <option key={className} value={className}>{getWasteLabel(className)}</option>)}
            </select>
          </label>
          <label>
            Độ tin cậy
            <select aria-label="Độ tin cậy" value={confidenceFilter} onChange={event => updateQueryFilter("confidence", event.target.value, setConfidenceFilter)}>
              <option value="all">Tất cả</option>
              <option value="low">Dưới ngưỡng cảnh báo</option>
            </select>
          </label>
        </div>
        <DataTable columns={columns} rows={visibleRows} emptyText="Chưa có lượt quét phù hợp bộ lọc." />
      </section>
      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
