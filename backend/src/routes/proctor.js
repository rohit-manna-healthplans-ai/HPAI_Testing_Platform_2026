import { Router } from 'express';
import { hashPassword, comparePassword } from '../passwords.js';
import { query, tx } from '../db.js';
import { requireAuth, requireRole, dropUser } from '../auth.js';
import { asyncHandler, HttpError, audit, isUuid, pctOf } from '../util.js';
import { createUser, bulkCreate, publicUser } from '../users.js';
import { finalizeAttempt, getAttemptOr404, describeQuestion } from '../attempts.js';
import { maxCandidates, parsePeople, createInvitesBulk, expiryFrom } from '../inviteCore.js';
import { dropSession } from '../sessionCache.js';
import { ttlCache } from '../cache.js';
import { sendJsonEtag } from '../http.js';
import { isSubjectId, subjectById, resolveFixed, availableInBucket } from '../catalog.js';

const r = Router();
r.use(requireAuth, requireRole('proctor', 'admin'));

const isAdmin = (req) => req.user.role === 'admin';

// ---------- candidates ----------
r.get('/candidates', asyncHandler(async (req, res) => {
  const params = []; let where = "WHERE u.role='candidate'";
  if (!isAdmin(req)) { params.push(req.user.id); where += ` AND u.proctor_id=$1`; }
  const { rows } = await query(
    `SELECT u.id,u.name,u.email,u.role,u.active,u.proctor_id,u.created_at,p.name AS proctor_name,
            (SELECT count(*)::int FROM attempts a WHERE a.candidate_id=u.id) AS attempt_count
       FROM users u LEFT JOIN users p ON p.id=u.proctor_id ${where} ORDER BY u.created_at DESC`, params);
  res.json(rows);
}));

function ownerFor(req) {
  if (!isAdmin(req)) return req.user.id;
  const pid = req.body?.proctor_id;
  if (pid && !isUuid(pid)) throw new HttpError(400, 'Invalid proctor_id');
  return pid || null;
}

r.post('/candidates', asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  const { user, generated_password } = await createUser({ name, email, password, role: 'candidate', proctor_id: ownerFor(req), created_by: req.user.id });
  res.status(201).json({ ...publicUser(user), ...(generated_password ? { generated_password } : {}) });
}));

r.post('/candidates/bulk', asyncHandler(async (req, res) => {
  res.status(201).json(await bulkCreate({ rows: req.body?.rows, role: 'candidate', proctor_id: ownerFor(req), created_by: req.user.id }));
}));

r.patch('/candidates/:id', asyncHandler(async (req, res) => {
  const { id } = req.params; if (!isUuid(id)) throw new HttpError(400, 'Invalid id');
  const cur = (await query("SELECT * FROM users WHERE id=$1 AND role='candidate'", [id])).rows[0];
  if (!cur || (!isAdmin(req) && cur.proctor_id !== req.user.id)) throw new HttpError(404, 'Candidate not found');
  const { name, active, password } = req.body || {};
  const sets = []; const params = [id];
  const add = (c, v) => { params.push(v); sets.push(`${c}=$${params.length}`); };
  if (name !== undefined) { if (String(name).trim().length < 2) throw new HttpError(400, 'Name must be at least 2 characters'); add('name', String(name).trim()); }
  if (active !== undefined) add('active', !!active);
  if (password) { if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters'); add('password_hash', await hashPassword(String(password), 10)); }
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  const { rows } = await query(`UPDATE users SET ${sets.join(',')} WHERE id=$1 RETURNING id,name,email,role,active,proctor_id,created_at`, params);
  dropUser(id);
  await audit(req.user.id, 'candidate.update', 'user', id, { fields: Object.keys(req.body), password_reset: !!password });
  res.json(rows[0]);
}));

// ---------- sessions ----------
async function loadSession(req, id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid session id');
  const s = (await query('SELECT * FROM sessions WHERE id=$1', [id])).rows[0];
  if (!s || (!isAdmin(req) && s.proctor_id !== req.user.id)) throw new HttpError(404, 'Session not found');
  return s;
}

r.get('/sessions', asyncHandler(async (req, res) => {
  const params = []; let where = '';
  if (!isAdmin(req)) { params.push(req.user.id); where = 'WHERE s.proctor_id=$1'; }
  const { rows } = await query(
    `SELECT s.id,s.name,s.status,s.duration_mins,s.subject_config,s.fixed_question_ids,s.opens_at,s.closes_at,s.created_at,s.proctor_id,p.name AS proctor_name,
            (SELECT count(*)::int FROM session_candidates sc WHERE sc.session_id=s.id) AS candidate_count,
            (SELECT count(*)::int FROM attempts a WHERE a.session_id=s.id AND a.status<>'in_progress') AS submitted_count,
            (SELECT count(*)::int FROM attempts a WHERE a.session_id=s.id AND a.status='in_progress') AS in_progress_count,
            (SELECT count(*)::int FROM invites i WHERE i.session_id=s.id AND i.replaced_by IS NULL) AS invite_count
       FROM sessions s JOIN users p ON p.id=s.proctor_id ${where} ORDER BY s.created_at DESC`, params);
  res.json(rows);
}));

r.post('/sessions', asyncHandler(async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (name.length < 2) throw new HttpError(400, 'Session name is required');
  const duration = parseInt(b.duration_mins, 10);
  if (!(duration >= 5 && duration <= 300)) throw new HttpError(400, 'duration_mins must be between 5 and 300');
  const proctorId = isAdmin(req) ? b.proctor_id : req.user.id;
  if (!isUuid(proctorId)) throw new HttpError(400, 'proctor_id is required');
  // A paper is: fixed questions picked by the proctor (fixed_question_ids), random questions per subject bucket
  // (subject_config), or both (mix). At least one of them must produce a question.
  if (b.subject_config === undefined || b.subject_config === null) b.subject_config = [];
  if (b.fixed_question_ids === undefined || b.fixed_question_ids === null) b.fixed_question_ids = [];
  if (!Array.isArray(b.subject_config)) throw new HttpError(400, 'subject_config must be an array');
  if (!Array.isArray(b.fixed_question_ids) || !b.fixed_question_ids.every((x) => typeof x === 'string')) throw new HttpError(400, 'fixed_question_ids must be an array of question ids');
  if (b.candidate_ids === undefined || b.candidate_ids === null) b.candidate_ids = []; // invite-only sessions have no pre-assigned candidates
  if (!Array.isArray(b.candidate_ids)) throw new HttpError(400, 'candidate_ids must be an array');
  if (!b.candidate_ids.every(isUuid)) throw new HttpError(400, 'Invalid candidate id');
  // optional one-time links created together with the session: candidate_count or people[{name,email}] (max = MAX_CANDIDATES_PER_SESSION)
  const people = parsePeople(b, { countKey: 'candidate_count' });
  const expiresAt = people ? expiryFrom(b.expires_hours) : null;
  const cap = maxCandidates();
  const wanted = new Set(b.candidate_ids).size + (people ? people.length : 0);
  if (wanted > cap) throw new HttpError(400, `A session can have at most ${cap} candidates (you selected ${wanted})`);

  const cfg = []; const seen = new Set(); let totalQ = 0;
  for (const c of b.subject_config) {
    if (!isSubjectId(c?.subject_id)) throw new HttpError(400, 'Unknown subject in subject_config');
    if (seen.has(c.subject_id)) throw new HttpError(400, 'Duplicate subject in subject_config');
    seen.add(c.subject_id);
    const e = { subject_id: c.subject_id };
    for (const d of ['easy', 'medium', 'hard']) {
      const n = parseInt(c[d] ?? 0, 10);
      if (!(n >= 0 && n <= 20)) throw new HttpError(400, `${d} count must be between 0 and 20`);
      e[d] = n; totalQ += n;
    }
    cfg.push(e);
  }
  const fixed = resolveFixed(b.fixed_question_ids, { status: 400 });
  totalQ += fixed.length;
  if (totalQ < 1) throw new HttpError(400, 'Choose at least one question (pick questions manually or set subject counts)');
  if (totalQ > 40) throw new HttpError(400, 'A session can have at most 40 questions');

  const subName = (sid) => subjectById(sid).name;
  if (!isAdmin(req) || proctorId) {
    const allowed = new Set((await query('SELECT subject_id FROM proctor_subjects WHERE proctor_id=$1', [proctorId])).rows.map((x) => x.subject_id));
    for (const sid of seen) if (!allowed.has(sid)) throw new HttpError(403, `Subject "${subName(sid)}" is not assigned to this proctor`);
    for (const q of fixed) if (!allowed.has(q.subject_id)) throw new HttpError(403, `Question "${q.title}" belongs to subject "${q.subject_name}", which is not assigned to this proctor`);
  }
  // enough questions in the in-code catalog (after excluding the fixed ones)?
  for (const c of cfg) for (const d of ['easy', 'medium', 'hard']) {
    const have = availableInBucket(c.subject_id, d, b.fixed_question_ids).length;
    if (c[d] > have) throw new HttpError(400, `Not enough ${d} questions in "${subName(c.subject_id)}": requested ${c[d]}, available ${have}`);
  }
  // candidates owned by proctor
  const cands = (await query("SELECT id, proctor_id, active FROM users WHERE id = ANY($1::uuid[]) AND role='candidate'", [b.candidate_ids])).rows;
  if (cands.length !== new Set(b.candidate_ids).size) throw new HttpError(400, 'One or more candidates do not exist');
  for (const c of cands) {
    if (c.proctor_id !== proctorId) throw new HttpError(403, 'You can only add your own candidates to a session');
    if (!c.active) throw new HttpError(400, 'One or more candidates are deactivated');
  }
  const opens = b.opens_at ? new Date(b.opens_at) : null; const closes = b.closes_at ? new Date(b.closes_at) : null;
  if ((opens && isNaN(opens)) || (closes && isNaN(closes))) throw new HttpError(400, 'Invalid opens_at/closes_at');
  if (opens && closes && closes <= opens) throw new HttpError(400, 'closes_at must be after opens_at');

  const session = await tx(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO sessions (name,proctor_id,duration_mins,subject_config,fixed_question_ids,opens_at,closes_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, proctorId, duration, JSON.stringify(cfg), JSON.stringify(fixed.map((q) => q.id)), opens, closes]);
    for (const cid of new Set(b.candidate_ids)) await c.query('INSERT INTO session_candidates (session_id,candidate_id) VALUES ($1,$2)', [rows[0].id, cid]);
    const invites = people
      ? await createInvitesBulk(c, { sessionId: rows[0].id, proctorId, people, expiresAt, nameLocked: !!b.name_locked })
      : [];
    await audit(req.user.id, 'session.create', 'session', rows[0].id, { name, candidates: b.candidate_ids.length, invites: invites.length, questions: totalQ, fixed: fixed.length }, c);
    return { ...rows[0], invites };
  });
  res.status(201).json(session);
}));

r.get('/sessions/:id', asyncHandler(async (req, res) => {
  const session = await loadSession(req, req.params.id);
  const { rows } = await query(
    `SELECT u.id AS candidate_id, u.name, u.email,
            a.id AS attempt_id, a.status, a.started_at, a.ends_at, a.submitted_at, a.total_score, a.max_score, a.flag_count, a.tester_id,
            (SELECT count(*)::int FROM answers an WHERE an.attempt_id=a.id) AS answered
       FROM session_candidates sc JOIN users u ON u.id=sc.candidate_id
       LEFT JOIN attempts a ON a.session_id=sc.session_id AND a.candidate_id=sc.candidate_id
      WHERE sc.session_id=$1 ORDER BY u.name`, [session.id]);
  res.json({
    session,
    candidates: rows.map((x) => ({
      candidate_id: x.candidate_id, name: x.name, email: x.email, tester_id: x.tester_id || null,
      attempt: x.attempt_id ? {
        id: x.attempt_id, tester_id: x.tester_id || null, status: x.status, started_at: x.started_at, ends_at: x.ends_at, submitted_at: x.submitted_at,
        total_score: x.total_score, max_score: x.max_score, percentage: pctOf(x.total_score, x.max_score), flag_count: x.flag_count, answered: x.answered,
      } : null,
    })),
  });
}));

r.patch('/sessions/:id', asyncHandler(async (req, res) => {
  const session = await loadSession(req, req.params.id);
  const status = req.body?.status;
  if (!['open', 'closed'].includes(status)) throw new HttpError(400, "status must be 'open' or 'closed'");
  await query('UPDATE sessions SET status=$2 WHERE id=$1', [session.id, status]);
  dropSession(session.id);
  await audit(req.user.id, 'session.status', 'session', session.id, { status });
  res.json({ ...session, status });
}));

// ---------- attempts (review / control) ----------
async function loadAttempt(req, id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid attempt id');
  const a = await getAttemptOr404(id);
  if (!isAdmin(req) && a.proctor_id !== req.user.id) throw new HttpError(404, 'Attempt not found');
  return a;
}

r.get('/attempts/:id', asyncHandler(async (req, res) => {
  const a = await loadAttempt(req, req.params.id);
  const [cand, sess, ans, ev, proc] = await Promise.all([
    query('SELECT id,name,email FROM users WHERE id=$1', [a.candidate_id]),
    query('SELECT id,name,duration_mins FROM sessions WHERE id=$1', [a.session_id]),
    query('SELECT question_id, response, tests_passed, tests_total, score, max_score, time_spent_sec, updated_at FROM answers WHERE attempt_id=$1', [a.id]),
    query('SELECT id,type,meta,at FROM proctor_events WHERE attempt_id=$1 ORDER BY at, id', [a.id]),
    query('SELECT id,name FROM users WHERE id=$1', [a.proctor_id]),
  ]);
  // Titles/types come from the in-code catalog; the browser resolves statements/config by question id.
  const byQ = new Map(ans.rows.map((x) => [x.question_id, x]));
  const answers = a.question_ids.map((id) => {
    const x = byQ.get(id); const d = describeQuestion(id, x?.max_score);
    return {
      question_id: id, title: d.title, type: d.type, difficulty: d.difficulty, subject_name: d.subject_name, marks: d.marks,
      response: x?.response ?? null, tests_passed: x ? Number(x.tests_passed) : 0, tests_total: x ? Number(x.tests_total) : 0,
      score: x ? Number(x.score) : 0, max_score: x ? Number(x.max_score) || d.marks : d.marks,
      time_spent_sec: x?.time_spent_sec ?? 0, updated_at: x?.updated_at ?? null,
    };
  });
  res.json({
    attempt: { ...a, percentage: pctOf(a.total_score, a.max_score) },
    candidate: cand.rows[0], session: sess.rows[0], proctor: proc.rows[0] || null, answers, events: ev.rows,
  });
}));

r.post('/attempts/:id/extend', asyncHandler(async (req, res) => {
  const a = await loadAttempt(req, req.params.id);
  const minutes = parseInt(req.body?.minutes, 10);
  const reason = String(req.body?.reason || '').trim();
  if (!(minutes >= 1 && minutes <= 120)) throw new HttpError(400, 'minutes must be between 1 and 120');
  if (reason.length < 3) throw new HttpError(400, 'A reason is required');
  const { rows } = await query(
    `UPDATE attempts SET ends_at = ends_at + make_interval(mins => $2), extra_minutes = extra_minutes + $2
      WHERE id=$1 AND status='in_progress' RETURNING ends_at, extra_minutes`, [a.id, minutes]);
  if (!rows[0]) throw new HttpError(409, 'Attempt is no longer in progress');
  await query('INSERT INTO proctor_events (attempt_id,type,meta) VALUES ($1,$2,$3)', [a.id, 'extend_time', JSON.stringify({ minutes, reason, by: req.user.id })]);
  await audit(req.user.id, 'attempt.extend', 'attempt', a.id, { minutes, reason });
  res.json({ ok: true, ...rows[0] });
}));

r.post('/attempts/:id/terminate', asyncHandler(async (req, res) => {
  const a = await loadAttempt(req, req.params.id);
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 3) throw new HttpError(400, 'A reason is required');
  if (a.status !== 'in_progress') throw new HttpError(409, 'Attempt has already ended');
  const done = await finalizeAttempt(a.id, 'terminated');
  await query('INSERT INTO proctor_events (attempt_id,type,meta) VALUES ($1,$2,$3)', [a.id, 'terminated', JSON.stringify({ reason, by: req.user.id })]);
  await audit(req.user.id, 'attempt.terminate', 'attempt', a.id, { reason });
  res.json({ ok: true, status: done.status, total_score: done.total_score, max_score: done.max_score });
}));

const monitorCache = ttlCache(2000, 50);
r.get('/monitor', asyncHandler(async (req, res) => {
  const key = isAdmin(req) ? 'admin' : req.user.id;
  let base = monitorCache.get(key);
  if (!base) {
    const params = []; let where = "WHERE a.status='in_progress'";
    if (!isAdmin(req)) { params.push(req.user.id); where += ' AND a.proctor_id=$1'; }
    const { rows } = await query(
      `SELECT a.id AS attempt_id, a.tester_id, c.name AS candidate_name, s.name AS session_name, a.started_at, a.ends_at, a.flag_count,
              (SELECT count(*)::int FROM answers an WHERE an.attempt_id=a.id) AS answered,
              jsonb_array_length(a.question_ids) AS total_questions,
              (SELECT type FROM proctor_events e WHERE e.attempt_id=a.id ORDER BY e.at DESC, e.id DESC LIMIT 1) AS last_event
         FROM attempts a JOIN users c ON c.id=a.candidate_id JOIN sessions s ON s.id=a.session_id
         ${where} ORDER BY a.started_at DESC`, params);
    base = monitorCache.set(key, rows);
  }
  const now = Date.now();
  const rows = base.map((x) => ({ ...x, seconds_left: Math.max(0, Math.floor((new Date(x.ends_at).getTime() - now) / 1000)) }));
  sendJsonEtag(req, res, rows, base); // ETag ignores seconds_left
}));

export default r;
