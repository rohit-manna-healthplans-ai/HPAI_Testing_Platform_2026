// Measured complexity: runs a candidate's function over growing inputs inside the existing JS / Pyodide workers
// (message type 'bench') and fits the timings. Runs in the reviewer's browser on demand — never during a test.
import { fitComplexity } from './complexityFit.js';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
const WORKER_URL = { javascript: `${BASE}workers/js-worker.js`, python: `${BASE}workers/py-worker.js` };
const START_MS = { javascript: 5000, python: 90000 }; // python start includes the first-time Pyodide download

export const DEFAULT_SIZES = [25, 50, 100, 200, 400, 800, 1600, 3200]; // start small so slow (quadratic) code still spans ≥ 30×
export const DEFAULT_BUDGET_MS = 8000;
export const DEFAULT_PER_SIZE_MS = 1500;

/* ── generic input generator, derived from the types of the first sample test ─────────────────────── */
function describe(v) {
  if (Array.isArray(v)) {
    const e = v[0];
    if (Array.isArray(e)) return 'pairs';
    if (typeof e === 'string') return 'strs';
    return 'nums';
  }
  if (typeof v === 'string') return 'str';
  if (typeof v === 'number') return 'num';
  return 'const';
}
const SCALING = new Set(['nums', 'pairs', 'strs', 'str']);

/** → { sizes, gen } where gen is JS source `(n, rnd) => [args]`. */
export function genericBench(sampleArgs) {
  const args = Array.isArray(sampleArgs) ? sampleArgs : [];
  const kinds = args.map(describe);
  const scales = kinds.some((k) => SCALING.has(k));
  const parts = args.map((v, i) => {
    switch (kinds[i]) {
      case 'nums': return 'Array.from({length:n},()=>Math.floor(rnd()*2001)-1000)';
      case 'pairs': return 'Array.from({length:n},()=>{var s=Math.floor(rnd()*n*2);return [s,s+1+Math.floor(rnd()*20)]})';
      case 'strs': return 'Array.from({length:Math.max(1,Math.floor(n/10))},()=>Array.from({length:3},()=>String.fromCharCode(97+Math.floor(rnd()*26))).join(""))';
      case 'str': return 'Array.from({length:n},()=>String.fromCharCode(97+Math.floor(rnd()*26))).join("")';
      case 'num': return scales ? JSON.stringify(v) : 'n';
      default: return JSON.stringify(v ?? null);
    }
  });
  const soleNumber = !scales && kinds.includes('num');
  return { sizes: soleNumber ? [10, 20, 40, 80, 160, 320, 640] : DEFAULT_SIZES, gen: `(n, rnd) => [${parts.join(', ')}]` };
}

/** question.config.bench wins; otherwise generic inputs. */
export function benchSpec(config, sampleArgs) {
  const b = config?.bench;
  if (b && typeof b.gen === 'string' && Array.isArray(b.sizes) && b.sizes.length >= 4) return { sizes: b.sizes, gen: b.gen, generic: false };
  return { ...genericBench(sampleArgs), generic: true };
}

/* ── worker plumbing ───────────────────────────────────────────────────────────────────────────── */
function defaultFactory(language) { return new Worker(WORKER_URL[language]); }

/**
 * opts: { language:'python'|'javascript'|'typescript', code, config, sampleArgs, onProgress({n,done,total}), factory?, budgetMs?, perSizeMs? }
 * → { points:[{n,ms,bytes}], reason, error?, generic, sizes, language, time, space }
 */
export async function runBench(opts) {
  const { code: rawCode, config = {}, sampleArgs, onProgress, factory = defaultFactory, budgetMs = DEFAULT_BUDGET_MS, perSizeMs = DEFAULT_PER_SIZE_MS } = opts;
  const requested = opts.language;
  const language = requested === 'python' ? 'python' : 'javascript';
  const fn = (config.fn || {})[language === 'python' ? 'py' : 'js'] || (config.fn || {}).js || (config.fn || {}).py;
  const spec = benchSpec(config, sampleArgs);
  const out = { points: [], reason: 'complete', generic: spec.generic, sizes: spec.sizes, language: requested, time: null, space: null };

  let code = String(rawCode || '');
  if (!code.trim()) return { ...out, error: 'No code to analyze.', reason: 'error' };
  if (!fn) return { ...out, error: 'This question has no function signature to benchmark.', reason: 'error' };
  if (requested === 'typescript') {
    try { const { transform } = await import('sucrase'); code = transform(code, { transforms: ['typescript'] }).code; }
    catch (e) { return { ...out, error: `TypeScript: ${String(e.message || e).split('\n')[0]}`, reason: 'error' }; }
  }

  let worker;
  try { worker = factory(language); } catch { return { ...out, error: 'Could not start the benchmark runner.', reason: 'error' }; }

  const result = await new Promise((resolve) => {
    let timer = null; let budgetTimer = null; let finished = false;
    const finish = (extra) => {
      if (finished) return; finished = true; clearTimeout(timer); clearTimeout(budgetTimer);
      worker.removeEventListener('message', onMessage); worker.removeEventListener('error', onError);
      try { worker.terminate(); } catch { /* ignore */ }
      resolve(extra);
    };
    const arm = (ms, reason) => { clearTimeout(timer); timer = setTimeout(() => finish({ reason }), ms); };
    const onMessage = (e) => {
      const m = e.data || {};
      if (m.type === 'started') {
        arm(perSizeMs + 2500, 'timeout');
        budgetTimer = setTimeout(() => finish({ reason: 'budget' }), budgetMs + 2500); // hard stop for the whole measurement
      } else if (m.type === 'bench-point') {
        out.points.push({ n: m.n, ms: m.ms, bytes: m.bytes ?? null });
        if (onProgress) onProgress({ n: m.n, done: out.points.length, total: spec.sizes.length });
        arm(perSizeMs + 2500, 'timeout');
      } else if (m.type === 'bench-error') out.error = out.error || `Your code failed at n = ${m.n}: ${m.message}`;
      else if (m.type === 'bench-done') finish({ reason: m.reason });
      else if (m.type === 'compile-error') finish({ reason: 'error', error: m.message });
      else if (m.type === 'fatal') finish({ reason: 'error', error: m.message });
    };
    const onError = (e) => finish({ reason: 'error', error: e?.message || 'Benchmark runner crashed.' });
    worker.addEventListener('message', onMessage); worker.addEventListener('error', onError);
    arm(START_MS[language], 'timeout'); // until the worker reports 'started' (Pyodide may need to download)
    worker.postMessage({ type: 'bench', code, fn, gen: spec.gen, sizes: spec.sizes, perSizeMs, budgetMs });
  });

  out.reason = result.reason || 'complete';
  if (result.error) out.error = result.error;
  if (out.error && !out.points.length) return out;

  out.points.sort((a, b) => a.n - b.n);
  out.time = fitComplexity(out.points.map((p) => ({ n: p.n, value: p.ms })));
  // allocator granularity / interpreter noise below ~0.5 KB is not signal: clamp so a flat footprint reads as O(1)
  const mem = out.points.filter((p) => p.bytes != null).map((p) => ({ n: p.n, value: Math.max(p.bytes, 512) }));
  // allocator noise makes n log n indistinguishable from n for memory, so it is not offered; ties go to the simpler class
  out.space = mem.length >= 4 ? fitComplexity(mem, { exclude: ['nlogn', '2n'], tieFactor: 1.7 }) : null;
  return out;
}
