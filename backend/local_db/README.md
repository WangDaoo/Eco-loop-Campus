# Eco-loop Campus Local PostgreSQL

This folder contains the standalone PostgreSQL database for running Eco-loop Campus without Supabase limits.

## Files

- `schema.sql`: production schema only. It creates tables, indexes, and QR/Ecopoint transaction functions. It does not insert demo data.
- `smoke_qr_flow.sql`: transaction-based smoke test. It inserts temporary `E2E_` data, confirms a QR flow, then rolls back.
- `init_local_postgres.ps1`: initializes the local database and applies `schema.sql`.
- `seed_utehy_demo_data.py`: optional realistic UTEHY demo dataset for admin testing. It removes only old `E2E_` test rows, then upserts fixed `UTEHY_` demo rows.

## Run

```powershell
powershell -ExecutionPolicy Bypass -File backend\local_db\init_local_postgres.ps1
```

The script stores local secrets in `.runtime/`, which must not be committed.

## Seed realistic UTEHY demo data

Run this only when you want prebuilt demo data on a local/server PostgreSQL database:

```bat
scripts\seed_utehy_demo_data.bat
```

Demo accounts use temporary password `123456`. The script keeps `schema.sql` production-clean and does not truncate real tables.
