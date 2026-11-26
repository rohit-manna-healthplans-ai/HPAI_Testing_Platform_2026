import { query, tx } from './db.js';
import { HttpError, certCode, round2, pctOf, gradeFor, audit } from './util.js';
import { pickQuestions, questionById } from './catalog.js';

export const GRACE_MS = 45 * 1000;

/** Throws 403 unless a NEW attempt may start in this session right now (open + inside the optional window). */
export function assertSessionStartable(sess) {
  const now = Date.now();
  if (sess.status !== 'open') throw new HttpError(403, 'This session is closed');
  if (sess.opens_at && new Date(sess.opens_at) > now) throw new HttpError(403, `This session opens at ${new Date(sess.opens_at).toISOString()}`);
  if (sess.closes_at && new Date(sess.closes_at) < now) throw new HttpError(403, 'This session has ended');
}

/**
 * Shared "start attempt" logic (used by the candidate start route and by invite redemption).
 * client: anything with .query(text, params) (pool wrapper or a tx client). Idempotent per (session, candidate):
 * picks random catalog questions per subject_config bucket, snapshots their ids, returns the attempt row.
 */
export async function createAttemptFor(client, sess, candidateId, { ip = null, userAgent = '', testerId = null } = {}) {
  // Questions come from the in-code catalog (not the database): random per bucket, ordered by subject then easy -> hard.
  const picked = pickQuestions(sess.subject_config, { status: 409, fixedIds: sess.fixed_question_ids });
  const maxScore = picked.reduce((s, q) => s + q.marks, 0);
  const ins = await client.query(
    `INSERT INTO attempts (session_id, candidate_id, proctor_id, ends_at, question_ids, max_score, ip, user_agent, tester_id)
     VALUES ($1,$2,$3, now() + make_interval(mins => $4), $5, $6, $7, $8, $9)
     ON CONFLICT (session_id, candidate_id) DO NOTHING RETURNING *`,
    [sess.id, candidateId, sess.proctor_id, sess.duration_mins, JSON.stringify(picked.map((q) => q.id)), maxScore,
      ip, String(userAgent || '').slice(0, 300), testerId]);
  if (ins.rows[0]) return ins.rows[0];
  const { rows } = await client.query('SELECT * FROM attempts WHERE session_id=$1 AND candidate_id=$2', [sess.id, candidateId]);
  return rows[0];
}

/**
 * Finalize an attempt (idempotent). status: submitted | auto_submitted | terminated. Returns the attempt row.
 * Normally 2 statements: one atomic UPDATE(+certificate insert) CTE and one SELECT. Pass `client` to run inside a transaction.
 */
export async function finalizeAttempt(attemptId, status = 'submitted', client = null) {
  const db = client || { query };
  await db.query(
    `WITH upd AS (
       UPDATE attempts SET status=$2, submitted_at=now(),
              total_score=COALESCE((SELECT round(sum(score)::numeric, 2) FROM answers WHERE attempt_id=$1), 0)
        WHERE id=$1 AND status='in_progress' RETURNING id)
     INSERT INTO certificates (attempt_id, code) SELECT id, $3 FROM upd ON CONFLICT DO NOTHING`,
    [attemptId, status, certCode()]);
  let { rows } = await db.query(
    'SELECT a.*, c.code AS certificate_code FROM attempts a LEFT JOIN certificates c ON c.attempt_id=a.id WHERE a.id=$1', [attemptId]);
  // a (very rare) certificate-code collision is swallowed by ON CONFLICT DO NOTHING: retry with a fresh code
  for (let i = 0; i < 4 && rows[0] && rows[0].status !== 'in_progress' && !rows[0].certificate_code; i++) {
    await db.query('INSERT INTO certificates (attempt_id, code) VALUES ($1,$2) ON CONFLICT DO NOTHING', [attemptId, certCode()]);
    rows = (await db.query('SELECT a.*, c.code AS certificate_code FROM attempts a LEFT JOIN certificates c ON c.attempt_id=a.id WHERE a.id=$1', [attemptId])).rows;
  }
  return rows[0];
}

/** If attempt is in progress and past ends_at + grace, auto-finalize. Returns the (possibly updated) attempt row. */
export async function lazyFinalize(attempt) {
  if (attempt.status === 'in_progress' && Date.now() > new Date(attempt.ends_at).getTime() + GRACE_MS) {
    return finalizeAttempt(attempt.id, 'auto_submitted');
  }
  return attempt;
}

export async function getAttemptOr404(id) {
  const { rows } = await query('SELECT * FROM attempts WHERE id=$1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Attempt not found');
  return rows[0];
}

/** Upsert one answer; server computes score. */
export async function upsertAnswer(client, attempt, questionId, a, marksMap) {
  const maxScore = marksMap.get(questionId);
  if (maxScore === undefined) throw new HttpError(400, 'Question does not belong to this attempt');
  let total = Number(a.tests_total); let passed = Number(a.tests_passed);
  if (!Number.isFinite(total) || total < 0) total = 0;
  if (!Number.isFinite(passed) || passed < 0) passed = 0;
  passed = Math.min(passed, total);
  const score = total > 0 ? round2(maxScore * (passed / total)) : 0;
  const time = Math.max(0, Math.min(86400, parseInt(a.time_spent_sec, 10) || 0));
  const response = a.response && typeof a.response === 'object' ? a.response : {};
  if (JSON.stringify(response).length > 500000) throw new HttpError(413, 'Answer too large');
  await client.query(
    `INSERT INTO answers (attempt_id, question_id, response, tests_passed, tests_total, score, max_score, time_spent_sec, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
     ON CONFLICT (attempt_id, question_id) DO UPDATE SET
       response=EXCLUDED.response, tests_passed=EXCLUDED.tests_passed, tests_total=EXCLUDED.tests_total,
       score=EXCLUDED.score, max_score=EXCLUDED.max_score, time_spent_sec=EXCLUDED.time_spent_sec, updated_at=now()`,
    [attempt.id, questionId, JSON.stringify(response), passed, total, score, maxScore, time]
  );
}

/**
 * Upsert many answers in ONE statement (unnest). Server computes every score from the catalog marks; rows whose
 * response + tests are unchanged are skipped (no write). Returns { saved, skipped }.
 */
export async function upsertAnswers(client, attempt, list, marksMap) {
  const q = [], resp = [], passed = [], total = [], score = [], max = [], time = [];
  const seen = new Set();
  for (const a of list) {
    const id = a?.question_id;
    if (typeof id !== 'string' || !marksMap.has(id)) throw new HttpError(400, 'Question does not belong to this attempt');
    if (seen.has(id)) continue; // last one wins is not needed: autosave sends each question once
    seen.add(id);
    const m = marksMap.get(id);
    let t = Number(a.tests_total); let p = Number(a.tests_passed);
    if (!Number.isFinite(t) || t < 0) t = 0;
    if (!Number.isFinite(p) || p < 0) p = 0;
    p = Math.min(p, t);
    const response = a.response && typeof a.response === 'object' ? a.response : {};
    const json = JSON.stringify(response);
    if (json.length > 500000) throw new HttpError(413, 'Answer too large');
    q.push(id); resp.push(json); passed.push(p); total.push(t); max.push(m);
    score.push(t > 0 ? round2(m * (p / t)) : 0);
    time.push(Math.max(0, Math.min(86400, parseInt(a.time_spent_sec, 10) || 0)));
  }
  if (!q.length) return { saved: 0, skipped: 0 };
  const { rowCount } = await client.query(
    `INSERT INTO answers (attempt_id, question_id, response, tests_passed, tests_total, score, max_score, time_spent_sec, updated_at)
     SELECT $1, u.q, u.r::jsonb, u.p, u.t, u.s, u.m, u.ts, now()
       FROM unnest($2::text[], $3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[], $8::int[]) AS u(q, r, p, t, s, m, ts)
     ON CONFLICT (attempt_id, question_id) DO UPDATE SET
       response=EXCLUDED.response, tests_passed=EXCLUDED.tests_passed, tests_total=EXCLUDED.tests_total,
       score=EXCLUDED.score, max_score=EXCLUDED.max_score, time_spent_sec=EXCLUDED.time_spent_sec, updated_at=now()
     WHERE (answers.response, answers.tests_passed, answers.tests_total) IS DISTINCT FROM (EXCLUDED.response, EXCLUDED.tests_passed, EXCLUDED.tests_total)`,
    [attempt.id, q, resp, passed, total, score, max, time]);
  return { saved: rowCount, skipped: q.length - rowCount };
}

/**
 * Map of question id -> marks for the ids in an attempt. Marks come from the catalog; ids no longer in the catalog
 * (stale attempts) fall back to the max_score stored on their answer row.
 */
export async function marksMapFor(client, questionIds, attemptId) {
  const m = new Map(); const missing = [];
  for (const id of questionIds || []) {
    const q = questionById(id);
    if (q) m.set(id, q.marks); else missing.push(id);
  }
  if (missing.length && attemptId) {
    const { rows } = await client.query('SELECT question_id, max_score FROM answers WHERE attempt_id=$1 AND question_id = ANY($2::text[])', [attemptId, missing]);
    for (const r of rows) m.set(r.question_id, Number(r.max_score));
  }
  return m;
}

/** Describe a question id for review/result screens; degrades gracefully for ids missing from the catalog. */
export function describeQuestion(id, fallbackMax = 0) {
  const q = questionById(id);
  if (q) return { title: q.title, type: q.type, difficulty: q.difficulty, subject_id: q.subject_id, subject_name: q.subject_name, marks: q.marks };
  return { title: 'Unknown question', type: null, difficulty: null, subject_id: null, subject_name: 'Other', marks: Number(fallbackMax) || 0 };
}

/** Per-subject {subject, score, max} for an attempt, alphabetical by subject name. answerRows: [{question_id, score, max_score}] */
export function subjectBreakdown(questionIds, answerRows) {
  const byQ = new Map(answerRows.map((a) => [a.question_id, a]));
  const acc = new Map();
  for (const id of questionIds) {
    const a = byQ.get(id);
    const d = describeQuestion(id, a?.max_score);
    const cur = acc.get(d.subject_name) || { subject: d.subject_name, score: 0, max: 0 };
    cur.score += Number(a?.score || 0); cur.max += d.marks;
    acc.set(d.subject_name, cur);
  }
  return [...acc.values()].map((x) => ({ subject: x.subject, score: round2(x.score), max: x.max })).sort((a, b) => a.subject.localeCompare(b.subject));
}

export const pct = pctOf;
export { gradeFor, audit };
