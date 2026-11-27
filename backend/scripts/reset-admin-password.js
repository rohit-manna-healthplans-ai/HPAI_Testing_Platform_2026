// Recover an ADMIN account when nobody can sign in (the in-app "Forgot password" is for proctors only).
//   NEW_PASSWORD='a-long-passphrase' npm run reset-admin-password                  (uses ADMIN_EMAIL from .env)
//   NEW_PASSWORD='a-long-passphrase' npm run reset-admin-password -- someone@healthplans.ai
// Prefer the NEW_PASSWORD environment variable: a password typed as a command argument stays in your shell history.
// Runs against the database in DATABASE_URL (backend/.env). Never prints the password.
import 'dotenv/config';
import { getPool, query } from '../src/db.js';
import { hashPassword, passwordProblem } from '../src/passwords.js';
import { audit } from '../src/util.js';

const args = process.argv.slice(2).filter((a) => a !== '--');
const email = String(args[0] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.NEW_PASSWORD || args[1] || '';

async function main() {
  if (!email) throw new Error('Admin email missing: set ADMIN_EMAIL in backend/.env or pass it as the first argument.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set (backend/.env).');
  const problem = passwordProblem(password, email);
  if (problem) throw new Error(`${problem}. Provide it with the NEW_PASSWORD environment variable.`);
  const { rows } = await query("SELECT id, role, active FROM users WHERE lower(email)=$1", [email]);
  const u = rows[0];
  if (!u) throw new Error(`No user with email ${email}.`);
  if (u.role !== 'admin') throw new Error(`${email} is not an admin account (role: ${u.role}). Use Admin > Users > Reset password for other roles.`);
  await query('UPDATE users SET password_hash=$2, password_changed_at=$3, active=true WHERE id=$1', [u.id, await hashPassword(password, 10), new Date()]);
  await audit(u.id, 'auth.admin_password_script', 'user', u.id, { via: 'cli' });
  console.log(`Password updated for ${email}. All earlier sessions of this account are now signed out.`);
}

main()
  .then(() => getPool().end())
  .catch(async (e) => { console.error(`Error: ${e.message}`); await getPool().end().catch(() => {}); process.exit(1); });
