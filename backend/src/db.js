import 'dotenv/config';
import pg from 'pg';

// Return numeric/bigint as JS numbers (scores are small).
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

export function sslFor(url) {
  if (!url) return undefined;
  return /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false };
}

let pool;
export function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslFor(process.env.DATABASE_URL),
      // Small pool: Render free is 0.1 vCPU / 512 MB and the Supabase pooler multiplexes anyway.
      max: parseInt(process.env.PG_POOL_MAX || '8', 10),
      idleTimeoutMillis: 20000,
      keepAlive: true,
      query_timeout: 25000,
      connectionTimeoutMillis: 15000,
    });
    pool.on('error', (e) => console.error('pg pool error', e.message));
  }
  return pool;
}

export const query = (text, params) => getPool().query(text, params);

/** Run fn(client) inside a transaction. fn receives an object with .query(text, params). */
export async function tx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}
