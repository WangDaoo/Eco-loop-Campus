# Ma trận kiểm thử tự động EcoLoop Campus

Ma trận này liên kết yêu cầu nghiệp vụ với test tự động và defect ban đầu. PostgreSQL integration chỉ được chạy khi `TEST_DATABASE_URL` trỏ tới database có hậu tố `_test`.

| Requirement | Test ID / file | Layer | Expected invariant | Defect ID |
|---|---|---|---|---|
| Mã thùng và QR do hệ thống sinh | Bins cases trong `frontend/eco-loop-campus-admin/src/App.test.js` | Web Admin | Người dùng không nhập id; dãy mã không tái sử dụng khoảng trống | ECL-WEB-001 |
| Token cũ bị chặn sau khi khóa account | `test_authorization_postgres_integration.py` | Auth + PostgreSQL | Mọi protected mutation trả 403, DB không đổi | ECL-AUTH-001 |
| Student/volunteer chỉ đọc dữ liệu đúng scope | `test_authorization_postgres_integration.py` | API + PostgreSQL | Không lộ private collection/email/phone của actor khác | ECL-DATA-001 |
| Điểm và submission không sửa qua CRUD generic | `test_admin_transaction_guard_postgres_integration.py` | Admin API + PostgreSQL | Chỉ transaction endpoint được đổi balance/history/state | ECL-POINT-001, ECL-SUB-002 |
| Chỉ volunteer đã scan được xử lý submission | `test_submission_postgres_integration.py` ownership cases | API + PostgreSQL | Volunteer khác bị 403; proof/state/points không đổi | ECL-SUB-001 |
| Gửi rác cộng điểm đúng một lần | `test_real_submission_flow_is_atomic_idempotent_and_visible_to_both_clients` | API + PostgreSQL | Một ledger row, balance/status giống Mobile và Admin | ECL-SUB-002, ECL-SYNC-001 |
| Mission chỉ tăng từ domain event đã xác minh | `test_mission_postgres_integration.py` | Domain event + PostgreSQL | Direct advance bị chặn; event/race trả thưởng một lần | ECL-MISSION-001 |
| Reward handover nguyên tử | `test_reward_postgres_integration.py` scan/race cases | API + PostgreSQL | Một winner; điểm/kho không partial; status `fulfilled` | ECL-REWARD-002, ECL-REWARD-003 |
| Admin reversal hoàn điểm và kho một lần | `test_admin_cancellation_refunds_points_and_stock_exactly_once` | Admin API + PostgreSQL | Một debit + một refund; stock/balance về ban đầu | ECL-REWARD-001 |
| Hồ sơ chỉ có mã SV, khoa HYUTE, số điện thoại | `test_profile_postgres_integration.py`; profile source tests | PostgreSQL + Mobile + Admin | Dropdown 11 khoa; unique code; không lớp/ngành/chuyên ngành | ECL-PROFILE-001 |
| Payload dùng chung không làm rơi field/trạng thái | `test_client_contract_snapshots.py`; hai `backendContract.test.*` | Backend + Mobile + Admin | CamelCase, null/UTC/Unicode/numeric/items/error code ổn định | ECL-SYNC-001 |
| Lỗi mạng/HTTP không biến thành local success | `backendContract.test.ts/js` | Mobile + Admin | 401/403/404/409/422/503, malformed JSON và offline đều surfaced | ECL-SYNC-001 |
| Scenario A: đăng ký → gửi rác → xác nhận | `test_scenario_a_registered_student_submission_is_synced_exactly_once` | Cross-role E2E API | Profile, submission, proof, balance và history đồng nhất | ECL-PROFILE-001, ECL-SYNC-001 |
| Scenario B: đổi thưởng → giao → hoàn tác | `test_scenario_b_reward_handover_and_admin_reversal_stay_in_sync` | Cross-role E2E API | Mobile/Admin cùng batch/items/status; balance/kho hoàn đúng | ECL-REWARD-001/002, ECL-SYNC-001 |
| Scenario C: pending/locked/non-owner | `test_scenario_c_ineligible_and_non_owner_actions_leave_database_unchanged` | Cross-role E2E API | 403 và không có mutation ở proof/state/ledger/kho | ECL-AUTH-001, ECL-SUB-001 |

## Full gate

Chạy `scripts/run_automated_logic_tests.ps1` với `TEST_DATABASE_URL` riêng. Mặc định runner chạy hai lượt liên tiếp, tách backend unit/PostgreSQL integration, Mobile test/typecheck và Web Admin test; JUnit được ghi vào `.test-results/` (gitignored). Các test fallback cũ bị skip ở Web Admin không thuộc core flow; không test PostgreSQL core-flow nào được phép skip.
