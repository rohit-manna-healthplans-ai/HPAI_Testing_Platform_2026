import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { countRequests } from './metrics.js';
import { query } from './db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import proctorRoutes from './routes/proctor.js';
import candidateRoutes from './routes/candidate.js';
import sharedRoutes from './routes/shared.js';
import { proctorInvites, publicInvites } from './routes/invites.js';

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy

const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => (!origin || origins.includes('*') || origins.includes(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
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
  res.json({ ok: true, db, time: new Date().toISOString() });
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

const port = process.env.PORT || 4000;
if (!process.env.VITEST) {
  app.listen(port, () => console.log(`HPAI API listening on :${port}`));
}
export default app;
