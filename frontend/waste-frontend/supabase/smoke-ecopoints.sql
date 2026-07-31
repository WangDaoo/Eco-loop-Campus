begin;

insert into public.users (id, name, email, role, "group", points, status)
values ('SV-SMOKE', 'Sinh viên Smoke', 'smoke@school.edu.vn', 'student', 'CNTT K18', 0, 'active')
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  "group" = excluded."group",
  status = excluded.status;

insert into public.bins (id, name, bin_group, location, building, floor, qr_code, status, capacity, map_x, map_y)
values ('BIN-SMOKE-REPORTS', 'Thùng smoke báo cáo', 'Tái chế', 'Khu smoke Reports', 'SMOKE', '1', 'QR-SMOKE-REPORTS', 'full', 92, 52, 48)
on conflict (id) do update set
  name = excluded.name,
  bin_group = excluded.bin_group,
  location = excluded.location,
  building = excluded.building,
  floor = excluded.floor,
  qr_code = excluded.qr_code,
  status = excluded.status,
  capacity = excluded.capacity,
  map_x = excluded.map_x,
  map_y = excluded.map_y;

delete from public.point_history where user_id = 'SV-SMOKE' and source = 'manual_smoke';

insert into public.point_history (prediction_id, user_id, bin_id, class, bin_group, action, points, timestamp, created_at, source, admin_note)
values (null, 'SV-SMOKE', 'BIN-SMOKE-REPORTS', 'manual_adjustment', 'Điều chỉnh', 'Smoke: cộng điểm thủ công', 10, now(), now(), 'manual_smoke', 'Smoke Ecopoints manual adjustment');

insert into public.reward_redemptions (id, user_id, reward_label, cost_points, status, requested_at, reviewed_at, admin_note)
values
  ('RW-SMOKE-APPROVED', 'SV-SMOKE', 'Voucher căn tin 100 điểm', 100, 'pending', now(), null, 'Smoke reward approved flow'),
  ('RW-SMOKE-REJECTED', 'SV-SMOKE', 'Giấy chứng nhận xanh 300 điểm', 300, 'pending', now(), null, 'Smoke reward rejected flow')
on conflict (id) do update set
  user_id = excluded.user_id,
  reward_label = excluded.reward_label,
  cost_points = excluded.cost_points,
  status = excluded.status,
  requested_at = excluded.requested_at,
  reviewed_at = excluded.reviewed_at,
  admin_note = excluded.admin_note;

update public.reward_redemptions
set status = 'approved', reviewed_at = now(), admin_note = 'Smoke: đã duyệt đổi thưởng'
where id = 'RW-SMOKE-APPROVED';

update public.reward_redemptions
set status = 'rejected', reviewed_at = now(), admin_note = 'Smoke: đã từ chối đổi thưởng'
where id = 'RW-SMOKE-REJECTED';

update public.users
set points = coalesce((select sum(points)::int from public.point_history where user_id = 'SV-SMOKE'), 0)
where id = 'SV-SMOKE';

commit;
