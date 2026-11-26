import crypto from 'node:crypto';
import { Router } from 'express';
import { query, tx } from '../db.js';
import { requireAuth, requireRole, signToken } from '../auth.js';
import { asyncHandler, HttpError, EMAIL_RE, isUuid, audit, pctOf } from '../util.js';
import { createAttemptFor, assertSessionStartable, GRACE_MS } from '../attempts.js';
import { estimateSession } from '../catalog.js';
import {
  maxCandidates, makeToken, makeTesterId, hashToken, expiryFrom, parsePeople, assertCapacity, createInvitesBulk,
} from '../inviteCore.js';
import { unusablePassword } from '../passwords.js';
import { ttlCache } from '../cache.js';
import { sendJsonEtag } from '../http.js';
import { getSessionCached, dropSession } from '../sessionCache.js';

const isAdmin = (req) => req.user.role === 'admin';

/** Display status of an invite row (list endpoint). */
function statusOf(inv, now = Date.now()) {
  if (inv.revoked_at || inv.replaced_by && !inv.used_at) return 'revoked';
  if (inv.used_at) return 'used';
  if (new Date(inv.expires_at).getTime() < now) return 'expired';
  return 'unused';
}

async function loadOwnSession(req, id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid session id');
  const s = await getSessionCached(id);
  if (!s || (!isAdmin(req) && s.proctor_id !== req.user.id)) throw new HttpError(404, 'Session not found');
  return s;
}

/** Insert ONE invite (used by reissue, which keeps the tester id). Retries on a tester-id collision unless the id is fixed. */
async function insertInvite(client, { id, sessionId, proctorId, label, email = null, nameLocked = false, expiresAt, purpose = 'start', testerId, attemptId = null, candidateId = null }) {
  for (let i = 0; i < 8; i++) {
    const token = makeToken();
    const tid = testerId || makeTesterId();
    await client.query('SAVEPOINT inv_ins');
    try {
      const { rows } = await client.query(
        `INSERT INTO invites (id, token_hash, tester_id, session_id, proctor_id, label, email, name_locked, expires_at, purpose, attempt_id, candidate_id)
         VALUES (COALESCE($1, gen_random_uuid()),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [id || null, hashToken(token), tid, sessionId, proctorId, label || null, email, nameLocked, expiresAt, purpose, attemptId, candidateId]);
      await client.query('RELEASE SAVEPOINT inv_ins');
      return { row: rows[0], token };
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT inv_ins');
      if (e.code === '23505' && !testerId) continue;
      throw e;
    }
  }
  throw new HttpError(500, 'Could not generate a unique tester id. Please retry.');
}

// ------------------------------------------------------------------ proctor / admin routes (mounted at /api/proctor)
export const proctorInvites = Router();
proctorInvites.use(requireAuth, requireRole('proctor', 'admin'));

proctorInvites.get('/limits', (req, res) => {
  res.set('Cache-Control', 'private, max-age=300');
  res.json({ max_candidates_per_session: maxCandidates() });
});

proctorInvites.post('/sessions/:id/invites', asyncHandler(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  if (session.status !== 'open') throw new HttpError(409, 'Session is closed. Re-open it before creating invite links.');
  const b = req.body || {};
  const people = parsePeople(b, { countKey: 'count', defaultCount: 1 });
  if (!people) throw new HttpError(400, 'Provide count, names or people');
  const expiresAt = expiryFrom(b.expires_hours);
  const nameLocked = !!b.name_locked;

  const out = await tx(async (c) => {
    await c.query('SELECT 1 FROM sessions WHERE id=$1 FOR UPDATE', [session.id]); // serialise concurrent adds so the cap holds
    await assertCapacity(c, session.id, people.length);
    const list = await createInvitesBulk(c, { sessionId: session.id, proctorId: session.proctor_id, people, expiresAt, nameLocked });
    await audit(req.user.id, 'invite.create', 'session', session.id, { count: list.length, expires_at: expiresAt.toISOString() }, c);
    return list;
  });
  res.status(201).json({ invites: out });
}));

proctorInvites.get('/sessions/:id/invites', asyncHandler(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  const { rows } = await query(
    `SELECT i.id, i.tester_id, i.label, i.email, i.opened_at, i.open_count, i.name_locked, i.expires_at, i.used_at, i.revoked_at, i.replaced_by, i.purpose, i.created_at,
            u.name AS candidate_name, u.email AS candidate_email,
            a.id AS attempt_id, a.status AS attempt_status, a.submitted_at, a.total_score, a.max_score
       FROM invites i
       LEFT JOIN users u ON u.id=i.candidate_id
       LEFT JOIN attempts a ON a.id=i.attempt_id
      WHERE i.session_id=$1 AND i.replaced_by IS NULL
      ORDER BY i.created_at DESC, i.tester_id`, [session.id]);
  const now = Date.now();
  res.json(rows.map((x) => ({
    id: x.id, tester_id: x.tester_id, label: x.label, name: x.label, email: x.email, status: statusOf(x, now), purpose: x.purpose,
    opened_at: x.opened_at, open_count: x.open_count, name_locked: x.name_locked,
    expires_at: x.expires_at, used_at: x.used_at, created_at: x.created_at,
    candidate_name: x.candidate_name || null,
    attempt: x.attempt_id ? {
      id: x.attempt_id, status: x.attempt_status, submitted_at: x.submitted_at,
      ...(x.attempt_status && x.attempt_status !== 'in_progress' ? { total_score: x.total_score, max_score: x.max_score } : {}),
    } : null,
  })));
}));

// ---- live board: ONE aggregated query set, short server-side cache (many pollers share it), ETag for cheap unchanged polls ----
const liveCache = ttlCache(2000, 100);
const PLACEHOLDER_EMAIL = /@invite\.hpai\.local$/i;

const LIVE_SQL = `
WITH att AS (
  SELECT id, candidate_id, status, started_at, ends_at, submitted_at, total_score, max_score, flag_count, question_ids, tester_id
    FROM attempts WHERE session_id=$1),
ans AS (
  SELECT attempt_id, count(*)::int AS answered, max(updated_at) AS last_ans
    FROM answers WHERE attempt_id IN (SELECT id FROM att) GROUP BY attempt_id),
ev AS (
  SELECT attempt_id, (count(*) FILTER (WHERE type='screen_leave'))::int AS leaves, max(at) AS last_ev
    FROM proctor_events WHERE attempt_id IN (SELECT id FROM att) GROUP BY attempt_id)
SELECT * FROM (
  SELECT i.id AS invite_id, i.tester_id, i.label, i.email AS inv_email, i.created_at, i.opened_at, i.open_count, i.expires_at, i.revoked_at,
         u.name AS user_name, u.email AS user_email,
         att.id AS attempt_id, att.status AS attempt_status, att.started_at, att.ends_at, att.submitted_at, att.total_score, att.max_score, att.flag_count,
         jsonb_array_length(att.question_ids) AS total_q,
         COALESCE(ans.answered,0) AS answered, ans.last_ans, COALESCE(ev.leaves,0) AS leaves, ev.last_ev
    FROM invites i
    LEFT JOIN att ON att.id = i.attempt_id
    LEFT JOIN users u ON u.id = i.candidate_id
    LEFT JOIN ans ON ans.attempt_id = att.id
    LEFT JOIN ev ON ev.attempt_id = att.id
   WHERE i.session_id=$1 AND i.replaced_by IS NULL
  UNION ALL
  SELECT NULL::uuid, att.tester_id, NULL::text, NULL::text, u.created_at, NULL::timestamptz, 0, NULL::timestamptz, NULL::timestamptz,
         u.name, u.email,
         att.id, att.status, att.started_at, att.ends_at, att.submitted_at, att.total_score, att.max_score, att.flag_count,
         jsonb_array_length(att.question_ids),
         COALESCE(ans.answered,0), ans.last_ans, COALESCE(ev.leaves,0), ev.last_ev
    FROM session_candidates sc
    JOIN users u ON u.id = sc.candidate_id
    LEFT JOIN att ON att.candidate_id = sc.candidate_id
    LEFT JOIN ans ON ans.attempt_id = att.id
    LEFT JOIN ev ON ev.attempt_id = att.id
   WHERE sc.session_id=$1
     AND NOT EXISTS (SELECT 1 FROM invites i2 WHERE i2.session_id=$1 AND i2.candidate_id=sc.candidate_id)
) t ORDER BY created_at, tester_id NULLS LAST`;

function liveStatus(r, now) {
  if (r.attempt_id) return r.attempt_status === 'in_progress' ? 'in_progress' : 'submitted';
  if (r.revoked_at) return 'revoked';
  if (r.expires_at && new Date(r.expires_at).getTime() < now) return 'expired';
  if (r.opened_at || r.open_count > 0) return 'opened';
  return 'not_opened';
}

async function buildLive(session) {
  const { rows } = await query(LIVE_SQL, [session.id]);
  const est = estimateSession(session.subject_config, session.fixed_question_ids);
  const now = Date.now();
  const counts = { total: 0, not_opened: 0, opened: 0, in_progress: 0, submitted: 0, expired: 0, revoked: 0 };
  const out = rows.map((r) => {
    const status = liveStatus(r, now);
    counts.total += 1; counts[status] += 1;
    const ended = status === 'submitted';
    const email = r.user_email && !PLACEHOLDER_EMAIL.test(r.user_email) ? r.user_email : (r.inv_email || null);
    const last = [r.last_ans, r.last_ev, r.started_at].filter(Boolean).map((d) => new Date(d).getTime());
    return {
      invite_id: r.invite_id, tester_id: r.tester_id || null, name: r.user_name || r.label || null, email, status,
      opened_at: r.opened_at, started_at: r.started_at || null, ends_at: r.ends_at || null,
      answered: r.answered, total_questions: r.total_q ?? est.question_count,
      flag_count: r.flag_count || 0, screen_leaves: r.leaves,
      last_activity_at: last.length ? new Date(Math.max(...last)).toISOString() : null,
      attempt_id: r.attempt_id || null,
      total_score: ended ? r.total_score : null, max_score: ended ? r.max_score : null,
      percentage: ended ? pctOf(r.total_score, r.max_score) : null,
    };
  });
  return {
    session: {
      id: session.id, name: session.name, status: session.status, duration_mins: session.duration_mins,
      opens_at: session.opens_at, closes_at: session.closes_at, total_questions: est.question_count, total_marks: est.total_marks,
    },
    counts, rows: out,
  };
}

proctorInvites.get('/sessions/:id/live', asyncHandler(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  let base = liveCache.get(session.id);
  if (!base) base = liveCache.set(session.id, await buildLive(session));
  const now = Date.now();
  const rows = base.rows.map((r) => ({
    ...r, seconds_left: r.status === 'in_progress' && r.ends_at ? Math.max(0, Math.floor((new Date(r.ends_at).getTime() - now) / 1000)) : null,
  }));
  const payload = { server_now: new Date(now).toISOString(), session: base.session, counts: base.counts, rows };
  sendJsonEtag(req, res, payload, base); // ETag ignores server_now / seconds_left
}));

// A link may be removed only if it was NEVER used (no redeem, no attempt) and is dead: revoked, replaced by a newer link, or expired.
// Alias `i` is required by the callers.
const REMOVABLE = `i.used_at IS NULL AND i.attempt_id IS NULL AND (i.revoked_at IS NOT NULL OR i.replaced_by IS NOT NULL OR i.expires_at < now())`;

// ---- bulk actions ----
proctorInvites.post('/sessions/:id/bulk', asyncHandler(async (req, res) => {
  const session = await loadOwnSession(req, req.params.id);
  const b = req.body || {};
  const action = String(b.action || '');
  const sid = session.id;
  const flush = () => { liveCache.del(sid); dropSession(sid); };

  if (action === 'extend') {
    const minutes = parseInt(b.minutes, 10);
    const reason = String(b.reason || '').trim();
    if (!(minutes >= 1 && minutes <= 60)) throw new HttpError(400, 'minutes must be between 1 and 60');
    if (reason.length < 3) throw new HttpError(400, 'A reason is required');
    let ids = null;
    if (b.attempt_ids !== undefined && b.attempt_ids !== null) {
      if (!Array.isArray(b.attempt_ids) || b.attempt_ids.length > 1000 || !b.attempt_ids.every(isUuid)) throw new HttpError(400, 'attempt_ids must be an array of attempt ids');
      ids = b.attempt_ids;
    }
    const affected = await tx(async (c) => {
      const { rows } = await c.query(
        `UPDATE attempts SET ends_at = ends_at + make_interval(mins => $2), extra_minutes = extra_minutes + $2
          WHERE session_id=$1 AND status='in_progress' AND ($3::uuid[] IS NULL OR id = ANY($3::uuid[])) RETURNING id`, [sid, minutes, ids]);
      const got = rows.map((x) => x.id);
      if (got.length) {
        await c.query(`INSERT INTO proctor_events (attempt_id,type,meta) SELECT x,'extend_time',$2::jsonb FROM unnest($1::uuid[]) x`,
          [got, JSON.stringify({ minutes, reason, by: req.user.id, bulk: true })]);
        await c.query(`INSERT INTO audit_logs (actor_id,action,entity,entity_id,meta) SELECT $1,'attempt.extend','attempt',x::text,$3::jsonb FROM unnest($2::uuid[]) x`,
          [req.user.id, got, JSON.stringify({ minutes, reason, bulk: true })]);
      }
      return got.length;
    });
    flush();
    return res.json({ ok: true, action, affected });
  }

  if (action === 'revoke_unused') {
    const { rowCount } = await query(
      `UPDATE invites SET revoked_at=now()
        WHERE session_id=$1 AND replaced_by IS NULL AND used_at IS NULL AND revoked_at IS NULL AND attempt_id IS NULL
          AND purpose='start' AND expires_at > now()`, [sid]);
    if (rowCount) await audit(req.user.id, 'invite.revoke_unused', 'session', sid, { count: rowCount });
    flush();
    return res.json({ ok: true, action, affected: rowCount });
  }

  if (action === 'regenerate_unused') {
    if (session.status !== 'open') throw new HttpError(409, 'Session is closed. Re-open it first.');
    const expiresAt = expiryFrom(b.expires_hours);
    const out = await tx(async (c) => {
      const old = (await c.query(
        `SELECT id, tester_id, label, email, name_locked FROM invites
          WHERE session_id=$1 AND replaced_by IS NULL AND used_at IS NULL AND revoked_at IS NULL AND attempt_id IS NULL AND purpose='start'
          FOR UPDATE`, [sid])).rows;
      if (!old.length) return [];
      const fresh = old.map((o) => { const token = makeToken(); return { o, id: crypto.randomUUID(), token, hash: hashToken(token) }; });
      // flag the old rows replaced first (frees their live tester ids), then insert the new rows with the same ids
      await c.query(`UPDATE invites i SET revoked_at=now(), replaced_by=n.nid FROM unnest($1::uuid[], $2::uuid[]) AS n(oid, nid) WHERE i.id=n.oid`,
        [fresh.map((f) => f.o.id), fresh.map((f) => f.id)]);
      const { rows: ins } = await c.query(
        `INSERT INTO invites (id, token_hash, tester_id, session_id, proctor_id, label, email, name_locked, expires_at)
         SELECT u.id, u.hash, u.tid, $6::uuid, $7::uuid, u.label, u.email, u.locked, $8::timestamptz
           FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $9::boolean[]) AS u(id, hash, tid, label, email, locked)
         RETURNING id, expires_at`,
        [fresh.map((f) => f.id), fresh.map((f) => f.hash), fresh.map((f) => f.o.tester_id), fresh.map((f) => f.o.label), fresh.map((f) => f.o.email),
          sid, session.proctor_id, expiresAt, fresh.map((f) => f.o.name_locked)]);
      const exp = new Map(ins.map((x) => [x.id, x.expires_at]));
      await audit(req.user.id, 'invite.regenerate_unused', 'session', sid, { count: fresh.length }, c);
      return fresh.map((f) => ({ id: f.id, tester_id: f.o.tester_id, label: f.o.label, name: f.o.label, email: f.o.email, token: f.token, expires_at: exp.get(f.id) }));
    });
    flush();
    return res.json({ ok: true, action, affected: out.length, invites: out });
  }

  if (action === 'close') {
    await query(`UPDATE sessions SET status='closed' WHERE id=$1`, [sid]);
    await audit(req.user.id, 'session.status', 'session', sid, { status: 'closed', bulk: true });
    flush();
    return res.json({ ok: true, action, affected: 1 });
  }

  if (action === 'remove_inactive') {
    // ONE statement: delete every never-used link of this session that is revoked, replaced or expired. Used links and
    // links tied to an attempt (incl. resume links) carry results and are never touched. replaced_by is a plain column
    // (no FK), so dropping reissue-chain predecessors together with their successor cannot fail.
    const { rows } = await query(
      `WITH del AS (
         DELETE FROM invites i
          WHERE i.session_id=$1 AND ${REMOVABLE}
          RETURNING i.id, i.replaced_by)
       SELECT (count(*) FILTER (WHERE replaced_by IS NULL))::int AS visible, count(*)::int AS total FROM del`, [sid]);
    const { visible, total } = rows[0];
    if (total) await audit(req.user.id, 'invite.remove_inactive', 'session', sid, { count: visible, rows_deleted: total });
    flush();
    // affected = links that were visible on the board (the number the proctor sees); rows_deleted also counts hidden reissue predecessors
    return res.json({ ok: true, action, affected: visible, rows_deleted: total });
  }
  throw new HttpError(400, "action must be one of: extend, revoke_unused, regenerate_unused, remove_inactive, close");
}));

async function loadOwnInvite(req, id) {
  if (!isUuid(id)) throw new HttpError(400, 'Invalid invite id');
  const inv = (await query('SELECT * FROM invites WHERE id=$1', [id])).rows[0];
  if (!inv || (!isAdmin(req) && inv.proctor_id !== req.user.id)) throw new HttpError(404, 'Invite not found');
  return inv;
}

proctorInvites.post('/invites/:id/revoke', asyncHandler(async (req, res) => {
  const inv = await loadOwnInvite(req, req.params.id);
  if (inv.used_at) throw new HttpError(409, 'This link has already been used and cannot be revoked');
  const { rowCount } = await query('UPDATE invites SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL AND used_at IS NULL', [inv.id]);
  if (rowCount) await audit(req.user.id, 'invite.revoke', 'invite', inv.id, { tester_id: inv.tester_id });
  liveCache.del(inv.session_id);
  res.json({ ok: true });
}));

// Permanently remove ONE dead, never-used link (and its dead reissue predecessors). Used links carry results and are refused.
proctorInvites.delete('/invites/:id', asyncHandler(async (req, res) => {
  const inv = await loadOwnInvite(req, req.params.id);
  if (inv.used_at) throw new HttpError(409, 'Used links carry results and cannot be removed');
  if (inv.attempt_id) throw new HttpError(409, 'This link belongs to a test attempt and cannot be removed');
  const dead = inv.revoked_at || inv.replaced_by || new Date(inv.expires_at).getTime() < Date.now();
  if (!dead) throw new HttpError(409, 'Active links cannot be removed: revoke it first');
  const removed = await tx(async (c) => {
    // the link itself plus never-used predecessors that were replaced by it (a reissue chain); guarded so nothing used is deleted
    const { rowCount } = await c.query(
      `WITH RECURSIVE chain AS (
         SELECT id FROM invites WHERE id=$1
         UNION
         SELECT p.id FROM invites p JOIN chain c ON p.replaced_by = c.id)
       DELETE FROM invites i WHERE i.id IN (SELECT id FROM chain) AND i.used_at IS NULL AND i.attempt_id IS NULL`, [inv.id]);
    if (rowCount) await audit(req.user.id, 'invite.remove', 'invite', inv.id, { tester_id: inv.tester_id, session_id: inv.session_id, rows_deleted: rowCount }, c);
    return rowCount;
  });
  liveCache.del(inv.session_id);
  dropSession(inv.session_id);
  res.json({ ok: true, removed: removed > 0 });
}));

proctorInvites.post('/invites/:id/reissue', asyncHandler(async (req, res) => {
  const inv = await loadOwnInvite(req, req.params.id);
  if (inv.replaced_by) throw new HttpError(409, 'This link was already reissued. Use the latest link for this tester.');
  const sess = await getSessionCached(inv.session_id);
  if (!sess || sess.status !== 'open') throw new HttpError(409, 'Session is closed. Re-open it first.');
  const expiresAt = expiryFrom(req.body?.expires_hours);
  const newId = crypto.randomUUID();

  const result = await tx(async (c) => {
    const cur = (await c.query('SELECT * FROM invites WHERE id=$1 FOR UPDATE', [inv.id])).rows[0];
    if (cur.replaced_by) throw new HttpError(409, 'This link was already reissued. Use the latest link for this tester.');
    let purpose = 'start'; let attemptId = null; let candidateId = null;
    if (cur.used_at) {
      const a = cur.attempt_id ? (await c.query('SELECT id, candidate_id, status FROM attempts WHERE id=$1', [cur.attempt_id])).rows[0] : null;
      if (!a || a.status !== 'in_progress') throw new HttpError(409, 'The attempt has already ended, so there is nothing to resume.');
      purpose = 'resume'; attemptId = a.id; candidateId = a.candidate_id;
    } else if (!cur.revoked_at) {
      await c.query('UPDATE invites SET revoked_at=now() WHERE id=$1', [cur.id]);
    }
    await c.query('UPDATE invites SET replaced_by=$2 WHERE id=$1', [cur.id, newId]);
    const { row, token } = await insertInvite(c, {
      id: newId, sessionId: cur.session_id, proctorId: cur.proctor_id, label: cur.label, email: cur.email, nameLocked: cur.name_locked, expiresAt,
      purpose, testerId: cur.tester_id, attemptId, candidateId,
    });
    await audit(req.user.id, 'invite.reissue', 'invite', row.id, { tester_id: cur.tester_id, purpose, replaces: cur.id }, c);
    return { row, token };
  });
  liveCache.del(inv.session_id);
  res.status(201).json({
    invite: { id: result.row.id, tester_id: result.row.tester_id, label: result.row.label, purpose: result.row.purpose, token: result.token, expires_at: result.row.expires_at },
  });
}));

// ------------------------------------------------------------------ public routes (mounted at /api/invite)
export const publicInvites = Router();

async function findByToken(client, token, lock = false) {
  const t = String(token || '');
  if (t.length < 20 || t.length > 100 || !/^[A-Za-z0-9_-]+$/.test(t)) return null;
  const { rows } = await client.query(`SELECT * FROM invites WHERE token_hash=$1${lock ? ' FOR UPDATE' : ''}`, [hashToken(t)]);
  return rows[0] || null;
}

publicInvites.get('/:token', asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const inv = await findByToken({ query }, req.params.token);
  if (!inv) return res.json({ status: 'invalid' });
  const st = statusOf(inv);
  if (st !== 'unused') return res.json({ status: st });
  const s = await getSessionCached(inv.session_id);
  if (!s) return res.json({ status: 'invalid' });
  const now = Date.now();
  const server_now = new Date(now).toISOString();
  const view = () => { query('UPDATE invites SET opened_at=COALESCE(opened_at, now()), open_count=open_count+1 WHERE id=$1', [inv.id]).catch(() => {}); };

  if (inv.purpose === 'resume') {
    const a = inv.attempt_id ? (await query('SELECT status FROM attempts WHERE id=$1', [inv.attempt_id])).rows[0] : null;
    if (!a || a.status !== 'in_progress') return res.json({ status: 'closed' });
  } else {
    if (s.status !== 'open' || (s.closes_at && new Date(s.closes_at).getTime() < now)) return res.json({ status: 'closed' });
    if (s.opens_at && new Date(s.opens_at).getTime() > now) {
      view();
      return res.json({ status: 'not_open_yet', opens_at: s.opens_at, closes_at: s.closes_at, server_now, tester_id: inv.tester_id, session: { name: s.name } });
    }
  }
  view();
  const est = estimateSession(s.subject_config, s.fixed_question_ids);
  res.json({
    status: 'valid', purpose: inv.purpose, tester_id: inv.tester_id, label: inv.label,
    prefill: { name: inv.label || '', email: inv.email || '', locked: !!(inv.name_locked && inv.label) },
    opens_at: s.opens_at, closes_at: s.closes_at, server_now,
    session: { name: s.name, duration_mins: s.duration_mins, question_count: est.question_count, total_marks: est.total_marks },
  });
}));

publicInvites.post('/:token/redeem', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const nameIn = String(body.name || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const emailIn = String(body.email || '').trim().toLowerCase();
  if (emailIn && !EMAIL_RE.test(emailIn)) throw new HttpError(400, 'Please enter a valid email address or leave it empty');
  const ip = req.ip || null; const ua = req.headers['user-agent'];

  const out = await tx(async (c) => {
    const inv = await findByToken(c, req.params.token, true);
    if (!inv) throw new HttpError(404, 'This link is not valid');
    if (inv.revoked_at || (inv.replaced_by && !inv.used_at)) throw new HttpError(410, 'This link has been revoked. Please ask your proctor for a new one.');
    if (inv.used_at) throw new HttpError(410, 'This link has already been used');
    if (new Date(inv.expires_at).getTime() < Date.now()) throw new HttpError(410, 'This link has expired. Please ask your proctor for a new one.');
    const sess = (await c.query('SELECT * FROM sessions WHERE id=$1', [inv.session_id])).rows[0];
    if (!sess) throw new HttpError(404, 'This link is not valid');

    let user; let attempt;
    if (inv.purpose === 'resume') {
      attempt = (await c.query('SELECT * FROM attempts WHERE id=$1', [inv.attempt_id])).rows[0];
      if (!attempt || attempt.status !== 'in_progress' || Date.now() > new Date(attempt.ends_at).getTime() + GRACE_MS) {
        throw new HttpError(410, 'This test has already ended');
      }
      user = (await c.query('SELECT id,name,email,role,active FROM users WHERE id=$1', [attempt.candidate_id])).rows[0];
      if (!user?.active) throw new HttpError(403, 'This candidate account is deactivated');
    } else {
      if (sess.opens_at && new Date(sess.opens_at).getTime() > Date.now()) {
        throw new HttpError(409, `This test has not opened yet. It opens at ${new Date(sess.opens_at).toISOString()}. Please try again then.`);
      }
      assertSessionStartable(sess);
      // a locked invite carries the proctor's name/email and ignores what the browser sends
      const locked = !!(inv.name_locked && inv.label);
      const name = locked ? inv.label : (nameIn || inv.label || '');
      const wantEmail = locked ? (inv.email || '') : (emailIn || inv.email || '');
      if (name.length < 2) throw new HttpError(400, 'Please enter your full name (at least 2 characters)');

      let existing = null;
      if (wantEmail) existing = (await c.query('SELECT id,name,email,role,active,proctor_id FROM users WHERE lower(email)=$1', [wantEmail])).rows[0] || null;
      if (existing && existing.role === 'candidate' && existing.active && existing.proctor_id === inv.proctor_id) {
        user = existing;
        const dup = (await c.query('SELECT 1 FROM attempts WHERE session_id=$1 AND candidate_id=$2', [sess.id, user.id])).rowCount;
        if (dup) throw new HttpError(409, 'This candidate already has an attempt in this session');
      } else {
        const email = wantEmail && !existing ? wantEmail : `${inv.tester_id.toLowerCase()}@invite.hpai.local`;
        // Cheap unusable marker (NOT bcrypt): these accounts can only enter through their one-time link.
        user = (await c.query(
          `INSERT INTO users (name,email,password_hash,role,proctor_id,created_by) VALUES ($1,$2,$3,'candidate',$4,$4)
           RETURNING id,name,email,role,active`, [name, email, unusablePassword(), inv.proctor_id])).rows[0];
      }
      await c.query('INSERT INTO session_candidates (session_id,candidate_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [sess.id, user.id]);
      attempt = await createAttemptFor(c, sess, user.id, { ip, userAgent: ua, testerId: inv.tester_id });
    }
    await c.query('UPDATE invites SET used_at=now(), attempt_id=$2, candidate_id=$3 WHERE id=$1', [inv.id, attempt.id, user.id]);
    return { user, attempt, tester_id: inv.tester_id, purpose: inv.purpose, invite_id: inv.id, session_id: sess.id };
  });
  liveCache.del(out.session_id);
  audit(out.user.id, out.purpose === 'resume' ? 'invite.resume' : 'invite.redeem', 'invite', out.invite_id, { tester_id: out.tester_id, attempt_id: out.attempt.id }); // not awaited

  // JWT valid for the rest of the attempt (incl. possible time extensions) plus a 3h buffer
  const secs = Math.max(0, Math.ceil((new Date(out.attempt.ends_at).getTime() - Date.now()) / 1000)) + 3 * 3600;
  res.json({
    token: signToken(out.user, secs),
    user: { id: out.user.id, name: out.user.name, email: out.user.email, role: out.user.role },
    attempt: { id: out.attempt.id, started_at: out.attempt.started_at, ends_at: out.attempt.ends_at, status: out.attempt.status },
    tester_id: out.tester_id,
  });
}));
