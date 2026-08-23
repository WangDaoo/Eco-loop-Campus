-- Eco-loop Campus demo seed
-- Chỉ chạy khi cần demo, không chạy cho database production trắng.
-- Chạy schema.sql trước, sau đó chạy file này nếu muốn có dữ liệu mẫu để trình diễn.

insert into public.avatar_presets (key, label, image_url, background, tile, accent, face, status, sort_order)
values
  ('sprout', 'Mầm xanh', '', '#cbf9e4', '#a8f2ab', '#8bc34a', '#2c6e6e', 'active', 1),
  ('sunny', 'Nắng xanh', '', '#fff1a8', '#c8f4a6', '#f0b84f', '#2c6e6e', 'active', 2),
  ('wave', 'Biển sạch', '', '#bcefff', '#91e0f2', '#38a3c7', '#256a7a', 'active', 3),
  ('berry', 'Hoa campus', '', '#f7c4df', '#d5f6b8', '#d8669f', '#2c6e6e', 'active', 4)
on conflict (key) do update set
  label = excluded.label,
  image_url = coalesce(nullif(public.avatar_presets.image_url, ''), excluded.image_url),
  background = excluded.background,
  tile = excluded.tile,
  accent = excluded.accent,
  face = excluded.face,
  status = excluded.status,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.users (id, name, email, role, "group", points, status, avatar_key)
values
  ('student-smoke', 'Sinh viên Smoke Test', 'student@school.edu.vn', 'student', 'Khoa Công nghệ thông tin', 0, 'active', 'sprout'),
  ('volunteer-smoke', 'Volunteer Smoke Test', 'volunteer@school.edu.vn', 'volunteer', 'CLB Môi trường', 0, 'active', 'wave')
on conflict (email) do update set
  name = excluded.name,
  role = excluded.role,
  "group" = excluded."group",
  status = excluded.status,
  avatar_key = excluded.avatar_key;

insert into public.settings (id, threshold, model_name, class_count)
values ('model', 0.65, 'MobileNetV2', 10)
on conflict (id) do update set
  threshold = excluded.threshold,
  model_name = excluded.model_name,
  class_count = excluded.class_count,
  updated_at = now();

insert into public.bins (id, name, bin_group, location, building, floor, qr_code, status, capacity, latitude, longitude, map_x, map_y)
values
  ('station-e1', 'Trạm thu gom E1', 'Plastic, Paper, Metal', 'Sảnh tòa E1', 'E1', '1', 'ECL-ST-STATION-E1', 'active', 62, 10.7627, 106.6822, 42, 54),
  ('station-lib', 'Thư viện trung tâm', 'Paper, Plastic', 'Tầng trệt thư viện', 'LIB', 'G', 'ECL-ST-STATION-LIB', 'active', 48, 10.7640, 106.6840, 57, 38),
  ('station-caf', 'Canteen xanh', 'Plastic, Metal', 'Khu canteen', 'CAF', '1', 'ECL-ST-STATION-CAF', 'full', 91, 10.7615, 106.6851, 68, 70)
on conflict (id) do update set
  name = excluded.name,
  bin_group = excluded.bin_group,
  location = excluded.location,
  building = excluded.building,
  floor = excluded.floor,
  qr_code = excluded.qr_code,
  status = excluded.status,
  capacity = excluded.capacity,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  map_x = excluded.map_x,
  map_y = excluded.map_y;

insert into public.waste_types (id, name, unit, point_per_unit, recycle_method, status)
values
  ('plastic-bottle', 'Chai nhựa', 'item', 10, 'Làm sạch, tháo nắp, ép dẹt trước khi nộp.', 'active'),
  ('paper', 'Giấy sạch', 'kg', 40, 'Giữ khô, không lẫn thức ăn hoặc chất lỏng.', 'active'),
  ('metal-can', 'Lon kim loại', 'item', 12, 'Rửa sạch và để riêng khỏi rác hữu cơ.', 'active'),
  ('organic', 'Rác hữu cơ', 'kg', 20, 'Để riêng rác thực phẩm, tránh lẫn nhựa và kim loại.', 'active'),
  ('hazardous', 'Pin/nguy hại nhỏ', 'item', 5, 'Pin, bóng đèn nhỏ và vật thải nguy hại cần để riêng.', 'active')
on conflict (id) do update set
  name = excluded.name,
  unit = excluded.unit,
  point_per_unit = excluded.point_per_unit,
  recycle_method = excluded.recycle_method,
  status = excluded.status;

insert into public.rewards (id, title, description, cost_points, status, color)
values
  ('coffee', 'Cà phê canteen', 'Giảm 50% cho 1 ly bất kỳ', 300, 'active', '#F6B83F'),
  ('book', 'Voucher nhà sách', 'Giảm 20% dụng cụ học tập', 500, 'active', '#78C96D'),
  ('tree', 'Trồng 1 cây xanh', 'Ghi tên bạn vào vườn Eco-loop', 800, 'active', '#2F8F5B')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  cost_points = excluded.cost_points,
  status = excluded.status,
  color = excluded.color;

insert into public.missions (id, title, description, target, reward_points, action_label, status)
values
  ('submit-3', 'Gửi rác tái chế 3 lần', 'Tạo và được xác nhận 3 giao dịch trong tuần.', 3, 100, 'Xem trạm', 'active'),
  ('paper-week', 'Tuần giấy sạch', 'Nộp ít nhất 2 kg giấy sạch.', 2, 120, 'Tiếp tục', 'active'),
  ('feedback-good', 'Báo cáo trạm xanh', 'Gửi 1 phản hồi hữu ích về trạm thu gom.', 1, 40, 'Gửi phản hồi', 'active')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  target = excluded.target,
  reward_points = excluded.reward_points,
  action_label = excluded.action_label,
  status = excluded.status;
