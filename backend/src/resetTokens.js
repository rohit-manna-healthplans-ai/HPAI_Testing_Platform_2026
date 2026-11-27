import crypto from 'node:crypto';

/** One-time reset tokens: 32 random bytes (base64url). Only the sha256 hash is stored. */
export const newToken = () => crypto.randomBytes(32).toString('base64url');
export const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
export const isTokenShape = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{20,100}$/.test(t);
export const resetMinutes = () => {
  const n = parseInt(process.env.RESET_LINK_MINUTES || '30', 10);
  return Number.isFinite(n) && n >= 5 && n <= 1440 ? n : 30;
};
/** "Meera Iyer" -> "M*** I***" (enough for a friendly page, not enough to identify). */
export const maskName = (name) => String(name || '').trim().split(/\s+/).filter(Boolean).map((p) => `${p[0]}***`).join(' ') || '***';
