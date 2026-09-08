# Submission Proof And Manual Review Design

## Mục tiêu

Mọi giao dịch gửi rác phải có ảnh sinh viên gắn trực tiếp với submission, AI chỉ hỗ trợ phân loại, QR vẫn là đường duyệt chính và manual review có audit trail bắt buộc. Mobile sinh viên, Mobile tình nguyện viên và Web Admin phải đọc cùng một trạng thái PostgreSQL.

## Phạm vi

- Ảnh sinh viên bắt buộc khi tạo QR.
- AI remote gửi bearer token; lỗi AI không làm mất ảnh và không chặn tạo giao dịch.
- Ảnh được phân loại `STUDENT_PROOF` hoặc `REVIEWER_PROOF` và gắn `submission_id`.
- Scan thành công trả canonical submission đầy đủ.
- Manual review chỉ mở từ scan failure đã ghi log hoặc thao tác `CANNOT_SCAN` có lý do.
- Admin hoặc volunteer sở hữu giao dịch được confirm/reject; admin có quyền override.
- Reject bắt buộc note và tạo notification cho sinh viên.
- Student đọc lý do trong lịch sử/chi tiết và notification center; không có system push.

## Ngoài phạm vi chặng này

- Kiểm kê và dọn/reset thùng sử dụng `BIN_CLEAR_PROOF` sẽ có spec/plan riêng.
- Push notification qua FCM/Expo.
- Thay đổi mô hình AI hoặc huấn luyện lại model.

## Dữ liệu PostgreSQL

`proof_images` được mở rộng với `kind`, `uploaded_by`, `image_name`; `kind` chỉ nhận `STUDENT_PROOF` hoặc `REVIEWER_PROOF` trong chặng này. Mỗi submission phải có ít nhất một `STUDENT_PROOF`; reviewer proof là tùy chọn.

`recycling_submissions` thêm `prediction_id`, `manual_review_unlocked_at`, `manual_review_unlocked_by`, `manual_review_reason`. `qr_scan_logs` thêm `submission_id` để failure hợp lệ có thể mở đúng giao dịch.

Thêm `notifications(id, user_id, type, title, message, reference_type, reference_id, read_at, created_at)`. Student chỉ được đọc và đánh dấu đã đọc notification của chính mình.

## API contract

`POST /api/mobile/recycling-submissions` nhận multipart gồm `binId`, `wasteTypeId`, `quantity`, `proof`, cùng metadata AI tùy chọn. Server kiểm tra ảnh, lưu file, tạo submission và `STUDENT_PROOF`; nếu transaction thất bại thì xóa file vừa lưu.

`POST /predict`, `POST /predict/jobs` và polling job vẫn yêu cầu bearer token. Mobile dùng cùng token session như các API business khác.

`POST /api/mobile/recycling-submissions/scan` luôn trả `{result, submission, note}` khi token ánh xạ được submission, kể cả wrong station/expired/already used. Log chứa `submission_id` và kết quả.

`POST /api/mobile/recycling-submissions/{id}/manual-review` nhận `{reason, scanLogId?}`. Nếu không có failure log phù hợp thì `reason` là bắt buộc; thao tác khóa giao dịch cho volunteer hiện tại và chuyển sang `PENDING_REVIEW`.

`POST .../{id}/proof` chỉ tạo `REVIEWER_PROOF`. `POST .../{id}/confirm` hỗ trợ `QR_SCANNED` và `PENDING_REVIEW`, cộng điểm đúng một lần trong PostgreSQL transaction. `POST .../{id}/reject` chỉ chấp nhận note khác rỗng và tạo notification trong cùng transaction.

`GET /api/mobile/initial-data` trả notification của student hiện tại; `PATCH /api/mobile/notifications/{id}/read` chỉ đánh dấu notification thuộc chính user.

## State machine

- `CREATED -> QR_SCANNED -> POINT_CONFIRMED | REJECTED`
- `CREATED | QR_SCANNED -> PENDING_REVIEW` chỉ qua endpoint mở manual review có audit.
- `PENDING_REVIEW -> POINT_CONFIRMED | REJECTED`
- `POINT_CONFIRMED`, `REJECTED`, `EXPIRED` là terminal.
- Mọi transition dùng row lock và kiểm tra owner; retry không tạo thêm điểm hoặc notification trùng.

## Giao diện

Mobile Student giữ preview ảnh ngay cả khi AI lỗi, bắt buộc có ảnh trước nút tạo QR, và hiển thị note từ chối trong lịch sử/chi tiết. Notification center hiển thị notification backend và cho đánh dấu đã đọc.

Mobile Volunteer ưu tiên scanner. Khi scan thất bại có submission liên quan, UI hiện hành động manual review. Với trường hợp không quét được, reviewer chọn giao dịch, nhập lý do rồi mới mở form duyệt. Ảnh sinh viên luôn hiện trước nút confirm/reject.

Web Admin Ecopoint hiển thị thumbnail/gallery proof của submission. Nút manual approve/reject chỉ hiện khi `manualReviewUnlockedAt` có giá trị; reject bắt buộc note.

## Kiểm thử chấp nhận

- Không ảnh: API trả `PROOF_IMAGE_REQUIRED`, không tạo submission/file rác.
- AI 401 cũ được test đỏ; sau sửa mọi request queue/direct/poll có bearer token.
- AI lỗi: ảnh vẫn còn, student chọn loại thủ công và tạo QR thành công.
- Admin và volunteer nhìn thấy cùng student proof.
- Scan success trả full submission và không gây false `ALREADY_USED` ở UI.
- Manual endpoint bị từ chối khi không có failure/reason; khi hợp lệ tạo audit và chỉ owner/admin xử lý.
- Reject note rỗng bị chặn; note hợp lệ xuất hiện ở history/detail/notification.
- Hai confirm đồng thời chỉ tạo một point history và tăng balance một lần.
