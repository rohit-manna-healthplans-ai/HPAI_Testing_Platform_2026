// Coding runner: executes candidate code in Web Workers (JS) / Pyodide worker (Python) and marks against test cases.
import { compareValues, summarize, short } from './compare.js';
import { starterFor, languageKind } from './languages.js';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
const WORKER_URL = { javascript: `${BASE}workers/js-worker.js`, python: `${BASE}workers/py-worker.js` };

const LIMITS = {
  javascript: { startMs: 5000, perTestMs: 3000 },
  python: { startMs: 90000, perTestMs: 6000 }, // start includes first-time Pyodide download
};

let pyWorker = null;
let queue = Promise.resolve();

function getWorker(language, factory) {
  if (factory) return factory(language);
  if (language === 'python') {
    if (!pyWorker) pyWorker = new Worker(WORKER_URL.python);
    return pyWorker;
  }
  return new Worker(WORKER_URL.javascript);
}

function dispose(language, worker) {
  try { worker.terminate(); } catch { /* ignore */ }
  if (language === 'python' && pyWorker === worker) pyWorker = null;
}

/** Preload the Python runtime so the first Run is fast. Safe to call repeatedly. */
export function warmUpPython() {
  try {
    const w = getWorker('python');
    w.postMessage({ type: 'warmup' });
  } catch { /* ignore */ }
}

export function starterCode(question, language) {
  return starterFor(language, question);
}

function execute({ language, code, fn, tests, factory }) {
  const limits = LIMITS[language];
  return new Promise((resolve) => {
    let worker;
    try { worker = getWorker(language, factory); } catch (e) { resolve({ outcomes: {}, fatal: 'Could not start the code runner.' }); return; }
    const outcomes = {};
    let timer = null;
    let finished = false;
    const finish = (extra = {}) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      if (language === 'javascript' && !extra.timedOut) { try { worker.terminate(); } catch { /* ignore */ } }
      resolve({ outcomes, ...extra });
    };
    const arm = (ms) => {
      clearTimeout(timer);
      timer = setTimeout(() => { dispose(language, worker); finish({ timedOut: true }); }, ms);
    };
    const onMessage = (e) => {
      const m = e.data || {};
      if (m.type === 'started') arm(limits.perTestMs);
      else if (m.type === 'compile-error') finish({ compileError: m.message });
      else if (m.type === 'result') { outcomes[m.index] = m; arm(limits.perTestMs); }
      else if (m.type === 'done') finish();
      else if (m.type === 'fatal') { dispose(language, worker); finish({ fatal: m.message }); }
    };
    const onError = (e) => { dispose(language, worker); finish({ fatal: e?.message || 'Runner crashed.' }); };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    arm(limits.startMs);
    worker.postMessage({ type: 'run', code, fn, tests: tests.map((t) => ({ index: t.index, args: t.args })) });
  });
}

/**
 * response: { language, code }.  opts: { onlyVisible, onProgress, factory (tests only) }
 * Returns { passed, total, results:[{index,name,passed,hidden,weight,message?}], error? }
 */
export function runCoding(question, response, opts = {}) {
  const run = () => runCodingNow(question, response, opts);
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

async function runCodingNow(question, response, { onlyVisible = false, onProgress, factory } = {}) {
  const cfg = question.config || {};
  const requested = response?.language || 'python';
  let code = String(response?.code || '');

  const tests = (question.tests || []).map((t, index) => ({ ...t, index })).filter((t) => !onlyVisible || !t.hidden);
  const base = (t) => ({ index: t.index, name: `Test ${t.index + 1}`, hidden: !!t.hidden, weight: t.weight ?? 1 });
  const failAll = (message) => ({ ...summarize(tests.map((t) => ({ ...base(t), passed: false, message }))), error: message });

  if (!code.trim()) return failAll('No code written.');

  // Languages without a browser runtime: syntax-checked only (full marks for clean syntax).
  if (languageKind(requested) === 'syntax') {
    const { runSyntaxOnly } = await import('./syntaxCheck.js');
    return runSyntaxOnly(question, { ...response, language: requested });
  }

  // TypeScript is transpiled to JavaScript in the browser (types are stripped, not checked).
  const language = requested === 'python' ? 'python' : 'javascript';
  const fnName = (cfg.fn || {})[language === 'python' ? 'py' : 'js'] || (cfg.fn || {}).js || (cfg.fn || {}).py;
  if (requested === 'typescript') {
    try {
      const { transform } = await import('sucrase');
      code = transform(code, { transforms: ['typescript'] }).code;
    } catch (e) { return failAll(`TypeScript: ${String(e.message || e).split('\n')[0]}`); }
  }
  if (!tests.length) {
    // Still validate that the code compiles / defines the function.
    if (onProgress) onProgress({ done: 0, total: 0 });
    const out = await execute({ language, code, fn: fnName, tests: [], factory });
    const err = out.compileError || out.fatal || (out.timedOut ? 'Time limit exceeded.' : null);
    return { passed: 0, total: 0, results: [], error: err || undefined };
  }

  const out = await execute({ language, code, fn: fnName, tests, factory });
  if (out.compileError) return failAll(out.compileError);
  if (out.fatal) return failAll(out.fatal);

  const results = tests.map((t) => {
    const o = out.outcomes[t.index];
    if (!o) return { ...base(t), passed: false, message: out.timedOut ? 'Time limit exceeded.' : 'No result.' };
    if (o.error) return { ...base(t), passed: false, message: o.error };
    let actual;
    try { actual = JSON.parse(o.json); } catch { return { ...base(t), passed: false, message: 'Return value could not be read.' }; }
    const ok = compareValues(actual, t.expected, { compare: cfg.compare, float_tolerance: cfg.float_tolerance });
    return { ...base(t), passed: ok, message: ok ? undefined : `Expected ${short(t.expected)} but got ${short(actual)}` };
  });
  if (onProgress) onProgress({ done: results.length, total: results.length });
  return summarize(results);
}
