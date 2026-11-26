// Validates the coding seed: runs each question's reference solution against all of its tests.
// Usage: node backend/seed/validate_coding.js   (exit code 1 on any problem)
import { coding } from './q_coding.js';

const canon = (v) => JSON.stringify(v);
const sortedCanon = (v) => (Array.isArray(v) ? canon([...v].map(canon).sort()) : canon(v));
const close = (a, b, tol) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol;

function same(actual, expected, cfg) {
  if (cfg.compare === 'unordered') return sortedCanon(actual) === sortedCanon(expected);
  if (cfg.float_tolerance && close(actual, expected, cfg.float_tolerance)) return true;
  return canon(actual) === canon(expected);
}

let problems = 0;
const rows = [];
const counts = { easy: 0, medium: 0, hard: 0 };
const expectedMarks = { easy: 10, medium: 20, hard: 30 };
const titles = new Set();

for (const q of coding) {
  const issues = [];
  counts[q.difficulty] = (counts[q.difficulty] || 0) + 1;
  if (titles.has(q.title)) issues.push('duplicate title');
  titles.add(q.title);
  if (q.marks !== expectedMarks[q.difficulty]) issues.push(`marks ${q.marks}`);
  if (q.tests.length < 6 || q.tests.length > 8) issues.push(`${q.tests.length} tests (want 6-8)`);
  const hidden = q.tests.filter((t) => t.hidden).length;
  if (hidden < 2 || hidden > q.tests.length - 2) issues.push(`hidden=${hidden}`);
  if (!q.config?.fn?.js || !q.config?.fn?.py || !Array.isArray(q.config.fn.params)) issues.push('fn config incomplete');
  if (!q.config?.examples?.length || !q.config?.constraints?.length) issues.push('missing examples/constraints');
  if (!q.reference || !q.reference.includes(`function ${q.config.fn.js}(`)) issues.push('reference missing / wrong name');

  let passed = 0;
  let fn = null;
  try {
    fn = new Function(`${q.reference}\nreturn ${q.config.fn.js};`)();
  } catch (e) {
    issues.push(`reference compile error: ${e.message}`);
  }
  if (fn) {
    q.tests.forEach((t, i) => {
      try {
        const actual = fn(...structuredClone(t.args));
        if (same(actual, t.expected, q.config)) passed++;
        else issues.push(`test ${i + 1}: got ${canon(actual).slice(0, 60)} expected ${canon(t.expected).slice(0, 60)}`);
      } catch (e) {
        issues.push(`test ${i + 1} threw: ${e.message}`);
      }
    });
  }
  // Complexity benchmark inputs: gen must produce valid args at every size and the reference must run within a budget.
  let benchOk = '-';
  const bench = q.config?.bench;
  if (!bench || typeof bench.gen !== 'string' || !Array.isArray(bench.sizes) || bench.sizes.length < 4) issues.push('missing/invalid config.bench');
  else if (fn) {
    try {
      let seed = 1; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
      const gen = new Function(`return (${bench.gen})`)();
      const kind = (v) => (Array.isArray(v) ? 'array' : typeof v);
      const want = kind(q.tests[0].expected);
      const span = bench.sizes[bench.sizes.length - 1] / bench.sizes[0];
      if (span < 30) issues.push(`bench sizes span only ${span.toFixed(0)}x (<30x)`);
      const t0 = Date.now(); let ran = 0;
      for (const n of bench.sizes) {
        const args = gen(n, rnd);
        if (!Array.isArray(args) || args.length !== q.config.fn.params.length) { issues.push(`bench gen(${n}) did not return ${q.config.fn.params.length} args`); break; }
        const s = Date.now(); const out = fn(...args); const dt = Date.now() - s;
        if (kind(out) !== want) { issues.push(`bench n=${n}: result is ${kind(out)}, expected ${want}`); break; }
        ran++;
        if (dt > 1500 || Date.now() - t0 > 6000) { issues.push(`bench n=${n} too slow for the reference (${dt} ms)`); break; }
      }
      benchOk = `${ran}/${bench.sizes.length}`;
    } catch (e) { issues.push(`bench error: ${e.message}`); }
  }
  if (issues.length) problems++;
  rows.push({ difficulty: q.difficulty, title: q.title, mins: q.time_mins, marks: q.marks, tests: `${passed}/${q.tests.length}`, hidden, bench: benchOk, status: issues.length ? 'FAIL' : 'ok' });
  issues.forEach((m) => console.error(`  [${q.title}] ${m}`));
}

console.table(rows);
console.log(`Questions: ${coding.length} (easy ${counts.easy}, medium ${counts.medium}, hard ${counts.hard})`);
if (problems) {
  console.error(`${problems} question(s) with problems`);
  process.exit(1);
}
console.log('All reference solutions pass all tests.');
