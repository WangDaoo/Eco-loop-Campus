# Supabase Admin DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Firebase Firestore/Auth in Eco-loop Campus admin with Supabase PostgreSQL/Auth while preserving existing admin UI and localStorage fallback.

**Architecture:** Keep page components using a single admin data service API. Add an env-driven Supabase client, replace Firestore calls with Supabase table calls, and keep localStorage as offline/demo fallback when Supabase is missing or returns errors.

**Tech Stack:** React CRA, JavaScript, `@supabase/supabase-js`, Supabase Auth, Supabase PostgreSQL, Jest/React Testing Library.

---

### Task 1: Tests For Supabase Data Source

**Files:**
- Modify: `src/App.test.js`

- [ ] Write tests that mock `@supabase/supabase-js`, expect admin login/auth through Supabase, expect dashboard source text `Nguồn dữ liệu Supabase`, expect local fallback text unchanged, expect AI tester `upsert` into `predictions`, and expect approving a scan updates `predictions` then inserts `point_history`.
- [ ] Run `npm test -- --watchAll=false --runInBand --silent` and verify tests fail because implementation still uses Firestore/Firebase.

### Task 2: Supabase Client And Store

**Files:**
- Create: `src/supabaseClient.js`
- Create: `src/admin/services/supabaseStore.js`
- Modify: `src/admin/services/authContext.js`
- Modify: `src/admin/pages/LoginPage.js`
- Modify: `src/admin/components/Topbar.js`
- Modify: all admin pages importing `firestoreStore.js`

- [ ] Install `@supabase/supabase-js`.
- [ ] Add client reading `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY`.
- [ ] Implement same public functions as `firestoreStore.js`: `signInAdmin`, `signOutAdmin`, `getAdminProfile`, CRUD/list methods, `loadDashboardData`, `seedDefaults`, `sourceText`.
- [ ] Map snake_case Supabase rows to camelCase app records.
- [ ] Keep localStorage fallback for reads/writes when Supabase is not configured or errors.

### Task 3: SQL Schema And Verification

**Files:**
- Create: `supabase/schema.sql`
- Modify: `package.json`, `package-lock.json`

- [ ] Add SQL schema for `users`, `bins`, `predictions`, `point_rules`, `feedback`, `settings`, `point_history`.
- [ ] Run `npm test -- --watchAll=false --runInBand --silent` and verify pass.
- [ ] Run `npm run build` and verify pass.
- [ ] Confirm `http://127.0.0.1:3000/` returns HTTP 200.
