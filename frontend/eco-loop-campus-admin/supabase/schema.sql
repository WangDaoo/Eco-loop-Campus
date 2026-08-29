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

alter table public.users add column if not exists avatar_key text;
alter table public.users add column if not exists avatar_url text;

create table if not exists public.avatar_presets (
  key text primary key,
  label text not null,
  image_url text,
  background text not null default '#cbf9e4',
  tile text not null default '#a8f2ab',
  accent text not null default '#8bc34a',
  face text not null default '#2c6e6e',
  status text not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.avatar_presets add column if not exists image_url text;
alter table public.avatar_presets add column if not exists background text not null default '#cbf9e4';
alter table public.avatar_presets add column if not exists tile text not null default '#a8f2ab';
alter table public.avatar_presets add column if not exists accent text not null default '#8bc34a';
alter table public.avatar_presets add column if not exists face text not null default '#2c6e6e';
alter table public.avatar_presets add column if not exists status text not null default 'active';
alter table public.avatar_presets add column if not exists sort_order integer not null default 0;
alter table public.avatar_presets add column if not exists updated_at timestamptz not null default now();

update public.users
set status = 'active'
where status is null or lower(trim(status)) not in ('active', 'locked', 'pending', 'rejected');

alter table public.users drop constraint if exists users_status_check;
alter table public.users add constraint users_status_check
  check (lower(trim(status)) in ('active', 'locked', 'pending', 'rejected'));

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := lower(trim(coalesce(new.raw_user_meta_data ->> 'role', 'student')));
  profile_role text := case when requested_role = 'volunteer' then 'volunteer' else 'student' end;
  profile_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1))), '');
begin
  insert into public.users (id, name, email, role, "group", points, status)
  values (
    new.id::text,
    coalesce(profile_name, 'Nguoi dung Eco-loop'),
    coalesce(new.email, ''),
    profile_role,
    case when profile_role = 'volunteer' then 'Tinh nguyen vien Eco-loop' else 'Sinh vien Eco-loop' end,
    0,
    case when profile_role = 'volunteer' then 'pending' else 'active' end
  )
  on conflict (id) do update
  set
    name = coalesce(nullif(public.users.name, ''), excluded.name),
    email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

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

alter table public.bins add column if not exists latitude double precision;
alter table public.bins add column if not exists longitude double precision;
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

create table if not exists public.rewards (
  id text primary key,
  title text not null,
  description text not null default '',
  cost_points integer not null default 0,
  status text not null default 'active',
  color text not null default '#2F8F5B',
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id text primary key,
  title text not null,
  description text not null default '',
  target integer not null default 1,
  reward_points integer not null default 0,
  action_label text not null default 'Tiep tuc',
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
alter table public.avatar_presets enable row level security;
alter table public.avatar_presets replica identity full;
alter table public.bins enable row level security;
alter table public.bins replica identity full;
alter table public.predictions enable row level security;
alter table public.point_rules enable row level security;
alter table public.feedback enable row level security;
alter table public.settings enable row level security;
alter table public.point_history enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;

drop policy if exists "authenticated read users" on public.users;
drop policy if exists "authenticated read avatar_presets" on public.avatar_presets;
drop policy if exists "authenticated read bins" on public.bins;
drop policy if exists "authenticated read predictions" on public.predictions;
drop policy if exists "authenticated read point_rules" on public.point_rules;
drop policy if exists "authenticated read feedback" on public.feedback;
drop policy if exists "authenticated read settings" on public.settings;
drop policy if exists "authenticated read point_history" on public.point_history;
drop policy if exists "authenticated read rewards" on public.rewards;
drop policy if exists "authenticated read reward_redemptions" on public.reward_redemptions;

create policy "authenticated read users" on public.users for select to authenticated using (true);
create policy "authenticated read avatar_presets" on public.avatar_presets for select to authenticated using (true);
create policy "authenticated read bins" on public.bins for select to authenticated using (true);
create policy "authenticated read predictions" on public.predictions for select to authenticated using (true);
create policy "authenticated read point_rules" on public.point_rules for select to authenticated using (true);
create policy "authenticated read feedback" on public.feedback for select to authenticated using (true);
create policy "authenticated read settings" on public.settings for select to authenticated using (true);
create policy "authenticated read point_history" on public.point_history for select to authenticated using (true);
create policy "authenticated read rewards" on public.rewards for select to authenticated using (true);
create policy "authenticated read reward_redemptions" on public.reward_redemptions for select to authenticated using (true);

drop policy if exists "admin write users" on public.users;
drop policy if exists "admin write avatar_presets" on public.avatar_presets;
drop policy if exists "admin write bins" on public.bins;
drop policy if exists "admin write predictions" on public.predictions;
drop policy if exists "admin write point_rules" on public.point_rules;
drop policy if exists "admin write feedback" on public.feedback;
drop policy if exists "admin write settings" on public.settings;
drop policy if exists "admin write point_history" on public.point_history;
drop policy if exists "admin write rewards" on public.rewards;
drop policy if exists "admin write reward_redemptions" on public.reward_redemptions;

create policy "admin write users" on public.users for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write avatar_presets" on public.avatar_presets for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write bins" on public.bins for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write predictions" on public.predictions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write point_rules" on public.point_rules for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write feedback" on public.feedback for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write settings" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write point_history" on public.point_history for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write rewards" on public.rewards for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write reward_redemptions" on public.reward_redemptions for all to authenticated using (public.is_admin()) with check (public.is_admin());

do $$
begin
  alter publication supabase_realtime add table public.bins;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.avatar_presets;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'proof-images',
  'proof-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatar-presets',
  'avatar-presets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin upload prediction images" on storage.objects;
drop policy if exists "student upload prediction images" on storage.objects;
drop policy if exists "admin update prediction images" on storage.objects;
drop policy if exists "admin delete prediction images" on storage.objects;
drop policy if exists "admin upload avatar preset images" on storage.objects;
drop policy if exists "admin update avatar preset images" on storage.objects;
drop policy if exists "admin delete avatar preset images" on storage.objects;
drop policy if exists "public read avatar preset images" on storage.objects;

create policy "admin upload prediction images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'prediction-images' and public.is_admin());

create policy "student upload prediction images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'prediction-images' and name like ('mobile-ai/' || public.current_profile_id() || '/%'));

create policy "admin update prediction images" on storage.objects
  for update to authenticated
  using (bucket_id = 'prediction-images' and public.is_admin())
  with check (bucket_id = 'prediction-images' and public.is_admin());

create policy "admin delete prediction images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'prediction-images' and public.is_admin());

create policy "admin upload avatar preset images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatar-presets' and public.is_admin());

create policy "admin update avatar preset images" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatar-presets' and public.is_admin())
  with check (bucket_id = 'avatar-presets' and public.is_admin());

create policy "admin delete avatar preset images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatar-presets' and public.is_admin());

create policy "public read avatar preset images" on storage.objects
  for select to public
  using (bucket_id = 'avatar-presets');

-- Eco-loop Campus mobile workflow extension
create table if not exists public.waste_types (
  id text primary key,
  name text not null,
  unit text not null default 'item',
  point_per_unit integer not null default 0,
  recycle_method text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

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
  expired_at timestamptz not null,
  verified_by text references public.users(id) on delete set null,
  verified_at timestamptz,
  actual_quantity numeric,
  volunteer_note text
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

alter table public.feedback add column if not exists user_id text references public.users(id) on delete set null;
alter table public.feedback add column if not exists created_at timestamptz not null default now();
alter table public.point_history add column if not exists submission_id text references public.recycling_submissions(id) on delete cascade;
alter table public.point_history add column if not exists description text not null default '';
alter table public.point_history add column if not exists status text not null default 'confirmed';
alter table public.reward_redemptions add column if not exists reward_id text references public.rewards(id) on delete set null;

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

create or replace function public.create_recycling_submission(
  p_bin_id text,
  p_waste_type_id text,
  p_quantity numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id text := public.current_profile_id();
  v_waste public.waste_types%rowtype;
  v_submission public.recycling_submissions%rowtype;
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || lpad(floor(random() * 1000000)::text, 6, '0');
begin
  if v_user_id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if not exists (select 1 from public.bins where id = p_bin_id) then
    raise exception 'INVALID_STATION';
  end if;

  select * into v_waste
  from public.waste_types
  where id = p_waste_type_id and status = 'active';

  if not found then
    raise exception 'INVALID_WASTE_TYPE';
  end if;

  insert into public.recycling_submissions (
    id, user_id, bin_id, waste_type_id, quantity, unit, qr_token, qr_signature, status, created_at, expired_at
  ) values (
    'sub-' || v_suffix,
    v_user_id,
    p_bin_id,
    p_waste_type_id,
    p_quantity,
    v_waste.unit,
    'ECL-SUB-' || v_suffix,
    md5(v_user_id || ':' || p_bin_id || ':' || p_waste_type_id || ':' || v_suffix),
    'CREATED',
    now(),
    now() + interval '45 minutes'
  )
  returning * into v_submission;

  return to_jsonb(v_submission);
end;
$$;

create or replace function public.scan_recycling_qr(
  p_qr_token text,
  p_station_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := upper(trim(coalesce(p_qr_token, '')));
  v_scanned_by text := public.current_profile_id();
  v_submission public.recycling_submissions%rowtype;
  v_result text;
  v_note text;
begin
  if not public.is_volunteer_or_admin() then
    insert into public.qr_scan_logs (id, qr_token, scanned_by, station_id, result, note, scanned_at)
    values ('scan-' || extract(epoch from clock_timestamp())::bigint || '-' || floor(random() * 100000)::int, v_token, v_scanned_by, p_station_id, 'INVALID_ROLE', 'Tai khoan khong co quyen xac minh QR', now());
    return jsonb_build_object('result', 'INVALID_ROLE', 'note', 'Tai khoan khong co quyen xac minh QR');
  end if;

  select * into v_submission
  from public.recycling_submissions
  where qr_token = v_token
  for update skip locked;

  if not found then
    insert into public.qr_scan_logs (id, qr_token, scanned_by, station_id, result, note, scanned_at)
    values ('scan-' || extract(epoch from clock_timestamp())::bigint || '-' || floor(random() * 100000)::int, v_token, v_scanned_by, p_station_id, 'INVALID_TOKEN', 'QR khong ton tai trong he thong', now());
    return jsonb_build_object('result', 'INVALID_TOKEN', 'note', 'QR khong ton tai trong he thong');
  end if;

  if v_submission.expired_at < now() and v_submission.status = 'CREATED' then
    update public.recycling_submissions
    set status = 'EXPIRED', verified_by = v_scanned_by, verified_at = now()
    where id = v_submission.id
    returning * into v_submission;
    v_result := 'EXPIRED';
    v_note := 'QR da het han';
  elsif p_station_id is not null and v_submission.bin_id <> p_station_id then
    v_result := 'WRONG_STATION';
    v_note := 'QR khong thuoc tram dang truc';
  elsif v_submission.status <> 'CREATED' then
    v_result := 'ALREADY_USED';
    v_note := 'QR da duoc xu ly truoc do';
  else
    update public.recycling_submissions
    set status = 'QR_SCANNED', verified_by = v_scanned_by, verified_at = now()
    where id = v_submission.id
    returning * into v_submission;
    v_result := 'SUCCESS';
    v_note := 'QR hop le';
  end if;

  insert into public.qr_scan_logs (id, qr_token, scanned_by, station_id, result, note, scanned_at)
  values ('scan-' || extract(epoch from clock_timestamp())::bigint || '-' || floor(random() * 100000)::int, v_token, v_scanned_by, p_station_id, v_result, v_note, now());

  return jsonb_build_object('result', v_result, 'submission', to_jsonb(v_submission), 'note', v_note);
end;
$$;

create or replace function public.confirm_recycling_submission(
  p_submission_id text,
  p_actual_quantity numeric,
  p_volunteer_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_volunteer_id text := public.current_profile_id();
  v_submission public.recycling_submissions%rowtype;
  v_waste public.waste_types%rowtype;
  v_point public.point_history%rowtype;
  v_points integer;
  v_user_points integer;
begin
  if not public.is_volunteer_or_admin() then
    raise exception 'INVALID_ROLE';
  end if;

  if coalesce(p_actual_quantity, 0) <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select * into v_submission
  from public.recycling_submissions
  where id = p_submission_id
  for update skip locked;

  if not found then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  if v_submission.status <> 'QR_SCANNED' then
    raise exception 'QR_NOT_SCANNED';
  end if;

  if not exists (select 1 from public.proof_images where submission_id = p_submission_id and status <> 'rejected') then
    raise exception 'PROOF_IMAGE_REQUIRED';
  end if;

  select * into v_waste from public.waste_types where id = v_submission.waste_type_id;
  if not found then
    raise exception 'INVALID_WASTE_TYPE';
  end if;

  v_points := greatest(0, round(p_actual_quantity * v_waste.point_per_unit)::integer);

  update public.recycling_submissions
  set status = 'POINT_CONFIRMED',
      actual_quantity = p_actual_quantity,
      verified_by = v_volunteer_id,
      verified_at = now(),
      volunteer_note = coalesce(p_volunteer_note, '')
  where id = p_submission_id
  returning * into v_submission;

  insert into public.point_history (
    user_id, bin_id, submission_id, class, bin_group, action, description, points, status, source, admin_note, timestamp, created_at
  ) values (
    v_submission.user_id,
    v_submission.bin_id,
    v_submission.id,
    v_waste.id,
    v_waste.name,
    'Xac nhan ' || p_actual_quantity || ' ' || v_waste.unit || ' ' || v_waste.name,
    'Xac nhan ' || p_actual_quantity || ' ' || v_waste.unit || ' ' || v_waste.name,
    v_points,
    'confirmed',
    'volunteer_verification',
    coalesce(p_volunteer_note, ''),
    now(),
    now()
  ) returning * into v_point;

  update public.users
  set points = coalesce(points, 0) + v_points
  where id = v_submission.user_id
  returning points into v_user_points;

  return jsonb_build_object('submission', to_jsonb(v_submission), 'point', to_jsonb(v_point), 'updated_user_points', coalesce(v_user_points, 0));
end;
$$;

create or replace function public.reject_recycling_submission(
  p_submission_id text,
  p_volunteer_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_volunteer_id text := public.current_profile_id();
  v_submission public.recycling_submissions%rowtype;
begin
  if not public.is_volunteer_or_admin() then
    raise exception 'INVALID_ROLE';
  end if;

  select * into v_submission
  from public.recycling_submissions
  where id = p_submission_id
  for update skip locked;

  if not found then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  if v_submission.status in ('POINT_CONFIRMED', 'LOCKED') then
    raise exception 'SUBMISSION_LOCKED';
  end if;

  update public.recycling_submissions
  set status = 'REJECTED', verified_by = v_volunteer_id, verified_at = now(), volunteer_note = nullif(p_volunteer_note, '')
  where id = p_submission_id
  returning * into v_submission;

  return to_jsonb(v_submission);
end;
$$;

create or replace function public.request_recycling_review(
  p_submission_id text,
  p_volunteer_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_volunteer_id text := public.current_profile_id();
  v_submission public.recycling_submissions%rowtype;
begin
  if not public.is_volunteer_or_admin() then
    raise exception 'INVALID_ROLE';
  end if;

  select * into v_submission
  from public.recycling_submissions
  where id = p_submission_id
  for update skip locked;

  if not found then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  if v_submission.status in ('POINT_CONFIRMED', 'LOCKED') then
    raise exception 'SUBMISSION_LOCKED';
  end if;

  update public.recycling_submissions
  set status = 'PENDING_REVIEW', verified_by = v_volunteer_id, verified_at = now(), volunteer_note = nullif(p_volunteer_note, '')
  where id = p_submission_id
  returning * into v_submission;

  return to_jsonb(v_submission);
end;
$$;

grant execute on function public.create_recycling_submission(text, text, numeric) to authenticated;
grant execute on function public.scan_recycling_qr(text, text) to authenticated;
grant execute on function public.confirm_recycling_submission(text, numeric, text) to authenticated;
grant execute on function public.reject_recycling_submission(text, text) to authenticated;
grant execute on function public.request_recycling_review(text, text) to authenticated;

drop policy if exists "volunteer upload proof images" on storage.objects;
drop policy if exists "volunteer update proof images" on storage.objects;
drop policy if exists "volunteer delete proof images" on storage.objects;

create policy "volunteer upload proof images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'proof-images' and public.is_volunteer_or_admin());

create policy "volunteer update proof images" on storage.objects
  for update to authenticated
  using (bucket_id = 'proof-images' and public.is_volunteer_or_admin())
  with check (bucket_id = 'proof-images' and public.is_volunteer_or_admin());

create policy "volunteer delete proof images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'proof-images' and public.is_volunteer_or_admin());

alter table public.waste_types enable row level security;
alter table public.missions enable row level security;
alter table public.user_missions enable row level security;
alter table public.recycling_submissions enable row level security;
alter table public.qr_scan_logs enable row level security;
alter table public.proof_images enable row level security;

drop policy if exists "authenticated read waste_types" on public.waste_types;
drop policy if exists "authenticated read missions" on public.missions;
drop policy if exists "admin write missions" on public.missions;
drop policy if exists "mobile read user_missions" on public.user_missions;
drop policy if exists "student insert own user_missions" on public.user_missions;
drop policy if exists "student update own user_missions" on public.user_missions;
drop policy if exists "admin write waste_types" on public.waste_types;
drop policy if exists "student insert own profile" on public.users;
drop policy if exists "profile self update" on public.users;
drop policy if exists "volunteer update users" on public.users;
drop policy if exists "student insert own feedback" on public.feedback;
drop policy if exists "student insert own predictions" on public.predictions;
drop policy if exists "mobile read submissions" on public.recycling_submissions;
drop policy if exists "student insert own submissions" on public.recycling_submissions;
drop policy if exists "mobile update submissions" on public.recycling_submissions;
drop policy if exists "volunteer insert qr logs" on public.qr_scan_logs;
drop policy if exists "mobile read qr logs" on public.qr_scan_logs;
drop policy if exists "mobile read proof images" on public.proof_images;
drop policy if exists "volunteer insert proof images" on public.proof_images;
drop policy if exists "volunteer update proof images" on public.proof_images;
drop policy if exists "student insert own redemptions" on public.reward_redemptions;
drop policy if exists "volunteer insert point_history" on public.point_history;

create policy "authenticated read waste_types" on public.waste_types for select to authenticated using (true);
create policy "authenticated read missions" on public.missions for select to authenticated using (true);
create policy "admin write missions" on public.missions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin write waste_types" on public.waste_types for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "mobile read user_missions" on public.user_missions
  for select to authenticated
  using (user_id = public.current_profile_id() or public.is_volunteer_or_admin());

create policy "student insert own user_missions" on public.user_missions
  for insert to authenticated
  with check (user_id = public.current_profile_id());

create policy "student update own user_missions" on public.user_missions
  for update to authenticated
  using (user_id = public.current_profile_id())
  with check (user_id = public.current_profile_id());

create policy "student insert own profile" on public.users
  for insert to authenticated
  with check (id = (auth.uid())::text or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "profile self update" on public.users
  for update to authenticated
  using (id = (auth.uid())::text)
  with check (id = (auth.uid())::text);

create policy "volunteer update users" on public.users
  for update to authenticated
  using (public.is_volunteer_or_admin())
  with check (public.is_volunteer_or_admin());

create policy "student insert own feedback" on public.feedback
  for insert to authenticated
  with check (user_id = public.current_profile_id());

create policy "student insert own predictions" on public.predictions
  for insert to authenticated
  with check (user_id = public.current_profile_id());

create policy "mobile read submissions" on public.recycling_submissions
  for select to authenticated
  using (user_id = public.current_profile_id() or public.is_volunteer_or_admin());

create policy "student insert own submissions" on public.recycling_submissions
  for insert to authenticated
  with check (user_id = public.current_profile_id());

create policy "mobile update submissions" on public.recycling_submissions
  for update to authenticated
  using (user_id = public.current_profile_id() or public.is_volunteer_or_admin())
  with check (user_id = public.current_profile_id() or public.is_volunteer_or_admin());

create policy "volunteer insert qr logs" on public.qr_scan_logs
  for insert to authenticated
  with check (public.is_volunteer_or_admin());

create policy "mobile read qr logs" on public.qr_scan_logs
  for select to authenticated
  using (scanned_by = public.current_profile_id() or public.is_volunteer_or_admin());

create policy "mobile read proof images" on public.proof_images
  for select to authenticated
  using (
    public.is_volunteer_or_admin()
    or exists (
      select 1 from public.recycling_submissions s
      where s.id = proof_images.submission_id
        and s.user_id = public.current_profile_id()
    )
  );

create policy "volunteer insert proof images" on public.proof_images
  for insert to authenticated
  with check (public.is_volunteer_or_admin());

create policy "volunteer update proof images" on public.proof_images
  for update to authenticated
  using (public.is_volunteer_or_admin())
  with check (public.is_volunteer_or_admin());

create policy "student insert own redemptions" on public.reward_redemptions
  for insert to authenticated
  with check (user_id = public.current_profile_id());

create policy "volunteer insert point_history" on public.point_history
  for insert to authenticated
  with check (public.is_volunteer_or_admin());
