// Validates backend/seed/q_other.js. Run from repo root: node backend/seed/validate_other.js
//   sql   : re-runs reference.sql with sql.js and compares rows to tests[i].expected
//   nosql : re-runs reference with mingo and compares to expected
//   ui    : structure + (if jsdom is available) buggy starter must fail most checks, reference must pass all
//   mcq   : structure
// jsdom is optional (not a repo dependency): set JSDOM_DIR=<folder containing node_modules/jsdom> to enable the UI run.
import { createRequire } from 'node:module';
import path from 'node:path';
import { sql, nosql, ui, mcq } from './q_other.js';
import { sqlRun, nosqlRun, sameSet, canon } from './gen/lib.js';

const errors = [];
const warn = [];
const err = (m) => errors.push(m);
const SUBJECTS = { sql: 'SQL', nosql: 'NoSQL (MongoDB)', ui: 'Quick Dev (UI Debug)', mcq: 'AI/ML' };

function commonChecks(q, kind) {
  const id = `${kind}:${q.title}`;
  if (q.subject !== SUBJECTS[kind]) err(`${id} wrong subject ${q.subject}`);
  if (q.type !== kind) err(`${id} wrong type`);
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) err(`${id} bad difficulty`);
  if (!q.title || !q.statement) err(`${id} missing title/statement`);
  if (!(q.marks > 0) || !(q.time_mins > 0)) err(`${id} bad marks/time`);
  if (!Array.isArray(q.tags)) err(`${id} tags must be array`);
  return id;
}

// ---- SQL
for (const q of sql) {
  const id = commonChecks(q, 'sql');
  if (q.tests.length < 4) err(`${id} needs >=4 tests`);
  const hidden = q.tests.filter((t) => t.hidden).length;
  if (hidden < 1 || hidden === q.tests.length) err(`${id} hidden split bad (${hidden}/${q.tests.length})`);
  if (q.tests.every((t) => t.hidden)) err(`${id} no visible test`);
  const distinct = new Set(q.tests.map((t) => canon(t.expected.rows))).size;
  if (distinct < 3) warn.push(`${id} only ${distinct} distinct expected outputs`);
  for (const [i, t] of q.tests.entries()) {
    try {
      const got = await sqlRun(q.config.schema_sql, t.setup_sql, q.reference.sql);
      if (got.columns.length !== t.expected.columns.length) err(`${id} test${i} column count mismatch`);
      if (!sameSet(got.rows, t.expected.rows, !!q.config.ordered)) err(`${id} test${i} rows mismatch`);
    } catch (e) { err(`${id} test${i} sql error: ${e.message}`); }
  }
}

// ---- NoSQL
for (const q of nosql) {
  const id = commonChecks(q, 'nosql');
  if (!['find', 'aggregate'].includes(q.config.mode)) err(`${id} bad mode`);
  if (q.tests.length < 4) err(`${id} needs >=4 tests`);
  const hidden = q.tests.filter((t) => t.hidden).length;
  if (hidden < 1 || hidden === q.tests.length) err(`${id} hidden split bad`);
  const distinct = new Set(q.tests.map((t) => canon(t.expected))).size;
  if (distinct < 3) warn.push(`${id} only ${distinct} distinct expected outputs`);
  for (const [i, t] of q.tests.entries()) {
    try {
      const got = nosqlRun(q.config.mode, q.reference, t.data);
      if (!sameSet(got, t.expected, !!q.config.ordered)) err(`${id} test${i} result mismatch`);
    } catch (e) { err(`${id} test${i} mingo error: ${e.message}`); }
  }
}

// ---- MCQ
for (const q of mcq) {
  const id = commonChecks(q, 'mcq');
  const c = q.config;
  if (!Array.isArray(c.options) || c.options.length < 3) err(`${id} options<3`);
  if (!Array.isArray(c.correct) || !c.correct.length || c.correct.some((i) => !Number.isInteger(i) || i < 0 || i >= c.options.length)) err(`${id} bad correct`);
  if (!c.multiple && c.correct.length !== 1) err(`${id} single-answer must have exactly one correct`);
  if (c.multiple && c.correct.length < 2) err(`${id} multiple needs >=2 correct`);
  if (new Set(c.options).size !== c.options.length) err(`${id} duplicate options`);
  if (!c.scenario) err(`${id} missing scenario`);
  if (q.tests.length) err(`${id} mcq tests must be []`);
}

// ---- UI
let JSDOM = null, VirtualConsole = null;
try {
  const dir = process.env.JSDOM_DIR;
  const mod = dir ? createRequire(path.join(dir, 'x.js'))('jsdom') : await import('jsdom');
  JSDOM = mod.JSDOM; VirtualConsole = mod.VirtualConsole;
} catch { warn.push('jsdom not available: UI starter/reference behaviour NOT executed (set JSDOM_DIR)'); }

const inline = (files) => files['index.html']
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>${files['style.css'] || ''}</style>`)
  .replace('<script src="script.js"></script>', () => `<script>${files['script.js'] || ''}</script>`);

async function runChecks(files, tests) {
  const dom = new JSDOM(inline(files), { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  const w = dom.window;
  await new Promise((r) => setTimeout(r, 60));
  const AF = w.eval('(async function(){}).constructor');
  const res = [];
  for (const t of tests) {
    try { res.push(!!(await new AF(t.check).call(w))); } catch { res.push(false); }
  }
  w.close();
  return res;
}

const uiStats = [];
for (const q of ui) {
  const id = commonChecks(q, 'ui');
  const f = q.config.files;
  if (!f['index.html'] || !f['style.css'] || !f['script.js']) err(`${id} missing files`);
  if (!f['index.html'].includes('<link rel="stylesheet" href="style.css">') || !f['index.html'].includes('<script src="script.js"></script>')) err(`${id} index.html missing link/script tags`);
  if (q.tests.length < 4 || q.tests.length > 6) err(`${id} needs 4-6 checks`);
  if (!q.tests.some((t) => t.hidden) || q.tests.every((t) => t.hidden)) err(`${id} hidden split bad`);
  for (const t of q.tests) {
    if (!t.name) err(`${id} check without name`);
    try { new Function(`return (async function(){ ${t.check} })`); } catch (e) { err(`${id} check "${t.name}" does not parse: ${e.message}`); }
  }
  if (JSDOM) {
    const starter = await runChecks(f, q.tests);
    const ref = await runChecks(q.reference.files, q.tests);
    const sp = starter.filter(Boolean).length, rp = ref.filter(Boolean).length;
    uiStats.push(`${q.title}: starter ${sp}/${q.tests.length}, reference ${rp}/${q.tests.length}`);
    if (rp !== q.tests.length) err(`${id} reference fails checks: ${q.tests.filter((_, i) => !ref[i]).map((t) => t.name).join(' | ')}`);
    if (sp > Math.floor(q.tests.length / 2)) err(`${id} starter passes too many checks (${sp}/${q.tests.length})`);
  }
}

const count = (arr) => ['easy', 'medium', 'hard'].map((d) => `${d}:${arr.filter((q) => q.difficulty === d).length}`).join(' ');
console.log(`sql   ${sql.length}  (${count(sql)})`);
console.log(`nosql ${nosql.length}  (${count(nosql)})`);
console.log(`ui    ${ui.length}  (${count(ui)})`);
console.log(`mcq   ${mcq.length} (${count(mcq)}), multiple: ${mcq.filter((q) => q.config.multiple).length}`);
uiStats.forEach((s) => console.log('  ui ' + s));
warn.forEach((w) => console.log('WARN ' + w));
if (errors.length) { console.log(`\nFAILED (${errors.length}):`); errors.forEach((e) => console.log(' - ' + e)); process.exit(1); }
console.log('\nOK: all validations passed');
