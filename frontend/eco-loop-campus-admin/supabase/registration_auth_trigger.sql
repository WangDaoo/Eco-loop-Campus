-- Chay file nay tren Supabase SQL Editor neu dang ky mobile bi loi:
-- new row violates row-level security policy for table "users".
-- Trigger tao ho so public.users ngay khi Supabase Auth tao user moi.

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

drop policy if exists "student insert own profile" on public.users;
create policy "student insert own profile" on public.users
  for insert to authenticated
  with check (id = (auth.uid())::text or lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
