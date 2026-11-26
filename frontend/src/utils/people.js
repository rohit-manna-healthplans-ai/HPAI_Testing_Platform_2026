// Parsing / validation for the "add names & emails" box (lines `name,email` or just `name`), plus clipboard + link helpers.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * text: pasted lines or a CSV file. A header row such as "name,email" is skipped automatically.
 * Returns { rows:[{name,email?}], errors:[{line,text,reason}], duplicates:number }.
 * Duplicate emails (case-insensitive) are dropped, duplicate names without an email are kept (two people can share a name).
 */
export function parsePeople(text) {
  const rows = [];
  const errors = [];
  const seen = new Set();
  let duplicates = 0;
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split(/[,\t;]/).map((p) => p.trim().replace(/^"|"$/g, ''));
    if (i === 0 && /^name$/i.test(parts[0]) && (!parts[1] || /^e-?mail$/i.test(parts[1]))) return; // header
    const name = parts[0];
    const email = parts[1] || '';
    if (!name || name.length < 2) { errors.push({ line: i + 1, text: line, reason: 'Name is too short' }); return; }
    if (name.length > 80) { errors.push({ line: i + 1, text: line.slice(0, 40), reason: 'Name is too long' }); return; }
    if (email && !EMAIL_RE.test(email)) { errors.push({ line: i + 1, text: line, reason: 'Invalid email' }); return; }
    if (email) {
      const k = email.toLowerCase();
      if (seen.has(k)) { duplicates += 1; return; }
      seen.add(k);
    }
    rows.push(email ? { name, email } : { name });
  });
  return { rows, errors, duplicates };
}

/** Same wording as the API so the proctor sees one consistent message. */
export function capMessage(cap, already, wantNew) {
  if (already + wantNew <= cap) return '';
  const left = Math.max(0, cap - already);
  return `A session can have at most ${cap} candidates (you already have ${already}; you can add ${left} more).`;
}

export const linkFor = (token) => `${window.location.origin}/t/${token}`;

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}
