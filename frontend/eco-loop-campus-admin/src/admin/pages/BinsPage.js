import { DownloadSimple, PencilSimple, Plus, QrCode } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { BIN_GROUPS } from "../data/wasteConfig";
import { applyBinRealtimeChange, buildStationQrCode, buildStationQrPayload, listBins, saveBin, subscribeBins, updateBinStatus } from "../services/supabaseStore";

const emptyForm = {
  id: "",
  name: "",
  binGroup: "Tái chế",
  location: "",
  building: "",
  floor: "1",
  qrCode: "",
  status: "active",
  capacity: 0,
  mapX: "",
  mapY: "",
};

function normalizeNumber(value, fallback = null) {
  if (value === "" || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePercent(value, fallback = null) {
  const parsed = normalizeNumber(value, fallback);
  if (parsed === null || parsed === undefined) return parsed;
  return Math.max(0, Math.min(100, parsed));
}

function statusCode(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeStatusFilter(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["all", "attention", "active", "full", "maintenance"].includes(normalized) ? normalized : "all";
}

function toForm(bin) {
  return {
    id: bin.id || "",
    name: bin.name || "",
    binGroup: bin.binGroup || "Tái chế",
    location: bin.location || "",
    building: bin.building || "",
    floor: bin.floor || "1",
    qrCode: bin.qrCode || "",
    status: statusCode(bin.status) || "active",
    capacity: normalizePercent(bin.capacity, 0),
    mapX: bin.mapX ?? "",
    mapY: bin.mapY ?? "",
  };
}

function buildScanLink(binId) {
  return `#/ai-test?binId=${encodeURIComponent(binId)}`;
}

function needsAttention(bin) {
  const status = statusCode(bin.status);
  return status === "maintenance" || status === "full" || Number(bin.capacity || 0) >= 85;
}

function needsCollection(bin) {
  return statusCode(bin.status) === "full" || Number(bin.capacity || 0) >= 85;
}

export default function BinsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bins, setBins] = useState([]);
  const [statusFilter, setStatusFilter] = useState(() => normalizeStatusFilter(searchParams.get("status")));
  const [selectedQr, setSelectedQr] = useState(null);
  const [editingBin, setEditingBin] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState("success");

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      const response = await listBins();
      if (!active) return;
      setBins(response.data);
      setError(response.error);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeBins(payload => {
      setBins(current => applyBinRealtimeChange(current, payload));
      setError(null);
    });
    return unsubscribe;
  }, []);

  const toggleStatus = async bin => {
    const nextStatus = statusCode(bin.status) === "maintenance" ? "active" : "maintenance";
    const response = await updateBinStatus(bin, nextStatus);
    if (!response.data) {
      setError(response.error);
      setToastTone("danger");
      setToast("Không cập nhật được trạng thái thùng.");
      return;
    }
    setBins(current => current.map(item => item.id === bin.id ? response.data : item));
    setError(response.error);
    setToastTone("success");
    setToast("Đã cập nhật trạng thái thùng");
  };

  const openCreateForm = () => {
    setEditingBin({ mode: "create" });
    setForm(emptyForm);
  };

  const openEditForm = bin => {
    setEditingBin(bin);
    setForm(toForm(bin));
  };

  const closeForm = () => {
    setEditingBin(null);
    setForm(emptyForm);
  };

  const updateForm = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const pickMapPosition = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    updateForm("mapX", normalizePercent(((event.clientX - rect.left) / rect.width) * 100, 0).toFixed(1));
    updateForm("mapY", normalizePercent(((event.clientY - rect.top) / rect.height) * 100, 0).toFixed(1));
  };

  const dragMapMarker = event => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    const move = pointer => {
      updateForm("mapX", normalizePercent(((pointer.clientX - rect.left) / rect.width) * 100, 0).toFixed(1));
      updateForm("mapY", normalizePercent(((pointer.clientY - rect.top) / rect.height) * 100, 0).toFixed(1));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const submitForm = async event => {
    event.preventDefault();
    const id = form.id.trim();
    const payload = {
      id,
      name: form.name.trim(),
      binGroup: form.binGroup,
      location: form.location.trim(),
      building: form.building.trim(),
      floor: form.floor.trim(),
      qrCode: buildStationQrCode(form.qrCode || id || form.name),
      status: statusCode(form.status) || "active",
      capacity: normalizePercent(form.capacity, 0),
      mapX: normalizePercent(form.mapX),
      mapY: normalizePercent(form.mapY),
    };

    if (!payload.id || !payload.name || !payload.location) {
      setToastTone("danger");
      setToast("Nhập đầy đủ mã thùng, tên trạm và vị trí trước khi lưu.");
      return;
    }

    if (editingBin?.mode === "create" && bins.some(bin => String(bin.id || "").trim().toLowerCase() === id.toLowerCase())) {
      setToastTone("danger");
      setToast("Mã thùng đã tồn tại. Chọn mã khác trước khi lưu.");
      return;
    }
    if (payload.qrCode && bins.some(bin => bin.id !== id && String(bin.qrCode || "").trim().toLowerCase() === payload.qrCode.toLowerCase())) {
      setToastTone("danger");
      setToast("Mã QR đã tồn tại. Chọn mã QR khác trước khi lưu.");
      return;
    }

    setSaving(true);
    const response = await saveBin(payload);
    if (!response.data) {
      setError(response.error);
      setSaving(false);
      setToastTone("danger");
      setToast("Không lưu được trạm. Kiểm tra backend PostgreSQL và thử lại.");
      return;
    }
    setBins(current => [response.data, ...current.filter(item => item.id !== response.data.id)]);
    setError(response.error);
    setSaving(false);
    closeForm();
    setToastTone("success");
    setToast(editingBin?.mode === "create" ? "Đã thêm trạm QR" : "Đã cập nhật trạm QR");
  };

  const visibleBins = useMemo(() => bins.filter(bin => {
    if (statusFilter === "all") return true;
    if (statusFilter === "attention") return needsAttention(bin);
    return statusCode(bin.status) === statusFilter;
  }), [bins, statusFilter]);

  const updateStatusFilter = value => {
    const nextValue = normalizeStatusFilter(value);
    setStatusFilter(nextValue);
    const next = new URLSearchParams(searchParams);
    if (nextValue === "all") next.delete("status");
    else next.set("status", nextValue);
    setSearchParams(next);
  };

  const columns = [
    { key: "name", label: "Trạm / Thùng", render: row => <div><strong>{row.name}</strong><span className="eg-muted-block">{row.id}</span></div> },
    { key: "binGroup", label: "Nhóm", render: row => <StatusBadge group={row.binGroup}>{row.binGroup}</StatusBadge> },
    { key: "location", label: "Vị trí" },
    {
      key: "capacity",
      label: "Đầy",
      render: row => (
        <div className={`eg-progress ${needsCollection(row) ? "is-warning" : ""}`}>
          <span style={{ width: `${normalizePercent(row.capacity, 0)}%` }} />
          <strong>{normalizePercent(row.capacity, 0)}%</strong>
          {needsCollection(row) && <em>Cần thu gom</em>}
        </div>
      ),
    },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "Thao tác",
      render: row => (
        <div className="eg-table-actions">
          <button type="button" className="eg-small-btn" aria-label={`QR ${row.id}`} onClick={() => setSelectedQr(row)}><QrCode size={15} weight="bold" aria-hidden="true" /> QR</button>
          <button type="button" className="eg-small-btn" aria-label={`Sửa ${row.id}`} onClick={() => openEditForm(row)}><PencilSimple size={15} weight="bold" aria-hidden="true" /> Sửa</button>
          <button type="button" className="eg-small-btn" onClick={() => toggleStatus(row)}>{statusCode(row.status) === "maintenance" ? "Hoạt động" : "Bảo trì"}</button>
        </div>
      ),
    },
  ];

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Điểm thu gom trong khuôn viên</span>
          <h1>Thùng rác / Trạm QR</h1>
        </div>
        <button type="button" className="eg-primary-btn" onClick={openCreateForm}><Plus size={17} weight="bold" aria-hidden="true" /> Thêm trạm</button>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải thùng rác...</section>}
      {error && <section className="eg-alert">Không tải được dữ liệu từ backend PostgreSQL. Kiểm tra cấu hình hoặc quyền truy cập.</section>}

      <section className="eg-card">
        <div className="eg-filter-row">
          <label>
            Trạng thái
            <select aria-label="Trạng thái" value={statusFilter} onChange={event => updateStatusFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              <option value="attention">Cần kiểm tra</option>
              <option value="active">Hoạt động</option>
              <option value="full">Đầy</option>
              <option value="maintenance">Bảo trì</option>
            </select>
          </label>
        </div>
        <DataTable columns={columns} rows={visibleBins} emptyText="Chưa có trạm thu gom." />
      </section>

      <Modal open={Boolean(selectedQr)} title="Mã QR trạm" onClose={() => setSelectedQr(null)}>
        {selectedQr && (
          <div className="eg-qr-box">
            <div className="eg-qr-preview" aria-label={`Mã QR trạm ${selectedQr.id}`}>
              <QRCodeSVG value={buildStationQrPayload(selectedQr)} size={180} level="M" includeMargin />
            </div>
            <strong className="eg-qr-code-text">{selectedQr.qrCode}</strong>
            <p>{selectedQr.name}</p>
            <span>{selectedQr.location}</span>
            <code>{buildStationQrPayload(selectedQr)}</code>
            <a className="eg-secondary-btn" href={buildScanLink(selectedQr.id)}>
              <DownloadSimple size={16} weight="bold" aria-hidden="true" /> Mở kiểm thử AI
            </a>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(editingBin)} title={editingBin?.mode === "create" ? "Thêm trạm QR" : "Sửa trạm QR"} onClose={closeForm}>
        <form className="eg-form eg-bin-form" onSubmit={submitForm}>
          <label>Mã thùng<input required value={form.id} disabled={editingBin?.mode !== "create"} onChange={event => updateForm("id", event.target.value)} placeholder="BIN-A1-RECYCLE" /></label>
          <label>Tên trạm<input required value={form.name} onChange={event => updateForm("name", event.target.value)} placeholder="Thùng tái chế A1" /></label>
          <label>Nhóm rác<select value={form.binGroup} onChange={event => updateForm("binGroup", event.target.value)}>{BIN_GROUPS.map(group => <option key={group.id} value={group.label}>{group.label}</option>)}</select></label>
          <label>Vị trí<input required value={form.location} onChange={event => updateForm("location", event.target.value)} placeholder="Nhà A1 - tầng 1" /></label>
          <label>Tòa nhà<input value={form.building} onChange={event => updateForm("building", event.target.value)} placeholder="A1" /></label>
          <label>Tầng<input value={form.floor} onChange={event => updateForm("floor", event.target.value)} placeholder="1" /></label>
          <label>Mã QR chuẩn<input value={buildStationQrCode(form.qrCode || form.id || form.name)} readOnly /></label>
          <button type="button" className="eg-secondary-btn" onClick={() => updateForm("qrCode", buildStationQrCode(`${form.id || form.name}-${Date.now().toString().slice(-6)}`))}>Tạo lại mã QR</button>
          <label>Sức chứa<input type="number" min="0" max="100" value={form.capacity} onChange={event => updateForm("capacity", event.target.value)} /></label>
          <label>Trạng thái<select value={form.status} onChange={event => updateForm("status", event.target.value)}><option value="active">Hoạt động</option><option value="full">Đầy</option><option value="maintenance">Bảo trì</option></select></label>
           <label>Tọa độ X<input type="number" min="0" max="100" step="0.1" value={form.mapX} onChange={event => updateForm("mapX", event.target.value)} placeholder="30" /></label>
           <label>Tọa độ Y<input type="number" min="0" max="100" step="0.1" value={form.mapY} onChange={event => updateForm("mapY", event.target.value)} placeholder="78" /></label>
           <div className="eg-map-picker" role="application" aria-label="Bản đồ chọn thùng" onPointerDown={pickMapPosition}>
             <span className="eg-map-picker-label">Bấm hoặc kéo marker để chọn vị trí</span>
             {form.mapX !== "" && form.mapY !== "" && <button type="button" className="eg-map-marker" style={{ left: `${normalizePercent(form.mapX, 0)}%`, top: `${normalizePercent(form.mapY, 0)}%` }} onPointerDown={dragMapMarker} aria-label="Kéo marker thùng">+</button>}
           </div>
          <div className="eg-form-actions">
            <button type="button" className="eg-secondary-btn" onClick={closeForm}>Hủy</button>
            <button type="submit" className="eg-primary-btn" disabled={saving}>{saving ? "Đang lưu..." : "Lưu trạm"}</button>
          </div>
        </form>
      </Modal>
      <Toast message={toast} tone={toastTone} onClose={() => setToast("")} />
    </div>
  );
}
