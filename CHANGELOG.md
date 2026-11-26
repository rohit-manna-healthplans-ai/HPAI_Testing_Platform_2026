# Changelog

All notable changes to the HPAI Assessment Platform. Versions follow [Semantic Versioning](https://semver.org/).
The version is shown in the app (login card and footer) and returned by `GET /api/health`.

## v1.0.0 - 26-11-2026

First release.

- Role-based portal: **admin**, **proctor** and **candidate** dashboards (JWT auth).
- **Question bank in code** (`question-bank/`): 54 original questions across Programming (DSA), SQL,
  NoSQL (MongoDB), Quick Dev (UI debug) and AI/ML MCQ, with Easy / Medium / Hard levels.
  Hidden tests and MCQ answers are AES-GCM sealed; keys are released per attempt, or to an admin who
  re-enters their password.
- **Automatic marking in the browser** with partial credit: Python / JavaScript / TypeScript are executed;
  C, C++, Java, C#, Go, Rust, Ruby, PHP, Kotlin, Swift and Bash are syntax-checked (full marks for a clean,
  complete answer). Monaco editor with syntax colouring and auto-indent, live UI-debug preview.
- **Proctor tools**: propose / review / swap paper wizard, then session time; bulk one-time invite links with
  unique tester IDs (up to 50 candidates per session, `MAX_CANDIDATES_PER_SESSION`); live board with
  filters, highlights and bulk actions (extend time, revoke / regenerate links, close session).
- **Integrity**: one start per link, max 2 screen leaves then auto-submit, screenshot / print / copy deterrents,
  identity watermark, event timeline.
- **Candidate results**: marks only, plus result PDF and HPAI certificate with a verifiable code.
- **Review**: per-question marks, time spent and an on-demand time / space complexity estimate with charts.
- **Free-tier friendly**: batched saves and events, ETag / 304 polling, cheap invite redeem, small DB pool,
  `GET /api/admin/runtime` metrics; see `docs/CAPACITY.md`.
- Deployment: Supabase Postgres, Render (API), Vercel (frontend); branches `dev` -> `itg` -> `prod`.
