# Eco-loop Campus

Eco-loop Campus là hệ thống quản lý phân loại, thu gom và tái chế rác thải trong khuôn viên trường theo hướng kinh tế tuần hoàn. Dự án gồm web quản trị, backend FastAPI, PostgreSQL, AI phân loại rác và app mobile cho sinh viên/tình nguyện viên.

Luồng nghiệp vụ chính: admin cấu hình trạm và dữ liệu vận hành, sinh viên tạo giao dịch gửi rác bằng QR, tình nguyện viên quét QR và gửi ảnh minh chứng, hệ thống cộng Ecopoint sau khi xác nhận.

![Status](https://img.shields.io/badge/Status-Active-success)
![Python](https://img.shields.io/badge/Python-3.10-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-336791)
![React](https://img.shields.io/badge/React-Admin_Web-61DAFB)
![Expo](https://img.shields.io/badge/Expo-Mobile_App-000020)
![TensorFlow](https://img.shields.io/badge/TensorFlow-AI-orange)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)

## Mục Lục

- [Kiến trúc hiện tại](#kiến-trúc-hiện-tại)
- [Chức năng chính](#chức-năng-chính)
- [Chạy nhanh bằng Docker](#chạy-nhanh-bằng-docker)
- [Cài server laptop mới](#cài-server-laptop-mới)
- [Chạy thủ công không Docker](#chạy-thủ-công-không-docker)
- [Mobile APK](#mobile-apk)
- [Public tunnel](#public-tunnel)
- [Database](#database)
- [API chính](#api-chính)
- [Test và build](#test-và-build)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)

## Kiến Trúc Hiện Tại

```mermaid
flowchart LR
  Web[React Admin Web] --> API[FastAPI Backend]
  Mobile[Expo / React Native APK] --> API
  API --> PG[(PostgreSQL)]
  API --> Uploads[Local Uploads]
  API --> AI[MobileNetV2 AI Model]
  Web --> AIQueue[/predict/jobs]
  Mobile --> AIQueue
```

| Thành phần | Vai trò |
|---|---|
| FastAPI backend | Auth, API nghiệp vụ, QR/Ecopoint transaction, upload, AI queue |
| PostgreSQL | CSDL gốc của dự án |
| React admin web | Dashboard, users, avatars, bins/map/QR, scans, rewards, missions, reports |
| Mobile app | Student/volunteer flow: đăng ký, đăng nhập, QR, AI, map, rewards, profile |
| Upload local | Avatar, proof image, prediction image qua `/uploads/...` |
| Docker Compose | Chạy PostgreSQL + backend + web ổn định trên laptop server |

Supabase không còn là runtime chính. Các thư mục SQL Supabase cũ chỉ giữ để tham khảo/migration/demo, không dùng để chạy hệ thống hiện tại.

## Chức Năng Chính

### Admin Web

- Đăng nhập bằng backend Auth, role `admin`.
- Dashboard KPI từ PostgreSQL.
- Quản lý người dùng: xem, lọc, khóa/mở khóa, duyệt volunteer pending.
- Quản lý avatar: mã avatar, tên avatar, upload ảnh, sửa/xóa avatar.
- Quản lý trạm/thùng rác: QR chuẩn, trạng thái, sức chứa, vị trí bản đồ.
- Quản lý AI scan, duyệt/từ chối prediction.
- Quản lý Ecopoint, lịch sử điểm, phần thưởng, yêu cầu đổi thưởng.
- Quản lý nhiệm vụ, feedback, báo cáo và xuất dữ liệu.

### Mobile Student

- Đăng ký tài khoản student, đăng nhập, đổi mật khẩu.
- Xem điểm, nhiệm vụ, lịch sử, bảng xếp hạng.
- Quét QR trạm để tự chọn đúng thùng rác.
- Tạo QR giao dịch gửi rác.
- Dùng AI gợi ý phân loại rác bằng tiếng Việt.
- Xem bản đồ trạm, zoom/pan, chọn marker.
- Chọn avatar do admin upload.
- Gửi feedback.

### Mobile Volunteer

- Đăng ký volunteer ở trạng thái pending.
- Admin duyệt volunteer trên web.
- Volunteer chọn trạm trực, quét QR giao dịch student.
- Upload proof, confirm/reject/review.
- Hệ thống chặn QR hết hạn, đã dùng, sai trạm, token sai.

### AI

- Model chính: `backend/model/mobilenetv2_model.h5`.
- Endpoint cũ: `POST /predict`.
- Endpoint queue: `POST /predict/jobs`, `GET /predict/jobs/{job_id}`, `GET /predict/queue`.
- Queue chạy in-memory, phù hợp demo/laptop server 8GB RAM.

## Chạy Nhanh Bằng Docker

Yêu cầu:

- Docker Desktop for Windows.
- WSL2 backend bật trong Docker Desktop.
- Docker daemon đang chạy.

Chạy từ thư mục gốc:

```bat
start_docker.bat
```

Lệnh này dùng:

```powershell
docker compose --env-file .env.docker up --build
```

URL local:

| Dịch vụ | URL |
|---|---|
| Web admin | `http://127.0.0.1:3000` |
| Backend | `http://127.0.0.1:8000` |
| API docs | `http://127.0.0.1:8000/docs` |
| DB health | `http://127.0.0.1:8000/api/health/db` |
| AI queue | `http://127.0.0.1:8000/predict/queue` |
| PostgreSQL | `127.0.0.1:5432` |

## Cài Server Laptop Mới

Nếu laptop mới dùng làm server backend/web cho toàn bộ hệ thống, chạy file này bằng **Run as administrator**:

```bat
setup_server_full.bat
```

File này sẽ:

- Kiểm Docker Desktop.
- Có thể cài Docker Desktop qua `winget` sau khi người chạy xác nhận.
- Tạo `.env.docker` từ `.env.docker.example`.
- Lấy IP LAN của laptop server.
- Build web với `REACT_APP_API_URL=http://<IP-LAN>:8000`.
- Mở firewall port `3000` và `8000` nếu có quyền admin.
- Chạy PostgreSQL + backend + web bằng Docker Compose ở chế độ background.
- Kiểm backend, DB health, AI queue, web.
- Bootstrap admin mặc định.

Admin mặc định:

```text
Email: admin@school.edu.vn
Password: 123456
```

Đổi thông tin admin trước khi chạy:

```bat
set ADMIN_EMAIL=admin@example.com
set ADMIN_NAME=Eco-loop Admin
set ADMIN_PASSWORD=mat-khau-moi
setup_server_full.bat
```

Sau khi setup xong, script sẽ in:

```text
Web LAN: http://<IP-LAN>:3000
Backend LAN: http://<IP-LAN>:8000
```

App Android trong cùng Wi-Fi nên build với:

```env
EXPO_PUBLIC_API_URL=http://<IP-LAN>:8000
```

## Chạy Thủ Công Không Docker

### Backend

```powershell
cd backend
py -3.10 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app:app --host 127.0.0.1 --port 8000 --workers 1
```

Backend cần `DATABASE_URL` trỏ tới PostgreSQL. Launcher local có sẵn:

```bat
start_backend.bat
```

### Frontend

```powershell
cd frontend\eco-loop-campus-admin
npm install
npm start
```

Launcher build public/local:

```bat
start_frontend.bat
```

## Mobile APK

Thư mục app:

```text
ecoloop-campus-mobile/ecoloop-campus-mobile
```

APK release:

```text
dist/ecoloop-campus-mobile-release.apk
```

Khi test bằng Android Studio Emulator và backend chạy trên cùng laptop:

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

Khi test bằng điện thoại thật cùng Wi-Fi với laptop server:

```env
EXPO_PUBLIC_API_URL=http://<IP-LAN-LAPTOP-SERVER>:8000
```

Nếu đổi API URL, cần build lại APK.

## Public Tunnel

Quick tunnel Cloudflare chỉ phù hợp demo ngắn. URL `trycloudflare.com` có thể đổi sau mỗi lần restart, nên APK đã build với URL cũ sẽ không gọi được backend.

Launcher hiện có:

```bat
start_backend.bat
start_frontend.bat
```

Runtime URL được ghi vào:

```text
.runtime/api_public_url.txt
.runtime/web_public_url.txt
```

Muốn dùng ổn định lâu dài, nên dùng một trong các cách:

- Laptop server IP tĩnh trong LAN.
- Domain thật trỏ về server.
- Cloudflare named tunnel với domain cố định.

## Database

Schema PostgreSQL chính:

```text
backend/local_db/schema.sql
```

Bootstrap admin:

```text
backend/local_db/bootstrap_admin.sql
scripts/docker_bootstrap_admin.ps1
```

Dữ liệu mẫu tách riêng, không chạy trong Docker production:

```text
frontend/eco-loop-campus-admin/supabase/demo_seed.sql
```

Import danh sách sinh viên lớp `12523W.4`:

```text
backend/local_db/import_students_12523w4.py
```

Các bảng chính:

| Bảng | Vai trò |
|---|---|
| `users` | Tài khoản, role, lớp/nhóm, điểm, avatar |
| `avatar_presets` | Avatar do admin upload |
| `bins` | Trạm/thùng rác, QR, vị trí bản đồ |
| `waste_types` | Loại rác, đơn vị, điểm |
| `predictions` | Lượt AI phân loại |
| `point_rules` | Luật cộng điểm |
| `point_history` | Lịch sử điểm |
| `rewards` | Phần thưởng |
| `reward_redemptions` | Yêu cầu đổi thưởng |
| `missions` | Nhiệm vụ |
| `user_missions` | Tiến độ nhiệm vụ |
| `feedback` | Phản hồi |
| `recycling_submissions` | Giao dịch QR student |
| `qr_scan_logs` | Log volunteer quét QR |
| `proof_images` | Ảnh minh chứng |
| `settings` | Cấu hình model |

## API Chính

### Health

```text
GET /
GET /api/health/db
GET /predict/queue
```

### Auth

```text
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
POST /api/auth/change-password
POST /api/auth/logout
PATCH /api/users/{user_id}/status
```

### Admin

```text
GET /api/admin/{resource}
POST /api/admin/{resource}
DELETE /api/admin/{resource}/{item_id}
GET /api/avatar-presets
POST /api/avatar-presets
DELETE /api/avatar-presets/{key}
```

### Mobile

```text
GET /api/mobile/initial-data
PATCH /api/mobile/users/me/avatar
POST /api/mobile/predictions
POST /api/mobile/feedback
POST /api/mobile/missions/{mission_id}/advance
POST /api/mobile/reward-redemptions
POST /api/mobile/recycling-submissions
POST /api/mobile/recycling-submissions/scan
POST /api/mobile/recycling-submissions/{submission_id}/proof
POST /api/mobile/recycling-submissions/{submission_id}/confirm
POST /api/mobile/recycling-submissions/{submission_id}/reject
POST /api/mobile/recycling-submissions/{submission_id}/review
```

### AI

```text
POST /predict
POST /predict/jobs
GET /predict/jobs/{job_id}
POST /chat
```

## Test Và Build

Backend:

```powershell
backend\.venv\Scripts\python.exe -m pytest -q
```

Web:

```powershell
npm --prefix frontend\eco-loop-campus-admin test -- --watchAll=false --runInBand
npm --prefix frontend\eco-loop-campus-admin run build
```

Mobile:

```powershell
npm --prefix ecoloop-campus-mobile\ecoloop-campus-mobile test
npm --prefix ecoloop-campus-mobile\ecoloop-campus-mobile run typecheck
```

Startup/script checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\startup_scripts.test.ps1
```

Docker checks:

```powershell
docker compose --env-file .env.docker config
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f backend
```

## Cấu Trúc Thư Mục

```text
Eco-loop-Campus/
  backend/
    app.py
    Dockerfile
    local_db/
      schema.sql
      bootstrap_admin.sql
      init_local_postgres.ps1
      import_students_12523w4.py
    model/
      mobilenetv2_model.h5
      mobilenetv3_model.keras
    uploads/
  frontend/
    eco-loop-campus-admin/
      Dockerfile
      nginx.conf
      src/admin/
      public/
      package.json
  ecoloop-campus-mobile/
    ecoloop-campus-mobile/
      src/
      android/
      package.json
  scripts/
    docker_bootstrap_admin.ps1
    ensure_windows_runtime.ps1
    run_cloudflared_tunnel.ps1
    serve_cra_build.js
    startup_scripts.test.ps1
  dist/
    ecoloop-campus-mobile-release.apk
  docker-compose.yml
  setup_server_full.bat
  start_docker.bat
  start_backend.bat
  start_frontend.bat
```

## Ghi Chú Vận Hành

- Không commit `.env`, `.env.docker`, `.runtime`, logs, cache hoặc dữ liệu nhạy cảm.
- PostgreSQL Docker dùng volume `ecoloop_postgres_data`; không chạy `down -v` nếu không muốn xóa DB.
- Port public/LAN cần mở: web `3000`, backend `8000`.
- Không mở PostgreSQL `5432` ra internet.
- AI queue đang in-memory, job sẽ mất nếu backend restart.
- Máy 8GB RAM nên giữ `AI_QUEUE_WORKERS=1`.
- QR mới dùng payload JSON chuẩn Eco-loop; token cũ chỉ giữ để parser không crash khi gặp mã cũ.
