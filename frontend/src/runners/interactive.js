// Browser-side marking for the interactive (drag & drop) question types: sequence, match, architecture.
// Pure functions (no DOM, no network) so they run in the browser and in node (question-bank validators).
//
// The question must be UNSEALED (see bank/index.js::unsealQuestion): it then carries `tests` (one entry per scoring unit)
// and `solution`. Scoring units (ids are the opaque ids that the generator wrote into the public config):
//   sequence     tests[i] = { before, after }      satisfied iff both ids are placed and index(before) < index(after);
//                                                  scored chance-corrected: passed = max(0, 2*satisfied - total) (see markSequence)
//   match        tests[i] = { left, right }        satisfied iff response.pairs[left] === right
//   architecture tests[i] = { slot, accept:[...] } satisfied iff response.placed[slot] is in `accept`
// Responses:  sequence { order:[ids] }   match { pairs:{leftId:rightId} }   architecture { placed:{slotId:paletteId} }
// Result shape (same as the other runners): { passed, total, results:[{ index, name, passed, hidden:true, weight:1 }] }.
// An empty / missing / malformed response scores 0. Nothing here tells the candidate what is right (no messages, hidden:true).

export const INTERACTIVE_TYPES = ['sequence', 'match', 'architecture'];
export const isInteractiveType = (type) => INTERACTIVE_TYPES.includes(type);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Scoring units of an unsealed question. Falls back to deriving them from `solution` when `tests` is empty. */
export function unitsOf(question) {
  if (Array.isArray(question?.tests) && question.tests.length) return question.tests;
  const s = question?.solution;
  if (!isObj(s)) return [];
  if (question.type === 'sequence' && Array.isArray(s.constraints)) return s.constraints.map(([before, after]) => ({ before, after }));
  if (question.type === 'match' && isObj(s.pairs)) return Object.entries(s.pairs).map(([left, right]) => ({ left, right }));
  if (question.type === 'architecture' && isObj(s.solution)) return Object.entries(s.solution).map(([slot, accept]) => ({ slot, accept: [].concat(accept) }));
  return [];
}

function build(units, passedFn, label) {
  const results = units.map((u, index) => ({ index, name: `${label} ${index + 1}`, passed: !!passedFn(u), hidden: true, weight: 1 }));
  return { passed: results.filter((r) => r.passed).length, total: results.length, results };
}

/**
 * sequence: chance-corrected precedence scoring.
 * A random permutation satisfies ~50% of the [before, after] rules, so raw "rules satisfied" would hand out ~50% marks for dragging
 * the cards in any order. We therefore report total = number of rules and passed = max(0, 2*satisfied - total), so that
 * marks x passed/total = marks x max(0, 2*s/t - 1): perfect = 100%, random ~ 8-9%, reversed = 0, nothing placed = 0.
 * Items not placed fail the rules they take part in. `results[]` keeps one entry per rule (hidden:true) and `satisfied` is the raw count
 * (staff debugging only - never shown to candidates).
 */
export function markSequence(question, response) {
  const units = unitsOf(question);
  const order = Array.isArray(response?.order) ? response.order : [];
  const pos = new Map();
  order.forEach((id, i) => { if (typeof id === 'string' && !pos.has(id)) pos.set(id, i); }); // first occurrence wins; ids may repeat in a broken client
  const raw = build(units, (u) => pos.has(u.before) && pos.has(u.after) && pos.get(u.before) < pos.get(u.after), 'Order rule');
  return { ...raw, satisfied: raw.passed, passed: Math.max(0, 2 * raw.passed - raw.total) };
}

/** match: each left item must be paired with its right target. Unknown ids simply don't match. */
export function markMatch(question, response) {
  const units = unitsOf(question);
  const pairs = isObj(response?.pairs) ? response.pairs : {};
  return build(units, (u) => Object.prototype.hasOwnProperty.call(pairs, u.left) && pairs[u.left] === u.right, 'Pair');
}

/** architecture: each slot must hold one of its acceptable services. */
export function markArchitecture(question, response) {
  const units = unitsOf(question);
  const placed = isObj(response?.placed) ? response.placed : {};
  return build(units, (u) => {
    if (!Object.prototype.hasOwnProperty.call(placed, u.slot)) return false;
    const v = placed[u.slot];
    return typeof v === 'string' && (u.accept || []).includes(v);
  }, 'Slot');
}

/** Dispatch by question.type. Throws when the question is still sealed (no scoring units) so callers can retry after unsealing. */
export function markInteractive(question, response) {
  const units = unitsOf(question);
  if (!units.length) throw new Error('Answers for this question are not unlocked yet.');
  switch (question?.type) {
    case 'sequence': return markSequence(question, response);
    case 'match': return markMatch(question, response);
    case 'architecture': return markArchitecture(question, response);
    default: throw new Error(`Not an interactive question type: ${question?.type}`);
  }
}

/** Initial (empty) response for an interactive question. */
export function defaultInteractiveResponse(question) {
  switch (question?.type) {
    case 'sequence': return { order: [] };
    case 'match': return { pairs: {} };
    case 'architecture': return { placed: {} };
    default: return {};
  }
}

/** Has the candidate placed anything? (used for the 'answered' tick and the unanswered list on submit) */
export function isInteractiveAnswered(question, response) {
  if (!response) return false;
  switch (question?.type) {
    case 'sequence': return Array.isArray(response.order) && response.order.length > 0;
    case 'match': return isObj(response.pairs) && Object.values(response.pairs).some(Boolean);
    case 'architecture': return isObj(response.placed) && Object.values(response.placed).some(Boolean);
    default: return false;
  }
}

/** Progress for the "7 of 12 placed" label: { done, total } computed from the PUBLIC config (works while sealed). */
export function interactiveProgress(question, response) {
  const c = question?.config || {};
  switch (question?.type) {
    case 'sequence': return { done: Array.isArray(response?.order) ? response.order.length : 0, total: (c.items || []).length };
    case 'match': return { done: isObj(response?.pairs) ? Object.values(response.pairs).filter(Boolean).length : 0, total: (c.left || []).length };
    case 'architecture': return { done: isObj(response?.placed) ? Object.values(response.placed).filter(Boolean).length : 0, total: (c.slots || []).length };
    default: return { done: 0, total: 0 };
  }
}
