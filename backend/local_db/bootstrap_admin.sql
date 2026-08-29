-- Bootstrap one admin account after the local PostgreSQL schema is applied.
-- Usage:
--   psql "$DATABASE_URL" \
--     -v admin_email='admin@school.edu.vn' \
--     -v admin_name='Eco-loop Admin' \
--     -v password_hash='pbkdf2_sha256$...' \
--     -f backend/local_db/bootstrap_admin.sql
--
-- Generate password_hash with the backend helper:
--   python -c "import app; print(app.hash_password('123456'))"

insert into users (id, name, email, password_hash, role, status, points, updated_at)
values (
  gen_random_uuid()::text,
  :'admin_name',
  lower(:'admin_email'),
  :'password_hash',
  'admin',
  'active',
  0,
  now()
)
on conflict (email) do update
set name = excluded.name,
    password_hash = excluded.password_hash,
    role = 'admin',
    status = 'active',
    updated_at = now();
