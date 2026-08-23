import { CheckCircle, Eye, NotePencil, XCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import {
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  getFeedbackPriorityLabel,
  isOpenFeedback,
} from "../data/feedbackConfig";
import { listBins, listFeedback, saveFeedbackItem, updateFeedbackItem, updateFeedbackStatus } from "../services/supabaseStore";

const feedbackDateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không rõ" : feedbackDateFormatter.format(date);
};
const feedbackCategories = ["Thùng đầy", "QR lỗi", "Sai phân loại", "Hư hỏng", "Khác"];

function makeCreateForm(binId = "") {
  return {
    userName: "",
    category: feedbackCategories[0],
    binId,
    priority: "medium",
    message: "",
  };
}

function buildBinMap(bins) {
  return bins.reduce((acc, bin) => {
    acc[bin.id] = bin;
    return acc;
  }, {});
}

function priorityClass(priority) {
  return `eg-priority is-${priority || "medium"}`;
}

function normalizeStatusFilter(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "all" || normalized === "open" || Object.prototype.hasOwnProperty.call(FEEDBACK_STATUSES, normalized)) return normalized;
  return "all";
}

export default function FeedbackPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedback, setFeedback] = useState([]);
  const [bins, setBins] = useState([]);
  const [filters, setFilters] = useState({ status: normalizeStatusFilter(searchParams.get("status")), priority: "all", binId: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState("success");
  const [selected, setSelected] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(() => makeCreateForm());

  const showToast = (message, tone = "success") => {
    setToastTone(tone);
    setToast(message);
  };

  useEffect(() => {
    let active = true;
    async function loadData() {
      setLoading(true);
      const [feedbackResponse, binsResponse] = await Promise.all([listFeedback(), listBins()]);
      if (!active) return;
      setFeedback(feedbackResponse.data);
      setBins(binsResponse.data);
      setError(feedbackResponse.error || binsResponse.error);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const binMap = useMemo(() => buildBinMap(bins), [bins]);
  const rows = useMemo(() => feedback.map(item => ({ ...item, bin: binMap[item.binId] || null })), [feedback, binMap]);
  const filteredRows = useMemo(() => rows.filter(item => {
    const statusMatch = filters.status === "all" || (filters.status === "open" ? isOpenFeedback(item) : item.status === filters.status);
    const priorityMatch = filters.priority === "all" || item.priority === filters.priority;
    const binMatch = filters.binId === "all" || item.binId === filters.binId;
    return statusMatch && priorityMatch && binMatch;
  }), [rows, filters]);

  const updateStatusFilter = value => {
    setFilters(current => ({ ...current, status: value }));
    const next = new URLSearchParams(searchParams);
    if (value === "all") next.delete("status");
    else next.set("status", value);
    setSearchParams(next);
  };

  const counts = useMemo(() => ({
    open: rows.filter(isOpenFeedback).length,
    processing: rows.filter(item => item.status === "in_progress").length,
    resolved: rows.filter(item => item.status === "resolved" || item.status === "read").length,
    high: rows.filter(item => isOpenFeedback(item) && item.priority === "high").length,
  }), [rows]);

  const patchFeedback = async (item, updates, successMessage) => {
    const response = await updateFeedbackItem(item, updates);
    setFeedback(current => current.map(row => row.id === item.id ? response.data : row));
    setError(response.error);
    showToast(successMessage);
    if (selected?.id === item.id) setSelected(response.data);
    return response.data;
  };

  const changeStatus = async (item, status, message) => {
    const response = await updateFeedbackStatus(item, status);
    setFeedback(current => current.map(row => row.id === item.id ? response.data : row));
    setError(response.error);
    showToast(message);
    if (selected?.id === item.id) setSelected(response.data);
  };

  const openDetail = item => {
    setSelected(item);
    setNoteDraft(item.adminNote || "");
  };

  const saveNote = async () => {
    if (!selected) return;
    const updated = await patchFeedback(selected, { adminNote: noteDraft }, "Đã lưu ghi chú phản hồi");
    setSelected({ ...updated, bin: binMap[updated.binId] || null });
  };

  const openCreate = () => {
    setCreateForm(makeCreateForm(bins[0]?.id || ""));
    setCreateOpen(true);
  };

  const updateCreateForm = (field, value) => {
    setCreateForm(current => ({ ...current, [field]: value }));
  };

  const createFeedback = async event => {
    event.preventDefault();
    if (!createForm.message.trim()) {
      showToast("Nhập nội dung phản hồi trước khi lưu", "danger");
      return;
    }
    const response = await saveFeedbackItem({
      ...createForm,
      userName: createForm.userName.trim() || "Admin Eco-loop Campus",
      message: createForm.message.trim(),
      status: "unread",
      adminNote: "",
    });
    setFeedback(current => [response.data, ...current.filter(row => row.id !== response.data.id)]);
    setError(response.error);
    showToast("Đã tạo phản hồi mới");
    setCreateOpen(false);
  };

  const columns = [
    { key: "userName", label: "Người gửi", render: row => <strong>{row.userName}</strong> },
    { key: "category", label: "Loại", render: row => <span className="eg-muted-block">{row.category}</span> },
    {
      key: "bin",
      label: "Thùng liên quan",
      render: row => row.bin ? (
        <div className="eg-bin-cell">
          <strong>{row.bin.name}</strong>
          <span>{row.bin.location}</span>
        </div>
      ) : <span className="eg-muted-block">Chưa gắn thùng</span>,
    },
    {
      key: "priority",
      label: "Ưu tiên",
      render: row => <span className={priorityClass(row.priority)}>{getFeedbackPriorityLabel(row.priority)}</span>,
    },
    { key: "message", label: "Nội dung", render: row => <span className="eg-text-cell">{row.message}</span> },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={row.status}>{FEEDBACK_STATUSES[row.status]}</StatusBadge> },
    { key: "timestamp", label: "Thời gian", render: row => formatDate(row.timestamp) },
    {
      key: "action",
      label: "Thao tác",
      render: row => (
        <div className="eg-table-actions">
          {row.status === "unread" && (
            <button type="button" className="eg-small-btn" aria-label={`Nhận xử lý ${row.id}`} onClick={() => changeStatus(row, "in_progress", "Đã nhận xử lý phản hồi")}>
              <CheckCircle size={15} weight="bold" aria-hidden="true" />
              Nhận xử lý
            </button>
          )}
          {row.status !== "resolved" && (
            <button type="button" className="eg-small-btn success" aria-label={`Hoàn tất ${row.id}`} onClick={() => changeStatus(row, "resolved", "Đã đánh dấu xử lý xong")}>
              <CheckCircle size={15} weight="bold" aria-hidden="true" />
              Hoàn tất
            </button>
          )}
          {row.status !== "rejected" && (
            <button type="button" className="eg-small-btn danger" aria-label={`Từ chối ${row.id}`} onClick={() => changeStatus(row, "rejected", "Đã từ chối phản hồi")}>
              <XCircle size={15} weight="bold" aria-hidden="true" />
              Từ chối
            </button>
          )}
          <button type="button" className="eg-small-btn" aria-label={`Mở chi tiết ${row.id}`} onClick={() => openDetail(row)}>
            <Eye size={15} weight="bold" aria-hidden="true" />
            Chi tiết
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Ý kiến vận hành</span>
          <h1>Phản hồi</h1>
        </div>
        <div className="eg-button-row">
          <button type="button" className="eg-primary-btn" onClick={openCreate}>Tạo phản hồi</button>
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải phản hồi...</section>}
      {error && <section className="eg-alert">Không tải được dữ liệu từ Supabase. Kiểm tra cấu hình hoặc quyền truy cập.</section>}

      <section className="eg-feedback-kpis" aria-label="Tóm tắt phản hồi">
        <article>
          <span>Mở</span>
          <strong>{counts.open}</strong>
        </article>
        <article>
          <span>Đang xử lý</span>
          <strong>{counts.processing}</strong>
        </article>
        <article>
          <span>Đã xử lý</span>
          <strong>{counts.resolved}</strong>
        </article>
        <article className="is-hot">
          <span>Ưu tiên cao</span>
          <strong>{counts.high}</strong>
        </article>
      </section>

      <section className="eg-card">
        <div className="eg-filter-row">
          <label>
            Trạng thái
            <select aria-label="Trạng thái" value={filters.status} onChange={event => updateStatusFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              <option value="open">Chưa xử lý</option>
              {Object.entries(FEEDBACK_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Ưu tiên
            <select value={filters.priority} onChange={event => setFilters(current => ({ ...current, priority: event.target.value }))}>
              <option value="all">Tất cả</option>
              {Object.entries(FEEDBACK_PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Thùng
            <select value={filters.binId} onChange={event => setFilters(current => ({ ...current, binId: event.target.value }))}>
              <option value="all">Tất cả</option>
              {bins.map(bin => <option key={bin.id} value={bin.id}>{bin.name}</option>)}
            </select>
          </label>
        </div>
        <DataTable columns={columns} rows={filteredRows} emptyText="Chưa có phản hồi phù hợp." />
      </section>

      <Modal open={createOpen} title="Tạo phản hồi" onClose={() => setCreateOpen(false)}>
        <form className="eg-form eg-feedback-form" onSubmit={createFeedback}>
          <label>
            Người gửi
            <input value={createForm.userName} onChange={event => updateCreateForm("userName", event.target.value)} placeholder="Admin Eco-loop Campus" />
          </label>
          <label>
            Loại phản hồi
            <select value={createForm.category} onChange={event => updateCreateForm("category", event.target.value)}>
              {feedbackCategories.map(category => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label>
            Thùng liên quan
            <select value={createForm.binId} onChange={event => updateCreateForm("binId", event.target.value)}>
              {bins.map(bin => <option key={bin.id} value={bin.id}>{bin.name}</option>)}
            </select>
          </label>
          <label>
            Mức ưu tiên
            <select value={createForm.priority} onChange={event => updateCreateForm("priority", event.target.value)}>
              {Object.entries(FEEDBACK_PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            Nội dung phản hồi
            <textarea value={createForm.message} onChange={event => updateCreateForm("message", event.target.value)} rows={4} />
          </label>
          <div className="eg-button-row">
            <button type="submit" className="eg-primary-btn">Lưu phản hồi</button>
            <button type="button" className="eg-secondary-btn" onClick={() => setCreateOpen(false)}>Hủy</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(selected)} title="Chi tiết phản hồi" onClose={() => setSelected(null)}>
        {selected && (
          <div className="eg-feedback-detail">
            <div>
              <span>Người gửi</span>
              <strong>{selected.userName}</strong>
            </div>
            <div>
              <span>Thùng liên quan</span>
              <strong>{selected.bin?.name || binMap[selected.binId]?.name || "Chưa gắn thùng"}</strong>
              <small>{selected.bin?.location || binMap[selected.binId]?.location || ""}</small>
            </div>
            <div>
              <span>Nội dung</span>
              <p>{selected.message}</p>
            </div>
            <label>
              Ghi chú xử lý
              <textarea value={noteDraft} onChange={event => setNoteDraft(event.target.value)} rows={4} />
            </label>
            <div className="eg-button-row">
              <button type="button" className="eg-primary-btn" onClick={saveNote}>
                <NotePencil size={17} weight="bold" aria-hidden="true" />
                Lưu ghi chú
              </button>
              <button type="button" className="eg-secondary-btn" onClick={() => setSelected(null)}>Đóng</button>
            </div>
          </div>
        )}
      </Modal>
      <Toast message={toast} tone={toastTone} onClose={() => setToast("")} />
    </div>
  );
}
