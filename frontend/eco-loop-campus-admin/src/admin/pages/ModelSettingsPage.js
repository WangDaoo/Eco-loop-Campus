import { useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { WASTE_CLASSES } from "../data/wasteConfig";
import { getModelSettings, saveModelThreshold } from "../services/supabaseStore";

export default function ModelSettingsPage() {
  const [threshold, setThreshold] = useState(0.65);
  const [settings, setSettings] = useState({ modelName: "MobileNetV2", classCount: WASTE_CLASSES.length });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      const response = await getModelSettings();
      if (!active) return;
      setSettings(response.data);
      setThreshold(response.data.threshold || 0.65);
      setError(response.error);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const saveThreshold = async () => {
    const response = await saveModelThreshold(threshold);
    setSettings(response.data);
    setError(response.error);
    setToast("Đã lưu cài đặt model");
  };

  const columns = [
    { key: "key", label: "Class key" },
    { key: "label", label: "Tên hiển thị" },
    { key: "binGroup", label: "Nhóm thùng", render: row => <StatusBadge group={row.binGroup}>{row.binGroup}</StatusBadge> },
  ];

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>{settings.modelName || "MobileNetV2"} hiện tại</span>
          <h1>Cài đặt model</h1>
        </div>
        <div className="eg-button-row">
          <button type="button" className="eg-primary-btn" onClick={saveThreshold}>Lưu cài đặt</button>
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải cài đặt model...</section>}
      {error && <section className="eg-alert">Không tải được dữ liệu từ backend PostgreSQL. Kiểm tra cấu hình hoặc quyền truy cập.</section>}

      <div className="eg-two-col model-grid">
        <section className="eg-card">
          <div className="eg-model-summary">
            <span>Model</span>
            <h2>{settings.modelName || "MobileNetV2"}</h2>
            <p>{settings.classCount || WASTE_CLASSES.length} lớp AI được gom thành 4 nhóm thùng phù hợp phạm vi trường học.</p>
          </div>
          <label className="eg-range-field">
            Ngưỡng cảnh báo confidence: {Math.round(threshold * 100)}%
            <input type="range" min="0.3" max="0.95" step="0.05" value={threshold} onChange={event => setThreshold(Number(event.target.value))} />
          </label>
        </section>
        <section className="eg-card">
          <div className="eg-card-head"><h2>Mapping phân loại</h2></div>
          <DataTable columns={columns} rows={WASTE_CLASSES} />
        </section>
      </div>
      <Toast message={toast} onClose={() => setToast("")} />
    </div>
  );
}
