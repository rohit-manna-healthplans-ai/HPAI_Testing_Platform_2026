# Interactive question types (v1.1 work) - shared contract

Three new question types, all **drag & drop**, all marked **in the browser** with partial credit, all **sealed** like the rest of the bank
(candidates get the keys only for their own questions; proctors never see answers). Every NEW question must take the candidate
**2-4 minutes** (`time_mins` 2..4). Existing questions are NOT modified.

Subjects added: `mlflow` "ML Workflow (Drag & Drop)" and `cloud` "Cloud (AWS, Azure, GCP)" (registered in `question-bank/questions.js`).
Sources: `question-bank/q_ml.js` (`export const ml`), `q_cloud.js` (`export const cloud`), `q_coding2.js` (`export const coding2`, subject `Programming (DSA)`).
Marks by level (same as before): easy 10, medium 20, hard 30. Rule of thumb: <= 3 min -> easy/10, 4 min -> medium/20 (coding "hard" = 4 min -> 30).

## Scoring model (same server rule as everywhere)
`question score = round(marks x passed / total, 2)`. For interactive types `total` = number of scoring units and `passed` = units satisfied.
No "Run" button for these types (the candidate must not be told what is right): the answer autosaves; grading happens at leave/submit like other types.

## Source format (question-bank, dev-only `reference` holds the answer and is NEVER emitted)
Every source object: `{ subject, type, difficulty, title, statement, marks, time_mins, tags, config, reference }` (no `tests` - the generator derives them).

### type `sequence`  (ordering steps, ML pipelines)
```
config: {
  scenario: "short scenario text; **bold** and `code` allowed",
  items: [{ id:'s1', label:'Load the dataset', detail:'pd.read_csv("houses.csv")', stage:'data' }, ...],
      // PUBLIC order = shuffled by the author. Generator asserts it differs from the canonical order.
  stages: [{ id:'data', label:'Data' }, { id:'clean', label:'Clean' }, { id:'features', label:'Features' },
           { id:'split', label:'Split' }, { id:'model', label:'Model' }, { id:'evaluate', label:'Evaluate' }, { id:'deploy', label:'Ship' }],
      // used to draw the live pipeline diagram; each item has a `stage`
  visual: { kind: 'scatter-regression' | 'confusion-matrix' | 'loss-curve' | 'data-split' | 'none', ...params }   // see Visual kinds
}
reference: {
  order: ['s1','s2',...],                 // one canonical valid order
  constraints: [['s1','s2'], ['s6','s8'], ...]   // [a,b] = step a must come BEFORE step b. These are the scoring units.
}
```
Constraints must be satisfied by `reference.order`, and should allow every genuinely valid alternative order (e.g. encoding before OR after the split,
but scaler fitted after the split). Provide >= n-1 constraints so doing nothing scores 0 and random order scores low. Typical: 10-18 constraints for 8-12 items.
Response: `{ order: ['s3','s1',...] }` (ids placed in the sequence area, in order; unplaced items are simply absent).
Marking `markSequence(q,response)` is **chance-corrected**: a constraint is *satisfied* iff both ids are placed and index(a) < index(b); the result reports
`total = constraints.length`, `satisfied = <raw count>` (extra field, staff debugging only) and **`passed = max(0, 2*satisfied - total)`**, so the server's
`marks x passed/total` = `marks x max(0, 2*s/t - 1)`: a perfect order = 100%, a random permutation ~ 8-9%, reversed / nothing placed = 0 (a raw rate would have given ~50% for dragging cards in any order).
`results[]` still has one hidden entry per constraint (`passed` = that constraint satisfied). `markMatch` / `markArchitecture` are plain `passed = units satisfied`.
`validate_interactive.js` fails a question whose random-permutation average (corrected) exceeds 20% - add constraints until it does not.

### type `match`  (match services to descriptions)
```
config: {
  scenario: "optional one-liner",
  left:  [{ id:'L1', label:'Amazon S3', kind:'storage', provider:'aws' }, ...],      // draggable chips (service names); public order shuffled
  right: [{ id:'R1', text:'Object storage for files, images and backups' }, ...]       // drop targets (descriptions); public order shuffled; may include distractors
}
reference: { pairs: { L1:'R1', L2:'R4', ... } }       // scoring units = number of left items (every left item has exactly one correct right)
```
Response `{ pairs: { L1:'R1', ... } }` (a right target holds at most one chip). `total = number of left items`.

### type `architecture`  (build a simple cloud architecture on a canvas)
```
config: {
  provider: 'aws' | 'azure' | 'gcp' | 'generic',
  scenario: "what to build, one or two sentences",
  palette: [{ id:'p1', label:'Application Load Balancer', kind:'lb', provider:'aws' }, ...],   // draggable services incl. 2-4 distractors; public order shuffled
  zones: [{ id:'z1', label:'Public edge', x:2, y:4, w:30, h:90 }, ...],                     // optional background bands, canvas coordinates 0..100
  slots: [{ id:'a1', label:'Static files', x:10, y:20, w:16, h:18 }, ...],                  // drop slots; x,y,w,h in the same 0..100 canvas space
  links: [{ from:'a1', to:'a2', label:'HTTPS' }, ...]                                        // arrows drawn between slots (visual only)
}
reference: { solution: { a1: ['p1'], a2: ['p3','p9'], ... } }     // slot -> list of ACCEPTABLE palette ids (allow equivalents)
```
Scoring units = number of slots (`total = slots.length`); a slot is correct iff the placed palette id is in its acceptable list. Response `{ placed: { a1:'p1', ... } }`.

## Unsealed question shape (what the runners see after the key arrives)
Public bank entry fields stay as today (`id, subject_id, subject_name, type, difficulty, title, statement, marks, time_mins, tags, config`),
plus `test_count` (= scoring units) and `sealed:{iv,ct}`. After `unseal`, the question also has **`solution`** (the `reference` object above) and `tests`
(an array with one entry per scoring unit, e.g. the constraint pairs). Public/proctor views NEVER have `solution` or `tests`; for these types `public_tests` is `[]`.
Marking lives in `frontend/src/runners/interactive.js`: `markSequence`, `markMatch`, `markArchitecture`, `markInteractive(question, response)` -> `{ passed, total, results:[{index,name,passed,hidden:true}] }`
(used by `runners/index.js::runQuestion`). `empty response => passed 0`.

### What the generator does (`question-bank/interactive.js`, used by `build.js` and the validators)
- **Opaque ids.** Authors may use readable ids (`s1`, `L1`, `a1`, `p1`...). The generator rewrites every id in `items`, `left`, `right`, `palette`, `slots` (and `links`, `solution`, `constraints`, `pairs`)
  into an opaque id (`i`/`l`/`r`/`p`/`s` + a hash of questionId|kind|authored id), otherwise numbering such as `s1,s2,...` or `L1 -> R1` would leak the answer from the public bank. `stages[].id` is NOT remapped (public legend).
- **Deterministic shuffle.** Public `items` / `left` + `right` / `palette` are shuffled (seeded by the question id) until at most `floor(n/3)` entries sit in their answer position, so authors may write lists in any order.
- **Units** (`tests`, sealed together with `solution`): sequence `{ before, after }`, match `{ left, right }`, architecture `{ slot, accept:[ids] }`. `test_count` (public) = number of units.
- **Authoring checks** (build fails with a clear message): ids unique and known; `reference.order` is a permutation satisfying every constraint, no contradicting/duplicate constraints, >= n-1 constraints, every item in at least one constraint,
  no "Step 3"-style numbering in labels; match: every left has a distinct existing right, `right.length >= left.length`; architecture: provider, 3..10 slots inside the 0..100 canvas, every slot has acceptable services that exist,
  at least 2 distractor services in the palette; `time_mins` 2..4; no answer-ish keys (`reference`, `solution`, `order`, `constraints`, `pairs`, `accept`, `before`, `after`) in `config`; authors must not write `tests`.
- **Leak assertions + seal round-trip** run on every question (no scoring unit / canonical order / answer key readable in the shipped bank; decrypt with the derived key works, a wrong key fails).
- `BANK_VERSION` for these types also hashes the public config (the sealed units refer to the opaque ids inside it); for older types it is computed exactly as before.
- `q_coding2.js` questions (subject DSA, type coding) are asserted to have `time_mins` 2..4 and **exactly 10 tests: tests 1-3 visible, tests 4-10 `hidden: true`**.

### Helpers the UI can import from `frontend/src/runners/interactive.js` (also re-exported from `runners/index.js`)
`INTERACTIVE_TYPES`, `isInteractiveType(type)`, `markInteractive(question, response)` (throws if the question is still sealed), `markSequence/markMatch/markArchitecture(question, response)`,
`defaultInteractiveResponse(question)`, `isInteractiveAnswered(question, response)`, `interactiveProgress(question, response) -> { done, total }` (works on the PUBLIC config, so the "7 of 12 placed" label works while sealed),
`unitsOf(question)`. `runners/index.js::defaultResponse / isAnswered / totalTests / runQuestion` already handle the three types. `bank/index.js::unsealQuestion` restores `tests` (units) and `solution`.

### Dev tooling
`npm run validate` (in `question-bank/`) now runs every `validate_*.js` and `test_*.js` in the folder, including `validate_interactive.js` (fixtures in `fixtures/interactive.js` + all real interactive questions: reference = 100%, empty = 0,
reversed/partial < 100%, random-permutation average < 20% corrected, alternative valid orders = 100%, opaque ids, public order not aligned) and `test_interactive.js` (marking edge cases + authoring-check rejections).
After the new backend is live, grant the new subjects to existing proctors: `npm run grant-new-subjects` (dry-run) then `npm run grant-new-subjects -- --apply` in `backend/`.

## Visual kinds for `config.visual` (sequence questions; all pure inline SVG, HPAI colours, animated on mount, responsive)
- `scatter-regression`: `{ title, xLabel, yLabel, points:[[x,y],...<=40], line:{m,b}|null }` (line drawn when present)
- `confusion-matrix`: `{ title, labels:['Denied','Approved'], matrix:[[TN,FP],[FN,TP]] }` (heat-tinted cells with counts)
- `loss-curve`: `{ title, xLabel, yLabel, series:[{ name, values:[...] }] }` (e.g. train vs validation)
- `data-split`: `{ title, segments:[{ label, percent, tone:'sky'|'blue'|'green'|'navy' }] }`
- `none`
The **live pipeline diagram** is always drawn from `config.stages` and the items currently placed in the sequence: each placed item lights its stage (conveyor / chevron bar) and the sequence area shows numbered cards joined by animated arrows.

## Cloud icons (generic, NOT official logos)
Provider-tinted rounded squares with a simple glyph chosen by `kind`: `users, cdn, dns, lb, compute, container, function, storage, db-sql, db-nosql, cache, queue, api-gateway, monitoring, identity, network, analytics, ml, secrets, search, firewall, email`.
Tints: aws warm amber, azure blue, gcp multi-hue sky/green/red accents, generic navy. Service names are shown as text labels.

## UI requirements (all three)
Pointer-events drag & drop that works with mouse, touch and pen; keyboard-accessible alternative (focus a card, Enter/Space to pick up, arrows or the explicit up/down/"place in slot" controls); no heavy library (a custom implementation or `@dnd-kit/core` if < ~15 KB gzip is acceptable);
lazy-loaded chunk (not in the entry bundle); responsive down to 390 px (stack layout; canvas scales); `prefers-reduced-motion` respected; "Reset" button; autosave through the existing `onChange` path; show placement progress ("7 of 12 placed") but never correctness.
Admin question-bank viewer and proctor paper preview must render the three types from the PUBLIC fields (proctor: no answers); admin after "Reveal answers" shows the correct order / pairs / slot solution.

## Syntax-checked languages (internal only, v1.1)
The browser still marks C, C++, Java, C#, Go, Rust, Ruby, PHP, Kotlin, Swift and Bash by syntax checks, and the saved response keeps `mode: 'syntax_only'`.
This is now **not disclosed in any candidate/proctor-facing UI, video or guide**; it stays visible only in the database (`answers.response.mode`) and as a subtle staff marker in the attempt review.
Internal documentation (this file, ARCHITECTURE.md) may describe it.

## Deploy caution
`BANK_VERSION` changes when questions are added: deploy backend first, then frontend, while no test is running (a mid-test candidate gets the "please refresh" message).
New subjects (`mlflow`, `cloud`) must be granted to existing proctors AFTER the new backend is live: `backend/scripts/grant-new-subjects.js` (idempotent; run once post-deploy).
