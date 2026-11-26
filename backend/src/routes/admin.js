import { Router } from 'express';
import { hashPassword, comparePassword } from '../passwords.js';
import { query, tx } from '../db.js';
import { requireAuth, requireRole, dropUser } from '../auth.js';
import { snapshot } from '../metrics.js';
import { asyncHandler, HttpError, audit, isUuid, pctOf } from '../util.js';
import { createUser, bulkCreate, publicUser } from '../users.js';
import { listAttempts } from '../attemptQueries.js';
import { CATALOG, isSubjectId } from '../catalog.js';
import { keysFor, guardCheck, guardFail, guardOk } from '../bankKeys.js';

const r = Router();
r.use(requireAuth, requireRole('admin'));

// ---------- users ----------
r.get('/users', asyncHandler(async (req, res) => {
  const params = []; let where = '';
  if (req.query.role) { params.push(req.query.role); where = 'WHERE u.role=$1'; }
  const { rows } = await query(
    `SELECT u.id,u.name,u.email,u.role,u.active,u.proctor_id,u.created_at, p.name AS proctor_name,
            CASE WHEN u.role='proctor' THEN COALESCE((SELECT json_agg(subject_id) FROM proctor_subjects ps WHERE ps.proctor_id=u.id),'[]'::json) END AS subject_ids
       FROM users u LEFT JOIN users p ON p.id=u.proctor_id ${where} ORDER BY u.created_at DESC`, params);
  res.json(rows);
}));

r.post('/users', asyncHandler(async (req, res) => {
  const { name, email, password, role, proctor_id } = req.body || {};
  if (proctor_id) await assertProctor(proctor_id);
  const { user, generated_password } = await createUser({ name, email, password, role, proctor_id, created_by: req.user.id });
  res.status(201).json({ ...publicUser(user), ...(generated_password ? { generated_password } : {}) });
}));

r.post('/users/bulk', asyncHandler(async (req, res) => {
  const { role = 'candidate', proctor_id, rows } = req.body || {};
  if (proctor_id) await assertProctor(proctor_id);
  res.status(201).json(await bulkCreate({ rows, role, proctor_id, created_by: req.user.id }));
}));

r.patch('/users/:id', asyncHandler(async (req, res) => {
  const { id } = req.params; if (!isUuid(id)) throw new HttpError(400, 'Invalid id');
  const { name, active, password, proctor_id } = req.body || {};
  const cur = (await query('SELECT * FROM users WHERE id=$1', [id])).rows[0];
  if (!cur) throw new HttpError(404, 'User not found');
  if (id === req.user.id && active === false) throw new HttpError(400, 'You cannot deactivate your own account');
  const sets = []; const params = [id];
  const add = (col, val) => { params.push(val); sets.push(`${col}=$${params.length}`); };
  if (name !== undefined) { if (String(name).trim().length < 2) throw new HttpError(400, 'Name must be at least 2 characters'); add('name', String(name).trim()); }
  if (active !== undefined) add('active', !!active);
  if (password) { if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters'); add('password_hash', await hashPassword(String(password), 10)); }
  if (proctor_id !== undefined) {
    if (cur.role !== 'candidate') throw new HttpError(400, 'Only candidates can be assigned to a proctor');
    if (proctor_id) await assertProctor(proctor_id);
    add('proctor_id', proctor_id || null);
  }
  if (!sets.length) throw new HttpError(400, 'Nothing to update');
  const { rows } = await query(`UPDATE users SET ${sets.join(',')} WHERE id=$1 RETURNING id,name,email,role,active,proctor_id,created_at`, params);
  dropUser(id);
  await audit(req.user.id, 'user.update', 'user', id, { fields: Object.keys(req.body), password_reset: !!password });
  res.json(rows[0]);
}));

async function assertProctor(id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid proctor_id');
  const { rows } = await query("SELECT 1 FROM users WHERE id=$1 AND role='proctor'", [id]);
  if (!rows.length) throw new HttpError(400, 'proctor_id does not refer to a proctor');
}

// ---------- proctor subjects (subjects live in the in-code catalog; ids are slugs) ----------
r.put('/proctors/:id/subjects', asyncHandler(async (req, res) => {
  const { id } = req.params; await assertProctor(id);
  const ids = req.body?.subject_ids;
  if (!Array.isArray(ids) || !ids.every((x) => typeof x === 'string')) throw new HttpError(400, 'subject_ids must be an array of subject ids');
  if (!ids.every(isSubjectId)) throw new HttpError(400, 'One or more subjects do not exist');
  await tx(async (c) => {
    await c.query('DELETE FROM proctor_subjects WHERE proctor_id=$1', [id]);
    for (const sid of new Set(ids)) await c.query('INSERT INTO proctor_subjects (proctor_id, subject_id) VALUES ($1,$2)', [id, sid]);
  });
  await audit(req.user.id, 'proctor.subjects', 'user', id, { subject_ids: ids });
  res.json({ ok: true, subject_ids: [...new Set(ids)] });
}));

// ---------- runtime monitoring (drive day): memory, CPU, event-loop lag, pool, request rate ----------
r.get('/runtime', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(snapshot({ resetLoop: req.query.reset === '1' })); });

// ---------- reveal answers: admin re-enters their password ("code") to get the keys that unseal the bank ----------
r.post('/bank-keys', asyncHandler(async (req, res) => {
  const { password, question_ids } = req.body || {};
  guardCheck(req.user.id);
  const row = (await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id])).rows[0];
  const ok = typeof password === 'string' && password.length > 0 && row && await comparePassword(password, row.password_hash);
  if (!ok) {
    guardFail(req.user.id);
    await audit(req.user.id, 'bank_keys_denied', 'bank', null, {});
    throw new HttpError(403, 'Incorrect code');
  }
  guardOk(req.user.id);
  let ids = CATALOG.map((q) => q.id);
  if (question_ids !== undefined) {
    if (!Array.isArray(question_ids) || !question_ids.every((x) => typeof x === 'string')) throw new HttpError(400, 'question_ids must be an array of ids');
    const known = new Set(ids);
    if (!question_ids.every((x) => known.has(x))) throw new HttpError(400, 'One or more questions do not exist');
    ids = [...new Set(question_ids)];
  }
  await audit(req.user.id, 'bank_keys_revealed', 'bank', null, { count: ids.length });
  res.set('Cache-Control', 'no-store');
  res.json({ keys: keysFor(ids), expires_in: 600 });
}));

// ---------- attempts / stats / audit ----------
r.get('/attempts', asyncHandler(async (req, res) => {
  const { session_id, proctor_id, candidate_id, status } = req.query;
  res.json(await listAttempts({ session_id, proctor_id, candidate_id, status }));
}));

r.get('/stats', asyncHandler(async (req, res) => {
  const [u, s, a, avg, recent] = await Promise.all([
    query('SELECT role, count(*)::int AS n FROM users WHERE active GROUP BY role'),
    query('SELECT count(*)::int AS n FROM sessions'),
    query(`SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE status<>'in_progress')::int AS submitted,
                  count(*) FILTER (WHERE status='in_progress')::int AS in_progress FROM attempts`),
    query(`SELECT AVG(total_score/NULLIF(max_score,0))*100 AS p FROM attempts WHERE status<>'in_progress'`),
    listAttempts({}, 10),
  ]);
  const users = { admin: 0, proctor: 0, candidate: 0 };
  u.rows.forEach((x) => { users[x.role] = x.n; });
  res.json({
    users, questions: CATALOG.length, sessions: s.rows[0].n, attempts: a.rows[0],
    avg_percentage: avg.rows[0].p === null ? 0 : Math.round(avg.rows[0].p * 10) / 10, recent,
  });
}));

r.get('/audit', asyncHandler(async (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const { rows } = await query(
    `SELECT l.id, l.action, l.entity, l.entity_id, l.meta, l.at, l.actor_id, u.name AS actor_name
       FROM audit_logs l LEFT JOIN users u ON u.id=l.actor_id ORDER BY l.at DESC, l.id DESC LIMIT $1`, [limit]);
  res.json(rows);
}));

export default r;
