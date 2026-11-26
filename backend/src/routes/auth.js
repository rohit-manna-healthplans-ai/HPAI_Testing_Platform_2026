import { Router } from 'express';
import { hashPassword, comparePassword } from '../passwords.js';
import { query } from '../db.js';
import { signToken, requireAuth } from '../auth.js';
import { asyncHandler, HttpError, audit } from '../util.js';

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
  if (!new_password || String(new_password).length < 6) throw new HttpError(400, 'New password must be at least 6 characters');
  const { rows } = await query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
  if (!(await comparePassword(String(old_password || ''), rows[0].password_hash))) throw new HttpError(400, 'Current password is incorrect');
  await query('UPDATE users SET password_hash=$2 WHERE id=$1', [req.user.id, await hashPassword(String(new_password), 10)]);
  await audit(req.user.id, 'auth.change_password', 'user', req.user.id);
  res.json({ ok: true });
}));

export default r;
