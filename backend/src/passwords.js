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
