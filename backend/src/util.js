import crypto from 'node:crypto';
import { query } from './db.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const PW_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export function randomPassword(len = 10) {
  let out = '';
  for (let i = 0; i < len; i++) out += PW_CHARS[crypto.randomInt(PW_CHARS.length)];
  return out + '@' + crypto.randomInt(10, 99);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function certCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
  return `HPAI-${new Date().getFullYear()}-${s}`;
}

export const gradeFor = (pct) => (pct >= 80 ? 'Excellent' : pct >= 60 ? 'Good' : pct >= 40 ? 'Fair' : 'Needs Improvement');
export const pctOf = (score, max) => (max > 0 ? Math.round((score / max) * 1000) / 10 : 0);
export const round2 = (n) => Math.round(n * 100) / 100;

export async function audit(actorId, action, entity, entityId, meta = {}, client) {
  try {
    await (client || { query }).query(
      'INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta) VALUES ($1,$2,$3,$4,$5)',
      [actorId || null, action, entity || null, entityId ? String(entityId) : null, JSON.stringify(meta)]
    );
  } catch (e) { console.error('audit failed', e.message); }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isUuid = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const DIFF_ORDER = { easy: 0, medium: 1, hard: 2 };
// flag_count counts one flag per screen leave (not per raw tab_hidden/blur/fullscreen signal) plus other violations.
export const FLAG_EVENTS = ['screen_leave', 'screenshot_attempt', 'paste', 'devtools'];
export const CANDIDATE_EVENT_TYPES = ['screen_leave', 'screenshot_attempt', 'tab_hidden', 'window_blur', 'fullscreen_exit', 'paste', 'copy', 'devtools', 'note'];
