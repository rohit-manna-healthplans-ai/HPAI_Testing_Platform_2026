import jwt from 'jsonwebtoken';
import { query } from './db.js';
import { HttpError } from './util.js';
import { ttlCache } from './cache.js';

const SECRET = () => process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

export const signToken = (user, expiresIn = '12h') =>
  jwt.sign({ sub: user.id, role: user.role, name: user.name }, SECRET(), { expiresIn });

// Every request needs the user row; cache it briefly (bounded) so a burst of candidate calls costs no extra DB round trip.
// Deactivation/role changes call dropUser() so they apply immediately in this process.
const USER_TTL_MS = 20 * 1000;
const userCache = ttlCache(USER_TTL_MS, 1500);
export const dropUser = (id) => userCache.del(id);

export async function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) throw new HttpError(401, 'Authentication required');
    let payload;
    try { payload = jwt.verify(token, SECRET()); } catch { throw new HttpError(401, 'Session expired. Please sign in again.'); }
    let u = userCache.get(payload.sub);
    if (!u) {
      const { rows } = await query('SELECT id,name,email,role,active,proctor_id FROM users WHERE id=$1', [payload.sub]);
      u = rows[0] || null;
      if (u) userCache.set(payload.sub, u);
    }
    if (!u || !u.active) throw new HttpError(401, 'Account not found or deactivated');
    req.user = u;
    next();
  } catch (e) { next(e); }
}

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : next(new HttpError(403, 'You do not have access to this resource'));
