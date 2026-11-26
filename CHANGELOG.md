# Changelog

All notable changes to the HPAI Assessment Platform. Versions follow [Semantic Versioning](https://semver.org/).
The version is shown in the app (login card and footer) and returned by `GET /api/health`.

## Unreleased

- **Invite cleanup:** revoked / expired links are hidden on the live board by default (toggle to show). A never-used
  revoked / expired link can be removed one at a time, or all at once (`remove_inactive`); used links, attempts and
  results are never deleted. Removals are audit-logged.
- **Certificate:** removed the two signature lines above the date and issuer.
- **Fix:** `ERR_CONNECTION_RESET` / 502 on POST requests sent over an idle keep-alive connection (e.g. creating a session
  after a long time in the wizard). The API now keeps sockets open for 65 s (longer than proxy idle timeouts).
- **Reliability:** stray unhandled rejections / uncaught exceptions are logged instead of crashing the server
  (exits only after 10+ in a minute so the platform can restart a clean instance); graceful shutdown on SIGTERM/SIGINT
  drains in-flight requests and closes the database pool during deploys.

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
