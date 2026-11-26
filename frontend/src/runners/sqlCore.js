// SQL marking core. Takes an initialised sql.js module `SQL` so it is testable in node.
import { summarize } from './compare.js';

const round6 = (x) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);
const normRow = (row) => row.map((c) => (c === undefined ? null : round6(c)));

export function checkSingleSelect(code) {
  let s = String(code || '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .trim();
  if (!s) return { ok: false, message: 'Write a SELECT query first.' };
  s = s.replace(/;+\s*$/, '').trim();
  const noStrings = s.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
  if (noStrings.includes(';')) return { ok: false, message: 'Only a single SELECT statement is allowed.' };
  if (!/^(select|with)\b/i.test(s)) return { ok: false, message: 'Query must start with SELECT (or WITH).' };
  return { ok: true, sql: s };
}

export function runSqlTests(SQL, question, code, { onlyVisible = false } = {}) {
  const cfg = question.config || {};
  const tests = (question.tests || []).map((t, index) => ({ ...t, index })).filter((t) => !onlyVisible || !t.hidden);
  const chk = checkSingleSelect(code);
  if (!chk.ok) {
    return { ...summarize(tests.map((t) => ({ index: t.index, name: `Test ${t.index + 1}`, passed: false, hidden: !!t.hidden, weight: t.weight ?? 1, message: chk.message }))), error: chk.message };
  }
  const results = tests.map((t) => {
    const base = { index: t.index, name: `Test ${t.index + 1}`, hidden: !!t.hidden, weight: t.weight ?? 1 };
    let db;
    try {
      db = new SQL.Database();
      if (cfg.schema_sql) db.exec(cfg.schema_sql);
      if (t.setup_sql) db.exec(t.setup_sql);
      const res = db.exec(chk.sql);
      const rows = res.length ? res[res.length - 1].values.map(normRow) : [];
      const exp = (t.expected?.rows || []).map(normRow);
      if (rows.length !== exp.length) return { ...base, passed: false, message: `Expected ${exp.length} row(s), got ${rows.length}.` };
      if (rows.length && exp.length && rows[0].length !== exp[0].length) return { ...base, passed: false, message: `Expected ${exp[0].length} column(s), got ${rows[0].length}.` };
      const key = (r) => JSON.stringify(r);
      let a = rows.map(key); let b = exp.map(key);
      if (!cfg.ordered) { a = [...a].sort(); b = [...b].sort(); }
      const same = a.every((x, i) => x === b[i]);
      return { ...base, passed: same, message: same ? undefined : 'Output rows do not match the expected result.' };
    } catch (e) {
      return { ...base, passed: false, message: String(e.message || e) };
    } finally { try { if (db) db.close(); } catch { /* ignore */ } }
  });
  return summarize(results);
}

/** Table previews built from schema + first visible test setup. */
export function sqlPreview(SQL, question, maxRows = 5) {
  const cfg = question.config || {};
  const first = (question.tests || []).find((t) => !t.hidden) || (question.tests || [])[0] || {};
  const db = new SQL.Database();
  try {
    if (cfg.schema_sql) db.exec(cfg.schema_sql);
    if (first.setup_sql) db.exec(first.setup_sql);
    const names = (db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")[0]?.values || []).map((r) => r[0]);
    return names.map((name) => {
      const q = `"${String(name).replace(/"/g, '""')}"`;
      const total = db.exec(`SELECT COUNT(*) FROM ${q}`)[0]?.values[0][0] ?? 0;
      const r = db.exec(`SELECT * FROM ${q} LIMIT ${maxRows}`)[0];
      const cols = db.exec(`PRAGMA table_info(${q})`)[0]?.values.map((c) => c[1]) || r?.columns || [];
      return { name, columns: cols, rows: r?.values || [], total };
    });
  } finally { db.close(); }
}

export function expectedPreview(question) {
  const first = (question.tests || []).find((t) => !t.hidden);
  return first?.expected || null;
}
