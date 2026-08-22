-- Eco-loop Campus Supabase repair script
-- Safe to run multiple times. It repairs tables, columns, RLS policies, storage buckets, and seed rows.
-- It does NOT drop user data or truncate tables.

create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null default 'student',
  "group" text,
  points integer not null default 0,
  status text not null default 'active',
  avatar_key text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists name text;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists role text not null default 'student';
alter table public.users add column if not exists "group" text;
alter table public.users add column if not exists points integer not null default 0;
alter table public.users add column if not exists status text not null default 'active';
alter table public.users add column if not exists created_at timestamptz not null default now();

alter table public.users add column if not exists avatar_key text;
alter table public.users add column if not exists avatar_url text;

update public.users
set status = 'active'
where status is null or lower(trim(status)) not in ('active', 'locked', 'pending', 'rejected');

alter table public.users drop constraint if exists users_status_check;
alter table public.users add constraint users_status_check
  check (lower(trim(status)) in ('active', 'locked', 'pending', 'rejected'));

create table if not exists public.bins (
  id text primary key,
  name text not null,
  bin_group text not null,
  location text not null,
  building text,
  floor text,
  qr_code text,
  status text not null default 'active',
  capacity integer not null default 0,
  latitude double precision,
  longitude double precision,
  map_x double precision,
  map_y double precision
);

alter table public.bins add column if not exists bin_group text;
alter table public.bins add column if not exists location text;
alter table public.bins add column if not exists building text;
alter table public.bins add column if not exists floor text;
alter table public.bins add column if not exists qr_code text;
alter table public.bins add column if not exists status text not null default 'active';
alter table public.bins add column if not exists capacity integer not null default 0;
alter table public.bins add column if not exists latitude double precision;
alter table public.bins add column if not exists longitude double precision;
alter table public.bins add column if not exists map_x double precision;
alter table public.bins add column if not exists map_y double precision;

create table if not exists public.waste_types (
  id text primary key,
  name text not null,
  unit text not null default 'item',
  point_per_unit integer not null default 0,
  recycle_method text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.predictions (
  id text primary key,
  class text not null,
  confidence double precision not null default 0,
  source text not null default 'upload',
  timestamp timestamptz not null default now(),
  bin_group text not null,
  status text not null default 'pending',
  user_id text references public.users(id) on delete set null,
  bin_id text references public.bins(id) on delete set null,
  image_name text,
  image_url text,
  thumbnail_url text
);

alter table public.predictions add column if not exists image_name text;
alter table public.predictions add column if not exists image_url text;
alter table public.predictions add column if not exists thumbnail_url text;

create table if not exists public.point_rules (
  id text primary key,
  label text not null,
  class_keys text[] not null default '{}',
  bin_group text not null,
  points integer not null default 0,
  enabled boolean not null default true
);

create table if not exists public.settings (
  id text primary key,
  threshold double precision not null default 0.65,
  model_name text not null default 'MobileNetV2',
  class_count integer not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id text primary key,
  user_id text references public.users(id) on delete set null,
  user_name text not null default '',
  category text not null,
  message text not null,
  status text not null default 'unread',
  priority text not null default 'medium',
  bin_id text references public.bins(id) on delete set null,
  admin_note text not null default '',
  resolved_at timestamptz,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.feedback add column if not exists user_id text references public.users(id) on delete set null;
alter table public.feedback add column if not exists priority text not null default 'medium';
alter table public.feedback add column if not exists bin_id text references public.bins(id) on delete set null;
alter table public.feedback add column if not exists admin_note text not null default '';
alter table public.feedback add column if not exists resolved_at timestamptz;
alter table public.feedback add column if not exists created_at timestamptz not null default now();

create table if not exists public.recycling_submissions (
  id text primary key,
  user_id text references public.users(id) on delete set null,
  bin_id text references public.bins(id) on delete set null,
  waste_type_id text references public.waste_types(id) on delete set null,
  quantity numeric not null default 0,
  unit text not null default 'item',
  qr_token text not null unique,
  qr_signature text,
  status text not null default 'CREATED',
  created_at timestamptz not null default now(),
  expired_at timestamptz not null default (now() + interval '30 minutes'),
  verified_by text references public.users(id) on delete set null,
  verified_at timestamptz,
  actual_quantity numeric,
  volunteer_note text
);

create table if not exists public.proof_images (
  id text primary key,
  submission_id text references public.recycling_submissions(id) on delete cascade,
  image_url text not null,
  image_hash text,
  captured_at timestamptz not null default now(),
  verification_code text,
  status text not null default 'pending',
  note text not null default ''
);

create table if not exists public.qr_scan_logs (
  id text primary key,
  qr_token text not null,
  scanned_by text references public.users(id) on delete set null,
  station_id text references public.bins(id) on delete set null,
  scanned_at timestamptz not null default now(),
  result text not null,
  note text not null default ''
);

create table if not exists public.point_history (
  id bigint generated always as identity primary key,
  prediction_id text references public.predictions(id) on delete cascade,
  submission_id text references public.recycling_submissions(id) on delete cascade,
  user_id text references public.users(id) on delete set null,
  bin_id text references public.bins(id) on delete set null,
  class text not null,
  bin_group text not null,
  action text not null,
  description text not null default '',
  points integer not null default 0,
  status text not null default 'confirmed',
  source text not null default 'ai_approval',
  admin_note text not null default '',
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.point_history add column if not exists submission_id text references public.recycling_submissions(id) on delete cascade;
alter table public.point_history add column if not exists description text not null default '';
alter table public.point_history add column if not exists status text not null default 'confirmed';
alter table public.point_history add column if not exists source text not null default 'ai_approval';
alter table public.point_history add column if not exists admin_note text not null default '';

create table if not exists public.rewards (
  id text primary key,
  title text not null,
  description text not null default '',
  cost_points integer not null default 0,
  status text not null default 'active',
  color text not null default '#2F8F5B',
  created_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id text primary key,
  user_id text references public.users(id) on delete set null,
  reward_id text references public.rewards(id) on delete set null,
  reward_label text not null,
  cost_points integer not null default 0,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  admin_note text not null default ''
);

alter table public.reward_redemptions add column if not exists reward_id text references public.rewards(id) on delete set null;

create table if not exists public.missions (
  id text primary key,
  title text not null,
  description text not null default '',
  target integer not null default 1,
  reward_points integer not null default 0,
  action_label text not null default 'Tiếp tục',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists public.user_missions (
  id text primary key,
  user_id text references public.users(id) on delete cascade,
  mission_id text references public.missions(id) on delete cascade,
  current integer not null default 0,
  completed boolean not null default false,
  status text not null default 'active',
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id)
);

create index if not exists idx_recycling_submissions_user_id on public.recycling_submissions(user_id);
create index if not exists idx_recycling_submissions_bin_id on public.recycling_submissions(bin_id);
create index if not exists idx_recycling_submissions_status on public.recycling_submissions(status);
create index if not exists idx_qr_scan_logs_qr_token on public.qr_scan_logs(qr_token);
create index if not exists idx_point_history_submission_id on public.point_history(submission_id);
create index if not exists idx_user_missions_user_id on public.user_missions(user_id);
create index if not exists idx_user_missions_mission_id on public.user_missions(mission_id);

create or replace function public.current_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where id = (auth.uid())::text
     or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where (id = (auth.uid())::text or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      and lower(role) = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.is_volunteer_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where (id = (auth.uid())::text or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      and lower(role) in ('volunteer', 'admin')
      and status = 'active'
  );
$$;

alter table public.users enable row level security;
alter table public.bins enable row level security;
alter table public.waste_types enable row level security;
alter table public.predictions enable row level security;
alter table public.point_rules enable row level security;
alter table public.settings enable row level security;
alter table public.feedback enable row level security;
alter table public.recycling_submissions enable row level security;
alter table public.proof_images enable row level security;
alter table public.qr_scan_logs enable row level security;
alter table public.point_history enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;

drop policy if exists "authenticated read users" on public.users;
drop policy if exists "authenticated read bins" on public.bins;
drop policy if exists "authenticated read waste_types" on public.waste_types;
drop policy if exists "authenticated read predictions" on public.predictions;
drop policy if exists "authenticated read point_rules" on public.point_rules;
drop policy if exists "authenticated read settings" on public.settings;
drop policy if exists "authenticated read feedback" on public.feedback;
drop policy if exists "authenticated read point_history" on public.point_history;
drop policy if exists "authenticated read rewards" on public.rewards;
drop policy if exists "authenticated read reward_redemptions" on public.reward_redemptions;
drop policy if exists "authenticated read missions" on public.missions;
drop policy if exists "mobile read submissions" on public.recycling_submissions;
drop policy if exists "mobile read proof images" on public.proof_images;
drop policy if exists "mobile read qr logs" on public.qr_scan_logs;
drop policy if exists "mobile read user_missions" on public.user_missions;

create policy "authenticated read users" on public.users for select to authenticated using (true);
create policy "authenticated read bins" on public.bins for select to authenticated using (true);
create policy "authenticated read waste_types" on public.waste_types for select to authenticated using (true);
create policy "authenticated read predictions" on public.predictions for select to authenticated using (true);
create policy "authenticated read point_rules" on public.point_rules for select to authenticated using (true);
create policy "authenticated read settings" on public.settings for select to authenticated using (true);
create policy "authenticated read feedback" on public.feedback for select to authenticated using (true);
create policy "authenticated read point_history" on public.point_history for select to authenticated using (true);
create policy "authenticated read rewards" on public.rewards for select to authenticated using (true);
create policy "authenticated read reward_redemptions" on public.reward_redemptions for select to authenticated using (true);
create policy "authenticated read missions" on public.missions for select to authenticated using (true);
create policy "mobile read submissions" on public.recycling_submissions for select to authenticated using (user_id = public.current_profile_id() or public.is_volunteer_or_admin());
create policy "mobile read proof images" on public.proof_images for select to authenticated using (public.is_volunteer_or_admin() or exists (select 1 from public.recycling_submissions s where s.id = proof_images.submission_id and s.user_id = public.current_profile_id()));
create policy "mobile read qr logs" on public.qr_scan_logs for select to authenticated using (scanned_by = public.current_profile_id() or public.is_volunteer_or_admin());
create policy "mobile read user_missions" on public.user_missions for select to authenticated using (user_id = public.current_profile_id() or public.is_volunteer_or_admin());

drop policy if exists "admin write users" on public.users;
drop policy if exists "admin write bins" on public.bins;
drop policy if exists "admin write waste_types" on public.waste_types;
drop policy if exists "admin write predictions" on public.predictions;
drop policy if exists "admin write point_rules" on public.point_rules;
drop policy if exists "admin write settings" on public.settings;
drop policy if exists "admin write feedback" on public.feedback;
drop policy if exists "admin write point_history" on public.point_history;
drop policy if exists "admin write rewards" on public.rewards;
drop policy if exists "admin write reward_redemptions" on public.reward_redemptions;
drop policy if exists "admin write missions" on public.missions;

create policy "admin write users" on public.users for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write bins" on public.bins for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write waste_types" on public.waste_types for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write predictions" on public.predictions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write point_rules" on public.point_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write settings" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write feedback" on public.feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write point_history" on public.point_history for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write rewards" on public.rewards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write reward_redemptions" on public.reward_redemptions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write missions" on public.missions for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student insert own profile" on public.users;
drop policy if exists "profile self update" on public.users;
drop policy if exists "student insert own feedback" on public.feedback;
drop policy if exists "student insert own predictions" on public.predictions;
drop policy if exists "student insert own submissions" on public.recycling_submissions;
drop policy if exists "mobile update submissions" on public.recycling_submissions;
drop policy if exists "volunteer insert qr logs" on public.qr_scan_logs;
drop policy if exists "volunteer insert proof images" on public.proof_images;
drop policy if exists "volunteer update proof images" on public.proof_images;
drop policy if exists "student insert own redemptions" on public.reward_redemptions;
drop policy if exists "volunteer insert point_history" on public.point_history;
drop policy if exists "student insert own user_missions" on public.user_missions;
drop policy if exists "student update own user_missions" on public.user_missions;

create policy "student insert own profile" on public.users for insert to authenticated with check (id = (auth.uid())::text or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy "profile self update" on public.users for update to authenticated using (id = (auth.uid())::text) with check (id = (auth.uid())::text);
create policy "student insert own feedback" on public.feedback for insert to authenticated with check (user_id = public.current_profile_id());
create policy "student insert own predictions" on public.predictions for insert to authenticated with check (user_id = public.current_profile_id());
create policy "student insert own submissions" on public.recycling_submissions for insert to authenticated with check (user_id = public.current_profile_id());
create policy "mobile update submissions" on public.recycling_submissions for update to authenticated using (user_id = public.current_profile_id() or public.is_volunteer_or_admin()) with check (user_id = public.current_profile_id() or public.is_volunteer_or_admin());
create policy "volunteer insert qr logs" on public.qr_scan_logs for insert to authenticated with check (public.is_volunteer_or_admin());
create policy "volunteer insert proof images" on public.proof_images for insert to authenticated with check (public.is_volunteer_or_admin());
create policy "volunteer update proof images" on public.proof_images for update to authenticated using (public.is_volunteer_or_admin()) with check (public.is_volunteer_or_admin());
create policy "student insert own redemptions" on public.reward_redemptions for insert to authenticated with check (user_id = public.current_profile_id());
create policy "volunteer insert point_history" on public.point_history for insert to authenticated with check (public.is_volunteer_or_admin());
create policy "student insert own user_missions" on public.user_missions for insert to authenticated with check (user_id = public.current_profile_id());
create policy "student update own user_missions" on public.user_missions for update to authenticated using (user_id = public.current_profile_id()) with check (user_id = public.current_profile_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('prediction-images', 'prediction-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']::text[]),
  ('proof-images', 'proof-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin upload prediction images" on storage.objects;
drop policy if exists "student upload prediction images" on storage.objects;
drop policy if exists "admin update prediction images" on storage.objects;
drop policy if exists "admin delete prediction images" on storage.objects;
drop policy if exists "volunteer upload proof images" on storage.objects;
drop policy if exists "volunteer update proof images" on storage.objects;
drop policy if exists "volunteer delete proof images" on storage.objects;

create policy "admin upload prediction images" on storage.objects for insert to authenticated with check (bucket_id = 'prediction-images' and public.is_admin());
create policy "student upload prediction images" on storage.objects for insert to authenticated with check (bucket_id = 'prediction-images' and name like ('mobile-ai/' || public.current_profile_id() || '/%'));
create policy "admin update prediction images" on storage.objects for update to authenticated using (bucket_id = 'prediction-images' and public.is_admin()) with check (bucket_id = 'prediction-images' and public.is_admin());
create policy "admin delete prediction images" on storage.objects for delete to authenticated using (bucket_id = 'prediction-images' and public.is_admin());
create policy "volunteer upload proof images" on storage.objects for insert to authenticated with check (bucket_id = 'proof-images' and public.is_volunteer_or_admin());
create policy "volunteer update proof images" on storage.objects for update to authenticated using (bucket_id = 'proof-images' and public.is_volunteer_or_admin()) with check (bucket_id = 'proof-images' and public.is_volunteer_or_admin());
create policy "volunteer delete proof images" on storage.objects for delete to authenticated using (bucket_id = 'proof-images' and public.is_volunteer_or_admin());

insert into public.users (id, name, email, role, "group", points, status, avatar_key)
values
  ('AD001', 'Quản trị Eco-loop Campus', 'admin@school.edu.vn', 'admin', 'Ban vận hành', 0, 'active', 'sprout'),
  ('student-smoke', 'Sinh viên Smoke Test', 'student@school.edu.vn', 'student', 'Khoa Công nghệ thông tin', 0, 'active', 'sprout'),
  ('volunteer-smoke', 'Volunteer Smoke Test', 'volunteer@school.edu.vn', 'volunteer', 'CLB Môi trường', 0, 'active', 'wave')
on conflict (email) do update set
  name = excluded.name,
  role = excluded.role,
  "group" = excluded."group",
  status = excluded.status;

insert into public.settings (id, threshold, model_name, class_count)
values ('model', 0.65, 'MobileNetV2', 10)
on conflict (id) do update set threshold = excluded.threshold, model_name = excluded.model_name, class_count = excluded.class_count, updated_at = now();

insert into public.bins (id, name, bin_group, location, building, floor, qr_code, status, capacity, latitude, longitude, map_x, map_y)
values
  ('station-e1', 'Trạm thu gom E1', 'Plastic, Paper, Metal', 'Sảnh tòa E1', 'E1', '1', 'STATION-E1', 'active', 62, 10.7627, 106.6822, 42, 54),
  ('station-lib', 'Thư viện trung tâm', 'Paper, Plastic', 'Tầng trệt thư viện', 'LIB', 'G', 'STATION-LIB', 'active', 48, 10.7640, 106.6840, 57, 38),
  ('station-caf', 'Canteen xanh', 'Plastic, Metal', 'Khu canteen', 'CAF', '1', 'STATION-CAF', 'full', 91, 10.7615, 106.6851, 68, 70)
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
  ('organic', 'Rác hữu cơ', 'kg', 20, 'Để riêng rác thực phẩm, tránh lẫn nhựa và kim loại.', 'active')
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

insert into public.point_rules (id, label, class_keys, bin_group, points, enabled)
values
  ('recycle', 'Tái chế', array['paper', 'cardboard', 'plastic', 'glass', 'metal'], 'Tái chế', 5, true),
  ('organic', 'Hữu cơ', array['biological'], 'Hữu cơ', 3, true),
  ('hazard', 'Pin / nguy hại', array['battery'], 'Pin / nguy hại', 8, true),
  ('other', 'Còn lại', array['clothes', 'shoes', 'trash'], 'Còn lại', 0, true)
on conflict (id) do update set
  label = excluded.label,
  class_keys = excluded.class_keys,
  bin_group = excluded.bin_group,
  points = excluded.points,
  enabled = excluded.enabled;
