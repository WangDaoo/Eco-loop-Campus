# Kiểm kê lỗi ban đầu — 2026-09-04

## Baseline

| Tầng | Kết quả |
|---|---|
| Backend pytest | 72 passed, 52 deprecation warnings |
| Mobile Node test | 216 passed |
| Mobile TypeScript | PASS |
| Web Admin Jest | 263 passed, 16 skipped, 0 failed (retest 2026-09-05) |

Backend và mobile hiện pass nhưng các core-flow test chủ yếu mock database/fetch. Vì vậy kết quả này chưa chứng minh transaction PostgreSQL và đồng bộ hai client.

## Lỗi đã tái hiện

### ECL-WEB-001 — Test Bins không còn khớp UI mã tự sinh

- Severity: P1 vì full Web Admin test gate đang đỏ.
- Actual: 6 test trong `frontend/eco-loop-campus-admin/src/App.test.js` fail.
- Root cause sơ bộ: UI đã có hai input readonly tên “Mã thùng tự sinh” và “Mã QR tự sinh”; test vẫn tìm regex rộng `/mã thùng/i`, nhập id thủ công và tìm nhãn “Mã QR chuẩn”.
- Các case fail:
  1. `bins page creates a station and exposes QR scan link`
  2. `bins page rejects duplicate station ids when creating a station`
  3. `bins page rejects blank required station fields after trimming`
  4. `bins page edits a station without changing its id`
  5. `bins page allows editing a station while keeping its own QR code`
  6. `bins page clamps invalid capacity and map coordinates before saving`
- Expected: test đọc id tự sinh, không sửa input readonly, dùng exact accessible name và assert payload theo id được sinh.
- Regression command: `npm.cmd test -- --watchAll=false --runInBand src/App.test.js`.
- Status: **Đã sửa** ngày 2026-09-05. Full gate `npm.cmd test -- --watchAll=false --runInBand` pass 263, skip 16, exit code 0.
- Fix: test dùng exact accessible name, không ghi input readonly, đọc/khẳng định mã tự sinh và chờ dữ liệu bins tải xong trước khi mở form.

## Phát hiện tĩnh cần test đỏ xác nhận

### ECL-AUTH-001 — Token cũ không bị vô hiệu hóa khi tài khoản bị khóa

- Status: **Đã sửa** trong `53bef392`; PostgreSQL integration test xác nhận token cũ trả `403` và không phát sinh mutation.
- Evidence: `backend/app.py` guard `require_role_user` chỉ so role; profile đọc từ DB có status nhưng guard không yêu cầu `active`.
- Reproduction test: login active, lấy token, admin lock user, dùng token gọi create submission/initial-data.
- Expected: mọi protected endpoint trả `403`; database không đổi.

### ECL-DATA-001 — Mobile initial-data trả dữ liệu toàn hệ thống

- Status: **Đã sửa** trong `53bef392`; payload student/volunteer được lọc theo actor/role ngay tại SQL và leaderboard dùng allowlist public.
- Evidence: `backend/app.py:916-928` list toàn bộ users, predictions, submissions, point history, feedback, redemptions, proofs và QR logs, không có where theo actor/role.
- Reproduction test: seed hai student và dữ liệu riêng; student A gọi initial-data.
- Expected: A không nhìn thấy email/phone, feedback, submission, point history, reward hoặc proof của B.

### ECL-POINT-001 — Generic admin API bypass sổ điểm

- Status: **Đã sửa** trong `4c61a982`; integration test xác nhận balance/history/submission không đổi khi gọi generic resource.
- Evidence: `ADMIN_RESOURCES.users.writable` có `points`; `point-history` cũng writable trực tiếp.
- Reproduction test: admin POST resource đổi balance hoặc insert history không qua `adjust_manual_points`.
- Expected: endpoint generic từ chối field/bảng này; balance và history chỉ thay đổi cùng transaction.

### ECL-SUB-001 — Thiếu ownership tình nguyện viên

- Status: **Đã sửa** trong `42230d2b`; volunteer B bị chặn upload proof và mọi transition của submission do volunteer A scan.
- Evidence: `confirm_recycling_submission` kiểm tra actor active và status `QR_SCANNED`, nhưng không so `verified_by` với actor; proof endpoint cũng chỉ kiểm tra role.
- Reproduction test: volunteer A scan, volunteer B upload proof và confirm.
- Expected: B bị chặn; admin override được và có audit.

### ECL-SUB-002 — Admin có thể bỏ qua state machine submission

- Status: **Đã sửa** trong `4c61a982`; direct POST generic trả `405` và database invariants giữ nguyên.
- Evidence: generic resource cho phép ghi `recycling-submissions.status`, actor, quantity và note trực tiếp.
- Reproduction test: admin đổi `CREATED` thành `POINT_CONFIRMED` qua generic endpoint.
- Expected: bị từ chối; không có trạng thái confirmed nếu thiếu scan/proof/point history.

### ECL-MISSION-001 — Client có thể tự gọi tăng nhiệm vụ

- Status: **Đã sửa** trong `682775be`; 4 PostgreSQL integration tests bao phủ direct abuse, submission/feedback idempotency và race final-event.
- Evidence: `POST /api/mobile/missions/{id}/advance` tăng progress và trả thưởng; mobile tự gọi endpoint sau create submission/feedback.
- Reproduction test: student gọi advance liên tiếp mà không tạo domain event.
- Expected: tiến độ chỉ sinh từ event backend đã lưu và idempotent theo event id.

### ECL-REWARD-001 — Hoàn điểm nhưng không hoàn tồn kho

- Status: **Đã sửa** trong `a8f8baf0`; reversal nhiều item hoàn cả balance/stock một lần, replay bị từ chối và không tạo history thứ hai.

- Evidence: `finalize_reward_redemption_batch` cộng lại user points khi reject/cancel, nhưng không update `rewards.stock`.
- Reproduction test: stock 1 → scan → stock 0 → cancel.
- Expected: stock trở lại 1, điểm trở lại ban đầu, một refund history.

### ECL-REWARD-002 — Trạng thái scan không khớp nghiệp vụ bàn giao

- Status: **Đã sửa** trong `a8f8baf0`; scan trả/persist `fulfilled` cùng `scannedAt` và `fulfilledAt`; Mobile/Admin đọc cùng status.

- Evidence: `scan_reward_redemption_batch` ghi/trả `scanned`; thiết kế đã chốt quét QR là đã bàn giao.
- Reproduction test: volunteer scan QR hợp lệ rồi reload mobile/admin.
- Expected: cả hai client thấy `fulfilled` ngay, có `fulfilledAt`.

### ECL-REWARD-003 — Race tồn kho chưa có lỗi nghiệp vụ ổn định

- Status: **Đã sửa** trong `a8f8baf0`; hai batch tranh stock `1` cho đúng một winner, loser nhận `REWARD_OUT_OF_STOCK`, balance/history không partial.

- Evidence: stock được kiểm tra khi tạo batch, nhưng scan chỉ thực hiện phép trừ; batch khác có thể tiêu thụ stock trước.
- Reproduction test: hai student tạo batch khi stock 1 rồi scan đồng thời.
- Expected: đúng một scan thành công; scan thua nhận error code ổn định; stock không âm và không bị trừ điểm.

### ECL-PROFILE-001 — Chưa có hồ sơ khoa HYUTE chuẩn hóa

- Status: **Đã sửa** trong `28f820a4`; PostgreSQL, Mobile và Web Admin dùng cùng `studentCode`, `facultyCode`, `phoneNumber`, dropdown đúng 11 khoa HYUTE và không có lớp/ngành/chuyên ngành.
- Evidence: schema và register hiện chỉ có trường `group`; chưa có `studentCode`, `facultyCode`, `phoneNumber` hay cờ hoàn thiện.
- Reproduction test: register gửi thiếu/sai faculty hoặc trùng mã sinh viên hiện vẫn không có contract tương ứng.
- Expected: bắt buộc mã sinh viên, khoa trong 11 lựa chọn, số điện thoại và email trường; không có lớp/ngành/chuyên ngành.

### ECL-SYNC-001 — Chưa có bằng chứng đồng bộ trên database thật

- Status: **Đã sửa và xác minh hai lượt** trong Task 8–9; contract snapshot và E2E Scenario A/B/C so cùng id, status, balance, stock, items, profile và history giữa Mobile/Admin trên PostgreSQL test.
- Retest 2026-09-05: mỗi lượt có Backend unit `78 passed`, PostgreSQL integration `71 passed`, Mobile `223 passed`, typecheck pass, Web Admin `273 passed` và `16 skipped` fallback legacy; mọi core-flow test đều chạy, exit code chung `0`.
- Evidence: backend core endpoint tests monkeypatch business functions; mobile mock fetch; admin nhiều mapper test còn mang tên Supabase.
- Reproduction test: một test database, student mutation, volunteer mutation rồi admin/mobile reload.
- Expected: cùng id/status/balance/stock/history ở tất cả API views.

## Quy tắc cập nhật báo cáo

- Chỉ đổi “phát hiện tĩnh” thành “đã tái hiện” khi test đỏ chạy được ổn định.
- Chỉ đổi thành “đã sửa” khi test hồi quy xanh và full gate không phát sinh lỗi mới.
- Mỗi lần retest ghi commit, lệnh chạy, exit code và phần database invariant đã kiểm tra; không ghi secrets.
