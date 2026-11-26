import { hashPassword } from './passwords.js';
import { query } from './db.js';
import { HttpError, EMAIL_RE, randomPassword, audit } from './util.js';

export const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role, active: u.active,
  proctor_id: u.proctor_id || null, proctor_name: u.proctor_name || null, created_at: u.created_at,
});

/** Create one user. Returns { user, generated_password? }. Throws HttpError 400/409. */
export async function createUser({ name, email, password, role, proctor_id, created_by }) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  email = String(email || '').trim().toLowerCase();
  if (name.length < 2) throw new HttpError(400, 'Name must be at least 2 characters');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, `Invalid email: ${email || '(empty)'}`);
  if (!['admin', 'proctor', 'candidate'].includes(role)) throw new HttpError(400, 'Invalid role');
  let generated;
  if (!password) { password = randomPassword(); generated = password; }
  if (String(password).length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
  const exists = await query('SELECT 1 FROM users WHERE lower(email)=$1', [email]);
  if (exists.rowCount) throw new HttpError(409, `A user with email ${email} already exists`);
  const hash = await hashPassword(String(password), 10);
  const { rows } = await query(
    `INSERT INTO users (name,email,password_hash,role,proctor_id,created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role,active,proctor_id,created_at`,
    [name, email, hash, role, role === 'candidate' ? proctor_id || null : null, created_by || null]
  );
  await audit(created_by, 'user.create', 'user', rows[0].id, { role, email });
  return { user: rows[0], generated_password: generated };
}

export async function bulkCreate({ rows, role, proctor_id, created_by }) {
  if (!Array.isArray(rows) || !rows.length) throw new HttpError(400, 'rows must be a non-empty array');
  if (rows.length > 500) throw new HttpError(400, 'Maximum 500 rows per request');
  const created = [], skipped = [];
  for (const r of rows) {
    try {
      const { user, generated_password } = await createUser({
        name: r?.name, email: r?.email, password: r?.password, role, proctor_id, created_by,
      });
      created.push({ id: user.id, name: user.name, email: user.email, password: generated_password || '(as provided)' });
    } catch (e) {
      if (e instanceof HttpError) skipped.push({ email: r?.email || '', reason: e.message });
      else throw e;
    }
  }
  return { created, skipped };
}
