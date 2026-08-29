-- Eco-loop Campus admin bootstrap
-- Chạy sau schema.sql để gắn Auth user admin vào public.users.
-- Đổi email/id/name nếu tài khoản admin thật của bạn khác giá trị dưới đây.

insert into public.users (id, name, email, role, "group", points, status, avatar_key)
values ('AD001', 'Quản trị Eco-loop Campus', 'admin@utehy.edu.vn', 'admin', 'Ban vận hành', 0, 'active', null)
on conflict (email) do update set
  name = excluded.name,
  role = excluded.role,
  "group" = excluded."group",
  status = excluded.status;
