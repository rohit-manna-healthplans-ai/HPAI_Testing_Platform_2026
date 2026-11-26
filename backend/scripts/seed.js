import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { sslFor } from '../src/db.js';
import { migrate } from './migrate.js';
import { SUBJECTS } from '../src/catalog.generated.js';

const demo = process.argv.includes('--demo');
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (see backend/.env.example)'); process.exit(1); }

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: sslFor(process.env.DATABASE_URL) });

async function upsertUser(name, email, password, role, proctorId = null) {
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await client.query(
    `INSERT INTO users (name,email,password_hash,role,proctor_id) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (lower(email)) DO UPDATE SET role=EXCLUDED.role, active=true,
        proctor_id=COALESCE(EXCLUDED.proctor_id, users.proctor_id)
     RETURNING id`,
    [name, email.toLowerCase(), hash, role, proctorId]);
  return rows[0].id;
}

try {
  await client.connect();
  await migrate(client);
  console.log('✓ schema');

  // admin
  const adminEmail = process.env.ADMIN_EMAIL, adminPass = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPass) {
    // admin password is (re)set only when the account doesn't exist yet
    const ex = await client.query('SELECT id FROM users WHERE lower(email)=lower($1)', [adminEmail]);
    if (ex.rowCount) console.log(`✓ admin exists (${adminEmail}) — password unchanged`);
    else { await upsertUser('HPAI Admin', adminEmail, adminPass, 'admin'); console.log(`✓ admin created (${adminEmail})`); }
  } else console.warn('! ADMIN_EMAIL / ADMIN_PASSWORD not set — no admin created');

  // Questions and subjects live in code (question-bank/ -> src/catalog.generated.js); nothing to seed for them.

  if (demo) {
    const pid = await upsertUser('Demo Proctor', 'proctor@hpai.test', 'Test@1234', 'proctor');
    for (const sub of SUBJECTS) {
      await client.query('INSERT INTO proctor_subjects (proctor_id, subject_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [pid, sub.id]);
    }
    for (let i = 1; i <= 3; i++) {
      const cid = await upsertUser(`Demo Candidate ${i}`, `candidate${i}@hpai.test`, 'Test@1234', 'candidate', pid);
      await client.query('UPDATE users SET proctor_id=$2 WHERE id=$1', [cid, pid]);
    }
    console.log('✓ demo users: proctor@hpai.test, candidate1..3@hpai.test (password Test@1234)');
  }
  console.log('Done.');
} catch (e) {
  console.error('Seed failed:', e.message); process.exitCode = 1;
} finally { await client.end(); }
