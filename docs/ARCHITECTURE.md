# HPAI Assessment Platform — Architecture & Contract

Stack: **React + Vite** (Vercel) · **Node/Express** (Render) · **Supabase Postgres** (via `DATABASE_URL`).
Marking happens **in the browser**. **Questions live in code, not in the database**: the browser ships the full question bank (`frontend/src/bank/questions.generated.js`), the backend ships a metadata-only catalog (`backend/src/catalog.generated.js`). The backend only authenticates, picks which question ids a candidate gets, and stores answers/marks/timings/events.

Roles: `admin`, `proctor`, `candidate`.
Subjects (slugs `dsa`, `sql`, `nosql`, `ui`, `aiml`) are assigned to proctors (`proctor_subjects.subject_id` = slug). A proctor creates **sessions** from *their* subjects
(per-subject easy/medium/hard counts), assigns *their* candidates, and the candidate's questions are drawn from that.
Candidates see **only their marks** (total + per-subject) plus PDF result + certificate. Never code/answers/tests.

## Theme (HPAI)
CSS vars: `--navy:#173f59; --blue:#1f6688; --sky:#a2cfe2; --green:#0bd37a; --ink:#173044; --muted:#718895; --line:#dce8ed; --surface:#f8fbfc;`
Fonts: Figtree (UI), JetBrains Mono (code). Logo: `/logo.png`. Glassy cards, rounded 16-18px, navy→blue gradient buttons, green accent for submit.

## Env
Backend: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (comma list), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT` (default 4000).
Frontend: `VITE_API_URL` (default `http://localhost:4000`).

## Database (backend/sql/schema.sql — idempotent, `CREATE ... IF NOT EXISTS`, use `gen_random_uuid()`)
- `users(id uuid pk, name, email unique lower, password_hash, role text check in (admin,proctor,candidate), active bool default true, proctor_id uuid null -> users (candidate's owning proctor), created_by uuid null, created_at)`
- **No `subjects` / `questions` tables** (dropped by `sql/migrations/002_questions_in_code.sql`; see "Question bank in code").
- `proctor_subjects(proctor_id -> users, subject_id text /*subject slug*/, pk both)`
- `sessions(id uuid pk, name, proctor_id -> users, duration_mins int, subject_config jsonb, status text check in (open,closed) default 'open', opens_at timestamptz null, closes_at timestamptz null, created_at)`
  - `subject_config`: `[{ "subject_id": "dsa", "easy": 2, "medium": 1, "hard": 0 }]` (subject slug)
- `session_candidates(session_id, candidate_id, pk both)`
- `attempts(id uuid pk, session_id, candidate_id, proctor_id, started_at, ends_at, submitted_at null, status text check in (in_progress,submitted,auto_submitted,terminated), question_ids jsonb (ordered array of bank question ids, e.g. `dsa-easy-reverse-the-words`), max_score numeric, total_score numeric default 0, flag_count int default 0, extra_minutes int default 0, ip text, user_agent text, unique(session_id, candidate_id))`
- `answers(attempt_id, question_id text /*bank id, no FK*/, response jsonb, tests_passed int, tests_total int, score numeric, max_score numeric, time_spent_sec int, updated_at, pk(attempt_id, question_id))`
- `proctor_events(id bigserial pk, attempt_id, type text, meta jsonb, at timestamptz default now())`  types: `tab_hidden, window_blur, fullscreen_exit, paste, copy, devtools, extend_time (by proctor), terminated (by proctor), note`
- `certificates(attempt_id pk, code text unique, issued_at)`
- `audit_logs(id bigserial pk, actor_id, action text, entity text, entity_id text, meta jsonb, at timestamptz default now())`
- Indexes on attempts(session_id), attempts(candidate_id), attempts(proctor_id), answers(attempt_id), proctor_events(attempt_id).

## Question JSON (lives in code; the generated bank never contains reference solutions)
```
{ id /* `<subject>-<difficulty>-<slug(title)>` */, subject_id /* slug */, subject_name, type, difficulty, title, statement, marks, time_mins, tags, config, tests }
```
Marks guideline: easy 10 (2–5 min), medium 20 (5–8 min), hard 30 (8–10 min).

### type = "coding"
```
config: { fn: { js: "sortArray", py: "sort_array", params: ["arr"] },
          languages: ["python","javascript"],
          constraints: ["..."], examples: [{ input:"[3,1,2]", output:"[1,2,3]", explanation?: "..." }],
          compare?: "exact" | "unordered",          // unordered => compare arrays as multisets
          float_tolerance?: 1e-6 }
tests:  [{ args: [ ...JSON values ], expected: <JSON>, hidden: false, weight?: 1 }]   // 5-8 tests, ~half hidden, include edge cases
```
Starter code is *generated* by the runner from `fn` (python: `def snake(params):\n    # write your code\n    pass`; js: `function camel(params) {\n  // write your code\n}`).
**Languages (updated):** Python (Pyodide), JavaScript and TypeScript run in the browser with full test-case marking. C, C++, Java, C#, Go, Rust, Ruby, PHP, Kotlin, Swift and Bash are **syntax-checked only** (tree-sitter, client-side, free) and earn full marks when the syntax is clean and the implementation is complete (4 equal checks); their answers carry `response.mode = "syntax_only"` so the review screen can label them as auto-marked by syntax check. All marking is automatic by the portal; there is no manual marking. `config.languages` is ignored. No execution server is used.
**Proctoring rules:** max 2 screen leaves (tab switch / blur / fullscreen exit); the 3rd auto-submits. Events: `screen_leave` (one per leave, counted server-side and returned as `attempt.screen_leaves`), `screenshot_attempt`, `paste`, `copy`, `devtools`, plus raw `tab_hidden` / `window_blur` / `fullscreen_exit`. `flag_count` = screen_leave + screenshot_attempt + paste + devtools.
The candidate must NOT use built-ins that trivialise the problem — state it in `statement`/`constraints` but we do not enforce.

### type = "sql"  (SQLite via sql.js)
```
config: { schema_sql: "CREATE TABLE ...;", ordered: false, constraints: [...] }
tests:  [{ setup_sql: "INSERT INTO ...;", expected: { columns: ["a","b"], rows: [[1,"x"], ...] }, hidden: false }]
```
Each test = fresh in-memory DB: run `schema_sql` + `setup_sql`, then candidate query; compare **row values** (ignore column names), order-insensitive unless `ordered:true`. Numbers compared with tolerance 1e-6.

### type = "nosql"  (MongoDB-style via `mingo`)
```
config: { mode: "aggregate" | "find", collection: "orders", ordered: false, constraints: [...] }
tests:  [{ data: [ {docs} ], expected: [ {docs} ], hidden: false }]
```
Candidate writes a JS object literal: `aggregate` → pipeline array `[ { $match: {...} }, ... ]`; `find` → `{ filter: {...}, projection: {...}, sort: {...}, limit: n }`. Evaluated with `new Function('return (' + code + ')')()`. Compare with deep-equal (order-insensitive unless `ordered`).

### type = "ui"  (Quick Dev / debug a broken UI, live preview)
```
config: { files: { "index.html": "...", "style.css": "...", "script.js": "..." },
          editable: ["index.html","style.css","script.js"], constraints: [...] }
tests:  [{ name: "Clicking + increments the counter", check: "<JS function body source returning truthy>", hidden: false }]
```
`index.html` includes `<link rel="stylesheet" href="style.css">` and `<script src="script.js"></script>`; runner inlines those. Preview in `<iframe sandbox="allow-scripts" srcdoc>`; a harness script injected into the srcdoc listens for `postMessage({type:'run-checks', checks:[{i, src}]})`, evaluates each `src` as an async function body (`new AsyncFunction(src)`) after DOMContentLoaded + 50ms, and replies `{type:'check-results', results:[{i, passed, error?}]}`. Checks use normal DOM (`document.querySelector(...).click()`).
Keep UI questions small (broken counter, form validation, todo toggle, tab switcher...). Lightweight, 5–8 min.

### type = "mcq"  (AI/ML scenario based)
```
config: { options: ["...","..."], multiple: false, correct: [1], scenario?: "optional longer scenario text" }
tests:  []
```
Scoring: single → all-or-nothing. multiple → `passed = max(0, correctPicked - wrongPicked)`, `total = correct.length`.

## Answer payloads (`answers.response`)
- coding: `{ language: "python"|"javascript", code: "..." }`
- sql / nosql: `{ code: "..." }`
- ui: `{ files: { "index.html": "...", ... } }`
- mcq: `{ selected: [idx,...] }`
Plus `tests_passed`, `tests_total` (computed in browser over **all** tests incl. hidden). Server computes `score = round(max_score * passed/total, 2)` with `max_score = question.marks`, clamping `passed<=total`. Weighted tests: browser reports weighted counts (`passed`/`total` may be weight sums).

## REST API (all JSON, `Authorization: Bearer <jwt>`; errors `{ error: "message" }` with proper status)
Auth
- `POST /api/auth/login {email,password}` → `{ token, user:{id,name,email,role} }`
- `GET  /api/auth/me` → `{ user }`
- `POST /api/auth/change-password {old_password,new_password}`
- `GET  /api/verify/:code` (public) → `{ valid, name, score, max, percentage, issued_at }`
- `GET  /api/health`

Shared (admin & proctor)
- `GET /api/subjects` → `[{id /*slug*/,name,description,question_count,by_difficulty:{easy,medium,hard}}]` from the in-code catalog (proctor: only assigned)

Admin (`/api/admin/*`, admin only)
- `GET /users?role=` → `[{id,name,email,role,active,proctor_id,proctor_name,created_at, subject_ids? (for proctors)}]`
- `POST /users {name,email,password?,role,proctor_id?}` → created user (+ `generated_password` if none given)
- `POST /users/bulk {role, proctor_id?, rows:[{name,email}]}` → `{created:[{name,email,password}], skipped:[{email,reason}]}`
- `PATCH /users/:id {name?,active?,password?,proctor_id?}`
- `PUT /proctors/:id/subjects {subject_ids:[slugs]}` (validated against the catalog). **Removed:** `POST /subjects` and all `/questions` CRUD. Questions are edited in `question-bank/` and read by the frontend directly.
- `GET /attempts?session_id=&proctor_id=&candidate_id=&status=` → `[{id, session_id, session_name, candidate_id, candidate_name, candidate_email, proctor_id, proctor_name, status, started_at, ends_at, submitted_at, duration_taken_sec, total_score, max_score, percentage, flag_count}]`
- `GET /stats` → `{ users:{admin,proctor,candidate}, questions, sessions, attempts:{total,submitted,in_progress}, avg_percentage, recent:[attempts...] }`
- `GET /audit?limit=100`

Proctor (`/api/proctor/*`, proctor + admin; proctor is scoped to own data, admin sees all)
- `GET  /candidates` → own candidates · `POST /candidates {name,email,password?}` (auto-assigned to self; returns `generated_password` if none) · `POST /candidates/bulk {rows}` · `PATCH /candidates/:id`
- `GET  /sessions` → `[{id,name,status,duration_mins,subject_config,candidate_count,submitted_count,in_progress_count,created_at}]`
- `POST /sessions {name,duration_mins,subject_config:[...],candidate_ids:[],opens_at?,closes_at?}` — validates subjects ⊆ proctor's subjects, candidates owned by proctor, and enough catalog questions exist per bucket (400 with a clear message otherwise)
- `GET  /sessions/:id` → `{ session, candidates:[{candidate_id,name,email,attempt:{id,status,started_at,ends_at,submitted_at,total_score,max_score,percentage,flag_count,answered}|null}] }`
- `PATCH /sessions/:id {status}` (open/closed)
- `GET  /attempts/:id` → full detail for review: attempt + candidate + session + proctor + events + `answers:[{question_id,title,type,difficulty,subject_name,marks,response,tests_passed,tests_total,score,max_score,time_spent_sec}]` (titles from the catalog; the frontend resolves statements/config/tests from the bank by `question_id`; unknown ids degrade to title "Unknown question")
- `POST /attempts/:id/extend {minutes, reason}` · `POST /attempts/:id/terminate {reason}` (force-submits with saved answers; status `terminated`)
- `GET  /monitor` → in-progress attempts of own sessions: `[{attempt_id, candidate_name, session_name, started_at, ends_at, seconds_left, answered, total_questions, flag_count, last_event}]`

Candidate (`/api/candidate/*`, candidate only)
- `GET  /sessions` → assigned & open sessions: `[{id,name,duration_mins,question_count,total_marks,proctor_name,status, attempt:{id,status,total_score?,max_score?}|null}]` (scores only when submitted)
- `POST /sessions/:id/start` → idempotent; creates attempt (once) and picks questions randomly per `subject_config` buckets; returns `{ attempt:{id,started_at,ends_at,status,screen_leaves}, server_now, question_ids:[ordered bank ids], bank_version, answers:{[question_id]:{response,tests_passed,tests_total}} }`. There is **no `questions` array**: the browser resolves ids against its bundled bank and should warn if `bank_version` differs from its own `BANK_VERSION`
- `GET  /attempts/:id` → same shape as start (resume; `question_ids`/`answers` are empty once submitted). 403 if not owner. If time over & still in_progress → server finalizes (auto_submitted) and returns status.
- `PUT  /attempts/:id/answers/:questionId {response,tests_passed,tests_total,time_spent_sec}` → `{ ok:true, server_now, ends_at }` (400 if the id is not one of the attempt's `question_ids`; score = round(catalog marks x passed/total, 2); rejected 409 if submitted; allowed up to 45 s after ends_at)
- `POST /attempts/:id/events {type,meta?}` → `{ ok:true }` (increments flag_count for screen_leave/screenshot_attempt/paste/devtools)
- `POST /attempts/:id/submit {answers?:[{question_id,response,tests_passed,tests_total,time_spent_sec}], auto?:bool}` → finalizes in a transaction (idempotent; second call returns same result) → `{ status, total_score, max_score, percentage }`
- `GET  /attempts/:id/result` → `{ candidate_name, session_name, submitted_at, total_score, max_score, percentage, grade, by_subject:[{subject,score,max}], certificate_code }` (only when submitted; **no** answers/code)
Grade: ≥80 Excellent, ≥60 Good, ≥40 Fair, else Needs Improvement. Certificate code like `HPAI-2026-XXXXXX` created on submit.

## Concurrency notes
Submit/answers are idempotent upserts; `unique(session_id,candidate_id)`; finalize inside a transaction with `UPDATE ... WHERE status='in_progress' RETURNING`; server clock is authoritative for `ends_at`; pg Pool (max ~10) for Supabase pooler.

## Repo layout
```
question-bank/ source of truth for all questions (q_coding.js, q_other.js, gen/, questions.js, validate*.js, build.js)
backend/  src/(index.js, db.js, auth.js, catalog.js, catalog.generated.js, routes/*.js, util.js) sql/(schema.sql, migrations/) scripts/(migrate.js, seed.js) .env.example
frontend/ index.html vite.config.js src/(main.jsx, App.jsx, api.js, bank/questions.generated.js, styles.css, components/, pages/{admin,proctor,candidate}/, runners/, utils/) public/(logo.png, workers/)
vercel.json (root)  render.yaml (root)  legacy/ (old prototype)
```

## One-time invite links (tester IDs)
Proctors can share a unique, **single-use** link per tester instead of (or besides) email/password accounts.
- Table `invites(id, token_hash UNIQUE, tester_id, session_id, proctor_id, label, expires_at, used_at, revoked_at, attempt_id, candidate_id, purpose 'start'|'resume', replaced_by, created_at)`; `attempts.tester_id`. Only the **sha256 hash** of the 192-bit token is stored; the plaintext token is returned once (at create/reissue). `tester_id` = `HPAI-T-XXXXXX` (no 0/O/1/I), unique among live invites (partial unique index on `replaced_by IS NULL`); a reissued link keeps the same tester id.
- Proctor/admin (`/api/proctor`): `POST /sessions/:id/invites {count?|names?[], expires_hours?(1-168, default 24)}` → `{invites:[{id,tester_id,label,token,expires_at}]}` · `GET /sessions/:id/invites` (no tokens; `status` = unused|used|expired|revoked, attempt summary) · `POST /invites/:id/revoke` (unused only) · `POST /invites/:id/reissue` (unused/expired/revoked → new start link; used + attempt in progress → one-time `resume` link for the same attempt). Session must be open. `candidate_ids` is optional when creating a session (invite-only sessions).
- Public (`/api/invite`, rate-limited per IP): `GET /:token` → `{status: valid|used|expired|revoked|closed|invalid, session, tester_id, purpose}` · `POST /:token/redeem {name,email?}` → one transaction (`SELECT … FOR UPDATE`): marks used, creates the candidate user (unusable password, placeholder email `<tester_id>@invite.hpai.local` unless a free email is given), enrols them, creates the attempt via the shared `createAttemptFor()` and returns `{token (JWT valid until attempt end + 3h), user, attempt, tester_id}`. Second redeem → **410**. `resume` links re-issue a JWT for the existing in-progress attempt.
- `tester_id` is exposed in: attempts lists (admin/proctor), session detail, live monitor, review detail, candidate result payload, CSV exports.
- Frontend: public route `/t/:token` (`pages/Invite.jsx`, rules from `components/TestRules.jsx`), proctor `components/InvitePanel.jsx` on the session detail page.

## Question bank in code
- **Source of truth:** `question-bank/` (hand-authored `q_coding.js`, `q_other.js` generated from `gen/author_*.js`, and the `questions.js` index). Dev-only `reference` solutions live there for the validators and are **never emitted**.
- **Ids:** every question gets a stable id `<subjectSlug>-<difficulty>-<slug(title)>` (uniqueness asserted). Renaming a title changes its id, so treat ids as permanent once attempts exist.
- **Build:** `npm run build-bank` (in `question-bank/`, or from the repo root) writes two committed files that share one `BANK_VERSION` (sha1 of ids + marks + tests):
  - `frontend/src/bank/questions.generated.js` exports `BANK_VERSION`, `SUBJECTS`, `QUESTIONS` (full: statement/config/tests).
  - `backend/src/catalog.generated.js` exports `BANK_VERSION`, `SUBJECTS`, `CATALOG` (id, subject, type, difficulty, title, marks, time_mins, tags only).
  The generator fails if a `reference` / `solution` key would be emitted.
- **Backend** resolves marks, titles and subject names through `backend/src/catalog.js` (`pickQuestions`, `countBucket`, `listSubjectsWithCounts`, `estimateSession`, `questionById`). The DB stores only ids, responses, scores, timings and events.
- **Add / change a question:** edit the `question-bank/` sources (or `gen/author_*.js` for SQL/NoSQL/UI/MCQ, then `npm run gen-other`), `npm run validate`, `npm run build-bank`, commit the two generated files, and deploy frontend **and** backend together (marks/ids must match; the client should surface a `bank_version` mismatch).
- **Trade-off:** tests and expected outputs ship to the browser (marking is client-side by design), so a determined candidate can read them from the bundle. Solutions are never shipped.

## Sealed question bank (answers need a code)
The frontend bundle contains every question, but **answers are encrypted**. Public fields (statement, constraints, examples, marks, time, tags, config without `correct`, `public_tests` = sample tests only, `test_count`) are in clear. Hidden tests, MCQ `correct` and UI check sources live in `sealed:{iv,ct}` = AES-256-GCM.
- Key per question = `HMAC-SHA256(BANK_MASTER_KEY, 'hpai-bank-v1:' + questionId)`. `BANK_MASTER_KEY` (64 hex) is **only** in env: `backend/.env` locally, Render env in production, and read by `question-bank/build.js` from the same place. Changing it requires `npm run build-bank` and a redeploy of both sides.
- Candidate: `start` / `GET /candidate/attempts/:id` / invite redeem → attempt payload includes `bank_keys:{[questionId]:base64Key}` for exactly the attempt's `question_ids`, **only while in progress** (empty after submit). The browser unseals them (WebCrypto) and marks as before.
- Admin: `POST /api/admin/bank-keys {password, question_ids?}` re-verifies the admin's password (the "code"), returns keys with `Cache-Control: no-store`; 403 `Incorrect code` on failure; 5 attempts/minute and a 15-minute lock after 5 consecutive failures (in-memory per process); audit actions `bank_keys_revealed` / `bank_keys_denied`. Proctors/candidates get 403. The Admin → Question bank page has a **Reveal answers** modal; keys live in memory for 10 minutes only.
- Proctor: sees public fields only (`/proctor/questions`, session wizard picker); never receives keys.
- Limits (honest): a candidate necessarily holds keys for their own questions during their attempt; anyone with the admin password, or the master key, can open everything. Sample tests are public by design. Without server-side marking this is the strongest protection available.

## Sessions: fixed / random / mix
`sessions.fixed_question_ids jsonb` (default `[]`). `POST /proctor/sessions` accepts `fixed_question_ids` and `subject_config` (either may be empty, not both). Fixed ids must exist and belong to the proctor's subjects; random buckets exclude fixed ids and are checked for enough remaining questions. Attempt `question_ids` = fixed ∪ random, ordered by subject then easy→hard. Session list/detail return `fixed_question_ids`.

## Proctor New-session wizard (propose -> review/swap -> time after questions)
Steps: Basics (name, candidates, optional window; no duration) -> Subjects (per-subject easy/medium/hard counts with availability; paper type) -> Review paper -> Time -> Summary.
- **Same paper for everyone** (default): the random proposal is drawn client-side from the PUBLIC bank (`frontend/src/pages/proctor/wizardUtils.js`), grouped by subject. Per question: Preview, Keep (locks it against "Shuffle all unlocked"), Shuffle (same subject + level), Replace... (picker, any level), Remove; per subject "+ Add"; global "+ Add question". Create sends `fixed_question_ids` (ordered subject -> easy..hard) and `subject_config: []`.
- **Different random set per candidate**: no review step; create sends `subject_config` only.
- **Duration is chosen after the questions**: suggested = `max(10, ceil(sum(time_mins) * 1.2 / 5) * 5)` (random path: estimated from bucket averages); editable, with a warning when shorter than the total question time.
- Files: `pages/proctor/NewSession.jsx`, `components/PaperReview.jsx` (review + picker), `pages/proctor/wizardUtils.js`, `pages/proctor/wizard.css`. The wizard only reads public question fields; no keys or unseal code.

## Bulk links, live board & limits (smart multi-candidate sessions)
Cap: `MAX_CANDIDATES_PER_SESSION` (env, default 50) — one constant for every limit below; `GET /api/proctor/limits` -> `{ max_candidates_per_session }`.
The cap counts used links + live links (unused, not revoked, not expired) + directly assigned candidates; over the cap -> 400 `A session can have at most 50 candidates (you already have 38; you can add 12 more)`.
- Schema (additive): `invites.email`, `invites.opened_at`, `invites.open_count`, `invites.name_locked` + indexes.
- `POST /proctor/sessions/:id/invites {count? | names? | people?:[{name,email?}], expires_hours?, name_locked?}` -> one multi-row insert; `{invites:[{id,tester_id,label,name,email,token,expires_at}]}` (tokens shown once). `GET /proctor/sessions/:id/invites` additionally returns `name,email,opened_at,open_count,name_locked`.
- `POST /proctor/sessions` also accepts `candidate_count` or `people:[{name,email?}]` (+ `expires_hours`, `name_locked`): links are created in the same transaction and returned as `invites:[…with token]` next to the session fields; zero candidates stays valid; `candidate_ids` remains optional.
- Public `GET /api/invite/:token`: records the view (`opened_at`, `open_count`) and returns `status: valid | not_open_yet | closed | used | expired | revoked | invalid`, plus `prefill:{name,email,locked}`, `opens_at`, `closes_at`, `server_now`. Redeem before `opens_at` -> 409; a `name_locked` invite ignores the browser's name/email.
- `GET /proctor/sessions/:id/live` -> `{server_now, session:{id,name,status,duration_mins,opens_at,closes_at,total_questions,total_marks}, counts:{total,not_opened,opened,in_progress,submitted,expired,revoked}, rows:[{invite_id,tester_id,name,email,status,opened_at,started_at,ends_at,seconds_left,answered,total_questions,flag_count,screen_leaves,last_activity_at,attempt_id,total_score,max_score,percentage}]}`. One aggregated query set, 2 s server cache, **ETag / If-None-Match -> 304** (ETag ignores `server_now` / `seconds_left`). Same ETag support on `GET /proctor/monitor`.
- `POST /proctor/sessions/:id/bulk {action}`: `extend {minutes 1..60, reason, attempt_ids?}`, `revoke_unused`, `regenerate_unused {expires_hours?}` (same tester ids, tokens returned once), `remove_inactive`, `close` -> `{ok, action, affected, invites?}`.
- **Removing dead links** (never-used links only): `DELETE /proctor/invites/:id` permanently deletes a link that was never redeemed (`used_at` and `attempt_id` NULL) and is revoked, replaced or expired, together with its never-used reissue predecessors (`replaced_by` is a plain column, no FK). Active links -> 409 "revoke it first"; used links and resume links (tied to an attempt) -> 409; other proctor's link -> 404; audit `invite.remove`. `bulk {action:'remove_inactive'}` does the same for the whole session in ONE statement -> `{ok, affected (links visible on the board), rows_deleted}`; audit `invite.remove_inactive`. Used links, attempts and results are never deleted. Removal changes the live board payload (so its ETag) and does not affect the candidate cap (dead links never counted). The live board hides revoked/expired rows by default (toggle chip "Show revoked / expired (N)"; the "Expired / revoked" filter chip still shows them), with per-row **Remove** and a bulk **Remove revoked & expired links (N)** action.
- Candidate batching: `PUT /candidate/attempts/:id/answers {answers:[…≤20]}` -> `{ok,saved,skipped,server_now,ends_at}` (one multi-row upsert, unchanged rows skipped); `POST /candidate/attempts/:id/events/batch {events:[{type,meta,at}]≤50}` -> `{ok,stored}` (dedupe consecutive repeats; non-critical events capped at 300 and critical ones — screen_leave/screenshot_attempt/paste/devtools — at 100 per attempt, extra dropped silently). The single-answer and single-event routes still work.
- `GET /api/admin/runtime` (admin only): `{rss_mb,heap_mb,cpu_user_ms,cpu_system_ms,event_loop_lag_ms:{p50,p99,max},pool:{total,idle,waiting},bcrypt:{active,queued},uptime_s,requests_total,requests_per_min}`.
- Invite-created candidates get a non-bcrypt unusable password marker (`!…`); bcrypt only runs for real logins / password changes / account creation, through a 2-slot limiter.
- Capacity numbers, the Render free-tier CPU budget, frontend batching recommendations and the drive-day checklist: `docs/CAPACITY.md`. Scripts: `npm run loadtest`, `npm run test:bulk` (in `backend/`).

### Frontend flows for bulk sessions (implemented)
- **Wizard / Basics** (`pages/proctor/NewSession.jsx`, `components/PeopleInput.jsx`, `utils/people.js`): "How many candidates?" stepper (0..cap-existing, cap read from `GET /proctor/limits`), optional pasted / uploaded CSV list (`name,email` or `name`; header row skipped; duplicate emails dropped; bad lines block *Next* until fixed; with a list the count = valid lines), "lock the name" toggle, link expiry (1 h–7 d). The cap is validated client-side with the API's wording before `POST /proctor/sessions {candidate_count | people, name_locked, expires_hours}`. Existing candidate accounts are a secondary, collapsed option and count towards the cap.
- **Links ready** (`components/LinksReady.jsx`): shown **once**, in component state only (nothing sensitive in localStorage / history): per-row Copy, Copy all, Copy selected (release in waves), CSV (`tester_id,name,email,link,expires`), printable sheet (`body.printing-links` print CSS, one card per link), Mail / WhatsApp buttons (plain `mailto:` / `wa.me` URLs, no external calls). Reused for *Add links*, *Regenerate unused*, *Reissue* and *Resume link* on the board.
- **Live board** (`components/LiveBoard.jsx`, used by `pages/proctor/SessionDetail.jsx`): counter chips that double as filters (Total / Not opened / Opened / In progress / Submitted / Expired-revoked / Needs attention), search (name, email, Tester ID), sortable columns, 25-row pages, smart highlights (opened > 10 min but not started, idle > 5 min, >= 2 screen leaves, >= 3 flags), row actions (Review, +Time, Resume link, Revoke, Reissue), selection + bulk bar (Extend time for selected / all in progress with a required reason, Revoke unused, Regenerate unused, Add links, Close session, Export results CSV). Polling: `GET /proctor/sessions/:id/live` every 10 s with `If-None-Match` (304 = no re-render), paused while the tab is hidden, immediate refresh when visible again, exponential backoff with jitter on errors; countdowns are computed locally from `ends_at` + the server clock offset in their own 1 s components. **The API must expose the `ETag` header via CORS** (`exposedHeaders: ['ETag']` in `backend/src/index.js`) or cross-origin browsers cannot read it.
- **Invite page** (`pages/Invite.jsx`): prefilled / read-only name+email when the link is locked, `not_open_yet` state with a live countdown against the server clock that flips to the start form by itself, friendly used / expired / revoked / closed states, and "Waking up the server…" with automatic retries (`utils/wake.js`, ~90 s) for the first request (also used by the login page; the one-time redeem POST is never auto-retried).
- **Candidate batching** (`pages/candidate/TestRunner.jsx`, `utils/eventQueue.js`, `utils/proctoring.js`): answers are graded in the browser as soon as a question is left, parked, and sent in **one** `PUT /candidate/attempts/:id/answers` every 45–60 s (+ up to 10 s jitter on the first tick), only if the graded payload changed (hash compare, <= 20 per call); explicit *Save*, submit/auto-submit and `pagehide` (keepalive) also flush. Failures back off exponentially with jitter and the drafts stay in localStorage. Integrity events are queued and sent via `POST .../events/batch` every 15 s (screen_leave / screenshot_attempt immediately, keepalive flush on page hide). The timer is re-synced from `server_now`/`ends_at` returned by saves, plus a `GET attempt` only if no save refreshed it for ~5 min (e.g. the proctor extended the time).
