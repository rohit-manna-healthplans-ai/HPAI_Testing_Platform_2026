import 'dotenv/config';
import { readFileSync } from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { countRequests } from './metrics.js';
import { query, getPool } from './db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import proctorRoutes from './routes/proctor.js';
import candidateRoutes from './routes/candidate.js';
import sharedRoutes from './routes/shared.js';
import { proctorInvites, publicInvites } from './routes/invites.js';

const { version: APP_VERSION } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => (!origin || origins.includes('*') || origins.includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposedHeaders: ['ETag'], // cross-origin (Vercel -> Render) fetch can only read ETag if it is exposed; needed for 304 polling
  maxAge: 600, // cache preflights (If-None-Match / Authorization) for 10 min -> fewer OPTIONS requests on the free instance
}));
// gzip at level 1: cheap on the 0.1 vCPU free instance, still shrinks JSON a lot. Tiny bodies (<1 KB) are left alone.
app.use(compression({ level: 1, threshold: 1024 }));
app.use(countRequests);
// Answers can carry code / UI files (512 KB); everything else is small.
app.use('/api/candidate/attempts', express.json({ limit: '512kb' }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', async (req, res) => {
  let db = 'unknown';
  try { await query('SELECT 1'); db = 'ok'; } catch { db = 'down'; }
  res.json({ ok: true, version: APP_VERSION, db, time: new Date().toISOString() });
});

// Login: brute-force protection per ACCOUNT (not per IP) plus a high per-IP ceiling, because a whole lab may share one public IP.
const rl = { windowMs: 60 * 1000, standardHeaders: true, legacyHeaders: false };
app.use('/api/auth/login',
  rateLimit({ ...rl, limit: 600, message: { error: 'Too many requests from this network. Please wait a minute.' } }),
  rateLimit({ ...rl, limit: 10, keyGenerator: (req) => `e:${String(req.body?.email || '').trim().toLowerCase().slice(0, 120)}`, message: { error: 'Too many login attempts for this account. Please wait a minute.' } }));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
// Public one-time invite links. Tokens are 192-bit random, so the limit only guards against abuse; it is per-IP and
// generous because many candidates may share one office/lab IP address.
app.use('/api/invite', rateLimit({ ...rl, limit: 1200, message: { error: 'Too many requests. Please wait a minute.' } }), publicInvites);
app.use('/api/proctor', proctorRoutes);
app.use('/api/proctor', proctorInvites);
app.use('/api/candidate', candidateRoutes);
app.use('/api', sharedRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server' : err.message });
});

/**
 * Process safety net (single free-tier instance, candidates may be mid-test):
 * - a stray unhandled rejection / uncaught exception is logged instead of killing the server;
 * - if it keeps happening (10+ in a minute) we exit so the platform restarts a clean instance;
 * - SIGTERM/SIGINT (every Render deploy) drain in-flight requests and close the DB pool before exiting.
 */
function installProcessGuards(server) {
  const recent = [];
  const note = (kind, e) => {
    console.error(`[${kind}]`, e?.stack || e);
    const now = Date.now();
    recent.push(now);
    while (recent.length && now - recent[0] > 60_000) recent.shift();
    if (recent.length >= 10) {
      console.error('Too many unexpected errors in one minute - exiting so the platform restarts a clean instance.');
      process.exit(1);
    }
  };
  process.on('unhandledRejection', (e) => note('unhandledRejection', e));
  process.on('uncaughtException', (e) => note('uncaughtException', e));

  let closing = false;
  const shutdown = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received - draining requests and closing the database pool`);
    const force = setTimeout(() => process.exit(0), 10_000);
    force.unref();
    server.close(() => { getPool().end().catch(() => {}).finally(() => process.exit(0)); });
    server.closeIdleConnections?.();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const port = process.env.PORT || 4000;
if (!process.env.VITEST) {
  const server = app.listen(port, () => console.log(`HPAI API listening on :${port}`));
  // Node closes idle keep-alive sockets after 5 s by default. A browser that reuses such a socket for a POST gets
  // ERR_CONNECTION_RESET (and proxies such as Render's answer 502). Keep sockets open longer than any proxy idle timeout.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${port} is already in use - stop the other backend first.` : e);
    process.exit(1);
  });
  installProcessGuards(server);
}
export default app;
