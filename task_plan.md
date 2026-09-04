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
