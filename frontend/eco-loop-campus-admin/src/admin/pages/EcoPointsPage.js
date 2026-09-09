import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { BIN_GROUPS } from "../data/wasteConfig";
import { buildGroupLeaderboard, buildUserLeaderboard, filterPointHistory } from "../services/ecopointMetrics";
import {
  listPointHistory,
  listPointRules,
  listRecyclingSubmissions,
  listRewards,
  listRewardCategories,
  listRewardRedemptions,
  listRewardRedemptionBatches,
  finalizeRewardRedemptionBatch,
  listUsers,
  deleteRewardCategory,
  saveManualPointHistory,
  savePointRules,
  saveRewardCategory,
  saveRewardProduct,
  updateRewardRedemption,
  updateRecyclingSubmissionReview,
} from "../services/supabaseStore";

const ecoPointDateFormatter = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" });

const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Không rõ" : ecoPointDateFormatter.format(date);
};

const labelCode = value => String(value || "").trim().toLocaleLowerCase("vi-VN");

const cleanLabel = value => String(value || "").trim();

const normalizeLabelFilter = (value, options, fallback = "") => {
  const normalized = labelCode(value);
  if (!normalized) return "";
  return options.find(option => labelCode(option) === normalized) || fallback;
};

const initialManualForm = { userId: "", points: 10, action: "Nộp rác sự kiện xanh" };
const initialRewardCategoryForm = { id: "", name: "", description: "", status: "active", color: "#2F8F5B" };
const initialRewardProductForm = { id: "", title: "", categoryId: "", categoryName: "", costPoints: 100, description: "", status: "active", color: "#2F8F5B" };

const ECOPOINT_TABS = [
  { id: "overview", label: "Tổng quan" },
  { id: "manual", label: "Cộng điểm" },
  { id: "rules", label: "Quy tắc điểm" },
  { id: "catalog", label: "Sản phẩm" },
  { id: "submissions", label: "Gửi rác" },
  { id: "redemptions", label: "Đổi thưởng" },
  { id: "rankings", label: "Xếp hạng" },
];

const SUBMISSION_STATUS_LABELS = {
  CREATED: "Chờ tình nguyện viên",
  QR_SCANNED: "Đã quét QR",
  POINT_CONFIRMED: "Đã cộng điểm",
  PENDING_REVIEW: "Chờ admin kiểm tra",
  REJECTED: "Từ chối",
  EXPIRED: "Hết hạn",
  LOCKED: "Đã khóa",
};

const submissionStatusCode = value => String(value || "").trim().toUpperCase();
const submissionStatusLabel = value => SUBMISSION_STATUS_LABELS[submissionStatusCode(value)] || value || "Không rõ";
const canRejectSubmission = row => !["POINT_CONFIRMED", "REJECTED", "EXPIRED", "LOCKED"].includes(submissionStatusCode(row.status));
const formatSubmissionQuantity = row => {
  const quantity = row.actualQuantity ?? row.quantity;
  const unit = row.wasteTypeUnit ? ` ${row.wasteTypeUnit}` : "";
  return `${quantity}${unit}`;
};

const userSearchText = user => [user.name, user.email, user.studentCode, user.id, user.group].filter(Boolean).join(" ");

function SearchableUserPicker({ label, searchLabel, users, value, query, onQueryChange, onSelect }) {
  const selectedUser = users.find(user => user.id === value);
  const normalizedQuery = labelCode(query);
  const visibleUsers = useMemo(() => {
    const source = normalizedQuery
      ? users.filter(user => labelCode(userSearchText(user)).includes(normalizedQuery))
      : users;
    return source.slice(0, 8);
  }, [normalizedQuery, users]);

  const updateQuery = nextValue => {
    onQueryChange(nextValue);
    const exactUser = users.find(user => {
      const terms = [user.id, user.studentCode, user.email, user.name].map(item => labelCode(item));
      return terms.includes(labelCode(nextValue));
    });
    if (exactUser) onSelect(exactUser);
  };

  return (
    <div className="eg-user-picker">
      <label>
        {label}
        <input
          aria-label={searchLabel}
          type="search"
          value={query}
          onChange={event => updateQuery(event.target.value)}
          placeholder="Tìm theo tên, mã, email"
          autoComplete="off"
        />
      </label>
      {selectedUser && <span className="eg-muted-block">Đã chọn: {selectedUser.name} · {selectedUser.studentCode || selectedUser.email}</span>}
      {query && visibleUsers.length > 0 && (
        <div className="eg-user-picker-list" role="listbox" aria-label={`${label} gợi ý`}>
          {visibleUsers.map(user => (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={user.id === value}
              className="eg-user-picker-option"
              onClick={() => {
                onSelect(user);
                onQueryChange(`${user.name} · ${user.studentCode || user.email}`);
              }}
            >
              <strong>{user.name}</strong>
              <span>{user.studentCode || user.email} · {user.group || "Không rõ"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EcoPointsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [rewardRequests, setRewardRequests] = useState([]);
  const [rewardBatches, setRewardBatches] = useState([]);
  const [rewardProducts, setRewardProducts] = useState([]);
  const [rewardCategories, setRewardCategories] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [manualForm, setManualForm] = useState(initialManualForm);
  const [rewardCategoryForm, setRewardCategoryForm] = useState(initialRewardCategoryForm);
  const [rewardProductForm, setRewardProductForm] = useState(initialRewardProductForm);
  const [manualUserQuery, setManualUserQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState("");
  const [toastTone, setToastTone] = useState("success");
  const [activeTab, setActiveTab] = useState("overview");

  const showToast = (message, tone = "success") => {
    setToastTone(tone);
    setToast(message);
  };

  const loadData = useCallback(async (active = true) => {
      setLoading(true);
      const [rulesResponse, historyResponse, usersResponse, rewardRequestsResponse, rewardProductsResponse, rewardCategoriesResponse, submissionsResponse, rewardBatchesResponse] = await Promise.all([listPointRules(), listPointHistory(), listUsers(), listRewardRedemptions(), listRewards(), listRewardCategories(), listRecyclingSubmissions(), listRewardRedemptionBatches()]);
      if (!active) return;
      setRules(rulesResponse.data);
      setHistory(historyResponse.data);
      setUsers(usersResponse.data);
      setRewardRequests(rewardRequestsResponse.data);
      setRewardBatches(rewardBatchesResponse.data);
      setRewardProducts(rewardProductsResponse.data);
      setRewardCategories(rewardCategoriesResponse.data);
      setSubmissions(submissionsResponse.data);
      setError(rulesResponse.error || historyResponse.error || usersResponse.error || rewardRequestsResponse.error || rewardProductsResponse.error || rewardCategoriesResponse.error || submissionsResponse.error || rewardBatchesResponse.error);
      setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    loadData(active);
    return () => {
      active = false;
    };
  }, [loadData]);

  const refreshData = async () => {
    await loadData(true);
    showToast("Đã tải lại dữ liệu Ecopoint");
  };

  const finalizeBatch = async (batch, status) => {
    const response = await finalizeRewardRedemptionBatch(batch.id, status);
    if (response.error || !response.data) {
      showToast(response.error?.message || "Không thể cập nhật đổi thưởng", "danger");
      return;
    }
    setRewardBatches(current => current.map(item => item.id === batch.id ? { ...item, ...response.data } : item));
    showToast(status === "fulfilled" ? "Đã hoàn tất đổi thưởng" : "Đã hoàn điểm đổi thưởng");
  };

  const userGroups = useMemo(() => Array.from(new Set(users.map(user => String(user.group || "").trim()).filter(Boolean))).sort(), [users]);
  const binGroupOptions = useMemo(() => BIN_GROUPS.map(group => group.label), []);
  const groupQuery = searchParams.get("group") || "";
  const groupFallback = cleanLabel(groupQuery) === groupQuery ? groupQuery : "";

  const filters = {
    dateFrom: searchParams.get("dateFrom") || "",
    dateTo: searchParams.get("dateTo") || "",
    userGroup: normalizeLabelFilter(groupQuery, userGroups, groupFallback),
    binGroup: normalizeLabelFilter(searchParams.get("binGroup"), binGroupOptions),
    userId: searchParams.get("userId") || "",
  };
  const { dateFrom, dateTo, userGroup, binGroup, userId } = filters;

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const visibleUserGroups = userGroup && !userGroups.includes(userGroup) ? [userGroup, ...userGroups] : userGroups;
  const filteredHistory = useMemo(() => filterPointHistory(history, users, { dateFrom, dateTo, userGroup, binGroup, userId }), [history, users, dateFrom, dateTo, userGroup, binGroup, userId]);
  const useProfilePointsForLeaderboard = !(dateFrom || dateTo || binGroup || userId);
  const userLeaderboard = useMemo(() => buildUserLeaderboard(users, filteredHistory, { useProfilePoints: useProfilePointsForLeaderboard, userGroup }).slice(0, 10), [users, filteredHistory, useProfilePointsForLeaderboard, userGroup]);
  const groupLeaderboard = useMemo(() => buildGroupLeaderboard(users, filteredHistory, { useProfilePoints: useProfilePointsForLeaderboard, userGroup }).slice(0, 10), [users, filteredHistory, useProfilePointsForLeaderboard, userGroup]);
  const rewardProductsWithCategories = useMemo(() => rewardProducts.map(product => {
    const category = rewardCategories.find(item => item.id === product.categoryId);
    return { ...product, categoryName: category?.name || product.categoryName || "" };
  }), [rewardProducts, rewardCategories]);

  const updateRule = (id, updates) => {
    setRules(current => current.map(rule => rule.id === id ? { ...rule, ...updates } : rule));
  };

  const saveRules = async () => {
    if (rules.some(rule => !Number.isFinite(Number(rule.points)) || Number(rule.points) < 0)) {
      showToast("Điểm quy tắc không được âm hoặc không hợp lệ", "danger");
      return;
    }
    const response = await savePointRules(rules);
    setRules(response.data);
    setError(response.error);
    showToast("Đã lưu quy tắc điểm");
  };

  const submitManualPoint = async event => {
    event.preventDefault();
    const points = Number(manualForm.points);
    if (!manualForm.userId || !manualForm.action.trim()) {
      showToast("Chọn người nhận và nhập lý do trước khi cộng điểm", "danger");
      return;
    }
    if (!Number.isFinite(points) || points === 0) {
      showToast("Số điểm phải khác 0", "danger");
      return;
    }
    const response = await saveManualPointHistory({
      userId: manualForm.userId,
      points,
      action: manualForm.action.trim(),
      adminNote: manualForm.action.trim(),
    });
    if (response.error || !response.data) {
      setError(response.error);
      showToast(response.error?.message || "Không thể điều chỉnh Ecopoint", "danger");
      return;
    }
    const user = users.find(item => item.id === response.data.userId);
    setHistory(current => [{
      id: response.data.historyId || `manual-${Date.now()}`,
      ...response.data,
      action: manualForm.action.trim(),
      timestamp: new Date().toISOString(),
      source: "manual_adjustment",
      status: "confirmed",
      userName: user?.name || response.data.userId,
      binName: "Chưa gắn thùng",
    }, ...current]);
    setUsers(current => current.map(item => item.id === response.data.userId ? { ...item, points: Number(response.data.balanceAfter ?? (Number(item.points || 0) + Number(response.data.points || 0))) } : item));
    setError(response.error);
    showToast("Đã cộng điểm thủ công");
  };

  const submitRewardCategory = async event => {
    event.preventDefault();
    if (!rewardCategoryForm.name.trim()) {
      showToast("Nhập tên danh mục quà tặng", "danger");
      return;
    }
    const response = await saveRewardCategory(rewardCategoryForm);
    if (!response.data) {
      setError(response.error);
      showToast("Chưa lưu được danh mục quà tặng", "danger");
      return;
    }
    setRewardCategories(current => [response.data, ...current.filter(item => item.id !== response.data.id)].sort((a, b) => a.name.localeCompare(b.name, "vi")));
    setRewardCategoryForm(initialRewardCategoryForm);
    setError(response.error);
    showToast("Đã lưu danh mục quà tặng");
  };

  const submitRewardProduct = async event => {
    event.preventDefault();
    const costPoints = Number(rewardProductForm.costPoints);
    const selectedCategory = rewardCategories.find(category => category.id === rewardProductForm.categoryId);
    if (!rewardProductForm.title.trim()) {
      showToast("Nhập tên sản phẩm đổi thưởng", "danger");
      return;
    }
    if (!Number.isFinite(costPoints) || costPoints < 0) {
      showToast("Điểm cần đổi không hợp lệ", "danger");
      return;
    }
    const response = await saveRewardProduct({ ...rewardProductForm, categoryName: selectedCategory?.name || "", costPoints });
    if (!response.data) {
      setError(response.error);
      showToast("Chưa lưu được sản phẩm đổi thưởng", "danger");
      return;
    }
    setRewardProducts(current => [response.data, ...current.filter(item => item.id !== response.data.id)].sort((a, b) => Number(a.costPoints || 0) - Number(b.costPoints || 0)));
    setRewardProductForm(initialRewardProductForm);
    setError(response.error);
    showToast("Đã lưu sản phẩm đổi thưởng");
  };

  const removeRewardCategory = async row => {
    const response = await deleteRewardCategory(row.id);
    setError(response.error);
    if (response.error) {
      showToast("Chưa xóa được danh mục. Kiểm tra quà tặng đang dùng danh mục này.", "danger");
      return;
    }
    setRewardCategories(current => current.filter(item => item.id !== row.id));
    setRewardProducts(current => current.map(item => item.categoryId === row.id ? { ...item, categoryId: "", categoryName: "" } : item));
    if (rewardCategoryForm.id === row.id) setRewardCategoryForm(initialRewardCategoryForm);
    showToast("Đã xóa danh mục quà tặng");
  };

  const reviewReward = async (reward, status) => {
    const response = await updateRewardRedemption(reward, { status, reviewedAt: new Date().toISOString() });
    setRewardRequests(current => current.map(item => item.id === reward.id ? { ...item, ...response.data } : item));
    setError(response.error);
    showToast(status === "approved" ? "Đã duyệt đổi thưởng" : "Đã từ chối đổi thưởng");
  };

  const rejectRecyclingSubmission = async row => {
    const response = await updateRecyclingSubmissionReview(row, {
      status: "REJECTED",
      volunteerNote: row.volunteerNote || "Admin từ chối sau khi kiểm tra",
    });
    setSubmissions(current => current.map(item => item.id === row.id ? { ...item, ...response.data } : item));
    setError(response.error);
    showToast(response.error ? "Không từ chối được giao dịch gửi rác" : "Đã từ chối giao dịch gửi rác", response.error ? "danger" : "success");
  };

  const historyColumns = [
    { key: "userName", label: "Người dùng", render: row => <strong>{row.userName}</strong> },
    { key: "binName", label: "Trạm", render: row => <div><strong>{row.binName}</strong>{row.binLocation && <span className="eg-muted-block">{row.binLocation}</span>}</div> },
    { key: "action", label: "Hoạt động", render: row => <span className="eg-text-cell">{row.action}</span> },
    { key: "points", label: "Điểm", render: row => <strong>{Number(row.points || 0) > 0 ? `+${row.points}` : row.points}</strong> },
    { key: "timestamp", label: "Thời gian", render: row => formatDate(row.timestamp || row.createdAt) },
  ];

  const userColumns = [
    { key: "rank", label: "Hạng", render: row => <span className="eg-rank-number">{row.rank}</span> },
    { key: "name", label: "Người dùng", render: row => <strong>{row.name}</strong> },
    { key: "group", label: "Lớp/khoa" },
    { key: "totalPoints", label: "Điểm", render: row => <strong>{row.totalPoints}</strong> },
    { key: "scanCount", label: "Lượt cộng" },
  ];

  const groupColumns = [
    { key: "rank", label: "Hạng", render: row => <span className="eg-rank-number">{row.rank}</span> },
    { key: "group", label: "Lớp/khoa", render: row => <strong>{row.group}</strong> },
    { key: "totalPoints", label: "Điểm", render: row => <strong>{row.totalPoints}</strong> },
    { key: "scanCount", label: "Lượt cộng" },
  ];

  const rewardColumns = [
    { key: "userName", label: "Người đổi", render: row => <strong>{row.userName}</strong> },
    { key: "rewardLabel", label: "Phần thưởng" },
    { key: "costPoints", label: "Điểm", render: row => <strong>{row.costPoints}</strong> },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={row.status} /> },
    { key: "requestedAt", label: "Thời gian", render: row => row.requestedAt ? formatDate(row.requestedAt) : "Chưa rõ" },
    {
      key: "actions",
      label: "Thao tác",
      render: row => row.status === "pending" ? (
        <div className="eg-table-actions">
          <button type="button" className="eg-small-btn success" onClick={() => reviewReward(row, "approved")}>Duyệt</button>
          <button type="button" className="eg-small-btn danger" onClick={() => reviewReward(row, "rejected")}>Từ chối</button>
        </div>
      ) : <span className="eg-muted-block">Đã xử lý</span>,
    },
  ];

  const rewardProductColumns = [
    { key: "title", label: "Sản phẩm", render: row => <strong>{row.title}</strong> },
    { key: "categoryName", label: "Danh mục", render: row => row.categoryName || "Chưa phân loại" },
    { key: "description", label: "Mô tả", render: row => <span className="eg-text-cell">{row.description || "Chưa có mô tả"}</span> },
    { key: "costPoints", label: "Điểm cần đổi", render: row => <strong>{row.costPoints}</strong> },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "Thao tác",
      render: row => <button type="button" className="eg-small-btn" onClick={() => setRewardProductForm(row)}>Sửa</button>,
    },
  ];

  const rewardCategoryColumns = [
    { key: "name", label: "Danh mục", render: row => <strong>{row.name}</strong> },
    { key: "description", label: "Mô tả", render: row => <span className="eg-text-cell">{row.description || "Chưa có mô tả"}</span> },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "Thao tác",
      render: row => (
        <div className="eg-table-actions">
          <button type="button" className="eg-small-btn" onClick={() => setRewardCategoryForm(row)}>Sửa</button>
          <button type="button" className="eg-small-btn danger" onClick={() => removeRewardCategory(row)}>Xóa</button>
        </div>
      ),
    },
  ];

  const submissionColumns = [
    { key: "qrToken", label: "QR", render: row => <strong>{row.qrToken}</strong> },
    { key: "userName", label: "Sinh viên", render: row => <div><strong>{row.userName}</strong>{row.userGroup && <span className="eg-muted-block">{row.userGroup}</span>}</div> },
    { key: "binName", label: "Trạm", render: row => <div><strong>{row.binName}</strong>{row.binLocation && <span className="eg-muted-block">{row.binLocation}</span>}</div> },
    { key: "wasteTypeName", label: "Loại rác", render: row => <div><strong>{row.wasteTypeName}</strong><span className="eg-muted-block">{formatSubmissionQuantity(row)}</span></div> },
    { key: "status", label: "Trạng thái", render: row => <StatusBadge status={row.status}>{submissionStatusLabel(row.status)}</StatusBadge> },
    { key: "proof", label: "Minh chứng", render: row => row.proofImageUrl ? <a href={row.proofImageUrl} target="_blank" rel="noreferrer">Xem ảnh</a> : `${row.proofCount || 0} ảnh` },
    { key: "volunteerNote", label: "Ghi chú", render: row => <span className="eg-text-cell">{row.volunteerNote || "-"}</span> },
    {
      key: "actions",
      label: "Thao tác",
      render: row => canRejectSubmission(row) ? (
        <div className="eg-table-actions">
          <button type="button" className="eg-small-btn danger" aria-label={`Từ chối giao dịch ${row.qrToken}`} onClick={() => rejectRecyclingSubmission(row)}>Từ chối</button>
        </div>
      ) : <span className="eg-muted-block">Đã xử lý</span>,
    },
  ];

  const rankedUsers = userLeaderboard.map((row, index) => ({ ...row, rank: index + 1 }));
  const rankedGroups = groupLeaderboard.map((row, index) => ({ ...row, rank: index + 1 }));
  const positiveHistory = filteredHistory.filter(row => Number(row.points || 0) > 0);
  const totalGrantedPoints = positiveHistory.reduce((sum, row) => sum + Number(row.points || 0), 0);
  const pendingSubmissions = submissions.filter(row => canRejectSubmission(row));
  const pendingSubmissionCount = pendingSubmissions.length;
  const pendingRewardCount = rewardRequests.filter(row => row.status === "pending").length + rewardBatches.filter(row => row.status === "pending").length;
  const activeRewardProductCount = rewardProductsWithCategories.filter(row => row.status === "active").length;
  const filterTabs = ["overview", "manual", "rankings"];
  const showFilters = filterTabs.includes(activeTab);

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Cơ chế thưởng cho phân loại đúng</span>
          <h1>Ecopoint</h1>
        </div>
        <div className="eg-button-row">
          <button type="button" className="eg-secondary-btn" onClick={refreshData}>Tải lại dữ liệu</button>
          {activeTab === "rules" && <button type="button" className="eg-primary-btn" onClick={saveRules}>Lưu quy tắc điểm</button>}
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải quy tắc điểm...</section>}
      {error && <section className="eg-alert">Không tải được dữ liệu từ backend PostgreSQL. Kiểm tra cấu hình hoặc quyền truy cập.</section>}

      <nav className="eg-tab-list" role="tablist" aria-label="Khu vực quản lý Ecopoint">
        {ECOPOINT_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? "eg-tab-button is-active" : "eg-tab-button"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {showFilters && (
        <section className="eg-card eg-filter-panel" aria-label="Bộ lọc Ecopoint">
          <label>
            Từ ngày
            <input type="date" value={filters.dateFrom} onChange={event => updateFilter("dateFrom", event.target.value)} />
          </label>
          <label>
            Đến ngày
            <input type="date" value={filters.dateTo} onChange={event => updateFilter("dateTo", event.target.value)} />
          </label>
          <label>
            Lớp/khoa
            <select aria-label="Lớp/khoa" value={filters.userGroup} onChange={event => updateFilter("group", event.target.value)}>
              <option value="">Tất cả</option>
              {visibleUserGroups.map(group => <option key={group} value={group}>{group}</option>)}
            </select>
          </label>
          <label>
            Nhóm rác
            <select value={filters.binGroup} onChange={event => updateFilter("binGroup", event.target.value)}>
              <option value="">Tất cả</option>
              {BIN_GROUPS.map(group => <option key={group.id} value={group.label}>{group.label}</option>)}
            </select>
          </label>
        </section>
      )}

      <div className="eg-tab-panel">
        {activeTab === "overview" && (
          <>
            <div className="eg-stat-grid">
              <article className="eg-stat-card tone-green">
                <div><span>Ecopoint đã cấp</span><strong>{totalGrantedPoints}</strong><small>{positiveHistory.length} lượt cộng theo bộ lọc</small></div>
              </article>
              <article className="eg-stat-card tone-orange">
                <div><span>Giao dịch cần xử lý</span><strong>{pendingSubmissionCount}</strong><small>QR gửi rác còn mở</small></div>
              </article>
              <article className="eg-stat-card">
                <div><span>Đổi thưởng chờ duyệt</span><strong>{pendingRewardCount}</strong><small>Yêu cầu và mã QR quà</small></div>
              </article>
              <article className="eg-stat-card tone-green">
                <div><span>Sản phẩm đang đổi</span><strong>{activeRewardProductCount}</strong><small>{rewardCategories.length} danh mục quà tặng</small></div>
              </article>
            </div>
            <div className="eg-dashboard-grid">
              <section className="eg-card">
                <div className="eg-card-head"><h2>Top sinh viên</h2></div>
                {rankedUsers.length === 0 ? <p className="eg-muted-block">Chưa có điểm theo bộ lọc.</p> : (
                  <div className="eg-ecopoint-rank-list">
                    {rankedUsers.slice(0, 5).map(row => (
                      <div key={row.id || row.name} className="eg-ecopoint-rank-item">
                        <span className="eg-rank-number">{row.rank}</span>
                        <div>
                          <strong>{row.name}</strong>
                          <span>{row.group || "Không rõ lớp/khoa"}</span>
                        </div>
                        <strong>{row.totalPoints}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="eg-card">
                <div className="eg-card-head"><h2>Việc cần xử lý</h2></div>
                {pendingSubmissions.length === 0 ? <p className="eg-muted-block">Không có giao dịch gửi rác cần xử lý.</p> : (
                  <div className="eg-ecopoint-action-list">
                    {pendingSubmissions.slice(0, 5).map(row => (
                      <button key={row.id || row.qrToken} type="button" className="eg-ecopoint-action-item" onClick={() => setActiveTab("submissions")}>
                        <strong>{row.userName}</strong>
                        <span>{row.wasteTypeName || "Chưa rõ loại rác"} · {row.qrToken}</span>
                        <StatusBadge status={row.status}>{submissionStatusLabel(row.status)}</StatusBadge>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        {activeTab === "manual" && (
          <>
            <section className="eg-card">
              <div className="eg-card-head"><h2>Điểm thủ công</h2></div>
              <form className="eg-form eg-inline-form" onSubmit={submitManualPoint}>
                <SearchableUserPicker
                  label="Người nhận điểm"
                  searchLabel="Tìm người nhận điểm"
                  users={users}
                  value={manualForm.userId}
                  query={manualUserQuery}
                  onQueryChange={setManualUserQuery}
                  onSelect={user => setManualForm(current => ({ ...current, userId: user.id }))}
                />
                <label>
                  Số điểm
                  <input aria-label="Số điểm" type="number" value={manualForm.points} onChange={event => setManualForm(current => ({ ...current, points: event.target.value }))} />
                </label>
                <label>
                  Lý do
                  <input aria-label="Lý do" value={manualForm.action} onChange={event => setManualForm(current => ({ ...current, action: event.target.value }))} />
                </label>
                <button type="submit" className="eg-primary-btn">Cộng điểm thủ công</button>
              </form>
            </section>
            <section className="eg-card">
              <div className="eg-card-head"><h2>Lịch sử cộng điểm</h2></div>
              <DataTable columns={historyColumns} rows={filteredHistory} emptyText="Chưa có lịch sử cộng điểm." />
            </section>
          </>
        )}

        {activeTab === "rules" && (
          <div className="eg-rule-grid">
            {rules.map(rule => (
              <section className="eg-card eg-rule-card" key={rule.id}>
                <div className="eg-card-head compact">
                  <div>
                    <h2>{rule.label}</h2>
                    <p>{rule.classKeys.join(", ")}</p>
                  </div>
                  <StatusBadge group={rule.binGroup}>{rule.binGroup}</StatusBadge>
                </div>
                <label>
                  Điểm cho {rule.binGroup}
                  <input type="number" min="0" value={rule.points} onChange={event => updateRule(rule.id, { points: Number(event.target.value) })} />
                </label>
                <label className="eg-switch">
                  <input type="checkbox" checked={rule.enabled} onChange={event => updateRule(rule.id, { enabled: event.target.checked })} />
                  <span>Đang áp dụng</span>
                </label>
              </section>
            ))}
          </div>
        )}

        {activeTab === "catalog" && (
          <section className="eg-card">
            <div className="eg-card-head"><h2>Sản phẩm đổi thưởng</h2></div>
            <form className="eg-form eg-reward-product-form" onSubmit={submitRewardCategory}>
              <label>
                Tên danh mục
                <input aria-label="Tên danh mục quà tặng" value={rewardCategoryForm.name} onChange={event => setRewardCategoryForm(current => ({ ...current, name: event.target.value }))} />
              </label>
              <label>
                Trạng thái danh mục
                <select aria-label="Trạng thái danh mục quà tặng" value={rewardCategoryForm.status} onChange={event => setRewardCategoryForm(current => ({ ...current, status: event.target.value }))}>
                  <option value="active">Đang áp dụng</option>
                  <option value="inactive">Tạm ẩn</option>
                </select>
              </label>
              <label>
                Màu danh mục
                <input aria-label="Màu danh mục quà tặng" type="color" value={rewardCategoryForm.color} onChange={event => setRewardCategoryForm(current => ({ ...current, color: event.target.value }))} />
              </label>
              <label className="eg-wide-field">
                Mô tả danh mục
                <textarea aria-label="Mô tả danh mục quà tặng" rows="2" value={rewardCategoryForm.description} onChange={event => setRewardCategoryForm(current => ({ ...current, description: event.target.value }))} />
              </label>
              <div className="eg-form-actions">
                {rewardCategoryForm.id && <button type="button" className="eg-secondary-btn" onClick={() => setRewardCategoryForm(initialRewardCategoryForm)}>Tạo mới</button>}
                <button type="submit" className="eg-primary-btn">Lưu danh mục quà tặng</button>
              </div>
            </form>
            <DataTable columns={rewardCategoryColumns} rows={rewardCategories} emptyText="Chưa có danh mục quà tặng." />

            <form className="eg-form eg-reward-product-form" onSubmit={submitRewardProduct}>
              <label>
                Tên sản phẩm
                <input aria-label="Tên sản phẩm" value={rewardProductForm.title} onChange={event => setRewardProductForm(current => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                Danh mục
                <select aria-label="Danh mục sản phẩm" value={rewardProductForm.categoryId} onChange={event => setRewardProductForm(current => ({ ...current, categoryId: event.target.value, categoryName: rewardCategories.find(category => category.id === event.target.value)?.name || "" }))}>
                  <option value="">Chưa phân loại</option>
                  {rewardCategories.filter(category => category.status === "active" || category.id === rewardProductForm.categoryId).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label>
                Điểm cần đổi
                <input aria-label="Điểm cần đổi" type="number" min="0" value={rewardProductForm.costPoints} onChange={event => setRewardProductForm(current => ({ ...current, costPoints: event.target.value }))} />
              </label>
              <label>
                Trạng thái
                <select aria-label="Trạng thái sản phẩm" value={rewardProductForm.status} onChange={event => setRewardProductForm(current => ({ ...current, status: event.target.value }))}>
                  <option value="active">Đang áp dụng</option>
                  <option value="inactive">Tạm ẩn</option>
                </select>
              </label>
              <label>
                Màu hiển thị
                <input aria-label="Màu hiển thị" type="color" value={rewardProductForm.color} onChange={event => setRewardProductForm(current => ({ ...current, color: event.target.value }))} />
              </label>
              <label className="eg-wide-field">
                Mô tả sản phẩm
                <textarea aria-label="Mô tả sản phẩm" rows="3" value={rewardProductForm.description} onChange={event => setRewardProductForm(current => ({ ...current, description: event.target.value }))} />
              </label>
              <div className="eg-form-actions">
                {rewardProductForm.id && <button type="button" className="eg-secondary-btn" onClick={() => setRewardProductForm(initialRewardProductForm)}>Tạo mới</button>}
                <button type="submit" className="eg-primary-btn">Lưu sản phẩm đổi thưởng</button>
              </div>
            </form>
            <DataTable columns={rewardProductColumns} rows={rewardProductsWithCategories} emptyText="Chưa có sản phẩm đổi thưởng." />
          </section>
        )}

        {activeTab === "submissions" && (
          <section className="eg-card">
            <div className="eg-card-head">
              <div>
                <h2>Giao dịch gửi rác</h2>
                <p>Theo dõi QR sinh viên, ảnh minh chứng và trạng thái xác minh từ tình nguyện viên.</p>
              </div>
            </div>
            <DataTable columns={submissionColumns} rows={submissions} emptyText="Chưa có giao dịch gửi rác." />
          </section>
        )}

        {activeTab === "redemptions" && (
          <>
            <section className="eg-card">
              <div className="eg-card-head"><h2>Yêu cầu đổi thưởng</h2></div>
              <DataTable columns={rewardColumns} rows={rewardRequests} emptyText="Chưa có yêu cầu đổi thưởng." />
            </section>
            <section className="eg-card">
              <div className="eg-card-head"><h2>Mã QR đổi thưởng</h2></div>
              {rewardBatches.length === 0 ? <p>Chưa có mã QR đổi thưởng.</p> : rewardBatches.map(batch => (
                <div key={batch.id} className="eg-list-row">
                  <div><strong>{batch.id}</strong><p>{batch.items?.map(item => `${item.rewardTitle} x${item.quantity}`).join(', ')}</p></div>
                  <div><StatusBadge group={batch.status}>{batch.status}</StatusBadge><div className="eg-button-row">
                    {batch.status === "fulfilled" && <button type="button" className="eg-secondary-btn" onClick={() => void finalizeBatch(batch, "cancelled")}>Hoàn tác đổi thưởng</button>}
                  </div></div>
                </div>
              ))}
            </section>
          </>
        )}

        {activeTab === "rankings" && (
          <div className="eg-dashboard-grid">
            <section className="eg-card">
              <div className="eg-card-head"><h2>Bảng xếp hạng cá nhân</h2></div>
              <DataTable columns={userColumns} rows={rankedUsers} emptyText="Chưa có điểm theo bộ lọc." />
            </section>
            <section className="eg-card">
              <div className="eg-card-head"><h2>Bảng xếp hạng lớp/khoa</h2></div>
              <DataTable columns={groupColumns} rows={rankedGroups} emptyText="Chưa có lớp/khoa có điểm." />
            </section>
          </div>
        )}
      </div>
      <Toast message={toast} tone={toastTone} onClose={() => setToast("")} />
    </div>
  );
}
