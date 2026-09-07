# Kế hoạch hoàn thiện Eco-loop Campus end-to-end

## Mục tiêu

Hoàn thiện và xác minh các luồng nghiệp vụ thật giữa PostgreSQL, FastAPI, web admin và mobile app: định danh người dùng, tạo giao dịch QR, xác nhận và cộng điểm, quản lý phần thưởng, phản hồi, cập nhật vị trí thùng rác, lưu dữ liệu AI bị sửa nhãn và công cụ tìm kiếm/tải lại.

## Quy tắc Git đã chốt

- Không commit hoặc push lên `main`.
- Chỉ ở checkpoint cuối, tạo/chuyển sang nhánh mới tên `pKhanh`, kiểm tra diff và commit các file source/schema/test cần thiết.
- Push chỉ tới remote branch `pKhanh` sau khi toàn bộ test, E2E và APK release PASS.
- Không commit APK cũ, `node_modules`, `.venv`, `.runtime`, upload hoặc secret.

## Quyết định nghiệp vụ đã chốt

- Gửi rác và đổi thưởng là hai nghiệp vụ độc lập.
- Gửi rác: sinh viên tạo submission QR; volunteer quét đúng trạm, upload proof và xác nhận thì backend/database cộng điểm đúng một lần.
- Đổi thưởng: sinh viên chọn sản phẩm, tạo redemption QR/batch; điểm chỉ bị trừ khi mã đổi thưởng được volunteer/admin quét và xác nhận hợp lệ.
- Transaction đổi thưởng khóa user và reward rows, kiểm tra điểm, trạng thái, tồn kho và chống gửi trùng tại thời điểm xác nhận.
- Nếu redemption đã trừ điểm nhưng bị từ chối/hủy, hoàn điểm đúng một lần; QR hết hạn khi chưa scan thì không trừ điểm.
- Điểm không bao giờ được cộng từ client.
- Redemption QR được volunteer đã duyệt quét tại duty station; admin được xử lý trực tiếp trên web như ngoại lệ, nhưng cả hai dùng cùng transaction backend.
- PostgreSQL/FastAPI là runtime source of truth; các đường dẫn Supabase còn lại chỉ được giữ nếu phục vụ migration/demo và không được tạo hành vi khác với runtime.

## Quy trình triển khai có checkpoint

Nguyên tắc bắt buộc: mỗi checkpoint phải PASS mới được chuyển bước; nếu FAIL thì chỉ sửa trong phạm vi bước đó, chạy lại test và ghi nhận nguyên nhân. Không chạy cleanup dữ liệu, build APK hoặc Git push trước checkpoint cuối.

### Checkpoint 0 - Đóng băng và xác nhận môi trường

- Kiểm tra `git status`; không đưa `node_modules`, `.venv`, `.runtime`, upload hoặc APK cũ vào commit.
- Xác nhận Python 3.10, `backend\.venv`, PostgreSQL service/`psql`, Node/npm và mobile `node_modules`.
- Chụp lại commit hiện tại và tạo database test riêng, không dùng database đang chứa dữ liệu thật.
- PASS khi mọi lệnh kiểm tra môi trường chạy được và database test có thể kết nối.

### Checkpoint 1 - PostgreSQL schema/function an toàn

- Không chạy trực tiếp schema mới lên database thật. Tạo database test rỗng, chạy schema với `ON_ERROR_STOP=1`.
- Kiểm tra thứ tự tạo bảng và foreign key trước khi định nghĩa function; đặc biệt `ai_training_samples` chỉ được tạo sau `proof_images`, `recycling_submissions`, `predictions` và `users`.
- Chạy schema lần hai để xác nhận idempotent; không có lỗi `already exists`, constraint duplicate hoặc function signature conflict.
- Kiểm tra `\d`/catalog cho bảng, index, constraint, status và column mới.
- Viết SQL integration test cho submission:
  - tạo QR; scan đúng/sai trạm; hết hạn; scan lại;
  - confirm thiếu proof bị từ chối;
  - confirm có proof cộng đúng điểm một lần;
  - retry confirm không cộng trùng.
- Viết SQL integration test cho redemption:
  - tạo batch nhiều reward, snapshot giá/tên/số lượng;
  - tạo batch thứ hai khi batch đầu active bị chặn;
  - tạo batch không trừ điểm;
  - QR hết hạn không trừ điểm;
  - scan hợp lệ khóa user/reward, kiểm tra đủ điểm và trừ một lần;
  - scan đồng thời không làm số dư âm hoặc tồn kho âm;
  - fulfill không trừ thêm;
  - reject/cancel sau scan hoàn một lần;
  - reject/cancel trước scan không hoàn điểm;
  - reward/category bị xóa hoặc đổi giá không làm sai snapshot batch.
- Kiểm tra manual point không làm số dư âm và mọi transaction có `reference_type/reference_id`.
- PASS khi schema chạy lặp được và toàn bộ SQL invariant trên database test đều đạt.

### Checkpoint 2 - Đồng bộ test với runtime PostgreSQL

- Chạy backend full test bằng `backend\.venv\Scripts\python.exe`.
- Cập nhật fixture để route protected có bearer token; cập nhật mock reward từ redemption đơn lẻ sang batch.
- Cập nhật kỳ vọng CORS theo allowlist, không khôi phục wildcard để làm test xanh.
- Đổi mobile source test đang đọc `mobile\supabase\schema.sql` sang schema runtime `backend\local_db\schema.sql` hoặc một fixture schema test duy nhất.
- Tách test async queue theo event loop; không dùng queue global giữa nhiều `TestClient` nếu gây lỗi bind loop.
- PASS khi backend/mobile/frontend test không còn lỗi do contract cũ; mọi failure còn lại phải là bug thật được sửa, không được skip tùy tiện.

### Checkpoint 3 - Redemption API contract

- Chuẩn hóa response batch gồm `id`, `studentId`, `qrToken`, `expiresAt`, `status`, `totalPoints`, `items`.
- Tách rõ API submission QR và redemption QR, payload có `type`/`version` để scanner nhận diện.
- Tạo batch chỉ ghi batch/items, không trừ điểm.
- Scan redemption chỉ cho volunteer active có duty station phù hợp hoặc admin; transaction khóa batch, user và reward.
- Finalize chỉ cho admin; `pending -> expired`, `scanned -> fulfilled`, `scanned -> rejected/cancelled`.
- Ghi actor/audit và point history; refund idempotent.
- PASS bằng API tests cho auth, expiry, duplicate scan, concurrency, stock, points và trạng thái bất hợp lệ.

### Checkpoint 4 - Mobile redemption QR/countdown

- Cập nhật type/store/context cho batch/items thay vì giả lập redemption đơn lẻ.
- Cho phép chọn nhiều reward và số lượng; gộp reward trùng trước khi gửi.
- Hiển thị QR và countdown từng giây từ `expiresAt`; disable nút tạo mã khi batch active.
- Khi hết hạn chưa scan, cho tạo batch mới và không thay đổi điểm.
- Sau scan thành công, refresh profile, batch và lịch sử từ backend.
- PASS bằng mobile typecheck/test và kiểm tra thủ công trên simulator.

**Trạng thái hiện tại:** typecheck và test tự động PASS; cần hoàn tất multi-item picker thật và kiểm tra bằng simulator.

### Checkpoint 5 - Volunteer scanner redemption

- Phân biệt `submission` và `redemption` QR bằng payload version/type.
- Submission giữ flow proof/confirm/cộng điểm hiện có.
- Redemption gọi scan API, hiển thị item, tổng điểm và kết quả; không yêu cầu proof rác.
- Refresh sau scan và chặn scan lại.
- PASS bằng test scanner và hai phiên student/volunteer.

### Checkpoint 6 - Web reward/category/manual point

- CRUD category, reward, stock, active status và ảnh nếu có.
- User picker tìm kiếm, không dùng dropdown dài cho danh sách user.
- Hiển thị batch/items, QR status, actor, points trước/sau.
- Admin fulfill/reject/cancel; xác nhận trước mutation và refresh sau mutation.
- Manual point dùng transaction, lý do bắt buộc, audit admin và không cho số dư âm.
- PASS bằng test UI/service và kiểm tra dữ liệu qua API/database.

**Trạng thái hiện tại:** manual point transaction, batch list/finalize API và phần UI batch đã có; CRUD/category/searchable picker/refresh đầy đủ vẫn cần kiểm tra hoàn chỉnh.

### Nhật ký thực thi 2026-09-02

- PostgreSQL test database `ecoloop_campus_test` và role `ecoloop_test` đã được tạo riêng; không dùng database ứng dụng.
- `schema.sql` chạy với `ON_ERROR_STOP=1` lần đầu, lần hai và các lần migration bổ sung đều PASS/idempotent.
- SQL smoke gửi rác/cộng điểm và redemption scan/trừ điểm/tồn kho/fulfill/refund đều PASS.
- Backend full test: `72 passed`; mobile full test: `216 passed`; frontend trước các thay đổi UI cuối: `263 passed`.
- Manual point transaction đã có SQL function/API và smoke test cộng/trừ/chặn số dư âm PASS.
- Mobile redemption QR/countdown và scanner redemption đã có typecheck/test PASS.
- Web batch listing/finalize service và UI đã nối; web production build PASS.
- Cleanup script `backend/local_db/cleanup_e2e.ps1` có dry-run bắt buộc; export AI `backend/export_ai_training_samples.py` có dry-run/chống ghi đè.
- Sau khi chuyển manual point khỏi mock Supabase, còn 3 frontend test legacy approve-scan cần chuyển sang backend contract; không skip.
- Chưa tạo nhánh `pKhanh`, chưa commit/push, chưa cleanup user, chưa build APK vì các checkpoint E2E/Android chưa PASS.

### Checkpoint 7 - Feedback/map/AI correction

- Feedback mobile create -> web list/update -> mobile refresh, dùng cùng schema/backend.
- Map dùng `latitude/longitude` làm canonical; kéo marker, draft/save/cancel; mobile đọc cùng dữ liệu.
- Lưu `original_ai_class`, `corrected_ai_class`, `selected_waste_type_id`; proof không tự động thành train data.
- Admin review rồi mới export ảnh vào `model_training/dataset/<class>`; export có dry-run, validate ảnh và chống ghi đè.
- PASS bằng test frontend/mobile/backend và kiểm tra file export.

### Checkpoint 8 - E2E thật và cleanup an toàn

- Dùng database test/demo riêng, seed account/station/reward tối thiểu.
- Chạy tuần tự: admin setup -> student gửi rác -> volunteer scan/proof/confirm -> kiểm tra điểm -> student tạo redemption batch -> QR expiry và scan -> fulfill/reject/refund -> feedback -> AI correction/export.
- Mỗi bước lưu response/API, database assertion và ảnh màn hình; FAIL thì quay lại checkpoint liên quan.
- Cleanup chỉ dùng danh sách email chính xác, chạy dry-run, in ID/name/role/foreign-key count rồi mới xác nhận cleanup thật.
- Verify user thật, reward thật và số dư ngoài scope không thay đổi.

### Checkpoint 9 - Build APK và Git push

- Chỉ thực hiện sau khi checkpoint 0-8 PASS.
- Cài/xác nhận Android SDK, JDK và ADB; cấu hình API URL đúng môi trường.
- Build APK release mới, kiểm tra cài đặt và chạy smoke flow tối thiểu.
- Kiểm tra `git diff`, `git diff --check`, `git status`; loại APK cũ dirty và file runtime khỏi commit.
- Commit chỉ source/schema/test/migration cần thiết; push sau khi commit hợp lệ.

## Phạm vi triển khai

### 1. Database và migration trước tiên

- Đọc lại `backend/local_db/schema.sql` cùng các SQL function hiện dùng cho submission, point history và reward redemption.
- Bổ sung function tạo redemption batch: tạo các item, snapshot giá điểm/tên sản phẩm, tạo QR 15 phút và chưa trừ điểm.
- Bổ sung function scan/xác nhận redemption theo transaction: khóa batch, user và reward rows bằng `FOR UPDATE`, kiểm tra QR/điểm/tồn kho, rồi trừ điểm và ghi history đúng một lần.
- Phân quyền redemption: volunteer active phải có duty station phù hợp; admin có thể xác nhận trực tiếp trên web và mọi thao tác đều lưu actor/audit.
- Bổ sung function xử lý trạng thái redemption của admin:
  - `pending -> expired`: không trừ/hoàn điểm vì chưa từng trừ.
  - `scanned -> fulfilled`: không trừ thêm điểm.
  - `scanned -> rejected/cancelled`: hoàn điểm một lần và ghi `point_history` loại refund.
  - Chặn chuyển trạng thái bất hợp lệ hoặc refund lặp.
- Bảo đảm `point_history` có reference/source đủ rõ để truy vết giao dịch QR, manual point, redemption và refund.
- Bổ sung các trường cho correction dataset, tối thiểu:
  - nhãn AI ban đầu, nhãn đúng/corrected class.
  - người sửa, thời điểm sửa, ghi chú và trạng thái annotation.
  - liên kết prediction/submission/proof nếu có.
- Bổ sung bảng hoặc metadata cho reward categories nếu schema local chưa tương đương UI hiện tại; chuẩn hóa foreign key `rewards.category_id`.
- Thêm ràng buộc/validation phù hợp cho waste type và bin group, tránh submission chọn loại rác không phù hợp với thùng.
- Tạo migration có thể chạy lặp an toàn; không sửa dữ liệu production bằng script cleanup tùy tiện.

### 2. Backend FastAPI

- Chuẩn hóa profile response để mọi client dùng `user.name`; sửa các fallback đang hiển thị `Sinh viên xanh` thành `Xin chào, {tên sinh viên}` ở nơi phù hợp.
- Kiểm tra lại toàn bộ auth/status/role ở các route mobile và admin.
- Khóa các route quản lý avatar bằng admin auth; quyết định rõ route danh sách avatar có public hay yêu cầu bearer token.
- Bảo vệ các route `/predict` và `/predict/jobs` bằng auth hoặc rate limit phù hợp; job polling phải chỉ cho phép chủ job/admin xem kết quả nếu job gắn user.
- Thêm giới hạn kích thước file, kiểm tra nội dung ảnh thực tế, giới hạn pixel và cleanup file khi insert database thất bại.
- Hoàn thiện route/API cho:
  - manual point có audit reason và số điểm hợp lệ.
  - reward categories CRUD.
  - rewards CRUD có category, giá điểm, tồn kho, ảnh và trạng thái.
  - redemption status transition và refund.
  - feedback create/list/update dùng chung cho mobile/web.
  - bin position update theo `latitude/longitude` hoặc hệ tọa độ đã thống nhất.
  - correction annotation và export/copy ảnh vào dataset.
- Khi confirm submission:
  - kiểm tra scan/proof/status trong database function.
  - tính điểm từ quantity thực tế và waste rule.
  - ghi point history idempotently.
  - cập nhật user points trong cùng transaction.
- Khi tạo submission:
  - yêu cầu waste type và bin hợp lệ.
  - kiểm tra tương thích nhóm rác/thùng.
  - trả `expiredAt` rõ ràng và trạng thái hiện tại.
- QR:
  - giữ token một lần và hết hạn.
  - cập nhật scan mỗi lần theo kết quả rõ ràng.
  - xác minh signature hoặc loại bỏ trường signature khỏi logic nếu token DB là cơ chế bảo mật duy nhất; không để client tưởng rằng MD5 đang bảo vệ token.

### 3. Mobile app

- `HomeScreen`: hiển thị chính xác `Xin chào, {currentUser.name}`, có fallback chỉ khi profile thực sự thiếu tên.
- `SubmitScreen`:
  - hiển thị danh sách waste type thật từ backend.
  - cho phép chọn loại rác trước khi tạo submission.
  - hỗ trợ gộp nhiều sản phẩm/vật phẩm vào một submission: danh sách item gồm loại, số lượng, đơn vị và điểm dự kiến; tổng điểm chỉ là preview.
  - chỉ tạo một QR sau khi người dùng xác nhận toàn bộ danh sách.
  - countdown cập nhật mỗi giây từ `expiredAt` server, không dựa vào giờ client để quyết định hợp lệ.
  - trong lúc QR còn hạn, disable/làm mờ nút tạo mã mới.
  - khi hết hạn mà chưa scan thành công, hiển thị cảnh báo và yêu cầu tạo mã mới.
  - sau khi scan thành công, khóa việc tạo lại mã cho submission đó và chuyển sang trạng thái chờ proof/xác nhận.
- `ScannerScreen`:
  - hiển thị rõ kết quả success, expired, already used, wrong station và invalid token.
  - proof upload và confirm phải refresh dữ liệu từ server sau mỗi thao tác.
- Feedback mobile:
  - form category/message/station liên quan.
  - validation, loading, retry và thông báo kết quả.
  - gửi qua backend runtime, không fallback sang local/mock.
  - sau khi gửi, refresh danh sách/lịch sử feedback.
- Rewards:
  - hiển thị category, giá điểm, tồn kho và trạng thái redemption.
  - cập nhật wallet ngay từ response server sau đổi thưởng.
  - xử lý lỗi thiếu điểm, hết hàng, redemption trùng, QR hết hạn và refund.
- Redemption QR: volunteer được duyệt quét tại duty station; admin có nút xử lý trực tiếp trên web khi cần.
- Thêm pull-to-refresh hoặc nút refresh cho các màn hình có dữ liệu động; hủy polling/unmount đúng cách.

### 4. Web admin

- `UsersPage`:
  - giữ thao tác tìm kiếm theo tên/email/mã sinh viên.
  - tách rõ chọn user khỏi chọn reward/waste type; thay dropdown dài bằng searchable combobox hoặc modal tìm kiếm.
  - thêm nút refresh dùng chung, trạng thái loading/error và refresh sau save/status change.
  - thêm cleanup/delete có xác nhận, nhưng chỉ cho dữ liệu E2E/demo hoặc admin có quyền; không cho xóa tùy tiện dữ liệu nghiệp vụ thật.
- Xóa đúng các tài khoản E2E đã nêu bằng cleanup migration/script có điều kiện chính xác theo email/id, kiểm tra foreign key và hỗ trợ dry-run trước khi xóa.
- `EcoPointsPage`/các trang reward:
  - bổ sung tab/danh mục sản phẩm đổi thưởng.
  - CRUD category.
  - CRUD sản phẩm: tên, mô tả, ảnh, giá điểm, tồn kho, category, active/inactive.
  - quản lý redemption và trạng thái pending/scanned/fulfilled/rejected/expired.
  - hiển thị refund khi từ chối.
  - form manual point có searchable user, amount, reason và audit information.
  - refresh sau mọi mutation.
- Trang/màn hình scan/review:
  - sau approve/confirm phải gọi lại dữ liệu và hiển thị point history/user points.
  - phân biệt AI prediction ban đầu với nhãn được admin sửa.
- AI review:
  - cho admin sửa class AI sai.
  - yêu cầu chọn nhãn đúng, tùy chọn ghi chú.
  - hiển thị trạng thái annotation và nguồn ảnh.
  - có thao tác export/đồng bộ ảnh đã gán nhãn vào thư mục dataset theo class.
- `FeedbackPage`:
  - dùng chung schema/status với mobile.
  - hiển thị feedback mobile, filter/search, cập nhật status/priority/note.
  - refresh thủ công và tự refresh sau update.
- `BinsPage`/`CampusMap`:
  - cho phép kéo marker để chọn vị trí trên map.
  - hiển thị draft marker trước khi lưu, nút hủy/lưu.
  - lưu tọa độ canonical; nếu còn `map_x/map_y`, phải có một hàm chuyển đổi thống nhất cho web/mobile.
  - hiển thị rõ bin thiếu tọa độ và lỗi cập nhật.
- Bổ sung component refresh/search dùng chung thay vì mỗi page tự xử lý khác nhau.

### 5. AI correction dataset

- Khi sinh viên không dùng gợi ý AI và chọn loại khác, lưu đồng thời:
  - prediction class/confidence ban đầu.
  - lựa chọn cuối của sinh viên hoặc waste type thực tế.
  - ảnh prediction và liên kết submission/user.
- Khi tình nguyện viên upload proof, giữ proof vận hành riêng, không tự động coi proof là dữ liệu train.
- Khi admin xác nhận/sửa nhãn:
  - tạo annotation đã review.
  - chỉ ảnh có nhãn đúng và trạng thái đủ điều kiện mới được export.
- Tổ chức thư mục dữ liệu theo class train hiện có trong `model_training/dataset`, dùng tên file an toàn và tránh ghi đè.
- Tạo script export có dry-run, kiểm tra MIME/ảnh hỏng, thống kê theo class và log nguồn dữ liệu.
- Không tự động retrain model trong request web; retrain là bước offline có kiểm duyệt.

## Kiểm thử bắt buộc

### Backend/database

- Auth role/status và profile name.
- Tạo submission với một/nhiều item, thiếu waste type, bin sai nhóm.
- QR countdown/expiry, scan đúng trạm, sai trạm, dùng lại, token invalid.
- Confirm chỉ cộng một lần; thiếu proof không cộng.
- Manual point tạo history và cập nhật tổng điểm.
- Redemption đồng thời: chỉ một request thành công khi điểm vừa đủ.
- Expired redemption chưa scan không làm thay đổi điểm; redemption đã scan rồi bị reject/cancel hoàn điểm một lần; fulfill không trừ thêm.
- Category/reward CRUD và không xóa category đang được sử dụng.
- Feedback mobile create và web update/list.
- Bin position save và validation tọa độ.
- Upload quá lớn, file giả MIME, cleanup khi database lỗi.
- Correction annotation/export đúng thư mục và không ghi đè.

### Web/mobile

- Chạy Jest/React Testing Library cho reward categories, searchable user, refresh, feedback, map marker, scan review và AI correction.
- Chạy mobile `node --test`, typecheck và test countdown từng giây, disable nút tạo QR, multi-item submission, feedback và redemption.
- Cập nhật source tests đang kiểm tra hành vi cũ Supabase/local fallback nếu không còn phù hợp với runtime PostgreSQL.

### E2E thực tế

1. Admin đăng nhập bằng tài khoản không dùng mật khẩu mặc định.
2. Admin tạo category và nhiều sản phẩm reward, cấu hình tồn kho/giá điểm.
3. Admin tạo/sửa vị trí bin bằng cách kéo marker và xác nhận trên mobile.
4. Student đăng nhập, thấy đúng tên, chọn nhiều vật phẩm và loại rác, tạo một QR.
5. Kiểm tra countdown từng giây, không cho tạo QR thứ hai khi mã còn hạn.
6. Volunteer quét đúng QR tại đúng trạm, upload proof và confirm.
7. Xác nhận điểm tăng đúng một lần trên mobile, web và point history.
8. Thử approve lại/retry để đảm bảo không cộng trùng.
9. Student chọn nhiều reward và tạo redemption QR; điểm chưa bị trừ, redemption hiển thị pending.
10. QR hết hạn trước khi scan, xác nhận điểm không đổi; tạo mã mới được phép.
11. Volunteer đã duyệt scan tại duty station và xác nhận redemption, kiểm tra điểm bị trừ đúng một lần; fulfill không trừ thêm.
12. Admin xử lý trực tiếp một redemption trên web, kiểm tra actor/audit và cùng quy tắc transaction.
13. Sau khi đã trừ điểm, reject/cancel, kiểm tra điểm hoàn đúng một lần.
14. Student gửi feedback, admin thấy và cập nhật trạng thái; mobile nhận dữ liệu mới sau refresh.
15. Student bỏ AI suggestion, chọn nhãn khác; admin review/export ảnh vào class đúng.
16. Chạy cleanup dry-run và xóa đúng các tài khoản E2E được chỉ định, không ảnh hưởng user thật.

## Thứ tự thực hiện

Thực hiện đúng thứ tự `Checkpoint 0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9`. Không gộp bước khi chưa có bằng chứng PASS.

Nếu migration/function fail: dừng, lưu câu lệnh và lỗi, xóa/tạo lại chỉ database test, sửa rồi chạy lại từ Checkpoint 1. Nếu UI/mobile fail do contract, giữ database đã PASS và sửa adapter/fixture tại checkpoint tương ứng.

Chỉ sau Checkpoint 8 mới cập nhật README/lệnh Windows; chỉ sau Checkpoint 9 mới build APK release cuối, commit và push Git.

## Rủi ro và nguyên tắc an toàn

- Không dùng client-provided points để cộng/trừ điểm.
- Không coi dữ liệu AI tự động là ground truth để train.
- Không xóa theo mẫu email rộng nếu chưa dry-run và xác nhận danh sách record.
- Không để migration phụ thuộc vào Supabase schema cũ.
- Không chạy retrain hoặc thao tác file dataset trong request đồng bộ của API.
- Mọi mutation quan trọng phải trả dữ liệu server mới nhất hoặc buộc client refresh.
- Không chạy `schema.sql` trực tiếp trên database thật khi phát triển; mọi invariant điểm/tồn kho phải có SQL integration test trên PostgreSQL thật, không chỉ mock.
- Không dùng `npm install` hoặc `npx` không khóa version để thay thế lockfile khi xác minh build.
