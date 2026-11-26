// Sealed question bank keys.
// The browser bundle ships every question with its answers (hidden tests, MCQ correct options, UI check sources) AES-256-GCM
// encrypted. Per-question key = HMAC-SHA256(BANK_MASTER_KEY, 'hpai-bank-v1:' + questionId). This module is the ONLY place keys
// are derived; routes release them (a) to a candidate for the ids of their own in-progress attempt, and (b) to an admin who
// re-enters their password. Keys are never logged.
import crypto from 'node:crypto';
import { HttpError } from './util.js';

let master = null;
function masterKey() {
  if (master) return master;
  const hex = process.env.BANK_MASTER_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    console.error('BANK_MASTER_KEY is missing or not 64 hex characters — sealed questions cannot be opened.');
    throw new HttpError(500, 'Server is not configured for sealed questions');
  }
  master = Buffer.from(hex, 'hex');
  return master;
}

/** base64 AES-256 key for one question. */
export const deriveKey = (questionId) =>
  crypto.createHmac('sha256', masterKey()).update(`hpai-bank-v1:${questionId}`).digest('base64');

/** { [questionId]: base64Key } */
export function keysFor(questionIds) {
  const out = {};
  for (const id of questionIds || []) out[id] = deriveKey(id);
  return out;
}

// ---- admin "reveal answers" guard: 5 attempts/minute, and a 15 minute lock after 5 consecutive failures (in-memory) ----
const guard = new Map(); // userId -> { stamps:[ms], fails:number, lockedUntil:number }
const WINDOW_MS = 60 * 1000; const MAX_PER_WINDOW = 5; const LOCK_AFTER = 5; const LOCK_MS = 15 * 60 * 1000;

export function guardCheck(userId) {
  const g = guard.get(userId) || { stamps: [], fails: 0, lockedUntil: 0 };
  const now = Date.now();
  if (g.lockedUntil > now) {
    const mins = Math.ceil((g.lockedUntil - now) / 60000);
    throw new HttpError(429, `Too many incorrect codes. Answer reveal is locked for ${mins} more minute${mins === 1 ? '' : 's'}.`);
  }
  g.stamps = g.stamps.filter((t) => now - t < WINDOW_MS);
  if (g.stamps.length >= MAX_PER_WINDOW) throw new HttpError(429, 'Too many attempts. Please wait a minute.');
  g.stamps.push(now);
  guard.set(userId, g);
}
export function guardFail(userId) {
  const g = guard.get(userId) || { stamps: [], fails: 0, lockedUntil: 0 };
  g.fails += 1;
  if (g.fails >= LOCK_AFTER) { g.lockedUntil = Date.now() + LOCK_MS; g.fails = 0; }
  guard.set(userId, g);
}
export function guardOk(userId) {
  const g = guard.get(userId); if (g) { g.fails = 0; }
}
