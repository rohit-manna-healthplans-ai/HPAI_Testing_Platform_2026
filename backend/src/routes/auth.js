import { Router } from 'express';
import { hashPassword, comparePassword, passwordProblem } from '../passwords.js';
import { query, tx } from '../db.js';
import { signToken, requireAuth, dropUser } from '../auth.js';
import { asyncHandler, HttpError, audit, EMAIL_RE } from '../util.js';
import { emailMode, appUrl, sendResetEmail } from '../mailer.js';
import { newToken, hashToken, isTokenShape, resetMinutes, maskName } from '../resetTokens.js';

const r = Router();

r.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw new HttpError(400, 'Email and password are required');
  const { rows } = await query('SELECT * FROM users WHERE lower(email)=$1', [email]);
  const u = rows[0];
  // constant-ish behaviour: always compare against some hash
  const ok = u ? await comparePassword(password, u.password_hash) : await comparePassword(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
  if (!u || !ok) throw new HttpError(401, 'Invalid email or password');
  if (!u.active) throw new HttpError(403, 'Your account has been deactivated. Contact your administrator.');
  await audit(u.id, 'auth.login', 'user', u.id, { ip: req.ip });
  res.json({ token: signToken(u), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}));

r.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const u = req.user;
  res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role } });
}));

r.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body || {};
  const problem = passwordProblem(new_password, req.user.email);
  if (problem) throw new HttpError(400, problem);
  const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await comparePassword(String(old_password || ''), rows[0].password_hash))) throw new HttpError(400, 'Current password is incorrect');
  // password_changed_at uses THIS server's clock (not the database's now()), the same clock that stamps JWT `iat`,
  // so a token issued right after the change can never look older than the change because of clock skew.
  const { rows: upd } = await query(
    'UPDATE users SET password_hash=$2, password_changed_at=$3 WHERE id=$1 RETURNING id,name,role',
    [req.user.id, await hashPassword(String(new_password), 10), new Date()]);
  dropUser(req.user.id);
  await audit(req.user.id, 'auth.change_password', 'user', req.user.id);
  // Every older session is now invalid; hand back a fresh token so the user who just changed it stays signed in.
  res.json({ ok: true, token: signToken(upd[0]) });
}));

// ---------- forgot / reset password (proctors) ----------
// Closed system: only active PROCTOR accounts can use this. The answer is always identical so nobody can probe which
// emails exist. Mode 1 (email configured): a one-time link is emailed over HTTPS. Mode 2: the request waits in the
// admin's "Password reset requests" list and the admin creates a link / temporary password.
const GENERIC = { ok: true, message: 'If this email belongs to a proctor account, a reset link has been sent or your admin has been notified.' };
const INVALID_LINK = 'This reset link is invalid or has expired';

async function processForgot(email, ip) {
  const u = (await query('SELECT id,name,email,role,active FROM users WHERE lower(email)=$1', [email])).rows[0];
  if (!u || u.role !== 'proctor' || !u.active) return;
  const mode = emailMode() ? 'email' : 'admin';
  const resetId = await tx(async (c) => {
    // one open request per user: a new one supersedes (and kills the link of) any earlier one
    await c.query("UPDATE password_resets SET status='dismissed', token_hash=NULL WHERE user_id=$1 AND status IN ('pending','issued')", [u.id]);
    const ins = await c.query('INSERT INTO password_resets (user_id, ip) VALUES ($1,$2) RETURNING id', [u.id, ip || null]);
    return ins.rows[0].id;
  });
  await audit(u.id, 'auth.forgot_password', 'user', u.id, { ip, mode });
  if (mode !== 'email') return;

  const token = newToken();
  const minutes = resetMinutes();
  await query("UPDATE password_resets SET status='issued', token_hash=$2, issued_at=now(), expires_at=now() + make_interval(mins => $3::int) WHERE id=$1",
    [resetId, hashToken(token), minutes]);
  try {
    await sendResetEmail({ to: u.email, name: u.name, link: `${appUrl()}/reset-password/${token}`, minutes });
    await query('UPDATE password_resets SET emailed=true WHERE id=$1', [resetId]);
  } catch (e) {
    // could not email: fall back to the admin queue (the unsent link is thrown away)
    console.error('reset email failed:', e.message);
    await query("UPDATE password_resets SET status='pending', token_hash=NULL, issued_at=NULL, expires_at=NULL WHERE id=$1 AND status='issued'", [resetId]);
  }
}

r.post('/forgot-password', (req, res, next) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) return next(new HttpError(400, 'Enter a valid email address'));
  res.json(GENERIC); // answer first: identical for existing / unknown / inactive / non-proctor accounts, no timing difference
  processForgot(email, req.ip).catch((e) => console.error('forgot-password failed:', e.message));
});

/** Valid = status issued, not expired, belongs to an active proctor. Returns the row or null. */
async function findValidReset(token) {
  if (!isTokenShape(token)) return null;
  const { rows } = await query(
    `SELECT pr.id, pr.user_id, u.name, u.email FROM password_resets pr JOIN users u ON u.id=pr.user_id
      WHERE pr.token_hash=$1 AND pr.status='issued' AND pr.expires_at > now() AND u.active AND u.role='proctor'`, [hashToken(token)]);
  return rows[0] || null;
}

r.get('/reset-password/:token', asyncHandler(async (req, res) => {
  const row = await findValidReset(req.params.token);
  res.set('Cache-Control', 'no-store');
  res.json(row ? { valid: true, name: maskName(row.name) } : { valid: false });
}));

r.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, new_password } = req.body || {};
  const row = await findValidReset(token);
  if (!row) throw new HttpError(400, INVALID_LINK);
  const problem = passwordProblem(new_password, row.email);
  if (problem) throw new HttpError(400, problem);
  const hash = await hashPassword(String(new_password), 10); // only after the token checked out: garbage tokens never cost CPU
  const done = await tx(async (c) => {
    // lock + re-check so two simultaneous submits cannot both use the link
    const cur = (await c.query("SELECT id, user_id FROM password_resets WHERE id=$1 AND status='issued' AND expires_at > now() FOR UPDATE", [row.id])).rows[0];
    if (!cur) return false;
    await c.query('UPDATE users SET password_hash=$2, password_changed_at=$3 WHERE id=$1', [cur.user_id, hash, new Date()]); // app clock, see change-password
    await c.query("UPDATE password_resets SET status='used', used_at=now(), token_hash=NULL WHERE id=$1", [cur.id]);
    await c.query("UPDATE password_resets SET status='dismissed', token_hash=NULL WHERE user_id=$1 AND status IN ('pending','issued') AND id<>$2", [cur.user_id, cur.id]);
    return true;
  });
  if (!done) throw new HttpError(400, INVALID_LINK);
  dropUser(row.user_id);
  await audit(row.user_id, 'auth.password_reset', 'user', row.user_id, { ip: req.ip });
  res.json({ ok: true });
}));

export default r;
