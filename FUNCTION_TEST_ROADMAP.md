# Eco-loop Campus Function Test Roadmap

Tài liệu này chia toàn bộ chức năng hiện có thành các plan nhỏ để test tuần tự. Quy tắc làm việc: mỗi module phải có test pass đầy đủ trước khi chuyển sang module tiếp theo. Nếu gặp case không hợp lệ hoặc test fail, dừng tại module đó, tìm root cause, viết test tái hiện lỗi, sửa, chạy lại test liên quan và full regression.

## 0. Baseline và môi trường

Trạng thái đã xác nhận:

- Frontend test command: `npm test -- --watchAll=false --runInBand --silent`
- Frontend baseline hiện tại: `241 passed`, `16 test suites passed` sau module Reports + Feedback + Bins + AI Tester + Ecopoints + Users + Dashboard + Auth + Model settings + Shared UI components + Supabase client env config + Supabase store mapper/integration + storage localStorage fallback hardening + CSV export + fallback save/update cases + CampusMap malformed data guard + Dashboard bin attention KPI/status guard + Dashboard dirty prediction bin group count guard + Dashboard model threshold low-confidence guard + Dashboard bin capacity clamp guard + Ecopoints fallback alert + Ecopoints invalid UI timestamp guard + Users create/edit fallback + Users success toast tone reset + Users service profile validation guard + Users service status allowlist guard + Users service role allowlist guard + Model threshold invalid UI + AI Tester camera capture + AI Tester camera permission/no-support guards + AI Tester invalid confidence guard + Supabase per-table fallback service test + Users edit duplicate email guard + Users invalid email format guard + Users search trim guard + Users dirty group filter guard + Users dirty status normalization guard + StatusBadge dirty status normalization guard + DataTable missing rows guard + Modal Escape close + Toast dirty tone normalization + storage non-array JSON guard + storage threshold NaN load/save guard + storage collection save non-array guard + Supabase blank env trim guard + NEXT_PUBLIC_SUPABASE_URL fallback + Auth blank credentials guard + Auth invalid email format guard + Auth listener registration sync failure guard + Auth dirty role/status/email profile normalization guard + Supabase user points NaN guard + Supabase user points read guard + Scan approval fallback malformed user points guard + Scan dirty point rule classKeys guard + Scan duplicate approval point guard + Reward redemption live fallback update guard + Reward redemption malformed cost guard + Reward redemption dirty pending status guard + Reward request malformed user points guard + Reward request service validation guard + Point history malformed points guard + Reports malformed point metrics guard + Reports malformed collections filter guard + Reports malformed collections summary guard + Reports malformed daily collections guard + Reports malformed csv collections guard + Reports open feedback status guard + Reports malformed bin capacity CSV guard + Reports dirty full bin status guard + Reports dirty full bin grouped table guard + Reports dirty building/binGroup filter guard + Reports dirty query UI normalization guard + Ecopoints malformed point leaderboard guard + Ecopoints malformed user leaderboard input guard + Ecopoints malformed user leaderboard history guard + Ecopoints malformed group leaderboard users guard + Ecopoints malformed group leaderboard history guard + Ecopoints dirty group/binGroup filter guard + Ecopoints dirty query UI normalization guard + Ecopoints missing users filter guard + Ecopoints malformed users filter guard + Ecopoints malformed history filter guard + Ecopoints manual point fallback malformed user points guard + Ecopoints service manual point validation guard + Ecopoints non-array point rules save guard + Bins duplicate station id/QR guards + Bins required field trim guard + Bins service required field guard + Bins service capacity/map clamp guard + Bins service status allowlist guard + Bins service binGroup allowlist guard + Prediction service invalid scan guard + Prediction service status allowlist guard + Prediction service source allowlist guard + Bins edit giữ ID/update fields + Bins attention filter + Bins dirty status attention guard + Bins dirty status query filter guard + Bins giữ QR chính mình khi edit + Bins invalid status update guard + CampusMap dirty station status summary guard + Feedback invalid timestamp guard + Feedback status filters + Feedback dirty status open filter guard + Feedback dirty status query filter guard + Feedback dirty priority filter/label guard + Feedback update priority guard + Feedback update blank message guard + Feedback unknown status/priority fallback guard + Feedback blank sender fallback + Feedback invalid status update guard + Feedback service blank message guard + Feedback service status/priority save guard + Scans non-string class guard + Scans dirty status pending filter/action guard + Scans dirty query filter guard + Waste class dirty key normalization + Model settings class_count fallback guard + Bin group dirty label color guard + Mobile handoff operation-first document guard + DataTable malformed cell guard + Logout signOut failure navigation guard + Sidebar missing items/icon guards + StatCard dirty tone/invalid icon guard + ChartPanel missing data/options guard + CSV missing rows guard + storage savePredictions missing array guard + AI Tester upload source while camera on guard + AI Tester non-image upload guard + AI Tester camera capture blob error guard + AI Tester backend confidence range guard + Scan point rule string false enabled guard + Scan local fallback point rule enabled guard.
- Backend test command: `backend\.venv\Scripts\python.exe -m pytest -q`
- Backend baseline: `10 passed`, `10 warnings` sau endpoint tests + model output class count/range guard + chat blank guard.
- Fix đã làm: thêm `pytest` vào `backend\requirements.txt` vì venv đúng Python 3.10/TensorFlow thiếu test runner.

Gate:

- Không dùng `python -m pytest` mặc định trên máy này vì đang trỏ Python 3.14 và thiếu TensorFlow.
- Backend phải chạy bằng `backend\.venv\Scripts\python.exe` hoặc Python 3.10 đã cài đủ requirements.

## 1. Auth và quyền admin

Files chính:

- `frontend\waste-frontend\src\admin\services\authContext.js`
- `frontend\waste-frontend\src\admin\services\supabaseStore.js`
- `frontend\waste-frontend\src\admin\pages\LoginPage.js`
- `frontend\waste-frontend\src\admin\AdminApp.js`

Case cần test:

- Chưa đăng nhập -> redirect `#/login`.
- Login đúng admin -> vào `#/dashboard`.
- Login lỗi Supabase -> hiện lỗi rõ.
- User đã auth nhưng không có `role=admin` -> màn không có quyền.
- User admin nhưng `status != active` -> bị chặn.
- Supabase profile lỗi -> không crash, hiện state phù hợp.
- Logout -> session bị xóa, quay về login.
- Logout khi Supabase `signOut` lỗi vẫn phải rời admin shell và quay về `#/login`.

Test hiện có:

- Redirect unauthenticated.
- Supabase login errors.
- Block non-admin.
- Block admin có `status != active`.
- Dashboard loads for admin.
- Logout gọi Supabase Auth signOut và quay về login.
- Logout vẫn quay về login khi Supabase Auth `signOut` trả lỗi, không kẹt dashboard.
- Supabase profile/data fetch lỗi dùng fallback localStorage và hiện cảnh báo dự phòng.
- Lỗi `getSession` khi load đầu -> quay về login, không crash dashboard shell.
- Login admin thành công vẫn vào dashboard khi Supabase auth listener chưa phát event kịp.
- Session admin hợp lệ vẫn vào dashboard khi đăng ký Supabase auth listener ném lỗi đồng bộ.
- Login Supabase thành công nhưng profile không phải admin -> chặn ngay tại login và hiện lỗi quyền admin.
- Login email/password rỗng hiện lỗi `Nhập email và mật khẩu`, không gọi Supabase Auth, không vào dashboard.
- Login email sai định dạng hiện lỗi `Email không hợp lệ`, không gọi Supabase Auth, không vào dashboard.
- Admin profile có role/status bẩn như ` Admin ` / ` active ` vẫn được nhận diện đúng.
- Admin profile match bằng email trim + case-insensitive khi Supabase Auth `user.id` khác `users.id`.

Fix đã làm:

- `getAdminProfile` chỉ trả profile admin khi role admin/quản trị và `status === active`.
- `LoginPage` đồng bộ user vừa đăng nhập vào `AdminAuthProvider` qua `applyAuthUser`, kiểm tra profile admin trước khi điều hướng dashboard.
- `LoginPage.submitLogin` trim email/password, chặn credentials rỗng trước `signInAdmin`.
- `LoginPage.submitLogin` kiểm tra định dạng email trước `signInAdmin`, tránh gửi input sai sang Supabase Auth.
- `AdminAuthProvider` bọc `supabase.auth.onAuthStateChange` bằng `try/catch` để lỗi đăng ký listener không crash React effect; `getSession` vẫn quyết định state phiên đầu.
- `Topbar.logout` bắt lỗi `signOutAdmin` nhưng vẫn điều hướng `#/login`, tránh kẹt admin shell khi Supabase signOut lỗi.
- `getAdminProfile` trim/lower email, role và status trước khi so khớp quyền admin.

Gaps:

- Chưa có gap Auth ưu tiên cao còn mở.

## 2. Supabase store và localStorage fallback

Files chính:

- `src\supabaseClient.js`
- `src\admin\services\supabaseStore.js`
- `src\admin\services\storage.js`

Case cần test:

- Supabase configured -> gọi đúng table.
- Supabase env blank/space-only -> không configured, không gọi `createClient`.
- Supabase URL support `REACT_APP_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_URL` fallback.
- Supabase key support publishable/anon theo `REACT_APP_*` và `NEXT_PUBLIC_*`.
- Supabase null/lỗi -> fallback localStorage.
- Mapping snake_case <-> camelCase đúng cho mọi bảng.
- Save/update user không làm mất field.
- Save/update bin giữ `mapX/mapY`, `capacity`, `qrCode`.
- `saveBin` từ chối id/name/location rỗng trước khi ghi `bins`.
- `saveBin` clamp `capacity/mapX/mapY` về 0..100 trước khi ghi `bins` khi service bị gọi trực tiếp.
- `saveBin` từ chối status ngoài `active/full/maintenance` trước khi ghi `bins` khi service bị gọi trực tiếp.
- `saveBin` từ chối `binGroup` ngoài 4 nhóm thùng trường học trước khi ghi `bins` khi service bị gọi trực tiếp.
- `savePredictionRecord` từ chối class/source rỗng và confidence non-number/out-of-range trước khi ghi `predictions`.
- `savePredictionRecord` từ chối status ngoài `pending/approved/rejected` trước khi ghi `predictions`.
- `savePredictionRecord` từ chối source ngoài `upload/camera` trước khi ghi `predictions`.
- Save prediction tự map `binGroup` từ class.
- Approve scan ghi `point_history` khi rule enabled.
- Reject scan không ghi điểm.
- Manual point cộng vào `users.points`.
- Reward redemption save/update đúng status.
- Model threshold save/load đúng số.

Test hiện có:

- localStorage fallback.
- reward fallback.
- AI tester writes Supabase.
- approval writes point history.
- `users.created_at` -> `createdAt` mapper unit test.
- `users.createdAt` -> `created_at` mapper unit test.
- `bins.bin_group/qr_code/map_x/map_y` -> `binGroup/qrCode/mapX/mapY` mapper unit test, bỏ snake dư trong app object.
- `bins` camelCase -> snake_case mapper unit test.
- `saveBin` clamp capacity/map coordinate trước khi ghi Supabase/localStorage khi bị gọi trực tiếp.
- `saveBin` chặn status lạ như `archived`, không ghi Supabase/localStorage khi bị gọi trực tiếp.
- `saveBin` chặn `binGroup` rỗng/lạ, không ghi Supabase/localStorage khi bị gọi trực tiếp.
- `predictions.bin_group/user_id/bin_id/image_name` -> camelCase mapper unit test, confidence invalid được clamp qua `normalizePrediction`.
- `predictions` camelCase -> snake_case mapper unit test.
- `savePredictionRecord` chặn class/source rỗng và confidence không hợp lệ, không ghi Supabase/localStorage khi bị gọi trực tiếp.
- `savePredictionRecord` chặn status lạ như `archived`, không ghi Supabase/localStorage khi bị gọi trực tiếp.
- `savePredictionRecord` chặn source lạ như `webhook`, không ghi Supabase/localStorage khi bị gọi trực tiếp.
- `point_rules.class_keys/bin_group` -> camelCase mapper unit test, bỏ snake dư.
- `point_rules` camelCase -> snake_case mapper unit test.
- `point_history.prediction_id/user_id/bin_id/bin_group/created_at/admin_note` -> camelCase mapper unit test, bỏ snake dư.
- `point_history` camelCase -> snake_case mapper unit test.
- `point_history.points` malformed từ Supabase -> `points = 0`, không để `NaN` lan sang Dashboard/Reports/Ecopoints.
- `feedback.user_name/bin_id/admin_note/resolved_at` -> camelCase mapper unit test, bỏ snake dư.
- `feedback` camelCase -> snake_case mapper unit test.
- `reward_redemptions.user_id/reward_label/cost_points/requested_at/reviewed_at/admin_note` -> camelCase mapper unit test, bỏ snake dư.
- `reward_redemptions` camelCase -> snake_case mapper unit test.
- `reward_redemptions.cost_points` malformed từ Supabase -> `costPoints = 0`, không để `NaN` vào UI đổi thưởng.
- `settings.model_name/class_count/updated_at` -> camelCase mapper unit test, threshold invalid được clamp.
- `settings` camelCase -> snake_case mapper unit test, threshold non-number fallback `0.65`.
- `users.points` non-number -> `0` trước khi gửi Supabase, không gửi `NaN`.
- `saveUser` từ chối name/email rỗng hoặc email sai định dạng trước khi ghi `users`.
- `saveUser` từ chối status ngoài `active/locked` trước khi ghi `users`.
- `saveUser` từ chối role ngoài `student/teacher/volunteer/admin` trước khi ghi `users`.
- Save user dùng payload Supabase snake_case qua `toUser`.
- Seed defaults dùng `seedUsers.map(toUser)`, không gửi camel `createdAt` vào bảng `users`.
- Reject scan không ghi point history và không cộng user points đã cover qua Scans.
- Point rule disabled không cộng điểm đã cover qua Scans.
- Point rule `enabled` bẩn dạng chuỗi `" false "` được coi là tắt, không ghi `point_history` và không cộng user points.
- LocalStorage fallback point rule `enabled` dạng chuỗi `" false "` cũng được coi là tắt khi Supabase update lỗi.
- `savePointRules` từ chối input không phải array, không gọi Supabase `point_rules`, không ghi localStorage fallback.
- Supabase store list functions gọi đúng `from(table).select("*")` cho `users`, `bins`, `predictions`, `feedback`, `point_rules`, `point_history`, `reward_redemptions`, `settings`; `settings` dùng `eq("id", "model")` và `maybeSingle`.
- Supabase store save/update functions gửi đúng table-specific snake_case payload cho `users`, `bins`, `predictions`, `feedback`, `point_rules`, `reward_redemptions`, `settings`, insert `point_history`, update status và cộng `users.points` khi manual point.
- `saveManualPointHistory` từ chối record thiếu user/lý do, điểm `0`, điểm non-number trước khi ghi `point_history` hoặc cộng `users.points`.
- `saveRewardRedemption` từ chối yêu cầu thiếu user/phần thưởng, cost `0` hoặc non-number trước khi ghi `reward_redemptions`.
- `saveFeedbackItem` từ chối message rỗng/toàn khoảng trắng trước khi ghi `feedback`.
- `saveFeedbackItem` từ chối status/priority ngoài allowlist trước khi ghi `feedback`.
- `updateBinStatus` từ chối status ngoài `active/full/maintenance`, không gọi Supabase update, không ghi localStorage fallback và giữ status hiện tại.
- `updateFeedbackStatus` từ chối status ngoài `unread/in_progress/resolved/rejected/read`, không gọi Supabase update, không ghi localStorage fallback và giữ status hiện tại.
- `updateFeedbackItem` từ chối cập nhật priority ngoài `low/medium/high`, không gọi Supabase update và giữ priority hiện tại.
- `updateFeedbackItem` từ chối cập nhật message rỗng/toàn khoảng trắng, không gọi Supabase update, không ghi localStorage fallback và giữ message hiện tại.
- Supabase store save/update failure fallback ghi localStorage cho `users`, `bins`, `predictions`, `feedback`, `point_rules`, `reward_redemptions`, `settings`, `point_history` và cập nhật trạng thái/status tương ứng.
- Reward redemption update failure thêm record live từ Supabase vào localStorage nếu local fallback chưa có item cần update.
- `supabaseClient` blank env sau trim không tạo client và export config rỗng.
- `supabaseClient` dùng `NEXT_PUBLIC_SUPABASE_URL` khi cần dùng chung env web/mobile.
- `storage.js` lưu reward redemptions vào localStorage fallback.
- `storage.js` đọc `smartWastePredictions` không crash khi localStorage chứa JSON hợp lệ nhưng sai kiểu array.
- `storage.js` lÆ°u `smartWastePredictions` vá»›i input thiáº¿u/sai kiá»ƒu thÃ nh máº£ng rá»—ng, khÃ´ng crash.
- `storage.js` save collection helpers (`users/bins/feedback/pointRules/pointHistory/rewardRedemptions`) với input sai kiểu thành mảng rỗng, không lưu chuỗi/object rác.
- `storage.js` load threshold model sai kiểu/non-number fallback `0.65` thay vì `NaN`.
- `storage.js` save threshold model sai kiểu/non-number ghi `0.65`, không lưu chuỗi rác.

Fix đã làm:

- `fromBin`, `fromPointRule`, `fromPointHistory`, `fromFeedback`, `fromRewardRedemption` strip snake_case fields trước khi trả app object.
- `fromPointRule/toPointRule` normalize `enabled` boolean; chuỗi `false/0/no/disabled/off` không còn bị truthy khi duyệt scan.
- `setPredictionStatus` dùng `normalizedEnabled` trong cả Supabase path và localStorage fallback path khi tìm point rule.
- `fromPointHistory` finite-check `points`; dữ liệu bẩn/non-number fallback `0`.
- Export `__testing` mapper để khóa unit test thuần, không cần mock Supabase network.
- `fromFeedback` sanitize snake_case trước khi gọi `normalizeFeedback` vì helper giữ lại original fields.
- `fromRewardRedemption` strip snake_case, ép `costPoints` về số và finite-check; dữ liệu bẩn/non-number fallback `0`.
- `supabaseClient` thêm `firstEnvValue/hasEnvValue`, trim env trước khi xác định configured.
- `supabaseClient` thêm fallback `NEXT_PUBLIC_SUPABASE_URL` và export `supabaseConfig` để test config rõ ràng.
- `storage.readJson` nếu fallback là array thì parsed cũng phải là array; sai kiểu trả fallback.
- `storage.safeArray` dùng chung cho các save collection localStorage, input không phải array ghi `[]`.
- `storage.getModelThreshold/saveModelThreshold` dùng normalize số, non-number fallback `0.65`.
- `toUser` ép points không hữu hạn về `0`, tránh payload Supabase chứa `NaN`.
- `saveUser` trim name/email/group và validate profile ở service layer, không chỉ dựa vào UI Users.
- `saveUser` normalize status qua allowlist `active/locked`, tránh ghi trạng thái user ngoài nghiệp vụ.
- `saveUser` normalize role qua allowlist `student/teacher/volunteer/admin`, tránh ghi vai trò user ngoài nghiệp vụ.
- `saveBin` trim id/name/location/building/floor/qrCode và validate required station fields ở service layer.
- `saveBin` normalize `capacity/mapX/mapY` bằng percent clamp ở service layer, không chỉ dựa vào UI Bins.
- `saveBin` normalize status qua allowlist `active/full/maintenance`, tránh ghi trạng thái thùng ngoài nghiệp vụ.
- `saveBin` normalize `binGroup` qua `BIN_GROUPS`, tránh ghi nhóm thùng ngoài 4 nhóm nghiệp vụ.
- `savePredictionRecord` validate class/source/confidence raw trước khi gọi `normalizePrediction`, tránh ghi scan mới bị fallback thành `trash` hoặc confidence `0`.
- `savePredictionRecord` normalize status qua allowlist `pending/approved/rejected`, tránh ghi trạng thái scan ngoài nghiệp vụ.
- `savePredictionRecord` normalize source qua allowlist `upload/camera`, tránh ghi nguồn scan ngoài nghiệp vụ.
- `saveManualPointHistory` validate `userId/action/points` ở service layer, không chỉ dựa vào UI Ecopoints.
- `saveRewardRedemption` validate `userId/rewardLabel/costPoints` ở service layer, không chỉ dựa vào UI Ecopoints.
- `saveFeedbackItem` trim message và validate ở service layer, không chỉ dựa vào UI Feedback.
- `saveFeedbackItem` validate status/priority ở service layer, không cho `normalizeFeedback` fallback im lặng khi save record mới.
- `updateRewardRedemption` fallback thêm `nextItem` vào localStorage khi đang xử lý record chỉ tồn tại từ Supabase live data.
- `updateBinStatus` normalize action status qua allowlist `active/full/maintenance`; status lạ trả lỗi và không làm bẩn `bins.status`.
- `updateFeedbackItem/updateFeedbackStatus` normalize action status qua `FEEDBACK_STATUSES`; status lạ trả lỗi và không làm bẩn `feedback.status`.
- `updateFeedbackItem` normalize priority update qua `FEEDBACK_PRIORITIES`; priority lạ trả lỗi và không fallback im lặng về `medium`.
- `updateFeedbackItem` trim và validate message update; message rỗng trả lỗi và không làm bẩn `feedback.message`.
- `savePointRules` kiểm tra input phải là array trước khi `.map(toPointRule)`, tránh lưu chuỗi/object rác vào point rules.

Gaps:

- Chưa có gap Supabase store ưu tiên cao còn mở.

## 3. Waste config và model settings

Files chính:

- `src\admin\data\wasteConfig.js`
- `src\admin\pages\ModelSettingsPage.js`

Case cần test:

- 10 class AI map đúng 4 nhóm thùng.
- Class unknown -> fallback `Còn lại`.
- Label tiếng Việt đúng, không mojibake.
- Confidence threshold hiển thị/sửa/lưu đúng.
- Threshold invalid: rỗng, âm, >1, non-number -> bị chặn hoặc normalize.
- Mobile handoff giữ đúng vai trò AI: hỗ trợ, không tự cộng điểm.

Test hiện có:

- Admin source files không chứa marker mojibake phổ biến (`TÃ`, `Ä`, `Æ`, `áº`, `á»`, nhóm `Ã...`).
- Một phần mapping dùng qua AI tester/scans.
- Unit test trực tiếp cho 10 class AI -> 4 nhóm thùng.
- Unit test class unknown fallback `Còn lại`.
- Unit test `normalizePrediction` clamp confidence âm/>1/non-number.
- Unit test `normalizePrediction` với `class/className` không phải string fallback `trash`, không throw.
- UI test Model Settings clamp threshold Supabase invalid `1.8` về `95%`.
- UI test saved threshold âm về `30%` và non-number về default `65%`.
- UI test bấm lưu Model Settings gửi payload Supabase đã clamp threshold vượt max về `0.95`.
- Unit test class key bẩn như ` Plastic `, ` PAPER `, ` Battery ` vẫn map đúng nhãn/nhóm thùng.
- Unit test nhãn nhóm thùng bẩn như ` Tái chế `, ` hữu cơ `, ` PIN / NGUY HẠI ` vẫn chọn đúng màu nhóm, không rơi về màu `Còn lại`.
- Unit test `classCount` không phải số khi lưu settings fallback về số lớp AI hiện cấu hình (`10`), không gửi chuỗi rác vào Supabase.

Fix đã làm:

- `saveModelThreshold`, `fromSettings`, fallback `getModelSettings` dùng normalize threshold.
- Threshold hợp lệ bị clamp trong khoảng `0.3..0.95`; non-number fallback `0.65`.
- `normalizePrediction` chỉ lower-case class khi input là string, trim class và fallback `trash` cho dữ liệu bẩn từ Supabase/backend.
- `getWasteClass/getWasteLabel/getBinGroup` trim/lower class key trước khi lookup, tránh class bẩn từ backend/Supabase rơi sai sang `Còn lại`.
- `getGroupColor` trim/lower nhãn nhóm trước khi lookup, giữ đúng màu khi Supabase/backend trả group label bẩn.
- `toSettings/fromSettings` normalize `classCount`, non-number hoặc <=0 fallback về `WASTE_CLASSES.length`.

Gaps:

- Chưa có gap Model Settings ưu tiên cao còn mở.

## 4. Dashboard và điều hướng cảnh báo

Files chính:

- `src\admin\pages\DashboardPage.js`
- `src\admin\components\StatCard.js`
- `src\admin\components\CampusMap.js`

Case cần test:

- KPI tổng scan, pending, bins attention, Ecopoint đúng từ Supabase data.
- Open feedback card -> `#/feedback?status=open`.
- Low confidence/pending scan card -> `#/scans?status=pending&confidence=low`.
- Bin attention card -> `#/bins?status=attention`.
- Empty data -> không crash, hiện state hợp lý.
- Supabase lỗi -> fallback local + alert nhẹ.
- Chart render với data rỗng/ít ngày.

Test hiện có:

- Dashboard KPI loads.
- Dashboard clamp capacity bẩn vượt `100` trước khi tính KPI `Mức độ đầy trung bình`, không render `150%`.
- Point history KPI.
- Priority cards navigate.
- Operations panel.
- Empty operations data render không crash: không cảnh báo, bảng rỗng, KPI `0`.
- Malformed confidence/timestamp không crash: confidence fallback `0%`, timestamp fallback `Không rõ`, không hiện `NaN%`.
- Seed defaults button upsert dữ liệu mẫu cho bảng vận hành trống ngay cả khi bảng `users` đã có admin.
- Dashboard map save failure fallback sang localStorage, giữ vị trí kéo thả và hiện cảnh báo dự phòng.
- KPI/card `Thùng cần kiểm tra` đếm thống nhất với Bins attention: `maintenance`, `full`, `capacity >= 85`, kể cả status bẩn như ` Maintenance `.
- Group cards/chart đếm prediction `binGroup` bẩn như ` TÁI CHẾ ` về đúng nhóm `Tái chế`, không làm số liệu nhóm về 0.
- Cảnh báo `lượt quét độ tin cậy thấp` trên Dashboard dùng `settings.threshold` giống Scans/Model Settings; threshold `0.8` vẫn bắt scan `0.72` và link sang `#/scans?status=pending&confidence=low`.

Fix đã làm:

- `DashboardPage.formatDate` kiểm tra `Invalid Date` và trả `Không rõ`.
- `DashboardPage.formatPercent` dùng `safeNumber`, invalid -> `0%`.
- Dashboard dùng `safePercent` để clamp `bins.capacity` về `0..100` cho avg capacity và attention threshold.
- KPI điểm, avg capacity, avg confidence và point history table dùng số an toàn.
- `seedDefaults` seed theo từng bảng và chỉ upsert record mặc định còn thiếu, không return sớm khi `users` đã có admin.
- `saveBin` failure path qua CampusMap lưu fallback localStorage khi Supabase update lỗi.
- Dashboard dùng `isOpenFeedback`, normalize status scan/bin và helper `isBinAttention` để priority cards/KPI không lệch với Feedback/Bins.
- Dashboard canonicalize `prediction.binGroup` theo `BIN_GROUPS` trước khi tạo `groupCounts`, tránh dữ liệu Supabase/localStorage bẩn làm sai card/chart nhóm thùng.
- `loadDashboardData` đọc thêm `getModelSettings`; `DashboardPage` dùng threshold model cho low-confidence priority thay vì hardcode `0.65`.

Gaps:

- Chưa có gap Dashboard ưu tiên cao còn mở.

## 4A. Shared UI components

Files chính:

- `src\admin\components\StatusBadge.js`
- `src\admin\components\DataTable.js`
- `src\admin\components\Modal.js`
- `src\admin\components\Toast.js`

Case cần test:

- `StatusBadge` map status code sang nhãn tiếng Việt đúng.
- `StatusBadge` normalize status bẩn từ Supabase/backend: trim, lowercase, class CSS an toàn.
- `StatusBadge` không render raw uppercase/space khi status hợp lệ nhưng bẩn.
- `StatusBadge` vẫn ưu tiên `children` khi page tự truyền nhãn riêng.
- `StatusBadge` group badge vẫn giữ màu theo nhóm thùng.
- `DataTable` empty state không crash khi `rows` rỗng.
- `Modal` đóng/mở đúng, không làm submit nhầm khi đóng.
- `Toast` hiện tone success/danger đúng và close được.
- `Sidebar` không crash khi `items` thiếu hoặc nav item thiếu icon.
- `StatCard` không crash khi icon sai kiểu và normalize tone bẩn về allowlist.
- `ChartPanel` không truyền `undefined` xuống Chart.js khi thiếu `data/options`.

Test hiện có:

- `StatusBadge` normalize ` APPROVED ` thành nhãn `Đã duyệt` và class `is-approved`.
- `DataTable` render empty state khi `rows` bị thiếu/undefined, không crash.
- `DataTable` render object/array/missing cell an toàn: object -> JSON, array -> comma text, missing -> `-`.
- `Modal` gọi `onClose` khi bấm phím Escape.
- `Toast` normalize tone bẩn như ` DANGER ` thành class `tone-danger`.
- Empty table/modal/toast vẫn được cover thêm gián tiếp qua page tests.
- `Sidebar` render an toàn khi thiếu `items` và khi nav item thiếu `icon`.
- `Sidebar` hiển thị brand `Eco-loop Campus` và có guard chống brand cũ quay lại.
- `StatCard` normalize tone bẩn như ` GREEN ` thành `tone-green` và bỏ qua icon không hợp lệ.
- `ChartPanel` truyền default `{ labels: [], datasets: [] }` và options responsive khi props thiếu.

Fix đã làm:

- `StatusBadge` thêm normalize status trước khi lookup `STATUS_LABELS` và trước khi tạo class `is-*`.
- `DataTable` normalize `columns/rows` thành array an toàn và colSpan tối thiểu `1`.
- `DataTable` format raw cell value trước khi render để dữ liệu object/array/boolean/null từ Supabase không crash React.
- `Modal` thêm keydown listener cho Escape khi modal đang mở.
- `Toast` normalize tone về `success/danger`, tone lạ fallback `success`.
- `Sidebar.groupItems` normalize `items` thành array an toàn; nav icon chỉ render khi icon là component hợp lệ.
- `StatCard` dùng tone allowlist `blue/green/orange/red`, tone lạ fallback `blue`; icon chỉ render khi là component function.
- `ChartPanel` có default data/options an toàn để chart không crash trong state rỗng/loading.
- `Sidebar` đổi brand hiển thị từ tên cũ sang `Eco-loop Campus`, giữ test cấm brand cũ quay lại.

Gaps:

- Chưa có gap Shared UI ưu tiên cao còn mở.

## 5. Bins và map campus

Files chính:

- `src\admin\pages\BinsPage.js`
- `src\admin\components\CampusMap.js`

Case cần test:

- List bins từ Supabase/local.
- Create bin required fields.
- Create bin duplicate id phải bị chặn, không upsert ghi đè trạm cũ.
- Create/edit bin duplicate QR code phải bị chặn, không làm QR trỏ nhầm trạm.
- Edit bin giữ id và update fields.
- Status: `active`, `full`, `maintenance`.
- Attention filter: full/maintenance/capacity >= 85.
- Capacity invalid: âm, >100, non-number, rỗng.
- QR modal hiển thị link `#/ai-test?binId=...`.
- Map load bins, hover/tap detail, open feedback highlight.
- Drag station -> draft position -> confirm save.
- Cancel drag -> không save.
- mapX/mapY invalid -> fallback vị trí mặc định.

Test hiện có:

- Service `saveBin` chặn mã/tên/vị trí rỗng, không ghi Supabase/localStorage khi bị gọi trực tiếp.
- Full bins and full status.
- Create station and QR link.
- Create station trùng mã thùng hiện lỗi, không gọi Supabase upsert, modal vẫn mở, trạm cũ giữ nguyên.
- Create station với mã thùng/tên/vị trí chỉ toàn khoảng trắng bị chặn sau trim, không gọi Supabase upsert.
- Create station trùng mã QR hiện lỗi, không gọi Supabase upsert, modal vẫn mở.
- Edit station sang mã QR của station khác hiện lỗi, không gọi Supabase upsert, modal vẫn mở.
- Edit station giữ `id` disabled, update `name/binGroup/location/building/floor/qrCode/status/capacity/mapX/mapY` đúng payload Supabase và không đổi ID.
- Edit station giữ mã QR của chính nó không bị báo trùng, vẫn lưu payload.
- Attention filter chỉ hiện thùng `full`, `maintenance` hoặc `capacity >= 85`, ẩn thùng active còn thấp.
- Attention filter normalize status bẩn như ` FULL ` và ` Maintenance `, vẫn hiện trạm cần kiểm tra.
- Service update trạng thái thùng từ chối status lạ như ` archived `, giữ thùng đang `active`.
- Query `#/bins?status= ATTENTION ` được normalize về `attention`, không làm bảng rỗng sai.
- Campus map details.
- Map feedback highlight.
- Drag position confirm.
- Cancel drag reset draft position, không gọi save.
- Create station clamp capacity/map coordinate ngoài 0-100 trước khi lưu.
- Supabase save lỗi khi kéo map confirm fallback sang localStorage và hiện cảnh báo.
- Campus map normalize capacity/map coordinate malformed từ Supabase: không hiện `NaN`/chuỗi lỗi, fallback sức chứa `0%` và tọa độ mô phỏng mặc định.
- Campus map summary normalize station status bẩn như ` Active ` / ` Maintenance `, đếm đúng điểm hoạt động/cần kiểm tra và hiển thị nhãn sạch.

Fix đã làm:

- `saveBin` validate required station fields tại service để code gọi trực tiếp không bypass được rule UI.
- `BinsPage` chặn tạo mới khi `id` trùng trạm hiện có, báo lỗi danger và không gọi `saveBin`.
- `BinsPage` validate `id/name/location` sau trim trước khi lưu, tránh ghi trạm rỗng do HTML `required` vẫn nhận chuỗi khoảng trắng.
- `BinsPage` chặn `qrCode` trùng với trạm khác khi tạo/sửa, báo lỗi danger và không gọi `saveBin`.
- `BinsPage` normalize `capacity`, `mapX`, `mapY` về khoảng `0..100` trước khi lưu.
- `BinsPage.statusCode` trim/lower status trước khi lọc attention/full/maintenance, toggle trạng thái và lưu form.
- `BinsPage` normalize query/status filter qua allowlist `all/attention/active/full/maintenance`, giá trị bẩn/lạ fallback `all`.
- `updateBinStatus` chỉ nhận action `active/full/maintenance`, tránh ghi trạng thái thùng không thuộc nghiệp vụ.
- Progress bar và attention filter dùng capacity đã normalize.
- `CampusMap` normalize `capacity` bằng `readPercent(..., 0)` trước khi render detail/tooltip/tone.
- `CampusMap` normalize `status` theo `STATUS_LABELS` khi build station model, giữ summary/detail/list thống nhất với dữ liệu Supabase bẩn.

Gaps còn lại:

- Chưa có gap Bins/map ưu tiên cao còn mở.

## 6. Feedback

Files chính:

- `src\admin\pages\FeedbackPage.js`
- `src\admin\data\feedbackConfig.js`

Case cần test:

- List feedback + bin link.
- Filter status `all/open/unread/in_progress/resolved/rejected`.
- Filter priority `low/medium/high`.
- Filter binId.
- Create feedback với userName rỗng -> fallback Admin Eco-loop Campus.
- Create feedback message rỗng -> không lưu, hiện toast.
- Status transitions: unread -> in_progress -> resolved.
- Reject flow.
- Save admin note.
- Supabase lỗi -> fallback local.

Test hiện có:

- Links reports to bins and workflow.
- Admin creates bin-linked feedback.
- Message rỗng/blank không tạo feedback, không gọi Supabase upsert, toast danger.
- Service tạo feedback cũng chặn message rỗng/blank, không ghi Supabase/localStorage.
- Service tạo feedback chặn status/priority lạ, không ghi Supabase/localStorage.
- Priority filter chỉ hiện feedback đúng mức ưu tiên.
- Bin filter chỉ hiện phản hồi gắn đúng thùng/trạm được chọn.
- Admin note lưu vào `admin_note`, sau đó reject cập nhật status `rejected`.
- Supabase update lỗi với feedback live không có trong seed local -> ghi record đó vào localStorage fallback và hiện cảnh báo dự phòng.
- Supabase create/upsert lỗi khi tạo phản hồi mới -> ghi phản hồi mới vào localStorage fallback, vẫn render trên bảng và hiện cảnh báo dự phòng.
- Timestamp phản hồi lỗi/không hợp lệ không crash, hiển thị `Không rõ`.
- Status filter `open` chỉ hiện `unread/in_progress`; filter `resolved/rejected` đổi URL query và chỉ hiện đúng trạng thái.
- Priority bẩn như ` HIGH ` / ` LOW ` vẫn render đúng nhãn, class và filter theo mức ưu tiên.
- Status/priority ngoài allowlist fallback về `unread`/`medium`, không lưu raw status/class lạ vào UI.
- Service update trạng thái phản hồi từ chối status lạ như ` archived `, giữ phản hồi đang `unread`.
- Service update phản hồi từ chối priority lạ như `urgent`, giữ priority hiện tại.
- Service update phản hồi từ chối message rỗng/toàn khoảng trắng, giữ message hiện tại.
- Query `#/feedback?status= OPEN ` được normalize về `open`, không làm bảng rỗng sai.
- Tạo phản hồi với người gửi rỗng fallback `Admin Eco-loop Campus`, vẫn lưu nội dung và status `unread`.

Fix đã làm:

- `FeedbackPage` thêm `toastTone` và `showToast` để invalid feedback hiển thị `danger`, success giữ `success`.
- `saveFeedbackItem` validate message tại service để code gọi trực tiếp không bypass được rule UI.
- `saveFeedbackItem` validate status/priority tại service để code gọi trực tiếp không ghi phản hồi mới với metadata ngoài allowlist.
- `updateFeedbackItem` fallback thêm record live vào localStorage nếu local chưa có item cần update.
- `saveFeedbackItem` path create fallback đã được khóa bằng UI test; behavior đã có sẵn qua helper `upsert`.
- `FeedbackPage.formatDate` kiểm tra `Invalid Date` và trả `Không rõ` để dữ liệu Supabase lỗi không làm crash bảng.
- `normalizeFeedback` trim/lower `priority`; `getFeedbackPriorityLabel` dùng priority đã normalize để dữ liệu bẩn không rơi về `Trung bình`.
- `normalizeFeedback`, `isOpenFeedback`, `getFeedbackStatusLabel`, `getFeedbackPriorityLabel` dùng allowlist status/priority; giá trị lạ fallback an toàn.
- `updateFeedbackStatus` chỉ nhận status trong `FEEDBACK_STATUSES`, tránh ghi trạng thái phản hồi không thuộc nghiệp vụ.
- `updateFeedbackItem` chỉ nhận priority update trong `FEEDBACK_PRIORITIES`, tránh ghi mức ưu tiên phản hồi không thuộc nghiệp vụ.
- `updateFeedbackItem` chặn message rỗng/toàn khoảng trắng khi update để code gọi trực tiếp không thể ghi phản hồi không có nội dung.
- `FeedbackPage` normalize query param `status` bằng allowlist `all/open/unread/in_progress/resolved/rejected/read`, giá trị bẩn/lạ fallback `all`.
- `FeedbackPage` đổi sender fallback phản hồi admin sang `Admin Eco-loop Campus` để đồng bộ tên dự án.

Gaps còn lại:

- Chưa có gap Feedback ưu tiên cao còn mở.

## 7. Scans / duyệt AI

Files chính:

- `src\admin\pages\ScansPage.js`
- `src\admin\services\supabaseStore.js`

Case cần test:

- List predictions.
- Filter status.
- Filter confidence low.
- Display class label + bin group.
- Approve pending scan -> status approved + point_history + user points.
- Reject pending scan -> status rejected, không cộng điểm.
- Approve scan không userId/binId -> không crash, ghi hợp lý hoặc báo lỗi.
- Confidence malformed/null -> không crash.
- Point rule disabled -> approve không cộng điểm.

Test hiện có:

- Approving scan updates Supabase and writes point history.
- Processed scans không hiện lại action duyệt/từ chối.
- Reject pending scan không ghi `point_history` và không đổi `users.points`.
- Point rule disabled khi approve không cộng điểm.
- Point rule `classKeys` bẩn như ` Battery ` vẫn match scan class và cộng điểm đúng.
- Approve cùng một scan lặp lại chỉ ghi một `point_history` và cộng điểm một lần.
- Malformed confidence/timestamp không làm crash trang; confidence fallback `0%`, timestamp fallback `Không rõ`.
- Approve scan thiếu `userId`/`binId` không cộng điểm nhầm cho fallback `SV001/BIN-A1`.
- Filter status/class/confidence hoạt động độc lập và kết hợp đúng.
- Supabase update lỗi khi từ chối scan chuyển sang localStorage fallback, lưu scan, hiện cảnh báo.
- Supabase update lỗi khi duyệt scan chuyển sang localStorage fallback, lưu scan approved, ghi point history và cập nhật user points local.
- Supabase update lỗi khi duyệt scan với local `users.points` malformed/non-number vẫn cộng từ `0`, không lưu `NaN/null` vào localStorage.
- Prediction `class` không phải string không làm crash Scans; fallback nhãn `Rác còn lại`, nhóm `Còn lại`, confidence vẫn hiển thị đúng.
- Prediction `status` bẩn như ` PENDING ` vẫn lọc đúng `pending` và vẫn hiện action duyệt/từ chối.
- Query filter bẩn như `#/scans?status= PENDING &confidence= LOW ` được normalize về `pending/low`, không làm bảng rỗng sai.
- `setPredictionStatus` từ chối status ngoài `approved/rejected`, không gọi Supabase update, không ghi localStorage fallback và trả lỗi rõ.

Fix đã làm cho Scans:

- `normalizePrediction` sửa lỗi `.toLowerCase()` trên class không phải string, nhờ đó Scans không crash khi Supabase/backend trả class bẩn.
- `normalizePrediction` trim/lower `status`, nhờ đó Scans filter và action pending hoạt động với dữ liệu Supabase/localStorage bẩn.
- `ScansPage` normalize query params qua allowlist trước khi set state cho `statusFilter` và `confidenceFilter`.
- `supabaseStore.addPoints` cộng điểm an toàn, non-number ở user/rule fallback `0`, dùng cho approval Supabase path và local fallback.
- `supabaseStore` normalize `point_rules.classKeys` bằng trim/lower và dùng `ruleMatchesClass` cho cả Supabase/local approval path.
- `setPredictionStatus` kiểm tra `point_history` theo `predictionId` trước khi award, tránh double-click/retry approve cộng điểm nhiều lần.
- `setPredictionStatus` normalize action status qua allowlist `approved/rejected`; status lạ trả lỗi và giữ record hiện tại để không làm bẩn `predictions.status`.

Gaps còn lại:

- Chưa có gap Scans ưu tiên cao còn mở.

## 8. AI Tester

Files chính:

- `src\admin\pages\AiTesterPage.js`
- `backend\app.py`
- `backend\test_app_endpoints.py`

Case cần test frontend:

- Upload file gọi `/predict`.
- Camera capture tạo file và gọi `/predict`.
- Backend request lỗi -> toast lỗi, không lưu prediction.
- `/predict` trả error JSON -> toast lỗi, không lưu prediction.
- `/predict` trả response thiếu `class` -> toast lỗi, không lưu prediction.
- QR `binId` query -> attach binId.
- Không có file -> button disabled.
- Camera không được cấp quyền hoặc browser không hỗ trợ -> toast lỗi danger, capture vẫn disabled, không gọi `/predict`.
- Result hiển thị class label, group, confidence, status.

Case cần test backend:

- `GET /` health.
- `/predict` khi model None -> `{error: Model not loaded}`.
- `/predict` ảnh hợp lệ -> class/confidence.
- `/predict` model output sai số lớp AI -> trả lỗi an toàn, không map nhầm class.
- `/predict` model output có score ngoài khoảng `0..1` -> trả lỗi an toàn, không trả confidence sai contract.
- `/predict` file không phải ảnh -> error image processing.
- `/chat` trả reply hoặc local AI error an toàn.
- `/chat` message rỗng hoặc chỉ khoảng trắng -> trả lỗi nhẹ, không gọi local AI.

Test hiện có:

- AI tester writes prediction vào Supabase khi backend trả class/confidence hợp lệ.
- AI tester đọc QR `binId` và lưu prediction vào đúng trạm.
- AI tester không lưu prediction khi backend trả `{ error: "Model not loaded" }`.
- AI tester không lưu prediction khi backend trả response thiếu `class`.
- AI tester không lưu prediction khi backend trả `confidence` không phải số; không render `NaN%`.
- AI tester không lưu prediction khi backend trả `confidence` ngoài khoảng `0..1`; không render giá trị clamp sai như `100%`.
- AI tester không lưu prediction khi request `/predict` bị reject.
- Upload prediction button disabled khi chưa chọn file và không gọi `/predict` rỗng; chọn file xong mới bật.
- Camera capture mock `getUserMedia` + `canvas.toBlob`, gọi `/predict`, lưu prediction source `camera`, image `camera-capture.jpg`, hiển thị Nhựa/88%, và dừng track khi tắt camera.
- Camera capture không tạo được blob ảnh thì hiện toast lỗi, không gọi `/predict`, không ghi Supabase/localStorage.
- Upload file khi camera đang bật vẫn lưu prediction source `upload`, không bị gán nhầm `camera`.
- File upload không phải ảnh bị chặn trước backend, không preview, không gọi `/predict`.
- Camera permission rejected hiển thị `Không mở được camera`, toast `danger`, nút chụp vẫn disabled, không gọi `/predict`.
- Browser không hỗ trợ camera hiển thị `Trình duyệt không hỗ trợ camera`, toast `danger`, nút chụp vẫn disabled, không gọi `/predict`.
- Backend trả class lạ hợp lệ -> UI hiển thị class đó, lưu prediction và fallback nhóm thùng `Còn lại`.
- Backend startup imports app.
- Backend endpoint tests cho health, model missing, valid image, invalid image, chat.
- Backend `/chat` chặn message rỗng/chỉ khoảng trắng trước `ask_local_ai`, trả `{ "reply": "Message is required" }`.
- Backend `/predict` trả error an toàn khi model output có `NaN/Inf`, không crash JSON response.
- Backend `/predict` trả error an toàn khi model output không khớp 10 class, không trả nhầm `battery` từ output ngắn.
- Backend `/predict` trả error an toàn khi model output có confidence ngoài `0..1`, không trả payload `{ class, confidence }` sai contract.

Fix đã làm:

- `AiTesterPage.runPrediction` kiểm tra `response.data.error` và `class` rỗng trước khi gọi `savePredictionRecord`.
- `AiTesterPage.runPrediction` ép `confidence` sang số hữu hạn; dữ liệu bẩn báo lỗi backend không hợp lệ và không lưu prediction.
- `AiTesterPage.runPrediction` chỉ chấp nhận confidence trong khoảng `0..1`, không để giá trị backend out-of-range bị clamp rồi lưu sai.
- `AiTesterPage.runPrediction` nhận `sourceType` từ thao tác upload/camera, tránh dùng `cameraOn` làm upload bị gán nhầm source `camera`.
- `AiTesterPage.handleFileChange` validate MIME/đuôi file ảnh, reset file/preview và toast danger khi file không phải ảnh.
- Toast lỗi dùng tone `danger`; thành công dùng tone `success`.
- Request exception clear result cũ và không ghi Supabase/localStorage.
- `AiTesterPage.startCamera` bắt lỗi `getUserMedia`, set `cameraOn=false`, clear stream và báo toast danger thay vì để promise reject im lặng.
- `AiTesterPage.captureCamera` báo lỗi an toàn khi thiếu canvas/context, `drawImage` lỗi hoặc `toBlob` trả blob rỗng.
- Browser không có `navigator.mediaDevices.getUserMedia` cũng báo toast danger rõ ràng.
- `backend.app.predict` ép output model thành `numpy` float array và chặn output rỗng hoặc không hữu hạn trước khi trả JSON.
- `backend.app.predict` flatten scores và bắt buộc `scores.size == len(classes)` trước `argmax`, tránh output sai shape/class count.
- `backend.app.predict` chặn score `< 0` hoặc `> 1` trước khi chọn class/confidence.
- `backend.app.chat` trim message và trả `Message is required` khi input rỗng, tránh gọi local AI vô ích.

Gaps còn lại:

- Chưa có gap AI Tester ưu tiên cao còn mở.

## 9. Reports

Files chính:

- `src\admin\pages\ReportsPage.js`
- `src\admin\services\reportMetrics.js`
- `src\admin\services\csv.js`

Case cần test:

- Filter dateFrom/dateTo inclusive.
- Filter building.
- Filter binGroup.
- Combined filters.
- Empty data summary 0.
- Predictions with missing bin when bin filter active.
- Feedback open count chỉ gồm `unread/in_progress`, không đếm `resolved/rejected/read`.
- Full bins count status full or capacity >=85.
- Daily chart sorts day asc.
- CSV rows include scan/point/feedback/bin.
- Export CSV uses filtered data only.

Test hiện có:

- Filter reports theo date/building/binGroup.
- Summary tổng scans/points/open feedback/full bins.
- Daily chart sort ngày tăng dần và CSV rows scan/point/feedback/bin.
- UI filters/export CSV theo dữ liệu thật.
- Invalid timestamp không crash, không lọt date filter, chart bỏ ngày lỗi.
- Invalid `dateFrom/dateTo` query/filter bounds bị bỏ qua thay vì lọc rỗng sai.
- Record thiếu/mất bin bị loại khi bin filters active.
- Record operation thiếu `binId/bin_id` vẫn bị loại khi filter thùng active, kể cả khi `id` của record trùng mã thùng.
- Empty operations data hiện KPI 0 và export CSV fallback không crash.
- `buildCsvContent()` khi rows thiếu/undefined trả CSV fallback rỗng, không crash.
- Unit test `buildCsvContent` escape dấu phẩy, dấu nháy kép, xuống dòng, null và fallback `Không có dữ liệu`.
- UI test route `#/reports?dateFrom=bad-date&dateTo=also-bad` bỏ qua filter ngày lỗi, vẫn render KPI dữ liệu thật.
- Unit test malformed `pointHistory.points` trong Reports summary/chart được tính là `0`, không tạo `NaN`.
- Unit test Reports filter với `predictions/bins/feedback/pointHistory` sai kiểu trả mảng rỗng, không crash.
- Unit test Reports summary với `predictions/bins/feedback/pointHistory` sai kiểu trả KPI `0`, không crash.
- Unit test daily report chart với `predictions/feedback/pointHistory` sai kiểu trả chart rỗng, không crash.
- Unit test CSV Reports với `predictions/bins/feedback/pointHistory` sai kiểu trả mảng rỗng, không crash.
- Unit test Reports summary dùng đúng `isOpenFeedback`: chỉ `unread/in_progress` là phản hồi mở; `resolved/rejected/read` không được đếm.
- Unit test CSV Reports với `bins.capacity` malformed xuất `0%`, không xuất chuỗi rác như `bad-capacity%`.
- Unit test Reports summary với `bins.status = " FULL "` vẫn tính là thùng đầy.
- UI Reports bảng tổng hợp nhóm rác cũng đếm `bins.status = " FULL "` là thùng đầy, không lệch với KPI summary.
- Unit test Reports filter normalize `building`/`binGroup` bẩn như ` A1 ` / ` TÁI CHẾ ` trước khi lọc dữ liệu liên quan.
- UI Reports query `building= a1 ` và `binGroup= TÁI CHẾ ` được canonicalize về option sạch `A1` / `Tái chế`, select không rỗng sai.

Fix đã làm:

- `reportMetrics.dateOnly` parse ngày an toàn, invalid date trả rỗng thay vì throw.
- `inDateRange` normalize cả dữ liệu và filter bounds; khi có date filter thì record không có ngày hợp lệ bị loại.
- `reportMetrics.safeNumber` chặn điểm bẩn trong tổng Ecopoint và daily chart.
- `reportMetrics.rows` chuẩn hóa collection input về array trước khi filter Reports, tránh crash khi Supabase/localStorage trả sai kiểu.
- `buildReportSummary` dùng `rows` cho mọi collection trước khi `.length/.reduce/.filter`, dữ liệu sai kiểu trả KPI an toàn.
- `makeDailyReportData` dùng `rows` trước khi duyệt scan/point/feedback, input sai kiểu trả chart rỗng.
- `makeReportCsvRows` dùng `rows` trước khi map scan/point/feedback/bin, input sai kiểu trả CSV rows rỗng.
- `buildReportSummary.openFeedback` dùng shared `isOpenFeedback` để thống nhất với filter `#/feedback?status=open`.
- `reportMetrics.safeNumber` cũng áp dụng cho `fullBins` và CSV capacity output.
- `buildCsvContent` normalize rows thành array trước khi đọc `.length`, rows thiếu dùng fallback `Không có dữ liệu`.
- `reportMetrics.statusCode` trim/lower status thùng trước khi tính `fullBins`.
- `ReportsPage` dùng `statusCode/safeNumber` cho full bin counts trong bảng tổng hợp nhóm.
- `reportMetrics.labelCode` trim/lower theo locale `vi-VN` cho `building` và `binGroup`, tránh dữ liệu Supabase bẩn bị loại khỏi báo cáo.
- `reportMetrics.getLinkedBinId` bỏ fallback `item.id`, chỉ dùng `binId/bin_id` để không nhận nhầm mã record là mã thùng.
- `ReportsPage` canonicalize query `building/binGroup` theo options hiện có bằng labelCode, giá trị bẩn/lạ fallback filter trống thay vì giữ raw value trong select.

Gaps còn lại:

- Chưa có gap Reports ưu tiên cao còn mở.

## 10. Ecopoints

Files chính:

- `src\admin\pages\EcoPointsPage.js`
- `src\admin\services\ecopointMetrics.js`

Case cần test:

- Point rules list/save.
- Filter point history by date, group, binGroup, userId.
- User leaderboard sorting.
- Group leaderboard sorting.
- Manual point requires user and reason.
- Manual point positive/negative/zero handling.
- Reward request requires user.
- Reward approve/reject status update.
- Pending rewards actions hidden after processed.
- Supabase/local source alert.

Test hiện có:

- Filter point history.
- User/group leaderboards.
- Reads point history.
- Shows filters and leaderboards.
- Manual adjustment.
- Rewards request/approve.
- Manual adjustment invalid form: thiếu user, thiếu lý do, điểm bằng 0 đều bị chặn và không ghi dữ liệu.
- Service manual point invalid: thiếu user, thiếu lý do, điểm `0` hoặc non-number đều bị chặn trước khi ghi Supabase/localStorage.
- Manual adjustment âm được lưu đúng như điều chỉnh trừ điểm, hiển thị `-15` thay vì `+-15`.
- Reward reject path cập nhật trạng thái `rejected`.
- Reward redemption `status` bẩn như ` PENDING ` vẫn hiện action duyệt/từ chối và duyệt được.
- `updateRewardRedemption` từ chối status ngoài `approved/rejected`, không gọi Supabase update, không ghi localStorage fallback và giữ status hiện tại.
- Reward request với user không đủ điểm bị chặn, không ghi redemption.
- Reward request với `users.points` malformed/non-number bị xem như `0`, không bypass kiểm đủ điểm.
- Service reward request invalid: thiếu user, thiếu nhãn phần thưởng, cost `0` hoặc non-number đều bị chặn trước khi ghi Supabase/localStorage.
- Invalid timestamp/date filter trong `ecopointMetrics` không crash và không lọc sai toàn bộ dữ liệu.
- Point rule chặn điểm âm/non-number, hiện toast lỗi và không lưu Supabase/local.
- Service lưu point rules từ chối input sai kiểu/non-array, không làm bẩn cấu hình điểm.
- Supabase data failure trên Ecopoints hiển thị alert fallback localStorage và source pill dự phòng.
- UI Ecopoints với `point_history.timestamp/created_at` và `reward_redemptions.requested_at` không hợp lệ không crash, hiển thị `Không rõ`.
- Unit test malformed `pointHistory.points` trong user/group leaderboard được tính là `0`, không tạo `NaN`.
- Unit test user leaderboard trả mảng rỗng khi danh sách users sai kiểu, không crash khi gọi service trực tiếp.
- Unit test user leaderboard coi lịch sử điểm sai kiểu là rỗng, không crash và không tạo điểm ảo.
- Unit test group leaderboard không crash khi danh sách users sai kiểu và gom lịch sử vào `Chưa phân nhóm`.
- Unit test group leaderboard trả mảng rỗng khi lịch sử điểm sai kiểu, không crash khi gọi service trực tiếp.
- Unit test filter lịch sử điểm normalize `user.group` và `pointHistory.binGroup` bẩn như ` CNTT K18 ` / ` TÁI CHẾ ` trước khi lọc.
- Unit test `filterPointHistory` không crash khi thiếu danh sách users và vẫn lọc được theo nhóm rác.
- Unit test `filterPointHistory` không crash khi danh sách users sai kiểu và vẫn lọc được theo nhóm rác.
- Unit test `filterPointHistory` trả mảng rỗng khi lịch sử điểm sai kiểu, không crash khi gọi service trực tiếp.
- UI Ecopoints query `group`/`binGroup` bẩn như ` cntt k18 ` / ` TÁI CHẾ ` canonicalize về option sạch `CNTT K18` / `Tái chế` và vẫn lọc đúng lịch sử điểm.
- Manual point fallback với `users.points` local malformed/non-number cộng từ `0`, không lưu `NaN/null`.

Fix đã làm:

- `ecopointMetrics.dateOnly` parse ngày an toàn, invalid date trả rỗng thay vì throw.
- `inDateRange` normalize filter bounds; `dateFrom/dateTo` invalid bị bỏ qua.
- `EcoPointsPage` thêm `toastTone`/`showToast` để lỗi form hiện `danger`, success giữ `success`.
- Manual point bắt buộc chọn user, nhập lý do và điểm khác 0.
- `saveManualPointHistory` tự validate input service để code gọi trực tiếp không bypass được rule UI.
- Reward request kiểm tra điểm hiện có của user trước khi gửi yêu cầu.
- `saveRewardRedemption` tự validate yêu cầu đổi thưởng để code gọi trực tiếp không bypass được rule UI.
- Hiển thị điểm âm đúng định dạng.
- `saveRules` validate rule points phải là số hợp lệ và không âm trước khi lưu.
- `savePointRules` reject non-array payload trước khi gọi Supabase hoặc localStorage fallback.
- `EcoPointsPage.formatDate` kiểm tra `Invalid Date` và trả `Không rõ` cho lịch sử điểm/đổi thưởng có timestamp bẩn.
- `ecopointMetrics.safeNumber` chặn điểm bẩn trong user/group leaderboard.
- `buildUserLeaderboard` chỉ map trên `users` dạng array; input sai kiểu trả mảng rỗng thay vì throw.
- `buildUserLeaderboard` chỉ filter trên `history` dạng array; input sai kiểu được coi là lịch sử rỗng.
- `buildGroupLeaderboard` chỉ map trên `users` dạng array; input sai kiểu vẫn tính lịch sử vào nhóm fallback.
- `buildGroupLeaderboard` chỉ duyệt `history` dạng array; input sai kiểu trả mảng rỗng thay vì throw.
- `ecopointMetrics.labelCode` trim/lower theo locale `vi-VN` cho filter lớp/khoa và nhóm rác, tránh dữ liệu Supabase bẩn bị loại khỏi lịch sử điểm.
- `filterPointHistory` dùng danh sách users rỗng khi source users thiếu, tránh crash trong service/unit path.
- `filterPointHistory` chỉ map trên `users` dạng array; input sai kiểu dùng danh sách rỗng thay vì throw.
- `filterPointHistory` chỉ filter trên `history` dạng array; input sai kiểu trả rỗng thay vì throw.
- `EcoPointsPage` canonicalize query `group`/`binGroup` bằng `labelCode` theo `users.group` và `BIN_GROUPS`, không giữ raw query bẩn trong select.
- `fromRewardRedemption` normalize `status` trim/lower trước khi đưa vào UI, nên action pending không bị ẩn bởi dữ liệu bẩn.
- `fromRewardRedemption` dùng allowlist `pending/approved/rejected`; `updateRewardRedemption` chỉ nhận action `approved/rejected` để không làm bẩn trạng thái đổi thưởng.
- `fromUser` normalize `points` non-number về `0` ngay khi đọc dữ liệu, tránh `NaN` làm bypass đổi thưởng hoặc lan sang UI.
- `saveManualPointHistory` dùng `addPoints` cho cả Supabase path và local fallback path, tránh `NaN` khi điểm user hoặc delta bẩn.

Gaps còn lại:

- Chưa có gap Ecopoints ưu tiên cao còn mở.

## 11. Users

Files chính:

- `src\admin\pages\UsersPage.js`
- `src\admin\services\supabaseStore.js`

Case cần test:

- List users.
- Search by name/email/id.
- Filter role/group/status nếu UI có.
- Create user required fields.
- Duplicate id/email handling from Supabase.
- Lock/unlock user.
- Points display numeric.
- Empty users state.

Test hiện có:

- Service `saveUser` chặn name/email rỗng và email sai định dạng, không ghi Supabase/localStorage.
- Service `saveUser` chặn status lạ như `archived`, không ghi Supabase/localStorage.
- Service `saveUser` chặn role rỗng/lạ như `superadmin`, không ghi Supabase/localStorage.
- List users từ Supabase được render trực tiếp trong `#/users`.
- Search theo user id (`SV001`) hiển thị đúng người dùng và ẩn record không khớp trong bảng.
- Search trim khoảng trắng hai đầu, ví dụ `  SV001  ` vẫn tìm đúng người dùng.
- Role filter hiểu cả code Supabase `admin/student` và hiển thị nhãn tiếng Việt.
- Status filter lọc `active/locked`.
- Status filter normalize dữ liệu Supabase bẩn như ` LOCKED ` về `locked`, badge và nút thao tác hiển thị đúng.
- Group filter lọc theo lớp/khoa động từ dữ liệu.
- Group filter normalize dữ liệu lớp/khoa bẩn như ` CNTT K19 ` trước khi tạo option và lọc bảng.
- Create user chặn email trùng trước khi gọi Supabase.
- Create user chặn tên/email rỗng sau khi trim.
- Create/edit user chặn email sai định dạng trước khi gọi Supabase.
- Create user sinh mã kế tiếp không đè mã đang tồn tại khi danh sách bị thiếu số.
- Lock/unlock user gọi update Supabase và cập nhật trạng thái UI.
- Points malformed/null hiển thị `0`, không để ô trống/NaN.
- Supabase update lỗi khi khóa/mở khóa user live không có trong seed local -> ghi record đó vào localStorage fallback.
- Supabase create/upsert lỗi khi thêm user -> ghi user mới vào localStorage fallback, render bảng và hiện cảnh báo dự phòng.
- Sửa chi tiết user mở modal prefill, cập nhật tên/email/role/lớp-khoa, lưu Supabase bằng `saveUser`, giữ nguyên `id`, `points`, `status`, render lại bảng.
- Sửa user sang email đã thuộc user khác bị chặn, hiện lỗi, không gọi lưu Supabase, modal vẫn mở để admin sửa lại.
- Sau toast lỗi form `danger`, khóa/mở khóa user thành công reset toast về `success`, không giữ màu lỗi cũ.
- `updateUserStatus` từ chối status ngoài `active/locked`, không gọi Supabase update, không ghi localStorage fallback và giữ status hiện tại.

Fix đã làm:

- `saveUser` trim name/email/group và validate profile tại service, để code gọi trực tiếp không bypass được rule UI.
- `saveUser` normalize status qua allowlist `active/locked`, tránh ghi status lạ khi code gọi service trực tiếp.
- `saveUser` normalize role qua allowlist `student/teacher/volunteer/admin`, tránh ghi role lạ khi code gọi service trực tiếp.
- Search index thêm `id`.
- Search query được trim trước khi so khớp để tránh nhập dư khoảng trắng làm bảng rỗng sai.
- Chuẩn hóa role bằng `roleCode`, render nhãn Việt bằng `roleLabel`.
- Thêm filter trạng thái và lớp/khoa.
- Thêm `toastTone/showToast` cho lỗi form Users.
- Validate required name/email sau trim và validate duplicate email trước save.
- Validate format email bằng JS trước `saveUser`, vì không dựa vào constraint native `type="email"` khi submit chương trình/test.
- Sinh user id bằng prefix theo role (`SV/GV/TN/AD`) và max số đã dùng.
- Format điểm bằng `pointValue`, invalid -> `0`.
- Normalize status bằng `statusCode` trước khi lọc, render badge, toggle khóa/mở khóa và lưu edit.
- Normalize group bằng trim + lower locale `vi-VN` trước khi tạo option/lọc; bảng render label đã trim.
- `updateUserStatus` fallback thêm live user vào localStorage nếu local chưa có record cần update.
- `saveUser` create fallback đã được khóa bằng UI test; behavior đã có sẵn qua helper `upsert`.
- `UsersPage` thêm `editingUser`, dùng chung modal thêm/sửa, nút `Sửa {id}`, duplicate email bỏ qua chính user đang sửa, lưu edit qua `saveUser`.
- `UsersPage.lockUser` dùng `showToast` cho success để reset `toastTone` về `success` sau các lỗi form trước đó.
- `updateUserStatus` normalize action status qua allowlist `active/locked`; status lạ trả lỗi và không làm bẩn `users.status`.

Gaps:

- Chưa có gap Users ưu tiên cao còn mở.

## 12. Eco-loop mobile handoff document

Files chính:

- `MOBILE_APP_HANDOFF.md`
- `eco_loop_campus_tong_hop_day_du.md`

Case cần test tự động/script:

- Tài liệu không còn mô tả mobile AI-only.
- Có luồng student -> QR -> volunteer -> Ecopoint -> admin.
- Có AI as support, không tự cộng điểm.
- Có database mục tiêu: `recycling_submissions`, `qr_scan_logs`, `proof_images`, `missions`, `rewards`.
- Không có Supabase key thật.
- Không mojibake.

Test hiện có:

- `App.test.js` có guard `mobile handoff document keeps Eco-loop operation-first contract`, đọc `MOBILE_APP_HANDOFF.md` và khóa các marker nghiệp vụ/AI/database/bảo mật chính.

Status hiện tại:

- Đã sửa tài liệu theo Eco-loop Campus.
- Đã kiểm tra không key thật, không mojibake.
- Đã khóa bằng Jest guard: operation-first, student/QR/volunteer/Ecopoint/admin flow, AI support-only, database mục tiêu, API/model hiện có, không lộ Supabase key.

## Thứ tự xử lý đề xuất

1. Baseline/env.
2. Waste config + model settings: nhỏ, nền cho AI/scans/mobile.
3. Supabase store mappers/fallback.
4. Scans approval/rejection/point rules.
5. AI tester + backend endpoints.
6. Bins + map.
7. Feedback.
8. Reports.
9. Ecopoints.
10. Users.
11. Dashboard navigation.
12. Handoff/mobile docs regression.

## Gate cho mỗi module

Với mỗi module:

1. Đọc file nguồn và test hiện có.
2. Liệt kê case hợp lệ và không hợp lệ.
3. Viết test đỏ cho gap đầu tiên.
4. Chạy test để thấy fail đúng lý do.
5. Sửa tối thiểu.
6. Chạy test module.
7. Chạy full frontend/backend regression nếu module chạm shared logic.
8. Cập nhật roadmap status nếu cần.
