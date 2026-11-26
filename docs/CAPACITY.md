# Capacity, load test & Render free-tier budget

Cap today: **50 candidates per session** (`MAX_CANDIDATES_PER_SESSION`, default 50). Everything below was measured with
`backend/scripts/loadtest.mjs` against a local backend talking to the live Supabase pooler, then scaled to the Render free
instance (≈0.1 vCPU shared, 512 MB RAM, 100 GB/month bandwidth, 750 instance-hours/month, sleeps after 15 min idle).

> **Honest scope:** CPU / RSS / latency numbers were measured on a developer laptop, **not on Render**. The Render budget
> below is a calculation from the measured CPU-ms per request with a pessimistic slowdown factor. Re-run the load test against
> the real Render URL once (`node scripts/loadtest.mjs --n 50 --base https://<service>.onrender.com`) before you raise the cap.

## 1. What was measured

Load test = N simulated candidates over HTTP, all at once (start spread over 3 s): invite GET → redeem → get attempt → 3 rounds of
bulk autosave (jittered) + one single-answer save + event batches → submit (and a repeated, idempotent submit) → result, while a
proctor polls the live board with `If-None-Match`. It then verifies, through the live board, that every attempt is `submitted`
with exactly the expected total score. Test data is deleted afterwards.

| | N = 50 (cap) | N = 75 (margin above the cap; cap temporarily 100) |
|---|---|---|
| Candidates failed / score mismatches | 0 / 0 | 0 / 0 |
| All attempts submitted & consistent | yes | yes |
| Server CPU total (user+system) | 2.6 s | 3.8 s |
| **CPU per candidate** (12.8 requests) | **52 ms** | **51 ms** |
| Avg CPU per request | ≈ 4 ms | ≈ 4 ms |
| RSS (start → peak) | 106 → 128 MB* | 69 → 113 MB |
| Heap peak | 41 MB | 46 MB |
| Event-loop lag p50 / p99 / max | 25 / 96 / 260 ms** | 22 / 54 / 77 ms** |
| DB pool (max 8) peak waiting requests | 55 (burst queue) | 67 (burst queue) |
| Wall time for the whole compressed test | 10.6 s | 9.5 s |
| Session + all links created in one call | 147 ms (50) | 390 ms (100 people, separate check) |

\* the second figure includes memory left from earlier runs in the same process. \** the monitor samples every 20 ms, so ~20 ms is the floor.

Latency (N = 50, local → Supabase ap-south-1; network jitter between runs was ±2×):

| Endpoint | p50 | p95 | p99 |
|---|---:|---:|---:|
| `GET /invite/:token` | 256 ms | 510 ms | 526 ms |
| `POST /invite/:token/redeem` | 498 ms | 721 ms | 751 ms |
| `GET /candidate/attempts/:id` (resume payload + keys) | 611 ms | 1103 ms | 1144 ms |
| `PUT /candidate/attempts/:id/answers` (bulk) | 350 ms | 876 ms | 913 ms |
| `POST …/events/batch` | 462 ms | 1080 ms | 1115 ms |
| `POST …/submit` | 454 ms | 650 ms | 1038 ms |
| `GET …/result` | 346 ms | 468 ms | 868 ms |
| `GET /proctor/sessions/:id/live` | 200 ms | 459 ms | – |

An earlier N = 50 run on a quieter network had p95 of 218 ms (bulk save), 512 ms (redeem), 564 ms (resume), 219 ms (submit). Most of the
latency is Supabase round-trip time (each statement ≈ 30–100 ms), not CPU. **Put the Render service in the region closest to the
Supabase project** (Supabase `ap-south-1` = Mumbai → pick Render **Singapore**).

Traffic per candidate in the test: **12.8 requests, 2.7 KB of JSON responses (uncompressed), 4.8 KB uploaded**.

## 2. What was optimised (CPU, memory, round trips)

- **No bcrypt on candidate paths.** Invite redeem no longer hashes anything: invite-created accounts get a cheap unusable marker (`!` + random) that can never match a login (login skips bcrypt for non-bcrypt hashes). bcrypt is only used for real logins, password changes and creating admin/proctor accounts, behind a **concurrency limiter of 2** (`src/passwords.js`) so a login burst cannot starve the event loop. Cost factor stays 10 (existing admin hashes untouched).
- **Fewer requests/queries:** bulk autosave `PUT /candidate/attempts/:id/answers` (≤ 20 answers, **one** multi-row upsert, unchanged rows skipped, scores computed server-side); `POST …/events/batch` (≤ 50 events, one statement, dedupe, per-attempt caps); submit = one transaction with 1 upsert + 2 statements; finalize is one atomic CTE (+certificate); redeem went from ~12 to ~8 round trips; attempt create is `INSERT … RETURNING`.
- **In-memory caches (bounded, short TTL):** authenticated user row (20 s), session row (30 s), live board (2 s), proctor monitor (2 s); `GET /subjects` and `GET /proctor/limits` send `Cache-Control: private, max-age`.
- **ETag / 304** on `GET /proctor/sessions/:id/live` and `GET /proctor/monitor` (ETag ignores `server_now` / `seconds_left`), so an unchanged poll is a few hundred bytes.
- **gzip level 1** (`compression`, threshold 1 KB) — cheap on 0.1 vCPU. Body limits 256 KB (512 KB on candidate attempt routes).
- **pg Pool max 8** (`PG_POOL_MAX`), idle timeout 20 s, `query_timeout` 25 s, TCP keep-alive. Works with Supabase's transaction pooler (no session state, no named prepared statements).
- **Memory safety:** every cache is bounded; event/answer sizes are capped; rate-limit stores are windowed. RSS stayed ≈ 110–130 MB at 50–75 candidates (limit 512 MB).
- **Rate limits are shared-IP safe:** authenticated candidate/proctor routes have **no per-IP limit**; public invite routes allow 1200 req/min/IP; login is limited **per account** (10/min) plus 600/min/IP (a lab can share one IP). Checked: 300 authenticated requests, 650 invite requests and 40 distinct-account logins from one IP in a burst → no 429.
- **Monitoring:** admin-only `GET /api/admin/runtime` → `{ rss_mb, heap_mb, cpu_user_ms, cpu_system_ms, event_loop_lag_ms:{p50,p99,max}, pool:{total,idle,waiting}, bcrypt:{active,queued}, uptime_s, requests_total, requests_per_min }` (`?reset=1` resets the lag histogram).

## 3. Budget for the Render free instance

Assumptions: per-request CPU ≈ 4 ms (measured); a real 45-minute test costs a candidate **≈ 60 requests** (3 to start, ≈ 45 batched autosaves, ≈ 10 event batches, submit + result) — see the frontend
recommendations in §6; the proctor polls the live board every 10 s (270 polls, ≈ 2 ms each); one start burst of 50 × 3 requests.

| Item (50 candidates, 45-min test, 5-min start window) | CPU-seconds (measured machine) | Pessimistic ×5 slower core |
|---|---:|---:|
| Candidate traffic: 50 × 60 requests × 4 ms | 12 s | 60 s |
| Proctor polling (270 × 2 ms) + admin/monitor | ≈ 1 s | ≈ 5 s |
| Start burst (150 requests) | 0.6 s | 3 s |
| **Total** | **≈ 14 s** | **≈ 68 s** |
| **Budget: 0.1 vCPU × 45 min = 270 CPU-s** | | |
| **Share of the budget used** | **≈ 5 %** | **≈ 25 %** |

**Verdict: the free instance holds 50 candidates (and the measured 75) in CPU-seconds and memory with a wide margin** (4×–20× on CPU, ~4× on RAM).
The risk is not the totals but the **burst** and the **cold start**:

- If all 50 candidates press *Start* in the same second the 150 requests need ≈ 0.6 CPU-s → at 10 % of a core the last one waits ≈ 6 s (≈ 30 s on a 5× slower core). Release links in **waves of ~10–15 candidates** or accept a slow first screen; the frontend must show a loader and retry.
- A sleeping instance takes **30–60 s** for the first request. Wake it 10 minutes before the drive (see the checklist).
- The "max N" on the free instance is therefore set by start-burst latency, not by total CPU: CPU would allow ≳ 200 steady-state; with staggered starts ≈ 100 is realistic. **Keep the cap at 50 until the load test has been run against the real Render URL.** For the drive day a paid Starter instance (0.5 CPU, no sleep) removes both risks.

### Bandwidth and instance-hours

- Outbound bandwidth per candidate ≈ 3 KB measured for 13 requests → ≈ **10–15 KB for a full 45-minute test** (frontend assets, the sealed question bank and Pyodide come from Vercel / CDNs, not from Render). 50 candidates ≈ **0.7 MB per drive**; even 100 drives a month ≈ 70 MB ≪ 100 GB.
- One always-on free web service ≈ **744 h** in a 31-day month, under the 750 h allowance (only one free always-on service per workspace). Keep-alive pings every 5 min (`/api/health`, one `SELECT 1`) are fine and also keep Supabase from pausing.

## 4. How to change the cap

`MAX_CANDIDATES_PER_SESSION` (env, default 50) is the single constant behind: `count` / `people` on `POST /proctor/sessions/:id/invites`, `candidate_count` / `people` / `candidate_ids` on `POST /proctor/sessions`, and the **total** per session (live links + used links + directly assigned candidates; revoked or expired unused links do not count). The frontend reads it from `GET /api/proctor/limits`. To raise it: set the env var on Render, redeploy, re-run
`node scripts/loadtest.mjs --n <new cap> --base https://<service>.onrender.com` and check p95 < 2 s, CPU-ms/candidate ≈ 50 and no failures.

## 5. Scripts

- `npm run loadtest -- --n 50 --base http://localhost:4600` (see header of `scripts/loadtest.mjs`; needs `backend/.env`; creates and removes `@lt.test` data). For N above the cap start the server with a larger `MAX_CANDIDATES_PER_SESSION`.
- `node scripts/integration-bulk.mjs --base http://localhost:4600 [--base2 http://localhost:4601]` — 61 checks: caps, bulk create, prefill/`name_locked`, `not_open_yet`, opened tracking, live lifecycle, bulk actions, batching caps, ETag, shared-IP bursts.

## 6. Frontend recommendations (to implement next)

1. **One batched autosave** every **45–60 s with ±10 s jitter** (`PUT …/answers`, ≤ 20 answers) plus a save on question switch and on submit — **only dirty answers** (hash-compare the payload to the last saved one to skip unchanged). Never one request per keystroke or per question.
2. **Batch events** every **15 s** (`POST …/events/batch`), send immediately only for `screen_leave` / `screenshot_attempt`; keep a small local queue so a failed batch is retried.
3. **Exponential backoff with jitter** on failures (e.g. 2 s, 4 s, 8 s … capped at 30 s, ±30 %); keep the answer in `localStorage` meanwhile; on 429/503 respect `Retry-After`.
4. **Proctor live board:** poll every **10 s** with `If-None-Match` (reuse the last `ETag`), **pause when the tab is hidden**, compute countdowns locally from `ends_at` + `server_now` offset (rows' `seconds_left` is only a snapshot).
5. **No polling on the candidate page.** Sync the timer from the `server_now` returned by every save (no extra requests); the 3rd screen-leave / timer end submits.
6. **Wake-up handling:** if the first request takes > 3 s or fails, show "Waking up the server… this can take up to a minute" and retry with backoff (the Render free instance may be asleep). Preload nothing heavy before the invite page has loaded.
7. Prefer the bulk endpoints (`/answers`, `/events/batch`); the single-answer / single-event routes remain only for compatibility.

## 7. Drive-day checklist

- [ ] The day before: open the Supabase dashboard / hit `/api/health` (free projects pause after 7 days idle); confirm `DATABASE_URL` is the **pooler** (port 6543).
- [ ] Render service in the region next to Supabase; env vars set (`DATABASE_URL`, `JWT_SECRET`, `BANK_MASTER_KEY` = same value used to build the bank, `CORS_ORIGIN`, `MAX_CANDIDATES_PER_SESSION`, optional `PG_POOL_MAX=8`).
- [ ] 10 minutes before: open `/api/health` (wake the instance); keep an UptimeRobot monitor on it (5 min).
- [ ] Create the session, generate links (`candidate_count` or the people list), download the CSV, share links **in waves** (10–15 at a time) if the instance is the free one.
- [ ] During the test: watch the live board (10 s poll) and, as admin, `GET /api/admin/runtime` — healthy = `event_loop_lag_ms.p99` < 200, `pool.waiting` ≈ 0 outside bursts, RSS < 300 MB.
- [ ] Use bulk **Extend** (≤ 60 min, reason required) for network problems; **Regenerate unused** if links were shared wrongly; **Close** when the window ends.
- [ ] After the drive: close the session; export results; rotate any secret that was pasted anywhere.
