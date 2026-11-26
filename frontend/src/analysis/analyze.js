// Orchestrates the complexity analysis for one saved answer: static estimate (all languages) + measured benchmark
// (Python / JavaScript / TypeScript). Heavy modules are imported lazily so the dashboards stay light.
import { SYNTAX_GRAMMAR } from '../runners/syntaxCore.js';
import { referenceCurve, modelIdFromExponents } from './complexityFit.js';
import { getQuestionById } from '../bank/index.js';

export const STATIC_GRAMMAR = { ...SYNTAX_GRAMMAR, javascript: 'javascript', typescript: 'typescript' };
export const MEASURABLE = new Set(['python', 'javascript', 'typescript']);
export const isAnalyzable = (answer) => answer?.type === 'coding' && !!answer?.response?.code && !!STATIC_GRAMMAR[answer.response.language];

const CACHE_VERSION = 'v1';
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
export const cacheKey = (attemptId, answer) => `hpai_cx_${CACHE_VERSION}:${attemptId}:${answer.question_id}:${hash(`${answer.response?.language}\n${answer.response?.code}`)}`;
export function loadCached(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
export function saveCached(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full / blocked */ } }

const fnNameFor = (config, language) => (config?.fn || {})[language === 'python' ? 'py' : 'js'] || (config?.fn || {}).js || (config?.fn || {}).py || null;

export async function staticFor(language, code, config) {
  const grammar = STATIC_GRAMMAR[language];
  const { analyzeStatic, extractFromTree, extractHeuristic } = await import('./staticAnalysis.js');
  let structure; let parser = 'tree-sitter';
  try {
    const { withTree } = await import('../runners/syntaxCheck.js');
    structure = await withTree(grammar, code, (root) => extractFromTree(root, code));
  } catch {
    structure = extractHeuristic(code, language); parser = 'heuristic (parser unavailable)';
  }
  return { ...analyzeStatic(code, structure, { fnName: fnNameFor(config, language), langId: language }), parser };
}

const toKB = (pts) => pts.map((p) => ({ n: p.n, value: p.value / 1024 }));

/**
 * answer: { response:{language,code}, question_config, sample_args }   (from GET /proctor/attempts/:id)
 * → { language, generic, reason, error?, staticResult, time:{...}, space:{...}, ranAt }
 * Each of time/space: { label, id, source:'measured'|'static', confidence?, points?, fitted?, refs?, note? }
 */
export async function analyzeAnswer(answer, { onProgress } = {}) {
  const language = answer.response.language;
  const code = String(answer.response.code || '');
  // Question config/tests (incl. bench spec) live in the bundled bank, not in the API payload.
  const bankQ = answer.question_config ? null : await getQuestionById(answer.question_id).catch(() => null);
  const config = answer.question_config || bankQ?.config || {};
  const sampleArgs = answer.sample_args ?? bankQ?.public_tests?.[0]?.args ?? bankQ?.tests?.[0]?.args;
  const stat = await staticFor(language, code, config);
  const out = { language, generic: false, reason: 'static', error: null, staticResult: stat, ranAt: Date.now() };

  let measured = null;
  if (MEASURABLE.has(language) && answer.response.mode !== 'syntax_only') {
    const { runBench } = await import('./bench.js');
    measured = await runBench({ language, code, config, sampleArgs, onProgress });
    out.generic = measured.generic; out.reason = measured.reason; out.error = measured.error || null;
  }

  // ---- time
  const staticTime = { label: stat.time.label, id: stat.time.id, source: 'static', notes: stat.notes };
  const mt = measured?.time;
  if (mt && !mt.insufficient && mt.class) {
    out.time = {
      label: mt.class, id: mt.id, source: 'measured', confidence: mt.confidence, unit: 'ms',
      points: measured.points.map((p) => ({ n: p.n, value: p.ms })), fitted: mt.fitted,
      refs: ['n', 'nlogn', 'n2'].map((id) => ({ id, curve: referenceCurve(id, measured.points.map((p) => ({ n: p.n, value: p.ms }))) })),
      alternatives: mt.alternatives, staticLabel: stat.time.label,
    };
  } else {
    out.time = { ...staticTime, unit: 'ms', points: measured?.points?.length ? measured.points.map((p) => ({ n: p.n, value: p.ms })) : [], note: mt?.reason || (measured?.error ? null : undefined) };
  }

  // ---- space
  const ms = measured?.space;
  if (ms && !ms.insufficient && ms.class) {
    const pts = measured.points.filter((p) => p.bytes != null).map((p) => ({ n: p.n, value: p.bytes }));
    out.space = {
      label: ms.class, id: ms.id, source: 'measured', confidence: ms.confidence, unit: 'KB',
      points: toKB(pts), fitted: toKB(ms.fitted),
      refs: ['n', 'n2'].map((id) => ({ id, curve: toKB(referenceCurve(id, pts)) })), staticLabel: stat.space.label,
    };
  } else {
    const pts = (measured?.points || []).filter((p) => p.bytes != null).map((p) => ({ n: p.n, value: p.bytes / 1024 }));
    out.space = { label: stat.space.label, id: stat.space.id, source: 'static', unit: 'KB', points: pts, notes: stat.notes, note: ms?.reason };
  }
  out.sizes = measured?.sizes || null;
  return out;
}

export { modelIdFromExponents };
