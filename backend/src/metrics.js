// Lightweight runtime metrics for drive-day monitoring (admin-only GET /api/admin/runtime).
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { getPool } from './db.js';
import { pendingHashes } from './passwords.js';

const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();
const startedAt = Date.now();
let total = 0;
const minute = new Array(60).fill(0); // requests per second of the last minute (ring)
let lastSec = Math.floor(Date.now() / 1000);

export function countRequests(req, res, next) {
  total += 1;
  const s = Math.floor(Date.now() / 1000);
  if (s !== lastSec) { for (let t = lastSec + 1; t <= s && t - lastSec <= 60; t++) minute[t % 60] = 0; lastSec = s; }
  minute[s % 60] += 1;
  next();
}

export function snapshot({ resetLoop = false } = {}) {
  const m = process.memoryUsage(); const c = process.cpuUsage();
  const pool = getPool();
  const out = {
    rss_mb: +(m.rss / 1048576).toFixed(1), heap_mb: +(m.heapUsed / 1048576).toFixed(1),
    cpu_user_ms: Math.round(c.user / 1000), cpu_system_ms: Math.round(c.system / 1000),
    event_loop_lag_ms: { p50: +(loop.percentile(50) / 1e6).toFixed(2), p99: +(loop.percentile(99) / 1e6).toFixed(2), max: +(loop.max / 1e6).toFixed(2) },
    pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
    bcrypt: pendingHashes(),
    uptime_s: Math.round((Date.now() - startedAt) / 1000),
    requests_total: total,
    requests_per_min: minute.reduce((a, b) => a + b, 0),
  };
  if (resetLoop) loop.reset();
  return out;
}
