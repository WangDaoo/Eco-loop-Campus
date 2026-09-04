# Thiết kế kiểm thử tự động Backend–API–Web Admin–Mobile

## Mục tiêu

Xác minh bằng test tự động rằng PostgreSQL là nguồn sự thật duy nhất và mọi thay đổi nghiệp vụ từ mobile hoặc Web Admin đều đi qua đúng transaction, phân quyền và state machine. Hồ sơ học vụ chỉ lưu **khoa**; không có lớp, ngành hoặc chuyên ngành trong phạm vi này.

## Contract hồ sơ HYUTE

Thông tin bắt buộc gồm `name`, `email`, `studentCode`, `facultyCode`, `phoneNumber` và `role`. `facultyCode` phải thuộc 11 khoa đang hoạt động và được chọn bằng dropdown từ API; client không được gửi chuỗi khoa tùy ý.

Danh mục khoa chuẩn:

| `facultyCode` | Tên hiển thị |
|---|---|
| `mechanical-engineering` | Khoa Cơ khí |
| `automotive-engineering` | Khoa Cơ khí động lực |
| `electrical-electronics` | Khoa Điện – Điện tử |
| `information-technology` | Khoa Công nghệ thông tin |
| `garment-fashion` | Khoa Công nghệ May và Thời trang |
| `chemical-environmental` | Khoa Công nghệ Hóa học và Môi trường |
| `economics` | Khoa Kinh tế |
| `foreign-languages` | Khoa Ngoại ngữ |
| `technical-education` | Khoa Sư phạm Kỹ thuật |
| `basic-sciences` | Khoa Khoa học cơ bản |
| `political-theory` | Khoa Lý luận chính trị |

API mục tiêu:

- `GET /api/catalog/faculties` trả `{data: Faculty[]}` với `Faculty = {code, name, status, sortOrder}`.
- `POST /api/auth/register` nhận thêm `studentCode`, `facultyCode`, `phoneNumber`; sinh viên active ngay, tình nguyện viên pending.
- `PATCH /api/users/me/profile` hoàn thiện hồ sơ tài khoản cũ.
- User response thêm `studentCode`, `facultyCode`, `facultyName`, `phoneNumber`, `profileCompleted`, `requiresProfileCompletion`.
- Không thêm `major`, `specialization`, `classCode` hoặc `cohort`.

## State machine và nguồn sự thật

### Đóng góp rác

`CREATED → QR_SCANNED → POINT_CONFIRMED`; nhánh lỗi là `EXPIRED`, `REJECTED` hoặc `PENDING_REVIEW`. Chỉ backend event hợp lệ được cộng điểm; mỗi submission có tối đa một point-history cộng điểm. Tình nguyện viên đã scan mới được upload proof/xác nhận, admin được phép override và phải để audit trail.

### Đổi thưởng

`pending → fulfilled` ngay khi tình nguyện viên/admin scan và bàn giao. Cùng một PostgreSQL transaction phải khóa batch, user và reward; kiểm tra hạn, số dư, tồn kho; trừ điểm, trừ kho, ghi history và đánh dấu fulfilled đúng một lần. Admin reversal chuyển `fulfilled → cancelled`, hoàn lại điểm và tồn kho đúng một lần.

### Nhiệm vụ

Client không được tự tăng tiến độ bằng một endpoint tùy ý. Backend phát sinh mission progress từ event đã lưu như submission được xác nhận hoặc feedback hợp lệ, có khóa idempotency theo event.

## Contract dữ liệu theo vai trò

- Student nhận: hồ sơ hiện tại; danh mục công khai; users tối giản phục vụ bảng xếp hạng; predictions, submissions, point history, feedback và redemptions của chính mình.
- Volunteer nhận: hồ sơ hiện tại; danh mục công khai; submission cần xử lý; proof liên quan; QR log do mình tạo; thông tin sinh viên tối thiểu phục vụ xác minh.
- Admin dùng `/api/admin/*` và nhận dữ liệu quản trị đầy đủ.
- Email, số điện thoại và thông tin riêng của sinh viên khác không xuất hiện trong payload mobile.
- Tài khoản `locked`, `pending` hoặc `rejected` bị chặn tại mọi protected endpoint, kể cả khi bearer token được cấp trước đó.

## Chiến lược kiểm thử và báo lỗi

1. PostgreSQL integration test chạy trên database có tên kết thúc bằng `_test`, áp schema thật và reset dữ liệu giữa các case.
2. FastAPI integration test dùng cùng test database, không monkeypatch business function đối với các luồng cốt lõi.
3. Contract test cố định payload camelCase, status, mã lỗi và dữ liệu được phép theo role.
4. Mobile/Web Admin adapter và UI test chỉ mock đúng payload đã được khóa bởi contract test.
5. E2E API hai vai trò chạy student → volunteer → admin query trên một database thật.

Mỗi lỗi có: mã `ECL-<AREA>-NNN`, severity `P0–P3`, môi trường/commit, dữ liệu chuẩn bị, bước tái hiện, expected, actual, HTTP/SQL evidence, lớp gây lỗi, ảnh hưởng, test hồi quy và trạng thái. `P0` là mất/lộ dữ liệu hoặc sai điểm/tồn kho không thể phục hồi; `P1` là bypass quyền hoặc hỏng luồng chính; `P2` là contract/UI không đồng bộ; `P3` là cảnh báo/chất lượng không chặn nghiệp vụ.

## Tiêu chí hoàn tất

- Toàn bộ state transition, authorization matrix và transaction invariant có test đỏ trước khi sửa và xanh sau khi sửa.
- Không có test cốt lõi chỉ xác minh source text hoặc mock business function.
- Full backend, admin, mobile, typecheck và E2E database đều pass liên tiếp hai lần.
- Sau refresh, Web Admin và mobile biểu diễn cùng status, điểm và tồn kho từ PostgreSQL.
- Báo cáo lỗi phân biệt rõ: đã tái hiện, phát hiện tĩnh chờ test và đã sửa có regression test.
