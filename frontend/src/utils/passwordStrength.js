// Client-side hint only (the server enforces the real rules): 0 = empty, 1 = weak ... 4 = strong.
const LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export function strengthOf(pw) {
  const p = String(pw || '');
  if (!p) return { score: 0, label: '' };
  let score = 0;
  if (p.length >= 8) score += 1;
  if (p.length >= 12) score += 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score += 1;
  if (p.length < 8) score = Math.min(score, 1);
  const s = Math.max(1, Math.min(4, score));
  return { score: s, label: LABELS[s] };
}

/** Same minimum the server applies (it additionally rejects the email address and very common passwords). */
export function clientPasswordProblem(pw) {
  const p = String(pw || '');
  if (p.length < 8) return 'Use at least 8 characters.';
  if (p.length > 128) return 'Use at most 128 characters.';
  return '';
}
