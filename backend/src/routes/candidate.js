import { Router } from 'express';
import { query, tx } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, HttpError, isUuid, pctOf, gradeFor, FLAG_EVENTS, CANDIDATE_EVENT_TYPES, audit } from '../util.js';
import { finalizeAttempt, lazyFinalize, upsertAnswers, marksMapFor, getAttemptOr404, GRACE_MS, createAttemptFor, assertSessionStartable, subjectBreakdown } from '../attempts.js';
import { BANK_VERSION, estimateSession } from '../catalog.js';
import { keysFor } from '../bankKeys.js';

const r = Router();
r.use(requireAuth, requireRole('candidate'));

const iso = (d) => new Date(d).toISOString();

/**
 * Attempt payload for the test UI. Questions are NOT sent: the browser holds the question bank and resolves
 * `question_ids` locally (check `bank_version`). Ids/answers only while in progress.
 */
async function buildPayload(attempt) {
  const base = {
    attempt: { id: attempt.id, session_id: attempt.session_id, started_at: attempt.started_at, ends_at: attempt.ends_at, status: attempt.status },
    server_now: iso(Date.now()), question_ids: [], bank_version: BANK_VERSION, answers: {}, bank_keys: {},
  };
  if (attempt.status !== 'in_progress') return base;
  // Keys to unseal THIS attempt's questions only — released while in progress, never after submit.
  base.bank_keys = keysFor(attempt.question_ids);
  // Server-side count so clearing browser storage cannot reset the screen-leave limit.
  const [leaves, ans] = await Promise.all([
    query(`SELECT count(*)::int AS n FROM proctor_events WHERE attempt_id=$1 AND type='screen_leave'`, [attempt.id]),
    query('SELECT question_id, response, tests_passed, tests_total FROM answers WHERE attempt_id=$1', [attempt.id]),
  ]);
  base.attempt.screen_leaves = leaves.rows[0].n;
  base.question_ids = attempt.question_ids;
  for (const a of ans.rows) base.answers[a.question_id] = { response: a.response, tests_passed: a.tests_passed, tests_total: a.tests_total };
  return base;
}

async function ownAttempt(req) {
  const id = req.params.id;
  if (!isUuid(id)) throw new HttpError(400, 'Invalid attempt id');
  const a = await getAttemptOr404(id);
  if (a.candidate_id !== req.user.id) throw new HttpError(403, 'This attempt does not belong to you');
  return lazyFinalize(a);
}

// ---------- sessions ----------
r.get('/sessions', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.name, s.duration_mins, s.subject_config, s.fixed_question_ids, s.status, s.opens_at, s.closes_at, p.name AS proctor_name,
            a.id AS attempt_id, a.status AS attempt_status, a.total_score, a.max_score
       FROM session_candidates sc
       JOIN sessions s ON s.id=sc.session_id
       JOIN users p ON p.id=s.proctor_id
       LEFT JOIN attempts a ON a.session_id=s.id AND a.candidate_id=sc.candidate_id
      WHERE sc.candidate_id=$1 AND (s.status='open' OR a.id IS NOT NULL)
      ORDER BY s.created_at DESC`, [req.user.id]);
  const now = Date.now();
  res.json(rows.map((s) => {
    const est = estimateSession(s.subject_config, s.fixed_question_ids);
    const done = s.attempt_status && s.attempt_status !== 'in_progress';
    const inWindow = (!s.opens_at || new Date(s.opens_at) <= now) && (!s.closes_at || new Date(s.closes_at) >= now);
    return {
      id: s.id, name: s.name, duration_mins: s.duration_mins, question_count: est.question_count,
      total_marks: s.max_score || est.total_marks, proctor_name: s.proctor_name, status: s.status,
      opens_at: s.opens_at, closes_at: s.closes_at,
      can_start: s.status === 'open' && inWindow && !done,
      attempt: s.attempt_id ? {
        id: s.attempt_id, status: s.attempt_status,
        ...(done ? { total_score: s.total_score, max_score: s.max_score } : {}),
      } : null,
    };
  }));
}));

r.post('/sessions/:id/start', asyncHandler(async (req, res) => {
  const sid = req.params.id; if (!isUuid(sid)) throw new HttpError(400, 'Invalid session id');
  const sess = (await query(
    `SELECT s.* FROM sessions s JOIN session_candidates sc ON sc.session_id=s.id AND sc.candidate_id=$2 WHERE s.id=$1`, [sid, req.user.id])).rows[0];
  if (!sess) throw new HttpError(404, 'Session not found or not assigned to you');

  let attempt = (await query('SELECT * FROM attempts WHERE session_id=$1 AND candidate_id=$2', [sid, req.user.id])).rows[0];
  if (!attempt) {
    assertSessionStartable(sess);
    attempt = await createAttemptFor({ query }, sess, req.user.id, { ip: req.ip, userAgent: req.headers['user-agent'] });
    await audit(req.user.id, 'attempt.start', 'attempt', attempt.id, { session_id: sid });
  }
  attempt = await lazyFinalize(attempt);
  res.json(await buildPayload(attempt));
}));

// ---------- attempts ----------
r.get('/attempts/:id', asyncHandler(async (req, res) => {
  res.json(await buildPayload(await ownAttempt(req)));
}));

// Saving is allowed while in progress (and for a short grace period after the timer).
function assertWritable(attempt) {
  if (attempt.status !== 'in_progress') throw new HttpError(409, 'This attempt has already been submitted');
  if (Date.now() > new Date(attempt.ends_at).getTime() + GRACE_MS) throw new HttpError(409, 'Time is over');
}
const savedReply = (attempt, r) => ({ ok: true, saved: r.saved, skipped: r.skipped, server_now: iso(Date.now()), ends_at: attempt.ends_at });

// Bulk autosave: ONE request + ONE multi-row upsert for up to 20 answers; unchanged rows are skipped.
r.put('/attempts/:id/answers', asyncHandler(async (req, res) => {
  const attempt = await ownAttempt(req);
  assertWritable(attempt);
  const list = req.body?.answers;
  if (!Array.isArray(list) || !list.length) throw new HttpError(400, 'answers must be a non-empty array');
  if (list.length > 20) throw new HttpError(400, 'At most 20 answers per request');
  const marks = await marksMapFor({ query }, attempt.question_ids, attempt.id);
  res.json(savedReply(attempt, await upsertAnswers({ query }, attempt, list, marks)));
}));

r.put('/attempts/:id/answers/:questionId', asyncHandler(async (req, res) => {
  const attempt = await ownAttempt(req);
  const { questionId } = req.params;
  if (typeof questionId !== 'string' || questionId.length > 200) throw new HttpError(400, 'Invalid question id');
  assertWritable(attempt);
  const marks = await marksMapFor({ query }, attempt.question_ids, attempt.id);
  res.json(savedReply(attempt, await upsertAnswers({ query }, attempt, [{ ...(req.body || {}), question_id: questionId }], marks)));
}));

// ---------- integrity events ----------
const CRITICAL = new Set(FLAG_EVENTS); // screen_leave / screenshot_attempt / paste / devtools: always kept (up to a high cap)
const MAX_OTHER_EVENTS = 300; const MAX_CRITICAL_EVENTS = 100;

/** Sanitise, de-duplicate consecutive repeats, apply per-attempt caps (silently drop beyond), insert in ONE statement. */
async function recordEvents(attempt, raw, { strict = false } = {}) {
  const clean = []; let prev = ''; const nowMs = Date.now(); const startMs = new Date(attempt.started_at).getTime();
  for (const e of raw.slice(0, 50)) {
    const type = String(e?.type || '');
    if (!CANDIDATE_EVENT_TYPES.includes(type)) { if (strict) throw new HttpError(400, 'Unknown event type'); continue; }
    let meta = e?.meta && typeof e.meta === 'object' ? e.meta : {};
    let json = JSON.stringify(meta); if (json.length > 2000) { meta = {}; json = '{}'; }
    const key = type + json; if (key === prev) continue; prev = key;
    let at = e?.at ? Date.parse(e.at) : NaN;
    if (!Number.isFinite(at) || at > nowMs + 5000 || at < startMs - 1000) at = nowMs;
    clean.push({ type, json, at: new Date(at).toISOString() });
  }
  if (!clean.length) return 0;
  const crit = [...CRITICAL];
  const c = (await query(
    `SELECT (count(*) FILTER (WHERE type = ANY($2::text[])))::int AS crit, (count(*) FILTER (WHERE NOT (type = ANY($2::text[]))))::int AS other
       FROM proctor_events WHERE attempt_id=$1`, [attempt.id, crit])).rows[0];
  let roomCrit = MAX_CRITICAL_EVENTS - c.crit; let roomOther = MAX_OTHER_EVENTS - c.other;
  const keep = clean.filter((e) => (CRITICAL.has(e.type) ? roomCrit-- > 0 : roomOther-- > 0));
  if (!keep.length) return 0;
  await query(
    `WITH ins AS (
       INSERT INTO proctor_events (attempt_id, type, meta, at)
       SELECT $1, u.t, u.m::jsonb, u.a FROM unnest($2::text[], $3::text[], $4::timestamptz[]) AS u(t, m, a)
       RETURNING type)
     UPDATE attempts SET flag_count = flag_count + (SELECT count(*) FROM ins WHERE type = ANY($5::text[])) WHERE id=$1`,
    [attempt.id, keep.map((e) => e.type), keep.map((e) => e.json), keep.map((e) => e.at), crit]);
  return keep.length;
}

r.post('/attempts/:id/events', asyncHandler(async (req, res) => {
  const attempt = await ownAttempt(req);
  if (!CANDIDATE_EVENT_TYPES.includes(String(req.body?.type || ''))) throw new HttpError(400, 'Unknown event type');
  if (attempt.status === 'in_progress') await recordEvents(attempt, [{ type: req.body.type, meta: req.body.meta }], { strict: true });
  res.json({ ok: true });
}));

r.post('/attempts/:id/events/batch', asyncHandler(async (req, res) => {
  const attempt = await ownAttempt(req);
  const list = req.body?.events;
  if (!Array.isArray(list)) throw new HttpError(400, 'events must be an array');
  const stored = attempt.status === 'in_progress' ? await recordEvents(attempt, list) : 0;
  res.json({ ok: true, stored });
}));

r.post('/attempts/:id/submit', asyncHandler(async (req, res) => {
  let attempt = await ownAttempt(req);
  if (attempt.status === 'in_progress') {
    const late = Date.now() > new Date(attempt.ends_at).getTime();
    const withinGrace = Date.now() <= new Date(attempt.ends_at).getTime() + GRACE_MS;
    const list = Array.isArray(req.body?.answers) ? req.body.answers.slice(0, 60) : [];
    const status = req.body?.auto || late ? 'auto_submitted' : 'submitted';
    // answers + finalize in ONE transaction: BEGIN, upsert (1 stmt), finalize (2 stmts), COMMIT
    attempt = await tx(async (c) => {
      if (withinGrace && list.length) {
        const marks = await marksMapFor(c, attempt.question_ids, attempt.id);
        await upsertAnswers(c, attempt, list.filter((a) => marks.has(a?.question_id)), marks);
      }
      return finalizeAttempt(attempt.id, status, c);
    });
    audit(req.user.id, 'attempt.submit', 'attempt', attempt.id, { status: attempt.status, score: attempt.total_score }); // not awaited
  }
  res.json({
    status: attempt.status, total_score: attempt.total_score, max_score: attempt.max_score,
    percentage: pctOf(attempt.total_score, attempt.max_score),
  });
}));

r.get('/attempts/:id/result', asyncHandler(async (req, res) => {
  const attempt = await ownAttempt(req);
  if (attempt.status === 'in_progress') throw new HttpError(409, 'Result is available after you submit');
  const [sess, ans, cert] = await Promise.all([
    query('SELECT name FROM sessions WHERE id=$1', [attempt.session_id]),
    query('SELECT question_id, score, max_score FROM answers WHERE attempt_id=$1', [attempt.id]),
    query('SELECT code FROM certificates WHERE attempt_id=$1', [attempt.id]),
  ]);
  const percentage = pctOf(attempt.total_score, attempt.max_score);
  res.json({
    candidate_name: req.user.name, session_name: sess.rows[0]?.name, submitted_at: attempt.submitted_at,
    total_score: attempt.total_score, max_score: attempt.max_score, percentage, grade: gradeFor(percentage),
    by_subject: subjectBreakdown(attempt.question_ids, ans.rows),
    certificate_code: cert.rows[0]?.code || null,
    tester_id: attempt.tester_id || null,
  });
}));

export default r;
