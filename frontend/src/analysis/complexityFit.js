// Fits measured (n, value) points to common complexity classes. Pure functions — no DOM, runs in node and in the browser.
//
// value ≈ a·f(n) + b  (a > 0, b ≥ 0), weighted least squares with weights 1/value² (timing noise is multiplicative,
// so relative error is what matters). The simplest class whose relative error is close to the best one wins.

export const MODELS = [
  { id: '1', label: 'O(1)', f: () => 1 },
  { id: 'logn', label: 'O(log n)', f: (n) => Math.log2(Math.max(n, 2)) },
  { id: 'n', label: 'O(n)', f: (n) => n },
  { id: 'nlogn', label: 'O(n log n)', f: (n) => n * Math.log2(Math.max(n, 2)) },
  { id: 'n2', label: 'O(n²)', f: (n) => n * n },
  { id: 'n3', label: 'O(n³)', f: (n) => n * n * n },
  { id: '2n', label: 'O(2ⁿ)', f: (n) => Math.pow(2, Math.min(n, 1000)) },
];
export const modelById = (id) => MODELS.find((m) => m.id === id);

const TIE_FACTOR = 1.6; // a simpler class within 60 % (+ 2 pts) of the best residual is preferred (real timings have systematic curvature: JIT, caches)
const TIE_ABS = 0.02;
const MIN_RANGE = 30; // max n / min n  (≈ 1.5 decades)
const MIN_POINTS = 4;

function fitOne(points, model) {
  const eps = Math.max(...points.map((p) => p.value)) * 1e-6 || 1e-12;
  const maxN = Math.max(...points.map((p) => p.n));
  // keep 2^n finite: evaluate relative to the largest n (scales a, not the shape)
  const f = model.id === '2n' ? (n) => Math.pow(2, n - maxN) : model.f;
  let Sw = 0, Swx = 0, Swy = 0, Swxx = 0, Swxy = 0;
  for (const p of points) {
    const y = Math.max(p.value, eps);
    const w = 1 / (y * y);
    const x = f(p.n);
    Sw += w; Swx += w * x; Swy += w * y; Swxx += w * x * x; Swxy += w * x * y;
  }
  let a; let b;
  if (model.id === '1') { a = 0; b = Swy / Sw; } else {
    const det = Sw * Swxx - Swx * Swx;
    a = det > 0 ? (Sw * Swxy - Swx * Swy) / det : 0;
    b = (Swy - a * Swx) / Sw;
    if (b < 0) { b = 0; a = Swxx > 0 ? Swxy / Swxx : 0; }
    if (!(a > 0)) return null;
  }
  let sse = 0;
  for (const p of points) {
    const y = Math.max(p.value, eps);
    const r = (y - (a * f(p.n) + b)) / y;
    sse += r * r;
  }
  return { model, a, b, f, residual: Math.sqrt(sse / points.length) };
}

/**
 * points: [{ n, value }]  → { id, class, confidence, residual, fitted, alternatives } or { insufficient:true, reason }.
 */
export function fitComplexity(rawPoints, { minRange = MIN_RANGE, exclude = [], tieFactor = TIE_FACTOR } = {}) {
  const points = (rawPoints || []).filter((p) => p && p.n > 0 && Number.isFinite(p.value) && p.value >= 0).sort((x, y) => x.n - y.n);
  if (points.length < MIN_POINTS) return { insufficient: true, reason: `Need at least ${MIN_POINTS} measurements (got ${points.length}).`, points };
  const range = points[points.length - 1].n / points[0].n;
  const only2n = points[points.length - 1].n <= 64; // exponential only makes sense for small n
  const need = only2n ? Math.min(minRange, 3) : minRange; // tiny inputs (e.g. recursion on n<=40) cannot span 1.5 decades
  if (range < need) return { insufficient: true, reason: `Input sizes span only ${range.toFixed(0)}× (need ≥ ${need}×).`, points };

  const fits = MODELS.filter((m) => (m.id !== '2n' || only2n) && !exclude.includes(m.id)).map((m) => fitOne(points, m)).filter(Boolean);
  if (!fits.length) return { insufficient: true, reason: 'Measurements did not follow a growth trend.', points };

  const best = fits.reduce((x, y) => (y.residual < x.residual ? y : x));
  // flat data → O(1) wins whenever it is competitive (a tiny growth is noise)
  const order = MODELS.map((m) => m.id);
  const near = fits.filter((x) => x.residual <= best.residual * tieFactor + TIE_ABS);
  const pick = near.reduce((x, y) => (order.indexOf(y.model.id) < order.indexOf(x.model.id) ? y : x));

  const ranked = [...fits].sort((x, y) => x.residual - y.residual);
  const other = ranked.find((x) => x.model.id !== pick.model.id);
  const margin = other ? other.residual / Math.max(pick.residual, 1e-9) : 10;
  // 'high' needs a clear winner AND enough range to separate neighbouring classes (n vs n log n needs ≥ ~60×)
  const confidence = pick.residual < 0.1 && margin >= 1.8 && range >= 60 ? 'high' : pick.residual < 0.25 ? 'medium' : 'low';

  const lo = points[0].n; const hi = points[points.length - 1].n;
  const fitted = Array.from({ length: 41 }, (_, i) => {
    const n = lo * Math.pow(hi / lo, i / 40);
    return { n, value: pick.a * pick.f(n) + pick.b };
  });
  return {
    id: pick.model.id, class: pick.model.label, confidence, residual: pick.residual,
    a: pick.a, b: pick.b, fitted, points,
    alternatives: ranked.slice(0, 3).map((x) => ({ id: x.model.id, class: x.model.label, residual: x.residual })),
  };
}

/** Reference curve for a class scaled to pass through the last measured point (for the faint guide lines in charts). */
export function referenceCurve(id, points, samples = 41) {
  const m = modelById(id); if (!m || !points.length) return [];
  const lo = points[0].n; const hi = points[points.length - 1].n;
  const last = points[points.length - 1];
  const f = id === '2n' ? (n) => Math.pow(2, n - hi) : m.f;
  const scale = last.value / f(hi);
  return Array.from({ length: samples }, (_, i) => {
    const n = lo * Math.pow(hi / lo, i / (samples - 1));
    return { n, value: scale * f(n) };
  });
}

/** Static-analysis class helper: exponents of n and log n → label.  (2,1) → "O(n² log n)". */
export function labelFromExponents(nExp, logExp, { exponential = false } = {}) {
  if (exponential) return 'O(2ⁿ)';
  const sup = { 2: '²', 3: '³', 4: '⁴', 5: '⁵' };
  if (nExp <= 0 && logExp <= 0) return 'O(1)';
  const nPart = nExp <= 0 ? '' : nExp === 1 ? 'n' : `n${sup[nExp] || `^${nExp}`}`;
  const lPart = logExp <= 0 ? '' : logExp === 1 ? 'log n' : `log${sup[logExp] || `^${logExp}`} n`;
  return `O(${[nPart, lPart].filter(Boolean).join(' ')})`;
}

/** Map exponents to the chart model id nearest to it (for drawing the static guide curve). */
export function modelIdFromExponents(nExp, logExp, exponential = false) {
  if (exponential) return '2n';
  if (nExp <= 0) return logExp > 0 ? 'logn' : '1';
  if (nExp === 1) return logExp > 0 ? 'nlogn' : 'n';
  if (nExp === 2) return 'n2';
  return 'n3';
}
