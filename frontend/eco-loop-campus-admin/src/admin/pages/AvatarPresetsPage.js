import { useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import Toast from "../components/Toast";
import { listAvatarPresets, saveAvatarPreset } from "../services/backendAvatarStore";

const initialForm = {
  key: "",
  label: "",
  imageUrl: "",
};

function AvatarPreview({ row, size = "md" }) {
  return (
    <span className={`eg-avatar-preset-preview is-${size}`}>
      {row.imageUrl ? <img src={row.imageUrl} alt="" /> : <span className="eg-avatar-face" />}
    </span>
  );
}

export default function AvatarPresetsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState("success");
  const [selectedFile, setSelectedFile] = useState(null);

  const showToast = (message, tone = "success") => {
    setToastTone(tone);
    setToast(message);
  };

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      const response = await listAvatarPresets();
      if (!active) return;
      setItems(response.data);
      setError(response.error);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const updateForm = updates => setForm(current => ({ ...current, ...updates }));

  const resetForm = () => {
    setForm(initialForm);
    setSelectedFile(null);
  };

  const handleFile = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    updateForm({ imageUrl: URL.createObjectURL(file) });
  };

  const submitForm = async event => {
    event.preventDefault();
    if (!form.label.trim()) {
      showToast("Nhập tên avatar trước khi lưu", "danger");
      return;
    }
    if (!form.key.trim()) {
      showToast("Nhập mã avatar trước khi lưu", "danger");
      return;
    }
    if (!selectedFile) {
      showToast("Chọn ảnh trước khi lưu", "danger");
      return;
    }
    setSaving(true);
    const response = await saveAvatarPreset({ key: form.key, label: form.label, file: selectedFile });
    setSaving(false);
    setError(response.error);
    if (!response.data) {
      showToast(response.error?.message || "Chưa lưu được avatar lên backend", "danger");
      return;
    }
    setItems(current => [response.data, ...current.filter(item => item.key !== response.data.key)].sort((a, b) => a.label.localeCompare(b.label, "vi")));
    setForm(initialForm);
    setSelectedFile(null);
    showToast("Đã lưu avatar");
  };

  const columns = [
    { key: "preview", label: "Avatar", render: row => <AvatarPreview row={row} /> },
    { key: "key", label: "Mã avatar" },
    { key: "label", label: "Tên avatar", render: row => <strong>{row.label}</strong> },
    { key: "imageUrl", label: "Ảnh", render: row => row.imageUrl ? <a href={row.imageUrl} target="_blank" rel="noreferrer">Mở ảnh</a> : <span className="eg-muted-block">Chưa có ảnh</span> },
  ];

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Danh mục ảnh đại diện</span>
          <h1>Avatar</h1>
        </div>
        <div className="eg-button-row">
          <button type="button" className="eg-secondary-btn" onClick={resetForm}>Tạo mới</button>
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải avatar...</section>}
      {error && <section className="eg-alert">Không tải được dữ liệu avatar từ backend PostgreSQL. Kiểm tra backend và DATABASE_URL.</section>}

      <section className="eg-command-panel eg-avatar-command">
        <div>
          <h2>Avatar dùng chung cho sinh viên</h2>
          <p>Admin upload ảnh và đặt tên ảnh. Sinh viên chỉ chọn trong danh mục avatar đã lưu trên máy chủ.</p>
        </div>
        <div className="eg-command-metrics">
          <article><span>Tổng ảnh</span><strong>{items.length}</strong></article>
        </div>
      </section>

      <section className="eg-card">
        <div className="eg-card-head"><h2>Thêm avatar</h2></div>
        <form className="eg-form eg-avatar-form" onSubmit={submitForm}>
          <div className="eg-avatar-form-preview">
            <AvatarPreview row={form} size="lg" />
          </div>
          <label>
            Mã avatar
            <input required value={form.key} onChange={event => updateForm({ key: event.target.value })} placeholder="mam-xanh" />
          </label>
          <label>
            Tên avatar
            <input required value={form.label} onChange={event => updateForm({ label: event.target.value })} placeholder="Mầm xanh" />
          </label>
          <label>
            Upload ảnh
            <input type="file" accept="image/*" onChange={handleFile} disabled={saving} />
          </label>
          <div className="eg-form-actions">
            <button type="submit" className="eg-primary-btn" disabled={saving}>{saving ? "Đang lưu..." : "Lưu avatar"}</button>
          </div>
        </form>
      </section>

      <section className="eg-card">
        <div className="eg-card-head"><h2>Danh sách avatar</h2></div>
        <DataTable columns={columns} rows={items} emptyText="Chưa có avatar preset." />
      </section>
      <Toast message={toast} tone={toastTone} onClose={() => setToast("")} />
    </div>
  );
}
