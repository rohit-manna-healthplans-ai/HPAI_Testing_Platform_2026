import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { asyncHandler, pctOf } from '../util.js';
import { listSubjectsWithCounts } from '../catalog.js';

const r = Router();

// GET /api/subjects (admin: all, proctor: assigned only) — served from the in-code question catalog
r.get('/subjects', requireAuth, requireRole('admin', 'proctor'), asyncHandler(async (req, res) => {
  let allowed;
  if (req.user.role === 'proctor') {
    allowed = (await query('SELECT subject_id FROM proctor_subjects WHERE proctor_id=$1', [req.user.id])).rows.map((x) => x.subject_id);
  }
  res.set('Cache-Control', 'private, max-age=30'); // catalog-derived, changes only on deploy / subject assignment
  res.json(listSubjectsWithCounts(allowed));
}));

// GET /api/verify/:code (public)
r.get('/verify/:code', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT c.code, c.issued_at, u.name, a.total_score, a.max_score
       FROM certificates c JOIN attempts a ON a.id=c.attempt_id JOIN users u ON u.id=a.candidate_id
      WHERE upper(c.code)=upper($1)`, [String(req.params.code || '')]);
  const c = rows[0];
  if (!c) return res.json({ valid: false });
  res.json({ valid: true, name: c.name, score: c.total_score, max: c.max_score, percentage: pctOf(c.total_score, c.max_score), issued_at: c.issued_at });
}));

export default r;
