import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { sslFor } from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function migrate(client) {
  const sql = fs.readFileSync(path.join(here, '../sql/schema.sql'), 'utf8');
  await client.query(sql);
  // Ordered, idempotent migrations for databases created by an older schema (no-ops on fresh databases).
  const dir = path.join(here, '../sql/migrations');
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      await client.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
}

// Run directly: `npm run migrate`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (see backend/.env.example)'); process.exit(1); }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: sslFor(process.env.DATABASE_URL) });
  try {
    await client.connect();
    await migrate(client);
    console.log('Schema applied.');
  } catch (e) {
    console.error('Migration failed:', e.message); process.exitCode = 1;
  } finally { await client.end(); }
}
