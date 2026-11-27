// Public entry for all browser-side marking. Heavy engines (sql.js, mingo, tree-sitter, sucrase, Pyodide) load lazily on first use.
import { runCoding, starterCode, warmUpPython } from './coding.js';
import { scoreMcq } from './mcq.js';
import { runUiChecks } from './ui.js';
import { languageKind } from './languages.js';
import { isInteractiveType, markInteractive, defaultInteractiveResponse, isInteractiveAnswered } from './interactive.js';

export { starterCode, warmUpPython };
export { INTERACTIVE_TYPES, isInteractiveType, markInteractive, interactiveProgress } from './interactive.js';
export * from './languages.js';

export const SQL_STARTER = '-- Write a single SELECT query\nSELECT \n';
export function nosqlStarter(question) {
  return (question.config?.mode || 'aggregate') === 'find'
    ? '{\n  filter: {},\n  projection: {},\n  sort: {},\n  limit: 0\n}\n'
    : '[\n  // { $match: { } },\n]\n';
}

export async function getSqlPreview(question) {
  const { getSqlPreview: g } = await import('./sqlRunner.js');
  return g(question);
}

/** Initial server-shaped response for a question. */
export function defaultResponse(question) {
  switch (question.type) {
    case 'coding': return { language: 'python', code: starterCode(question, 'python') };
    case 'sql': return { code: SQL_STARTER };
    case 'nosql': return { code: nosqlStarter(question) };
    case 'ui': return { files: { ...(question.config?.files || {}) } };
    case 'mcq': return { selected: [] };
    default: return isInteractiveType(question.type) ? defaultInteractiveResponse(question) : {};
  }
}

/** Has the candidate actually done something (differs from the starter)? */
export function isAnswered(question, response) {
  if (!response) return false;
  switch (question.type) {
    case 'coding': {
      const code = (response.code || '').trim();
      return !!code && code !== starterCode(question, response.language || 'python').trim();
    }
    case 'sql': { const c = (response.code || '').trim(); return !!c && c !== SQL_STARTER.trim(); }
    case 'nosql': { const c = (response.code || '').trim(); return !!c && c !== nosqlStarter(question).trim(); }
    case 'ui': {
      const orig = question.config?.files || {};
      const f = response.files || {};
      return Object.keys({ ...orig, ...f }).some((k) => (orig[k] ?? '') !== (f[k] ?? ''));
    }
    case 'mcq': return (response.selected || []).length > 0;
    default: return isInteractiveType(question.type) ? isInteractiveAnswered(question, response) : false;
  }
}

/**
 * Mark a question in the browser.
 * opts: { onlyVisible, onProgress }
 * returns { passed, total, results:[{index,name,passed,hidden,weight,message?}], error?, retryable?, mode? }
 * mode === 'syntax_only' for languages without a browser runtime (internal flag; stays in the saved response).
 */
export async function runQuestion(question, response, opts = {}) {
  try {
    switch (question.type) {
      case 'coding': return await runCoding(question, response, opts);
      case 'sql': { const { runSql } = await import('./sqlRunner.js'); return await runSql(question, response, opts); }
      case 'nosql': { const { runNosqlTests } = await import('./nosqlCore.js'); return runNosqlTests(question, response?.code, opts); }
      case 'ui': return await runUiChecks(question, response?.files, opts);
      case 'mcq': return scoreMcq(question, response);
      case 'sequence': case 'match': case 'architecture': return markInteractive(question, response); // drag & drop types: no execution, no hidden/visible split
      default: return { passed: 0, total: 0, results: [] };
    }
  } catch (e) {
    const total = (question.tests || []).length || 1;
    return { passed: 0, total, results: [], error: String(e?.message || e), retryable: true };
  }
}

/** Total number of (weighted) tests for a question – used when we cannot grade (e.g. grading timed out). */
export function totalTests(question, language) {
  if (question.type === 'mcq') return question.config?.multiple ? (question.config?.correct || []).length || 1 : 1;
  if (isInteractiveType(question.type)) return (question.tests || []).length || question.test_count || 1;
  if (question.type === 'coding' && language && languageKind(language) === 'syntax') return question.config?.needs_control_flow === false ? 6 : 8;
  return (question.tests || []).reduce((s, t) => s + (t.weight ?? 1), 0) || 1;
}
