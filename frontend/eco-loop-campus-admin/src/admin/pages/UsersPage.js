import { useEffect, useMemo, useState } from "react";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { listUsers, saveUser, updateUserStatus } from "../services/supabaseStore";

const ROLE_OPTIONS = [
  { value: "student", label: "Sinh viên", prefix: "SV", aliases: ["student", "sinh viên", "sinh vien"] },
  { value: "teacher", label: "Giáo viên", prefix: "GV", aliases: ["teacher", "giáo viên", "giao vien"] },
  { value: "volunteer", label: "Tình nguyện viên", prefix: "TN", aliases: ["volunteer", "tình nguyện viên", "tinh nguyen vien"] },
  { value: "admin", label: "Admin", prefix: "AD", aliases: ["admin", "quản trị", "quan tri"] },
];

const emptyForm = { name: "", email: "", role: "student", group: "CNTT K18" };

function roleCode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ROLE_OPTIONS.find(option => option.aliases.includes(normalized))?.value || normalized;
}

function roleLabel(value) {
  const code = roleCode(value);
  return ROLE_OPTIONS.find(option => option.value === code)?.label || value || "Không rõ";
}

function pointValue(value) {
  const points = Number(value);
  return Number.isFinite(points) ? points : 0;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function statusCode(value) {
  const normalized = String(value || "active").trim().toLowerCase();
  return ["active", "locked", "pending", "rejected"].includes(normalized) ? normalized : "active";
}

function groupLabel(value) {
  return String(value || "").trim();
}

function groupCode(value) {
  return groupLabel(value).toLocaleLowerCase("vi-VN");
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
      const response = await listUsers();
      if (!active) return;
      setUsers(response.data);
      setError(response.error);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const groupOptions = useMemo(() => Array.from(new Map(users
    .map(user => groupLabel(user.group))
    .filter(Boolean)
    .map(group => [groupCode(group), group])).values()).sort((a, b) => a.localeCompare(b, "vi-VN")), [users]);

  const filteredUsers = useMemo(() => users.filter(user => {
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery = `${user.id} ${user.name} ${user.email} ${user.group}`.toLowerCase().includes(normalizedQuery);
    const matchesRole = role === "all" || roleCode(user.role) === role;
    const matchesStatus = status === "all" || statusCode(user.status) === status;
    const matchesGroup = groupFilter === "all" || groupCode(user.group) === groupCode(groupFilter);
    return matchesQuery && matchesRole && matchesStatus && matchesGroup;
  }), [groupFilter, query, role, status, users]);

  const openEditModal = user => {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      role: roleCode(user.role) || "student",
      group: user.group || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
  };

  const changeUserStatus = async (user, nextStatus, message = "Đã cập nhật trạng thái người dùng") => {
    const response = await updateUserStatus(user, nextStatus);
    setUsers(current => current.map(item => item.id === user.id ? response.data : item));
    setError(response.error);
    showToast(message);
  };

  const lockUser = async user => {
    const nextStatus = statusCode(user.status) === "locked" ? "active" : "locked";
    await changeUserStatus(user, nextStatus);
  };

  const approveUser = async user => {
    await changeUserStatus(user, "active", "Đã duyệt tài khoản tình nguyện viên");
  };

  const rejectUser = async user => {
    await changeUserStatus(user, "rejected", "Đã từ chối yêu cầu cấp quyền");
  };

  const saveUserForm = async event => {
    event.preventDefault();
    const normalizedForm = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      group: form.group.trim(),
    };
    if (!normalizedForm.name || !normalizedForm.email) {
      showToast("Nhập họ tên và email trước khi lưu", "danger");
      return;
    }
    if (!isValidEmail(normalizedForm.email)) {
      showToast("Email không hợp lệ", "danger");
      return;
    }
    if (users.some(user => user.id !== editingUser?.id && (user.email || "").trim().toLowerCase() === normalizedForm.email.toLowerCase())) {
      showToast("Email đã tồn tại trong danh sách người dùng", "danger");
      return;
    }
    if (!editingUser) {
      showToast("Không tạo hồ sơ thủ công trên web. Người dùng cần đăng ký trong app hoặc được tạo qua Supabase Auth.", "danger");
      return;
    }
    const nextUser = {
      ...editingUser,
      ...normalizedForm,
      id: editingUser.id,
      points: pointValue(editingUser.points),
      status: statusCode(editingUser.status),
    };
    const response = await saveUser(nextUser);
    setUsers(current => current.map(user => user.id === response.data.id ? response.data : user));
    setError(response.error);
    closeModal();
    showToast("Đã cập nhật người dùng");
  };

  const columns = [
    { key: "name", label: "Người dùng", render: row => <div><strong>{row.name}</strong><span className="eg-muted-block">{row.email}</span></div> },
    { key: "role", label: "Vai trò", render: row => roleLabel(row.role) },
    { key: "group", label: "Lớp / Khoa", render: row => groupLabel(row.group) || "Không rõ" },
    { key: "points", label: "Điểm", render: row => <strong>{pointValue(row.points)}</strong> },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={statusCode(row.status)} /> },
    {
      key: "action",
      label: "Thao tác",
      render: row => {
        const currentStatus = statusCode(row.status);
        if (currentStatus === "pending") {
          return (
            <div className="eg-button-row">
              <button type="button" className="eg-small-btn" onClick={() => approveUser(row)}>Duyệt</button>
              <button type="button" className="eg-small-btn" onClick={() => rejectUser(row)}>Từ chối</button>
            </div>
          );
        }
        return (
          <div className="eg-button-row">
            <button type="button" className="eg-small-btn" aria-label={`Sửa ${row.id}`} onClick={() => openEditModal(row)}>Sửa</button>
            {currentStatus === "rejected" && <button type="button" className="eg-small-btn" onClick={() => approveUser(row)}>Duyệt lại</button>}
            <button type="button" className="eg-small-btn" onClick={() => lockUser(row)}>{currentStatus === "locked" ? "Mở khóa" : "Khóa"}</button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Tài khoản và nhóm học tập</span>
          <h1>Người dùng / Lớp / Khoa</h1>
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải người dùng...</section>}
      {error && <section className="eg-alert">Không tải được dữ liệu từ Supabase. Kiểm tra cấu hình hoặc quyền truy cập.</section>}

      <section className="eg-card">
        <div className="eg-filter-row">
          <label>
            Tìm kiếm
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Mã, tên, email, lớp" />
          </label>
          <label>
            Vai trò
            <select value={role} onChange={event => setRole(event.target.value)}>
              <option value="all">Tất cả</option>
              {ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Trạng thái
            <select value={status} onChange={event => setStatus(event.target.value)}>
              <option value="all">Tất cả</option>
              <option value="active">Đang hoạt động</option>
              <option value="pending">Chờ duyệt</option>
              <option value="rejected">Từ chối</option>
              <option value="locked">Đã khóa</option>
            </select>
          </label>
          <label>
            Lớp / Khoa
            <select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              {groupOptions.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
        </div>
        <DataTable columns={columns} rows={filteredUsers} emptyText="Chưa có người dùng." />
      </section>

      <Modal open={modalOpen} title="Sửa người dùng" onClose={closeModal}>
        <form className="eg-form" onSubmit={saveUserForm}>
          <label>Họ tên<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
          <label>Email<input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /></label>
          <label>Vai trò<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <label>Lớp / Khoa<input value={form.group} onChange={event => setForm({ ...form, group: event.target.value })} /></label>
          <button type="submit" className="eg-primary-btn">Lưu thay đổi</button>
        </form>
      </Modal>
      <Toast message={toast} tone={toastTone} onClose={() => setToast("")} />
    </div>
  );
}
