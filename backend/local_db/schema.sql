create extension if not exists pgcrypto;

create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null unique,
  password_hash text,
  role text not null default 'student' check (role in ('student', 'teacher', 'volunteer', 'admin')),
  "group" text,
  points integer not null default 0,
  status text not null default 'active' check (status in ('active', 'locked', 'pending', 'rejected')),
  avatar_key text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists avatar_presets (
  key text primary key,
  label text not null,
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bins (
  id text primary key,
  name text not null,
  bin_group text not null,
  location text not null,
  building text,
  floor text,
  qr_code text not null unique,
  status text not null default 'active' check (status in ('active', 'full', 'maintenance', 'closed')),
  capacity integer not null default 0 check (capacity between 0 and 100),
  latitude double precision,
  longitude double precision,
  map_x double precision check (map_x is null or (map_x between 0 and 100)),
  map_y double precision check (map_y is null or (map_y between 0 and 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists waste_types (
  id text primary key,
  name text not null,
  unit text not null default 'item',
  point_per_unit integer not null default 0 check (point_per_unit >= 0),
  recycle_method text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists predictions (
  id text primary key,
  class text not null,
  confidence double precision not null default 0 check (confidence between 0 and 1),
  source text not null default 'upload' check (source in ('upload', 'camera', 'mobile')),
  timestamp timestamptz not null default now(),
  bin_group text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  user_id text references users(id) on delete set null,
  bin_id text references bins(id) on delete set null,
  image_name text,
  image_url text,
  thumbnail_url text
);

create table if not exists point_rules (
  id text primary key,
  label text not null,
  class_keys text[] not null default '{}',
  bin_group text not null,
  points integer not null default 0 check (points >= 0),
  enabled boolean not null default true
);

create table if not exists feedback (
  id text primary key,
  user_id text references users(id) on delete set null,
  user_name text not null,
  category text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'in_progress', 'resolved', 'rejected')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  bin_id text references bins(id) on delete set null,
  admin_note text not null default '',
  resolved_at timestamptz,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists settings (
  id text primary key,
  threshold double precision not null default 0.65 check (threshold between 0 and 1),
  model_name text not null default 'MobileNetV2',
  class_count integer not null default 10,
  updated_at timestamptz not null default now()
);

create table if not exists point_history (
  id bigint generated always as identity primary key,
  prediction_id text references predictions(id) on delete cascade,
  submission_id text,
  user_id text references users(id) on delete set null,
  bin_id text references bins(id) on delete set null,
  class text not null,
  bin_group text not null,
  action text not null,
  points integer not null default 0,
  timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  admin_note text not null default '',
  source text not null default 'manual_adjustment',
  description text not null default '',
  status text not null default 'confirmed'
);

create table if not exists rewards (
  id text primary key,
  title text not null,
  description text not null default '',
  cost_points integer not null default 0 check (cost_points >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  color text not null default '#2F8F5B',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists missions (
  id text primary key,
  title text not null,
  description text not null default '',
  target integer not null default 1 check (target > 0),
  reward_points integer not null default 0 check (reward_points >= 0),
  action_label text not null default 'Tiếp tục',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_missions (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  mission_id text not null references missions(id) on delete cascade,
  current integer not null default 0 check (current >= 0),
  completed boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  updated_at timestamptz not null default now(),
  unique (user_id, mission_id)
);

create table if not exists reward_redemptions (
  id text primary key,
  user_id text references users(id) on delete set null,
  reward_id text references rewards(id) on delete set null,
  reward_label text not null,
  cost_points integer not null default 0 check (cost_points >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  admin_note text not null default ''
);

create table if not exists recycling_submissions (
  id text primary key default gen_random_uuid()::text,
  user_id text references users(id) on delete set null,
  bin_id text references bins(id) on delete set null,
  waste_type_id text references waste_types(id) on delete set null,
  quantity numeric not null default 0 check (quantity > 0),
  unit text not null default 'item',
  qr_token text not null unique,
  qr_signature text,
  status text not null default 'CREATED' check (status in ('CREATED', 'QR_SCANNED', 'POINT_CONFIRMED', 'REJECTED', 'PENDING_REVIEW', 'EXPIRED')),
  created_at timestamptz not null default now(),
  expired_at timestamptz not null,
  verified_by text references users(id) on delete set null,
  verified_at timestamptz,
  actual_quantity numeric,
  volunteer_note text
);

alter table point_history drop constraint if exists point_history_submission_id_fkey;

alter table point_history
  add constraint point_history_submission_id_fkey
  foreign key (submission_id) references recycling_submissions(id) on delete cascade;

create table if not exists qr_scan_logs (
  id text primary key default gen_random_uuid()::text,
  qr_token text not null,
  scanned_by text references users(id) on delete set null,
  station_id text references bins(id) on delete set null,
  scanned_at timestamptz not null default now(),
  result text not null check (result in ('SUCCESS', 'EXPIRED', 'ALREADY_USED', 'INVALID_TOKEN', 'WRONG_STATION')),
  note text not null default ''
);

create table if not exists proof_images (
  id text primary key default gen_random_uuid()::text,
  submission_id text references recycling_submissions(id) on delete cascade,
  image_url text not null,
  image_hash text,
  captured_at timestamptz not null default now(),
  verification_code text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  note text not null default ''
);

create index if not exists idx_users_email on users(lower(email));
create index if not exists idx_bins_status on bins(status);
create index if not exists idx_recycling_submissions_user_id on recycling_submissions(user_id);
create index if not exists idx_recycling_submissions_bin_id on recycling_submissions(bin_id);
create index if not exists idx_recycling_submissions_status on recycling_submissions(status);
create index if not exists idx_qr_scan_logs_qr_token on qr_scan_logs(qr_token);
create index if not exists idx_point_history_submission_id on point_history(submission_id);
create index if not exists idx_user_missions_user_id on user_missions(user_id);

create or replace function create_recycling_submission(
  p_user_id text,
  p_bin_id text,
  p_waste_type_id text,
  p_quantity numeric
)
returns jsonb
language plpgsql
as $$
declare
  v_waste waste_types%rowtype;
  v_submission recycling_submissions%rowtype;
  v_token text := 'ECL-SUB-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS') || '-' || lpad(floor(random() * 1000000)::text, 6, '0');
begin
  if not exists (select 1 from users where id = p_user_id and role = 'student' and status = 'active') then
    raise exception 'INVALID_STUDENT';
  end if;
  if not exists (select 1 from bins where id = p_bin_id and status in ('active', 'full')) then
    raise exception 'INVALID_STATION';
  end if;
  select * into v_waste from waste_types where id = p_waste_type_id and status = 'active';
  if not found then
    raise exception 'INVALID_WASTE_TYPE';
  end if;
  if coalesce(p_quantity, 0) <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  insert into recycling_submissions (user_id, bin_id, waste_type_id, quantity, unit, qr_token, expired_at)
  values (p_user_id, p_bin_id, p_waste_type_id, p_quantity, v_waste.unit, v_token, now() + interval '45 minutes')
  returning * into v_submission;

  return jsonb_build_object(
    'id', v_submission.id,
    'qrToken', v_submission.qr_token,
    'expiredAt', v_submission.expired_at,
    'status', v_submission.status
  );
end;
$$;

create or replace function scan_recycling_qr(
  p_qr_token text,
  p_scanned_by text,
  p_station_id text
)
returns jsonb
language plpgsql
as $$
declare
  v_submission recycling_submissions%rowtype;
  v_result text;
begin
  if not exists (select 1 from users where id = p_scanned_by and role in ('volunteer', 'admin') and status = 'active') then
    raise exception 'INVALID_VOLUNTEER';
  end if;

  select * into v_submission from recycling_submissions where qr_token = p_qr_token for update;
  if not found then
    insert into qr_scan_logs (qr_token, scanned_by, station_id, result, note)
    values (coalesce(p_qr_token, ''), p_scanned_by, p_station_id, 'INVALID_TOKEN', 'QR token không tồn tại');
    return jsonb_build_object('result', 'INVALID_TOKEN');
  end if;

  if v_submission.status in ('QR_SCANNED', 'POINT_CONFIRMED', 'REJECTED', 'PENDING_REVIEW') then
    v_result := 'ALREADY_USED';
  elsif v_submission.expired_at < now() then
    v_result := 'EXPIRED';
    update recycling_submissions set status = 'EXPIRED' where id = v_submission.id;
  elsif v_submission.bin_id <> p_station_id then
    v_result := 'WRONG_STATION';
  else
    v_result := 'SUCCESS';
    update recycling_submissions
    set status = 'QR_SCANNED', verified_by = p_scanned_by, verified_at = now()
    where id = v_submission.id;
  end if;

  insert into qr_scan_logs (qr_token, scanned_by, station_id, result, note)
  values (p_qr_token, p_scanned_by, p_station_id, v_result, '');

  return jsonb_build_object('result', v_result, 'submissionId', v_submission.id);
end;
$$;

create or replace function confirm_recycling_submission(
  p_submission_id text,
  p_volunteer_id text,
  p_actual_quantity numeric,
  p_note text default ''
)
returns jsonb
language plpgsql
as $$
declare
  v_submission recycling_submissions%rowtype;
  v_waste waste_types%rowtype;
  v_points integer;
begin
  if not exists (select 1 from users where id = p_volunteer_id and role in ('volunteer', 'admin') and status = 'active') then
    raise exception 'INVALID_VOLUNTEER';
  end if;

  select * into v_submission from recycling_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;
  if v_submission.status <> 'QR_SCANNED' then
    raise exception 'INVALID_SUBMISSION_STATUS';
  end if;
  if not exists (select 1 from proof_images where submission_id = p_submission_id and status <> 'rejected') then
    raise exception 'PROOF_IMAGE_REQUIRED';
  end if;

  select * into v_waste from waste_types where id = v_submission.waste_type_id;
  v_points := greatest(0, ceil(coalesce(p_actual_quantity, v_submission.quantity) * coalesce(v_waste.point_per_unit, 0))::integer);

  update recycling_submissions
  set status = 'POINT_CONFIRMED',
      actual_quantity = coalesce(p_actual_quantity, quantity),
      verified_by = p_volunteer_id,
      verified_at = now(),
      volunteer_note = coalesce(p_note, '')
  where id = p_submission_id;

  update users set points = points + v_points where id = v_submission.user_id;

  insert into point_history (submission_id, user_id, bin_id, class, bin_group, action, points, source, description, admin_note)
  values (
    p_submission_id,
    v_submission.user_id,
    v_submission.bin_id,
    coalesce(v_submission.waste_type_id, 'recycling'),
    coalesce((select bin_group from bins where id = v_submission.bin_id), 'Tái chế'),
    'Xác nhận QR tái chế',
    v_points,
    'qr_submission',
    'Cộng điểm từ giao dịch QR',
    coalesce(p_note, '')
  );

  return jsonb_build_object('status', 'POINT_CONFIRMED', 'points', v_points, 'submissionId', p_submission_id);
end;
$$;

create or replace function reject_recycling_submission(
  p_submission_id text,
  p_volunteer_id text,
  p_note text default ''
)
returns jsonb
language plpgsql
as $$
begin
  if not exists (select 1 from users where id = p_volunteer_id and role in ('volunteer', 'admin') and status = 'active') then
    raise exception 'INVALID_VOLUNTEER';
  end if;
  update recycling_submissions
  set status = 'REJECTED',
      verified_by = p_volunteer_id,
      verified_at = now(),
      volunteer_note = coalesce(p_note, '')
  where id = p_submission_id and status in ('CREATED', 'QR_SCANNED', 'PENDING_REVIEW');
  if not found then
    raise exception 'INVALID_SUBMISSION_STATUS';
  end if;
  return jsonb_build_object('status', 'REJECTED', 'submissionId', p_submission_id);
end;
$$;

create or replace function request_recycling_review(
  p_submission_id text,
  p_volunteer_id text,
  p_note text default ''
)
returns jsonb
language plpgsql
as $$
begin
  if not exists (select 1 from users where id = p_volunteer_id and role in ('volunteer', 'admin') and status = 'active') then
    raise exception 'INVALID_VOLUNTEER';
  end if;
  update recycling_submissions
  set status = 'PENDING_REVIEW',
      verified_by = p_volunteer_id,
      verified_at = now(),
      volunteer_note = coalesce(p_note, '')
  where id = p_submission_id and status in ('CREATED', 'QR_SCANNED');
  if not found then
    raise exception 'INVALID_SUBMISSION_STATUS';
  end if;
  return jsonb_build_object('status', 'PENDING_REVIEW', 'submissionId', p_submission_id);
end;
$$;
