// Pure helpers for the New-session wizard (no React, no DOM) so they can be unit-tested in node.
// Questions here are PUBLIC bank entries (no answers): { id, subject_id, difficulty, marks, time_mins, ... }.

export const LEVELS = ['easy', 'medium', 'hard'];
export const MAX_QUESTIONS = 40;
export const FALLBACK_MINS = { easy: 3, medium: 6, hard: 9 };
export const FALLBACK_MARKS = { easy: 10, medium: 20, hard: 30 };

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const pickRandom = (arr, n, rnd = Math.random) => shuffle(arr, rnd).slice(0, Math.max(0, n));

/** Sort comparator: subject order (as listed for the proctor), then easy -> hard, then original index. */
export const makeComparator = (subjectOrder) => (a, b) =>
  (subjectOrder.indexOf(a.subject_id) - subjectOrder.indexOf(b.subject_id)) || (LEVELS.indexOf(a.difficulty) - LEVELS.indexOf(b.difficulty));

/** Map "subject|level" -> questions[] for the allowed bank list. */
export function bucketize(bankList) {
  const m = new Map();
  for (const q of bankList) { const k = `${q.subject_id}|${q.difficulty}`; if (!m.has(k)) m.set(k, []); m.get(k).push(q); }
  return m;
}
export const availability = (buckets, sid, lvl) => (buckets.get(`${sid}|${lvl}`) || []).length;

/** counts: { [subject_id]: {easy,medium,hard} }. Returns ordered question ids (subject, then easy -> hard), no duplicates. */
export function generatePaper(counts, bankList, subjectOrder, rnd = Math.random) {
  const buckets = bucketize(bankList);
  const out = [];
  for (const sid of subjectOrder) {
    for (const lvl of LEVELS) {
      const n = counts?.[sid]?.[lvl] || 0;
      if (n > 0) out.push(...pickRandom(buckets.get(`${sid}|${lvl}`) || [], n, rnd).map((q) => q.id));
    }
  }
  return out;
}

/** Swap `id` for another unused question of the SAME subject + level. Returns the new paper (or null when none is available). */
export function swapSame(paper, id, byId, bankList, rnd = Math.random) {
  const q = byId.get(id); if (!q) return null;
  const used = new Set(paper);
  const pool = bankList.filter((x) => x.subject_id === q.subject_id && x.difficulty === q.difficulty && !used.has(x.id));
  if (!pool.length) return null;
  const pick = pool[Math.floor(rnd() * pool.length)];
  return paper.map((x) => (x === id ? pick.id : x));
}

/** Shuffle every question that is NOT kept (locked); kept ones never change; no duplicates. Returns { paper, changed, stuck }. */
export function shuffleUnlocked(paper, locked, byId, bankList, rnd = Math.random) {
  let cur = [...paper]; let changed = 0; let stuck = 0;
  for (const id of paper) {
    if (locked.has(id)) continue;
    const next = swapSame(cur, id, byId, bankList, rnd);
    if (next) { cur = next; changed++; } else stuck++;
  }
  return { paper: cur, changed, stuck };
}

export function sortPaper(paper, byId, subjectOrder) {
  const cmp = makeComparator(subjectOrder);
  return paper.map((id, i) => ({ id, i, q: byId.get(id) })).filter((x) => x.q)
    .sort((a, b) => cmp(a.q, b.q) || a.i - b.i).map((x) => x.id);
}

export function paperTotals(paper, byId) {
  let questions = 0, marks = 0, mins = 0;
  for (const id of paper) { const q = byId.get(id); if (q) { questions++; marks += q.marks; mins += q.time_mins; } }
  return { questions, marks, mins };
}

/** Suggested duration: ceil(sum x 1.2 / 5) x 5, never below 10 minutes. */
export const suggestDuration = (sumMins) => Math.max(10, Math.ceil((sumMins * 1.2) / 5) * 5);

/** For the random-per-candidate path: estimate minutes/marks from counts using the bank's average per subject+level bucket. */
export function estimateFromCounts(counts, bankList, subjectOrder) {
  const buckets = bucketize(bankList);
  let questions = 0, marks = 0, mins = 0;
  for (const sid of subjectOrder) {
    for (const lvl of LEVELS) {
      const n = counts?.[sid]?.[lvl] || 0; if (!n) continue;
      const b = buckets.get(`${sid}|${lvl}`) || [];
      const avgM = b.length ? b.reduce((a, q) => a + q.time_mins, 0) / b.length : FALLBACK_MINS[lvl];
      const avgMarks = b.length ? b.reduce((a, q) => a + q.marks, 0) / b.length : FALLBACK_MARKS[lvl];
      questions += n; mins += n * avgM; marks += n * avgMarks;
    }
  }
  return { questions, marks: Math.round(marks), mins: Math.round(mins) };
}

export const toSubjectConfig = (counts, subjectOrder) =>
  subjectOrder.map((subject_id) => ({ subject_id, easy: counts?.[subject_id]?.easy || 0, medium: counts?.[subject_id]?.medium || 0, hard: counts?.[subject_id]?.hard || 0 }))
    .filter((s) => s.easy + s.medium + s.hard > 0);

export const countsSignature = (counts, subjectOrder) => JSON.stringify(toSubjectConfig(counts, subjectOrder));
