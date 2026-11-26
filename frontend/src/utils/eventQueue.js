import { api } from '../api.js';

// Integrity events are queued and sent in ONE request every 15 s (POST .../events/batch, max 50) instead of one request each.
// Critical events (screen_leave, screenshot_attempt) are flushed immediately because the proctor needs them now.
// Failures keep the queue (capped) and retry with exponential backoff + jitter. On page hide the queue is flushed with keepalive.
const FLUSH_MS = 15000;
const MAX_QUEUE = 120;
const MAX_BATCH = 50;
const CRITICAL = new Set(['screen_leave', 'screenshot_attempt']);

const queues = new Map(); // attemptId -> { items:[], timer:null, failures:0, sending:false }
let hooked = false;

const get = (id) => { if (!queues.has(id)) queues.set(id, { items: [], timer: null, failures: 0, sending: false }); return queues.get(id); };

function schedule(id, delay) {
  const q = get(id);
  if (q.timer) return;
  q.timer = setTimeout(() => { q.timer = null; flushEvents(id); }, delay);
}

export async function flushEvents(attemptId, { keepalive = false } = {}) {
  const q = get(attemptId);
  if (q.sending && !keepalive) return;
  if (!q.items.length) return;
  q.sending = true;
  const batch = q.items.slice(0, MAX_BATCH);
  try {
    await api.candidate.eventsBatch(attemptId, batch, keepalive ? { keepalive: true } : undefined);
    q.items.splice(0, batch.length);
    q.failures = 0;
  } catch (e) {
    if (e.status === 409 || e.status === 403 || e.status === 404) q.items.length = 0; // attempt over / not ours: nothing left to report
    else {
      q.failures += 1;
      const base = Math.min(30000, 2000 * 2 ** Math.min(q.failures, 4));
      schedule(attemptId, base * (0.7 + Math.random() * 0.6));
    }
  } finally {
    q.sending = false;
  }
  if (q.items.length && !q.timer && q.failures === 0) {
    const urgent = q.items.length >= MAX_BATCH || q.items.some((e) => CRITICAL.has(e.type)); // a critical event arrived while sending
    schedule(attemptId, urgent ? 250 : FLUSH_MS);
  }
}

function hook() {
  if (hooked || typeof window === 'undefined') return;
  hooked = true;
  const flushAll = () => { queues.forEach((q, id) => { if (q.items.length) flushEvents(id, { keepalive: true }); }); };
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); });
}

export function queueEvent(attemptId, type, meta) {
  if (!attemptId) return;
  hook();
  const q = get(attemptId);
  q.items.push({ type, meta: meta || {}, at: new Date().toISOString() });
  if (q.items.length > MAX_QUEUE) { // drop the oldest NON-critical event first
    const i = q.items.findIndex((e) => !CRITICAL.has(e.type));
    q.items.splice(i === -1 ? 0 : i, 1);
  }
  if (CRITICAL.has(type)) { flushEvents(attemptId); return; }
  schedule(attemptId, FLUSH_MS);
}

export function dropQueue(attemptId) {
  const q = queues.get(attemptId);
  if (q?.timer) clearTimeout(q.timer);
  queues.delete(attemptId);
}
