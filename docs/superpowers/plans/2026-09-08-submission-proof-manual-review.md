# Submission Proof And Manual Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gắn ảnh sinh viên bắt buộc vào giao dịch, sửa xác thực AI, giữ QR là luồng chính và cung cấp manual review có audit/notification xuyên Mobile–Web Admin.

**Architecture:** PostgreSQL là nguồn sự thật cho state machine, proof ownership, điểm và notification. FastAPI nhận multipart và chỉ điều phối lưu file quanh transaction; Mobile/Web Admin tiêu thụ canonical response, không tự suy diễn trạng thái.

**Tech Stack:** PostgreSQL/PLpgSQL, FastAPI/psycopg, Expo React Native/TypeScript, React/Jest.

**Spec:** `docs/superpowers/specs/2026-09-08-submission-proof-manual-review-design.md`

## Global Constraints

- Ảnh sinh viên bắt buộc; AI lỗi không được chặn tạo QR.
- Quét QR là phương thức duyệt chính; manual review phải có failure log hoặc lý do `CANNOT_SCAN`.
- Reject bắt buộc note và student thấy note ở lịch sử/chi tiết cùng notification center.
- Điểm, terminal state và notification phải idempotent trong PostgreSQL transaction.
- Không triển khai push notification hoặc bin maintenance trong plan này.

---

### Task 1: PostgreSQL evidence, manual-review audit và notification

**Files:**
- Modify: `backend/local_db/schema.sql`
- Modify: `backend/test_submission_postgres_integration.py`

**Interfaces:**
- Produces: `create_recycling_submission_with_proof(...) -> jsonb`
- Produces: `unlock_recycling_manual_review(...) -> jsonb`
- Produces: canonical scan/confirm/reject JSON có `submission`

- [x] **Step 1: Viết test PostgreSQL đỏ**

Thêm test tạo submission có `STUDENT_PROOF`, chặn proof thiếu, scan trả full row, manual unlock cần failure/reason, reject note rỗng bị chặn và reject hợp lệ tạo đúng một notification.

```python
assert created["submission"]["status"] == "CREATED"
assert created["submission"]["proofImages"][0]["kind"] == "STUDENT_PROOF"
assert rejected_error == "REJECTION_NOTE_REQUIRED"
assert notification["referenceId"] == submission_id
```

- [x] **Step 2: Chạy test và xác nhận RED**

Run: `pytest backend/test_submission_postgres_integration.py -q`
Expected: FAIL vì function/columns/notification chưa tồn tại.

- [x] **Step 3: Cài schema và functions tối thiểu**

Thêm columns/tables/check constraints; dùng `FOR UPDATE`, kiểm tra actor và trả canonical submission kèm proofs.

```sql
if nullif(btrim(p_note), '') is null then
  raise exception 'REJECTION_NOTE_REQUIRED';
end if;
insert into notifications (user_id, type, title, message, reference_type, reference_id)
values (v_submission.user_id, 'SUBMISSION_REJECTED', 'Giao dịch bị từ chối', p_note, 'recycling_submission', p_submission_id);
```

- [x] **Step 4: Chạy lại focused test**

Run: `pytest backend/test_submission_postgres_integration.py -q`
Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```powershell
git add backend/local_db/schema.sql backend/test_submission_postgres_integration.py
git commit -m "feat(submissions): enforce proof and audited manual review"
```

### Task 2: FastAPI multipart, canonical responses và AI auth contract

**Files:**
- Modify: `backend/app.py`
- Modify: `backend/test_qr_postgres_endpoints.py`
- Modify: `backend/test_mobile_postgres_endpoints.py`

**Interfaces:**
- Consumes: Task 1 PostgreSQL functions.
- Produces: multipart create route, manual-review route, notification read route.

- [ ] **Step 1: Viết API test đỏ**

```python
response = client.post('/api/mobile/recycling-submissions', data=form, files={'proof': ('proof.jpg', b'image', 'image/jpeg')}, headers=student_headers)
assert response.status_code == 201
assert response.json()['data']['submission']['proofImages'][0]['kind'] == 'STUDENT_PROOF'
```

Bao phủ thiếu proof, invalid MIME, cleanup file khi DB fail, manual review authorization, reject note và role-filtered notifications.

- [ ] **Step 2: Chạy test và xác nhận RED**

Run: `pytest backend/test_qr_postgres_endpoints.py backend/test_mobile_postgres_endpoints.py -q`
Expected: FAIL do route hiện nhận JSON và chưa có manual/notification contract.

- [ ] **Step 3: Implement FastAPI tối thiểu**

Lưu proof bằng helper giới hạn dung lượng, gọi function Task 1, xóa file nếu transaction lỗi; map business error sang 400/403/409. Không bỏ xác thực khỏi `/predict*`.

- [ ] **Step 4: Chạy focused backend test**

Run: `pytest backend/test_qr_postgres_endpoints.py backend/test_mobile_postgres_endpoints.py -q`
Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```powershell
git add backend/app.py backend/test_qr_postgres_endpoints.py backend/test_mobile_postgres_endpoints.py
git commit -m "feat(api): add proof-first submission review contract"
```

### Task 3: Mobile authenticated AI và proof-first submission

**Files:**
- Create: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/services/authTokenStore.ts`
- Modify: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/services/predictionService.ts`
- Modify: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/services/backendMobileStore.ts`
- Modify: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/screens/submitAiFlow.ts`
- Modify: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/screens/SubmitScreen.tsx`
- Modify tests beside these files.

**Interfaces:**
- Produces: `getMobileAccessToken(): Promise<string>`
- Produces: `createSubmission(input, proof): Promise<RecyclingSubmission>`

- [ ] **Step 1: Viết Mobile tests đỏ**

```ts
assert.equal(calls[0].init.headers?.Authorization, 'Bearer token-1');
await assert.rejects(() => store.createSubmission(input, undefined), /ảnh minh chứng/i);
```

Test queue POST và poll đều có auth; AI error vẫn trả state có `sourceUri`; multipart create chứa proof.

- [ ] **Step 2: Chạy test và xác nhận RED**

Run: `npm test -- --test-name-pattern="prediction|submission proof|AI failure"`
Expected: FAIL vì prediction fetch chưa có header và create vẫn gửi JSON.

- [ ] **Step 3: Implement shared token và multipart create**

```ts
const token = await tokenProvider();
const headers = token ? { Authorization: `Bearer ${token}` } : {};
await fetcher(url, { method: 'POST', headers, body: formData });
```

SubmitScreen giữ asset riêng với AI suggestion, yêu cầu asset trước `handleCreate`, và cho chọn waste thủ công nếu prediction lỗi.

- [ ] **Step 4: Chạy Mobile test và typecheck**

Run: `npm test`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```powershell
git add ecoloop-campus-mobile/ecoloop-campus-mobile/src
git commit -m "feat(mobile): require proof and authenticate AI requests"
```

### Task 4: Volunteer manual review và Student notification center

**Files:**
- Modify: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/types.ts`
- Modify: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/context/AppContext.tsx`
- Modify: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/screens/ScannerScreen.tsx`
- Modify: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/screens/HistoryScreen.tsx`
- Create: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/screens/NotificationsScreen.tsx`
- Modify navigation entry point and focused tests.

**Interfaces:**
- Produces: `unlockManualReview(submissionId, reason, scanLogId?)`
- Produces: `markNotificationRead(notificationId)`

- [ ] **Step 1: Viết state/adapter/UI tests đỏ**

Khóa full submission sau scan, nút manual chỉ hiện sau failure hoặc explicit reason, empty reject note không gửi request, và notification chỉ hiển thị của current student.

- [ ] **Step 2: Chạy test và xác nhận RED**

Run: `npm test -- --test-name-pattern="manual review|notification|scan response|rejection note"`
Expected: FAIL vì contract/UI chưa tồn tại.

- [ ] **Step 3: Implement Mobile flow tối thiểu**

Scanner hiển thị student proof trước actions; explicit “Không thể quét QR” mở modal reason. History hiện rejection note. Notification screen có unread marker và action đánh dấu đã đọc.

- [ ] **Step 4: Chạy Mobile full gate**

Run: `npm test`
Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```powershell
git add ecoloop-campus-mobile/ecoloop-campus-mobile/src
git commit -m "feat(mobile): add audited manual review and notifications"
```

### Task 5: Web Admin submission proof gallery và manual actions

**Files:**
- Modify: `frontend/eco-loop-campus-admin/src/admin/services/supabaseStore.js`
- Modify: `frontend/eco-loop-campus-admin/src/admin/pages/EcoPointsPage.js`
- Modify: `frontend/eco-loop-campus-admin/src/admin/services/supabaseStore.test.js`
- Create: `frontend/eco-loop-campus-admin/src/admin/pages/EcoPointsPage.test.js`

**Interfaces:**
- Consumes: canonical proofs/manual fields từ API.
- Produces: Admin proof gallery, manual unlock/approve/reject actions.

- [ ] **Step 1: Viết Web Admin tests đỏ**

```js
expect(screen.getByRole('link', { name: /xem ảnh sinh viên/i })).toHaveAttribute('href', proofUrl);
expect(screen.queryByRole('button', { name: /duyệt thủ công/i })).not.toBeInTheDocument();
```

Thêm case unlocked hiển thị action, reject note rỗng bị chặn, refetch phản ánh state Mobile.

- [ ] **Step 2: Chạy test và xác nhận RED**

Run: `npm test -- --watchAll=false --runInBand src/admin/pages/EcoPointsPage.test.js src/admin/services/supabaseStore.test.js`
Expected: FAIL vì UI/action chưa có.

- [ ] **Step 3: Implement Admin UI/service tối thiểu**

Hiển thị ảnh theo `kind`, reason/audit actor và chỉ render manual actions khi backend trả `manualReviewUnlockedAt`. Confirm/reject dùng state-machine endpoints, không generic CRUD.

- [ ] **Step 4: Chạy Web Admin full gate**

Run: `npm test -- --watchAll=false --runInBand`
Expected: PASS.

- [ ] **Step 5: Commit checkpoint**

```powershell
git add frontend/eco-loop-campus-admin/src/admin
git commit -m "feat(admin): review submission proofs with audited fallback"
```

### Task 6: Cross-role verification và UAT rebuild

**Files:**
- Modify: `backend/test_submission_postgres_integration.py`
- Modify: `contracts/backend_contract_fixtures.json`
- Modify: `docs/testing/AUTOMATED_TEST_MATRIX.md`
- Modify: `progress.md`, `findings.md`, `task_plan.md`
- Generated ignored artifact: `dist/ecoloop-campus-uat.apk`

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: evidence-backed green gate và APK UAT mới.

- [ ] **Step 1: Thêm E2E thật trên PostgreSQL `_test`**

Scenario: student multipart create → volunteer/admin thấy proof → scan/manual fallback → confirm hoặc reject → student reload thấy point/note/notification. Chạy race confirm để chứng minh một point row.

- [ ] **Step 2: Chạy full automated gate hai lượt**

Run: `powershell -ExecutionPolicy Bypass -File scripts/run_automated_logic_tests.ps1 -TestDatabaseUrl $env:TEST_DATABASE_URL`
Expected: exit `0` hai lần liên tiếp.

- [ ] **Step 3: Rebuild UAT APK với API URL hiện tại**

Run: `powershell -ExecutionPolicy Bypass -File scripts/setup_uat.ps1`
Expected: health đúng database `_uat`, APK standalone và checksum khớp.

- [ ] **Step 4: Cập nhật tracking và kiểm tra diff**

Run: `git diff --check`
Run: `git status --short`
Expected: không có whitespace error; `.runtime` không xuất hiện.

- [ ] **Step 5: Commit checkpoint cuối**

```powershell
git add contracts docs backend ecoloop-campus-mobile frontend task_plan.md findings.md progress.md
git commit -m "test(e2e): verify proof-first manual review across roles"
```
