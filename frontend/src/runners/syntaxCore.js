// Syntax-check-only marking core (pure — takes a web-tree-sitter `Parser` + a grammar loader so it runs in node and in the browser).
//
// Languages without a browser runtime are never executed. They are parsed with tree-sitter and get synthetic checks:
//   (1) parses with zero syntax errors   (2) non-trivial implementation   (3) uses a loop/conditional (if the question needs one)
//   (4) produces a result (return / print)
// Every check has equal weight and total = number of checks, so a fully passing syntax check earns the full marks.

export const SYNTAX_GRAMMAR = {
  c: 'c', cpp: 'cpp', java: 'java', csharp: 'c_sharp', go: 'go', rust: 'rust', ruby: 'ruby',
  php: 'php', kotlin: 'kotlin', swift: 'swift', bash: 'bash', python: 'python',
};
export const SYNTAX_CAP = 1;
const MAX_PARSE_CHARS = 200000;

const prop = (n, k) => (typeof n[k] === 'function' ? n[k]() : n[k]);

function describeError(node) {
  const sp = node.startPosition; const ep = node.endPosition;
  if (prop(node, 'isMissing')) {
    return { line: sp.row + 1, col: sp.column + 1, endLine: sp.row + 1, endCol: sp.column + 2, message: `Missing "${node.type}"` };
  }
  const first = String(node.text || '').split('\n')[0].trim();
  const shown = first.length > 24 ? `${first.slice(0, 24)}…` : first;
  const sameLine = ep.row === sp.row;
  return {
    line: sp.row + 1, col: sp.column + 1,
    endLine: sp.row + 1, endCol: sameLine ? ep.column + 1 : sp.column + 1 + Math.max(1, first.length),
    message: shown ? `Unexpected "${shown}"` : 'Syntax error',
  };
}

/** First few syntax errors (ERROR nodes and missing tokens) with 1-based line/col. */
export function collectErrors(root, max = 5) {
  const errs = [];
  const visit = (node) => {
    if (errs.length >= max) return;
    if (node.type === 'ERROR' || prop(node, 'isMissing')) { errs.push(describeError(node)); return; }
    if (!prop(node, 'hasError')) return;
    for (const c of node.children) visit(c);
  };
  visit(root);
  if (!errs.length && prop(root, 'hasError')) errs.push({ line: 1, col: 1, endLine: 1, endCol: 2, message: 'Syntax error' });
  return errs;
}

const CONTROL_RE = /(^|_)(for|while|loop|foreach|until|repeat|if|elif|elsif|unless|switch|match|when|guard|ternary|conditional|case)(_|$)/;
const CONTROL_EXTRA = new Set(['do_statement', 'do_while_statement']);
export const isControlFlowType = (t) => !t.startsWith('preproc') && (CONTROL_EXTRA.has(t) || CONTROL_RE.test(t));
const RETURN_RE = /(^|_)return(_|$)/;
const OUTPUT_IDENTS = new Set(['printf', 'fprintf', 'puts', 'putchar', 'cout', 'print', 'println', 'Println', 'Printf', 'Print', 'echo', 'WriteLine', 'Write', 'print_r', 'var_dump', 'say']);
const NOT_OUTPUT_TYPE = /string|comment|literal|char/;

function walk(root, fn) {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    fn(n);
    const kids = n.children;
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }
}

export function analyzeTree(root) {
  let controlFlow = false; let hasReturn = false; let hasOutput = false;
  walk(root, (n) => {
    const t = n.type;
    if (!controlFlow && isControlFlowType(t)) controlFlow = true;
    if (!hasReturn && RETURN_RE.test(t)) hasReturn = true;
    if (!hasOutput && n.childCount === 0 && !NOT_OUTPUT_TYPE.test(t) && OUTPUT_IDENTS.has(n.text)) hasOutput = true;
  });
  return { controlFlow, hasReturn, hasOutput };
}

const HASH_LANGS = new Set(['ruby', 'bash', 'python']);
/** Count lines that contain code (comments and blank lines removed). */
export function codeLines(code, langId) {
  let s = String(code || '');
  if (langId === 'ruby') s = s.replace(/^=begin[\s\S]*?^=end/gm, '');
  if (!HASH_LANGS.has(langId)) s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  const lineComment = HASH_LANGS.has(langId) ? /#.*$/ : langId === 'php' ? /(\/\/|#).*$/ : /\/\/.*$/;
  return s.split('\n').map((l) => l.replace(lineComment, '').trim()).filter(Boolean);
}
export const countCodeLines = (code, langId) => codeLines(code, langId).length;
/** Lines of code that are not part of the starter skeleton (so boilerplate-heavy languages can't earn this for free). */
export function countNewLines(code, starter, langId) {
  const known = new Set(codeLines(starter, langId));
  return codeLines(code, langId).filter((l) => !known.has(l)).length;
}

export function createSyntaxEngine({ Parser, loadLanguage }) {
  const parser = new Parser();
  const langs = new Map();
  const getLang = (grammar) => {
    if (!langs.has(grammar)) langs.set(grammar, Promise.resolve(loadLanguage(grammar)).catch((e) => { langs.delete(grammar); throw e; }));
    return langs.get(grammar);
  };
  return {
    /** -> { errors, stats|null } ; stats only computed when the code parses cleanly and withStats is set. */
    async analyze(langId, code, { withStats = true } = {}) {
      const grammar = SYNTAX_GRAMMAR[langId];
      if (!grammar) throw new Error(`No syntax checker for ${langId}`);
      const text = String(code || '');
      if (text.length > MAX_PARSE_CHARS) return { errors: [{ line: 1, col: 1, endLine: 1, endCol: 2, message: 'Code is too large to check' }], stats: null };
      const lang = await getLang(grammar);
      parser.setLanguage(lang);
      const tree = parser.parse(text);
      try {
        const errors = collectErrors(tree.rootNode);
        return { errors, stats: errors.length || !withStats ? null : analyzeTree(tree.rootNode) };
      } finally { if (tree.delete) tree.delete(); }
    },
    /** Parse with an explicit grammar name and hand the root node to `fn` (used by the complexity analysis). */
    async parse(grammar, code, fn) {
      const lang = await getLang(grammar);
      parser.setLanguage(lang);
      const tree = parser.parse(String(code || ''));
      try { return fn(tree.rootNode); } finally { if (tree.delete) tree.delete(); }
    },
  };
}

export const formatErrors = (errors, max = 3) =>
  errors.slice(0, max).map((e) => `Line ${e.line}, col ${e.col}: ${e.message}`).join('\n') + (errors.length > max ? '\n…' : '');

/**
 * analysis: { errors, stats } from the engine (or null with loadError when the checker could not load).
 * Returns { passed, total, results, mode:'syntax_only', cap, syntax:{errors} }.
 */
export function markSyntaxOnly(question, response, analysis, { starter = '', loadError = null } = {}) {
  const langId = response?.language;
  const code = String(response?.code || '');
  const needsCF = question.config?.needs_control_flow !== false;
  const defs = [['Code parses with no syntax errors'], ['Has a non-trivial implementation']];
  if (needsCF) defs.push(['Uses a loop or conditional']);
  defs.push(['Produces a result (return / print)']);
  const total = defs.length;
  const mk = (flags, msgs = []) => ({
    passed: flags.filter(Boolean).length,
    total,
    results: defs.map(([name], i) => ({ index: i, name, passed: !!flags[i], hidden: false, weight: 1, message: flags[i] ? undefined : msgs[i] })),
    mode: 'syntax_only', cap: SYNTAX_CAP,
  });

  if (!code.trim()) return { ...mk(defs.map(() => false), defs.map(() => 'No code written.')), error: 'No code written.', syntax: { errors: [] } };
  if (code.trim() === String(starter).trim()) return { ...mk(defs.map(() => false), defs.map(() => 'No changes made to the starter code.')), syntax: { errors: [] } };
  if (loadError || !analysis) {
    const msg = loadError || 'This answer could not be evaluated right now. Please try again.';
    return { ...mk(defs.map(() => false), defs.map(() => msg)), error: msg, retryable: true, syntax: { errors: [] } };
  }

  const { errors, stats } = analysis;
  const parses = errors.length === 0;
  const lines = countCodeLines(code, langId);
  // boilerplate-heavy languages (Java, C#, ...) already have many lines, so measure what was ADDED to the starter
  const nonTrivial = parses && lines >= 3 && countNewLines(code, starter, langId) >= 2;
  const flags = [parses, nonTrivial]; const msgs = [formatErrors(errors), parses ? 'Write the actual solution (add at least 2 lines of code to the starter).' : 'Fix the syntax errors first.'];
  if (needsCF) { flags.push(parses && !!stats?.controlFlow); msgs.push(parses ? 'Add the loop or condition the problem needs.' : 'Fix the syntax errors first.'); }
  const implicitReturn = langId === 'ruby' || langId === 'rust'; // last expression is the return value
  flags.push(parses && (!!stats?.hasReturn || !!stats?.hasOutput || (implicitReturn && nonTrivial)));
  msgs.push(parses ? 'Return or print the answer.' : 'Fix the syntax errors first.');
  const out = mk(flags, msgs);
  out.syntax = { errors };
  if (!parses) out.error = formatErrors(errors);
  return out;
}
