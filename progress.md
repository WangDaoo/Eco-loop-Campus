# Progress — EcoLoop Campus automated testing plan

## 2026-09-04

- Đã đọc các skill: using-superpowers, brainstorming, planning-with-files, writing-plans, code-review và systematic-debugging.
- Đã phân loại công việc là kiến trúc kiểm thử đa thành phần.
- Đã kiểm kê framework test và các file test hiện có.
- Đã xác nhận phạm vi hồ sơ chỉ dùng khoa, không dùng ngành/chuyên ngành.
- Đang đối chiếu contract và chạy baseline trước khi viết kế hoạch cuối.
- Baseline backend pass 72/72; mobile pass 216/216 và typecheck pass.
- Baseline Web Admin fail 6 test Bins, pass 257 và skip 16.
- Đã xác định 9 sai lệch/rủi ro logic cần test đỏ, gồm phân quyền initial-data, hoàn tồn kho, trạng thái reward, ownership tình nguyện viên, token của tài khoản bị khóa, generic admin bypass, mission tự tăng và hồ sơ khoa.
- Đã viết design contract tại `docs/superpowers/specs/2026-09-04-backend-api-sync-automated-testing-design.md`.
- Đã viết implementation plan 9 task tại `docs/superpowers/plans/2026-09-04-backend-api-sync-automated-testing.md`.
- Đã viết kiểm kê lỗi ban đầu tại `docs/testing/INITIAL_DEFECT_AUDIT_2026-09-04.md`.
- Đã tự rà soát placeholder, tên contract, phạm vi chỉ có khoa và `git diff --check`; không phát hiện lỗi whitespace/placeholder.

## 2026-09-05

- Task 1 hoàn tất: cập nhật 6 test Bins cũ theo contract mã thùng/QR tự sinh và nhãn accessible hiện tại.
- Bổ sung regression cho dãy mã có khoảng trống; test chờ dữ liệu API tải xong trước khi mở form để tránh kiểm tra race của UI.
- Focused gate: 10/10 test Bins pass.
- Full Web Admin gate: 25/25 suites pass; 263 passed, 16 skipped, exit code 0.
- Bắt đầu Task 2: PostgreSQL integration harness sử dụng riêng `TEST_DATABASE_URL` và từ chối database không có hậu tố `_test`.
- Task 2 hoàn tất: PostgreSQL smoke suite pass 4/4 trên `ecoloop_campus_test`; API client đăng nhập bằng dữ liệu seed thật.
- Full backend gate sau khi thêm harness: 73 passed, 2 PostgreSQL tests skipped khi thiếu biến, 52 warnings, exit code 0.
- Checkpoint commits: `92fa5f80` (Task 1) và `dfd4ea4c` (Task 2).
- Chuyển sang thứ tự P0 do chủ dự án chốt: Task 4 auth/privacy trước, hồ sơ Task 3 để cuối.
- P0-A hoàn tất: token cũ của account không còn dùng được sau khi khóa; `initial-data` được lọc tại SQL theo role/owner. Commit `53bef392`.
- P0-B hoàn tất theo hai root cause/commit riêng: chặn generic admin bypass transaction (`4c61a982`) và bắt buộc tình nguyện viên sở hữu submission đã scan khi upload proof/chuyển trạng thái (`42230d2b`).
- P0-C đã chạy test đỏ xác nhận direct mission advance có thể tự tăng và schema cũ không nhận status `completed`/chưa có event metadata.
- P0-C đã sửa bằng domain-event PostgreSQL idempotent, thưởng mission nguyên tử, bỏ orchestration phía Mobile và bổ sung race test hai event cuối đồng thời.
- Gate P0-C: mission integration 4/4; full Backend 89/89; Mobile 216/216; TypeScript typecheck pass. Commit `682775be`.
- Bắt đầu P0-D/Task 7: đổi thưởng, hoàn tồn kho và cạnh tranh transaction.
- P0-D/Task 7 hoàn tất: scan là handover nguyên tử `pending → fulfilled`; kiểm tra lại điểm/kho dưới row lock; QR hết hạn được persist; admin reversal `fulfilled → cancelled` hoàn điểm và từng item stock đúng một lần.
- Test đổi thưởng PostgreSQL thật 20/20 bao phủ quantity/catalog sai, TTL, active batch, invalid/replay QR, locked actor, balance/stock stale, hai scan đồng thời, hai batch tranh item cuối, refund và cùng status ở Mobile/Admin.
- Full gate Task 7: Backend 107 passed; Mobile 216 passed; typecheck pass; Web Admin 263 passed, 16 skipped. Commit `a8f8baf0`.
- Chuyển sang hoàn thiện luồng đóng góp rác thật và E2E đồng bộ xuyên client.
- Task 5 hoàn tất: luồng thật create → scan → upload proof → confirm được chạy qua FastAPI/PostgreSQL; số thập phân được bind đúng kiểu numeric, points/history chỉ ghi một lần và Mobile/Admin đọc cùng row.
- Bổ sung validation số lượng create/confirm, chặn station full và waste inactive, map business error ổn định; 20/20 submission integration tests pass, auth + submission regression 25/25 pass.
- Full backend lần đầu sau thay đổi có 125 pass và một test contract cũ đòi snake_case; đã cập nhật assertion sang canonical `referenceId`. Mobile 216/216 và typecheck pass. Commit `411283f5`.
- Bắt đầu Task 3 theo thứ tự chủ dự án: hồ sơ mã sinh viên + dropdown 11 khoa HYUTE + số điện thoại, không có ngành/chuyên ngành/lớp.
- Task 3 hoàn tất và commit `28f820a4`: profile PostgreSQL/API/Mobile/Admin đồng bộ; Backend 140, Mobile 221, Admin 264 cùng typecheck đều xanh tại checkpoint.
- Task 8 hoàn tất và commit `1c470378`: canonical fixtures, error envelope và client contract khóa user/faculty/submission/point/reward items; Web Admin submission review dùng state-machine endpoint.
- Task 9 bổ sung ba E2E xuyên vai trò, runner có guard database `_test`, JUnit từng tầng, ma trận test và mẫu defect.
- Full gate chạy hai lượt liên tiếp trên database test sạch: mỗi lượt Backend unit 78/78, PostgreSQL integration 71/71, Mobile 223/223, typecheck pass, Web Admin 273/273 với 16 fallback legacy skip; exit code chung 0.
- Bắt đầu UAT APK hai thiết bị: người dùng xác nhận điện thoại không cùng Wi-Fi và duyệt phương án APK standalone dùng public tunnel.
- Đã xác định `assembleDebug` phụ thuộc Metro; chọn build type `uat` kế thừa release và ký debug key để cài/test độc lập.
- TDD RED: `scripts/uat_setup.test.ps1` exit 1 đúng lý do thiếu `scripts/setup_uat.ps1`; test cũng khóa database `_uat`, tunnel, JS bundle, checksum, tài khoản UAT và cleanup theo PID.
- TDD GREEN: thêm build type Android `uat`, URL file PostgreSQL tùy chọn có chặn path traversal, mật khẩu seed override từ runtime, setup/stop script và hướng dẫn test hai thiết bị.
- Systematic debugging xác định JDK lỗi do workspace Unicode, không phải phiên bản/corrupt archive; regression guard buộc UAT bootstrap dùng ổ `subst` ASCII.
- Đã tạo `ecoloop_campus_uat`, seed 18 users và dữ liệu nghiệp vụ, khởi chạy backend port 8010 cùng Cloudflare Quick Tunnel.
- Build `createBundleUatJsAndAssets` thành công trong 6m40s; `assembleUat` thành công trong 15m03s với 1098 task.
- Bản APK pre-review có SHA-256 `a3508f386d7f1b8ea066564e6acf131d6c46c5d94ae968419cf1db570868bc75`; đã được thay thế sau hardening vòng đời UAT.
- Code review UAT phát hiện các rủi ro cleanup không tới được, wrapper PID thay vì child PID, PID reuse, port bị chiếm, health nhầm database, dùng chung auth secret, stock seed vô hạn và restart reset dữ liệu.
- TDD hardening: thêm process identity gồm executable/start time, kiểm tra tương thích Windows PowerShell/PowerShell 7, port guard, exact database health, auth secret UAT riêng, seed marker/`-ResetData`, tồn kho hữu hạn và cleanup khi tunnel lỗi.
- Re-review phát hiện health timeout có thể xảy ra trước khi lưu service PID; đã lưu identity launcher ngay sau launch và cleanup cả cây process đã xác thực. Test parent→child pass trên PowerShell 7 và Windows PowerShell; outer environment restore nay bao trùm cả bootstrap/init sớm.
- Seed CLI không còn in runtime password; regression mới chứng minh secret override không xuất hiện trong stdout.
- Behavioral lifecycle verification: stop chỉ dừng đúng backend/cloudflared đã ghi nhận; identity giả bị từ chối; setup thất bại dọn sạch listener/PID; restart không `-ResetData` giữ stock đã đổi từ 30 xuống 29.
- APK UAT cuối 116093416 bytes; SHA-256 `367d9025badd3ba54dbbc4eb3446951e57d858614b31154f9f156c6befe6f6d8`.
- Artifact verification cuối: checksum khớp, chữ ký APK v1/v2 hợp lệ, package `com.ecoloopcampus.mobile.uat`, nhãn `Eco-loop Campus UAT`, version `1.0.0-uat`, bundle chứa public API URL, public database health `ok` trên `ecoloop_campus_uat`, auth secret tách biệt và stock badge bằng 30.
- Full gate cuối exit 0: Backend unit 80/80; PostgreSQL integration 71/71; Mobile 223/223 và typecheck pass; Web Admin 273/273 với 16 legacy fallback skip.
