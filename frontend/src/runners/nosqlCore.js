import { Query, Aggregator } from 'mingo';
import { compareValues, summarize, short } from './compare.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

/** Evaluate the candidate's JS literal; also tolerate `db.coll.aggregate([...])` / `db.coll.find({...}, {...})`. */
export function parseNosqlInput(code, mode) {
  let src = String(code || '').trim().replace(/;+\s*$/, '');
  if (!src) throw new Error('Write your query first.');
  const m = src.match(/^db\s*\.\s*[\w$]+\s*\.\s*(aggregate|find)\s*\(([\s\S]*)\)\s*$/);
  if (m) {
    if (m[1] === 'aggregate') src = m[2];
    else src = `(function(a,b){return {filter:a||{},projection:b}})(${m[2] || '{}'})`;
  }
  // eslint-disable-next-line no-new-func
  const value = new Function(`"use strict"; return (${src}\n);`)();
  if (mode === 'aggregate' && !Array.isArray(value)) throw new Error('Write an aggregation pipeline: an array like [ { $match: {...} }, ... ].');
  if (mode === 'find' && (!value || Array.isArray(value) || typeof value !== 'object')) throw new Error('Write an object like { filter: {...}, projection: {...}, sort: {...}, limit: n }.');
  return value;
}

export function execNosql(mode, input, data) {
  const docs = clone(data);
  if (mode === 'aggregate') return clone(new Aggregator(input).run(docs));
  let cur = new Query(input.filter || {}).find(docs, input.projection);
  if (input.sort) cur = cur.sort(input.sort);
  if (input.skip) cur = cur.skip(input.skip);
  if (input.limit) cur = cur.limit(input.limit);
  return clone(cur.all());
}

export function runNosqlTests(question, code, { onlyVisible = false } = {}) {
  const cfg = question.config || {};
  const mode = cfg.mode || 'aggregate';
  const tests = (question.tests || []).map((t, index) => ({ ...t, index })).filter((t) => !onlyVisible || !t.hidden);
  let input; let parseError = null;
  try { input = parseNosqlInput(code, mode); } catch (e) { parseError = String(e.message || e); }
  if (parseError) {
    return { ...summarize(tests.map((t) => ({ index: t.index, name: `Test ${t.index + 1}`, passed: false, hidden: !!t.hidden, weight: t.weight ?? 1, message: parseError }))), error: parseError };
  }
  const results = tests.map((t) => {
    const base = { index: t.index, name: `Test ${t.index + 1}`, hidden: !!t.hidden, weight: t.weight ?? 1 };
    try {
      const actual = execNosql(mode, input, t.data || []);
      const ok = compareValues(actual, t.expected, { compare: cfg.ordered ? 'exact' : 'unordered', unordered: 'top' });
      return { ...base, passed: ok, message: ok ? undefined : `Got ${short(actual, 160)}` };
    } catch (e) { return { ...base, passed: false, message: String(e.message || e) }; }
  });
  return summarize(results);
}
