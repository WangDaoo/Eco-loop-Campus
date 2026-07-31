import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DataTable from "../components/DataTable";
import StatusBadge from "../components/StatusBadge";
import Toast from "../components/Toast";
import { BIN_GROUPS } from "../data/wasteConfig";
import { buildGroupLeaderboard, buildUserLeaderboard, filterPointHistory } from "../services/ecopointMetrics";
import {
  listPointHistory,
  listPointRules,
  listRewardRedemptions,
  listUsers,
  saveManualPointHistory,
  savePointRules,
  saveRewardRedemption,
  sourceText,
  updateRewardRedemption,
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

const REWARD_OPTIONS = [
  { label: "Voucher căn tin 100 điểm", points: 100 },
  { label: "Giấy chứng nhận xanh 300 điểm", points: 300 },
  { label: "Quà học kỳ xanh 500 điểm", points: 500 },
];

const initialManualForm = { userId: "", points: 10, action: "Nộp rác sự kiện xanh" };
const initialRewardForm = { userId: "", rewardLabel: REWARD_OPTIONS[0].label };

export default function EcoPointsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rules, setRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [manualForm, setManualForm] = useState(initialManualForm);
  const [rewardForm, setRewardForm] = useState(initialRewardForm);
  const [source, setSource] = useState(null);
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
      const [rulesResponse, historyResponse, usersResponse, rewardsResponse] = await Promise.all([listPointRules(), listPointHistory(), listUsers(), listRewardRedemptions()]);
      if (!active) return;
      setRules(rulesResponse.data);
      setHistory(historyResponse.data);
      setUsers(usersResponse.data);
      setRewards(rewardsResponse.data);
      setSource([rulesResponse, historyResponse, usersResponse, rewardsResponse].some(item => item.source === "local") ? "local" : rulesResponse.source);
      setError(rulesResponse.error || historyResponse.error || usersResponse.error || rewardsResponse.error);
      setLoading(false);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

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

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  };

  const visibleUserGroups = filters.userGroup && !userGroups.includes(filters.userGroup) ? [filters.userGroup, ...userGroups] : userGroups;
  const filteredHistory = useMemo(() => filterPointHistory(history, users, filters), [history, users, filters.dateFrom, filters.dateTo, filters.userGroup, filters.binGroup, filters.userId]);
  const userLeaderboard = useMemo(() => buildUserLeaderboard(users, filteredHistory).slice(0, 10), [users, filteredHistory]);
  const groupLeaderboard = useMemo(() => buildGroupLeaderboard(users, filteredHistory).slice(0, 10), [users, filteredHistory]);

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
    setSource(response.source);
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
    const user = users.find(item => item.id === response.data.userId);
    setHistory(current => [{ ...response.data, userName: user?.name || response.data.userId, binName: "Điều chỉnh thủ công" }, ...current]);
    setUsers(current => current.map(item => item.id === response.data.userId ? { ...item, points: Number(item.points || 0) + Number(response.data.points || 0) } : item));
    setSource(response.source);
    setError(response.error);
    showToast("Đã cộng điểm thủ công");
  };

  const submitReward = async event => {
    event.preventDefault();
    const rewardOption = REWARD_OPTIONS.find(item => item.label === rewardForm.rewardLabel) || REWARD_OPTIONS[0];
    const selectedUser = users.find(item => item.id === rewardForm.userId);
    if (!rewardForm.userId || !selectedUser) {
      showToast("Chọn người đổi thưởng trước khi tạo yêu cầu", "danger");
      return;
    }
    if (Number(selectedUser.points || 0) < rewardOption.points) {
      showToast("Người dùng chưa đủ Ecopoint để đổi phần thưởng này", "danger");
      return;
    }
    const response = await saveRewardRedemption({
      userId: rewardForm.userId,
      rewardLabel: rewardOption.label,
      costPoints: rewardOption.points,
      status: "pending",
    });
    const user = users.find(item => item.id === response.data.userId);
    setRewards(current => [{ ...response.data, userName: user?.name || response.data.userId, userGroup: user?.group || "" }, ...current.filter(item => item.id !== response.data.id)]);
    setSource(response.source);
    setError(response.error);
    showToast("Đã tạo yêu cầu đổi thưởng");
  };

  const reviewReward = async (reward, status) => {
    const response = await updateRewardRedemption(reward, { status, reviewedAt: new Date().toISOString() });
    setRewards(current => current.map(item => item.id === reward.id ? { ...item, ...response.data } : item));
    setSource(response.source);
    setError(response.error);
    showToast(status === "approved" ? "Đã duyệt đổi thưởng" : "Đã từ chối đổi thưởng");
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

  const rankedUsers = userLeaderboard.map((row, index) => ({ ...row, rank: index + 1 }));
  const rankedGroups = groupLeaderboard.map((row, index) => ({ ...row, rank: index + 1 }));

  return (
    <div className="eg-page">
      <div className="eg-page-title">
        <div>
          <span>Cơ chế thưởng cho phân loại đúng</span>
          <h1>Ecopoint</h1>
        </div>
        <div className="eg-button-row">
          {source && <span className={`eg-source-pill ${source === "local" ? "is-local" : ""}`}>{sourceText(source)}</span>}
          <button type="button" className="eg-primary-btn" onClick={saveRules}>Lưu quy tắc điểm</button>
        </div>
      </div>

      {loading && <section className="eg-card eg-state-card">Đang tải quy tắc điểm...</section>}
      {error && <section className="eg-alert">Supabase chưa sẵn sàng, đang dùng dữ liệu dự phòng localStorage.</section>}

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

      <div className="eg-dashboard-grid">
        <section className="eg-card">
          <div className="eg-card-head"><h2>Điểm thủ công</h2></div>
          <form className="eg-form eg-inline-form" onSubmit={submitManualPoint}>
            <label>
              Người nhận điểm
              <select aria-label="Người nhận điểm" value={manualForm.userId} onChange={event => setManualForm(current => ({ ...current, userId: event.target.value }))}>
                <option value="">Chọn người dùng</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
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
          <div className="eg-card-head"><h2>Quy đổi phần thưởng</h2></div>
          <form className="eg-form eg-inline-form" onSubmit={submitReward}>
            <label>
              Người đổi thưởng
              <select aria-label="Người đổi thưởng" value={rewardForm.userId} onChange={event => setRewardForm(current => ({ ...current, userId: event.target.value }))}>
                <option value="">Chọn người dùng</option>
                {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </label>
            <label>
              Mốc phần thưởng
              <select aria-label="Mốc phần thưởng" value={rewardForm.rewardLabel} onChange={event => setRewardForm(current => ({ ...current, rewardLabel: event.target.value }))}>
                {REWARD_OPTIONS.map(option => <option key={option.label} value={option.label}>{option.label}</option>)}
              </select>
            </label>
            <button type="submit" className="eg-primary-btn">Tạo yêu cầu đổi thưởng</button>
          </form>
        </section>
      </div>

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

      <section className="eg-card">
        <div className="eg-card-head"><h2>Lịch sử cộng điểm</h2></div>
        <DataTable columns={historyColumns} rows={filteredHistory} emptyText="Chưa có lịch sử cộng điểm." />
      </section>

      <section className="eg-card">
        <div className="eg-card-head"><h2>Yêu cầu đổi thưởng</h2></div>
        <DataTable columns={rewardColumns} rows={rewards} emptyText="Chưa có yêu cầu đổi thưởng." />
      </section>
      <Toast message={toast} tone={toastTone} onClose={() => setToast("")} />
    </div>
  );
}
