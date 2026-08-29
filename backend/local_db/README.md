# Eco-loop Campus Local PostgreSQL

This folder contains the standalone PostgreSQL database for running Eco-loop Campus without Supabase limits.

## Files

- `schema.sql`: production schema only. It creates tables, indexes, and QR/Ecopoint transaction functions. It does not insert demo data.
- `smoke_qr_flow.sql`: transaction-based smoke test. It inserts temporary `E2E_` data, confirms a QR flow, then rolls back.
- `init_local_postgres.ps1`: initializes the local database and applies `schema.sql`.

## Run

```powershell
powershell -ExecutionPolicy Bypass -File backend\local_db\init_local_postgres.ps1
```

The script stores local secrets in `.runtime/`, which must not be committed.
