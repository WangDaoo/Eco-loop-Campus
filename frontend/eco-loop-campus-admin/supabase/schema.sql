create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null default 'student',
  "group" text,
  points integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

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
  map_x double precision,
  map_y double precision
);

alter table public.bins add column if not exists map_x double precision;
alter table public.bins add column if not exists map_y double precision;

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

create table if not exists public.feedback (
  id text primary key,
  user_name text not null,
  category text not null,
  message text not null,
  status text not null default 'unread',
  priority text not null default 'medium',
  bin_id text references public.bins(id) on delete set null,
  admin_note text not null default '',
  resolved_at timestamptz,
  timestamp timestamptz not null default now()
);

alter table public.feedback add column if not exists priority text not null default 'medium';
alter table public.feedback add column if not exists bin_id text references public.bins(id) on delete set null;
alter table public.feedback add column if not exists admin_note text not null default '';
alter table public.feedback add column if not exists resolved_at timestamptz;

create table if not exists public.settings (
  id text primary key,
  threshold double precision not null default 0.65,
  model_name text not null default 'MobileNetV2',
  class_count integer not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists public.point_history (
  id bigint generated always as identity primary key,
  prediction_id text references public.predictions(id) on delete cascade,
  user_id text references public.users(id) on delete set null,
  bin_id text references public.bins(id) on delete set null,
  class text not null,
  bin_group text not null,
  action text not null,
  points integer not null default 0,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.point_history add column if not exists admin_note text not null default '';
alter table public.point_history add column if not exists source text not null default 'ai_approval';

create table if not exists public.reward_redemptions (
  id text primary key,
  user_id text references public.users(id) on delete set null,
  reward_label text not null,
  cost_points integer not null default 0,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  admin_note text not null default ''
);

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
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and lower(role) = 'admin'
      and status = 'active'
  );
$$;

alter table public.users enable row level security;
alter table public.bins enable row level security;
alter table public.predictions enable row level security;
alter table public.point_rules enable row level security;
alter table public.feedback enable row level security;
alter table public.settings enable row level security;
alter table public.point_history enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists "authenticated read users" on public.users;
drop policy if exists "authenticated read bins" on public.bins;
drop policy if exists "authenticated read predictions" on public.predictions;
drop policy if exists "authenticated read point_rules" on public.point_rules;
drop policy if exists "authenticated read feedback" on public.feedback;
drop policy if exists "authenticated read settings" on public.settings;
drop policy if exists "authenticated read point_history" on public.point_history;
drop policy if exists "authenticated read reward_redemptions" on public.reward_redemptions;

create policy "authenticated read users" on public.users for select to authenticated using (true);
create policy "authenticated read bins" on public.bins for select to authenticated using (true);
create policy "authenticated read predictions" on public.predictions for select to authenticated using (true);
create policy "authenticated read point_rules" on public.point_rules for select to authenticated using (true);
create policy "authenticated read feedback" on public.feedback for select to authenticated using (true);
create policy "authenticated read settings" on public.settings for select to authenticated using (true);
create policy "authenticated read point_history" on public.point_history for select to authenticated using (true);
create policy "authenticated read reward_redemptions" on public.reward_redemptions for select to authenticated using (true);

drop policy if exists "admin write users" on public.users;
drop policy if exists "admin write bins" on public.bins;
drop policy if exists "admin write predictions" on public.predictions;
drop policy if exists "admin write point_rules" on public.point_rules;
drop policy if exists "admin write feedback" on public.feedback;
drop policy if exists "admin write settings" on public.settings;
drop policy if exists "admin write point_history" on public.point_history;
drop policy if exists "admin write reward_redemptions" on public.reward_redemptions;

create policy "admin write users" on public.users for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write bins" on public.bins for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write predictions" on public.predictions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write point_rules" on public.point_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write feedback" on public.feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write settings" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write point_history" on public.point_history for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write reward_redemptions" on public.reward_redemptions for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'prediction-images',
  'prediction-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin upload prediction images" on storage.objects;
drop policy if exists "admin update prediction images" on storage.objects;
drop policy if exists "admin delete prediction images" on storage.objects;

create policy "admin upload prediction images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'prediction-images' and public.is_admin());

create policy "admin update prediction images" on storage.objects
  for update to authenticated
  using (bucket_id = 'prediction-images' and public.is_admin())
  with check (bucket_id = 'prediction-images' and public.is_admin());

create policy "admin delete prediction images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'prediction-images' and public.is_admin());

insert into public.users (id, name, email, role, "group", points, status)
values ('AD001', 'Quản trị Eco-loop Campus', 'admin@school.edu.vn', 'admin', 'Ban vận hành', 0, 'active')
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  role = excluded.role,
  "group" = excluded."group",
  status = excluded.status;

insert into public.settings (id, threshold, model_name, class_count)
values ('model', 0.65, 'MobileNetV2', 10)
on conflict (id) do nothing;
