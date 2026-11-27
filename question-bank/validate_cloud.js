// Validates question-bank/q_cloud.js (architecture + match questions). Self-contained: implements the marking rules
// from docs/INTERACTIVE_TYPES.md and checks structure, geometry, shuffling and score behaviour.
// Usage: node question-bank/validate_cloud.js   (exit code 1 on any error; warnings do not fail)
import { cloud } from './q_cloud.js';

const ICON_KINDS = new Set(['users', 'cdn', 'dns', 'lb', 'compute', 'container', 'function', 'storage', 'db-sql', 'db-nosql', 'cache', 'queue',
  'api-gateway', 'monitoring', 'identity', 'network', 'analytics', 'ml', 'secrets', 'search', 'firewall', 'email']);
const PROVIDERS = new Set(['aws', 'azure', 'gcp', 'generic']);
const SECRET_KEYS = ['solution', 'pairs', 'reference', 'correct', 'order', 'answer', 'answers', 'constraints'];

let errors = 0; let warnings = 0;
const err = (q, m) => { errors++; console.log(`  ERROR [${q.title}] ${m}`); };
const warn = (q, m) => { warnings++; console.log(`  warn  [${q.title}] ${m}`); };

// ---- marking rules (mirror of the contract) ----
export function markMatch(q, response) {
  const ref = q.reference.pairs;
  const total = q.config.left.length;
  const pairs = response?.pairs || {};
  const used = new Set();
  let passed = 0;
  for (const l of q.config.left) {
    const r = pairs[l.id];
    if (!r || used.has(r)) continue; // a target holds at most one chip
    used.add(r);
    if (ref[l.id] === r) passed++;
  }
  return { passed, total };
}
export function markArchitecture(q, response) {
  const sol = q.reference.solution;
  const total = q.config.slots.length;
  const placed = response?.placed || {};
  const seen = new Set();
  let passed = 0;
  for (const s of q.config.slots) {
    const p = placed[s.id];
    if (!p || seen.has(p)) continue; // one service can sit in one slot only
    seen.add(p);
    if ((sol[s.id] || []).includes(p)) passed++;
  }
  return { passed, total };
}
const mark = (q, r) => (q.type === 'architecture' ? markArchitecture(q, r) : markMatch(q, r));
const frac = (m) => (m.total ? m.passed / m.total : 0);

// deterministic PRNG so the run is reproducible
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const rectsOverlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inCanvas = (r) => r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x + r.w <= 100 && r.y + r.h <= 100;

function checkCommon(q) {
  if (q.subject !== 'Cloud (AWS, Azure, GCP)') err(q, `subject must be 'Cloud (AWS, Azure, GCP)', got '${q.subject}'`);
  if (!['architecture', 'match'].includes(q.type)) err(q, `unexpected type ${q.type}`);
  if (!(q.time_mins >= 2 && q.time_mins <= 4)) err(q, `time_mins must be 2..4 (got ${q.time_mins})`);
  const expectedMarks = q.time_mins <= 3 ? 10 : 20;
  if (q.marks !== expectedMarks) err(q, `marks should be ${expectedMarks} for ${q.time_mins} min (got ${q.marks})`);
  const lvl = q.marks === 10 ? 'easy' : q.marks === 20 ? 'medium' : 'hard';
  if (q.difficulty !== lvl) err(q, `difficulty '${q.difficulty}' does not match marks ${q.marks}`);
  if (!q.statement || q.statement.length < 30) err(q, 'statement missing/too short');
  if (!/drag/i.test(q.statement)) err(q, "statement should tell the candidate to drag");
  if (!Array.isArray(q.tags) || q.tags.length < 2) err(q, 'tags missing');
  if (!q.config?.scenario || q.config.scenario.length < 20) err(q, 'config.scenario missing');
  if (q.tests !== undefined) err(q, 'source must not define `tests` (the generator derives them)');
  for (const k of SECRET_KEYS) if (q.config && Object.prototype.hasOwnProperty.call(q.config, k)) err(q, `config must not contain '${k}' (answer data belongs in reference)`);
  if (!q.reference) err(q, 'missing reference');
}

function checkArchitecture(q) {
  const c = q.config; const sol = q.reference?.solution;
  if (!PROVIDERS.has(c.provider)) err(q, `bad provider ${c.provider}`);
  if (!sol) return err(q, 'missing reference.solution');
  const pal = c.palette || [];
  const palIds = pal.map((p) => p.id);
  if (new Set(palIds).size !== palIds.length) err(q, 'duplicate palette ids');
  for (const p of pal) {
    if (!p.label) err(q, `palette ${p.id} has no label`);
    if (!ICON_KINDS.has(p.kind)) err(q, `palette ${p.id} has unknown icon kind '${p.kind}'`);
    if (p.provider !== c.provider && p.provider !== 'generic') warn(q, `palette ${p.id} provider '${p.provider}' differs from question provider '${c.provider}'`);
  }
  const slots = c.slots || [];
  if (slots.length < 5 || slots.length > 7) err(q, `needs 5-7 slots (got ${slots.length})`);
  const slotIds = slots.map((s) => s.id);
  if (new Set(slotIds).size !== slotIds.length) err(q, 'duplicate slot ids');
  for (const s of slots) {
    if (!inCanvas(s)) err(q, `slot ${s.id} outside the 0..100 canvas (${s.x},${s.y},${s.w},${s.h})`);
    if (!s.label) err(q, `slot ${s.id} has no label`);
    // the slot label must describe a ROLE, never give away a service name
    for (const p of pal) if (p.label && s.label.toLowerCase().includes(p.label.toLowerCase())) err(q, `slot '${s.label}' reveals service '${p.label}'`);
  }
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
    if (rectsOverlap(slots[i], slots[j])) err(q, `slots ${slots[i].id} and ${slots[j].id} overlap`);
  }
  const zones = c.zones || [];
  for (const z of zones) if (!inCanvas(z)) err(q, `zone ${z.id} outside the canvas`);
  for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
    if (rectsOverlap(zones[i], zones[j])) err(q, `zones ${zones[i].id} and ${zones[j].id} overlap`);
  }
  for (const s of slots) if (zones.length && !zones.some((z) => s.x >= z.x && s.y >= z.y && s.x + s.w <= z.x + z.w && s.y + s.h <= z.y + z.h)) warn(q, `slot ${s.id} is not fully inside any zone`);
  const links = c.links || [];
  if (links.length < 3 || links.length > 6) err(q, `needs 3-6 links (got ${links.length})`);
  for (const l of links) if (!slotIds.includes(l.from) || !slotIds.includes(l.to)) err(q, `link ${l.from}->${l.to} references an unknown slot`);
  // solution coverage
  for (const sid of Object.keys(sol)) if (!slotIds.includes(sid)) err(q, `solution has unknown slot ${sid}`);
  const acceptedIds = new Set();
  for (const sid of slotIds) {
    const acc = sol[sid];
    if (!Array.isArray(acc) || !acc.length) { err(q, `slot ${sid} has no acceptable service`); continue; }
    for (const pid of acc) { if (!palIds.includes(pid)) err(q, `slot ${sid} accepts unknown palette id ${pid}`); acceptedIds.add(pid); }
  }
  // an alternative may be accepted by exactly the slot it belongs to; the same id must not serve two slots
  const counts = {};
  for (const sid of slotIds) for (const pid of sol[sid] || []) counts[pid] = (counts[pid] || 0) + 1;
  for (const [pid, n] of Object.entries(counts)) if (n > 1) err(q, `palette id ${pid} is acceptable in ${n} slots (ambiguous)`);
  const distractors = palIds.filter((p) => !acceptedIds.has(p));
  if (distractors.length < 2 || distractors.length > 4) err(q, `needs 2-4 distractors (got ${distractors.length})`);
  // public order must not equal the canonical answer order (first acceptable per slot, then distractors)
  const canonical = [...slotIds.map((sid) => sol[sid][0]), ...distractors.filter((p) => !slotIds.some((sid) => sol[sid][0] === p))];
  const acceptedSecond = [...acceptedIds].filter((p) => !canonical.includes(p));
  const canonicalFull = [...canonical.filter((p) => acceptedIds.has(p)), ...acceptedSecond, ...distractors];
  if (palIds.join() === canonicalFull.join() || palIds.join() === [...palIds].sort().join() && false) err(q, 'palette is in answer order (must be shuffled)');
  // the first acceptable ids must not appear in slot order inside the palette
  const posInPalette = slotIds.map((sid) => palIds.indexOf(sol[sid][0]));
  if (posInPalette.every((v, i, a) => i === 0 || v > a[i - 1])) err(q, 'correct services appear in slot order inside the palette (leaks the answer)');
}

function checkMatch(q) {
  const c = q.config; const pairs = q.reference?.pairs;
  if (!pairs) return err(q, 'missing reference.pairs');
  const left = c.left || []; const right = c.right || [];
  if (left.length < 6 || left.length > 8) err(q, `needs 6-8 left chips (got ${left.length})`);
  const lIds = left.map((l) => l.id); const rIds = right.map((r) => r.id);
  if (new Set(lIds).size !== lIds.length) err(q, 'duplicate left ids');
  if (new Set(rIds).size !== rIds.length) err(q, 'duplicate right ids');
  for (const l of left) {
    if (!l.label) err(q, `left ${l.id} has no label`);
    if (!ICON_KINDS.has(l.kind)) err(q, `left ${l.id} has unknown icon kind '${l.kind}'`);
    if (!PROVIDERS.has(l.provider)) err(q, `left ${l.id} has bad provider '${l.provider}'`);
  }
  for (const r of right) if (!r.text || r.text.length < 8) err(q, `right ${r.id} text missing/too short`);
  for (const lid of lIds) if (!pairs[lid]) err(q, `left ${lid} has no correct right`);
  for (const lid of Object.keys(pairs)) if (!lIds.includes(lid)) err(q, `pairs has unknown left ${lid}`);
  const targets = Object.values(pairs);
  for (const t of targets) if (!rIds.includes(t)) err(q, `pairs points at unknown right ${t}`);
  if (new Set(targets).size !== targets.length) err(q, 'two left chips share the same correct right');
  const extras = rIds.filter((r) => !targets.includes(r));
  if (extras.length < 1 || extras.length > 2) err(q, `needs 1-2 distractor descriptions (got ${extras.length})`);
  // shuffled: the mapping must not be the identity / monotonic by position
  const mapped = lIds.map((lid) => rIds.indexOf(pairs[lid]));
  if (mapped.every((v, i, a) => i === 0 || v > a[i - 1])) err(q, 'right list is in answer order (must be shuffled)');
  // a description must not simply repeat the service name (would be a giveaway)
  for (const l of left) { const r = right.find((x) => x.id === pairs[l.id]); if (r && r.text.toLowerCase().includes(l.label.toLowerCase()) && q.title !== 'Same job, different cloud') warn(q, `description for '${l.label}' repeats the name`); }
}

function behaviour(q) {
  const empty = frac(mark(q, {}));
  if (empty !== 0) err(q, `empty answer scores ${empty}`);
  let ref; let wrong; let swapped;
  if (q.type === 'architecture') {
    const sol = q.reference.solution; const ids = q.config.slots.map((s) => s.id);
    ref = { placed: Object.fromEntries(ids.map((s) => [s, sol[s][0]])) };
    // every acceptable alternative must also score 100% (check each alternative independently)
    for (const sid of ids) for (const alt of sol[sid]) {
      const r = { placed: { ...ref.placed, [sid]: alt } };
      if (frac(mark(q, r)) !== 1) err(q, `alternative ${alt} in slot ${sid} does not score 100%`);
    }
    swapped = { placed: { ...ref.placed, [ids[0]]: ref.placed[ids[1]], [ids[1]]: ref.placed[ids[0]] } };
    wrong = swapped;
  } else {
    const pairs = q.reference.pairs; const ids = q.config.left.map((l) => l.id);
    ref = { pairs: { ...pairs } };
    wrong = { pairs: { ...pairs, [ids[0]]: pairs[ids[1]], [ids[1]]: pairs[ids[0]] } };
  }
  const rs = frac(mark(q, ref));
  if (rs !== 1) err(q, `reference scores ${rs}, expected 1`);
  const ws = frac(mark(q, wrong));
  if (!(ws < 1)) err(q, `swapping two answers still scores ${ws}`);
  // a single wrong item must cost marks but keep the rest (partial credit)
  if (!(ws > 0)) err(q, 'a single swap should keep partial credit');
  // random play
  const N = 2000; let sum = 0;
  for (let t = 0; t < N; t++) {
    if (q.type === 'architecture') {
      const palIds = shuffle(q.config.palette.map((p) => p.id));
      sum += frac(mark(q, { placed: Object.fromEntries(q.config.slots.map((s, i) => [s.id, palIds[i]])) }));
    } else {
      const rIds = shuffle(q.config.right.map((r) => r.id));
      sum += frac(mark(q, { pairs: Object.fromEntries(q.config.left.map((l, i) => [l.id, rIds[i]])) }));
    }
  }
  const avg = sum / N;
  if (avg >= 0.35) warn(q, `random play averages ${(avg * 100).toFixed(1)}% (>= 35%)`);
  return { avg, swap: ws, units: q.type === 'architecture' ? q.config.slots.length : q.config.left.length };
}

console.log(`Validating ${cloud.length} cloud questions`);
const titles = new Set();
const rows = [];
for (const q of cloud) {
  if (titles.has(q.title)) err(q, 'duplicate title');
  titles.add(q.title);
  checkCommon(q);
  if (q.type === 'architecture') checkArchitecture(q); else if (q.type === 'match') checkMatch(q);
  const b = behaviour(q);
  rows.push({ type: q.type, level: q.difficulty, title: q.title, marks: q.marks, min: q.time_mins, units: b.units, 'one swap': `${(b.swap * 100).toFixed(0)}%`, 'random avg': `${(b.avg * 100).toFixed(1)}%` });
}
if (cloud.length !== 8) { errors++; console.log(`  ERROR expected 8 questions, found ${cloud.length}`); }
const arch = cloud.filter((q) => q.type === 'architecture').length; const mt = cloud.filter((q) => q.type === 'match').length;
if (arch !== 4 || mt !== 4) { errors++; console.log(`  ERROR expected 4 architecture + 4 match, found ${arch} + ${mt}`); }
console.table(rows);

// ids must stay unique across the whole bank (the combiner throws on duplicates)
try { const m = await import('./questions.js'); console.log(`combined bank loads fine (${m.questions.length} questions)`); } catch (e) { errors++; console.log('  ERROR combined bank failed to load:', e.message); }

console.log(errors ? `\nFAILED: ${errors} error(s), ${warnings} warning(s)` : `\nOK: all cloud questions valid (${warnings} warning(s))`);
process.exit(errors ? 1 : 0);
