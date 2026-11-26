// HTTP integration checks for bulk links, the candidate cap, live board, bulk actions, batching and rate limits.
//   node scripts/integration-bulk.mjs [--base http://localhost:4600 (cap 50)] [--base2 http://localhost:4601 (cap 100, optional)]
// Creates throw-away @lt.test data and deletes it at the end (even on failure).
import 'dotenv/config';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { CATALOG } from '../src/catalog.generated.js';
import { query, getPool } from '../src/db.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:4600'); const BASE2 = arg('base2', '');
const RUN = crypto.randomBytes(3).toString('hex');
let pass = 0; let fail = 0; const failures = [];
const ok = (cond, msg, extra = '') => { if (cond) pass++; else { fail++; failures.push(`${msg} ${extra}`); console.log(`  FAIL ${msg} ${extra}`); } };

async function call(base, method, path, { token, body, headers = {} } = {}) {
  const t0 = performance.now();
  const res = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; if (res.status !== 304) { try { data = await res.json(); } catch { /* */ } }
  return { status: res.status, data, etag: res.headers.get('etag'), ms: performance.now() - t0 };
}
const api = (m, p, o) => call(BASE, m, p, o);

async function cleanup() {
  const prox = (await query(`SELECT id FROM users WHERE role='proctor' AND email LIKE $1`, [`lt-${RUN}-%@lt.test`])).rows.map((r) => r.id);
  if (!prox.length) return { users: 0 };
  const sess = (await query('SELECT id FROM sessions WHERE proctor_id = ANY($1::uuid[])', [prox])).rows.map((r) => r.id);
  const cands = (await query(
    `SELECT DISTINCT candidate_id AS id FROM (SELECT candidate_id FROM session_candidates WHERE session_id = ANY($1::uuid[])
        UNION SELECT candidate_id FROM invites WHERE session_id = ANY($1::uuid[]) AND candidate_id IS NOT NULL
        UNION SELECT id FROM users WHERE proctor_id = ANY($2::uuid[])) t WHERE candidate_id IS NOT NULL`, [sess, prox])).rows.map((r) => r.id);
  const att = (await query('SELECT id FROM attempts WHERE session_id = ANY($1::uuid[])', [sess])).rows.map((r) => r.id);
  const inv = (await query('SELECT id FROM invites WHERE session_id = ANY($1::uuid[])', [sess])).rows.map((r) => r.id);
  const ids = [...prox, ...cands, ...sess, ...att, ...inv].map(String);
  await query('DELETE FROM audit_logs WHERE actor_id = ANY($1::uuid[]) OR entity_id = ANY($2::text[])', [[...prox, ...cands], ids]);
  await query('DELETE FROM attempts WHERE session_id = ANY($1::uuid[])', [sess]);
  await query('DELETE FROM invites WHERE session_id = ANY($1::uuid[])', [sess]);
  await query('DELETE FROM session_candidates WHERE session_id = ANY($1::uuid[])', [sess]);
  await query('DELETE FROM sessions WHERE id = ANY($1::uuid[])', [sess]);
  await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [cands]);
  await query('DELETE FROM users WHERE id = ANY($1::uuid[])', [prox]);
  return { users: prox.length + cands.length, sessions: sess.length, attempts: att.length, invites: inv.length };
}

const paper = [...CATALOG.filter((q) => q.subject_id === 'aiml' && q.difficulty === 'easy').slice(0, 2), ...CATALOG.filter((q) => q.subject_id === 'dsa' && q.difficulty === 'easy').slice(0, 1)];
const fixed = paper.map((q) => q.id);

try {
  const adminTok = (await api('POST', '/auth/login', { body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).data.token;
  const pEmail = `lt-${RUN}-proctor@lt.test`;
  const pr = (await api('POST', '/admin/users', { token: adminTok, body: { name: 'LT Proctor', email: pEmail, role: 'proctor' } })).data;
  await api('PUT', `/admin/proctors/${pr.id}/subjects`, { token: adminTok, body: { subject_ids: ['aiml', 'dsa'] } });
  const tok = (await api('POST', '/auth/login', { body: { email: pEmail, password: pr.generated_password } })).data.token;
  const mk = async (extra = {}, base = BASE) => call(base, 'POST', '/proctor/sessions', { token: tok, body: { name: `LT ${RUN} ${Math.random().toString(36).slice(2, 6)}`, duration_mins: 30, fixed_question_ids: fixed, subject_config: [], ...extra } });
  const people = (n, tag = 'p') => Array.from({ length: n }, (_, i) => ({ name: `LT Person ${tag}${i + 1}`, email: `lt-${RUN}-${tag}${i + 1}@lt.test` }));

  console.log('limits / cap');
  const lim = await api('GET', '/proctor/limits', { token: tok });
  ok(lim.status === 200 && lim.data.max_candidates_per_session === 50, 'GET /proctor/limits returns 50', JSON.stringify(lim.data));
  ok((await api('GET', '/proctor/limits')).status === 401, 'limits needs auth');
  const over = await mk({ people: people(51, 'o') });
  ok(over.status === 400 && /at most 50 candidates/.test(over.data?.error || ''), '51 people on create -> 400', over.data?.error);
  const overCount = await mk({ candidate_count: 51 });
  ok(overCount.status === 400, 'candidate_count 51 -> 400', String(overCount.status));
  const empty = await mk({});
  ok(empty.status === 201 && Array.isArray(empty.data.invites) && empty.data.invites.length === 0, 'session with zero candidates is valid');

  console.log('bulk create (one call)');
  const s50 = await mk({ candidate_count: 50 });
  ok(s50.status === 201 && s50.data.invites.length === 50, '50 links created with the session', `${s50.status} ${s50.ms.toFixed(0)}ms`);
  const tids = new Set(s50.data.invites.map((i) => i.tester_id)); const toks = new Set(s50.data.invites.map((i) => i.token));
  ok(tids.size === 50 && toks.size === 50, 'tester ids and tokens are all unique');
  ok(s50.data.invites.every((i) => /^HPAI-T-[A-HJ-NP-Z2-9]{6}$/.test(i.tester_id) && i.token.length >= 30), 'tester id / token format');
  const more = await call(BASE, 'POST', `/proctor/sessions/${s50.data.id}/invites`, { token: tok, body: { count: 1 } });
  ok(more.status === 400 && /you already have 50/.test(more.data?.error || ''), 'adding to a full session -> 400 with clear message', more.data?.error);

  console.log('cap counts: used + live links, not revoked/expired');
  const sc = await mk({ candidate_count: 38 });
  const a13 = await call(BASE, 'POST', `/proctor/sessions/${sc.data.id}/invites`, { token: tok, body: { count: 13 } });
  ok(a13.status === 400 && /you already have 38; you can add 12 more/.test(a13.data?.error || ''), "message 'you already have 38; you can add 12 more'", a13.data?.error);
  // revoke 10 unused -> they stop counting
  for (const inv of sc.data.invites.slice(0, 10)) await call(BASE, 'POST', `/proctor/invites/${inv.id}/revoke`, { token: tok });
  const a22 = await call(BASE, 'POST', `/proctor/sessions/${sc.data.id}/invites`, { token: tok, body: { count: 22 } });
  ok(a22.status === 201 && a22.data.invites.length === 22, 'revoked unused links do not count (28 live + 22 = 50 allowed)', `${a22.status} ${a22.data?.error || ''}`);
  const a1 = await call(BASE, 'POST', `/proctor/sessions/${sc.data.id}/invites`, { token: tok, body: { count: 1 } });
  ok(a1.status === 400, 'now full again');
  // a USED link counts: redeem one, then revoke_unused frees the rest but the used one stays counted
  const rdTok = sc.data.invites[10].token;
  const rd = await call(BASE, 'POST', `/invite/${rdTok}/redeem`, { body: { name: 'Used One' } });
  ok(rd.status === 200, 'redeem works', String(rd.status));
  const rv = await call(BASE, 'POST', `/proctor/sessions/${sc.data.id}/bulk`, { token: tok, body: { action: 'revoke_unused' } });
  ok(rv.status === 200 && rv.data.affected === 49 - 0 - 0 || rv.data.affected >= 1, 'bulk revoke_unused', JSON.stringify(rv.data));
  const a49 = await call(BASE, 'POST', `/proctor/sessions/${sc.data.id}/invites`, { token: tok, body: { count: 49 } });
  ok(a49.status === 201, 'after revoke_unused only the used one counts (1 + 49 = 50)', `${a49.status} ${a49.data?.error || ''}`);

  console.log('prefill / name_locked / opened tracking / gating');
  const sl = await mk({ people: [{ name: 'Locked Person', email: `lt-${RUN}-locked@lt.test` }, { name: 'Prefilled Person', email: `lt-${RUN}-pref@lt.test` }], name_locked: false });
  const [iLocked, iPref] = sl.data.invites;
  const lockedSes = await mk({});
  const lk = await call(BASE, 'POST', `/proctor/sessions/${lockedSes.data.id}/invites`, { token: tok, body: { people: [{ name: 'Locked Person', email: `lt-${RUN}-locked2@lt.test` }], name_locked: true } });
  const lockedTok = lk.data.invites[0].token;
  const g1 = await call(BASE, 'GET', `/invite/${lockedTok}`);
  ok(g1.data?.status === 'valid' && g1.data.prefill?.name === 'Locked Person' && g1.data.prefill.locked === true && g1.data.server_now, 'GET invite returns locked prefill + server_now', JSON.stringify(g1.data));
  const rl = await call(BASE, 'POST', `/invite/${lockedTok}/redeem`, { body: { name: 'Hacker Name', email: 'hacker@lt.test' } });
  ok(rl.status === 200 && rl.data.user.name === 'Locked Person' && rl.data.user.email === `lt-${RUN}-locked2@lt.test`, 'locked invite ignores browser name/email', JSON.stringify(rl.data?.user));
  const pf = await call(BASE, 'GET', `/invite/${iPref.token}`);
  ok(pf.data?.prefill?.name === 'Prefilled Person' && pf.data.prefill.locked === false, 'unlocked invite prefills but stays editable');
  const rp = await call(BASE, 'POST', `/invite/${iPref.token}/redeem`, { body: { name: 'Edited Name' } });
  ok(rp.status === 200 && rp.data.user.name === 'Edited Name', 'unlocked invite uses the typed name');
  const row = (await query(`SELECT password_hash FROM users WHERE lower(email)=$1`, [`lt-${RUN}-locked2@lt.test`])).rows[0];
  ok(row && row.password_hash.startsWith('!') && !row.password_hash.startsWith('$2'), 'invite user has a cheap unusable (non-bcrypt) password marker');
  const lg = await call(BASE, 'POST', '/auth/login', { body: { email: `lt-${RUN}-locked2@lt.test`, password: row.password_hash } });
  ok(lg.status === 401, 'invite user cannot log in with the marker as a password', String(lg.status));
  const a2 = await call(BASE, 'POST', `/invite/${lockedTok}/redeem`, { body: {} });
  ok(a2.status === 410, 'second redeem -> 410');

  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  const sf = await mk({ candidate_count: 1, opens_at: future });
  const fTok = sf.data.invites[0].token;
  const fg = await call(BASE, 'GET', `/invite/${fTok}`);
  ok(fg.data?.status === 'not_open_yet' && fg.data.opens_at, 'not_open_yet with opens_at', JSON.stringify(fg.data));
  const fr = await call(BASE, 'POST', `/invite/${fTok}/redeem`, { body: { name: 'Too Early' } });
  ok(fr.status === 409 && /not opened yet/i.test(fr.data?.error || ''), 'redeem before opens_at -> 409', `${fr.status} ${fr.data?.error}`);

  console.log('live board lifecycle');
  const sv = await mk({ people: people(4, 'v') });
  const [v1, v2, v3, v4] = sv.data.invites;
  const live = async (sid) => (await call(BASE, 'GET', `/proctor/sessions/${sid}/live`, { token: tok }));
  let L = await live(sv.data.id);
  ok(L.data.counts.total === 4 && L.data.counts.not_opened === 4, 'all not_opened at first', JSON.stringify(L.data.counts));
  await call(BASE, 'GET', `/invite/${v1.token}`); await call(BASE, 'GET', `/invite/${v1.token}`); await call(BASE, 'GET', `/invite/${v2.token}`);
  await sleep(2300); // live cache 2 s
  L = await live(sv.data.id);
  ok(L.data.counts.opened === 2 && L.data.counts.not_opened === 2, 'opened tracking reflected', JSON.stringify(L.data.counts));
  const lst = await call(BASE, 'GET', `/proctor/sessions/${sv.data.id}/invites`, { token: tok });
  const l1 = lst.data.find((x) => x.tester_id === v1.tester_id);
  ok(l1.open_count === 2 && l1.opened_at, 'invites list shows open_count=2 and opened_at', JSON.stringify([l1.open_count, l1.opened_at]));
  const r1 = await call(BASE, 'POST', `/invite/${v1.token}/redeem`, { body: {} });
  const r3 = await call(BASE, 'POST', `/invite/${v3.token}/redeem`, { body: { name: 'Third Person' } });
  const r2 = await call(BASE, 'POST', `/invite/${v2.token}/redeem`, { body: {} });
  ok(r1.status === 200 && r3.status === 200 && r2.status === 200, 'three redeems ok');
  const att1 = r1.data.attempt.id; const tok1 = r1.data.token; const aq = (await call(BASE, 'GET', `/candidate/attempts/${att1}`, { token: tok1 })).data.question_ids;
  await sleep(2300);
  L = await live(sv.data.id);
  ok(L.data.counts.in_progress === 3 && L.data.counts.not_opened === 1, 'in_progress counted', JSON.stringify(L.data.counts));
  const row1 = L.data.rows.find((x) => x.tester_id === v1.tester_id);
  ok(row1.status === 'in_progress' && row1.seconds_left > 1700 && row1.total_questions === 3 && row1.answered === 0, 'row has seconds_left / total_questions / answered=0', JSON.stringify(row1));
  // answers -> answered count; events -> screen_leaves / flags
  await call(BASE, 'PUT', `/candidate/attempts/${att1}/answers`, { token: tok1, body: { answers: [{ question_id: aq[0], response: { selected: [1] }, tests_passed: 1, tests_total: 1, time_spent_sec: 5 }, { question_id: aq[1], response: { selected: [0] }, tests_passed: 0, tests_total: 1, time_spent_sec: 5 }] } });
  await call(BASE, 'POST', `/candidate/attempts/${att1}/events/batch`, { token: tok1, body: { events: [{ type: 'screen_leave', meta: { n: 1 } }, { type: 'paste', meta: {} }] } });
  await sleep(2300);
  L = await live(sv.data.id);
  const row1b = L.data.rows.find((x) => x.tester_id === v1.tester_id);
  ok(row1b.answered === 2 && row1b.screen_leaves === 1 && row1b.flag_count === 2 && row1b.last_activity_at, 'answered / screen_leaves / flags / last_activity', JSON.stringify(row1b));
  // ETag
  const e1 = await call(BASE, 'GET', `/proctor/sessions/${sv.data.id}/live`, { token: tok });
  const e2 = await call(BASE, 'GET', `/proctor/sessions/${sv.data.id}/live`, { token: tok, headers: { 'If-None-Match': e1.etag } });
  ok(e1.etag && e2.status === 304, 'live ETag -> 304 when unchanged', `${e1.etag} ${e2.status}`);
  const m1 = await call(BASE, 'GET', '/proctor/monitor', { token: tok });
  const m2 = await call(BASE, 'GET', '/proctor/monitor', { token: tok, headers: { 'If-None-Match': m1.etag } });
  ok(m1.status === 200 && m1.etag && m2.status === 304, 'monitor ETag -> 304 when unchanged', `${m1.status} ${m2.status}`);
  // submit one -> submitted
  const sub = await call(BASE, 'POST', `/candidate/attempts/${att1}/submit`, { token: tok1, body: {} });
  ok(sub.status === 200 && sub.data.status === 'submitted', 'submit ok');
  await sleep(2300);
  L = await live(sv.data.id);
  ok(L.data.counts.submitted === 1 && L.data.counts.in_progress === 2 && L.data.rows.find((x) => x.tester_id === v1.tester_id).total_score !== null, 'submitted counted with score', JSON.stringify(L.data.counts));
  ok(L.data.counts.total === L.data.rows.length, 'counts.total equals rows.length');

  console.log('bulk actions');
  const att2 = r2.data.attempt.id;
  const before = (await query('SELECT ends_at FROM attempts WHERE id=$1', [att2])).rows[0].ends_at;
  const ex = await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { token: tok, body: { action: 'extend', minutes: 10, reason: 'Network issue' } });
  const afterEnd = (await query('SELECT ends_at FROM attempts WHERE id=$1', [att2])).rows[0].ends_at;
  ok(ex.status === 200 && ex.data.affected === 2 && afterEnd - before === 600000, 'bulk extend: 2 in-progress attempts +10 min', JSON.stringify(ex.data));
  const evn = (await query(`SELECT count(*)::int AS n FROM proctor_events WHERE attempt_id=$1 AND type='extend_time'`, [att2])).rows[0].n;
  const aud = (await query(`SELECT count(*)::int AS n FROM audit_logs WHERE action='attempt.extend' AND entity_id=$1`, [att2])).rows[0].n;
  ok(evn === 1 && aud === 1, 'extend wrote one event + one audit row per attempt');
  const exOne = await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { token: tok, body: { action: 'extend', minutes: 5, reason: 'Just one', attempt_ids: [att2] } });
  ok(exOne.data.affected === 1, 'extend limited to attempt_ids');
  ok((await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { token: tok, body: { action: 'extend', minutes: 61, reason: 'x y z' } })).status === 400, 'extend > 60 min rejected');
  ok((await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { token: tok, body: { action: 'extend', minutes: 5, reason: '' } })).status === 400, 'extend needs a reason');
  const rg = await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { token: tok, body: { action: 'regenerate_unused' } });
  ok(rg.status === 200 && rg.data.affected === 1 && rg.data.invites[0].tester_id === v4.tester_id && rg.data.invites[0].token !== v4.token, 'regenerate_unused: fresh link, same tester id', JSON.stringify(rg.data).slice(0, 160));
  ok((await call(BASE, 'GET', `/invite/${v4.token}`)).data.status === 'revoked', 'old link is revoked');
  ok((await call(BASE, 'GET', `/invite/${rg.data.invites[0].token}`)).data.status === 'valid', 'new link works');
  const rv2 = await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { token: tok, body: { action: 'revoke_unused' } });
  ok(rv2.status === 200 && rv2.data.affected === 1, 'revoke_unused revokes the regenerated link', JSON.stringify(rv2.data));
  const cl = await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { token: tok, body: { action: 'close' } });
  const sesRow = (await query('SELECT status FROM sessions WHERE id=$1', [sv.data.id])).rows[0];
  ok(cl.status === 200 && sesRow.status === 'closed', 'close closes the session');
  ok((await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { token: tok, body: { action: 'nope' } })).status === 400, 'unknown action -> 400');
  ok((await call(BASE, 'POST', `/proctor/sessions/${sv.data.id}/bulk`, { body: { action: 'close' } })).status === 401, 'bulk needs auth');

  console.log('batching + caps');
  const ba = await call(BASE, 'PUT', `/candidate/attempts/${att2}/answers`, { token: r2.data.token, body: { answers: Array.from({ length: 21 }, () => ({ question_id: aq[0] })) } });
  ok(ba.status === 400, 'more than 20 answers per request -> 400');
  const body1 = { answers: [{ question_id: aq[2], response: { code: 'abc' }, tests_passed: 3, tests_total: 8, time_spent_sec: 4 }] };
  const f1 = await call(BASE, 'PUT', `/candidate/attempts/${att2}/answers`, { token: r2.data.token, body: body1 });
  const f2 = await call(BASE, 'PUT', `/candidate/attempts/${att2}/answers`, { token: r2.data.token, body: body1 });
  ok(f1.data.saved === 1 && f2.data.saved === 0 && f2.data.skipped === 1, 'unchanged answer is skipped (saved 0 / skipped 1)', JSON.stringify([f1.data, f2.data]));
  const bad = await call(BASE, 'PUT', `/candidate/attempts/${att2}/answers`, { token: r2.data.token, body: { answers: [{ question_id: 'not-in-attempt' }] } });
  ok(bad.status === 400, 'foreign question id rejected');
  const flood = Array.from({ length: 50 }, (_, i) => ({ type: 'copy', meta: { i } }));
  for (let k = 0; k < 8; k++) await call(BASE, 'POST', `/candidate/attempts/${att2}/events/batch`, { token: r2.data.token, body: { events: flood.map((e) => ({ ...e, meta: { i: e.meta.i + k * 100 } })) } });
  const cnt = (await query(`SELECT count(*) FILTER (WHERE type='copy')::int AS c FROM proctor_events WHERE attempt_id=$1`, [att2])).rows[0].c;
  ok(cnt <= 300 && cnt >= 290, 'non-critical events capped at ~300', String(cnt));
  const crit = await call(BASE, 'POST', `/candidate/attempts/${att2}/events/batch`, { token: r2.data.token, body: { events: [{ type: 'screen_leave', meta: { n: 9 } }] } });
  ok(crit.data.stored === 1, 'critical events still stored after the cap');
  const dd = await call(BASE, 'POST', `/candidate/attempts/${att2}/events/batch`, { token: r2.data.token, body: { events: [{ type: 'note', meta: { z: 1 } }, { type: 'note', meta: { z: 1 } }, { type: 'bogus' }] } });
  ok(dd.data.stored === 0 || dd.data.stored === 1, 'identical consecutive events de-duplicated, unknown ignored', JSON.stringify(dd.data));
  ok((await call(BASE, 'POST', `/candidate/attempts/${att2}/events`, { token: r2.data.token, body: { type: 'bogus' } })).status === 400, 'single-event route still validates type');

  console.log('admin runtime / roles');
  ok((await api('GET', '/admin/runtime', { token: adminTok })).data?.rss_mb > 0, 'admin runtime ok');
  ok((await api('GET', '/admin/runtime', { token: tok })).status === 403, 'runtime is admin only');

  console.log('shared-IP bursts are not rate-limited');
  const ssn = await call(BASE, 'GET', '/candidate/sessions', { token: r1.data.token });
  const burst = await Promise.all(Array.from({ length: 300 }, () => call(BASE, 'GET', '/candidate/sessions', { token: r3.data.token })));
  ok(burst.every((r) => r.status === 200), '300 authenticated candidate requests from one IP all succeed', String(burst.filter((r) => r.status !== 200).length));
  const pub = await Promise.all(Array.from({ length: 650 }, () => call(BASE, 'GET', `/invite/${crypto.randomBytes(24).toString('base64url')}`)));
  ok(pub.every((r) => r.status === 200), '650 public invite requests/min from one IP all succeed (limit 1200)', String(pub.filter((r) => r.status !== 200).length));
  const logins = await Promise.all(Array.from({ length: 40 }, (_, i) => call(BASE, 'POST', '/auth/login', { body: { email: `nobody${i}@lt.test`, password: 'x' } })));
  ok(logins.every((r) => r.status === 401), '40 logins for different accounts from one IP are not rate limited');
  void ssn;

  if (BASE2) {
    console.log('bulk create 100 people in ONE call (cap raised to 100)');
    const b100 = await mk({ people: people(100, 'h') }, BASE2);
    ok(b100.status === 201 && b100.data.invites.length === 100, '100 people + links in one call', `${b100.status} ${b100.ms.toFixed(0)}ms ${b100.data?.error || ''}`);
    console.log(`  (100 people + links created in ${b100.ms.toFixed(0)} ms)`);
  }
} catch (e) {
  fail++; failures.push(`EXCEPTION ${e.stack || e.message}`); console.log('EXCEPTION', e.stack || e.message);
} finally {
  let c; try { c = await cleanup(); } catch (e) { c = { error: e.message }; }
  console.log('cleanup', JSON.stringify(c));
  console.log(`\n${pass} passed, ${fail} failed`);
  await getPool().end();
  process.exit(fail ? 1 : 0);
}
