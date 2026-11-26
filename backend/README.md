# HPAI Assessment — Backend

Node 18+ / Express / PostgreSQL (Supabase). API contract: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
Marking is done in the browser; this service authenticates, picks which question ids each candidate gets (questions live in code: `src/catalog.generated.js`, built from `../question-bank`), stores answers/marks/timings, and powers dashboards.

## Setup
```bash
cd backend
cp .env.example .env      # fill in values (see below)
npm install
npm run migrate           # applies sql/schema.sql (idempotent, safe to re-run)
npm run seed              # admin user only (questions are in code, not in the DB; safe to re-run)
npm run seed -- --demo    # also: proctor@hpai.test + candidate1..3@hpai.test (password Test@1234)
npm run dev               # http://localhost:4000/api/health
```

### .env
| Var | Notes |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → **Transaction pooler** (port 6543), e.g. `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`. SSL is enabled automatically for non-localhost hosts. |
| `JWT_SECRET` | Long random string. Tokens last 12 h. |
| `CORS_ORIGIN` | Comma-separated frontend origins, e.g. `https://your-app.vercel.app,http://localhost:5173` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin created by `npm run seed` (only if it doesn't exist yet; password is not overwritten later). |
| `PORT` | Default 4000 (Render sets it automatically). |

## Deploy on Render
`render.yaml` at the repo root defines the service (`rootDir: backend`, `npm install` → `npm start`, health check `/api/health`).
1. Render → New → Blueprint → pick this repo (or create a Web Service with Root Directory `backend`).
2. Set env vars: `DATABASE_URL` (Supabase pooler URL), `CORS_ORIGIN` (your Vercel URL), `ADMIN_EMAIL`, `ADMIN_PASSWORD`; `JWT_SECRET` is auto-generated.
3. Run `npm run migrate && npm run seed` once (locally with the same `DATABASE_URL`, or from the Render Shell).
4. In Vercel set `VITE_API_URL=https://<your-service>.onrender.com`.

Render free instances sleep after inactivity (~30–60 s cold start). Use a paid instance, or ping `/api/health`, before a live drive.
Supabase free projects pause after 7 days of inactivity — check before the drive.

## Notes
- Scores are computed server-side from browser-reported `tests_passed/tests_total` × question marks (so the formula can't be changed client-side, but the pass counts are client-reported).
- Questions are not stored in the database at all. Reference solutions never leave `question-bank/` (the generator refuses to emit them).
- Submit/answer endpoints are idempotent; one attempt per (session, candidate); the server clock owns `ends_at` (45 s grace for the final submit).
- Every create/update/extend/terminate writes to `audit_logs`.
