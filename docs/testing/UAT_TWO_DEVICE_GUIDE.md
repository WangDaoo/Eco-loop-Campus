# Hướng dẫn UAT APK trên hai điện thoại thật

## 1. Bản UAT hoạt động thế nào

APK `dist/ecoloop-campus-uat.apk` là bản độc lập: JavaScript đã được đóng gói sẵn, không cần Expo Go hoặc Metro. API được nhúng dưới dạng địa chỉ Cloudflare Quick Tunnel nên hai điện thoại chỉ cần có Internet, không cần cùng Wi-Fi với máy tính.

Trong suốt phiên test, phải giữ máy tính bật và giữ hai tiến trình backend/tunnel đang chạy. Nếu tunnel bị tắt hoặc máy khởi động lại, URL `trycloudflare.com` sẽ đổi; khi đó phải chạy lại `scripts/setup_uat.ps1`, build lại và cài lại APK.

## 2. File cần dùng

- APK: `dist/ecoloop-campus-uat.apk`
- SHA-256: `dist/ecoloop-campus-uat.apk.sha256`
- Tài khoản UAT: `.runtime/uat_accounts.txt`
- Thông tin phiên chạy: `.runtime/uat_summary.txt`
- Log backend: `.runtime/uat_backend.err.log` và `.runtime/uat_backend.out.log`

Không commit hoặc gửi công khai các file trong `.runtime`, vì chúng chứa mật khẩu và chuỗi kết nối PostgreSQL.

Đối chiếu APK trước khi gửi sang điện thoại:

```powershell
Get-FileHash .\dist\ecoloop-campus-uat.apk -Algorithm SHA256
Get-Content .\dist\ecoloop-campus-uat.apk.sha256
```

Hai giá trị SHA-256 phải giống nhau.

## 3. Cài APK lên hai thiết bị

1. Gửi `ecoloop-campus-uat.apk` qua cáp USB, Google Drive hoặc ứng dụng nhắn tin nội bộ.
2. Trên Android, mở file và cho phép **Cài ứng dụng không rõ nguồn gốc** đối với ứng dụng quản lý file/trình duyệt đang dùng.
3. Nếu máy báo đã có gói không tương thích, gỡ riêng ứng dụng **Eco-loop Campus UAT** rồi cài lại. Bản UAT có nhãn riêng và dùng application ID `.uat`, nên có thể nằm cạnh bản production.
4. Cấp quyền Camera và Ảnh/Tệp khi ứng dụng hỏi.
5. Mở trình duyệt trên từng điện thoại, truy cập URL `Public API` trong `.runtime/uat_summary.txt` kèm `/api/health/db`. Phải thấy phản hồi có `ok` trước khi test app.

## 4. Phân vai

- **Điện thoại 1 – Sinh viên đóng góp:** dùng tài khoản sinh viên trong `.runtime/uat_accounts.txt`.
- **Điện thoại 2 – Sinh viên tình nguyện:** dùng tài khoản tình nguyện viên trong cùng file.
- **Web Admin trên máy tính:** dùng tài khoản admin trong cùng file.

File tài khoản cũng có tình nguyện viên thứ hai để kiểm tra ownership, tình nguyện viên `pending` và sinh viên `locked` để kiểm tra phân quyền.

Ghi lại điểm ban đầu của sinh viên và tồn kho ban đầu của phần thưởng trước mỗi luồng.

### Mở Web Admin bằng cùng API UAT

Nếu Web Admin ở `localhost:3000` đang chạy từ trước, dừng cửa sổ đó bằng `Ctrl+C`. Từ thư mục gốc dự án, chạy:

```powershell
$env:REACT_APP_API_URL = (Get-Content .\.runtime\uat_api_public_url.txt -Raw).Trim()
Set-Location .\frontend\eco-loop-campus-admin
npm.cmd start
```

Mở URL mà React báo trong terminal (thường là `http://localhost:3000`) và đăng nhập bằng tài khoản Admin Web. Không chạy `start_backend.bat`, vì lệnh đó dùng database development; backend UAT ở port 8010 đã được `setup_uat.ps1` khởi động riêng.

## 5. Luồng A: gửi rác và xác nhận đúng một lần

### Điện thoại 1 – Sinh viên

1. Đăng nhập và kiểm tra họ tên, mã sinh viên, khoa, số điện thoại.
2. Mở chức năng gửi rác/quét trạm.
3. Trên Web Admin mở trạm đang hoạt động và hiển thị QR trạm; dùng Điện thoại 1 quét QR đó.
4. Chọn loại rác, khối lượng/số lượng và tạo giao dịch.
5. Giữ màn hình QR giao dịch để Điện thoại 2 quét.

### Điện thoại 2 – Tình nguyện viên

1. Đăng nhập tài khoản tình nguyện viên trạng thái `active`.
2. Mở chức năng quét xác nhận và quét QR đang hiển thị trên Điện thoại 1.
3. Kiểm tra đúng sinh viên, trạm, loại rác và số lượng.
4. Tải/chụp ảnh minh chứng, nhập số lượng thực nhận rồi xác nhận.
5. Thử xác nhận lại cùng QR lần thứ hai. Hệ thống phải từ chối hoặc giữ nguyên kết quả, tuyệt đối không cộng điểm lần hai.

### Đối chiếu

- Điện thoại 1 chỉ tăng điểm một lần và lịch sử có một bản ghi tương ứng.
- Điện thoại 2 thấy giao dịch đã hoàn tất, không còn ở hàng chờ.
- Web Admin hiển thị cùng trạng thái, tình nguyện viên xác nhận, minh chứng và số điểm.
- Đăng nhập bằng tình nguyện viên khác và thử xác nhận QR đã nhận; hệ thống không được chuyển quyền hoặc cộng lại điểm.

## 6. Luồng B: đổi điểm, bàn giao và hoàn tác

### Điện thoại 1 – Sinh viên

1. Chọn **Huy hiệu Sinh viên xanh** (`UTEHY_REWARD_BADGE`), phần thưởng UAT có tồn kho hữu hạn ban đầu là 30, và kiểm tra giá điểm thấp hơn số điểm hiện tại.
2. Ghi lại điểm và tồn kho, sau đó tạo yêu cầu đổi thưởng.
3. Hiển thị QR đổi thưởng cho Điện thoại 2.

### Điện thoại 2 – Tình nguyện viên

1. Quét QR đổi thưởng.
2. Kiểm tra đúng sinh viên, phần thưởng và số điểm.
3. Xác nhận bàn giao một lần; thử quét/xác nhận lần hai để kiểm tra tính idempotent.

### Web Admin và đối chiếu

1. Xác nhận điểm sinh viên giảm đúng một lần, tồn kho giảm đúng số lượng và trạng thái khớp trên cả ba giao diện.
2. Thực hiện hoàn tác/hủy bằng Web Admin một lần.
3. Kiểm tra điểm và tồn kho đều được hoàn lại đúng một lần.
4. Thử hoàn tác lần hai; hệ thống phải từ chối hoặc không làm thay đổi dữ liệu.

## 7. Kiểm tra hồ sơ và phân quyền

- Sinh viên chỉ sửa được hồ sơ của mình; trường khoa chọn từ danh sách HYUTE, không nhập ngành/chuyên ngành.
- Mã sinh viên, khoa và số điện thoại hiển thị giống nhau trên Mobile và Web Admin.
- Tài khoản `pending` hoặc `locked` không được dùng các API nghiệp vụ dù token cũ còn lưu trên máy.
- Sinh viên không được gọi màn hình/API dành cho tình nguyện viên hoặc admin.
- Tình nguyện viên không được tự cộng mission/điểm từ dữ liệu gửi lên phía client.

## 8. Cách ghi lỗi

Mỗi lỗi cần ghi: thời gian, thiết bị/Android, vai trò, tài khoản, các bước tái hiện, kết quả mong đợi, kết quả thực tế, ảnh/video màn hình, QR/giao dịch liên quan và log backend cùng thời điểm. Không chụp hoặc chia sẻ mật khẩu trong báo cáo.

Nếu app báo lỗi mạng, kiểm tra theo thứ tự:

1. Điện thoại còn Internet và không dùng VPN/chặn Cloudflare.
2. URL `/api/health/db` còn trả `ok`.
3. PID trong `.runtime/uat_summary.txt` còn chạy.
4. Xem `.runtime/uat_backend.err.log` và `.runtime/uat_tunnel.err.log`.
5. Nếu tunnel đã chết, chạy lại setup và cài lại APK mới. Lệnh setup mặc định giữ nguyên điểm, tồn kho và lịch sử UAT; nó không seed lại dữ liệu.

Chỉ khi muốn đưa lại dữ liệu seed như điểm tài khoản và tồn kho về giá trị ban đầu, chạy có chủ đích lệnh dưới đây. Lệnh seed dùng upsert nên các giao dịch UAT phát sinh ngoài bộ seed vẫn được giữ lại; đây không phải thao tác xóa sạch lịch sử:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup_uat.ps1 -ResetData
```

## 9. Dừng UAT

Sau khi test xong:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop_uat.ps1
```

Lệnh chỉ dừng đúng backend và tunnel được ghi PID; không xóa database UAT, APK, tài khoản hoặc log.
