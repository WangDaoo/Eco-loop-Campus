# Eco-loop Campus Mobile

React Native/Expo app cho sinh viên va tinh nguyen vien Eco-loop Campus. App mobile ket noi Supabase Auth/Database realtime va FastAPI AI backend cua du an hien tai.

## Features

- Dang nhap/dang ky theo vai tro sinh vien hoac volunteer.
- Home dashboard hien diem, nhiem vu xanh, leaderboard va quick actions.
- Tao giao dich nop rac, sinh QR token dung mot lan cho volunteer xac nhan.
- AI goi y loai rac bang FastAPI `/predict`, luu ket qua vao `predictions` de admin duyet.
- Map tram thu gom doc tu `bins`, hien vi tri, trang thai va canh bao suc chua.
- Volunteer quet QR, chup anh minh chung, xac nhan/tu choi/yeu cau review.
- Lich su giao dich, lich su AI, vi diem, doi thuong va log QR realtime.

## Run locally

```bash
npm install
npm start
```

Mo app bang Expo dev client, Android emulator/LDPlayer, iOS simulator hoac web neu can test nhanh UI.

## Supabase backend

Mobile can Supabase project da chay schema tu admin web:

```text
frontend/eco-loop-campus-admin/supabase/schema.sql
```

Can bat Supabase Auth email/password va tao user test trong Supabase Auth, sau do dam bao bang `users` co profile trung email/role:

- `student@school.edu.vn` role `student`
- `volunteer@school.edu.vn` role `volunteer`

Copy `.env.example` thanh `.env`, dien public config va tai khoan smoke. Khong commit Supabase key that.

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
EXPO_PUBLIC_TEST_STUDENT_EMAIL=student@school.edu.vn
EXPO_PUBLIC_TEST_STUDENT_PASSWORD=change-me
EXPO_PUBLIC_TEST_VOLUNTEER_EMAIL=volunteer@school.edu.vn
EXPO_PUBLIC_TEST_VOLUNTEER_PASSWORD=change-me
EXPO_PUBLIC_SMOKE_WRITE=0
```

## AI backend

FastAPI backend can chay tai `http://127.0.0.1:8000`. Tren LDPlayer/Android emulator, reverse port:

```powershell
& 'D:\LDPlayer\LDPlayer9\adb.exe' reverse tcp:8000 tcp:8000
```

App goi `POST /predict` bang multipart `file`, nhan `{ class, confidence }`, map class AI sang nhom thung va luu vao `predictions`.

## Useful scripts

```bash
npm run typecheck
npm test
npm run smoke:supabase
npm run android
npm run ios
npm run web
```

`npm run smoke:supabase` co 2 muc:

- Read-only: dang nhap student, doc schema, `bins`, `waste_types`, `rewards`, submissions.
- Write mode: dat `EXPO_PUBLIC_SMOKE_WRITE=1` de test QR/proof/confirm flow bang student + volunteer account.

Smoke that chi pass khi `.env` co account Supabase Auth that va schema tren Supabase project da duoc chay.

## On-device AI thử nghiệm

Đã chuẩn bị model TFLite để nhúng app:

```text
src/assets/ai/mobilenetv2_waste_float32.tflite
src/assets/ai/labels.txt
```

Model này được convert từ `backend/model/mobilenetv2_model.h5`, kích thước khoảng 2.5 MB. Hiện app vẫn mặc định dùng FastAPI vì Expo Go chưa có native TFLite runtime.

Cấu hình thử nghiệm:

```env
EXPO_PUBLIC_AI_MODE=remote
```

- `remote`: gọi FastAPI `/predict`, phù hợp Expo Go.
- `local-first`: thử chạy on-device trước, nếu runtime native chưa khả dụng thì tự fallback FastAPI.

Để chạy on-device thật cần Expo Dev Build/EAS Build và cài native TFLite runtime. Không dùng trực tiếp trong Expo Go.

Convert lại model:

```powershell
cd "D:\Project\NỔ NỔ\Eco-loop-Campus\backend"
.\.venv\Scripts\python.exe .\convert_model_to_tflite.py
```
