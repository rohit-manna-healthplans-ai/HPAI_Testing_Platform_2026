import 'dotenv/config';
import crypto from 'node:crypto';
import { HttpError, EMAIL_RE } from './util.js';

// ONE constant for "how many candidates a session may have". Raise it with the env var once capacity tests justify it.
export const maxCandidates = () => {
  const n = parseInt(process.env.MAX_CANDIDATES_PER_SESSION || '50', 10);
  return Number.isFinite(n) && n >= 1 ? n : 50;
};

const TESTER_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const makeTesterId = () => {
  let s = '';
  for (let i = 0; i < 6; i++) s += TESTER_CHARS[crypto.randomInt(TESTER_CHARS.length)];
  return `HPAI-T-${s}`;
};
export const makeToken = () => crypto.randomBytes(24).toString('base64url');
export const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

export const expiryFrom = (hours) => {
  let h = parseInt(hours ?? 24, 10);
  if (!Number.isFinite(h)) h = 24;
  if (h < 1 || h > 168) throw new HttpError(400, 'expires_hours must be between 1 and 168');
  return new Date(Date.now() + h * 3600 * 1000);
};

/**
 * Normalise "who gets a link" from a request body. Returns an array of {name,email} or null when nothing was requested.
 * Priority: people[] > names[] > a count (countKey). Enforces the per-session candidate cap on the request itself.
 */
export function parsePeople(b, { countKey = 'count', defaultCount = null } = {}) {
  const cap = maxCandidates();
  let people = null;
  const clean = (p, i) => {
    const name = String(p?.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || null;
    const email = String(p?.email ?? '').trim().toLowerCase() || null;
    if (name && name.length < 2) throw new HttpError(400, `Name #${i + 1} must be at least 2 characters`);
    if (email && !EMAIL_RE.test(email)) throw new HttpError(400, `Invalid email for ${name || `person #${i + 1}`}: ${email}`);
    return { name, email };
  };
  if (Array.isArray(b?.people) && b.people.length) {
    people = b.people.map(clean);
  } else if (Array.isArray(b?.names) && b.names.length) {
    people = b.names.map((n, i) => clean({ name: n }, i));
  } else {
    const raw = b?.[countKey] ?? defaultCount;
    if (raw !== undefined && raw !== null && raw !== '') {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${countKey} must be a number between 1 and ${cap}`);
      if (n > 0) people = Array.from({ length: n }, () => ({ name: null, email: null }));
    }
  }
  if (people && people.length > cap) throw new HttpError(400, `A session can have at most ${cap} candidates (you asked for ${people.length})`);
  if (people && b?.name_locked && people.some((p) => !p.name)) throw new HttpError(400, 'name_locked needs a name for every person');
  return people;
}

/**
 * Candidates already counted against a session: used links, links still alive (unused, not revoked, not expired) and
 * candidates assigned directly (without a link). Revoked / expired unused links do not count.
 */
export async function candidateCount(client, sessionId) {
  const { rows } = await client.query(
    `SELECT
       (SELECT count(*) FROM invites i WHERE i.session_id=$1 AND i.replaced_by IS NULL
          AND (i.used_at IS NOT NULL OR i.attempt_id IS NOT NULL OR (i.revoked_at IS NULL AND i.expires_at > now())))::int AS inv,
       (SELECT count(*) FROM session_candidates sc WHERE sc.session_id=$1
          AND NOT EXISTS (SELECT 1 FROM invites i WHERE i.session_id=sc.session_id AND i.candidate_id=sc.candidate_id))::int AS direct`, [sessionId]);
  return rows[0].inv + rows[0].direct;
}

/** Throws 400 when adding `adding` candidates would exceed the per-session cap. */
export async function assertCapacity(client, sessionId, adding) {
  const cap = maxCandidates();
  const have = await candidateCount(client, sessionId);
  if (have + adding > cap) {
    const left = Math.max(0, cap - have);
    throw new HttpError(400, `A session can have at most ${cap} candidates (you already have ${have}; ${left ? `you can add ${left} more` : 'you cannot add more'})`);
  }
  return have;
}

/**
 * Create many invites with ONE multi-row insert. Tester ids are generated in memory (unique within the batch); any id that
 * collides with an existing live invite is regenerated and only those rows are retried.
 * people: [{name,email}] -> [{id,tester_id,label,name,email,token,expires_at}] in the same order.
 */
export async function createInvitesBulk(client, { sessionId, proctorId, people, expiresAt, nameLocked = false }) {
  const out = new Array(people.length);
  let pending = people.map((p, i) => ({ i, p }));
  for (let round = 0; round < 6 && pending.length; round++) {
    const used = new Set();
    const rows = pending.map(({ i, p }) => {
      let tid; do { tid = makeTesterId(); } while (used.has(tid));
      used.add(tid);
      const token = makeToken();
      return { i, p, id: crypto.randomUUID(), token, tid, hash: hashToken(token) };
    });
    const { rows: ins } = await client.query(
      `INSERT INTO invites (id, token_hash, tester_id, session_id, proctor_id, label, email, name_locked, expires_at)
       SELECT u.id, u.hash, u.tid, $6::uuid, $7::uuid, u.label, u.email, $8::boolean, $9::timestamptz
         FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[]) AS u(id, hash, tid, label, email)
       ON CONFLICT DO NOTHING
       RETURNING id, expires_at`,
      [rows.map((r) => r.id), rows.map((r) => r.hash), rows.map((r) => r.tid), rows.map((r) => r.p.name), rows.map((r) => r.p.email),
        sessionId, proctorId, !!nameLocked, expiresAt]);
    const done = new Map(ins.map((x) => [x.id, x]));
    const next = [];
    for (const r of rows) {
      const hit = done.get(r.id);
      if (hit) {
        out[r.i] = { id: r.id, tester_id: r.tid, label: r.p.name, name: r.p.name, email: r.p.email, token: r.token, expires_at: hit.expires_at };
      } else next.push({ i: r.i, p: r.p });
    }
    pending = next;
  }
  if (pending.length) throw new HttpError(500, 'Could not generate unique tester ids. Please retry.');
  return out;
}
