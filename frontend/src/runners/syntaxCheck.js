// Browser wrapper: lazy-loads web-tree-sitter (runtime wasm via Vite) and grammar wasm files from a pinned CDN, per language.
import wasmUrl from 'web-tree-sitter/tree-sitter.wasm?url';
import { createSyntaxEngine, markSyntaxOnly, SYNTAX_GRAMMAR } from './syntaxCore.js';
import { starterFor } from './languages.js';

const GRAMMAR_BASE = 'https://cdn.jsdelivr.net/npm/tree-sitter-wasms@0.1.13/out/';
let enginePromise = null;

function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      const mod = await import('web-tree-sitter');
      const Parser = mod.default || mod;
      await Parser.init({ locateFile: () => wasmUrl });
      return createSyntaxEngine({ Parser, loadLanguage: (g) => Parser.Language.load(`${GRAMMAR_BASE}tree-sitter-${g}.wasm`) });
    })().catch((e) => { enginePromise = null; throw e; });
  }
  return enginePromise;
}

export const hasSyntaxChecker = (langId) => !!SYNTAX_GRAMMAR[langId];

/** Parse `code` with a tree-sitter grammar (by grammar name) and call fn(rootNode). Used by analysis/analyze.js. */
export async function withTree(grammar, code, fn) {
  const engine = await getEngine();
  return engine.parse(grammar, code, fn);
}

/** Live linting: returns [{line,col,endLine,endCol,message}] (empty when fine or when the checker is unavailable). */
export async function lintCode(langId, code) {
  try {
    const engine = await getEngine();
    const { errors } = await engine.analyze(langId, code, { withStats: false });
    return errors;
  } catch { return []; }
}

/** Marking for syntax-only languages. */
export async function runSyntaxOnly(question, response) {
  const starter = starterFor(response?.language, question);
  const code = String(response?.code || '');
  if (!code.trim() || code.trim() === starter.trim()) return markSyntaxOnly(question, response, null, { starter });
  try {
    const engine = await getEngine();
    const analysis = await engine.analyze(response.language, code);
    return markSyntaxOnly(question, response, analysis, { starter });
  } catch (e) {
    return markSyntaxOnly(question, response, null, { starter, loadError: 'Could not evaluate this answer right now (check your internet connection). Please try again.' });
  }
}
