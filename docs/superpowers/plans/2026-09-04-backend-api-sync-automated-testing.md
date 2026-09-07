# Backend–API–Web Admin–Mobile Automated Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng bộ kiểm thử tự động dùng PostgreSQL thật để phát hiện và khóa hồi quy về hồ sơ khoa HYUTE, phân quyền, đóng góp rác, điểm, nhiệm vụ, đổi thưởng và đồng bộ Web Admin–Mobile.

**Architecture:** PostgreSQL test database là lớp kiểm chứng transaction; FastAPI TestClient kiểm chứng HTTP contract trên cùng database; mobile và Web Admin kiểm chứng adapter/UI theo contract đã khóa. Một E2E API runner thực hiện tuần tự student → volunteer → admin và xuất báo cáo lỗi chuẩn hóa.

**Tech Stack:** PostgreSQL 16, psycopg 3, pytest, FastAPI TestClient, React Testing Library/Jest, Node test, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-04-backend-api-sync-automated-testing-design.md`

## Global Constraints

- Hồ sơ học vụ chỉ có khoa; không tạo trường lớp, ngành, chuyên ngành hoặc khóa học.
- Mọi test database phải dùng `TEST_DATABASE_URL`; từ chối chạy nếu database name không kết thúc bằng `_test`.
- Không dùng database ứng dụng trong test; không ghi mật khẩu/connection string vào source, log hoặc báo cáo.
- Điểm, tồn kho, status và audit history chỉ thay đổi qua PostgreSQL transaction được chỉ định.
- Mỗi defect phải có test đỏ tái hiện trước khi sửa; không sửa nhiều nguyên nhân trong một checkpoint.
- Mock được phép ở UI/adapter, không được mock PostgreSQL business function trong integration/E2E core flow.

---

## Danh mục lỗi/rủi ro phải khóa bằng test

| Mã | Mức | Trạng thái hiện tại | Sai lệch cần xác minh |
|---|---:|---|---|
| ECL-WEB-001 | P1 | Đã tái hiện | 6 test Bins fail sau khi mã thùng/QR chuyển sang tự sinh; test vẫn nhập mã và dùng nhãn cũ. |
| ECL-AUTH-001 | P0 | Đã sửa (`53bef392`) | Bearer token của tài khoản vừa bị locked/rejected vẫn có thể gọi protected endpoint vì guard chưa kiểm tra status. |
| ECL-DATA-001 | P0 | Đã sửa (`53bef392`) | Student/volunteer nhận toàn bộ users, submissions, feedback, point history, proof và QR logs qua `initial-data`. |
| ECL-POINT-001 | P0 | Đã sửa (`4c61a982`) | Generic admin resource cho phép ghi trực tiếp `users.points` và `point-history`, bypass audit transaction. |
| ECL-SUB-001 | P1 | Đã sửa (`42230d2b`) | Tình nguyện viên khác người scan có thể upload proof/xác nhận submission. |
| ECL-SUB-002 | P0 | Đã sửa (`4c61a982`) | Generic admin update có thể đổi trạng thái submission mà không cộng điểm/ghi history đúng state machine. |
| ECL-MISSION-001 | P0 | Đã sửa (`682775be`) | Student có thể gọi API advance mission trực tiếp để tăng tiến độ và nhận điểm không dựa trên event đã xác minh. |
| ECL-REWARD-001 | P0 | Đã sửa (`a8f8baf0`) | Reject/cancel sau scan hoàn điểm nhưng không hoàn tồn kho. |
| ECL-REWARD-002 | P1 | Đã sửa (`a8f8baf0`) | Scan trả `scanned`, trái contract nghiệp vụ quét là đã bàn giao và phải `fulfilled`. |
| ECL-REWARD-003 | P1 | Đã sửa (`a8f8baf0`) | Cạnh tranh tồn kho được kiểm tra lúc tạo batch nhưng thiếu business error rõ ràng tại thời điểm scan. |
| ECL-PROFILE-001 | P1 | Chưa triển khai | Register chưa yêu cầu/validate mã sinh viên, khoa HYUTE, số điện thoại và email trường. |
| ECL-SYNC-001 | P1 | Khoảng trống test | Chưa có test trên một PostgreSQL thật chứng minh mobile mutation và admin query nhìn thấy cùng status/điểm/tồn kho. |

---

### Task 1: Khóa baseline và sửa drift của test Web Admin

**Files:**
- Modify: `frontend/eco-loop-campus-admin/src/App.test.js`
- Test: `frontend/eco-loop-campus-admin/src/admin/pages/BinsPageSource.test.js`

**Interfaces:**
- Consumes: UI mã thùng `ECL-BIN-NNNN` tự sinh và QR `ECL-ST-<bin-id>` chỉ đọc.
- Produces: baseline Web Admin không còn lỗi do test nhập trường readonly/nhãn cũ.

- [x] Cập nhật 6 case Bins để lấy `Mã thùng tự sinh` bằng exact accessible name, không `fireEvent.change` vào mã thùng.
- [x] Với test tạo mới, đọc id đã sinh từ input readonly rồi assert request có cùng `id` và QR tương ứng.
- [x] Thay assertion `/mã qr chuẩn/i` bằng exact name `Mã QR tự sinh` và đặt mọi query trong `within(dialog)`.
- [x] Thay test duplicate id thủ công bằng case sinh mã kế tiếp khi danh sách có lỗ/trùng; duplicate phía backend được kiểm tra ở integration test.
- [x] Chạy:

```powershell
cd frontend/eco-loop-campus-admin
npm.cmd test -- --watchAll=false --runInBand src/App.test.js src/admin/pages/BinsPageSource.test.js
```

Expected: 0 fail; các assertion chứng minh input readonly và mã được sinh từ dữ liệu hiện có.

- [x] Chạy full admin suite; ghi `ECL-WEB-001` là fixed chỉ khi toàn bộ suite pass.
- [x] Commit checkpoint: `test(admin): align bin tests with generated station codes` (`92fa5f80`).

### Task 2: Tạo PostgreSQL integration harness an toàn

**Files:**
- Create: `backend/pytest.ini`
- Create: `backend/conftest.py`
- Create: `backend/test_support/postgres.py`
- Create: `backend/test_postgres_integration_smoke.py`

**Interfaces:**
- Consumes: `TEST_DATABASE_URL` từ environment/runtime test config.
- Produces: fixtures `postgres_test_url`, `reset_test_database`, `seed_operating_catalog`, `api_client`.

- [x] Thêm marker `postgres` và mặc định không chạy integration test khi thiếu `TEST_DATABASE_URL`; CI/nightly phải coi thiếu biến là lỗi cấu hình.
- [x] Fixture parse URL, kết nối `select current_database()` và dừng ngay nếu tên không khớp `*_test`.
- [x] `backend/conftest.py` import/đăng ký fixtures từ `test_support/postgres.py` để mọi integration module dùng cùng guard và cleanup.
- [x] Fixture session áp `backend/local_db/schema.sql`; fixture function truncate đúng danh sách bảng test bằng `TRUNCATE ... RESTART IDENTITY CASCADE` sau khi đã qua guard tên database.
- [x] Seed tối thiểu bằng SQL parametrized: admin active, hai student, hai volunteer active, một volunteer pending, hai bins, hai waste types, hai rewards và một mission.
- [x] Viết smoke test gọi PostgreSQL trực tiếp để chứng minh schema idempotent, seed đọc được và cleanup không chạm database khác.
- [x] Chạy:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -m postgres test_postgres_integration_smoke.py -v
```

Expected: PASS trên `ecoloop_campus_test`; FAIL trước khi chạy SQL nếu URL trỏ database không có hậu tố `_test`.

- [x] Commit checkpoint: `test(backend): add guarded PostgreSQL integration harness` (`dfd4ea4c`).

### Task 3: Khóa contract hồ sơ sinh viên chỉ có khoa

**Files:**
- Create: `backend/test_profile_postgres_integration.py`
- Modify: `backend/test_auth_endpoints.py`
- Test: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/services/backendMobileStore.test.ts`
- Test: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/screens/LoginScreenSource.test.ts`

**Interfaces:**
- Consumes: `Faculty`, register/profile API được mô tả trong spec.
- Produces: contract không có `major`, `specialization`, `classCode`, `cohort` ở request, response hay mobile type.

- [x] Viết test đỏ xác nhận `GET /api/catalog/faculties` trả đúng 11 mã/tên, đúng thứ tự và không trả khoa inactive.
- [x] Viết table-driven test đỏ cho register: thiếu từng trường bắt buộc, `facultyCode` lạ, email sai định dạng/tên miền, mã sinh viên trùng không phân biệt hoa thường, phone sai, role lạ.
- [x] Viết happy-path student active và volunteer pending; assert password không xuất hiện trong response và hash được lưu.
- [x] Viết migration test cho account cũ: login trả `requiresProfileCompletion=true`; protected business endpoint bị chặn cho tới khi `PATCH /api/users/me/profile` thành công.
- [x] Viết test dropdown mobile tải dữ liệu từ API, gửi `facultyCode`, hiển thị lỗi API; source/type assertion phải đảm bảo không tồn tại trường ngành/chuyên ngành/lớp.
- [x] Chạy backend profile tests, mobile test và typecheck; ghi mọi mismatch bằng mã `ECL-PROFILE-*`.
- [x] Commit checkpoint: `test(profile): cover HYUTE faculty-only registration contract` (`28f820a4`).

### Task 4: Kiểm thử authentication, authorization và privacy payload

**Files:**
- Create: `backend/test_authorization_postgres_integration.py`
- Modify: `backend/test_mobile_postgres_endpoints.py`
- Test: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/services/backendMobileStore.test.ts`

**Interfaces:**
- Consumes: bearer token thật của seeded users và `/api/mobile/initial-data`.
- Produces: ma trận role/status × endpoint và payload allowlist theo role.

- [x] Parametrize mọi protected endpoint với thiếu token, token hỏng, student, volunteer pending/active, locked, rejected và admin.
- [x] Tạo token khi user active, sau đó khóa user trong DB và gọi lại endpoint; expected `403`, không chỉ chặn lần login kế tiếp.
- [x] Student initial-data: assert chỉ có record sở hữu; users cho leaderboard không có `email`/`phoneNumber`; không có feedback/proof/QR log của người khác.
- [x] Volunteer initial-data: assert chỉ có workload được phép và log của chính actor; không nhận toàn bộ point history/redemptions.
- [x] Admin endpoint: assert student/volunteer đều `403`; admin nhận dữ liệu đầy đủ.
- [x] Kiểm tra response bằng allowlist key thay vì chỉ assert một key có tồn tại, để field nhạy cảm mới thêm không lọt qua.
- [x] Chạy test đỏ trước sửa cho `ECL-AUTH-001` và `ECL-DATA-001`; sau sửa chạy lại hai lần để loại lỗi phụ thuộc thứ tự.
- [x] Commit checkpoint: `test(auth): enforce active accounts and role-scoped mobile data` (`53bef392`).

### Task 5: Kiểm thử transaction đóng góp rác và ownership tình nguyện viên

**Files:**
- Create: `backend/test_submission_postgres_integration.py`
- Modify: `backend/test_qr_postgres_endpoints.py`
- Test: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/services/backendMobileStore.test.ts`

**Interfaces:**
- Consumes: create, scan, proof, confirm, reject và review endpoints.
- Produces: một state machine nhất quán và invariant điểm/history.

- [x] Happy-path thật: student create → volunteer A scan đúng station → A upload proof → A confirm; assert submission `POINT_CONFIRMED`, balance tăng đúng một lần, một history có đúng `submission_id`.
- [x] Parametrize `INVALID_TOKEN`, `WRONG_STATION`, `EXPIRED`, `ALREADY_USED`, quantity `0/âm/null`, station/waste inactive và proof thiếu.
- [x] Chạy hai confirm đồng thời cho cùng submission; đúng một request thành công, balance/history không nhân đôi.
- [x] Volunteer B thử proof/confirm/reject/review submission do A scan; expected `403` hoặc business error, admin override được và có actor trong audit.
- [x] Admin generic resource thử ghi trực tiếp `POINT_CONFIRMED`, `users.points` và `point-history`; expected bị từ chối, chứng minh không bypass state machine.
- [x] Sau mỗi transition gọi API admin và mobile initial-data; assert cùng `id`, status, actual quantity, actor, points và history reference.
- [x] Chạy test đỏ cho `ECL-SUB-001`, `ECL-SUB-002`, `ECL-POINT-001`; sửa từng root cause riêng và chạy regression.
- [x] Commit checkpoints: `4c61a982`, `42230d2b`, `411283f5`.

### Task 6: Kiểm thử nhiệm vụ chống tự cộng điểm

**Files:**
- Create: `backend/test_mission_postgres_integration.py`
- Modify: `backend/test_mobile_postgres_endpoints.py`
- Test: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/context/AppContext.test.ts`

**Interfaces:**
- Consumes: persisted domain event `submission confirmed` hoặc `feedback created`.
- Produces: mission progress idempotent theo `eventType + eventId + missionId`.

- [x] Test đỏ gọi trực tiếp advance endpoint nhiều lần bằng student mà không có event; expected không tăng tiến độ/điểm.
- [x] Xác nhận submission hợp lệ và assert backend tự tăng đúng mission; refresh/retry cùng event không tăng lần hai.
- [x] Feedback hợp lệ tăng đúng mission một lần; feedback replay cùng id không trả thưởng lại.
- [x] Race hai request cho event cuối cùng của mission; balance và history chỉ nhận một reward.
- [x] Mobile test bỏ orchestration tăng nhiệm vụ phía client; mobile chỉ reload progress do backend trả về.
- [x] Khóa `ECL-MISSION-001` bằng integration test và commit: `test(missions): require verified backend events for progress` (`682775be`).

### Task 7: Kiểm thử đổi điểm/đổi thưởng và cạnh tranh transaction

**Files:**
- Create: `backend/test_reward_postgres_integration.py`
- Modify: `backend/test_qr_postgres_endpoints.py`
- Test: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/services/backendMobileStore.test.ts`
- Test: `frontend/eco-loop-campus-admin/src/admin/services/supabaseStore.test.js`

**Interfaces:**
- Consumes: create batch, scan/handover và admin reversal.
- Produces: `pending → fulfilled → cancelled` với điểm/tồn kho/history nguyên tử.

- [x] Create batch: nhiều item/số lượng, item trùng, reward inactive/không tồn tại, số lượng sai, hết hàng, batch active, QR TTL và snapshot giá/tên.
- [x] Assert create chỉ giữ yêu cầu, chưa trừ điểm/kho.
- [x] Scan happy-path: expected `fulfilled`, set `scannedBy/scannedAt/fulfilledAt`, trừ đúng tổng điểm và kho, ghi đúng một history.
- [x] Parametrize QR sai/hết hạn/đã dùng, actor pending/locked, số dư thay đổi sau create và stock thay đổi sau create; trả business error ổn định, không để partial write.
- [x] Chạy hai scan đồng thời cùng QR và hai batch tranh item cuối; một giao dịch thắng, giao dịch còn lại có mã lỗi xác định, stock không âm.
- [x] Admin reversal: hoàn cả điểm và từng reward stock đúng một lần; reversal lần hai bị từ chối và không tạo history thứ hai.
- [x] Mobile adapter/UI và admin mapper assert cùng status `fulfilled/cancelled`; loại bỏ giả định cần admin finalize sau scan.
- [x] Khóa `ECL-REWARD-001/002/003` và commit: `test(rewards): cover atomic handover refund and concurrency` (`a8f8baf0`).

### Task 8: Contract sync Web Admin–Mobile và lỗi mạng

**Files:**
- Create: `backend/test_client_contract_snapshots.py`
- Create: `frontend/eco-loop-campus-admin/src/admin/services/backendContract.test.js`
- Create: `ecoloop-campus-mobile/ecoloop-campus-mobile/src/services/backendContract.test.ts`

**Interfaces:**
- Consumes: canonical JSON fixtures sinh từ backend response serializer.
- Produces: cùng field/status/nullable semantics cho cả hai client.

- [x] Khóa payload mẫu cho user, faculty, submission, point history, reward batch/item và error envelope `{detail, code}`.
- [x] Test camelCase mapping hai client với `null`, timestamp UTC, Unicode tiếng Việt, numeric fields và unknown optional field.
- [x] Test `401/403/404/409/422/503`, timeout, JSON hỏng và backend offline; UI không được tạo local success hoặc dùng dữ liệu mock như dữ liệu thật.
- [x] Test refresh/polling sau mutation: không duplicate row, không rollback optimistic state sai, không giữ status cũ khi server đã đổi.
- [x] Assert Web Admin write dùng transaction endpoint cho điểm/submission/reward, không generic resource mutation.
- [x] Commit checkpoint: `test(contract): lock shared backend payloads across clients` (`1c470378`).

### Task 9: E2E API hai vai trò và báo cáo lỗi tự động

**Files:**
- Create: `backend/test_e2e_role_sync.py`
- Create: `scripts/run_automated_logic_tests.ps1`
- Create: `docs/testing/DEFECT_REPORT_TEMPLATE.md`
- Create: `docs/testing/AUTOMATED_TEST_MATRIX.md`

**Interfaces:**
- Consumes: test suites ở Task 1–8 và `TEST_DATABASE_URL`.
- Produces: exit code chung, JUnit XML theo tầng và defect report dễ truy vết.

- [x] Scenario A: đăng ký student với khoa → login → create submission → volunteer login/scan/proof/confirm → student/admin reload và so balance/status/history.
- [x] Scenario B: student tạo reward batch → volunteer scan/handover → mobile/admin reload → admin reversal → so balance/stock/status/history.
- [x] Scenario C: pending/locked/khác owner thử từng action và xác nhận không có DB mutation.
- [x] Runner chạy tuần tự backend unit, PostgreSQL integration, mobile tests/typecheck và admin tests; lưu JUnit vào `.test-results/` đã gitignore.
- [x] `AUTOMATED_TEST_MATRIX.md` map Requirement → Test ID → Layer → Expected invariant → Defect ID; không ghi kết quả chạy tạm thời vào spec.
- [x] Mẫu lỗi bắt buộc có:

```markdown
## ECL-AREA-NNN — Tiêu đề
- Severity: P0 | P1 | P2 | P3
- Commit / môi trường:
- Trạng thái: Reproduced | Static finding | Fixed | Retest failed
- Dữ liệu chuẩn bị:
- Bước tái hiện:
- Expected:
- Actual:
- HTTP/SQL evidence:
- Ranh giới lỗi: Client | API | Authorization | Transaction | Database
- Ảnh hưởng dữ liệu/người dùng:
- Root cause đã xác nhận:
- Regression test:
```

- [x] Full gate chạy hai lần liên tiếp trên database test sạch. Gate đạt khi backend unit/integration, mobile/typecheck và Web Admin đều exit `0`, không có P0/P1 mở và không có test core flow bị skip.
- [x] Commit checkpoint: `test(e2e): add cross-role sync suite and defect reporting`.

## Thứ tự xử lý lỗi

1. Sửa baseline `ECL-WEB-001` để tín hiệu test đáng tin.
2. Chặn `ECL-AUTH-001`, `ECL-DATA-001`, `ECL-POINT-001`, `ECL-SUB-002`, `ECL-MISSION-001`, `ECL-REWARD-001` trước vì có thể lộ dữ liệu hoặc làm sai sổ điểm/tồn kho.
3. Xử lý ownership/state mismatch `ECL-SUB-001`, `ECL-REWARD-002/003`.
4. Hoàn thiện profile khoa `ECL-PROFILE-001`.
5. Chỉ đóng `ECL-SYNC-001` sau khi E2E hai vai trò pass hai lần trên PostgreSQL test sạch.
