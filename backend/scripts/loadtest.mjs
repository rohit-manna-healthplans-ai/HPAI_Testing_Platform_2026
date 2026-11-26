// Load / capacity test: N simulated candidates take a (short) test at the same time over plain HTTP.
//   node scripts/loadtest.mjs [--n 50] [--base http://localhost:4600] [--rounds 3] [--ramp 3] [--poll 1000]
// Needs backend/.env (ADMIN_EMAIL / ADMIN_PASSWORD / DATABASE_URL). It creates a throw-away proctor + session (@lt.test),
// runs: invite GET -> redeem -> GET attempt -> bulk autosaves (jitter) -> events batch -> submit -> result, while a proctor
// polls the live board (ETag / 304). Reports latency percentiles, errors, server CPU/RSS (from /admin/runtime) and verifies
// every attempt ended submitted with the expected totals. All test rows are deleted at the end (even on failure).
import 'dotenv/config';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { CATALOG } from '../src/catalog.generated.js';
import { query, getPool } from '../src/db.js';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const N = parseInt(arg('n', '50'), 10);
const BASE = arg('base', 'http://localhost:4600').replace(/\/$/, '');
const ROUNDS = parseInt(arg('rounds', '3'), 10);
const RAMP_MS = parseFloat(arg('ramp', '3')) * 1000;
const POLL_MS = parseInt(arg('poll', '1000'), 10);
const RUN = crypto.randomBytes(3).toString('hex');
const round2 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- http + stats
const lat = new Map(); const errs = new Map(); const statuses = new Map(); const bytes = new Map(); let bytesOut = 0;
function record(label, ms, ok, status) {
  if (!lat.has(label)) lat.set(label, []);
  lat.get(label).push(ms);
  const k = `${label} ${status}`; statuses.set(k, (statuses.get(k) || 0) + 1);
  if (!ok) errs.set(label, (errs.get(label) || 0) + 1);
}
async function http(label, method, path, { token, body, headers = {}, okStatuses = [200, 201] } = {}) {
  const t0 = performance.now();
  let res; let data = null; let status = 0;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    status = res.status;
    if (status !== 304) { try { const txt = await res.text(); bytes.set(label, (bytes.get(label) || 0) + Buffer.byteLength(txt)); data = JSON.parse(txt); } catch { /* empty */ } }
    bytesOut += body === undefined ? 0 : JSON.stringify(body).length;
  } catch (e) {
    record(label, performance.now() - t0, false, 'NETERR');
    return { status: 0, data: null, error: e.message };
  }
  const ms = performance.now() - t0;
  record(label, ms, okStatuses.includes(status) || status === 304, status);
  return { status, data, etag: res.headers.get('etag') };
}
const pct = (arr, p) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0; };

// ---------------------------------------------------------------- cleanup (always)
async function cleanup() {
  const prox = (await query(`SELECT id FROM users WHERE role='proctor' AND email LIKE $1`, [`lt-${RUN}-%@lt.test`])).rows.map((r) => r.id);
  if (!prox.length) return { users: 0 };
  const sess = (await query('SELECT id FROM sessions WHERE proctor_id = ANY($1::uuid[])', [prox])).rows.map((r) => r.id);
  const cands = (await query(
    `SELECT DISTINCT candidate_id AS id FROM (
        SELECT candidate_id FROM session_candidates WHERE session_id = ANY($1::uuid[])
        UNION SELECT candidate_id FROM invites WHERE session_id = ANY($1::uuid[]) AND candidate_id IS NOT NULL
        UNION SELECT id FROM users WHERE proctor_id = ANY($2::uuid[])) t WHERE candidate_id IS NOT NULL`, [sess, prox])).rows.map((r) => r.id);
  const att = (await query('SELECT id FROM attempts WHERE session_id = ANY($1::uuid[])', [sess])).rows.map((r) => r.id);
  const inv = (await query('SELECT id FROM invites WHERE session_id = ANY($1::uuid[])', [sess])).rows.map((r) => r.id);
  const ids = [...prox, ...cands, ...sess, ...att, ...inv].map(String);
  await query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR entity_id = ANY($2::text[])', [[...prox, ...cands], ids]);
  await query('DELETE FROM attempts WHERE session_id = ANY($1::uuid[])', [sess]);         // answers / events / certificates cascade
  await query('DELETE FROM invites WHERE session_id = ANY($1::uuid[])', [sess]);
  await query('DELETE FROM session_candidates WHERE session_id = ANY($1::uuid[])', [sess]);
  await query('DELETE FROM sessions WHERE id = ANY($1::uuid[])', [sess]);
  await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [cands]);
  await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [prox]);
  return { users: prox.length + cands.length, sessions: sess.length, attempts: att.length, invites: inv.length };
}

// ---------------------------------------------------------------- main
const out = { n: N, base: BASE };
let cleaned = null;
try {
  const adminEmail = process.env.ADMIN_EMAIL; const adminPw = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPw) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD missing (backend/.env)');
  const login = await http('setup.login', 'POST', '/auth/login', { body: { email: adminEmail, password: adminPw } });
  if (login.status !== 200) throw new Error(`admin login failed (${login.status}): ${login.data?.error || login.error}`);
  const adminTok = login.data.token;

  // proctor with two subjects
  const pEmail = `lt-${RUN}-proctor@lt.test`;
  const pr = await http('setup.proctor', 'POST', '/admin/users', { token: adminTok, body: { name: `LT Proctor ${RUN}`, email: pEmail, role: 'proctor' } });
  if (pr.status !== 201) throw new Error(`create proctor failed: ${pr.data?.error}`);
  await http('setup.subjects', 'PUT', `/admin/proctors/${pr.data.id}/subjects`, { token: adminTok, body: { subject_ids: ['aiml', 'dsa', 'sql'] } });
  const pl = await http('setup.proctorLogin', 'POST', '/auth/login', { body: { email: pEmail, password: pr.data.generated_password } });
  const procTok = pl.data.token;
  const limits = await http('setup.limits', 'GET', '/proctor/limits', { token: procTok });
  out.max_candidates_per_session = limits.data?.max_candidates_per_session;

  // fixed paper: 2 MCQ + 1 DSA + 1 SQL (all easy), so the same 4 ids for everyone
  const pick = (subject, n) => CATALOG.filter((q) => q.subject_id === subject && q.difficulty === 'easy').slice(0, n);
  const paper = [...pick('aiml', 2), ...pick('dsa', 1), ...pick('sql', 1)];
  const people = Array.from({ length: N }, (_, i) => ({ name: `LT Candidate ${String(i + 1).padStart(3, '0')}`, email: `lt-${RUN}-c${i + 1}@lt.test` }));
  const t0 = performance.now();
  const sess = await http('setup.createSession', 'POST', '/proctor/sessions', {
    token: procTok,
    body: { name: `LT ${RUN} (${N})`, duration_mins: 30, fixed_question_ids: paper.map((q) => q.id), subject_config: [], people, expires_hours: 2 },
  });
  if (sess.status !== 201) throw new Error(`create session failed (${sess.status}): ${sess.data?.error}`);
  out.create_session_with_links_ms = Math.round(performance.now() - t0);
  const sid = sess.data.id; const invites = sess.data.invites;
  if (invites.length !== N) throw new Error(`expected ${N} invites, got ${invites.length}`);

  const rt = async () => (await http('runtime', 'GET', '/admin/runtime', { token: adminTok })).data;
  await http('runtime.reset', 'GET', '/admin/runtime?reset=1', { token: adminTok });
  const before = await rt();
  let peakRss = before?.rss_mb || 0; let peakPoolWait = 0; let peakHeap = before?.heap_mb || 0;
  const sampler = setInterval(async () => {
    const s = await rt(); if (!s) return;
    peakRss = Math.max(peakRss, s.rss_mb); peakHeap = Math.max(peakHeap, s.heap_mb); peakPoolWait = Math.max(peakPoolWait, s.pool?.waiting || 0);
  }, 1000);

  // proctor live-board poller (ETag / If-None-Match)
  let stop = false; let lastEtag = null; let polls = 0; let notModified = 0; let lastLive = null;
  const poller = (async () => {
    while (!stop) {
      const r = await http('live.poll', 'GET', `/proctor/sessions/${sid}/live`, { token: procTok, headers: lastEtag ? { 'If-None-Match': lastEtag } : {} });
      polls++;
      if (r.status === 304) notModified++; else if (r.status === 200) { lastEtag = r.etag; lastLive = r.data; }
      await sleep(POLL_MS);
    }
  })();

  // ---- the candidates
  const expected = new Map(); // email -> expected total
  const wallStart = performance.now();
  async function candidate(i) {
    const inv = invites[i]; const person = people[i];
    await sleep(Math.random() * RAMP_MS);
    const view = await http('invite.get', 'GET', `/invite/${inv.token}`);
    if (view.data?.status !== 'valid') throw new Error(`invite ${i} status ${view.data?.status}`);
    const rd = await http('invite.redeem', 'POST', `/invite/${inv.token}/redeem`, { body: {} });
    if (rd.status !== 200) throw new Error(`redeem ${i} failed: ${rd.status} ${rd.data?.error}`);
    const tok = rd.data.token; const aid = rd.data.attempt.id;
    const at = await http('attempt.get', 'GET', `/candidate/attempts/${aid}`, { token: tok });
    const qids = at.data?.question_ids || [];
    if (qids.length !== paper.length || Object.keys(at.data.bank_keys || {}).length !== paper.length) throw new Error(`attempt ${i}: bad payload`);
    const marks = new Map(paper.map((q) => [q.id, q.marks]));
    let final = [];
    for (let r = 1; r <= ROUNDS; r++) {
      await sleep(300 + Math.random() * 1200);
      final = qids.map((id) => { const total = 8; const passed = Math.floor(Math.random() * (total + 1)); return { question_id: id, response: { code: `// c${i} round ${r}\n${'x'.repeat(200)}` }, tests_passed: passed, tests_total: total, time_spent_sec: r * 20 }; });
      const subset = r === ROUNDS ? final : final.filter(() => Math.random() < 0.5);
      if (subset.length) await http('answers.bulk', 'PUT', `/candidate/attempts/${aid}/answers`, { token: tok, body: { answers: subset } });
      if (r === 1) await http('answers.single', 'PUT', `/candidate/attempts/${aid}/answers/${qids[0]}`, { token: tok, body: final[0] });
      await http('events.batch', 'POST', `/candidate/attempts/${aid}/events/batch`, { token: tok, body: { events: [{ type: 'copy', meta: { r } }, { type: 'copy', meta: { r } }, { type: 'window_blur', meta: {} }] } });
    }
    // expected = what the server will have after the final round (single PUT of q0 in round 1 was overwritten later)
    const exp = final.reduce((s, a) => s + round2(marks.get(a.question_id) * (a.tests_passed / a.tests_total)), 0);
    expected.set(person.email, round2(exp));
    const sub = await http('submit', 'POST', `/candidate/attempts/${aid}/submit`, { token: tok, body: { answers: final } });
    if (sub.status !== 200 || sub.data?.status !== 'submitted') throw new Error(`submit ${i} failed: ${sub.status} ${sub.data?.error}`);
    if (Math.abs(sub.data.total_score - round2(exp)) > 0.011) throw new Error(`candidate ${i}: total ${sub.data.total_score} != expected ${round2(exp)}`);
    const res = await http('result', 'GET', `/candidate/attempts/${aid}/result`, { token: tok });
    if (res.data?.certificate_code == null) throw new Error(`candidate ${i}: no certificate`);
    // a second submit must be idempotent
    const again = await http('submit.again', 'POST', `/candidate/attempts/${aid}/submit`, { token: tok, body: {} });
    if (again.data?.total_score !== sub.data.total_score) throw new Error(`candidate ${i}: non-idempotent submit`);
  }
  const settled = await Promise.allSettled(Array.from({ length: N }, (_, i) => candidate(i)));
  out.wall_s = round2((performance.now() - wallStart) / 1000);
  stop = true; await poller; clearInterval(sampler);
  const failures = settled.map((s, i) => (s.status === 'rejected' ? `#${i + 1}: ${s.reason.message}` : null)).filter(Boolean);
  out.candidate_failures = failures.length; if (failures.length) out.failure_samples = failures.slice(0, 5);

  // ---- verification through the proctor live board
  await sleep(1200); // let the 2 s live cache expire
  const fin = (await http('live.final', 'GET', `/proctor/sessions/${sid}/live`, { token: procTok })).data;
  const sub = fin.rows.filter((r) => r.status === 'submitted').length;
  let mismatches = 0;
  for (const r of fin.rows) { const e = expected.get(r.email); if (e === undefined || Math.abs((r.total_score ?? -1) - e) > 0.011) mismatches++; }
  out.live_counts = fin.counts; out.live_submitted = sub; out.score_mismatches = mismatches;
  out.all_submitted_consistent = failures.length === 0 && sub === N && mismatches === 0 && fin.counts.in_progress === 0;
  out.live_polls = polls; out.live_304 = notModified;

  const after = await rt();
  out.server = {
    cpu_ms_total: after.cpu_user_ms + after.cpu_system_ms - (before.cpu_user_ms + before.cpu_system_ms),
    cpu_ms_per_candidate: round2((after.cpu_user_ms + after.cpu_system_ms - (before.cpu_user_ms + before.cpu_system_ms)) / N),
    rss_mb_before: before.rss_mb, rss_mb_peak: peakRss, heap_mb_peak: peakHeap, rss_mb_after: after.rss_mb,
    event_loop_lag_ms: after.event_loop_lag_ms, pool_peak_waiting: peakPoolWait, requests_total_delta: after.requests_total - before.requests_total,
  };
} catch (e) {
  out.fatal = e.message;
} finally {
  try { cleaned = await cleanup(); } catch (e) { cleaned = { error: e.message }; }
  out.cleanup = cleaned;
}

const rows = [...lat.entries()].filter(([k]) => !k.startsWith('runtime')).map(([label, a]) => ({
  endpoint: label, count: a.length, p50_ms: Math.round(pct(a, 50)), p95_ms: Math.round(pct(a, 95)), p99_ms: Math.round(pct(a, 99)), max_ms: Math.round(Math.max(...a)), errors: errs.get(label) || 0,
}));
out.latency = rows;
const isCand = (k) => /^(invite|attempt|answers|events|submit|result)/.test(k);
const candBytes = [...bytes.entries()].filter(([k]) => isCand(k)).reduce((a, [, v]) => a + v, 0);
const candReqs = [...lat.entries()].filter(([k]) => isCand(k)).reduce((a, [, v]) => a + v.length, 0);
out.traffic = { response_kb_per_candidate_uncompressed: round2(candBytes / N / 1024), requests_per_candidate: round2(candReqs / N), upload_kb_per_candidate: round2(bytesOut / N / 1024) };
console.log(JSON.stringify(out, null, 2));
await getPool().end();
process.exit(out.fatal || out.candidate_failures ? 1 : 0);
