// Shared by build.js and validate_interactive.js: turns an AUTHORED interactive question (sequence / match / architecture)
// into the shape that ships (see docs/INTERACTIVE_TYPES.md).
//
// What this does, per question:
//   1. validates the authored question (ids exist, no duplicates, constraints satisfiable, 2..4 minutes, ...);
//   2. rewrites every id into an OPAQUE id (sha1 of questionId|kind|authoredId), because authors naturally number things in
//      the right order (s1,s2,... / L1->R1 / a1->p1) and that would leak the answer from the public bank;
//   3. shuffles the public lists deterministically (seeded by the question id) and re-seeds until the shuffled order is NOT
//      aligned with the answer (few fixed points), so authors may write items in any order;
//   4. derives the scoring units (`tests`) that are sealed together with the reference `solution`.
// The result: { config, reference, units } where config is public and reference/units are sealed.
import { createHash } from 'node:crypto';

export const INTERACTIVE_TYPES = ['sequence', 'match', 'architecture'];
export const isInteractive = (type) => INTERACTIVE_TYPES.includes(type);

const FORBIDDEN_CONFIG_KEYS = ['reference', 'solution', 'order', 'constraints', 'pairs', 'accept', 'before', 'after'];

const sha = (s) => createHash('sha1').update(s).digest('hex');

function rng(seed) {
  const h = createHash('sha1').update(seed).digest();
  let a = h.readUInt32LE(0);
  return () => { // mulberry32
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffled(arr, seed) {
  const a = [...arr]; const r = rng(seed);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const clone = (v) => JSON.parse(JSON.stringify(v));
const dupes = (ids) => ids.filter((x, i) => ids.indexOf(x) !== i);

function assertNoForbiddenKeys(v, where) {
  if (Array.isArray(v)) return v.forEach((x, i) => assertNoForbiddenKeys(x, `${where}[${i}]`));
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (FORBIDDEN_CONFIG_KEYS.includes(k)) throw new Error(`${where}: config must not contain "${k}" (answers live in \`reference\`)`);
      assertNoForbiddenKeys(x, `${where}.${k}`);
    }
  }
}

/** Opaque id factory: stable for (question id, kind, authored id), unique within a question. */
function idMaker(qid, prefix) {
  const used = new Set();
  const cache = new Map();
  return (orig) => {
    if (cache.has(orig)) return cache.get(orig);
    let len = 6; let id;
    do { id = prefix + sha(`${qid}|${prefix}|${orig}`).slice(0, len++); } while (used.has(id));
    used.add(id); cache.set(orig, id);
    return id;
  };
}

/** Deterministic shuffle with retries until `fixedPoints(arr)` <= limit (and the list differs from `identity` for n >= 2). */
function shuffleAligned(list, qid, salt, fixedPoints, limit) {
  if (list.length < 2) return list;
  for (let i = 0; i < 500; i++) {
    const cand = shuffled(list, `${qid}|${salt}|${i}`);
    if (fixedPoints(cand) <= limit) return cand;
  }
  throw new Error(`${qid}: could not shuffle ${salt} away from the answer order (list too small?)`);
}

const labelLeaksOrder = (s) => /^\s*(step\s*)?\(?\d{1,2}[.):]\s/i.test(String(s || '')) || /\bstep\s*\d{1,2}\b/i.test(String(s || ''));

function commonChecks(q, errs) {
  if (!Number.isInteger(q.time_mins) || q.time_mins < 2 || q.time_mins > 4) errs.push(`time_mins must be 2..4 (got ${q.time_mins})`);
  if (!Number.isFinite(q.marks) || q.marks <= 0) errs.push('marks must be > 0');
  if (!q.config || typeof q.config !== 'object') errs.push('config is required');
  if (!q.reference || typeof q.reference !== 'object') errs.push('reference (the answer) is required');
  try { assertNoForbiddenKeys(q.config, 'config'); } catch (e) { errs.push(e.message); }
  if (q.tests !== undefined && (!Array.isArray(q.tests) || q.tests.length)) errs.push('interactive questions must not define `tests` (they are derived)');
}

/** Counts the valid linear extensions of the precedence rules (info for authors). null when n > 18. */
export function countExtensions(ids, constraints) {
  const n = ids.length; if (n > 18) return null;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const pred = ids.map(() => 0);
  for (const [a, b] of constraints) pred[idx.get(b)] |= 1 << idx.get(a);
  const dp = new Float64Array(1 << n); dp[0] = 1;
  for (let mask = 0; mask < (1 << n); mask++) {
    if (!dp[mask]) continue;
    for (let i = 0; i < n; i++) if (!(mask & (1 << i)) && (pred[i] & mask) === pred[i]) dp[mask | (1 << i)] += dp[mask];
  }
  return dp[(1 << n) - 1];
}

function prepareSequence(q, qid) {
  const errs = []; commonChecks(q, errs);
  const c = q.config || {}; const ref = q.reference || {};
  const items = Array.isArray(c.items) ? c.items : [];
  const stages = Array.isArray(c.stages) ? c.stages : [];
  if (items.length < 4 || items.length > 14) errs.push(`sequence needs 4..14 items (got ${items.length})`);
  if (stages.length < 2) errs.push('sequence needs config.stages (>= 2) for the pipeline diagram');
  const ids = items.map((i) => i?.id);
  if (ids.some((x) => typeof x !== 'string' || !x)) errs.push('every item needs a string id');
  if (dupes(ids).length) errs.push(`duplicate item ids: ${dupes(ids).join(', ')}`);
  const stageIds = new Set(stages.map((s) => s.id));
  for (const it of items) {
    if (!it.label) errs.push(`item ${it.id} has no label`);
    if (!stageIds.has(it.stage)) errs.push(`item ${it.id} has unknown stage "${it.stage}"`);
    if (labelLeaksOrder(it.label) || labelLeaksOrder(it.detail)) errs.push(`item ${it.id}: label/detail must not contain step numbers (they leak the order)`);
  }
  const order = Array.isArray(ref.order) ? ref.order : [];
  const cons = Array.isArray(ref.constraints) ? ref.constraints : [];
  if (order.length !== ids.length || [...order].sort().join('|') !== [...ids].sort().join('|')) errs.push('reference.order must be a permutation of the item ids');
  const idSet = new Set(ids);
  const seenPair = new Set();
  for (const p of cons) {
    if (!Array.isArray(p) || p.length !== 2 || !idSet.has(p[0]) || !idSet.has(p[1]) || p[0] === p[1]) { errs.push(`bad constraint ${JSON.stringify(p)}`); continue; }
    const k = p.join('>'); if (seenPair.has(k)) errs.push(`duplicate constraint ${k}`); seenPair.add(k);
    if (seenPair.has(`${p[1]}>${p[0]}`)) errs.push(`contradicting constraints ${p[0]} / ${p[1]}`);
  }
  if (cons.length < ids.length - 1) errs.push(`need at least ${ids.length - 1} constraints (got ${cons.length})`);
  const covered = new Set(cons.flat());
  for (const id of ids) if (!covered.has(id)) errs.push(`item ${id} is not part of any constraint (it would be unscored)`);
  const pos = new Map(order.map((id, i) => [id, i]));
  for (const [a, b] of cons) if (pos.get(a) >= pos.get(b)) errs.push(`reference.order violates constraint ${a} -> ${b}`);
  if (errs.length) throw new Error(`${qid}: ${errs.join('; ')}`);

  const mk = idMaker(qid, 'i');
  const canon = order.map(mk);
  const publicItems = shuffleAligned(items.map((it) => ({ ...clone(it), id: mk(it.id) })), qid, 'items',
    (arr) => arr.reduce((n, it, i) => n + (it.id === canon[i] ? 1 : 0), 0), Math.floor(items.length / 3));
  const config = { ...clone(c), items: publicItems };
  const reference = { order: canon, constraints: cons.map(([a, b]) => [mk(a), mk(b)]) };
  const units = reference.constraints.map(([before, after]) => ({ before, after }));
  return { config, reference, units, info: { items: items.length, constraints: cons.length, extensions: countExtensions(order, cons) } };
}

function prepareMatch(q, qid) {
  const errs = []; commonChecks(q, errs);
  const c = q.config || {}; const ref = q.reference || {};
  const left = Array.isArray(c.left) ? c.left : []; const right = Array.isArray(c.right) ? c.right : [];
  const pairs = ref.pairs && typeof ref.pairs === 'object' ? ref.pairs : {};
  if (left.length < 3 || left.length > 10) errs.push(`match needs 3..10 left items (got ${left.length})`);
  const lids = left.map((x) => x?.id); const rids = right.map((x) => x?.id);
  if (dupes(lids).length) errs.push(`duplicate left ids: ${dupes(lids).join(', ')}`);
  if (dupes(rids).length) errs.push(`duplicate right ids: ${dupes(rids).join(', ')}`);
  for (const x of left) if (!x.label) errs.push(`left ${x.id} has no label`);
  for (const x of right) if (!x.text) errs.push(`right ${x.id} has no text`);
  const rSet = new Set(rids);
  for (const id of lids) {
    if (!(id in pairs)) errs.push(`left ${id} has no reference pair`);
    else if (!rSet.has(pairs[id])) errs.push(`left ${id} -> unknown right "${pairs[id]}"`);
  }
  for (const k of Object.keys(pairs)) if (!lids.includes(k)) errs.push(`reference pair for unknown left "${k}"`);
  const targets = Object.values(pairs);
  if (dupes(targets).length) errs.push(`two left items share the same correct right: ${dupes(targets).join(', ')}`);
  if (right.length < left.length) errs.push('right list must have at least as many entries as left');
  if (errs.length) throw new Error(`${qid}: ${errs.join('; ')}`);

  const mkL = idMaker(qid, 'l'); const mkR = idMaker(qid, 'r');
  const limit = Math.floor(left.length / 3);
  // Shuffle the right list first (relative to the authored left order), then the left list; check alignment on the final arrays.
  let pubLeft = left.map((x) => ({ ...clone(x), id: mkL(x.id) }));
  let pubRight = right.map((x) => ({ ...clone(x), id: mkR(x.id) }));
  const rp = Object.fromEntries(Object.entries(pairs).map(([l, r]) => [mkL(l), mkR(r)]));
  const aligned = (L, R) => L.reduce((n, x, i) => n + (R[i]?.id === rp[x.id] ? 1 : 0), 0);
  let ok = false;
  for (let i = 0; i < 500 && !ok; i++) {
    const L = shuffled(pubLeft, `${qid}|left|${i}`); const R = shuffled(pubRight, `${qid}|right|${i}`);
    if (aligned(L, R) <= limit) { pubLeft = L; pubRight = R; ok = true; }
  }
  if (!ok) throw new Error(`${qid}: could not de-align match lists`);
  const config = { ...clone(c), left: pubLeft, right: pubRight };
  const reference = { pairs: rp };
  const units = pubLeft.map((x) => ({ left: x.id, right: rp[x.id] }));
  return { config, reference, units, info: { left: left.length, right: right.length, distractors: right.length - left.length } };
}

function prepareArchitecture(q, qid) {
  const errs = []; commonChecks(q, errs);
  const c = q.config || {}; const ref = q.reference || {};
  const palette = Array.isArray(c.palette) ? c.palette : []; const slots = Array.isArray(c.slots) ? c.slots : [];
  const links = Array.isArray(c.links) ? c.links : [];
  const solution = ref.solution && typeof ref.solution === 'object' ? ref.solution : {};
  if (!['aws', 'azure', 'gcp', 'generic'].includes(c.provider)) errs.push(`provider must be aws|azure|gcp|generic (got ${c.provider})`);
  if (slots.length < 3 || slots.length > 10) errs.push(`architecture needs 3..10 slots (got ${slots.length})`);
  const sids = slots.map((s) => s?.id); const pids = palette.map((p) => p?.id);
  if (dupes(sids).length) errs.push(`duplicate slot ids: ${dupes(sids).join(', ')}`);
  if (dupes(pids).length) errs.push(`duplicate palette ids: ${dupes(pids).join(', ')}`);
  const pSet = new Set(pids); const sSet = new Set(sids);
  for (const s of slots) {
    for (const k of ['x', 'y', 'w', 'h']) if (!Number.isFinite(s[k])) errs.push(`slot ${s.id} needs numeric ${k}`);
    if (s.x < 0 || s.y < 0 || s.x + s.w > 100.01 || s.y + s.h > 100.01) errs.push(`slot ${s.id} is outside the 0..100 canvas`);
    if (!s.label) errs.push(`slot ${s.id} has no label`);
    const acc = solution[s.id];
    if (!Array.isArray(acc) || !acc.length) errs.push(`slot ${s.id} has no acceptable services in reference.solution`);
    else for (const p of acc) if (!pSet.has(p)) errs.push(`slot ${s.id} accepts unknown palette id "${p}"`);
  }
  for (const k of Object.keys(solution)) if (!sSet.has(k)) errs.push(`solution for unknown slot "${k}"`);
  for (const p of palette) if (!p.label || !p.kind) errs.push(`palette ${p.id} needs label and kind`);
  for (const l of links) if (!sSet.has(l.from) || !sSet.has(l.to)) errs.push(`link ${l.from}->${l.to} references an unknown slot`);
  const needed = new Set(Object.values(solution).flat());
  const distractors = pids.filter((p) => !needed.has(p));
  if (distractors.length < 2) errs.push(`palette needs at least 2 distractor services (has ${distractors.length})`);
  if (errs.length) throw new Error(`${qid}: ${errs.join('; ')}`);

  const mkP = idMaker(qid, 'p'); const mkS = idMaker(qid, 's');
  const pubSlots = slots.map((s) => ({ ...clone(s), id: mkS(s.id) }));
  const pubLinks = links.map((l) => ({ ...clone(l), from: mkS(l.from), to: mkS(l.to) }));
  const reference = { solution: Object.fromEntries(Object.entries(solution).map(([s, acc]) => [mkS(s), acc.map(mkP)])) };
  const firstOk = pubSlots.map((s) => reference.solution[s.id][0]); // slot order -> a correct palette id
  const pubPalette0 = palette.map((p) => ({ ...clone(p), id: mkP(p.id) }));
  const palette1 = shuffleAligned(pubPalette0, qid, 'palette',
    (arr) => firstOk.reduce((n, pid, i) => n + (arr[i]?.id === pid ? 1 : 0), 0), Math.floor(slots.length / 3));
  const config = { ...clone(c), palette: palette1, slots: pubSlots, links: pubLinks };
  const units = pubSlots.map((s) => ({ slot: s.id, accept: reference.solution[s.id] }));
  const multi = [...needed].filter((p) => Object.values(solution).filter((a) => a.includes(p)).length > 1);
  return { config, reference, units, info: { slots: slots.length, palette: palette.length, distractors: distractors.length, sharedServices: multi.length } };
}

/** q: an authored question WITH its final id. Throws a descriptive Error on any authoring problem. */
export function prepareInteractive(q) {
  const qid = q.id;
  if (!qid) throw new Error(`prepareInteractive needs q.id (${q.title})`);
  switch (q.type) {
    case 'sequence': return prepareSequence(q, qid);
    case 'match': return prepareMatch(q, qid);
    case 'architecture': return prepareArchitecture(q, qid);
    default: throw new Error(`${qid}: not an interactive type (${q.type})`);
  }
}
