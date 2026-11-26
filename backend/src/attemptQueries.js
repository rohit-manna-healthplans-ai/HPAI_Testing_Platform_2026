import { query } from './db.js';
import { pctOf } from './util.js';

export const shapeAttempt = (r) => ({
  id: r.id, session_id: r.session_id, session_name: r.session_name,
  candidate_id: r.candidate_id, candidate_name: r.candidate_name, candidate_email: r.candidate_email,
  proctor_id: r.proctor_id, proctor_name: r.proctor_name,
  status: r.status, started_at: r.started_at, ends_at: r.ends_at, submitted_at: r.submitted_at,
  duration_taken_sec: r.submitted_at ? Math.max(0, Math.round((new Date(r.submitted_at) - new Date(r.started_at)) / 1000)) : null,
  total_score: r.total_score, max_score: r.max_score, percentage: pctOf(r.total_score, r.max_score),
  flag_count: r.flag_count, tester_id: r.tester_id || null,
});

/** filters: session_id, proctor_id, candidate_id, status. */
export async function listAttempts(filters = {}, limit = 1000) {
  const where = []; const params = [];
  for (const k of ['session_id', 'proctor_id', 'candidate_id', 'status']) {
    if (filters[k]) { params.push(filters[k]); where.push(`a.${k}=$${params.length}`); }
  }
  params.push(limit);
  const { rows } = await query(
    `SELECT a.*, s.name AS session_name, c.name AS candidate_name, c.email AS candidate_email, p.name AS proctor_name
       FROM attempts a
       JOIN sessions s ON s.id=a.session_id
       JOIN users c ON c.id=a.candidate_id
       JOIN users p ON p.id=a.proctor_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY a.started_at DESC LIMIT $${params.length}`, params);
  return rows.map(shapeAttempt);
}
