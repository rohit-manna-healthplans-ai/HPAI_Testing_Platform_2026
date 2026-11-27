// Validates question-bank/q_ml.js (ML Workflow `sequence` questions). Run: node question-bank/validate_ml.js
// Marking rule (docs/INTERACTIVE_TYPES.md): a constraint [a,b] is satisfied iff both ids are placed and index(a) < index(b);
// score = satisfied / constraints.length.
import { ml } from './q_ml.js';

const errors = [];
const warns = [];
const fail = (q, msg) => errors.push(`[${q.title}] ${msg}`);
const warn = (q, msg) => warns.push(`[${q.title}] ${msg}`);

function markSequence(constraints, order) {
  const idx = new Map(order.map((id, i) => [id, i]));
  let passed = 0;
  for (const [a, b] of constraints) if (idx.has(a) && idx.has(b) && idx.get(a) < idx.get(b)) passed += 1;
  return { passed, total: constraints.length };
}

// number of distinct complete orders that satisfy every constraint (DP over subsets; n <= ~16)
function countLinearExtensions(ids, constraints) {
  const n = ids.length;
  const pos = new Map(ids.map((id, i) => [id, i]));
  const pred = new Array(n).fill(0);
  for (const [a, b] of constraints) pred[pos.get(b)] |= 1 << pos.get(a);
  const dp = new Array(1 << n).fill(0);
  dp[0] = 1;
  for (let mask = 0; mask < (1 << n); mask += 1) {
    if (!dp[mask]) continue;
    for (let i = 0; i < n; i += 1) {
      if (mask & (1 << i)) continue;
      if ((pred[i] & mask) === pred[i]) dp[mask | (1 << i)] += dp[mask];
    }
  }
  return dp[(1 << n) - 1];
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(arr, r) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const hasKeyDeep = (o, keys) => {
  if (Array.isArray(o)) return o.some((x) => hasKeyDeep(x, keys));
  if (o && typeof o === 'object') return Object.keys(o).some((k) => keys.includes(k) || hasKeyDeep(o[k], keys));
  return false;
};
const pct = (x) => `${(x * 100).toFixed(0)}%`;

const VISUALS = ['scatter-regression', 'confusion-matrix', 'loss-curve', 'data-split', 'none'];
const rows = [];
const titles = new Set();

for (const q of ml) {
  if (q.subject !== 'ML Workflow (Drag & Drop)') fail(q, `subject must be 'ML Workflow (Drag & Drop)', got '${q.subject}'`);
  if (q.type !== 'sequence') fail(q, `type must be 'sequence'`);
  if (titles.has(q.title)) fail(q, 'duplicate title');
  titles.add(q.title);
  if (!(q.time_mins >= 2 && q.time_mins <= 4)) fail(q, `time_mins ${q.time_mins} not in 2..4`);
  const expectedMarks = { easy: 10, medium: 20, hard: 30 }[q.difficulty];
  if (q.marks !== expectedMarks) fail(q, `marks ${q.marks} do not match difficulty ${q.difficulty} (${expectedMarks})`);
  if (q.time_mins <= 3 && q.difficulty !== 'easy') fail(q, '<= 3 min must be easy');
  if (q.time_mins === 4 && q.difficulty !== 'medium') fail(q, '4 min must be medium');
  if (!q.statement || q.statement.length < 30) fail(q, 'statement missing/short');
  if (!Array.isArray(q.tags) || !q.tags.length) fail(q, 'tags missing');
  if (q.tests !== undefined) fail(q, '`tests` must not be authored for sequence questions (generator derives them)');
  const c = q.config || {};
  if (!c.scenario || c.scenario.length < 40) fail(q, 'config.scenario missing/short');
  if (hasKeyDeep(c, ['order', 'constraints', 'correct', 'solution', 'reference'])) fail(q, 'answer keys (order/constraints/correct/solution/reference) found inside config');

  const items = c.items || [];
  const ids = items.map((i) => i.id);
  const stageIds = (c.stages || []).map((s) => s.id);
  if (new Set(ids).size !== ids.length) fail(q, 'duplicate item ids');
  if (new Set(stageIds).size !== stageIds.length) fail(q, 'duplicate stage ids');
  for (const it of items) {
    if (!it.label || !it.detail) fail(q, `item ${it.id} needs label and detail`);
    if (!stageIds.includes(it.stage)) fail(q, `item ${it.id} has stage '${it.stage}' which is not in config.stages`);
    if (/^s?\d+$/.test(it.id)) fail(q, `item id '${it.id}' looks numbered - use semantic ids`);
  }
  const usedStages = new Set(items.map((i) => i.stage));
  for (const s of stageIds) if (!usedStages.has(s)) warn(q, `stage '${s}' is not used by any item`);
  if (!VISUALS.includes(c.visual?.kind)) fail(q, `unknown visual kind '${c.visual?.kind}'`);

  const v = c.visual || {};
  if (v.kind === 'scatter-regression') {
    if (!Array.isArray(v.points) || v.points.length < 8 || v.points.length > 40) fail(q, 'scatter points must be 8..40');
    else if (!v.points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) fail(q, 'scatter points must be [x,y] numbers');
    if (!(v.line && Number.isFinite(v.line.m) && Number.isFinite(v.line.b))) fail(q, 'scatter line {m,b} missing');
  }
  if (v.kind === 'confusion-matrix') {
    if (!(Array.isArray(v.matrix) && v.matrix.length === 2 && v.matrix.every((r) => r.length === 2 && r.every(Number.isFinite)))) fail(q, 'matrix must be 2x2 numbers');
    if (!(Array.isArray(v.labels) && v.labels.length === 2)) fail(q, 'labels must have 2 entries');
  }
  if (v.kind === 'loss-curve') {
    if (!(Array.isArray(v.series) && v.series.length >= 1 && v.series.every((s) => s.name && Array.isArray(s.values) && s.values.length >= 5 && s.values.every(Number.isFinite)))) fail(q, 'loss-curve series invalid');
  }
  if (v.kind === 'data-split') {
    const sum = (v.segments || []).reduce((s, x) => s + x.percent, 0);
    if (sum !== 100) fail(q, `data-split percents sum to ${sum}, expected 100`);
  }

  const ref = q.reference || {};
  const order = ref.order || [];
  const cons = ref.constraints || [];
  if (order.length !== ids.length || new Set(order).size !== order.length || !order.every((id) => ids.includes(id))) fail(q, 'reference.order must be a permutation of the item ids');
  const refd = new Set();
  const seenPair = new Set();
  for (const pr of cons) {
    if (!Array.isArray(pr) || pr.length !== 2) { fail(q, `bad constraint ${JSON.stringify(pr)}`); continue; }
    const [a, b] = pr;
    if (!ids.includes(a) || !ids.includes(b)) fail(q, `constraint references unknown id: ${JSON.stringify(pr)}`);
    if (a === b) fail(q, `self constraint ${a}`);
    const key = `${a}>${b}`;
    if (seenPair.has(key)) fail(q, `duplicate constraint ${key}`);
    seenPair.add(key);
    if (seenPair.has(`${b}>${a}`)) fail(q, `contradictory constraints ${a}/${b}`);
    refd.add(a); refd.add(b);
  }
  for (const id of ids) if (!refd.has(id)) fail(q, `item '${id}' is not part of any constraint`);
  if (cons.length < ids.length - 1) fail(q, `only ${cons.length} constraints for ${ids.length} items (need >= n-1)`);

  const canon = markSequence(cons, order);
  if (canon.passed !== canon.total) fail(q, `canonical order satisfies only ${canon.passed}/${canon.total} constraints`);
  const empty = markSequence(cons, []);
  if (empty.passed !== 0) fail(q, 'empty answer must score 0');
  const rev = markSequence(cons, order.slice().reverse());
  if (rev.passed / rev.total >= 0.5) fail(q, `reversed order scores ${pct(rev.passed / rev.total)} (< 50% required)`);

  // public order must not be the canonical order, nor mostly in order
  const pos = new Map(order.map((id, i) => [id, i]));
  const publicOrder = ids;
  if (publicOrder.every((id, i) => id === order[i])) fail(q, 'PUBLIC item order equals the canonical order');
  let adjAsc = 0;
  for (let i = 1; i < publicOrder.length; i += 1) if (pos.get(publicOrder[i]) === pos.get(publicOrder[i - 1]) + 1) adjAsc += 1;
  if (adjAsc >= 3) warn(q, `public order leaves ${adjAsc} consecutive canonical neighbours together - shuffle harder`);
  const publicScore = markSequence(cons, publicOrder);
  if (publicScore.passed / publicScore.total > 0.75) warn(q, `leaving the public order untouched already scores ${pct(publicScore.passed / publicScore.total)}`);

  // random permutations (seeded)
  const r = rng(7919 + q.title.length);
  let rawSum = 0; let corrSum = 0; let maxRaw = 0;
  const N = 500;
  for (let i = 0; i < N; i += 1) {
    const m = markSequence(cons, shuffled(ids, r));
    const f = m.passed / m.total;
    rawSum += f; maxRaw = Math.max(maxRaw, f);
    corrSum += Math.max(0, 2 * f - 1);
  }
  const rawAvg = rawSum / N;
  const corrAvg = corrSum / N;
  if (rawAvg >= 0.4) warn(q, `random permutations average ${pct(rawAvg)} raw (any pairwise-precedence scoring gives ~50% by chance; apply chance-correction in the marker)`);
  if (corrAvg >= 0.2) warn(q, `random permutations still average ${pct(corrAvg)} AFTER chance-correction (add constraints)`);

  const ext = countLinearExtensions(ids, cons);
  if (ext < 2) warn(q, 'only ONE valid order exists (no alternatives accepted)');

  rows.push({
    title: q.title.slice(0, 44), diff: q.difficulty, marks: q.marks, min: q.time_mins, items: ids.length, constraints: cons.length,
    validOrders: ext, canonical: pct(canon.passed / canon.total), empty: pct(empty.passed / empty.total), reversed: pct(rev.passed / rev.total),
    randomRaw: pct(rawAvg), randomCorrected: pct(corrAvg),
  });
}

if (ml.length !== 4) errors.push(`expected 4 ML questions, found ${ml.length}`);
console.table(rows);
for (const w of warns) console.log('WARN ', w);
for (const e of errors) console.log('FAIL ', e);
console.log(errors.length ? `\n${errors.length} validation error(s)` : '\nOK: all ML sequence validations passed');
process.exit(errors.length ? 1 : 0);
