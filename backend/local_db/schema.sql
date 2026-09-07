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

create table if not exists reward_categories (
  id text primary key,
  name text not null,
  description text not null default '',
  status text not null default 'active' check (status in ('active', 'inactive')),
  color text not null default '#2F8F5B',
  created_at timestamptz not null default now(),
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

alter table point_history add column if not exists reference_type text not null default '';
alter table point_history add column if not exists reference_id text not null default '';

create table if not exists rewards (
  id text primary key,
  title text not null,
  description text not null default '',
  category_id text references reward_categories(id) on delete set null,
  category_name text not null default '',
  cost_points integer not null default 0 check (cost_points >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  color text not null default '#2F8F5B',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists faculties (
  code text primary key,
  name text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive')),
  sort_order integer not null unique check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into faculties (code, name, status, sort_order) values
  ('mechanical-engineering', 'Khoa Cơ khí', 'active', 1),
  ('automotive-engineering', 'Khoa Cơ khí động lực', 'active', 2),
  ('electrical-electronics', 'Khoa Điện – Điện tử', 'active', 3),
  ('information-technology', 'Khoa Công nghệ thông tin', 'active', 4),
  ('garment-fashion', 'Khoa Công nghệ May và Thời trang', 'active', 5),
  ('chemical-environmental', 'Khoa Công nghệ Hóa học và Môi trường', 'active', 6),
  ('economics', 'Khoa Kinh tế', 'active', 7),
  ('foreign-languages', 'Khoa Ngoại ngữ', 'active', 8),
  ('technical-education', 'Khoa Sư phạm Kỹ thuật', 'active', 9),
  ('basic-sciences', 'Khoa Khoa học cơ bản', 'active', 10),
  ('political-theory', 'Khoa Lý luận chính trị', 'active', 11)
on conflict (code) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table users add column if not exists student_code text;
alter table users add column if not exists faculty_code text references faculties(code) on delete restrict;
alter table users add column if not exists phone_number text;
create unique index if not exists idx_users_student_code_ci
  on users (lower(student_code)) where student_code is not null;

alter table rewards add column if not exists stock integer check (stock is null or stock >= 0);

alter table rewards add column if not exists category_id text references reward_categories(id) on delete set null;
alter table rewards add column if not exists category_name text not null default '';

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

alter table user_missions drop constraint if exists user_missions_status_check;
alter table user_missions
  add constraint user_missions_status_check
  check (status in ('active', 'inactive', 'completed'));

create table if not exists mission_events (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  mission_id text not null references missions(id) on delete cascade,
  event_type text not null,
  event_id text not null,
  increment integer not null default 1 check (increment > 0),
  created_at timestamptz not null default now(),
  unique (user_id, mission_id, event_type, event_id)
);

create table if not exists reward_redemptions (
  id text primary key,
  user_id text references users(id) on delete set null,
  reward_id text references rewards(id) on delete set null,
  reward_label text not null,
  cost_points integer not null default 0 check (cost_points >= 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'fulfilled', 'expired', 'scanned', 'cancelled')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  admin_note text not null default ''
);

create table if not exists reward_redemption_batches (
  id text primary key,
  student_id text not null references users(id) on delete cascade,
  qr_token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'scanned', 'fulfilled', 'expired', 'rejected', 'cancelled')),
  scanned_by text references users(id) on delete set null,
  scanned_at timestamptz,
  fulfilled_at timestamptz,
  updated_at timestamptz not null default now()
);

update reward_redemption_batches
set status = 'fulfilled',
    fulfilled_at = coalesce(fulfilled_at, scanned_at, updated_at)
where status = 'scanned';
update reward_redemption_batches
set status = 'cancelled'
where status = 'rejected';
alter table reward_redemption_batches
  drop constraint if exists reward_redemption_batches_status_check;
alter table reward_redemption_batches
  add constraint reward_redemption_batches_status_check
  check (status in ('pending', 'fulfilled', 'expired', 'cancelled'));

alter table missions add column if not exists event_type text not null default 'submission_confirmed';
alter table missions add column if not exists filter_waste_type_id text references waste_types(id) on delete set null;

create table if not exists reward_redemption_items (
  id text primary key,
  batch_id text not null references reward_redemption_batches(id) on delete cascade,
  reward_id text references rewards(id) on delete set null,
  reward_title text not null,
  quantity integer not null check (quantity > 0),
  points_each integer not null check (points_each >= 0),
  points_total integer not null check (points_total >= 0)
);

alter table reward_redemption_items drop constraint if exists reward_redemption_items_reward_id_fkey;
alter table reward_redemption_items alter column reward_id drop not null;
alter table reward_redemption_items
  add constraint reward_redemption_items_reward_id_fkey
  foreign key (reward_id) references rewards(id) on delete set null;

drop index if exists idx_active_reward_batch_per_student;
create unique index idx_active_reward_batch_per_student
  on reward_redemption_batches(student_id)
  where status = 'pending';
create index if not exists idx_reward_batch_qr_token on reward_redemption_batches(qr_token);

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

create table if not exists ai_training_samples (
  id text primary key,
  prediction_id text references predictions(id) on delete set null,
  submission_id text references recycling_submissions(id) on delete set null,
  proof_id text references proof_images(id) on delete set null,
  original_class text not null default '',
  corrected_class text not null,
  corrected_waste_type_id text references waste_types(id) on delete set null,
  corrected_by text references users(id) on delete set null,
  corrected_at timestamptz not null default now(),
  note text not null default '',
  annotation_status text not null default 'reviewed' check (annotation_status in ('pending', 'reviewed', 'exported', 'rejected')),
  image_path text not null,
  exported_at timestamptz,
  export_class text not null default ''
);

create index if not exists idx_ai_training_samples_status on ai_training_samples(annotation_status);

create or replace function create_reward_redemption_batch(
  p_student_id text,
  p_items jsonb,
  p_ttl_minutes integer default 15
)
returns jsonb
language plpgsql
as $$
declare
  v_batch_id text := gen_random_uuid()::text;
  v_token text := 'ECL-REWARD-' || replace(gen_random_uuid()::text, '-', '');
  v_item jsonb;
  v_reward rewards%rowtype;
  v_quantity integer;
  v_total integer := 0;
  v_expires_at timestamptz := now() + make_interval(mins => greatest(1, p_ttl_minutes));
begin
  if not exists (select 1 from users where id = p_student_id and role = 'student' and status = 'active') then
    raise exception 'INVALID_STUDENT';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'REWARD_ITEMS_REQUIRED';
  end if;
  update reward_redemption_batches
  set status = 'expired', updated_at = now()
  where student_id = p_student_id
    and status = 'pending'
    and expires_at <= now();
  if exists (select 1 from reward_redemption_batches where student_id = p_student_id and status = 'pending' and expires_at > now()) then
    raise exception 'ACTIVE_REWARD_BATCH_EXISTS';
  end if;

  insert into reward_redemption_batches (id, student_id, qr_token, expires_at)
  values (v_batch_id, p_student_id, v_token, v_expires_at);

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_reward from rewards where id = v_item->>'rewardId' and status = 'active' for update;
    if not found then raise exception 'REWARD_NOT_FOUND'; end if;
    if exists (select 1 from reward_redemption_items where batch_id = v_batch_id and reward_id = v_reward.id) then
      raise exception 'DUPLICATE_REWARD_ITEM';
    end if;
    if not (v_item ? 'quantity')
       or jsonb_typeof(v_item->'quantity') <> 'number'
       or (v_item->>'quantity') !~ '^[1-9][0-9]*$' then
      raise exception 'INVALID_REWARD_QUANTITY';
    end if;
    begin
      v_quantity := (v_item->>'quantity')::integer;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_REWARD_QUANTITY';
    end;
    if v_quantity <= 0 then raise exception 'INVALID_REWARD_QUANTITY'; end if;
    if v_reward.stock is not null and v_reward.stock < v_quantity then raise exception 'REWARD_OUT_OF_STOCK'; end if;
    insert into reward_redemption_items (id, batch_id, reward_id, reward_title, quantity, points_each, points_total)
    values (gen_random_uuid()::text, v_batch_id, v_reward.id, v_reward.title, v_quantity, v_reward.cost_points, v_quantity * v_reward.cost_points);
    v_total := v_total + v_quantity * v_reward.cost_points;
  end loop;
  if v_total <= 0 then raise exception 'REWARD_TOTAL_INVALID'; end if;
  return jsonb_build_object('id', v_batch_id, 'studentId', p_student_id, 'qrToken', v_token, 'status', 'pending', 'totalPoints', v_total, 'expiresAt', v_expires_at);
exception when others then
  raise;
end;
$$;

create or replace function scan_reward_redemption_batch(
  p_qr_token text,
  p_actor_id text
)
returns jsonb
language plpgsql
as $$
declare
  v_batch reward_redemption_batches%rowtype;
  v_item record;
  v_points integer := 0;
  v_balance integer;
begin
  if not exists (select 1 from users where id = p_actor_id and ((role = 'volunteer' and status = 'active') or (role = 'admin' and status = 'active'))) then
    raise exception 'INVALID_REDEMPTION_ACTOR';
  end if;
  select * into v_batch from reward_redemption_batches where qr_token = p_qr_token for update;
  if not found then raise exception 'REWARD_BATCH_NOT_FOUND'; end if;
  if v_batch.status <> 'pending' then raise exception 'REWARD_BATCH_ALREADY_PROCESSED'; end if;
  if v_batch.expires_at <= now() then
    update reward_redemption_batches set status = 'expired', updated_at = now() where id = v_batch.id;
    return jsonb_build_object('error', 'REWARD_BATCH_EXPIRED', 'id', v_batch.id, 'status', 'expired');
  end if;
  select points into v_balance from users where id = v_batch.student_id for update;
  for v_item in
    select i.*, r.stock as current_stock
    from reward_redemption_items i
    join rewards r on r.id = i.reward_id
    where i.batch_id = v_batch.id
    order by i.reward_id
    for update of r
  loop
    if v_item.current_stock is not null and v_item.current_stock < v_item.quantity then
      raise exception 'REWARD_OUT_OF_STOCK';
    end if;
    v_points := v_points + v_item.points_total;
  end loop;
  if v_balance < v_points then raise exception 'INSUFFICIENT_POINTS'; end if;
  update users set points = points - v_points, updated_at = now() where id = v_batch.student_id;
  update rewards r set stock = case when r.stock is null then null else r.stock - i.quantity end, updated_at = now()
  from reward_redemption_items i where i.batch_id = v_batch.id and r.id = i.reward_id;
  update reward_redemption_batches
  set status = 'fulfilled', scanned_by = p_actor_id, scanned_at = now(),
      fulfilled_at = now(), updated_at = now()
  where id = v_batch.id;
  insert into point_history (user_id, class, bin_group, action, points, source, description, status, reference_type, reference_id)
  values (v_batch.student_id, 'reward', 'Đổi thưởng', 'Đổi phần thưởng', -v_points, 'reward_redemption', 'Trừ điểm khi xác nhận đổi thưởng', 'confirmed', 'reward_redemption_batch', v_batch.id);
  return jsonb_build_object('id', v_batch.id, 'status', 'fulfilled', 'pointsSpent', v_points, 'studentId', v_batch.student_id);
end;
$$;

create or replace function finalize_reward_redemption_batch(
  p_batch_id text,
  p_actor_id text,
  p_status text,
  p_note text default ''
)
returns jsonb
language plpgsql
as $$
declare
  v_batch reward_redemption_batches%rowtype;
  v_points integer;
begin
  if not exists (select 1 from users where id = p_actor_id and role = 'admin' and status = 'active') then
    raise exception 'INVALID_REDEMPTION_ACTOR';
  end if;
  if p_status <> 'cancelled' then raise exception 'INVALID_REDEMPTION_STATUS'; end if;
  select * into v_batch from reward_redemption_batches where id = p_batch_id for update;
  if not found then raise exception 'REWARD_BATCH_NOT_FOUND'; end if;
  if v_batch.status <> 'fulfilled' then raise exception 'INVALID_REDEMPTION_STATUS'; end if;
  select coalesce(sum(points_total), 0)::integer into v_points from reward_redemption_items where batch_id = p_batch_id;
  update users set points = points + v_points, updated_at = now() where id = v_batch.student_id;
  update rewards r
  set stock = case when r.stock is null then null else r.stock + i.quantity end,
      updated_at = now()
  from reward_redemption_items i
  where i.batch_id = p_batch_id and r.id = i.reward_id;
  insert into point_history (user_id, class, bin_group, action, points, source, description, admin_note, status, reference_type, reference_id)
  values (v_batch.student_id, 'reward', 'Đổi thưởng', 'Hoàn điểm đổi thưởng', v_points, 'reward_refund', 'Hoàn điểm và tồn kho do hủy đổi thưởng', p_note, 'confirmed', 'reward_redemption_batch', p_batch_id);
  update reward_redemption_batches set status = 'cancelled', updated_at = now() where id = p_batch_id;
  return jsonb_build_object('id', p_batch_id, 'status', p_status, 'studentId', v_batch.student_id);
end;
$$;

create or replace function adjust_manual_points(
  p_user_id text,
  p_admin_id text,
  p_points integer,
  p_reason text,
  p_reference_type text default 'manual_point',
  p_reference_id text default ''
)
returns jsonb
language plpgsql
as $$
declare
  v_balance integer;
  v_next integer;
  v_history_id bigint;
begin
  if not exists (select 1 from users where id = p_admin_id and role = 'admin' and status = 'active') then
    raise exception 'INVALID_MANUAL_POINT_ACTOR';
  end if;
  if p_points is null or p_points = 0 or nullif(trim(p_reason), '') is null then
    raise exception 'INVALID_MANUAL_POINT';
  end if;
  if nullif(trim(p_reference_id), '') is not null and exists (
    select 1 from point_history
    where reference_type = trim(p_reference_type)
      and reference_id = trim(p_reference_id)
  ) then
    return jsonb_build_object('userId', p_user_id, 'points', 0, 'balanceBefore', null, 'balanceAfter', null, 'duplicate', true);
  end if;
  select points into v_balance from users where id = p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  v_next := v_balance + p_points;
  if v_next < 0 then raise exception 'POINT_BALANCE_WOULD_BE_NEGATIVE'; end if;
  update users set points = v_next, updated_at = now() where id = p_user_id;
  insert into point_history (user_id, class, bin_group, action, points, source, description, admin_note, status, reference_type, reference_id)
  values (p_user_id, 'manual_adjustment', 'Điều chỉnh', trim(p_reason), p_points, 'manual_adjustment', trim(p_reason), trim(p_reason), 'confirmed', coalesce(nullif(trim(p_reference_type), ''), 'manual_point'), coalesce(nullif(trim(p_reference_id), ''), p_admin_id))
  returning id into v_history_id;
  return jsonb_build_object('userId', p_user_id, 'points', p_points, 'balanceBefore', v_balance, 'balanceAfter', v_next, 'historyId', v_history_id);
end;
$$;

create index if not exists idx_users_email on users(lower(email));
create index if not exists idx_bins_status on bins(status);
create index if not exists idx_recycling_submissions_user_id on recycling_submissions(user_id);
create index if not exists idx_recycling_submissions_bin_id on recycling_submissions(bin_id);
create index if not exists idx_recycling_submissions_status on recycling_submissions(status);
create index if not exists idx_qr_scan_logs_qr_token on qr_scan_logs(qr_token);
create index if not exists idx_point_history_submission_id on point_history(submission_id);
create index if not exists idx_user_missions_user_id on user_missions(user_id);
create index if not exists idx_mission_events_user_id on mission_events(user_id);

create or replace function apply_mission_event(
  p_user_id text,
  p_event_type text,
  p_event_id text,
  p_waste_type_id text default null,
  p_increment integer default 1
)
returns integer
language plpgsql
as $$
declare
  v_mission missions%rowtype;
  v_progress user_missions%rowtype;
  v_event_row_id text;
  v_previous_completed boolean;
  v_processed integer := 0;
  v_increment integer := greatest(1, coalesce(p_increment, 1));
begin
  if nullif(trim(p_event_type), '') is null or nullif(trim(p_event_id), '') is null then
    raise exception 'MISSION_EVENT_REQUIRED';
  end if;

  for v_mission in
    select *
    from missions
    where status = 'active'
      and event_type = p_event_type
      and (filter_waste_type_id is null or filter_waste_type_id = p_waste_type_id)
    order by id
    for update
  loop
    v_event_row_id := null;
    insert into mission_events (user_id, mission_id, event_type, event_id, increment)
    values (p_user_id, v_mission.id, p_event_type, p_event_id, v_increment)
    on conflict (user_id, mission_id, event_type, event_id) do nothing
    returning id into v_event_row_id;
    if v_event_row_id is null then
      continue;
    end if;

    select completed into v_previous_completed
    from user_missions
    where user_id = p_user_id and mission_id = v_mission.id
    for update;
    if not found then
      v_previous_completed := false;
    end if;

    insert into user_missions (user_id, mission_id, current, completed, status)
    values (p_user_id, v_mission.id, least(v_mission.target, v_increment), false, 'active')
    on conflict (user_id, mission_id) do update
    set current = least(v_mission.target, user_missions.current + v_increment),
        updated_at = now()
    returning * into v_progress;

    if v_progress.current >= v_mission.target and not v_previous_completed then
      update user_missions
      set completed = true, status = 'completed', updated_at = now()
      where id = v_progress.id
      returning * into v_progress;

      if v_mission.reward_points > 0 then
        update users
        set points = points + v_mission.reward_points, updated_at = now()
        where id = p_user_id;
        insert into point_history
          (user_id, class, bin_group, action, points, source, description,
           status, reference_type, reference_id)
        values
          (p_user_id, 'mission', 'Nhiệm vụ', v_mission.title,
           v_mission.reward_points, 'mission_reward',
           'Hoàn thành nhiệm vụ ' || v_mission.title, 'confirmed',
           'mission', v_mission.id);
      end if;
    end if;
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;

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
  if not exists (select 1 from bins where id = p_bin_id and status = 'active') then
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
  v_actor_role text;
begin
  select role into v_actor_role
  from users
  where id = p_volunteer_id and role in ('volunteer', 'admin') and status = 'active';
  if not found then
    raise exception 'INVALID_VOLUNTEER';
  end if;

  select * into v_submission from recycling_submissions where id = p_submission_id for update;
  if not found then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;
  if v_submission.status <> 'QR_SCANNED' then
    raise exception 'INVALID_SUBMISSION_STATUS';
  end if;
  if p_actual_quantity is null or p_actual_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;
  if v_actor_role <> 'admin' and v_submission.verified_by is distinct from p_volunteer_id then
    raise exception 'SUBMISSION_ACTOR_MISMATCH';
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

  perform apply_mission_event(
    v_submission.user_id,
    'submission_confirmed',
    p_submission_id,
    v_submission.waste_type_id,
    greatest(1, ceil(coalesce(p_actual_quantity, v_submission.quantity))::integer)
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
declare
  v_submission recycling_submissions%rowtype;
  v_actor_role text;
begin
  select role into v_actor_role
  from users
  where id = p_volunteer_id and role in ('volunteer', 'admin') and status = 'active';
  if not found then
    raise exception 'INVALID_VOLUNTEER';
  end if;
  select * into v_submission
  from recycling_submissions
  where id = p_submission_id
  for update;
  if not found or v_submission.status not in ('CREATED', 'QR_SCANNED', 'PENDING_REVIEW') then
    raise exception 'INVALID_SUBMISSION_STATUS';
  end if;
  if v_actor_role <> 'admin' and v_submission.verified_by is distinct from p_volunteer_id then
    raise exception 'SUBMISSION_ACTOR_MISMATCH';
  end if;
  update recycling_submissions
  set status = 'REJECTED',
      verified_by = p_volunteer_id,
      verified_at = now(),
      volunteer_note = coalesce(p_note, '')
  where id = p_submission_id;
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
declare
  v_submission recycling_submissions%rowtype;
  v_actor_role text;
begin
  select role into v_actor_role
  from users
  where id = p_volunteer_id and role in ('volunteer', 'admin') and status = 'active';
  if not found then
    raise exception 'INVALID_VOLUNTEER';
  end if;
  select * into v_submission
  from recycling_submissions
  where id = p_submission_id
  for update;
  if not found or v_submission.status not in ('CREATED', 'QR_SCANNED') then
    raise exception 'INVALID_SUBMISSION_STATUS';
  end if;
  if v_actor_role <> 'admin' and v_submission.verified_by is distinct from p_volunteer_id then
    raise exception 'SUBMISSION_ACTOR_MISMATCH';
  end if;
  update recycling_submissions
  set status = 'PENDING_REVIEW',
      verified_by = p_volunteer_id,
      verified_at = now(),
      volunteer_note = coalesce(p_note, '')
  where id = p_submission_id;
  return jsonb_build_object('status', 'PENDING_REVIEW', 'submissionId', p_submission_id);
end;
$$;
