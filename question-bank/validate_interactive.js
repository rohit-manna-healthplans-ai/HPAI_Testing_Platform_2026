// Validates the interactive (drag & drop) question types: sequence, match, architecture.
// Runs against the dev fixtures AND every real interactive question in the bank (q_ml.js / q_cloud.js).
// Uses the SAME generator code (interactive.js) and the SAME marking code (frontend/src/runners/interactive.js) as production.
// Usage: node validate_interactive.js
import { createHash } from 'node:crypto';
import { subjects, slug, questions } from './questions.js';
import { INTERACTIVE_TYPES, prepareInteractive, countExtensions } from './interactive.js';
import { fixtures } from './fixtures/interactive.js';
import { markSequence, markMatch, markArchitecture, markInteractive } from '../frontend/src/runners/interactive.js';

const subjectId = new Map(subjects.map((s) => [s.name, s.id]));
const withId = (q) => ({ ...q, id: `${subjectId.get(q.subject)}-${q.difficulty}-${slug(q.title)}` });

const real = questions.filter((q) => INTERACTIVE_TYPES.includes(q.type));
const targets = [...fixtures.map((f) => ({ ...withId(f), fixture: true })), ...real.map((q) => ({ ...q, fixture: false }))];

let failures = 0;
const fail = (q, msg) => { failures++; console.log(`  FAIL ${q.id}: ${msg}`); };
const warn = (q, msg) => console.log(`  warn ${q.id}: ${msg}`);

function prng(seed) {
  let a = createHash('sha1').update(seed).digest().readUInt32LE(0);
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuf = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (x) => `${(x * 100).toFixed(0)}%`;

/** A random linear extension of the precedence rules (Kahn with random picks). */
function randomExtension(ids, cons, r) {
  const preds = new Map(ids.map((i) => [i, new Set()]));
  for (const { before, after } of cons) preds.get(after).add(before);
  const done = new Set(); const out = [];
  while (out.length < ids.length) {
    const ready = ids.filter((i) => !done.has(i) && [...preds.get(i)].every((p) => done.has(p)));
    const pick = ready[Math.floor(r() * ready.length)];
    done.add(pick); out.push(pick);
  }
  return out;
}

function checkSequence(q, p) {
  const ids = p.config.items.map((i) => i.id);
  const total = p.units.length;
  const qq = { type: 'sequence', tests: p.units, solution: p.reference, config: p.config };
  const full = markSequence(qq, { order: p.reference.order });
  if (full.passed !== total || full.total !== total || full.satisfied !== total) fail(q, `reference order scores ${full.passed}/${full.total} (satisfied ${full.satisfied})`);
  for (const bad of [undefined, null, {}, { order: [] }, { order: 'x' }]) if (markSequence(qq, bad).passed !== 0) fail(q, `empty/malformed response ${JSON.stringify(bad)} must score 0`);
  const rev = markSequence(qq, { order: [...p.reference.order].reverse() });
  if (rev.passed >= total) fail(q, 'reversed order must not get full marks');
  const half = markSequence(qq, { order: p.reference.order.slice(0, Math.floor(ids.length / 2)) });
  if (half.passed >= total) fail(q, 'a half-built sequence must not get full marks');
  const r = prng(`ext|${q.id}`);
  const dep = p.units; // {before, after}
  for (let i = 0; i < 25; i++) {
    const ext = randomExtension(ids, dep, r);
    const m = markSequence(qq, { order: ext });
    if (m.passed !== total) { fail(q, `a valid alternative order scored ${m.passed}/${total}: ${ext.join(',')}`); break; }
  }
  let rawSum = 0; let corrSum = 0; const N = 400;
  for (let i = 0; i < N; i++) { const m = markSequence(qq, { order: shuf(ids, r) }); rawSum += m.satisfied / total; corrSum += m.passed / total; }
  const raw = rawSum / N; const corr = corrSum / N;
  if (corr > 0.20) fail(q, `random orders average ${pct(corr)} corrected marks (target < 20%): add more constraints`);
  const ext = p.info.extensions;
  console.log(`  ok   ${q.id}  [sequence] ${ids.length} items, ${total} rules, valid orders: ${ext ?? 'n/a'}; random: raw ${pct(raw)} -> corrected ${pct(corr)}`);
}

function checkMatch(q, p) {
  const qq = { type: 'match', tests: p.units, solution: p.reference, config: p.config };
  const total = p.units.length;
  const full = markMatch(qq, { pairs: p.reference.pairs });
  if (full.passed !== total || full.total !== total) fail(q, `reference pairs score ${full.passed}/${full.total}`);
  for (const bad of [undefined, null, {}, { pairs: {} }, { pairs: 'x' }, { pairs: { nope: 'nope' } }]) if (markMatch(qq, bad).passed !== 0) fail(q, `empty/malformed response ${JSON.stringify(bad)} must score 0`);
  const lefts = p.config.left.map((x) => x.id);
  const rights = lefts.map((l) => p.reference.pairs[l]);
  const rot = Object.fromEntries(lefts.map((l, i) => [l, rights[(i + 1) % rights.length]]));
  if (markMatch(qq, { pairs: rot }).passed >= total) fail(q, 'a rotated (wrong) mapping must not get full marks');
  const r = prng(`m|${q.id}`); let sum = 0; const N = 300; const allRight = p.config.right.map((x) => x.id);
  for (let i = 0; i < N; i++) { const pick = shuf(allRight, r); sum += markMatch(qq, { pairs: Object.fromEntries(lefts.map((l, k) => [l, pick[k]])) }).passed / total; }
  if (p.info.distractors < 1) warn(q, 'no distractor descriptions in `right` (guessing by elimination is easy)');
  console.log(`  ok   ${q.id}  [match] ${lefts.length} pairs, ${p.info.distractors} distractor(s); random guess avg ${pct(sum / N)}`);
}

function checkArchitecture(q, p) {
  const qq = { type: 'architecture', tests: p.units, solution: p.reference, config: p.config };
  const total = p.units.length;
  const slotIds = p.config.slots.map((s) => s.id);
  const canon = Object.fromEntries(slotIds.map((s) => [s, p.reference.solution[s][0]]));
  const full = markArchitecture(qq, { placed: canon });
  if (full.passed !== total || full.total !== total) fail(q, `reference solution scores ${full.passed}/${full.total}`);
  for (const s of slotIds) for (const alt of p.reference.solution[s]) {
    if (markArchitecture(qq, { placed: { ...canon, [s]: alt } }).passed !== total) fail(q, `acceptable alternative ${alt} for a slot is not accepted`);
  }
  for (const bad of [undefined, null, {}, { placed: {} }, { placed: 'x' }, { placed: { nope: 'nope' } }, { placed: Object.fromEntries(slotIds.map((s) => [s, 42])) }]) {
    if (markArchitecture(qq, bad).passed !== 0) fail(q, `empty/malformed response ${JSON.stringify(bad)} must score 0`);
  }
  const needed = new Set(Object.values(p.reference.solution).flat());
  const distractor = p.config.palette.find((x) => !needed.has(x.id));
  if (!distractor) fail(q, 'no distractor in the palette');
  else if (markArchitecture(qq, { placed: Object.fromEntries(slotIds.map((s) => [s, distractor.id])) }).passed !== 0) fail(q, 'all slots filled with a distractor must score 0');
  if (slotIds.length > 1) {
    const swapped = { ...canon, [slotIds[0]]: canon[slotIds[1]], [slotIds[1]]: canon[slotIds[0]] };
    const sameAccept = p.reference.solution[slotIds[0]].includes(canon[slotIds[1]]) && p.reference.solution[slotIds[1]].includes(canon[slotIds[0]]);
    if (!sameAccept && markArchitecture(qq, { placed: swapped }).passed >= total) fail(q, 'swapping two slots must lose marks');
  }
  const r = prng(`a|${q.id}`); let sum = 0; const N = 300; const pal = p.config.palette.map((x) => x.id);
  for (let i = 0; i < N; i++) { const pick = shuf(pal, r); sum += markArchitecture(qq, { placed: Object.fromEntries(slotIds.map((s, k) => [s, pick[k]])) }).passed / total; }
  console.log(`  ok   ${q.id}  [architecture] ${slotIds.length} slots, ${p.info.distractors} distractor(s), shared services ${p.info.sharedServices}; random placement avg ${pct(sum / N)}`);
}

function checkPublic(q, p) {
  // the public config must not reveal the answer through list order
  const own = JSON.stringify(p.config);
  for (const k of ['"reference"', '"solution"', '"constraints"', '"pairs"', '"accept"', '"before"', '"after"']) if (own.includes(k)) fail(q, `public config contains ${k}`);
  if (q.type === 'sequence') {
    const fp = p.config.items.reduce((n, it, i) => n + (it.id === p.reference.order[i] ? 1 : 0), 0);
    if (fp > Math.floor(p.config.items.length / 3)) fail(q, `public item order is too close to the answer (${fp} fixed points)`);
  }
  // opaque ids: none of the authored ids may survive in the remapped lists (they would hint at the order/pairs).
  // (`stages[].id` is deliberately NOT remapped: stage ids are public legend entries, not answers.)
  const listIds = (c) => [...(c.items || []), ...(c.left || []), ...(c.right || []), ...(c.palette || []), ...(c.slots || [])].map((x) => x.id);
  const publicIds = new Set(listIds(p.config));
  for (const orig of listIds(q.config)) {
    if (publicIds.has(orig)) fail(q, `authored id "${orig}" is still visible in the public config`);
  }
  for (const l of p.config.links || []) if (!publicIds.has(l.from) || !publicIds.has(l.to)) fail(q, 'a link refers to an id that is not in the public config');
}

console.log(`Interactive questions: ${fixtures.length} fixtures + ${real.length} real`);
for (const q of targets) {
  console.log(`\n${q.fixture ? '[fixture] ' : ''}${q.title}`);
  let p;
  try { p = prepareInteractive(q); } catch (e) { fail(q, e.message); continue; }
  try {
    checkPublic(q, p);
    if (q.type === 'sequence') checkSequence(q, p);
    else if (q.type === 'match') checkMatch(q, p);
    else checkArchitecture(q, p);
    // dispatch must agree with the specific marker
    const empty = markInteractive({ type: q.type, tests: p.units, solution: p.reference }, {});
    if (empty.passed !== 0 || empty.total !== p.units.length) fail(q, 'markInteractive on an empty response must be 0 of total');
    let threw = false; try { markInteractive({ type: q.type, tests: [], config: p.config }, {}); } catch { threw = true; }
    if (!threw) fail(q, 'markInteractive must refuse a still-sealed question (no units)');
  } catch (e) { fail(q, `validator crashed: ${e.stack || e}`); }
}

// the extension counter itself
if (countExtensions(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]) !== 1 || countExtensions(['a', 'b', 'c'], [['a', 'b']]) !== 3) { failures++; console.log('FAIL countExtensions'); }

console.log(failures ? `\nINTERACTIVE VALIDATION FAILED (${failures})` : '\nOK: interactive questions validated');
process.exit(failures ? 1 : 0);
