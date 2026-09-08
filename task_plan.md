# Kế hoạch lập chiến lược kiểm thử EcoLoop Campus

## Mục tiêu

Tạo một kế hoạch kiểm thử tự động bám sát code hiện tại, tập trung xác minh tính đúng đắn và đồng bộ của PostgreSQL, FastAPI, Web Admin và ứng dụng mobile cho ba luồng: hồ sơ sinh viên chỉ có khoa, đóng góp rác và đổi điểm/đổi thưởng.

## Phạm vi đã chốt

- Hồ sơ học vụ chỉ yêu cầu `faculty`; không có ngành hoặc chuyên ngành.
- Khoa được chọn từ danh mục HYUTE bằng dropdown, không nhập tự do.
- Trọng tâm là logic backend/API/transaction và hợp đồng đồng bộ giữa Web Admin–Mobile.
- Kết quả kiểm thử phải tạo báo cáo lỗi có bằng chứng tái hiện, nguyên nhân theo ranh giới hệ thống và mức độ ưu tiên.

## Các giai đoạn

- [complete] 1. Kiểm kê code, schema, API và test hiện có
- [complete] 2. Chạy baseline test và ghi nhận sai lệch thực tế
- [complete] 3. Xây dựng ma trận contract, transaction và phân quyền
- [complete] 4. Viết kế hoạch kiểm thử tự động chi tiết
- [complete] 5. Tự rà soát độ bao phủ và bàn giao

## Thực thi implementation plan

- [complete] Task 1. Khóa baseline và sửa drift của test Web Admin
- [complete] Task 2. Tạo PostgreSQL integration harness an toàn
- [complete] Task 3. Hồ sơ sinh viên chỉ có khoa
- [complete] Task 4. Authentication, authorization và privacy payload
- [complete] Task 5. Transaction đóng góp rác và ownership tình nguyện viên
- [complete] Task 6. Nhiệm vụ chống tự cộng điểm
- [complete] Task 7. Đổi điểm/đổi thưởng và cạnh tranh transaction
- [complete] Task 8. Contract sync Web Admin–Mobile
- [complete] Task 9. E2E hai vai trò và báo cáo lỗi

## Thứ tự thực thi đã được chủ dự án ưu tiên

- [complete] P0-A. Task 4 — token tài khoản bị khóa và privacy của `initial-data`
- [complete] P0-B. Task 5 — chặn admin bypass transaction điểm/trạng thái và ownership tình nguyện viên
- [complete] P0-C. Task 6 — mission chỉ tăng từ domain event
- [complete] P0-D. Task 7 — hoàn tồn kho và transaction đổi thưởng
- [complete] Luồng thật. Task 5 + Task 7 — đóng góp rác và đổi thưởng xuyên API/client
- [complete] Hồ sơ cuối. Task 3 — mã sinh viên, khoa HYUTE, số điện thoại và E2E đồng bộ

## Quy tắc

- Sửa logic sản phẩm theo chu trình test đỏ → sửa tối thiểu → regression test; mỗi nhóm lỗi có checkpoint riêng.
- Mỗi lỗi phải có mã, mức độ, bước tái hiện, expected/actual, lớp gây lỗi và test hồi quy đề xuất.
- Ưu tiên test PostgreSQL/FastAPI thật; mock chỉ dùng cho UI và lỗi mạng có kiểm soát.

## UAT APK hai thiết bị — 2026-09-05

- [complete] UAT-1. Khóa contract build `uat` standalone, ký debug key và không phụ thuộc Metro.
- [complete] UAT-2. Tạo PostgreSQL UAT riêng, seed tài khoản theo vai trò và guard hậu tố `_uat`.
- [complete] UAT-3. Khởi chạy backend UAT cùng public tunnel, nhúng URL API vào APK.
- [complete] UAT-4. Build, checksum và kiểm tra APK cài đặt được.
- [complete] UAT-5. Viết hướng dẫn test chi tiết cho hai điện thoại và Web Admin.
- [complete] UAT-6. Chạy regression/build verification và bàn giao artifact.

### Quyết định UAT

- Hai điện thoại không cần cùng Wi-Fi với máy phát triển.
- APK UAT phải chứa JavaScript bundle và chạy không cần Metro.
- Dùng Cloudflare quick tunnel hiện có cho lần test đầu; tunnel phải còn chạy trong suốt buổi test.
- Không dùng database test tự động hoặc database sản xuất; database UAT phải có hậu tố `_uat`.

## Minh chứng gửi rác và duyệt thủ công — 2026-09-08

- [complete] SUB-PROOF-1. Khóa thiết kế, contract và kế hoạch triển khai.
- [complete] SUB-PROOF-2. PostgreSQL lưu ảnh sinh viên bắt buộc, nhật ký mở duyệt thủ công và thông báo từ chối.
- [complete] SUB-PROOF-3. FastAPI nhận multipart, trả submission đầy đủ và bảo vệ AI bằng bearer token từ Mobile.
- [complete] SUB-PROOF-4. Mobile bắt buộc ảnh, giữ ảnh khi AI lỗi, quét QR là luồng chính và có trung tâm thông báo.
- [complete] SUB-PROOF-5. Web Admin hiển thị ảnh gắn submission và chỉ cho duyệt thủ công sau khi được mở khóa.
- [complete] SUB-PROOF-6. PostgreSQL/API/Mobile/Web Admin regression và UAT artifact mới.

### Quyết định đã duyệt

- Ảnh sinh viên là bắt buộc trước khi tạo QR; AI chỉ gợi ý và không được chặn giao dịch khi lỗi.
- Quét QR vẫn là luồng xác minh chính.
- Duyệt thủ công chỉ mở sau scan thất bại hoặc hành động “Không thể quét QR” có lý do bắt buộc.
- Admin hoặc tình nguyện viên đang sở hữu lượt xử lý có thể duyệt; ảnh xác minh bổ sung là tùy chọn.
- Từ chối bắt buộc lý do; sinh viên thấy trong lịch sử/chi tiết và trung tâm thông báo, chưa dùng push notification.
- Điểm chỉ được cộng đúng một lần bằng PostgreSQL transaction idempotent.

### Lỗi gặp trong thực thi

| Lỗi | Lần thử | Hướng xử lý |
|---|---:|---|
| `pytest` không có trên PATH của shell | 1 | Dùng Python runtime được repository/workspace cấu hình để chạy `-m pytest` |
| Plan tham chiếu runner không tồn tại | 1 | Sửa thành `scripts/run_automated_logic_tests.ps1` sau khi kiểm kê repository |
| Hai Python runtime ngoài dự án thiếu module `pytest` | 2 | Dùng `backend/.venv/Scripts/python.exe`, là runtime của repository |
| `AsyncStorage` không tồn tại trong Node test của AI token provider | 1 | Dùng cache token dùng chung; store xác thực hydrate cache, provider có fallback an toàn khi test Node |
| TypeScript suy luận header rỗng có `Authorization?: undefined` | 1 | Khóa kiểu trả về `Promise<Record<string, string>>` |
| Source guard Mobile còn đòi nhãn “Phân loại AI” cũ | 1 | Cập nhật assertion theo contract ảnh bắt buộc/AI chỉ gợi ý đã duyệt |
