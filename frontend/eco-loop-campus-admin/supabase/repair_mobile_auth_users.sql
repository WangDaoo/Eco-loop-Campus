-- Eco-loop Campus mobile Auth repair
-- Run in Supabase SQL Editor. This confirms existing Auth users, resets their passwords to the mobile .env values,
-- then syncs auth.users UID into public.users.

create extension if not exists pgcrypto with schema extensions;

update auth.users
set
  encrypted_password = case
    when email = 'student@school.edu.vn' then extensions.crypt('change-me', extensions.gen_salt('bf'))
    when email = 'volunteer@school.edu.vn' then extensions.crypt('change-me', extensions.gen_salt('bf'))
    else encrypted_password
  end,
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where email in ('student@school.edu.vn', 'volunteer@school.edu.vn');

insert into public.users (id, name, email, role, "group", points, status)
select
  id::text,
  case
    when email = 'student@school.edu.vn' then 'Sinh viên Smoke Test'
    when email = 'volunteer@school.edu.vn' then 'Volunteer Smoke Test'
    else email
  end as name,
  email,
  case
    when email = 'student@school.edu.vn' then 'student'
    when email = 'volunteer@school.edu.vn' then 'volunteer'
    else 'student'
  end as role,
  case
    when email = 'student@school.edu.vn' then 'Khoa Công nghệ thông tin'
    when email = 'volunteer@school.edu.vn' then 'CLB Môi trường'
    else 'Eco-loop Campus'
  end as "group",
  0,
  'active'
from auth.users
where email in ('student@school.edu.vn', 'volunteer@school.edu.vn')
on conflict (email) do update set
  id = excluded.id,
  name = excluded.name,
  role = excluded.role,
  "group" = excluded."group",
  status = 'active';

select
  au.email,
  au.id::text as auth_uid,
  au.email_confirmed_at is not null as confirmed,
  pu.id as public_user_id,
  pu.role,
  pu.status
from auth.users au
left join public.users pu on lower(pu.email) = lower(au.email)
where au.email in ('student@school.edu.vn', 'volunteer@school.edu.vn')
order by au.email;
