import { summarize } from './compare.js';

/** response: { selected: [idx] } -> {passed,total,results} per contract. */
export function scoreMcq(question, response) {
  const correct = question.config?.correct || [];
  const selected = [...new Set(response?.selected || [])];
  if (question.config?.multiple) {
    const right = selected.filter((i) => correct.includes(i)).length;
    const wrong = selected.length - right;
    const passed = Math.max(0, right - wrong);
    const total = correct.length || 1;
    return { passed, total, results: [{ index: 0, name: 'Answer', passed: passed === total, hidden: false, weight: total }] };
  }
  const ok = selected.length === 1 && correct.length === 1 && selected[0] === correct[0];
  return summarize([{ index: 0, name: 'Answer', passed: ok, hidden: false }]);
}
