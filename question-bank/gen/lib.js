// Shared runners/comparators used by the generator and the validator (same semantics as the frontend runners).
import initSqlJs from 'sql.js';
import { Query, Aggregator } from 'mingo';

let SQL;
export async function sqlRun(schema, setup, query) {
  SQL ||= await initSqlJs();
  const db = new SQL.Database();
  try {
    db.exec(schema);
    if (setup) db.exec(setup);
    const stmt = db.prepare(query);
    const columns = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) rows.push(stmt.get());
    stmt.free();
    return { columns, rows };
  } finally { db.close(); }
}

const num = (v) => (typeof v === 'number' ? Number(v.toFixed(6)) : v);
export function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(num(v));
}
export function sameSet(a, b, ordered) {
  if (a.length !== b.length) return false;
  const x = a.map(canon), y = b.map(canon);
  if (!ordered) { x.sort(); y.sort(); }
  return x.every((s, i) => s === y[i]);
}

export function nosqlRun(mode, literal, data) {
  const spec = new Function('return (' + literal + ')')();
  const docs = structuredClone(data);
  if (mode === 'aggregate') return new Aggregator(spec).run(docs);
  let cur = new Query(spec.filter || {}).find(docs, spec.projection);
  if (spec.sort) cur = cur.sort(spec.sort);
  if (spec.limit) cur = cur.limit(spec.limit);
  return cur.all();
}
