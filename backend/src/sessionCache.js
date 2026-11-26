import { query } from './db.js';
import { ttlCache } from './cache.js';

// Session rows change rarely (open/closed). Cache them briefly (bounded) to cut DB round trips on hot paths; writers call dropSession().
const cache = ttlCache(30 * 1000, 300);

export async function getSessionCached(id) {
  let s = cache.get(id);
  if (s === undefined) {
    s = (await query('SELECT * FROM sessions WHERE id=$1', [id])).rows[0] || null;
    if (s) cache.set(id, s);
  }
  return s;
}
export const dropSession = (id) => cache.del(id);
