// bcrypt is CPU heavy (pure JS). Run it through a small concurrency limiter so a burst of logins can never starve the
// event loop on the 0.1 vCPU free instance, and never use it on candidate / invite paths.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const MAX = 2;
let active = 0;
const queue = [];
function run(fn) {
  return new Promise((resolve, reject) => {
    const go = () => {
      active++;
      fn().then(resolve, reject).finally(() => { active--; const next = queue.shift(); if (next) next(); });
    };
    if (active < MAX) go(); else queue.push(go);
  });
}

export const hashPassword = (pw, cost = 10) => run(() => bcrypt.hash(String(pw), cost));
/** Non-bcrypt markers (e.g. invite candidates' placeholder password) never match, without spending CPU. */
export const comparePassword = (pw, hash) => (typeof hash === 'string' && hash.startsWith('$2')
  ? run(() => bcrypt.compare(String(pw), hash)) : Promise.resolve(false));
/** Cheap, unusable password marker for accounts that can only sign in via a one-time link. */
export const unusablePassword = () => `!${crypto.randomBytes(18).toString('hex')}`;
export const pendingHashes = () => ({ active, queued: queue.length });

const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyui', 'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'letmein1', 'changeme', 'changeme123']);
/**
 * Shared rule for passwords chosen by the user (change-password, reset link, admin recovery script).
 * Returns an error message, or null when the password is acceptable.
 */
export function passwordProblem(pw, email = '') {
  const p = String(pw ?? '');
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (p.length > 128) return 'Password must be at most 128 characters';
  if (!p.trim()) return 'Password cannot be blank';
  const lower = p.toLowerCase();
  const e = String(email || '').trim().toLowerCase();
  if (e && (lower === e || lower === e.split('@')[0])) return 'Password must not be your email address';
  if (COMMON.has(lower)) return 'That password is too common. Choose something harder to guess';
  return null;
}
