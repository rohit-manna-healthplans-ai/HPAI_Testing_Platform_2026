// Pure comparison helpers shared by all runners (no browser APIs).

const TOL_DEFAULT = 1e-6;

function stableKey(v) {
  if (Array.isArray(v)) return '[' + v.map(stableKey).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stableKey(v[k])).join(',') + '}';
  if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
  return JSON.stringify(v);
}

/** Canonical form: arrays sorted by stable key. deep=true sorts nested arrays too, otherwise only the top level. */
export function canonicalUnordered(v, deep = true, top = true) {
  if (Array.isArray(v)) {
    const items = v.map((x) => (deep ? canonicalUnordered(x, deep, false) : x));
    if (deep || top) items.sort((a, b) => { const ka = stableKey(a); const kb = stableKey(b); return ka < kb ? -1 : ka > kb ? 1 : 0; });
    return items;
  }
  if (deep && v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = canonicalUnordered(v[k], deep, false);
    return o;
  }
  return v;
}

export function deepEqual(a, b, tol = TOL_DEFAULT) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    return a === b || Math.abs(a - b) <= tol;
  }
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i], tol)) return false;
    return true;
  }
  if (typeof a === 'object') {
    if (Array.isArray(b)) return false;
    const ka = Object.keys(a); const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) { if (!Object.prototype.hasOwnProperty.call(b, k) || !deepEqual(a[k], b[k], tol)) return false; }
    return true;
  }
  return false;
}

/** opts: { compare: 'exact'|'unordered', float_tolerance, unordered: 'deep'|'top' (default deep) } */
export function compareValues(actual, expected, opts = {}) {
  const tol = typeof opts.float_tolerance === 'number' ? opts.float_tolerance : TOL_DEFAULT;
  if (opts.compare === 'unordered') {
    const deep = (opts.unordered || 'deep') === 'deep';
    return deepEqual(canonicalUnordered(actual, deep), canonicalUnordered(expected, deep), tol);
  }
  return deepEqual(actual, expected, tol);
}

export function short(v, max = 120) {
  let s;
  try { s = JSON.stringify(v); } catch { s = String(v); }
  if (s === undefined) s = 'undefined';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Summarise per-test {passed, weight}. */
export function summarize(results) {
  let passed = 0; let total = 0;
  for (const r of results) { const w = r.weight ?? 1; total += w; if (r.passed) passed += w; }
  return { passed, total, results };
}
