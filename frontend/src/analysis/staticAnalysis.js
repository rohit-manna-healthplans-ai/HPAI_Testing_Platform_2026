// Static (not measured) complexity estimate. Works for every language: tree-sitter supplies loop / function ranges
// (falls back to a lightweight indentation/brace scanner when the parser can't load), then language-agnostic heuristics
// estimate time (loop nesting, sort calls, recursion) and space (allocations that grow with the input, recursion depth).
// It is a heuristic — labelled as an estimate in the UI.
import { labelFromExponents, modelIdFromExponents } from './complexityFit.js';

/* ── structure extraction ──────────────────────────────────────────────────────────────────────── */
const LOOP_TYPES = new Set([
  'for_statement', 'for_in_statement', 'while_statement', 'do_statement', 'do_while_statement', 'for_range_loop', 'enhanced_for_statement',
  'for_each_statement', 'foreach_statement', 'for_expression', 'while_expression', 'loop_expression', 'repeat_while_statement',
  'c_style_for_statement', 'for_in_clause', 'for', 'while', 'until', 'while_modifier', 'until_modifier',
]);
const FUNC_TYPES = new Set([
  'function_definition', 'function_declaration', 'method_declaration', 'function_item', 'method', 'singleton_method',
  'function_expression', 'arrow_function', 'generator_function_declaration', 'lambda', 'func_literal', 'constructor_declaration',
]);
const CALLBACK_LOOP_RE = /\.\s*(forEach|map|filter|reduce|reduceRight|some|every|find|findIndex|flatMap|each|each_with_index|each_char|collect|select|inject|for_each|filter_map|fold)\s*([({<]|do\b)|\b(map|filter|reduce|any|all|sum|max|min)\s*\(\s*(lambda|\w+\s*for\b|\[?\w+\s+for\b)/;
const CALL_TYPES = /(^|_)(call|call_expression|invocation_expression|method_invocation|function_call_expression)$/;

function toOffsets(code) {
  const starts = [0];
  for (let i = 0; i < code.length; i++) if (code[i] === '\n') starts.push(i + 1);
  return (pos) => (starts[pos.row] ?? code.length) + pos.column;
}

function nameOf(node) {
  const direct = node.childForFieldName && node.childForFieldName('name');
  if (direct) return direct.text;
  if (!/^(arrow_function|lambda|function_expression|func_literal|lambda_literal)$/.test(node.type)) {
    for (let i = 0; i < node.childCount; i++) { const c = node.child(i); if (/^(simple_)?identifier$/.test(c.type)) return c.text; }
  }
  let d =node.childForFieldName && node.childForFieldName('declarator');
  for (let i = 0; d && i < 6; i++) {
    if (/identifier|field_identifier|qualified_identifier/.test(d.type)) return d.text;
    d = (d.childForFieldName && (d.childForFieldName('declarator') || d.childForFieldName('name'))) || null;
  }
  return null;
}

/** Walk a tree-sitter root → { loops:[{start,end,text}], funcs:[{name,start,end}] } (offsets into `code`). */
export function extractFromTree(root, code) {
  const off = toOffsets(code);
  const loops = []; const funcs = [];
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    const t = n.type;
    if (n.isNamed) {
      if (LOOP_TYPES.has(t)) {
        // a comprehension clause iterates over the whole comprehension expression (element expr + sibling clauses)
        const scope = t === 'for_in_clause' && n.parent ? n.parent : n;
        loops.push({ start: off(scope.startPosition), end: off(scope.endPosition), text: n.text });
      } else if (FUNC_TYPES.has(t)) {
        const nm = nameOf(n); // anonymous functions/lambdas are analysed as part of their enclosing function
        if (nm) funcs.push({ name: nm, start: off(n.startPosition), end: off(n.endPosition) });
      }
      else if (CALL_TYPES.test(t) && CALLBACK_LOOP_RE.test(n.text.slice(0, 120))) {
        // only the callback/arguments are "inside" the loop; a chained receiver (a.map(..).filter(..)) runs sequentially
        const argNode = (n.childForFieldName && (n.childForFieldName('arguments') || n.childForFieldName('block'))) || null;
        const scope = argNode || n;
        loops.push({ start: off(scope.startPosition), end: off(scope.endPosition), text: n.text, callback: true });
      }
    }
    for (let i = n.childCount - 1; i >= 0; i--) stack.push(n.child(i));
  }
  return { loops, funcs };
}

/** Parser-free fallback: indentation (python/ruby) or brace based block detection. */
export function extractHeuristic(code, langId) {
  const lines = code.split('\n');
  const starts = []; let o = 0; for (const l of lines) { starts.push(o); o += l.length + 1; }
  const indentLang = langId === 'python' || langId === 'ruby';
  const loops = []; const funcs = [];
  const loopRe = /^\s*(?:(?:\w+\s*:\s*)?(for|while|foreach|loop|until|repeat|do)\b)/;
  const funcRe = indentLang
    ? /^\s*(?:def|fn|func)\s+(\w+)/
    : /^\s*(?:(?:public|private|protected|static|final|async|export|inline|extern|const|unsigned|virtual|override|fun|func|fn|function)\s+)*(?:[\w<>\[\]*&:,\s]+?\s+)?(\w+)\s*\([^;]*\)\s*(?:->\s*[\w<>\[\]&*]+\s*)?(?:const\s*)?\{?\s*$/;
  const KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'else', 'foreach']);
  const blockEnd = (i) => {
    if (indentLang) {
      const ind = lines[i].match(/^\s*/)[0].length;
      let j = i + 1; let last = i;
      for (; j < lines.length; j++) { if (!lines[j].trim()) continue; if (lines[j].match(/^\s*/)[0].length <= ind) break; last = j; }
      return starts[last] + lines[last].length;
    }
    let depth = 0; let seen = false;
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) { if (ch === '{') { depth++; seen = true; } else if (ch === '}') depth--; }
      if (seen && depth <= 0) return starts[j] + lines[j].length;
      if (!seen && j > i + 1) break; // brace-less one-liner
    }
    return starts[Math.min(i + 1, lines.length - 1)] + lines[Math.min(i + 1, lines.length - 1)].length;
  };
  lines.forEach((l, i) => {
    if (loopRe.test(l)) loops.push({ start: starts[i], end: blockEnd(i), text: l });
    else {
      const fm = l.match(funcRe);
      if (fm && !KW.has(fm[1])) funcs.push({ name: fm[1], start: starts[i], end: blockEnd(i) });
      else if (CALLBACK_LOOP_RE.test(l)) loops.push({ start: starts[i], end: starts[i] + l.length, text: l, callback: true });
    }
  });
  return { loops, funcs };
}

/* ── analysis ──────────────────────────────────────────────────────────────────────────────────── */
export function stripComments(code, langId) {
  let s = String(code || '');
  const hash = ['python', 'ruby', 'bash', 'r'].includes(langId);
  if (!hash) s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const re = hash ? /#[^\n]*/g : langId === 'php' ? /(\/\/|#)[^\n]*/g : /\/\/[^\n]*/g;
  return s.replace(re, (m) => ' '.repeat(m.length));
}

const CONST_BOUND_RE = /range\(\s*\d+\s*\)|[<>]=?\s*\d+\s*[;)]|\.\.=?\s*\d+\b|\buntil\s+\d+\b|\bin\s+\d+\.\.\.?\d+/;
const FOR_UPDATE_LOG_RE = /(\*=|\/=|\/\/=|>>=|<<=)\s*[2-9]|=\s*\w+\s*(\*|\/|>>|<<)\s*[2-9]/;
const WHILE_LOG_RE = /(\*=|\/=|\/\/=|>>=|<<=)\s*[2-9]|\w+\s*=\s*[^=\n;]*(\/\/?|>>)\s*[2-9]\b|\bmid\b|\bmiddle\b|\bsqrt\b/;

function classifyLoop(loop) {
  const text = loop.text || '';
  const header = text.split('\n')[0];
  if (loop.callback) return 'n';
  const isWhile = /^\s*(while|until|loop|do|repeat)\b/.test(header) || /^\s*(while|until|loop)\b/.test(text);
  if (CONST_BOUND_RE.test(header) && !/len\(|\.length|\.size|\.count|\bn\b/.test(header)) return 'const';
  if (isWhile && WHILE_LOG_RE.test(text)) return 'log';
  if (!isWhile && FOR_UPDATE_LOG_RE.test(header)) return 'log';
  return 'n';
}

const SORT_RE = /(\.\s*sort(ed|_by|_by_key|_unstable|_unstable_by)?\s*\(|\bsorted\s*\(|\bsort\s*\(|\bqsort\s*\(|\bstable_sort\s*\(|\bArrays\.sort|\bCollections\.sort|\bsort\.(Ints|Strings|Slice|Sort)\b|\bSort\s*\(|\.OrderBy\s*\(|\bsortedBy\b|\.sorted\s*\()/g;
const LINEAR_BUILTIN_RE = /(\.\s*(indexOf|lastIndexOf|includes|index|count|slice|concat|insert|reverse|copy|extend|splice|find|startsWith|endsWith|substring|substr|join|split)\s*\()|(\b(sum|min|max|reversed|list|tuple|set|sorted|any|all)\s*\(\s*\w)|(\bstrlen\s*\()|(\bin\s+[a-z_]\w*\s*(:|\)|and|or|if))/g;
const MEMO_RE = /\b(memo|cache|lru_cache|cached|dp|visited|seen|memoize|table|computed)\b|@cache|Map\s*\(|\{\s*\}/;
const HALVING_ARG_RE = /(\/\/?|>>)\s*[2-9]\b|\bmid\b|\bmiddle\b|\bhalf\b/;

/** Exponent pair comparison: [nExp, logExp]. */
const better = (a, b) => (a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1]);

function containing(items, pos) { return items.filter((x) => pos >= x.start && pos < x.end); }
function innermost(funcs, pos) { return containing(funcs, pos).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0] || null; }

function analyzeFunction(fn, code, clean, loops, funcs, langId) {
  const notes = [];
  const fnStart = fn.start; const fnEnd = fn.end;
  const myLoops = loops.filter((l) => l.start >= fnStart && l.end <= fnEnd && innermost(funcs, l.start) === fn.ref).map((l) => ({ ...l, kind: classifyLoop(l) }));
  const factorAt = (pos) => {
    let nE = 0; let lE = 0;
    for (const l of myLoops) if (pos >= l.start && pos < l.end) { if (l.kind === 'n') nE++; else if (l.kind === 'log') lE++; }
    return [nE, lE];
  };
  let time = [0, 0];
  let maxDepth = 0;
  for (const l of myLoops) {
    if (l.kind === 'const') continue;
    const f = factorAt(l.start);
    const mine = l.kind === 'n' ? [f[0], f[1]] : [f[0], f[1]];
    maxDepth = Math.max(maxDepth, f[0] + f[1]);
    if (better(mine, time)) time = mine;
  }
  if (maxDepth >= 2) notes.push(`${maxDepth} nested loops`); else if (maxDepth === 1) notes.push('single loop over the input');
  if (myLoops.some((l) => l.kind === 'log')) notes.push('loop halves/doubles its counter (log n)');

  const body = clean.slice(fnStart, fnEnd);
  const bodyOffset = fnStart;
  // sort calls and linear built-ins add a factor at their loop depth
  let m; SORT_RE.lastIndex = 0;
  while ((m = SORT_RE.exec(body))) {
    const f = factorAt(bodyOffset + m.index);
    const c = [f[0] + 1, f[1] + 1];
    if (better(c, time)) time = c;
    if (!notes.includes('uses a sort (n log n)')) notes.push('uses a sort (n log n)');
  }
  let linearHit = false; LINEAR_BUILTIN_RE.lastIndex = 0;
  const hashed = (nm) => new RegExp(`\\b${nm}\\b\\s*(:=|=|:)\\s*(set\\(|dict\\(|defaultdict|Counter|collections\\.|\\{|Set\\b|Map\\b|HashSet|HashMap|new\\s+(Set|Map|HashSet|HashMap))`).test(body);
  while ((m = LINEAR_BUILTIN_RE.exec(body))) {
    if (/^\s*in\s/.test(m[0])) { // membership test: skip loop headers (`for x in arr`) and hash-based collections
      const ls = body.lastIndexOf('\n', m.index) + 1;
      if (/\b(for|foreach)\b/.test(body.slice(ls, m.index))) continue;
      const nm = (m[0].match(/in\s+([a-z_]\w*)/i) || [])[1];
      if (nm && hashed(nm)) continue;
    }
    const f = factorAt(bodyOffset + m.index);
    if (f[0] >= 1 && /\.\s*(indexOf|lastIndexOf|includes|index|count|insert|splice|find|substring|substr|slice|concat|join|split|copy|extend)\s*\(|\bin\s+/.test(m[0])) {
      const c = [f[0] + 1, f[1]];
      if (better(c, time)) { time = c; linearHit = true; }
    }
  }
  if (linearHit) notes.push('linear built-in call (e.g. indexOf / in / slice) inside a loop');

  // recursion
  let exponential = false; let recDepth = null;
  const name = fn.name;
  if (name) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\w$])(?:this\\.|self\\.|\\w+\\.)?${esc}\\s*\\(`, 'g');
    const afterSig = body.indexOf('{') >= 0 && langId !== 'python' && langId !== 'ruby' ? body.indexOf('{') : body.indexOf('\n');
    const calls = []; let c; const inner = body.slice(Math.max(0, afterSig));
    while ((c = re.exec(inner))) calls.push(c.index);
    if (calls.length) {
      const halving = HALVING_ARG_RE.test(inner);
      const memo = MEMO_RE.test(body);
      if (calls.length >= 2 && halving) {
        const rec = [Math.max(1, time[0]), time[0] >= 1 ? 1 : 0]; // divide and conquer: merge-sort / quick-sort shape
        time = better(rec, time) || time[0] === 0 ? rec : [time[0], Math.max(time[1], 1)];
        recDepth = 'log'; notes.push('divide & conquer recursion (2 calls on half-size input)');
      } else if (calls.length >= 2 && !memo) {
        exponential = true; recDepth = 'n'; notes.push(`recursive with ${calls.length} self-calls and no memoisation → exponential`);
      } else if (calls.length >= 2) {
        const rec = [Math.max(1, time[0]), time[1]]; if (better(rec, time)) time = rec; recDepth = 'n'; notes.push('recursive with memoisation');
      } else if (halving) {
        if (!better(time, [0, 1])) time = [time[0], Math.max(time[1], 1)]; recDepth = 'log'; notes.push('recursion halves the input (log n)');
      } else {
        const rec = [time[0] + 1, time[1]]; if (better(rec, time)) time = rec; recDepth = 'n'; notes.push('linear recursion (depth n)');
      }
    }
  }

  // space
  let space = [0, 0]; const spaceNotes = [];
  const bump = (cand, why) => { if (better(cand, space)) space = cand; if (why && !spaceNotes.includes(why)) spaceNotes.push(why); };
  const GROW_RE = /\.\s*(append|push|add|extend|insert|push_back|emplace_back|emplace|put|offer|enqueue|unshift|push_front|setdefault|Add|add_assign|update)\s*\(|\bappend\s*\(|\+=\s*\[|\+=\s*["'`]|<<\s*\w/g;
  const SIZED_ALLOC_RE = /\[\s*(-?\d+(\.\d+)?|None|False|True|''|""|\[\])\s*\]\s*\*\s*(?!\d+\b)[\w(]|\bnew\s+[\w<>]+\s*\[\s*[a-zA-Z_]|\bvector\s*<[^>]*>\s*\w*\s*\(\s*[a-zA-Z_]|\bmake\s*\(\s*(\[\]\w+|map\[[^\]]*\]\w+)\s*,\s*[a-zA-Z_]|\bnew\s+Array\s*\(\s*[a-zA-Z_]|\bArray\s*\(\s*[a-zA-Z_]|\bArray\.from\s*\(|\bArray\s*\(\s*\w+\s*\)\.fill|\bsorted\s*\(|\.copy\s*\(|\[\s*:\s*\]|\.slice\s*\(|\.concat\s*\(|\.split\s*\(|\.map\s*\(|\.filter\s*\(|\blist\s*\(\s*\w|\bset\s*\(\s*\w|\bdict\s*\(\s*\w|\.clone\s*\(\)|\.to_vec\s*\(\)|\bnew\s+(Hash|Array|List|ArrayList|Map|Set|HashSet|HashMap)\b[^;\n]*\(\s*\w+\.|\.toCharArray\s*\(|\bstr\s*\(\s*\w|\.join\s*\(|\.chars\s*\(\)\.collect|\.collect\s*(::<[^>]*>)?\s*\(\)|\[\s*\.\.\.\s*\w/g;
  const TWO_D_RE = /\[\s*\[[^\]\n]*\][^\]\n]*\bfor\b|\[\s*\[[^\]\n]*\]\s*\*\s*\w+\s*for|\bvector\s*<\s*vector|\bnew\s+\w+\s*\[[^\]\n]+\]\s*\[[^\]\n]+\]|\bmake\s*\(\s*\[\]\[\]|\[\s*\w+\s*\]\s*\*\s*\w+\s*\)\s*for|Array\.from\s*\(\s*\{[^}]*\}\s*,[^)]*Array|\.append\s*\(\s*\[\s*0\s*\]\s*\*\s*\w|\.push\s*\(\s*(new\s+Array|Array\.from|\[\s*\.\.\.)/g;
  const hasDictLike = /\b(dict|defaultdict|Counter|HashMap|HashSet|unordered_map|unordered_set|Map|Set|OrderedDict|BTreeMap|map\[|set\s*\(|\{\s*\})/.test(body);
  SIZED_ALLOC_RE.lastIndex = 0;
  while ((m = SIZED_ALLOC_RE.exec(body))) { bump([1, 0], 'allocates a collection that grows with the input'); if (space[0] >= 1) break; }
  GROW_RE.lastIndex = 0;
  while ((m = GROW_RE.exec(body))) { if (factorAt(bodyOffset + m.index)[0] >= 1) { bump([1, 0], 'appends/adds to a collection inside a loop'); break; } }
  if (hasDictLike) {
    const SUBSCRIPT_SET = /\b\w+\s*\[[^\]\n]+\]\s*(=|\+=)(?!=)/g;
    while ((m = SUBSCRIPT_SET.exec(body))) { if (factorAt(bodyOffset + m.index)[0] >= 1) { bump([1, 0], 'fills a map/set inside a loop'); break; } }
  }
  TWO_D_RE.lastIndex = 0;
  if (TWO_D_RE.test(body)) bump([2, 0], 'allocates a 2-D table');
  if (recDepth === 'n') bump([1, 0], 'recursion depth grows with the input (call stack)');
  else if (recDepth === 'log') bump([0, 1], 'recursion depth ≈ log n');

  return { name: fn.name || '(top level)', time, exponential, space, notes: [...notes, ...spaceNotes], loops: myLoops.length };
}

function summarize(a) {
  return {
    time: { label: labelFromExponents(a.time[0], a.time[1], { exponential: a.exponential }), id: modelIdFromExponents(a.time[0], a.time[1], a.exponential) },
    space: { label: labelFromExponents(a.space[0], a.space[1]), id: modelIdFromExponents(a.space[0], a.space[1]) },
  };
}

/**
 * structure: { loops, funcs } from extractFromTree / extractHeuristic.  opts: { fnName, langId }
 * → { source:'static', function, time:{label,id}, space:{label,id}, notes:[...], functions:[...] }
 */
export function analyzeStatic(code, structure, { fnName = null, langId = '' } = {}) {
  const clean = stripComments(code, langId);
  const funcs = (structure.funcs || []).map((f) => ({ ...f }));
  funcs.forEach((f) => { f.ref = f; });
  const loops = structure.loops || [];
  const whole = { name: null, start: 0, end: clean.length, ref: null };
  const results = funcs.map((f) => analyzeFunction(f, code, clean, loops, funcs, langId));
  // loops outside any function (scripts / top-level code)
  const topLoops = loops.filter((l) => !innermost(funcs, l.start));
  if (topLoops.length || !funcs.length) results.push(analyzeFunction(whole, code, clean, topLoops, funcs, langId));

  const skip = new Set(['main', '__main__', 'Main', 'Solution']);
  let pool = results.filter((r) => !skip.has(r.name));
  if (!pool.length) pool = results;
  let primary = fnName ? pool.find((r) => r.name === fnName) : null;
  if (!primary) {
    primary = pool.reduce((best, r) => {
      if (!best) return r;
      const rk = r.exponential ? [99, 0] : r.time; const bk = best.exponential ? [99, 0] : best.time;
      return better(rk, bk) ? r : best;
    }, null);
  }
  if (!primary) return { source: 'static', function: null, time: { label: 'O(1)', id: '1' }, space: { label: 'O(1)', id: '1' }, notes: ['No function found to analyze.'], functions: [] };
  const s = summarize(primary);
  return { source: 'static', function: primary.name, ...s, notes: primary.notes.length ? primary.notes : ['no loops or growing allocations found'], functions: results.map((r) => ({ name: r.name, ...summarize(r) })) };
}
