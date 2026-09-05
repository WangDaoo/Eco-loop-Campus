# Findings — EcoLoop Campus automated testing

## Quan sát ban đầu

- Backend dùng FastAPI, psycopg và PostgreSQL functions cho các transaction chính.
- Web Admin dùng React Scripts/Jest và vẫn còn một số lớp tương thích Supabase/localStorage.
- Mobile dùng Expo/React Native, TypeScript và `node:test`.
- Test hiện có bao phủ nhiều unit/source guard, nhưng chưa chứng minh đầy đủ E2E giữa hai client và một PostgreSQL thật.
- Schema người dùng hiện chỉ có trường `group`; chưa có danh mục `faculty` chuẩn hóa.
- Reward hiện có trạng thái trung gian `scanned` và endpoint admin finalize, khác với quyết định nghiệp vụ mới “quét QR là đã bàn giao/fulfilled”.

## Baseline ngày 2026-09-04

- Backend: `72 passed`, có 52 cảnh báo deprecation; phần lớn endpoint test monkeypatch lớp database nên chưa kiểm chứng transaction PostgreSQL thật.
- Mobile: `216 passed`; TypeScript `tsc --noEmit` pass. Nhiều test là source guard hoặc mock fetch, chưa phải E2E với FastAPI/PostgreSQL.
- Web Admin: `257 passed`, `16 skipped`, `6 failed`. Cả 6 lỗi nằm trong `src/App.test.js` quanh luồng Bins sau khi mã thùng/QR được chuyển sang tự sinh; test vẫn nhập mã thủ công hoặc tìm nhãn cũ.

## Sai lệch/rủi ro tìm thấy từ code

1. `load_mobile_initial_data` trả toàn bộ `users`, predictions, submissions, point history, feedback, reward redemptions, proof images và QR logs cho mọi role được phép. Đây là rủi ro lộ dữ liệu và contract chưa phân vai.
2. `finalize_reward_redemption_batch` hoàn điểm khi reject/cancel sau scan nhưng không tăng lại `rewards.stock`.
3. `scan_reward_redemption_batch` trả `scanned`, trong khi nghiệp vụ đã chốt là quét QR đồng nghĩa đã giao quà và phải trả `fulfilled`.
4. `confirm_recycling_submission` không kiểm tra tình nguyện viên xác nhận có phải người đã scan/được gán hay không; một tình nguyện viên active khác có thể tác động lên giao dịch.
5. `require_role_user` chỉ kiểm tra role, không chặn user đã bị `locked/rejected/pending` nếu họ còn bearer token hợp lệ.
6. Generic admin resource cho phép ghi trực tiếp `users.points`, `point-history` và `recycling-submissions.status`, có thể bypass transaction/audit/state machine.
7. Mission progress và thưởng điểm được tăng từ endpoint do mobile chủ động gọi; sinh viên có thể gọi endpoint trực tiếp không gắn với event backend đã xác minh.
8. Hồ sơ hiện chỉ có `group`; chưa có `studentCode`, `facultyCode`, `phoneNumber` hoặc cờ hoàn thiện hồ sơ; register chưa kiểm tra email trường/mã sinh viên/khoa.
9. Reward stock chỉ được kiểm tra khi tạo batch, không được kiểm tra bằng lỗi nghiệp vụ rõ ràng ngay trước khi trừ lúc scan; cạnh tranh tồn kho có thể rơi xuống lỗi constraint PostgreSQL khó hiểu.

Các mục 1–9 là phát hiện tĩnh cần được khóa bằng test đỏ trên PostgreSQL/API thật trước khi sửa. Riêng 6 lỗi Web Admin đã được tái hiện bằng test suite hiện tại.

## Kết quả kiểm chứng P0 ngày 2026-09-05

- `ECL-AUTH-001` đã tái hiện và sửa: mọi protected request đều đọc trạng thái account hiện tại; token phát hành trước khi khóa trả `403` và không ghi dữ liệu.
- `ECL-DATA-001` đã tái hiện và sửa: student/volunteer chỉ nhận private collection thuộc quyền; leaderboard chỉ trả profile public tối thiểu của student active.
- `ECL-POINT-001` và `ECL-SUB-002` đã tái hiện và sửa: generic admin resource không thể ghi trực tiếp point history/submission state hoặc tạo user kèm balance/status đặc quyền.
- `ECL-SUB-001` đã tái hiện và sửa: chỉ volunteer đã scan mới được upload proof/confirm/reject/review; admin vẫn có override theo role.
- `ECL-MISSION-001` đã tái hiện và sửa: endpoint advance từ client trả `405`; submission-confirmed/feedback-created gọi PostgreSQL event idempotent trong cùng transaction. Hai final event đồng thời chỉ thưởng một lần.
- `ECL-REWARD-001/002/003` đã tái hiện và sửa trong `a8f8baf0`: scan khóa batch/user/reward rồi chuyển thẳng `fulfilled`; stock contention trả business error ổn định; admin cancellation hoàn điểm và stock một lần.
- Trước sửa, quantity không hợp lệ bị ép thành `1`, expired status bị rollback cùng exception, scan chỉ ghi `scanned`, và stock race rơi ra tên check constraint PostgreSQL. Các hành vi này hiện có regression test thật.

## Nguồn sự thật cần đối chiếu

- PostgreSQL: `backend/local_db/schema.sql`
- FastAPI: `backend/app.py`
- Mobile contracts/state: `ecoloop-campus-mobile/ecoloop-campus-mobile/src`
- Web Admin contracts/state: `frontend/eco-loop-campus-admin/src/admin`

## Kết quả hoàn tất Task 3, 8 và 9

- Hồ sơ sinh viên/tình nguyện viên đã chuẩn hóa theo mã sinh viên, một trong 11 khoa HYUTE và số điện thoại; account cũ phải hoàn thiện profile trước khi dùng business API.
- Contract snapshot dùng chung đã phát hiện và sửa việc Mobile làm rơi reward items, Web Admin hạ `fulfilled` thành `pending`, cùng đường ghi submission CRUD bỏ qua state machine.
- FastAPI trả error envelope ổn định `{detail, code}`; Mobile/Web Admin giữ lỗi HTTP, malformed JSON, timeout và offline thay vì báo local success.
- E2E Scenario A/B/C trên PostgreSQL thật chứng minh submission chỉ cộng một lần, reward debit/refund/stock nguyên tử và actor pending/locked/non-owner không tạo mutation.
- Full gate hai lượt liên tiếp đều exit `0`; không còn P0/P1 mở trong phạm vi 12 defect đã kiểm kê.

## Khảo sát UAT APK hai thiết bị

- Mobile mặc định dùng `10.0.2.2:8000`, chỉ phù hợp Android emulator; thiết bị ở mạng khác cần API public.
- `assembleDebug` là debuggable variant nên React Native bỏ bước bundle JS và đòi Metro; không phù hợp artifact gửi cho hai điện thoại từ xa.
- Android hiện có debug keystore và release đang ký bằng debug key. Biến thể `uat` kế thừa release, không minify và thêm application id suffix sẽ cho APK standalone nhưng vẫn tách khỏi app production.
- Repo đã có Cloudflare quick tunnel và ghi URL vào `.runtime/api_public_url.txt`; URL thay đổi khi tunnel restart.
- `setup_public_release.bat` đang gộp production/public release. UAT cần wrapper riêng với database hậu tố `_uat`, test accounts và artifact/checksum riêng.
- Seed demo mặc định dùng mật khẩu `123456`; public UAT phải override bằng mật khẩu sinh ngẫu nhiên và chỉ lưu trong `.runtime/uat_accounts.txt` đã gitignore.
- `init_local_postgres.ps1` đã nhận `DatabaseName` nhưng luôn ghi đè `.runtime/DATABASE_URL.txt`; cần tham số filename được kiểm tra để UAT dùng `UAT_DATABASE_URL.txt` mà không đụng runtime database mặc định.
- JDK Temurin 17 hợp lệ nhưng Java không khởi động được trực tiếp từ đường dẫn workspace chứa ký tự tiếng Việt; cùng binary chạy qua ổ `subst` ASCII hoạt động bình thường. UAT bootstrap và Gradle vì vậy đều dùng đường dẫn ASCII tạm.
- UAT runtime được tách vào `ecoloop_campus_uat`, dùng `UAT_DATABASE_URL.txt` và mật khẩu seed sinh ngẫu nhiên trong `.runtime/uat_accounts.txt`.
- APK UAT dùng package `com.ecoloopcampus.mobile.uat`, version `1.0.0-uat`, chứa JS bundle và URL Cloudflare thay vì phụ thuộc Metro.
- Cloudflare Quick Tunnel không có cam kết uptime và URL thay đổi sau khi restart; APK phải build/cài lại nếu tunnel được tạo lại.
- Không thể quản lý UAT an toàn bằng PID trần hoặc PID của wrapper PowerShell: phải lưu PID, executable và start time của chính Python listener/cloudflared rồi xác thực cả ba trước khi stop.
- PowerShell 7 tự chuyển ISO date trong JSON thành `DateTime`, còn Windows PowerShell giữ string; process identity phải xử lý cả hai kiểu để không diễn giải sai ngày/tháng theo locale.
- Health UAT phải xác nhận đồng thời `configured=true`, `status=ok` và database đúng `ecoloop_campus_uat`; chỉ nhận HTTP 200 có thể vô tình trỏ APK vào backend/database khác.
- Normal restart phải giữ nguyên điểm và tồn kho phục vụ test xuyên thiết bị; chỉ `-ResetData` mới seed lại. Reward badge UAT có stock khởi tạo 30 để kiểm chứng debit/refund thật.
