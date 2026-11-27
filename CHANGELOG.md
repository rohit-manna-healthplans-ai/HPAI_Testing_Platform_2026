# Changelog

All notable changes to the HPAI Assessment Platform. Versions follow [Semantic Versioning](https://semver.org/).
The version is shown in the app (login card and footer) and returned by `GET /api/health`.

## Unreleased

- **Fix:** reissuing an unused *resume* link no longer turns it into a start link (which failed with a server error when
  redeemed); it stays a resume link, and an old start link for a tester who already started now returns a clear message.
- **Drag-and-drop question types (v1.1):** three new interactive types with partial marking and sealed answers —
  **sequence** (put the steps of an ML pipeline in order, with a scenario visual and a live pipeline diagram),
  **match** (drag cloud services onto their descriptions) and **architecture** (drag services into the slots of a
  cloud diagram). Mouse, touch and keyboard friendly; no Run button and no right/wrong feedback during the test.
- **Sequence scoring is chance-corrected:** score = marks x max(0, 2 x rules satisfied - total rules) / total rules.
  Rules are "step A must come before step B", so equally valid orders are accepted; a perfect order is 100 %, one step
  misplaced about 85 %, random dragging about 9 %.
- **12 new drag-and-drop questions:** ML Workflow (4: regression and classification pipelines from data import to
  evaluation, gradient-descent loop, train/validation/test without leakage) and Cloud (8: four architecture builders on
  AWS, Azure and GCP, four matching sets). Each takes 2-4 minutes.
- **20 new short coding questions** (8 easy, 8 medium, 4 hard; 2-4 minutes each) with **10 tests each: 3 visible + 7
  hidden**; every question was validated with several different valid solutions (JavaScript and Python) and with
  deliberately wrong solutions. The 16 original coding questions are unchanged.
- **Two new subjects:** `mlflow` "ML Workflow (Drag & Drop)" and `cloud` "Cloud (AWS, Azure, GCP)". The bank now has 86
  questions / 7 subjects; the original 54 questions are untouched.
- **Deploy (v1.1):** the bank version changes. Release the API first, then the frontend, while no test is running (a
  candidate mid-test would see the "please refresh" message). Then run `npm --prefix backend run grant-new-subjects`
  (dry run) and `... -- --apply` once, so existing proctors get the two new subjects. See `docs/DEPLOYMENT.md`.
- **Language list simplified;** internal marking notes moved to internal docs.
- **Docs:** narrated walkthrough video (`extra/HPAI_Test_Walkthrough_Video.html`, open in Edge) and a written
  Proctor & Candidate guide (`extra/HPAI_Proctor_Candidate_Guide.md`).
- **Forgot password for proctors:** *Forgot password?* on the sign-in page. Email mode (Resend over HTTPS, optional) sends a one-time link; admin-assisted mode (default) queues the request under *Users -> Password reset requests* with a nav badge, and the admin shares a one-time link. Links are hashed, single-use and expire (30 min); responses never reveal whether an account exists; rate-limited. Password changes and resets now sign out older sessions. New `npm run reset-admin-password` for admin recovery. Shared password rule: 8+ characters (change-password now enforces it on the server too).
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
- **Automatic marking in the browser** with partial credit across many languages. Monaco editor with syntax
  colouring and auto-indent, live UI-debug preview.
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
