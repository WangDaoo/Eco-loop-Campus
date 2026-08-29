import { useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import Toast from "../components/Toast";
import { listAvatarPresets, saveAvatarPreset, uploadAvatarPresetImage } from "../services/supabaseStore";

const initialForm = {
  key: "",
  label: "",
  imageUrl: "",
  background: "#cbf9e4",
  tile: "#a8f2ab",
  accent: "#8bc34a",
  face: "#2c6e6e",
  status: "active",
  sortOrder: 1,
};

function previewStyle(row) {
  return {
    "--avatar-bg": row.background || "#cbf9e4",
    "--avatar-tile": row.tile || "#a8f2ab",
    "--avatar-accent": row.accent || "#8bc34a",
    "--avatar-face": row.face || "#2c6e6e",
  };
}

function AvatarPreview({ row, size = "md" }) {
  return (
    <span className={`eg-avatar-preset-preview is-${size}`} style={previewStyle(row)}>
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
      const maxSort = response.data.reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), 0);
      setForm(current => ({ ...current, sortOrder: maxSort + 1 }));
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const updateForm = updates => setForm(current => ({ ...current, ...updates }));

  const resetForm = () => {
    const maxSort = items.reduce((max, item) => Math.max(max, Number(item.sortOrder || 0)), 0);
    setForm({ ...initialForm, sortOrder: maxSort + 1 });
  };

  const handleFile = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const response = await uploadAvatarPresetImage(file, form.key || form.label || "avatar-presets");
    setSaving(false);
    setError(response.error);
    if (!response.data?.imageUrl) {
      showToast(response.error?.message || "Chưa upload được ảnh avatar lên máy chủ", "danger");
      return;
    }
    updateForm({ imageUrl: response.data.imageUrl });
    showToast("Đã upload ảnh avatar");
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
    if (!form.imageUrl) {
      showToast("Chọn ảnh trước khi lưu", "danger");
      return;
    }
    setSaving(true);
    const response = await saveAvatarPreset({ ...form, sortOrder: Number(form.sortOrder || 0) });
    setSaving(false);
    setError(response.error);
    if (!response.data) {
      showToast("Chưa lưu được avatar", "danger");
      return;
    }
    setItems(current => [response.data, ...current.filter(item => item.key !== response.data.key)].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)));
    setForm(current => ({ ...initialForm, sortOrder: Number(current.sortOrder || 0) + 1 }));
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
      {error && <section className="eg-alert">Không tải được dữ liệu từ Supabase. Kiểm tra cấu hình hoặc quyền truy cập.</section>}

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
