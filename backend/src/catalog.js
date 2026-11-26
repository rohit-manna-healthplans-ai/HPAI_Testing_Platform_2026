// Question catalog (metadata only). Questions live in code: question-bank/ -> `npm run build-bank` -> catalog.generated.js.
// The database never stores questions; attempts store question ids and the API resolves marks/titles from here.
import crypto from 'node:crypto';
import { HttpError } from './util.js';
import { BANK_VERSION, SUBJECTS, CATALOG } from './catalog.generated.js';

export { BANK_VERSION, SUBJECTS, CATALOG };
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

const subjectMap = new Map(SUBJECTS.map((s) => [s.id, s]));
const questionMap = new Map(CATALOG.map((q) => [q.id, q]));

export const subjectById = (id) => subjectMap.get(id) || null;
export const isSubjectId = (id) => subjectMap.has(id);
export const questionById = (id) => questionMap.get(id) || null;

const buckets = new Map(); // `${subject}|${difficulty}` -> catalog entries
for (const q of CATALOG) {
  const k = `${q.subject_id}|${q.difficulty}`;
  if (!buckets.has(k)) buckets.set(k, []);
  buckets.get(k).push(q);
}
export const countBucket = (subjectId, difficulty) => buckets.get(`${subjectId}|${difficulty}`)?.length || 0;

/** [{id,name,description,question_count,by_difficulty}] — optionally limited to allowedIds (array/Set of subject ids). */
export function listSubjectsWithCounts(allowedIds) {
  const allowed = allowedIds ? new Set(allowedIds) : null;
  return SUBJECTS.filter((s) => !allowed || allowed.has(s.id)).map((s) => {
    const by = { easy: countBucket(s.id, 'easy'), medium: countBucket(s.id, 'medium'), hard: countBucket(s.id, 'hard') };
    return { id: s.id, name: s.name, description: s.description, question_count: by.easy + by.medium + by.hard, by_difficulty: by };
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const subjectOrder = new Map(SUBJECTS.map((s, i) => [s.id, i]));
const diffOrder = { easy: 0, medium: 1, hard: 2 };
const byPaperOrder = (a, b) => subjectOrder.get(a.subject_id) - subjectOrder.get(b.subject_id) || diffOrder[a.difficulty] - diffOrder[b.difficulty];

/** Resolves fixed question ids to catalog entries (throws HttpError for unknown / duplicate ids). */
export function resolveFixed(fixedIds, { status = 400 } = {}) {
  const out = []; const seen = new Set();
  for (const id of fixedIds || []) {
    const q = questionById(id);
    if (!q) throw new HttpError(status, `Unknown question "${id}"`);
    if (seen.has(id)) throw new HttpError(status, `Question "${id}" is selected twice`);
    seen.add(id); out.push(q);
  }
  return out;
}

/** Candidates for a random bucket, excluding questions already fixed in the paper. */
export function availableInBucket(subjectId, difficulty, fixedIds) {
  const ex = new Set(fixedIds || []);
  return (buckets.get(`${subjectId}|${difficulty}`) || []).filter((q) => !ex.has(q.id));
}

/**
 * Paper = fixed questions + random questions per bucket (never repeating a fixed one), ordered by subject then easy -> hard.
 * subject_config: [{ subject_id, easy, medium, hard }]. Throws HttpError(status) when a bucket is too small.
 */
export function pickQuestions(subjectConfig, { status = 400, fixedIds = [] } = {}) {
  const picked = resolveFixed(fixedIds, { status });
  for (const c of subjectConfig || []) {
    const subject = subjectById(c.subject_id);
    if (!subject) throw new HttpError(status, `Unknown subject "${c.subject_id}"`);
    for (const d of DIFFICULTIES) {
      const n = c[d] || 0;
      if (!n) continue;
      const pool = availableInBucket(c.subject_id, d, fixedIds);
      if (pool.length < n) throw new HttpError(status, `Not enough ${d} questions in "${subject.name}": requested ${n}, available ${pool.length}`);
      picked.push(...shuffle(pool).slice(0, n));
    }
  }
  return picked.map((q, i) => [q, i]).sort((a, b) => byPaperOrder(a[0], b[0]) || a[1] - b[1]).map((x) => x[0]);
}

/** Rough totals for a session (fixed questions exact, random buckets by average marks) — shown before an attempt exists. */
export function estimateSession(subjectConfig, fixedIds = []) {
  const fixed = (fixedIds || []).map(questionById).filter(Boolean);
  let question_count = fixed.length; let total = fixed.reduce((s, q) => s + q.marks, 0);
  for (const c of subjectConfig || []) {
    for (const d of DIFFICULTIES) {
      const n = c[d] || 0; if (!n) continue;
      const pool = availableInBucket(c.subject_id, d, fixedIds);
      const avg = pool.length ? pool.reduce((s, q) => s + q.marks, 0) / pool.length : 0;
      question_count += n; total += n * avg;
    }
  }
  return { question_count, total_marks: Math.round(total) };
}
