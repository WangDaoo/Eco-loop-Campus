# Eco-loop Campus – Mô hình phân loại và tái chế rác thải trong Trường Đại học Sư phạm Kỹ thuật Hưng Yên theo hướng kinh tế tuần hoàn

Eco-loop Campus là mô hình phân loại, thu gom và tái chế rác thải trong khuôn viên Trường Đại học Sư phạm Kỹ thuật Hưng Yên theo hướng kinh tế tuần hoàn. Repository này chứa web quản trị, backend AI FastAPI, Supabase Auth/Database, bản đồ GIS campus và tài liệu bàn giao để phát triển app mobile.

Dự án dùng AI như một lớp hỗ trợ, không phải toàn bộ nghiệp vụ. Luồng chính là sinh viên gửi rác tái chế, app tạo QR giao dịch, tình nguyện viên xác nhận rác thật tại trạm, hệ thống ghi nhận Ecopoint và admin theo dõi báo cáo.

![Project Status](https://img.shields.io/badge/Status-Active-success)
![Python](https://img.shields.io/badge/Python-3.10-blue)
![React](https://img.shields.io/badge/React-19-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2B%20Database-3ECF8E)
![TensorFlow](https://img.shields.io/badge/TensorFlow-2.13-orange)

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Objectives](#objectives)
- [System Architecture](#system-architecture)
- [Technologies Used](#technologies-used)
- [Features](#features)
- [Deployment and Local URLs](#deployment-and-local-urls)
- [Installation and Setup](#installation-and-setup)
- [Public Setup with Cloudflare Tunnel](#public-setup-with-cloudflare-tunnel)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Mobile App Direction](#mobile-app-direction)
- [Future Scope](#future-scope)
- [Credits and Acknowledgements](#credits-and-acknowledgements)

---

## Problem Statement

Waste management in a university campus is difficult when recyclable waste, organic waste, hazardous waste, and remaining waste are mixed together. This reduces recycling efficiency, makes reporting impossible, and weakens long-term student participation.

Eco-loop Campus solves this problem by combining:

- Classified collection stations and QR-based confirmation.
- Student and volunteer workflows.
- Ecopoint rewards, missions, leaderboard, and reward redemption.
- Admin reporting for scans, bins, feedback, points, and campus operations.
- AI-based waste recognition as a support tool for classification and verification.

The core business problem is not only image classification. The project needs an operating system for a school recycling loop: collect correct data, verify real submissions, reward valid behavior, detect abnormal activity, and export reports for management.

---

## Objectives

1. **Campus Waste Operation Management**
   Manage bins, QR stations, user roles, feedback, Ecopoint rules, and reports for school-scale recycling operations.

2. **Student Recycling Workflow**
   Prepare a mobile-first flow where students find stations, submit recyclable waste, create QR transactions, track status, and receive points after verification.

3. **Volunteer Verification Workflow**
   Support a future volunteer app for scanning QR transactions, checking real waste, capturing proof images, accepting or rejecting submissions, and logging abnormal cases.

4. **AI-Assisted Waste Classification**
   Use MobileNetV2 to classify waste images into 10 AI classes and map them into 4 school bin groups.

5. **Ecopoint and Engagement**
   Record point history, manual adjustments, leaderboard data, reward redemptions, and green participation metrics.

6. **Admin Reporting and Campus Map**
   Provide KPI dashboards, operational reports, CSV export, bin capacity alerts, feedback alerts, and GIS campus visualization.

---

## System Architecture

```mermaid
flowchart LR
  StudentApp[Mobile App - Student] --> SupabaseAuth[Supabase Auth]
  VolunteerApp[Mobile App - Volunteer] --> SupabaseAuth
  AdminWeb[Eco-loop Campus Admin Web] --> SupabaseAuth

  StudentApp --> SupabaseDB[Supabase Database]
  VolunteerApp --> SupabaseDB
  AdminWeb --> SupabaseDB

  StudentApp --> FastAPI[FastAPI AI Backend]
  VolunteerApp --> FastAPI
  AdminWeb --> FastAPI

  FastAPI --> Model[MobileNetV2 Waste Model]
  SupabaseDB --> Reports[Reports]
  SupabaseDB --> Points[Ecopoint]
  SupabaseDB --> CampusMap[Campus Map and Bin Stations]
```

Current system boundaries:

| Layer | Current responsibility |
|---|---|
| React admin web | Admin dashboard, CRUD screens, reports, map, AI testing |
| FastAPI backend | `/predict` AI inference and `/chat` local chatbot endpoint |
| Supabase Auth | Admin login and future mobile login |
| Supabase Database | Users, bins, predictions, point rules, point history, feedback, rewards, settings |
| localStorage fallback | Demo/offline fallback when Supabase is unavailable |
| Mobile app | Planned next phase based on `MOBILE_APP_HANDOFF.md` |

---

## Technologies Used

| Component | Technology | Purpose |
|---|---|---|
| Backend | Python, FastAPI, Uvicorn | AI API and chatbot endpoint |
| AI/ML | TensorFlow, Keras, MobileNetV2 | Waste classification |
| Frontend | React CRA, JavaScript, React Router | Admin web application |
| UI and charts | Chart.js, react-chartjs-2, Phosphor Icons | Dashboard, KPI, icon system |
| Map | Leaflet, GeoJSON, Proj4 | Campus map and bin station visualization |
| Database/Auth | Supabase Auth, Supabase Database | Admin auth and operational data |
| Fallback storage | localStorage | Demo/offline data fallback |
| Testing | Jest, React Testing Library, Pytest | Frontend and backend verification |
| Training | ImageDataGenerator, transfer learning, fine-tuning | MobileNetV2 training pipeline |

---

## Features

### Admin Authentication

- Supabase email/password login.
- Admin-only access using `users.role = admin` and `users.status = active`.
- Unauthorized users are blocked from the admin shell.

### Dashboard

- KPI cards for scans, pending approvals, open feedback, attention bins, and Ecopoint.
- Charts for scans, points, waste groups, feedback, and full bins.
- Alert links from dashboard to filtered pages.
- GIS campus map with interactive bin/station dots.

### Scans and AI Review

- List AI predictions from upload or camera.
- Show class, confidence, bin group, user, bin, and status.
- Approve or reject AI scan records.
- Write point history when an approved scan matches enabled point rules.

### Users, Classes, and Departments

- Manage students, teachers, volunteers, and admins.
- Search and filter by role, class/department, points, and status.
- Add, edit, and lock users.

### Bins and QR Stations

- Manage bin/station ID, name, bin group, location, building, floor, QR code, status, and capacity.
- Status support: active, full, maintenance.
- Capacity alert when a bin reaches 85% or higher.
- Drag station markers on the map and confirm or cancel location changes.

### Ecopoint

- Configure point rules for waste groups.
- View point history with filters.
- Add manual point adjustments with reasons.
- Show individual and group leaderboards.
- Manage reward redemption requests.

### Feedback

- Create and manage user feedback.
- Filter by status, priority, bin/station, and query.
- Add admin notes and update processing state.
- Surface unresolved feedback in dashboard alerts.

### Reports

- Filter by date range, building, and bin group.
- Summarize scans, points, feedback, and full bins.
- Generate charts and grouped operational tables.
- Export CSV from Supabase/fallback data.

### AI Tester

- Upload image or use camera.
- Call `http://127.0.0.1:8000/predict`.
- Select QR/bin context.
- Save predictions to Supabase or local fallback.

### Model Settings

- Display MobileNetV2 model information.
- Show 10 AI classes.
- Configure confidence warning threshold.

---

## Deployment and Local URLs

The project can run in two modes:

- **Local mode** for development on one machine.
- **Public demo mode** for exposing the web admin and FastAPI backend through Cloudflare quick tunnels.

Public quick tunnel URLs are temporary. When the tunnel window is closed, the URL stops working and a new URL will be generated on the next launch.

| Service | URL |
|---|---|
| Frontend admin | `http://127.0.0.1:3000/#/dashboard` |
| Login page | `http://127.0.0.1:3000/#/login` |
| Backend API | `http://127.0.0.1:8000` |
| Backend docs | `http://127.0.0.1:8000/docs` |
| AI predict endpoint | `http://127.0.0.1:8000/predict` |
| AI queue endpoint | `http://127.0.0.1:8000/predict/jobs` |

---

## Installation and Setup

### Prerequisites

- Python 3.10
- Node.js 18 or higher
- npm
- Supabase project with Auth and Database enabled
- Optional: Ollama with `llama3` for local chatbot responses

### Backend Setup

```powershell
cd backend
py -3.10 -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Backend runs on:

```text
http://127.0.0.1:8000
```

### Frontend Setup

```powershell
cd frontend\eco-loop-campus-admin
npm install
npm start
```

Frontend runs on:

```text
http://127.0.0.1:3000
```

### Supabase Setup

Run schema file on the real Supabase project:

```text
frontend/eco-loop-campus-admin/supabase/schema.sql
```

Frontend environment variables:

```env
REACT_APP_SUPABASE_URL=<supabase-project-url>
REACT_APP_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
REACT_APP_API_URL=http://127.0.0.1:8000
```

Do not commit real `.env` files. Only `.env.example` should be committed.

### Quick Start Scripts

From project root:

```bat
start_backend.bat
start_frontend.bat
```

## Public Setup with Cloudflare Tunnel

This setup is intended for demoing Eco-loop Campus from another laptop, phone, emulator, or external network without deploying to a paid server. It exposes:

- FastAPI backend through a public `https://*.trycloudflare.com` URL.
- React admin web through a second public `https://*.trycloudflare.com` URL.
- Web build configured to call the public API URL instead of `127.0.0.1`.

### What the scripts do automatically

The root launchers check and prepare the Windows runtime before starting the project:

- Check Python 3.10 for backend.
- Check Node.js and npm for frontend.
- Download `cloudflared-windows-amd64.exe` into `scripts/tools/cloudflared.exe` when missing.
- Create backend `.venv` when missing.
- Install backend dependencies from `backend/requirements.txt`.
- Install frontend dependencies when `node_modules` is missing.
- Build the React admin web before serving it publicly.
- Write generated tunnel URLs into `.runtime/api_public_url.txt` and `.runtime/web_public_url.txt`.

### One-command public startup

From the repository root, run:

```bat
scripts\start_laptop_server.bat
```

This opens the backend first, waits for `.runtime\api_public_url.txt`, then opens the frontend. Use the URLs printed in the terminal windows or read them from:

```text
.runtime/api_public_url.txt
.runtime/web_public_url.txt
```

Expected local services:

```text
API local: http://127.0.0.1:8000
Web local: http://127.0.0.1:3000
API public: https://<random>.trycloudflare.com
Web public: https://<random>.trycloudflare.com
```

### Manual public startup

If you want to control the order manually, run backend first:

```bat
start_backend.bat
```

Wait until `.runtime\api_public_url.txt` exists and contains a Cloudflare URL. Then run:

```bat
start_frontend.bat
```

The frontend launcher reads `.runtime\api_public_url.txt` and builds the web admin with:

```env
REACT_APP_API_URL=<api-public-url>
```

If the backend public URL is not ready, the frontend falls back to:

```env
REACT_APP_API_URL=http://127.0.0.1:8000
```

That fallback works only on the same laptop. For other devices, restart `start_frontend.bat` after the API public URL is available.

### Public API checks

After backend starts, verify:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/predict/queue
```

Then test the public URL from `.runtime\api_public_url.txt`:

```powershell
$api = Get-Content .runtime\api_public_url.txt
Invoke-WebRequest -UseBasicParsing "$api/"
Invoke-WebRequest -UseBasicParsing "$api/predict/queue"
```

Expected backend root response:

```json
{"message":"Eco-loop Campus Backend Running"}
```

### Public web checks

After frontend starts, open:

```text
http://127.0.0.1:3000/#/login
```

For public access, open the URL in `.runtime\web_public_url.txt`:

```powershell
$web = Get-Content .runtime\web_public_url.txt
Start-Process "$web/#/login"
```

In the admin web, test:

- `#/dashboard` for KPI data.
- `#/ai-test` for AI upload through `/predict/jobs`.
- `#/users` for user and volunteer approval management.
- `#/ecopoints` for rewards, redemption requests, points, and leaderboard.

### Mobile APK and emulator setup for public API

For an APK that runs outside Expo Go/Metro, build it with the public API URL:

```env
EXPO_PUBLIC_API_URL=<api-public-url>
EXPO_PUBLIC_SUPABASE_URL=<supabase-project-url>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<supabase-publishable-key>
```

If the APK is already built with an old Cloudflare URL, rebuild and reinstall the APK after the tunnel URL changes. For Android Studio Emulator local-only testing, `http://10.0.2.2:8000` can still be used instead of a public URL, but that address will not work for other real devices.

### Security notes

- Do not commit `.env`, `.runtime`, Supabase keys, tunnel URLs, or generated local logs.
- Cloudflare quick tunnel URLs are suitable for demo/testing, not a permanent production domain.
- Keep the Supabase publishable key only in environment files; never paste real keys into README, reports, screenshots, or commits.
- Public web access still depends on Supabase Auth and role checks. Admin pages require a user in `public.users` with role `admin` and status `active`.

### Troubleshooting public startup

| Problem | Fix |
|---|---|
| Frontend public URL opens but AI fails | Start `start_backend.bat` first, confirm `.runtime\api_public_url.txt`, then rerun `start_frontend.bat`. |
| `.runtime\api_public_url.txt` is missing | Check the `Eco-loop Campus API Public` window. Cloudflare tunnel may still be starting or blocked by network/firewall. |
| `cloudflared` is missing | Run `start_backend.bat` or `scripts\start_laptop_server.bat`; the runtime checker downloads it into `scripts\tools`. |
| TensorFlow install fails | Use Python 3.10 and rerun `start_backend.bat`. The launcher creates `backend\.venv` with Python 3.10. |
| Web public still calls `127.0.0.1:8000` | Delete `frontend\eco-loop-campus-admin\build`, confirm API public URL exists, then rerun `start_frontend.bat`. |
| Quick tunnel URL expired | Keep both tunnel windows open. If closed, restart backend/frontend and use the new URLs. |

---

## Usage

1. Start backend and frontend.
2. Open `http://127.0.0.1:3000/#/login`.
3. Sign in with a Supabase Auth account that also exists in `users` with role `admin`.
4. Use Dashboard to monitor KPIs, alerts, reports, and campus map.
5. Use Bins to manage QR stations and bin capacity.
6. Use AI Tester to upload/capture a waste image and call `/predict`.
7. Use Scans to approve/reject AI records.
8. Use Ecopoint to manage rules, point history, leaderboard, manual adjustments, and rewards.
9. Use Feedback and Reports to handle operations and export CSV.

---

## Project Structure

```text
Eco-loop-Campus/
  backend/
    app.py
    model/
      mobilenetv2_model.h5
      mobilenetv3_model.keras
    requirements.txt
    test_app_endpoints.py
    test_app_startup.py
  frontend/
    eco-loop-campus-admin/
      public/assets/geojson/
      src/admin/
        AdminApp.js
        admin.css
        components/
        data/
        pages/
        services/
      src/supabaseClient.js
      supabase/schema.sql
      package.json
  model_training/
    dataset/
    train_mobilenetv2.py
    train_mobilenetv3.py
  FUNCTION_TEST_ROADMAP.md
  MOBILE_APP_HANDOFF.md
  start_backend.bat
  start_frontend.bat
  README.md
```

---

## AI Model and Waste Mapping

Model file:

```text
backend/model/mobilenetv2_model.h5
```

Training script:

```text
model_training/train_mobilenetv2.py
```

Model facts:

- Architecture: MobileNetV2 transfer learning.
- Input size: `224x224` RGB image.
- Output: 10-class softmax.
- Dataset layout: folder-per-class under `model_training/dataset`.
- Training: `ImageDataGenerator`, augmentation, validation split, frozen base training, then fine-tuning.

AI classes:

```text
battery, biological, cardboard, clothes, glass, metal, paper, plastic, shoes, trash
```

Mapping to school bin groups:

| AI class | Bin group |
|---|---|
| `biological` | Hữu cơ |
| `paper`, `cardboard`, `plastic`, `glass`, `metal` | Tái chế |
| `battery` | Pin / nguy hại |
| `clothes`, `shoes`, `trash` | Còn lại |

Important rule: AI does not directly award points. Ecopoint should be awarded after volunteer or admin verification.

---

## Supabase Data Model

Current tables:

| Table | Purpose |
|---|---|
| `users` | User profile, role, group/class, points, status |
| `bins` | Bin/station data, QR code, location, capacity, map coordinates |
| `predictions` | AI scan records and AI proof data |
| `point_rules` | Ecopoint rules by waste class and bin group |
| `point_history` | Point transaction history |
| `feedback` | Feedback and admin handling notes |
| `reward_redemptions` | Reward redemption requests |
| `settings` | Model threshold and AI metadata |

Target mobile tables to add later:

| Table | Purpose |
|---|---|
| `waste_types` | Recycling categories, units, point rules |
| `recycling_submissions` | Student waste submission transactions and QR state |
| `qr_scan_logs` | Every QR scan result, including invalid cases |
| `proof_images` | Volunteer proof photos and hashes |
| `missions` | Green weekly/monthly missions |
| `user_missions` | User mission progress |
| `rewards` | Reward catalog |
| `recycling_partners` | Recycling partners |
| `recycling_batches` | Waste transfer batches |
| `sponsors` | Sponsors and voucher partners |

---

## Mobile App Direction

The mobile app should follow the Eco-loop Campus operation-first model.

### Student App

- Login and load profile from Supabase.
- View Ecopoint wallet, missions, nearby stations, and main CTA `Gửi rác tái chế`.
- Search waste sorting guide.
- Find stations by building, floor, room, or map.
- Create recycling submission with waste type, station, quantity, and unit.
- Generate one-time QR transaction.
- Track submission status, point history, leaderboard, rewards, and feedback.

### Volunteer App

- Login with volunteer/admin role.
- Select assigned station.
- Scan student QR transaction.
- Verify token, station, role, expiry, and status.
- Check real waste, adjust quantity, capture proof image.
- Accept/reject submission and write abnormal notes.
- Monitor station capacity and unresolved feedback.

### QR Anti-Fraud Rules

- QR token must be one-time and time-limited.
- QR token must not contain editable point/user data.
- Every scan must create a log: `SUCCESS`, `EXPIRED`, `ALREADY_USED`, `INVALID_TOKEN`, `WRONG_STATION`, `INVALID_ROLE`, or `SUSPECTED_FRAUD`.
- Point updates should use RPC, Edge Function, or backend API for atomic writes.
- Mobile clients should not update `users.points` directly.

---

## Future Scope

- Add `recycling_submissions`, `waste_types`, `qr_scan_logs`, and `proof_images` for true mobile operations.
- Build Flutter student app for QR submissions and Ecopoint wallet.
- Build volunteer scanner flow for QR verification and proof image capture.
- Add Supabase Storage for proof images.
- Add RPC/Edge Functions for secure QR generation, verification, and point awarding.
- Add indoor maps by building, floor, room, and station position.
- Add missions, reward catalog, sponsor integration, and recycling partner batches.
- Add Eco Community for green posts, likes, comments, saved posts, and moderation.
- Convert model to TensorFlow Lite if mobile on-device inference becomes required.

---

## Testing

Frontend:

```powershell
cd frontend\eco-loop-campus-admin
npm test -- --watchAll=false --runInBand --silent
npm run build
```

Backend:

```powershell
backend\.venv\Scripts\python.exe -m pytest -q
```

Diff check:

```powershell
git diff --check
```

Detailed function test plan:

```text
FUNCTION_TEST_ROADMAP.md
```

Mobile operation audit:

```text
MOBILE_APP_HANDOFF.md - Section 31: Kế hoạch kiểm tra mức độ bám Eco-loop Campus
```

Use this audit before building the next mobile backend phase. It checks each small app function one by one, captures emulator screenshots as evidence, compares mobile data with Supabase/admin web, and scores how closely the app follows the Eco-loop Campus operation-first flow.

Minimum audit order:

1. Open the app in Android Studio Emulator through Expo Go.
2. Login as student and capture Home, wallet, missions, and sync state.
3. Create a recycling submission and capture the generated QR transaction.
4. Login as volunteer, scan or enter that QR, capture proof, then accept/reject.
5. Reopen student history and Ecopoint wallet to verify the status and point result.
6. Send feedback and verify the alert appears in the admin web.
7. Start FastAPI, test AI suggestion through `/predict`, then test the app behavior when FastAPI is unavailable.
8. Record each result as `Đạt`, `Đạt một phần`, `Chưa đạt`, or `Chưa kiểm tra được`.

---

## Credits and Acknowledgements

- **Dataset:** Garbage Dataset
- **Supervisor:** Nguyễn Thị Tươi, Ngô Quang Hiệp

### Team Members

- Phạm Thanh Hương (11425064)
- Nguyễn Phương Thảo (11425159)
- Đào Minh Quang (10123264)
- Phan Văn Khánh (12523037)
