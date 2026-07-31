begin;

delete from public.point_history where prediction_id = 'SCAN-SMOKE-REPORTS' or user_id = 'SV-SMOKE';
delete from public.reward_redemptions where id = 'RW-SMOKE-REPORTS';
delete from public.feedback where id = 'FB-SMOKE-REPORTS';
delete from public.predictions where id = 'SCAN-SMOKE-REPORTS';

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

insert into public.predictions (id, class, confidence, source, timestamp, bin_group, status, user_id, bin_id, image_name)
values ('SCAN-SMOKE-REPORTS', 'plastic', 0.88, 'upload', now(), 'Tái chế', 'approved', 'SV-SMOKE', 'BIN-SMOKE-REPORTS', 'smoke-report.jpg')
on conflict (id) do update set
  class = excluded.class,
  confidence = excluded.confidence,
  source = excluded.source,
  timestamp = excluded.timestamp,
  bin_group = excluded.bin_group,
  status = excluded.status,
  user_id = excluded.user_id,
  bin_id = excluded.bin_id,
  image_name = excluded.image_name;

insert into public.point_history (prediction_id, user_id, bin_id, class, bin_group, action, points, timestamp, created_at, source, admin_note)
values ('SCAN-SMOKE-REPORTS', 'SV-SMOKE', 'BIN-SMOKE-REPORTS', 'plastic', 'Tái chế', 'Smoke: duyệt nhựa', 5, now(), now(), 'smoke_test', 'Smoke Reports Supabase');

update public.users set points = 5 where id = 'SV-SMOKE';

insert into public.feedback (id, user_name, category, message, status, priority, bin_id, admin_note, timestamp)
values ('FB-SMOKE-REPORTS', 'Sinh viên Smoke', 'Thùng đầy', 'Smoke test Reports: thùng tái chế đã đầy 92%.', 'unread', 'high', 'BIN-SMOKE-REPORTS', '', now())
on conflict (id) do update set
  user_name = excluded.user_name,
  category = excluded.category,
  message = excluded.message,
  status = excluded.status,
  priority = excluded.priority,
  bin_id = excluded.bin_id,
  admin_note = excluded.admin_note,
  timestamp = excluded.timestamp;

insert into public.reward_redemptions (id, user_id, reward_label, cost_points, status, requested_at, reviewed_at, admin_note)
values ('RW-SMOKE-REPORTS', 'SV-SMOKE', 'Voucher căn tin 100 điểm', 100, 'pending', now(), null, 'Smoke reward request')
on conflict (id) do update set
  user_id = excluded.user_id,
  reward_label = excluded.reward_label,
  cost_points = excluded.cost_points,
  status = excluded.status,
  requested_at = excluded.requested_at,
  reviewed_at = excluded.reviewed_at,
  admin_note = excluded.admin_note;

commit;
