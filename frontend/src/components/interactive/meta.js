// Tiny, eagerly-importable helpers for the interactive (drag & drop) question types.
// The heavy UI lives in InteractiveQuestion.jsx and is lazy-loaded (React.lazy) where it is needed.
export const INTERACTIVE_TYPES = ['sequence', 'match', 'architecture'];
export const isInteractiveType = (t) => INTERACTIVE_TYPES.includes(t);
export const INTERACTIVE_LABEL = { sequence: 'Sequence', match: 'Matching', architecture: 'Architecture' };

export const HOW_TO = {
  sequence: [
    'Drag the steps from “Available steps” into “Your sequence” (or press Add), then drag to reorder — the ↑ ↓ buttons work too.',
    'Put the steps in the order they must happen. More than one order can be valid when steps do not depend on each other.',
    'Your answer saves automatically; nothing is marked until you submit.',
  ],
  match: [
    'Drag each service onto the description it matches (or tap a service, then tap a description).',
    'One service per description. Drag a placed service to another description to swap, or back to the list to remove it.',
    'Your answer saves automatically; nothing is marked until you submit.',
  ],
  architecture: [
    'Drag services from the palette into the boxes of the diagram (or tap a service, then tap a box).',
    'Every box has a job — place the service that fits it. Some services in the palette are distractors.',
    'Drag a placed service to another box to swap, or back to the palette to remove it. Your answer saves automatically.',
  ],
};

/** Empty response for a question of an interactive type. */
export function interactiveDefault(q) {
  switch (q.type) {
    case 'sequence': return { order: [] };
    case 'match': return { pairs: {} };
    case 'architecture': return { placed: {} };
    default: return {};
  }
}

/** Normalised copy of a stored response (drops ids that are not part of the question; tolerates missing fields). */
export function interactiveFromResponse(q, resp) {
  const cfg = q.config || {};
  if (q.type === 'sequence') {
    const ids = new Set((cfg.items || []).map((i) => i.id));
    const seen = new Set();
    return { order: (resp?.order || []).filter((id) => ids.has(id) && !seen.has(id) && seen.add(id)) };
  }
  if (q.type === 'match') {
    const left = new Set((cfg.left || []).map((i) => i.id));
    const right = new Set((cfg.right || []).map((i) => i.id));
    const used = new Set(); const pairs = {};
    Object.entries(resp?.pairs || {}).forEach(([l, r]) => { if (left.has(l) && right.has(r) && !used.has(r)) { pairs[l] = r; used.add(r); } });
    return { pairs };
  }
  if (q.type === 'architecture') {
    const slots = new Set((cfg.slots || []).map((s) => s.id));
    const pal = new Set((cfg.palette || []).map((p) => p.id));
    const used = new Set(); const placed = {};
    Object.entries(resp?.placed || {}).forEach(([s, p]) => { if (slots.has(s) && pal.has(p) && !used.has(p)) { placed[s] = p; used.add(p); } });
    return { placed };
  }
  return {};
}

/** Has the candidate placed anything yet? */
export function interactiveAnswered(q, resp) {
  if (!resp) return false;
  if (q.type === 'sequence') return (resp.order || []).length > 0;
  if (q.type === 'match') return Object.keys(resp.pairs || {}).length > 0;
  if (q.type === 'architecture') return Object.keys(resp.placed || {}).length > 0;
  return false;
}

/** Progress text, never correctness. */
export function interactiveProgress(q, resp) {
  const cfg = q.config || {};
  if (q.type === 'sequence') return { done: (resp?.order || []).length, total: (cfg.items || []).length, noun: 'placed' };
  if (q.type === 'match') return { done: Object.keys(resp?.pairs || {}).length, total: (cfg.left || []).length, noun: 'matched' };
  if (q.type === 'architecture') return { done: Object.keys(resp?.placed || {}).length, total: (cfg.slots || []).length, noun: 'boxes filled' };
  return { done: 0, total: 0, noun: '' };
}

/** "10 tests (7 hidden)" for classic questions, "12 scoring units" for the interactive types (staff views). */
export function unitsLabel(q) {
  if (isInteractiveType(q.type)) return `${q.test_count || 0} scoring unit${(q.test_count || 0) === 1 ? '' : 's'}`;
  return `${q.test_count || 0} tests`;
}
