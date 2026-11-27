// Unit tests for the interactive marking functions and the generator's authoring checks.
// Usage: node test_interactive.js   (also run by `npm run validate`)
import { subjects, slug } from './questions.js';
import { prepareInteractive } from './interactive.js';
import { fixtureSequence, fixtureMatch, fixtureArchitecture } from './fixtures/interactive.js';
import { markSequence, markMatch, markArchitecture, markInteractive, unitsOf, interactiveProgress, defaultInteractiveResponse, isInteractiveAnswered } from '../frontend/src/runners/interactive.js';

let n = 0; let bad = 0;
const t = (name, cond, extra = '') => { n++; if (!cond) { bad++; console.log(`  FAIL ${name} ${extra}`); } };
const eq = (name, got, want) => t(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
const sid = new Map(subjects.map((s) => [s.name, s.id]));
const withId = (q) => ({ ...q, id: `${sid.get(q.subject)}-${q.difficulty}-${slug(q.title)}` });
const unsealed = (q) => { const p = prepareInteractive(withId(q)); return { p, q: { type: q.type, config: p.config, tests: p.units, solution: p.reference } }; };

// ---- sequence ----------------------------------------------------------------------------------------------------------
{
  const { p, q } = unsealed(fixtureSequence);
  const ids = Object.fromEntries(['load', 'clean', 'enc', 'split', 'scale', 'fit', 'pred', 'eval'].map((k) => [k, p.reference.order[['load', 'clean', 'enc', 'split', 'scale', 'fit', 'pred', 'eval'].indexOf(k)]]));
  const o = (...keys) => ({ order: keys.map((k) => ids[k]) });
  const total = p.units.length; eq('units = 11 rules', total, 11);
  const full = markSequence(q, o('load', 'clean', 'enc', 'split', 'scale', 'fit', 'pred', 'eval'));
  eq('canonical is 100%', [full.passed, full.total, full.satisfied], [11, 11, 11]);
  eq('result entries are hidden and one per rule', [full.results.length, full.results.every((r) => r.hidden === true && r.passed)], [11, true]);
  // valid alternatives: the encoder may run before the split OR after it, but before the scaler; clean/enc order is fixed by a rule here
  eq('alt: split before encoding is also fine when rules allow', markSequence(q, o('load', 'clean', 'split', 'enc', 'scale', 'fit', 'pred', 'eval')).passed, 11);
  const rev = markSequence(q, o('eval', 'pred', 'fit', 'scale', 'split', 'enc', 'clean', 'load'));
  eq('reversed = 0 (satisfied 0)', [rev.passed, rev.satisfied], [0, 0]);
  // chance-corrected formula: passed = max(0, 2*satisfied - total)
  const one = markSequence(q, o('load', 'clean', 'enc', 'split', 'scale', 'fit', 'eval', 'pred')); // swaps the last two: breaks fit<pred? no -> pred<eval, scale<pred
  t('one swap: satisfied < total and corrected = max(0, 2s-t)', one.satisfied < 11 && one.passed === Math.max(0, 2 * one.satisfied - 11), JSON.stringify([one.satisfied, one.passed]));
  const part = markSequence(q, o('load', 'clean', 'enc', 'split', 'scale', 'fit'));
  eq('missing items fail their rules (6 of 8 placed in order: 8 of 11 rules, corrected 2*8-11 = 5)', [part.satisfied, part.passed], [8, 5]);
  eq('only unrelated-order placements score 0 once below half', markSequence(q, o('eval')).passed, 0);
  eq('empty', markSequence(q, { order: [] }).passed, 0);
  eq('missing response', markSequence(q, undefined).passed, 0);
  eq('malformed response', markSequence(q, { order: 'abc' }).passed, 0);
  eq('unknown ids are ignored', markSequence(q, { order: ['zzz', ...o('load', 'clean', 'enc', 'split', 'scale', 'fit', 'pred', 'eval').order] }).passed, 11);
  eq('duplicate id: first occurrence wins', markSequence(q, { order: [...o('eval', 'load').order, ...o('clean', 'enc', 'split', 'scale', 'fit', 'pred', 'eval').order] }).satisfied < 11, true);
  eq('markInteractive dispatches', markInteractive(q, o('load', 'clean', 'enc', 'split', 'scale', 'fit', 'pred', 'eval')).passed, 11);
  eq('total is stable', markSequence(q, {}).total, 11);
  eq('progress counts placed items from the public config', interactiveProgress({ type: 'sequence', config: p.config }, o('load', 'clean')), { done: 2, total: 8 });
  eq('default response', defaultInteractiveResponse({ type: 'sequence' }), { order: [] });
  eq('answered flag', [isInteractiveAnswered({ type: 'sequence' }, { order: [] }), isInteractiveAnswered({ type: 'sequence' }, o('load'))], [false, true]);
  eq('units derived from solution when tests are empty', unitsOf({ type: 'sequence', tests: [], solution: { constraints: [['a', 'b']] } }), [{ before: 'a', after: 'b' }]);
}

// ---- match -------------------------------------------------------------------------------------------------------------
{
  const { p, q } = unsealed(fixtureMatch);
  const pr = p.reference.pairs; const L = Object.keys(pr);
  eq('match 100%', markMatch(q, { pairs: pr }).passed, 4);
  const partial = { ...pr, [L[0]]: pr[L[1]] };
  eq('one wrong pair', [markMatch(q, { pairs: partial }).passed, markMatch(q, { pairs: partial }).total], [3, 4]);
  eq('unplaced pair', markMatch(q, { pairs: { [L[0]]: pr[L[0]] } }).passed, 1);
  eq('null target', markMatch(q, { pairs: { [L[0]]: null } }).passed, 0);
  eq('empty / missing / malformed', [markMatch(q, {}).passed, markMatch(q, undefined).passed, markMatch(q, { pairs: [1, 2] }).passed], [0, 0, 0]);
  eq('unknown ids ignored', markMatch(q, { pairs: { ...pr, bogus: 'bogus2' } }).passed, 4);
  eq('progress', interactiveProgress({ type: 'match', config: p.config }, { pairs: { [L[0]]: pr[L[0]], [L[1]]: null } }), { done: 1, total: 4 });
  eq('answered flag', [isInteractiveAnswered({ type: 'match' }, { pairs: {} }), isInteractiveAnswered({ type: 'match' }, { pairs: { a: 'b' } })], [false, true]);
  eq('results hidden', markMatch(q, { pairs: pr }).results.every((r) => r.hidden === true), true);
}

// ---- architecture ------------------------------------------------------------------------------------------------------
{
  const { p, q } = unsealed(fixtureArchitecture);
  const sol = Object.fromEntries(Object.entries(p.reference.solution).map(([s, a]) => [s, a[0]]));
  const S = Object.keys(sol);
  eq('architecture 100%', markArchitecture(q, { placed: sol }).passed, 3);
  eq('one slot wrong', markArchitecture(q, { placed: { ...sol, [S[0]]: sol[S[1]] } }).passed, 2);
  eq('empty / missing / malformed', [markArchitecture(q, {}).passed, markArchitecture(q, undefined).passed, markArchitecture(q, { placed: 5 }).passed], [0, 0, 0]);
  eq('non-string values ignored', markArchitecture(q, { placed: { [S[0]]: 7, [S[1]]: sol[S[1]] } }).passed, 1);
  eq('unknown slot ignored', markArchitecture(q, { placed: { ...sol, ghost: 'x' } }).passed, 3);
  eq('progress', interactiveProgress({ type: 'architecture', config: p.config }, { placed: { [S[0]]: sol[S[0]] } }), { done: 1, total: 3 });
  // alternatives: an architecture slot that accepts two services
  const alt = { type: 'architecture', tests: [{ slot: 's', accept: ['a', 'b'] }], config: {} };
  eq('acceptable alternatives', [markArchitecture(alt, { placed: { s: 'a' } }).passed, markArchitecture(alt, { placed: { s: 'b' } }).passed, markArchitecture(alt, { placed: { s: 'c' } }).passed], [1, 1, 0]);
}

// ---- dispatch ----------------------------------------------------------------------------------------------------------
{
  let threw = false; try { markInteractive({ type: 'sequence', tests: [] }, {}); } catch { threw = true; }
  t('sealed question is refused (no units)', threw);
  threw = false; try { markInteractive({ type: 'coding', tests: [{}] }, {}); } catch { threw = true; }
  t('non-interactive type is refused', threw);
}

// ---- generator authoring checks ---------------------------------------------------------------------------------------
const clone = (v) => JSON.parse(JSON.stringify(v));
const rejects = (name, mutate, base, match = /./) => {
  const q = withId(clone(base)); mutate(q);
  let msg = null; try { prepareInteractive(q); } catch (e) { msg = e.message; }
  t(`generator rejects: ${name}`, msg !== null && match.test(msg), `message: ${msg}`);
};
rejects('duplicate item ids', (q) => { q.config.items[1].id = q.config.items[0].id; }, fixtureSequence, /duplicate item ids/);
rejects('unknown constraint id', (q) => { q.reference.constraints.push(['load', 'nope']); }, fixtureSequence, /bad constraint/);
rejects('order violating a constraint', (q) => { q.reference.order = [...q.reference.order].reverse(); }, fixtureSequence, /violates constraint/);
rejects('unscored item', (q) => { q.reference.constraints = q.reference.constraints.filter((c) => !c.includes('enc')); }, fixtureSequence, /not part of any constraint|at least/);
rejects('contradicting constraints', (q) => { q.reference.constraints.push(['clean', 'load']); }, fixtureSequence, /contradicting|violates/);
rejects('step numbers in labels', (q) => { q.config.items[0].label = 'Step 1: Load the dataset'; }, fixtureSequence, /step numbers/);
rejects('answer keys inside config', (q) => { q.config.order = ['x']; }, fixtureSequence, /must not contain "order"/);
rejects('time over 4 minutes', (q) => { q.time_mins = 5; }, fixtureSequence, /time_mins/);
rejects('time under 2 minutes', (q) => { q.time_mins = 1; }, fixtureMatch, /time_mins/);
rejects('derived tests supplied by the author', (q) => { q.tests = [{ a: 1 }]; }, fixtureSequence, /must not define/);
rejects('duplicate left ids', (q) => { q.config.left[1].id = q.config.left[0].id; }, fixtureMatch, /duplicate left ids/);
rejects('two lefts sharing a right', (q) => { q.reference.pairs.L2 = 'R1'; }, fixtureMatch, /share the same correct right/);
rejects('pair to unknown right', (q) => { q.reference.pairs.L1 = 'RX'; }, fixtureMatch, /unknown right/);
rejects('slot accepting unknown palette id', (q) => { q.reference.solution.a1 = ['pX']; }, fixtureArchitecture, /unknown palette id/);
rejects('no distractors in the palette', (q) => { q.config.palette = q.config.palette.slice(0, 3); }, fixtureArchitecture, /distractor/);
rejects('duplicate palette ids', (q) => { q.config.palette[1].id = q.config.palette[0].id; }, fixtureArchitecture, /duplicate palette ids/);
rejects('slot outside the canvas', (q) => { q.config.slots[0].x = 95; }, fixtureArchitecture, /outside the 0\.\.100 canvas/);
rejects('bad provider', (q) => { q.config.provider = 'oracle'; }, fixtureArchitecture, /provider/);

// ---- determinism + opacity ---------------------------------------------------------------------------------------------
{
  const a = prepareInteractive(withId(clone(fixtureSequence))); const b = prepareInteractive(withId(clone(fixtureSequence)));
  eq('generator is deterministic', JSON.stringify(a), JSON.stringify(b));
  const ids = a.config.items.map((i) => i.id);
  t('opaque ids (no authored id leaks)', ids.every((x) => !['load', 'clean', 'enc', 'split', 'scale', 'fit', 'pred', 'eval'].includes(x)));
  const fp = a.config.items.reduce((c, it, i) => c + (it.id === a.reference.order[i] ? 1 : 0), 0);
  t('public order is not the canonical order', fp <= Math.floor(ids.length / 3), `fixed points ${fp}`);
}

console.log(bad ? `\nINTERACTIVE UNIT TESTS FAILED (${bad}/${n})` : `OK: ${n} interactive unit checks passed`);
process.exit(bad ? 1 : 0);
