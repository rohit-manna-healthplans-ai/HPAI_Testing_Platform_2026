# HPAI Assessment Platform

**Version 1.0.0** - a role-based (admin / proctor / candidate) online assessment platform for Healthplans.ai hiring drives.

- `frontend/` - React + Vite app (Vercel)
- `backend/` - Express API (Render) on Supabase Postgres
- `question-bank/` - source of truth for all questions (built into the frontend bank and the backend catalog)
- `docs/` - architecture, deployment, capacity and question-bank documents
- `legacy/` - the original single-page prototype

## Run locally
```
npm --prefix backend install  && npm run dev:backend      # API on :4000 (needs backend/.env, see backend/.env.example)
npm --prefix frontend install && npm run dev:frontend     # app on http://localhost:5173
```

## Branches
`dev` -> `itg` -> `prod`. Commit messages start with the date as `dd-mm-yyyy`. Production deploys from `prod`.

See [CHANGELOG.md](CHANGELOG.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
[docs/CAPACITY.md](docs/CAPACITY.md) and [docs/QUESTION_BANK.md](docs/QUESTION_BANK.md).
