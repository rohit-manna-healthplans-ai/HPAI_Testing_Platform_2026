import initSqlJs from 'sql.js/dist/sql-wasm.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { runSqlTests, sqlPreview } from './sqlCore.js';

let sqlPromise = null;
export function getSQL() {
  if (!sqlPromise) sqlPromise = initSqlJs({ locateFile: () => wasmUrl }).catch((e) => { sqlPromise = null; throw e; });
  return sqlPromise;
}

export async function runSql(question, response, opts) {
  const SQL = await getSQL();
  return runSqlTests(SQL, question, response?.code, opts);
}

export async function getSqlPreview(question) {
  const SQL = await getSQL();
  try { return sqlPreview(SQL, question); } catch { return []; }
}
