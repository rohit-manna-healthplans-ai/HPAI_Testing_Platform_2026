// Validates the 20 short coding questions in q_coding2.js.
//   node question-bank/validate_coding2.js            (exit code 1 on any problem)
//
// For every question it checks the structure (10 tests = 3 visible + 7 hidden, 2-4 minutes, marks by level, unique title),
// runs EVERY valid solution (primary reference + alt_references in JS, py_references in Python) against all 10 tests with the
// SAME comparison the app uses (frontend/src/runners/compare.js), runs deliberately WRONG solutions and requires that at
// least 2 HIDDEN tests catch each of them, and exercises config.bench.
//
// Python runs in Pyodide (the same runtime the browser worker uses) when it can be found: set PYODIDE_DIR to a folder that has
// node_modules/pyodide (default: question-bank/, ../frontend/ and the current directory are searched). If Pyodide is not found
// the system `python` is used instead (and the report says so).
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { coding2, SOLUTIONS } from './q_coding2.js';
import { coding } from './q_coding.js';
import { sql, nosql, ui, mcq } from './q_other.js';
import { compareValues } from '../frontend/src/runners/compare.js';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const expectedMarks = { easy: 10, medium: 20, hard: 30 };
const expectedMix = { easy: 8, medium: 8, hard: 4 };

// titles of every OTHER question (ml / cloud files may not exist yet, or may be empty)
const others = [...coding, ...sql, ...nosql, ...ui, ...mcq];
for (const f of ['./q_ml.js', './q_cloud.js']) {
  try { const m = await import(f); for (const v of Object.values(m)) if (Array.isArray(v)) others.push(...v); } catch { /* not there yet */ }
}
const otherTitles = new Set(others.map((q) => q.title));

// ───────────────────────────── Python runtime ─────────────────────────────
const PY_HELPERS = `
import json
_ns = {}
def _hpai_load(code):
    global _ns
    _ns = {"__name__": "__main__"}
    exec(compile(code, "<solution>", "exec"), _ns)
def _hpai_call(fn, args_json):
    f = _ns.get(fn)
    if not callable(f):
        raise NameError("function %s is not defined" % fn)
    def _d(o):
        if isinstance(o, (set, frozenset)):
            return sorted(o)
        raise TypeError("Object of type %s is not JSON serializable" % type(o).__name__)
    return json.dumps(f(*json.loads(args_json)), default=_d, allow_nan=False)
`;

async function makePyRunner() {
  const bases = [process.env.PYODIDE_DIR, here, path.join(here, '..', 'frontend'), process.cwd()].filter(Boolean);
  for (const base of bases) {
    try {
      const req = createRequire(path.join(base, 'noop.js'));
      const file = req.resolve('pyodide/pyodide.mjs');
      const { loadPyodide } = await import(pathToFileURL(file).href);
      const py = await loadPyodide();
      py.runPython(PY_HELPERS);
      const load = py.globals.get('_hpai_load');
      const call = py.globals.get('_hpai_call');
      return {
        name: `Pyodide (${path.relative(process.cwd(), path.dirname(file)) || '.'})`,
        run(code, fn, argsList) {
          try { load(code); } catch (e) { return argsList.map(() => ({ error: `load: ${String(e.message).split('\n').filter(Boolean).pop()}` })); }
          return argsList.map((args) => {
            try { return { value: JSON.parse(call(fn, JSON.stringify(args))) }; }
            catch (e) { return { error: String(e.message).split('\n').filter(Boolean).pop() }; }
          });
        },
      };
    } catch { /* try next base */ }
  }
  // fallback: system python
  const exe = ['python', 'python3', 'py'].find((c) => spawnSync(c, ['--version']).status === 0);
  if (!exe) return null;
  const harness = `${PY_HELPERS}
import sys
payload = json.loads(sys.stdin.read())
out = []
try:
    _hpai_load(payload["code"])
    loaded = None
except Exception as e:
    loaded = "load: " + str(e).split("\\n")[-1]
for args in payload["tests"]:
    if loaded:
        out.append({"error": loaded}); continue
    try:
        out.append({"value": json.loads(_hpai_call(payload["fn"], json.dumps(args)))})
    except Exception as e:
        out.append({"error": str(e).split("\\n")[-1] or type(e).__name__})
print(json.dumps(out))
`;
  return {
    name: `system ${exe} (Pyodide not found)`,
    run(code, fn, argsList) {
      const r = spawnSync(exe, ['-c', harness], { input: JSON.stringify({ code, fn, tests: argsList }), encoding: 'utf8', maxBuffer: 1 << 26 });
      if (r.status !== 0) return argsList.map(() => ({ error: `python failed: ${(r.stderr || '').split('\n').filter(Boolean).pop()}` }));
      return JSON.parse(r.stdout);
    },
  };
}
const pyRunner = await makePyRunner();

// ───────────────────────────── helpers ─────────────────────────────
const short = (v, n = 70) => { let s; try { s = JSON.stringify(v); } catch { s = String(v); } return s === undefined ? 'undefined' : s.length > n ? s.slice(0, n - 1) + '…' : s; };

function compile(src, name) {
  try { return { fn: new Function(`${src}\nreturn ${name};`)() }; } catch (e) { return { error: `compile error: ${e.message}` }; }
}

/** -> array of { ok, got? , error? } for each test */
function runJs(src, name, q) {
  const c = compile(src, name);
  return q.tests.map((t) => {
    if (c.error) return { ok: false, error: c.error };
    try {
      const got = c.fn(...structuredClone(t.args));
      if (got === undefined) return { ok: false, error: 'returned undefined' };
      let j; try { j = JSON.parse(JSON.stringify(got)); } catch { return { ok: false, error: 'result is not JSON-serialisable' }; }
      return { ok: compareValues(j, t.expected, { compare: q.config.compare, float_tolerance: q.config.float_tolerance }), got: j };
    } catch (e) { return { ok: false, error: `threw: ${e.message}` }; }
  });
}

function runPy(src, q) {
  const res = pyRunner.run(src, q.config.fn.py, q.tests.map((t) => structuredClone(t.args)));
  return res.map((r, i) => (r.error ? { ok: false, error: r.error } : { ok: compareValues(r.value, q.tests[i].expected, { compare: q.config.compare, float_tolerance: q.config.float_tolerance }), got: r.value }));
}

const problems = [];
const rows = [];
const counts = { easy: 0, medium: 0, hard: 0 };
const seenTitles = new Set();
const problem = (q, msg) => { problems.push(`[${q.title}] ${msg}`); };

if (!pyRunner) console.error('WARNING: neither Pyodide nor a system python could be found - Python solutions are NOT validated.');
else console.log(`Python runtime: ${pyRunner.name}\n`);

for (const q of coding2) {
  counts[q.difficulty] = (counts[q.difficulty] || 0) + 1;
  const issues0 = problems.length;

  // ── structure
  if (seenTitles.has(q.title)) problem(q, 'duplicate title inside q_coding2.js'); seenTitles.add(q.title);
  if (otherTitles.has(q.title)) problem(q, 'title already used by another question');
  if (q.subject !== 'Programming (DSA)' || q.type !== 'coding') problem(q, 'subject/type must be "Programming (DSA)" / "coding"');
  if (q.marks !== expectedMarks[q.difficulty]) problem(q, `marks ${q.marks}, expected ${expectedMarks[q.difficulty]}`);
  if (!(q.time_mins >= 2 && q.time_mins <= 4)) problem(q, `time_mins ${q.time_mins} outside 2..4`);
  if (q.difficulty === 'easy' && q.time_mins > 3) problem(q, 'easy questions take 2-3 minutes');
  if (q.difficulty === 'medium' && q.time_mins < 3) problem(q, 'medium questions take 3-4 minutes');
  if (q.difficulty === 'hard' && q.time_mins !== 4) problem(q, 'hard (short) questions take 4 minutes');
  if (q.tests.length !== 10) problem(q, `${q.tests.length} tests (want exactly 10)`);
  const visible = q.tests.filter((t) => !t.hidden).length;
  const hidden = q.tests.filter((t) => t.hidden).length;
  if (visible !== 3 || hidden !== 7) problem(q, `visible/hidden = ${visible}/${hidden} (want 3/7)`);
  if (q.tests.slice(0, 3).some((t) => t.hidden) || q.tests.slice(3).some((t) => !t.hidden)) problem(q, 'the first 3 tests must be visible and the next 7 hidden');
  const cfg = q.config || {};
  if (!cfg.fn?.js || !cfg.fn?.py || !Array.isArray(cfg.fn.params) || !cfg.fn.params.length) problem(q, 'config.fn incomplete');
  if (!cfg.examples?.length || !cfg.constraints?.length) problem(q, 'missing examples/constraints');
  if (!Array.isArray(cfg.languages) || !cfg.languages.includes('python') || !cfg.languages.includes('javascript')) problem(q, 'config.languages must list python and javascript');
  if (!q.statement || !/Input:/.test(q.statement) || !/Output:/.test(q.statement)) problem(q, 'statement needs Input:/Output: lines');
  if (!q.reference || !q.reference.includes(`function ${cfg.fn?.js}(`)) problem(q, 'reference missing / wrong function name');
  if (q.tests.some((t) => !Array.isArray(t.args) || t.args.length !== cfg.fn?.params?.length)) problem(q, 'a test has the wrong number of args');
  if (!/^[a-z][A-Za-z0-9]*$/.test(cfg.fn?.js || '') || !/^[a-z][a-z0-9_]*$/.test(cfg.fn?.py || '')) problem(q, 'fn names must be camelCase (js) / snake_case (py)');
  if (JSON.stringify(Object.keys(q)).includes('alt_references')) problem(q, 'dev-only solutions must stay in SOLUTIONS, not on the question');

  const sol = SOLUTIONS[q.title];
  if (!sol) { problem(q, 'no entry in SOLUTIONS'); rows.push({ level: q.difficulty, title: q.title, status: 'FAIL' }); continue; }
  if ((sol.alt || []).length < 2) problem(q, `needs >= 2 alternative JS solutions (has ${(sol.alt || []).length})`);
  if ((sol.py || []).length < 1) problem(q, 'needs >= 1 Python solution');
  if ((sol.wrong || []).length < 2) problem(q, `needs >= 2 wrong solutions (has ${(sol.wrong || []).length})`);

  // ── every VALID solution must pass all 10 tests
  let validRuns = 0;
  const check = (label, results) => {
    validRuns++;
    results.forEach((r, i) => { if (!r.ok) problem(q, `${label} fails test ${i + 1}: ${r.error || `got ${short(r.got)} expected ${short(q.tests[i].expected)}`} (args ${short(q.tests[i].args, 50)})`); });
  };
  check('reference', runJs(q.reference, cfg.fn.js, q));
  (sol.alt || []).forEach((s, i) => { if (!s.includes(`function ${cfg.fn.js}(`)) problem(q, `alt #${i + 1} has the wrong function name`); check(`alt #${i + 1} (JS)`, runJs(s, cfg.fn.js, q)); });
  if (pyRunner) (sol.py || []).forEach((s, i) => { if (!s.includes(`def ${cfg.fn.py}(`)) problem(q, `py #${i + 1} has the wrong function name`); check(`py #${i + 1} (Python)`, runPy(s, q)); });

  // ── WRONG solutions must be caught by >= 2 hidden tests
  const wrongInfo = [];
  (sol.wrong || []).forEach((s, i) => {
    const res = runJs(s, cfg.fn.js, q);
    const failHidden = res.filter((r, k) => !r.ok && q.tests[k].hidden).length;
    const failAll = res.filter((r) => !r.ok).length;
    wrongInfo.push(`${failHidden}h/${failAll}`);
    if (failHidden < 2) problem(q, `wrong #${i + 1} is caught by only ${failHidden} hidden test(s) (${failAll} in total) - add a test that exposes it`);
    if (failAll === q.tests.length) { /* fully wrong is fine */ }
  });

  // ── bench
  let benchOk = '-';
  const bench = cfg.bench;
  if (!bench || typeof bench.gen !== 'string' || !Array.isArray(bench.sizes) || bench.sizes.length < 4) problem(q, 'missing/invalid config.bench');
  else {
    try {
      let seed = 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      const gen = new Function(`return (${bench.gen})`)();
      const c = compile(q.reference, cfg.fn.js);
      const kind = (v) => (Array.isArray(v) ? 'array' : typeof v);
      const want = kind(q.tests[0].expected);
      const span = bench.sizes[bench.sizes.length - 1] / bench.sizes[0];
      if (span < 30) problem(q, `bench sizes span only ${span.toFixed(0)}x (<30x)`);
      const t0 = Date.now(); let ran = 0;
      for (const n of bench.sizes) {
        const args = gen(n, rnd);
        if (!Array.isArray(args) || args.length !== cfg.fn.params.length) { problem(q, `bench gen(${n}) did not return ${cfg.fn.params.length} args`); break; }
        const s = Date.now(); const out = c.fn(...args); const dt = Date.now() - s;
        if (kind(out) !== want) { problem(q, `bench n=${n}: result is ${kind(out)}, expected ${want}`); break; }
        ran++;
        if (dt > 1500 || Date.now() - t0 > 6000) { problem(q, `bench n=${n} too slow for the reference (${dt} ms)`); break; }
      }
      benchOk = `${ran}/${bench.sizes.length}`;
    } catch (e) { problem(q, `bench error: ${e.message}`); }
  }

  rows.push({
    level: q.difficulty, title: q.title, mins: q.time_mins, marks: q.marks, tests: `${visible}+${hidden}`,
    'valid runs': validRuns, 'wrong caught (hidden/all)': wrongInfo.join(' '), bench: benchOk, status: problems.length === issues0 ? 'ok' : 'FAIL',
  });
}

if (coding2.length !== 20) problems.push(`expected 20 questions, found ${coding2.length}`);
for (const [d, n] of Object.entries(expectedMix)) if (counts[d] !== n) problems.push(`mix: ${counts[d] || 0} ${d} (want ${n})`);

console.table(rows);
console.log(`Questions: ${coding2.length} (easy ${counts.easy}, medium ${counts.medium}, hard ${counts.hard})`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('All valid solutions (JS + Python) pass all 10 tests of every question; every wrong solution is caught by >= 2 hidden tests.');
