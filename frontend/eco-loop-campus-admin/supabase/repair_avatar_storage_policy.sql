-- Eco-loop Campus - repair Supabase Storage policy for admin avatar uploads.
-- Run this file in Supabase SQL Editor when the web Avatar page shows:
-- "Storage avatar chưa mở quyền upload cho admin".

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

drop policy if exists "admin upload avatar preset images" on storage.objects;
drop policy if exists "admin update avatar preset images" on storage.objects;
drop policy if exists "admin delete avatar preset images" on storage.objects;
drop policy if exists "public read avatar preset images" on storage.objects;

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
