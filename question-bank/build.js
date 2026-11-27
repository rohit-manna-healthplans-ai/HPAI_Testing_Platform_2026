// Generates the two committed catalog files from the question-bank sources:
//   frontend/src/bank/questions.generated.js   full questions (statements, config, tests) — read by the browser
//   backend/src/catalog.generated.js           metadata only (id, subject, difficulty, title, marks, time, tags)
// Usage: npm run build-bank   (from question-bank/)  — then commit both generated files.
import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { subjects, questions } from './questions.js';
import { isInteractive, prepareInteractive } from './interactive.js';
import { coding2 } from './q_coding2.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRONT = path.join(root, 'frontend/src/bank/questions.generated.js');
const BACK = path.join(root, 'backend/src/catalog.generated.js');

// ---- Sealed bank: answers (hidden tests, MCQ correct options, UI check sources) are AES-256-GCM encrypted ----
// Per-question key = HMAC-SHA256(BANK_MASTER_KEY, 'hpai-bank-v1:' + id). The master lives ONLY in env (backend/.env locally,
// Render env in production). The backend releases a question's key only to the candidate attempting it (while in progress)
// or to an admin who re-enters their password.
function readMaster() {
  let m = process.env.BANK_MASTER_KEY;
  const envFile = path.join(root, 'backend/.env');
  if (!m && existsSync(envFile)) m = (readFileSync(envFile, 'utf8').match(/^BANK_MASTER_KEY=(.+)$/m) || [])[1]?.trim();
  if (!m || !/^[0-9a-fA-F]{64}$/.test(m)) throw new Error('BANK_MASTER_KEY (64 hex chars) is required: set it in the environment or backend/.env');
  return Buffer.from(m, 'hex');
}
const MASTER = readMaster();
const deriveKey = (id) => createHmac('sha256', MASTER).update('hpai-bank-v1:' + id).digest();
function seal(id, payload) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', deriveKey(id), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(payload), 'utf8'), c.final(), c.getAuthTag()]);
  return { iv: iv.toString('base64'), ct: ct.toString('base64') };
}
function unseal(id, sealed, key = deriveKey(id)) {
  const iv = Buffer.from(sealed.iv, 'base64'); const buf = Buffer.from(sealed.ct, 'base64');
  const d = createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(buf.subarray(buf.length - 16));
  return JSON.parse(Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString('utf8'));
}

const ORDER = { easy: 0, medium: 1, hard: 2 };
const subjectIndex = new Map(subjects.map((s, i) => [s.id, i]));
const sorted = [...questions].sort((a, b) =>
  subjectIndex.get(a.subject_id) - subjectIndex.get(b.subject_id) || ORDER[a.difficulty] - ORDER[b.difficulty] || a.id.localeCompare(b.id));

const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
// Interactive (drag & drop) questions: ids are rewritten to opaque ids, public lists shuffled, scoring units derived.
// `solutions` keeps each reference answer for sealing only; it is never put into `full`/`pub`.
const solutions = new Map();
const infoById = new Map();
const full = sorted.map((q) => {
  let config = q.config || {}; let tests = q.tests || [];
  if (isInteractive(q.type)) {
    const p = prepareInteractive(q);
    config = p.config; tests = p.units; solutions.set(q.id, p.reference); infoById.set(q.id, p.info);
  }
  return {
    id: q.id, subject_id: q.subject_id, subject_name: subjectName.get(q.subject_id), type: q.type, difficulty: q.difficulty,
    title: q.title, statement: q.statement, marks: q.marks, time_mins: q.time_mins, tags: q.tags || [], config, tests,
  };
});

// Rules for the short coding questions added in v1.1 (q_coding2.js): 2-4 minutes, exactly 10 tests = 3 visible + 7 hidden.
{
  const titles = new Set(coding2.map((q) => q.title));
  for (const q of full.filter((x) => titles.has(x.title))) {
    if (q.type !== 'coding') throw new Error(`${q.id}: q_coding2.js questions must be type "coding"`);
    if (!Number.isInteger(q.time_mins) || q.time_mins < 2 || q.time_mins > 4) throw new Error(`${q.id}: time_mins must be 2..4 (got ${q.time_mins})`);
    if (q.tests.length !== 10) throw new Error(`${q.id}: needs exactly 10 tests (got ${q.tests.length})`);
    q.tests.forEach((t, i) => {
      if (i < 3 && t.hidden === true) throw new Error(`${q.id}: test ${i + 1} must be visible (first 3 tests are visible)`);
      if (i >= 3 && t.hidden !== true) throw new Error(`${q.id}: test ${i + 1} must be hidden (tests 4-10 are hidden)`);
    });
  }
}
const catalog = full.map(({ id, subject_id, subject_name, type, difficulty, title, marks, time_mins, tags }) =>
  ({ id, subject_id, subject_name, type, difficulty, title, marks, time_mins, tags }));

// Safety: never ship a solution to the browser.
function assertNoReference(v, where = 'root') {
  if (Array.isArray(v)) return v.forEach((x, i) => assertNoReference(x, `${where}[${i}]`));
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (k === 'reference' || k === 'reference_sql' || k === 'solution') throw new Error(`Forbidden key "${k}" at ${where}`);
      assertNoReference(x, `${where}.${k}`);
    }
  }
}
assertNoReference(full);

for (const q of full) {
  if (!q.id || !q.title || !q.statement) throw new Error(`Incomplete question ${q.id}`);
  if (!Number.isFinite(q.marks) || q.marks <= 0) throw new Error(`Bad marks on ${q.id}`);
}

// Unchanged for existing question types; interactive questions also hash their (public) config because their sealed
// units refer to the opaque ids inside it.
const BANK_VERSION = createHash('sha1').update(JSON.stringify(full.map((q) => (isInteractive(q.type) ? [q.id, q.marks, q.tests, q.config] : [q.id, q.marks, q.tests])))).digest('hex').slice(0, 10);

const header = (what) => `// AUTO-GENERATED by question-bank/build.js — do not edit by hand.\n// ${what}\n// To change questions: edit question-bank/ sources, run \`npm run build-bank\` there, commit this file.\n`;
const lit = (v) => JSON.stringify(v, null, 1);

// Public view of each question (safe for proctors / anyone with the bundle) + the sealed answers.
const stripCorrect = (cfg) => { const c = JSON.parse(JSON.stringify(cfg || {})); delete c.correct; return c; };
const pub = full.map((q) => {
  const interactive = isInteractive(q.type);
  const visible = interactive ? [] : (q.tests || []).filter((t) => t.hidden !== true); // drag & drop units are never public
  const public_tests = q.type === 'ui' ? visible.map((t) => ({ name: t.name })) : visible;
  const sealedPayload = { tests: q.tests || [] };
  if (q.type === 'mcq') sealedPayload.correct = q.config?.correct;
  if (interactive) sealedPayload.solution = solutions.get(q.id);
  return {
    id: q.id, subject_id: q.subject_id, subject_name: q.subject_name, type: q.type, difficulty: q.difficulty,
    title: q.title, statement: q.statement, marks: q.marks, time_mins: q.time_mins, tags: q.tags,
    config: stripCorrect(q.config), public_tests, test_count: (q.tests || []).length, sealed: seal(q.id, sealedPayload),
  };
});

// Safety: nothing secret may be readable in the shipped bank. Round-trip + negative checks.
{
  const pubJson = JSON.stringify(pub);
  for (const [i, q] of full.entries()) {
    if (q.type === 'mcq') {
      if (JSON.stringify(pub[i].config).includes('"correct"')) throw new Error(`MCQ "correct" leaked in clear for ${q.id}`);
      if (!Array.isArray(q.config?.correct)) throw new Error(`MCQ ${q.id} has no correct[]`);
    }
    if (q.type === 'ui') for (const t of q.tests) {
      if (typeof t.check !== 'string' || t.check.length < 8) throw new Error(`UI check source missing on ${q.id}`);
      if (pubJson.includes(JSON.stringify(t.check).slice(1, -1))) throw new Error(`UI check source leaked in clear for ${q.id}`);
    }
    const visibleJson = new Set((q.tests || []).filter((t) => t.hidden !== true).map((t) => JSON.stringify(t)));
    for (const t of (q.tests || []).filter((t) => t.hidden === true)) {
      const j = JSON.stringify(t);
      if (!visibleJson.has(j) && pubJson.includes(j)) throw new Error(`Hidden test leaked in clear for ${q.id}`);
    }
    if (pub[i].public_tests.some((t) => t.hidden === true)) throw new Error(`Hidden test in public_tests for ${q.id}`);
    if (isInteractive(q.type)) {
      // nothing that reveals the answer may be readable: no reference keys, no scoring units, no canonical order
      const own = JSON.stringify(pub[i]);
      for (const k of ['"reference"', '"solution"', '"constraints"', '"pairs"', '"accept"', '"before"', '"after"', '"order"']) {
        if (own.includes(k)) throw new Error(`Interactive answer key ${k} leaked in clear for ${q.id}`);
      }
      for (const u of q.tests) if (own.includes(JSON.stringify(u))) throw new Error(`Scoring unit leaked in clear for ${q.id}`);
      const sol = solutions.get(q.id);
      if (sol.order && own.includes(JSON.stringify(sol.order))) throw new Error(`Canonical order leaked in clear for ${q.id}`);
      if (pub[i].public_tests.length) throw new Error(`public_tests must be empty for ${q.id}`);
      if (pub[i].test_count !== q.tests.length || !q.tests.length) throw new Error(`test_count mismatch for ${q.id}`);
      const back0 = unseal(q.id, pub[i].sealed);
      if (JSON.stringify(back0.solution) !== JSON.stringify(sol)) throw new Error(`Seal round-trip (solution) failed for ${q.id}`);
    }
    const back = unseal(q.id, pub[i].sealed);
    if (JSON.stringify(back.tests) !== JSON.stringify(q.tests || [])) throw new Error(`Seal round-trip failed for ${q.id}`);
    if (q.type === 'mcq' && JSON.stringify(back.correct) !== JSON.stringify(q.config.correct)) throw new Error(`Seal round-trip (correct) failed for ${q.id}`);
    let rejected = false;
    try { unseal(q.id, pub[i].sealed, deriveKey(q.id + 'x')); } catch { rejected = true; }
    if (!rejected) throw new Error(`Wrong key decrypted ${q.id}`);
  }
  assertNoReference(pub);
}

const frontendOut = `${header('Question bank for the browser. Statements/config/sample tests are public; hidden tests, MCQ answers and UI check sources are AES-GCM sealed (key released by the API per attempt, or to an admin who re-enters their password). No solutions.')}export const BANK_VERSION = ${JSON.stringify(BANK_VERSION)};\nexport const SUBJECTS = ${lit(subjects)};\nexport const QUESTIONS = ${lit(pub)};\n`;
const backendOut = `${header('Metadata-only catalog for the API (no statements, tests or config).')}export const BANK_VERSION = ${JSON.stringify(BANK_VERSION)};\nexport const SUBJECTS = ${lit(subjects)};\nexport const CATALOG = ${lit(catalog)};\n`;

mkdirSync(path.dirname(FRONT), { recursive: true });
writeFileSync(FRONT, frontendOut);
writeFileSync(BACK, backendOut);
console.log(`bank ${BANK_VERSION}: ${full.length} questions, ${subjects.length} subjects`);
console.log(` -> ${path.relative(root, FRONT)} (${(frontendOut.length / 1024).toFixed(0)} KB)`);
console.log(` -> ${path.relative(root, BACK)} (${(backendOut.length / 1024).toFixed(0)} KB)`);
