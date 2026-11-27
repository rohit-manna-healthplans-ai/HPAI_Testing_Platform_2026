# Deployment: Supabase + Render (API) + Vercel (frontend)

Order matters: **Supabase (already done) -> GitHub -> Render -> Vercel -> back to Render (CORS)**.

## 0. What is where
| Piece | Host | Notes |
|---|---|---|
| Postgres | Supabase | tables already migrated; admin user already seeded |
| API (`backend/`) | Render Web Service | root dir `backend`, `npm install`, `npm start` |
| Frontend (`frontend/`) | Vercel | build `cd frontend && npm install && npm run build`, output `frontend/dist` (root `vercel.json`) |
| Question bank | inside the frontend bundle (encrypted answers) | change it in `question-bank/`, run `npm run build-bank`, commit |

## 1. Push to GitHub
Never commit `.env` files (they are git-ignored; verify with `git status`).
```
git add -A
git status            # make sure no .env is listed
git commit -m "HPAI assessment platform"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

## 2. Render (backend)
1. Render dashboard -> **New + -> Blueprint** -> pick the repo (it reads `render.yaml`), or **New + -> Web Service** with: Root Directory `backend`, Build `npm install`, Start `npm start`, Health Check Path `/api/health`.
2. Environment variables:
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Supabase **Transaction pooler** URI (port 6543) with the DB password filled in |
   | `JWT_SECRET` | long random string (Blueprint can generate it) |
   | `BANK_MASTER_KEY` | **the exact same value as in your local `backend/.env`** - the committed bank is encrypted with it; a different value means every test fails to decrypt |
   | `CORS_ORIGIN` | your Vercel URL, e.g. `https://hpai-assessment.vercel.app` (no trailing slash; comma-separate extra origins) |
   | `NODE_VERSION` | `20` |
   | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | only used if you run `npm run seed` again |
3. Deploy, then open `https://<service>.onrender.com/api/health` -> `{"ok":true,"db":"ok"}`.

## 3. Vercel (frontend)
1. **Add New -> Project** -> import the repo. Leave Root Directory as the repo root (the root `vercel.json` handles the build) - or set Root Directory to `frontend` (Framework: Vite) if you prefer.
2. Environment variable: `VITE_API_URL` = `https://<service>.onrender.com` (no trailing slash, no `/api`).
3. Deploy. Open the Vercel URL.

## 4. Close the loop
Put the final Vercel URL into Render `CORS_ORIGIN` and redeploy Render. If you use a custom domain, add it too (comma-separated).

## 5. Smoke test on the live URLs
1. Log in as admin; change the password (user menu -> Change password).
2. Create a proctor, assign subjects.
3. Proctor: create a session -> generate an invite link -> open it in a private window -> take a short test -> result + PDF + certificate.
4. Open the same link again: it must say "already used".
5. Proctor Question bank shows questions but no answers; admin "Reveal answers" asks for the admin password.

## 6. Free-tier gotchas (read before the hiring day)
- **Render free web services sleep after ~15 minutes idle**; the first request then takes 30-60 s. Warm it up 10 minutes before the drive and keep it warm with a free uptime monitor hitting `/api/health` every 5 minutes (e.g. UptimeRobot), or use a paid instance for the day.
- **Supabase free projects pause after 7 days of inactivity** - open the dashboard / hit the API the day before.
- Free Render has limited CPU: ~100 simultaneous candidates mostly just save answers, which is fine; marking runs in each candidate's browser.
- Python marking downloads Pyodide (~10 MB) from a CDN the first time; make sure the venue network allows `cdn.jsdelivr.net` (and `fonts.googleapis.com`).
- Rotate any secret that was ever pasted in chat (Supabase DB password, service keys) before going live.

## 7. Updating later
- Code change: `git push` - Vercel and Render redeploy automatically.
- Question change: edit `question-bank/`, `npm run validate-bank`, `npm run build-bank`, commit both generated files, push. Frontend and backend deploy together so `BANK_VERSION` matches; don't rename question titles after attempts exist (ids derive from titles).
- Schema change: add it to `backend/sql/schema.sql` (idempotent) and run `npm run migrate` locally against Supabase.

## 8. Forgot password for proctors (optional email)
Works out of the box in **admin-assisted mode**: a proctor clicks *Forgot password?*, the request shows up for the admin under **Users -> Password reset requests**, the admin creates a one-time link and shares it. No extra setup.

To send reset links **by email** (fully self-service) add these Render environment variables:

| Key | Value |
|---|---|
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | API key from https://resend.com (API Keys) |
| `EMAIL_FROM` | a **verified** sender, e.g. `HPAI Assessment <no-reply@healthplans.ai>` (verify the domain in Resend: add its DNS records) |
| `APP_URL` | your Vercel URL, no trailing slash (links become `APP_URL/reset-password/<token>`) |
| `RESET_LINK_MINUTES` | optional, default `30` |

Notes: all four of `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` and `APP_URL` must be set, otherwise the app silently stays in admin-assisted mode. Without a verified domain Resend only delivers to the account owner's own address, so verify `healthplans.ai` first. SMTP is not used (Render's free tier blocks outbound SMTP ports). If an email cannot be sent the request falls back to the admin queue automatically.

**Admin account lost its password?** Run `NEW_PASSWORD='...' npm run reset-admin-password` from `backend/` (see backend/README.md); it talks to the database in `backend/.env`.

## 9. v1.1 release order (new question types and subjects)

The v1.1 bank adds drag-and-drop questions, 20 short coding questions and two new subjects (`mlflow`, `cloud`). Adding questions changes the bank version, which the API and the frontend compare. Follow this order:

1. **Pick a quiet moment: no test running.** While the two sides are on different bank versions, a candidate who is mid-test sees the "The app was updated. Please refresh the page" message. Progress is saved, but avoid it.
2. **Deploy the backend first** (push to `prod`; Render redeploys). Check `/api/health` shows the expected version and `"db":"ok"`.
3. **Then deploy the frontend** (Vercel). Hard-refresh (Ctrl+F5) once and open a session preview to confirm the new subjects show up.
4. **Give the new subjects to existing proctors, once, after the new backend is live:**
   ```
   npm --prefix backend run grant-new-subjects            # dry run: prints who would get ML Workflow and Cloud
   npm --prefix backend run grant-new-subjects -- --apply # writes the missing rows (safe to repeat; it never removes anything)
   ```
   Do **not** apply it before the new backend is live: the old API does not know the new subject ids. You can also tick the two subjects per proctor on the Users page instead of running the script.
5. `BANK_MASTER_KEY` is **unchanged** (the new questions are sealed with the same key). No new environment variables are needed.
6. Smoke test: create a session with one ML Workflow and one Cloud question, open it as a candidate, drag an answer, submit, and check the result page shows marks only.
