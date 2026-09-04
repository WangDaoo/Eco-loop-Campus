# Mẫu báo cáo lỗi EcoLoop Campus

## ECL-AREA-NNN — Tiêu đề ngắn, mô tả được hành vi sai

- Severity: P0 | P1 | P2 | P3
- Commit / môi trường:
- Trạng thái: Reproduced | Static finding | Fixed | Retest failed
- Dữ liệu chuẩn bị: tài khoản theo vai trò, catalog và trạng thái số dư/kho ban đầu; không ghi secret.
- Bước tái hiện:
  1. Bước đầu tiên.
  2. Bước tiếp theo.
  3. Bước quan sát lỗi.
- Expected:
- Actual:
- HTTP/SQL evidence: status, `detail`, `code`, id tham chiếu và truy vấn read-only chứng minh invariant.
- Ranh giới lỗi: Client | API | Authorization | Transaction | Database
- Ảnh hưởng dữ liệu/người dùng:
- Root cause đã xác nhận:
- Regression test: đường dẫn file, test id và lệnh chạy.

## Tiêu chí đóng lỗi

- Có test đỏ tái hiện ổn định hoặc bằng chứng tĩnh được xác nhận rõ.
- Bản sửa nhỏ nhất làm test đỏ chuyển xanh mà không nới lỏng invariant.
- Focused test và full gate đều exit `0` trên database `_test` riêng.
- Với lỗi đồng bộ/transaction, chạy full gate hai lần liên tiếp và so cùng id, status, balance, stock, history.
