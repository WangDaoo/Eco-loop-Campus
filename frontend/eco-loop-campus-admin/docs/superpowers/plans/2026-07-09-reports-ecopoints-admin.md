# Reports And Ecopoints Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoan thien 2 mang quan tri tiep theo: Reports that hon va Ecopoints sau hon, dong thoi noi Dashboard/Bins thanh luong van hanh dung cho pham vi truong hoc.

**Architecture:** Giu React CRA + JavaScript + Chart.js + Supabase. Tao cac helper tinh toan report/ecopoint thuần trong `src/admin/services/` de test duoc rieng, page chi lo state/UI. Supabase la nguon chinh; localStorage fallback tiep tuc theo pattern hien co trong `supabaseStore.js` va `storage.js`.

**Tech Stack:** React, react-router-dom HashRouter/search params, Chart.js via `ChartPanel`, Supabase client, localStorage fallback, Jest + Testing Library.

---

## Scope

Lam trong 2 phase lon, co the merge theo tung task:

- **Reports that hon:** loc theo ngay/toa nha/nhom rac, KPI va chart tu `predictions`, `point_history`, `feedback`, `bins`, export CSV tren tap da loc.
- **Ecopoints sau hon:** lich su diem chi tiet, loc user/lop-khoa/nhom/ngay, bang xep hang ca nhan va lop/khoa, cong/tru diem thu cong, quy doi phan thuong demo bang Supabase/localStorage.

Kem theo:

- Dashboard priority cards co link sang dung page + filter.
- Bins co trang thai `full`, canh bao suc chua >= 85%, cap nhat suc chua ro rang.

## File Map

- Modify: `supabase/schema.sql` - them bang `reward_redemptions`, cot an toan cho `point_history`, policy RLS.
- Modify: `src/admin/services/storage.js` - local fallback cho `rewardRedemptions` va ghi point history thu cong.
- Modify: `src/admin/services/supabaseStore.js` - service CRUD moi: report data, manual point history, reward redemptions.
- Create: `src/admin/services/reportMetrics.js` - filter va tinh KPI/chart/report rows.
- Create: `src/admin/services/ecopointMetrics.js` - filter lich su diem, leaderboard, payload cong/tru diem, reward helpers.
- Modify: `src/admin/pages/ReportsPage.js` - UI bao cao that, filters, charts, CSV.
- Modify: `src/admin/pages/EcoPointsPage.js` - tabs/sections cho rule, history, leaderboard, manual adjust, rewards.
- Modify: `src/admin/pages/DashboardPage.js` - priority item thanh link sang Reports/Feedback/Scans/Bins voi query filter.
- Modify: `src/admin/pages/BinsPage.js` - status `full`, filter tu query, canh bao suc chua, cap nhat capacity/status.
- Modify: `src/admin/pages/ScansPage.js` - doc query `status=pending&confidence=low`.
- Modify: `src/admin/pages/FeedbackPage.js` - doc query `status=open`.
- Modify: `src/admin/admin.css` - filters, leaderboard, reward cards, linked priority cards, bin warning style.
- Modify: `src/App.test.js` - UI tests cho Reports, Dashboard links, Bins warning, Ecopoints leaderboard/manual/rewards.

---

## Task 1: Supabase And Local Fallback Data Shape

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/admin/services/storage.js`
- Modify: `src/admin/data/wasteConfig.js`
- Modify: `src/admin/services/supabaseStore.js`
- Test: `src/admin/services/storage.test.js`

- [ ] **Step 1: Write failing local fallback test**

Create `src/admin/services/storage.test.js`:

```js
import { getRewardRedemptions, saveRewardRedemption, saveRewardRedemptions } from "./storage";

beforeEach(() => {
  localStorage.clear();
});

test("stores reward redemptions in localStorage fallback", () => {
  saveRewardRedemptions([]);
  saveRewardRedemption({ id: "RW001", userId: "SV001", rewardLabel: "Voucher căn tin 100 điểm", costPoints: 100, status: "pending" });

  expect(getRewardRedemptions()).toEqual([
    { id: "RW001", userId: "SV001", rewardLabel: "Voucher căn tin 100 điểm", costPoints: 100, status: "pending" },
  ]);
});
```

- [ ] **Step 2: Run test and verify RED**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testPathPattern=storage.test.js
```

Expected: FAIL because reward redemption storage exports do not exist.

- [ ] **Step 3: Update schema**

Append to `supabase/schema.sql` after `point_history` table:

```sql
alter table public.point_history add column if not exists admin_note text not null default '';
alter table public.point_history add column if not exists source text not null default 'ai_approval';

create table if not exists public.reward_redemptions (
  id text primary key,
  user_id text references public.users(id) on delete set null,
  reward_label text not null,
  cost_points integer not null default 0,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  admin_note text not null default ''
);

alter table public.reward_redemptions enable row level security;

drop policy if exists "authenticated read reward_redemptions" on public.reward_redemptions;
create policy "authenticated read reward_redemptions" on public.reward_redemptions for select to authenticated using (true);

drop policy if exists "admin write reward_redemptions" on public.reward_redemptions;
create policy "admin write reward_redemptions" on public.reward_redemptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 4: Add localStorage keys and fallback**

In `src/admin/data/wasteConfig.js`, export:

```js
export const REWARD_REDEMPTIONS_KEY = "ecoGuardianRewardRedemptions";
```

In `src/admin/services/storage.js`, import it and add:

```js
export function getRewardRedemptions() {
  return readJson(REWARD_REDEMPTIONS_KEY, []);
}

export function saveRewardRedemptions(items) {
  return writeJson(REWARD_REDEMPTIONS_KEY, items);
}

export function saveRewardRedemption(item) {
  const next = [item, ...getRewardRedemptions().filter(row => row.id !== item.id)];
  writeJson(REWARD_REDEMPTIONS_KEY, next);
  return item;
}
```

- [ ] **Step 5: Add Supabase mappers and service functions**

In `src/admin/services/supabaseStore.js`, add mapper functions near `fromPointHistory`:

```js
function fromRewardRedemption(row) {
  return {
    ...row,
    userId: row.userId || row.user_id,
    rewardLabel: row.rewardLabel || row.reward_label,
    costPoints: Number(row.costPoints ?? row.cost_points ?? 0),
    requestedAt: row.requestedAt || row.requested_at,
    reviewedAt: row.reviewedAt || row.reviewed_at,
    adminNote: row.adminNote || row.admin_note || "",
  };
}

function toRewardRedemption(item) {
  const normalized = fromRewardRedemption(item);
  return {
    id: normalized.id,
    user_id: normalized.userId,
    reward_label: normalized.rewardLabel,
    cost_points: Number(normalized.costPoints || 0),
    status: normalized.status || "pending",
    requested_at: normalized.requestedAt || new Date().toISOString(),
    reviewed_at: normalized.reviewedAt || null,
    admin_note: normalized.adminNote || "",
  };
}
```

Add exports near point history functions:

```js
export async function listRewardRedemptions() {
  const [rewards, users] = await Promise.all([
    readTable("reward_redemptions", localStore.getRewardRedemptions, fromRewardRedemption),
    listUsers(),
  ]);
  const source = rewards.source === LOCAL || users.source === LOCAL ? LOCAL : SUPABASE;
  const error = rewards.error || users.error || null;
  const data = rewards.data.map(item => {
    const user = users.data.find(row => row.id === item.userId);
    return { ...item, userName: user?.name || item.userId || "Chưa rõ người dùng", userGroup: user?.group || "" };
  }).sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
  return result(data, source, error);
}

export async function saveRewardRedemption(item) {
  const payload = fromRewardRedemption({
    ...item,
    id: item.id || `RW-${Date.now()}`,
    status: item.status || "pending",
    requestedAt: item.requestedAt || new Date().toISOString(),
  });
  return upsert("reward_redemptions", toRewardRedemption(payload), payload, row => localStore.saveRewardRedemption(row));
}

export async function updateRewardRedemption(item, updates) {
  const nextItem = fromRewardRedemption({ ...item, ...updates });
  try {
    const response = await client().from("reward_redemptions").update(toRewardRedemption(nextItem)).eq("id", item.id);
    if (response.error) throw response.error;
    return result(nextItem, SUPABASE);
  } catch (error) {
    const next = localStore.getRewardRedemptions().map(row => row.id === item.id ? nextItem : row);
    localStore.saveRewardRedemptions(next);
    return result(nextItem, LOCAL, error);
  }
}
```

- [ ] **Step 6: Run targeted test**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testPathPattern=storage.test.js
```

Expected: PASS. Reward UI is covered later in Task 7.

---

## Task 2: Shared Report Metrics Helpers

**Files:**
- Create: `src/admin/services/reportMetrics.js`
- Test: `src/admin/services/reportMetrics.test.js`

- [ ] **Step 1: Write failing unit tests**

Create `src/admin/services/reportMetrics.test.js`:

```js
import { buildReportSummary, filterReportData, makeDailyReportData, makeReportCsvRows } from "./reportMetrics";

const predictions = [
  { id: "S1", binGroup: "Tái chế", status: "approved", confidence: 0.91, timestamp: "2026-07-07T08:00:00.000Z", binId: "BIN-A1" },
  { id: "S2", binGroup: "Pin / nguy hại", status: "pending", confidence: 0.42, timestamp: "2026-07-08T08:00:00.000Z", binId: "BIN-B2" },
];
const bins = [
  { id: "BIN-A1", building: "A1", binGroup: "Tái chế", capacity: 54, status: "active", name: "Thùng A1" },
  { id: "BIN-B2", building: "B2", binGroup: "Pin / nguy hại", capacity: 91, status: "full", name: "Thùng B2" },
];
const feedback = [{ id: "FB1", status: "unread", binId: "BIN-B2", timestamp: "2026-07-08T09:00:00.000Z" }];
const pointHistory = [{ id: 1, userId: "SV001", binId: "BIN-A1", binGroup: "Tái chế", points: 5, timestamp: "2026-07-07T10:00:00.000Z" }];

test("filters report data by date, building and bin group", () => {
  const result = filterReportData({ predictions, bins, feedback, pointHistory }, { dateFrom: "2026-07-08", dateTo: "2026-07-08", building: "B2", binGroup: "Pin / nguy hại" });

  expect(result.predictions.map(item => item.id)).toEqual(["S2"]);
  expect(result.bins.map(item => item.id)).toEqual(["BIN-B2"]);
  expect(result.feedback.map(item => item.id)).toEqual(["FB1"]);
  expect(result.pointHistory).toEqual([]);
});

test("builds report summary from filtered data", () => {
  const summary = buildReportSummary({ predictions, bins, feedback, pointHistory });

  expect(summary.totalScans).toBe(2);
  expect(summary.totalPoints).toBe(5);
  expect(summary.openFeedback).toBe(1);
  expect(summary.fullBins).toBe(1);
});

test("builds daily chart and csv rows", () => {
  const chart = makeDailyReportData({ predictions, pointHistory, feedback });
  const csvRows = makeReportCsvRows({ predictions, bins, feedback, pointHistory });

  expect(chart.labels).toEqual(["07/07", "08/07"]);
  expect(chart.datasets[0].label).toBe("Lượt quét");
  expect(csvRows[0]).toEqual(expect.objectContaining({ loai: "scan", ma: "S1", nhom: "Tái chế" }));
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testPathPattern=reportMetrics.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement helper module**

Create `src/admin/services/reportMetrics.js`:

```js
const DAY_FORMATTER = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });

function dateOnly(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function inDateRange(value, filters) {
  const current = dateOnly(value);
  if (!current) return true;
  if (filters.dateFrom && current < filters.dateFrom) return false;
  if (filters.dateTo && current > filters.dateTo) return false;
  return true;
}

function binMatches(bin, filters) {
  if (!bin) return false;
  if (filters.building && bin.building !== filters.building) return false;
  if (filters.binGroup && bin.binGroup !== filters.binGroup) return false;
  return true;
}

export function filterReportData(data, filters = {}) {
  const bins = (data.bins || []).filter(bin => binMatches(bin, filters));
  const binIds = new Set(bins.map(bin => bin.id));
  const matchBin = item => !filters.building && !filters.binGroup ? true : binIds.has(item.binId || item.bin_id || item.id);

  return {
    predictions: (data.predictions || []).filter(item => inDateRange(item.timestamp, filters) && matchBin(item)),
    pointHistory: (data.pointHistory || []).filter(item => inDateRange(item.timestamp || item.createdAt, filters) && matchBin(item)),
    feedback: (data.feedback || []).filter(item => inDateRange(item.timestamp, filters) && matchBin(item)),
    bins,
  };
}

export function buildReportSummary(data) {
  return {
    totalScans: (data.predictions || []).length,
    totalPoints: (data.pointHistory || []).reduce((sum, item) => sum + Number(item.points || 0), 0),
    openFeedback: (data.feedback || []).filter(item => item.status !== "resolved").length,
    fullBins: (data.bins || []).filter(bin => bin.status === "full" || Number(bin.capacity || 0) >= 85).length,
  };
}

export function makeDailyReportData(data) {
  const dayMap = new Map();
  const ensure = value => {
    const date = dateOnly(value);
    if (!date) return null;
    if (!dayMap.has(date)) dayMap.set(date, { scans: 0, points: 0, feedback: 0 });
    return dayMap.get(date);
  };
  (data.predictions || []).forEach(item => { const row = ensure(item.timestamp); if (row) row.scans += 1; });
  (data.pointHistory || []).forEach(item => { const row = ensure(item.timestamp || item.createdAt); if (row) row.points += Number(item.points || 0); });
  (data.feedback || []).forEach(item => { const row = ensure(item.timestamp); if (row) row.feedback += 1; });
  const keys = Array.from(dayMap.keys()).sort();
  return {
    labels: keys.map(key => DAY_FORMATTER.format(new Date(`${key}T00:00:00.000Z`))),
    datasets: [
      { label: "Lượt quét", data: keys.map(key => dayMap.get(key).scans), borderColor: "#4680ff", backgroundColor: "rgba(70,128,255,0.12)", tension: 0.35, fill: true },
      { label: "Ecopoint", data: keys.map(key => dayMap.get(key).points), borderColor: "#2ca87f", backgroundColor: "rgba(44,168,127,0.12)", tension: 0.35, fill: true },
      { label: "Phản hồi", data: keys.map(key => dayMap.get(key).feedback), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.12)", tension: 0.35, fill: true },
    ],
  };
}

export function makeReportCsvRows(data) {
  const scanRows = (data.predictions || []).map(item => ({ loai: "scan", ma: item.id, nhom: item.binGroup, trang_thai: item.status, diem: "", thoi_gian: item.timestamp }));
  const pointRows = (data.pointHistory || []).map(item => ({ loai: "point", ma: item.id, nhom: item.binGroup, trang_thai: item.action, diem: item.points, thoi_gian: item.timestamp || item.createdAt }));
  const feedbackRows = (data.feedback || []).map(item => ({ loai: "feedback", ma: item.id, nhom: item.category, trang_thai: item.status, diem: "", thoi_gian: item.timestamp }));
  const binRows = (data.bins || []).map(item => ({ loai: "bin", ma: item.id, nhom: item.binGroup, trang_thai: item.status, diem: "", thoi_gian: `${item.capacity || 0}%` }));
  return [...scanRows, ...pointRows, ...feedbackRows, ...binRows];
}
```

- [ ] **Step 4: Run unit tests GREEN**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testPathPattern=reportMetrics.test.js
```

Expected: PASS.

---

## Task 3: Reports Page Real Filters, Charts, CSV

**Files:**
- Modify: `src/admin/pages/ReportsPage.js`
- Modify: `src/admin/admin.css`
- Test: `src/App.test.js`

- [ ] **Step 1: Write failing UI test**

Add to `src/App.test.js` near report/dashboard tests:

```js
test("reports page filters real operations data and exports filtered csv", async () => {
  window.location.hash = "#/reports?building=A1&binGroup=Tái%20chế";
  const createObjectURL = jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:report");
  jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const click = jest.fn();
  jest.spyOn(document, "createElement").mockImplementation(tag => tag === "a" ? { href: "", download: "", click } : document.createElement(tag));

  render(<App />);

  expect(await screen.findByRole("heading", { name: /báo cáo/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/tòa nhà/i)).toHaveValue("A1");
  expect(screen.getByLabelText(/nhóm rác/i)).toHaveValue("Tái chế");
  expect(await screen.findByText(/ecopoint đã cấp/i)).toBeInTheDocument();
  expect(screen.getByText(/phản hồi mở/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /xuất csv/i }));

  expect(createObjectURL).toHaveBeenCalled();
  expect(click).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="reports page filters"
```

Expected: FAIL because ReportsPage has no filters/point/feedback data.

- [ ] **Step 3: Replace ReportsPage data loading and filters**

In `src/admin/pages/ReportsPage.js`:

- Import `useSearchParams`.
- Import `listFeedback`, `listPointHistory`.
- Import helpers from `reportMetrics.js`.
- Load `predictions`, `users`, `bins`, `feedback`, `pointHistory` in one `Promise.all`.
- Initialize filters from search params:

```js
const [searchParams, setSearchParams] = useSearchParams();
const filters = {
  dateFrom: searchParams.get("dateFrom") || "",
  dateTo: searchParams.get("dateTo") || "",
  building: searchParams.get("building") || "",
  binGroup: searchParams.get("binGroup") || "",
};
const updateFilter = (key, value) => {
  const next = new URLSearchParams(searchParams);
  if (value) next.set(key, value); else next.delete(key);
  setSearchParams(next);
};
```

Use:

```js
const filtered = filterReportData({ predictions, bins, feedback, pointHistory }, filters);
const summary = buildReportSummary(filtered);
const dailyChartData = makeDailyReportData(filtered);
const csvRows = makeReportCsvRows(filtered);
```

- [ ] **Step 4: Add UI controls and charts**

Add below page title:

```jsx
<section className="eg-card eg-filter-panel" aria-label="Bộ lọc báo cáo">
  <label>Từ ngày<input type="date" value={filters.dateFrom} onChange={event => updateFilter("dateFrom", event.target.value)} /></label>
  <label>Đến ngày<input type="date" value={filters.dateTo} onChange={event => updateFilter("dateTo", event.target.value)} /></label>
  <label>Tòa nhà<select value={filters.building} onChange={event => updateFilter("building", event.target.value)}><option value="">Tất cả</option>{Array.from(new Set(bins.map(bin => bin.building).filter(Boolean))).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
  <label>Nhóm rác<select value={filters.binGroup} onChange={event => updateFilter("binGroup", event.target.value)}><option value="">Tất cả</option>{BIN_GROUPS.map(group => <option key={group.id} value={group.label}>{group.label}</option>)}</select></label>
</section>
```

Replace stat cards with `summary.totalScans`, `summary.totalPoints`, `summary.openFeedback`, `summary.fullBins`. Add line chart `dailyChartData`, keep bar chart by group using filtered predictions, and table rows by building/bin group.

Update CSV button:

```jsx
<button type="button" className="eg-primary-btn" onClick={() => downloadCsv("eco-loop-campus-report.csv", csvRows)}>
  <DownloadSimple size={18} /> Xuất CSV
</button>
```

- [ ] **Step 5: Add CSS**

In `src/admin/admin.css` add:

```css
.eg-filter-panel {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr));
  gap: 12px;
}

.eg-filter-panel label {
  display: grid;
  gap: 6px;
  color: var(--eg-muted);
  font-size: 13px;
  font-weight: 800;
}

.eg-filter-panel input,
.eg-filter-panel select {
  min-height: 40px;
  border: 1px solid var(--eg-border);
  border-radius: var(--eg-radius);
  padding: 0 10px;
}
```

Inside tablet/mobile media queries, set `.eg-filter-panel { grid-template-columns: 1fr 1fr; }` then `1fr` on small mobile.

- [ ] **Step 6: Run targeted and full tests**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="reports page filters"
npm test -- --watchAll=false --runInBand --silent
```

Expected: targeted test PASS, full suite PASS.

---

## Task 4: Dashboard Links To Filtered Pages

**Files:**
- Modify: `src/admin/pages/DashboardPage.js`
- Modify: `src/admin/pages/FeedbackPage.js`
- Modify: `src/admin/pages/ScansPage.js`
- Modify: `src/admin/pages/BinsPage.js`
- Modify: `src/admin/admin.css`
- Test: `src/App.test.js`

- [ ] **Step 1: Write failing navigation test**

Add to `src/App.test.js`:

```js
test("dashboard priority cards navigate to filtered admin pages", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /việc cần xử lý hôm nay/i })).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("link", { name: /1 phản hồi chưa xử lý/i }));

  expect(await screen.findByRole("heading", { name: /phản hồi/i })).toBeInTheDocument();
  expect(window.location.hash).toContain("status=open");
  expect(screen.getByLabelText(/trạng thái/i)).toHaveValue("open");
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="priority cards navigate"
```

Expected: FAIL because cards are `article`, not links, and pages do not read filters.

- [ ] **Step 3: Make Dashboard priority items links**

In `DashboardPage.js`, import `Link` from `react-router-dom` and add `href` to `makePriorityItems` rows:

```js
href: "/feedback?status=open"
href: "/scans?status=pending&confidence=low"
href: "/scans?status=pending"
href: "/bins?status=attention"
```

Render with `Link`:

```jsx
<Link key={item.id} to={item.href} className={`eg-priority-item tone-${item.tone}`}>
  <span>{item.title}</span>
  <strong>{item.detail}</strong>
  <small>{item.meta}</small>
</Link>
```

- [ ] **Step 4: Read query params in pages**

In `FeedbackPage.js`, use `useSearchParams()` and set initial status filter:

```js
const [searchParams, setSearchParams] = useSearchParams();
const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
const visibleFeedback = feedback.filter(item => statusFilter === "all" ? true : statusFilter === "open" ? item.status !== "resolved" : item.status === statusFilter);
```

Add visible label:

```jsx
<label>Trạng thái<select aria-label="Trạng thái" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setSearchParams(event.target.value === "all" ? {} : { status: event.target.value }); }}><option value="all">Tất cả</option><option value="open">Chưa xử lý</option><option value="unread">Chưa đọc</option><option value="in_progress">Đang xử lý</option><option value="resolved">Hoàn tất</option></select></label>
```

In `ScansPage.js`, read `status` and `confidence`; for confidence low, filter `Number(item.confidence) < 0.65`.

In `BinsPage.js`, read `status=attention`; filter bins where `status === "maintenance" || status === "full" || capacity >= 85`.

- [ ] **Step 5: CSS for linked cards**

Add:

```css
a.eg-priority-item {
  color: inherit;
  text-decoration: none;
}

a.eg-priority-item:hover {
  border-color: var(--priority-color);
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
}
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="priority cards navigate"
npm test -- --watchAll=false --runInBand --silent
```

Expected: PASS.

---

## Task 5: Bins Capacity, Full Status, And 85 Percent Warning

**Files:**
- Modify: `src/admin/pages/BinsPage.js`
- Modify: `src/admin/components/StatusBadge.js` if status labels need `full`
- Modify: `src/admin/data/wasteConfig.js`
- Modify: `src/admin/admin.css`
- Test: `src/App.test.js`

- [ ] **Step 1: Write failing Bins test**

Add to `src/App.test.js`:

```js
test("bins page highlights full bins and supports full status", async () => {
  mockTables.bins = [
    ...mockTables.bins,
    { id: "BIN-C3-FULL", name: "Thùng còn lại C3", bin_group: "Còn lại", location: "Nhà C3", building: "C3", floor: "1", qr_code: "QR-C3", status: "full", capacity: 92, map_x: 50, map_y: 50 },
  ];
  window.location.hash = "#/bins?status=attention";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /thùng rác/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/trạng thái/i)).toHaveValue("attention");
  expect(await screen.findByText("Thùng còn lại C3")).toBeInTheDocument();
  expect(screen.getByText(/cần thu gom/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="full bins"
```

Expected: FAIL because BinsPage has no filter and StatusBadge may not label `full`.

- [ ] **Step 3: Add status config**

In `src/admin/data/wasteConfig.js`, update `STATUS_LABELS`:

```js
full: "Đầy",
```

- [ ] **Step 4: Add BinsPage filters and warning render**

In `BinsPage.js`, import `useSearchParams`, define:

```js
const [searchParams, setSearchParams] = useSearchParams();
const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
const attentionBin = bin => bin.status === "maintenance" || bin.status === "full" || Number(bin.capacity || 0) >= 85;
const visibleBins = bins.filter(bin => statusFilter === "all" ? true : statusFilter === "attention" ? attentionBin(bin) : bin.status === statusFilter);
```

Add filter above table:

```jsx
<section className="eg-card eg-filter-panel" aria-label="Bộ lọc thùng rác">
  <label>Trạng thái<select aria-label="Trạng thái" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setSearchParams(event.target.value === "all" ? {} : { status: event.target.value }); }}><option value="all">Tất cả</option><option value="attention">Cần kiểm tra</option><option value="active">Hoạt động</option><option value="full">Đầy</option><option value="maintenance">Bảo trì</option></select></label>
</section>
```

Change table rows to `visibleBins`. In capacity column, render warning:

```jsx
<div className={`eg-progress ${Number(row.capacity || 0) >= 85 ? "is-warning" : ""}`}><span style={{ width: `${row.capacity}%` }} /><strong>{row.capacity}%</strong>{Number(row.capacity || 0) >= 85 && <em>Cần thu gom</em>}</div>
```

Add form status option:

```jsx
<option value="full">Đầy</option>
```

- [ ] **Step 5: CSS**

Add:

```css
.eg-progress.is-warning {
  border-color: #fed7aa;
  background: #fff7ed;
}

.eg-progress em {
  color: #b45309;
  font-size: 11px;
  font-style: normal;
  font-weight: 900;
}
```

- [ ] **Step 6: Run tests**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="full bins"
npm test -- --watchAll=false --runInBand --silent
```

Expected: PASS.

---

## Task 6: Ecopoint Metrics, Filters, Leaderboards

**Files:**
- Create: `src/admin/services/ecopointMetrics.js`
- Create: `src/admin/services/ecopointMetrics.test.js`
- Modify: `src/admin/pages/EcoPointsPage.js`
- Modify: `src/admin/admin.css`
- Test: `src/App.test.js`

- [ ] **Step 1: Write helper tests**

Create `src/admin/services/ecopointMetrics.test.js`:

```js
import { buildGroupLeaderboard, buildUserLeaderboard, filterPointHistory } from "./ecopointMetrics";

const users = [
  { id: "SV001", name: "Nguyễn Minh Anh", group: "CNTT K18", points: 245 },
  { id: "SV002", name: "Trần Bình", group: "Môi trường K18", points: 120 },
];
const history = [
  { id: 1, userId: "SV001", userName: "Nguyễn Minh Anh", binGroup: "Tái chế", points: 5, timestamp: "2026-07-07T09:00:00.000Z" },
  { id: 2, userId: "SV002", userName: "Trần Bình", binGroup: "Hữu cơ", points: 3, timestamp: "2026-07-08T09:00:00.000Z" },
];

test("filters point history by group, bin group and date", () => {
  const rows = filterPointHistory(history, users, { userGroup: "CNTT K18", binGroup: "Tái chế", dateFrom: "2026-07-07", dateTo: "2026-07-07" });

  expect(rows.map(row => row.id)).toEqual([1]);
});

test("builds user and group leaderboards", () => {
  expect(buildUserLeaderboard(users, history)[0]).toEqual(expect.objectContaining({ userId: "SV001", totalPoints: 5 }));
  expect(buildGroupLeaderboard(users, history)[0]).toEqual(expect.objectContaining({ group: "CNTT K18", totalPoints: 5 }));
});
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testPathPattern=ecopointMetrics.test.js
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement helper**

Create `src/admin/services/ecopointMetrics.js`:

```js
function dateOnly(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function inRange(value, filters) {
  const current = dateOnly(value);
  if (!current) return true;
  if (filters.dateFrom && current < filters.dateFrom) return false;
  if (filters.dateTo && current > filters.dateTo) return false;
  return true;
}

export function filterPointHistory(history, users, filters = {}) {
  const userMap = new Map(users.map(user => [user.id, user]));
  return history.filter(item => {
    const user = userMap.get(item.userId);
    if (filters.userId && item.userId !== filters.userId) return false;
    if (filters.userGroup && user?.group !== filters.userGroup) return false;
    if (filters.binGroup && item.binGroup !== filters.binGroup) return false;
    return inRange(item.timestamp || item.createdAt, filters);
  });
}

export function buildUserLeaderboard(users, history) {
  return users.map(user => {
    const rows = history.filter(item => item.userId === user.id);
    return { userId: user.id, name: user.name, group: user.group, totalPoints: rows.reduce((sum, item) => sum + Number(item.points || 0), 0), scanCount: rows.length };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
}

export function buildGroupLeaderboard(users, history) {
  const userMap = new Map(users.map(user => [user.id, user]));
  const groups = new Map();
  history.forEach(item => {
    const group = userMap.get(item.userId)?.group || "Chưa phân nhóm";
    const current = groups.get(group) || { group, totalPoints: 0, scanCount: 0 };
    current.totalPoints += Number(item.points || 0);
    current.scanCount += 1;
    groups.set(group, current);
  });
  return Array.from(groups.values()).sort((a, b) => b.totalPoints - a.totalPoints);
}
```

- [ ] **Step 4: Run helper GREEN**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testPathPattern=ecopointMetrics.test.js
```

Expected: PASS.

- [ ] **Step 5: Add Ecopoints UI test**

Add to `src/App.test.js`:

```js
test("ecopoints page shows filters and leaderboards", async () => {
  window.location.hash = "#/ecopoints?group=CNTT%20K18";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/lớp khoa/i)).toHaveValue("CNTT K18");
  expect(screen.getByRole("heading", { name: /bảng xếp hạng cá nhân/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /bảng xếp hạng lớp khoa/i })).toBeInTheDocument();
  expect(screen.getAllByText("Nguyễn Minh Anh").length).toBeGreaterThan(0);
});
```

- [ ] **Step 6: Update EcoPointsPage**

In `EcoPointsPage.js`:

- Import `useSearchParams`.
- Load users using `listUsers()` in the existing Promise.
- Import helper functions.
- Add filters `dateFrom`, `dateTo`, `userGroup`, `binGroup`, `userId` from URL.
- Render filter panel.
- Compute:

```js
const filteredHistory = filterPointHistory(history, users, filters);
const userLeaderboard = buildUserLeaderboard(users, filteredHistory).slice(0, 10);
const groupLeaderboard = buildGroupLeaderboard(users, filteredHistory).slice(0, 10);
```

Add two sections with `DataTable`: `Bảng xếp hạng cá nhân`, `Bảng xếp hạng lớp khoa`. Use `filteredHistory` for history table.

- [ ] **Step 7: Add CSS and run tests**

Add small leaderboard style if needed:

```css
.eg-rank-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #eef4ff;
  color: var(--eg-primary);
  font-weight: 900;
}
```

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="leaderboards"
npm test -- --watchAll=false --runInBand --silent
```

Expected: PASS.

---

## Task 7: Manual Point Adjustment And Rewards UI

**Files:**
- Modify: `src/admin/services/supabaseStore.js`
- Modify: `src/admin/services/storage.js`
- Modify: `src/admin/pages/EcoPointsPage.js`
- Modify: `src/admin/admin.css`
- Test: `src/App.test.js`

- [ ] **Step 1: Write manual point failing test**

Add to `src/App.test.js`:

```js
test("admins can add manual Ecopoint adjustments", async () => {
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/người nhận điểm/i), { target: { value: "SV001" } });
  fireEvent.change(screen.getByLabelText(/số điểm/i), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText(/lý do/i), { target: { value: "Nộp rác sự kiện xanh" } });
  fireEvent.click(screen.getByRole("button", { name: /cộng điểm thủ công/i }));

  await waitFor(() => expect(mockSupabaseInsert).toHaveBeenCalledWith("point_history", expect.arrayContaining([expect.objectContaining({ user_id: "SV001", points: 10, action: "Nộp rác sự kiện xanh" })])));
});
```

- [ ] **Step 2: Write reward failing test**

Add to `src/App.test.js`:

```js
test("admins can request and approve reward redemptions", async () => {
  mockTables.reward_redemptions = [];
  window.location.hash = "#/ecopoints";

  render(<App />);

  expect(await screen.findByRole("heading", { name: /ecopoint/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/người đổi thưởng/i), { target: { value: "SV001" } });
  fireEvent.change(screen.getByLabelText(/mốc phần thưởng/i), { target: { value: "Voucher căn tin 100 điểm" } });
  fireEvent.click(screen.getByRole("button", { name: /tạo yêu cầu đổi thưởng/i }));

  await waitFor(() => expect(mockSupabaseUpsert).toHaveBeenCalledWith(expect.objectContaining({ reward_label: "Voucher căn tin 100 điểm", cost_points: 100, status: "pending" })));
});
```

- [ ] **Step 3: Run RED**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="manual Ecopoint|reward redemptions"
```

Expected: FAIL because UI/service functions are missing.

- [ ] **Step 4: Add manual point service**

In `supabaseStore.js`, add:

```js
export async function saveManualPointHistory(record) {
  const timestamp = new Date().toISOString();
  const pointRecord = fromPointHistory({
    predictionId: null,
    userId: record.userId,
    binId: record.binId || null,
    class: "manual_adjustment",
    binGroup: record.binGroup || "Điều chỉnh",
    action: record.action,
    points: Number(record.points || 0),
    timestamp,
    createdAt: timestamp,
    source: "manual_adjustment",
    adminNote: record.adminNote || "",
  });
  try {
    const insertResponse = await client().from("point_history").insert([toPointHistory(pointRecord)]);
    if (insertResponse.error) throw insertResponse.error;
    const users = await listUsers();
    const user = users.data.find(item => item.id === pointRecord.userId);
    if (user) {
      const userResponse = await client().from("users").update({ points: Number(user.points || 0) + Number(pointRecord.points || 0) }).eq("id", user.id);
      if (userResponse.error) throw userResponse.error;
    }
    return result(pointRecord, SUPABASE);
  } catch (error) {
    localStore.savePointHistoryRecord(pointRecord);
    const users = localStore.getUsers();
    localStore.saveUsers(users.map(user => user.id === pointRecord.userId ? { ...user, points: Number(user.points || 0) + Number(pointRecord.points || 0) } : user));
    return result(pointRecord, LOCAL, error);
  }
}
```

Update `toPointHistory` to include optional fields:

```js
admin_note: normalized.adminNote || "",
source: normalized.source || "ai_approval",
```

- [ ] **Step 5: Add EcoPointsPage forms**

In `EcoPointsPage.js`:

- Import `saveManualPointHistory`, `saveRewardRedemption`, `listRewardRedemptions`, `updateRewardRedemption`.
- Add state `users`, `rewards`, `manualForm`, `rewardForm`.
- Load `users` and `rewards` in `Promise.all`.
- Render manual form:

```jsx
<section className="eg-card">
  <div className="eg-card-head"><h2>Điểm thủ công</h2></div>
  <form className="eg-form eg-inline-form" onSubmit={submitManualPoint}>
    <label>Người nhận điểm<select aria-label="Người nhận điểm" value={manualForm.userId} onChange={event => setManualForm(current => ({ ...current, userId: event.target.value }))}>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
    <label>Số điểm<input aria-label="Số điểm" type="number" value={manualForm.points} onChange={event => setManualForm(current => ({ ...current, points: event.target.value }))} /></label>
    <label>Lý do<input aria-label="Lý do" value={manualForm.action} onChange={event => setManualForm(current => ({ ...current, action: event.target.value }))} /></label>
    <button type="submit" className="eg-primary-btn">Cộng điểm thủ công</button>
  </form>
</section>
```

- Render reward form with fixed reward options:

```js
const REWARD_OPTIONS = [
  { label: "Voucher căn tin 100 điểm", points: 100 },
  { label: "Giấy chứng nhận xanh 300 điểm", points: 300 },
  { label: "Quà học kỳ xanh 500 điểm", points: 500 },
];
```

Use `DataTable` for redemptions with approve/reject buttons calling `updateRewardRedemption(reward, { status: "approved", reviewedAt: new Date().toISOString() })`.

- [ ] **Step 6: Run targeted and full tests**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent --testNamePattern="manual Ecopoint|reward redemptions"
npm test -- --watchAll=false --runInBand --silent
```

Expected: PASS.

---

## Task 8: Final Verification And Browser Smoke

**Files:**
- No code changes expected.

- [ ] **Step 1: Run full automated verification**

Run:

```powershell
npm test -- --watchAll=false --runInBand --silent
npm run build
```

Expected:

- All tests PASS.
- Build exits 0.
- Browserslist stale warning may appear and is acceptable.

- [ ] **Step 2: Manual browser checks**

Open these routes in the in-app browser:

```text
http://127.0.0.1:3000/#/dashboard
http://127.0.0.1:3000/#/reports
http://127.0.0.1:3000/#/reports?building=A1&binGroup=Tái%20chế
http://127.0.0.1:3000/#/bins?status=attention
http://127.0.0.1:3000/#/ecopoints
http://127.0.0.1:3000/#/feedback?status=open
http://127.0.0.1:3000/#/scans?status=pending&confidence=low
```

Check:

- Reports filters keep values after reload.
- CSV downloads filtered rows.
- Dashboard priority links navigate with query params.
- Bins warning appears for full/capacity >= 85.
- Ecopoints leaderboard, manual point form, rewards all render without overlap on desktop and mobile width.

---

## Implementation Order Recommendation

1. Task 2 and Task 3 first: Reports gives highest admin demo value.
2. Task 4 next: connects Dashboard warnings into real workflows.
3. Task 5 next: Bins warning makes reports and dashboard more credible.
4. Task 1, Task 6, Task 7 next: Ecopoints deeper features with schema-backed rewards/manual points.
5. Task 8 last: full verification.

## Self-Review

- Spec coverage: Reports filters/charts/export covered by Tasks 2-3; Dashboard links covered by Task 4; Bins capacity/status covered by Task 5; Ecopoints history filters/leaderboards/manual points/rewards covered by Tasks 1, 6, 7.
- Placeholder scan: no deferred placeholders; each task has exact files, tests, commands, and expected outcome.
- Type consistency: `binGroup`, `userId`, `rewardLabel`, `costPoints`, `requestedAt`, `reviewedAt`, `adminNote` match existing camelCase mapper style; SQL uses snake_case matching `supabaseStore.js` mapper pattern.
