// Language registry for coding questions.
//  kind 'exec'   : runs in the browser (Python via Pyodide, JavaScript, TypeScript via sucrase)
//  kind 'syntax' : no browser runtime -> parsed with tree-sitter (internal marking details: docs/INTERACTIVE_TYPES.md)

const RESERVED = new Set(['string', 'int', 'long', 'double', 'float', 'char', 'bool', 'boolean', 'var', 'val', 'fun', 'fn', 'let', 'in', 'is', 'as', 'do', 'if', 'for', 'while', 'end', 'class', 'new', 'this', 'type', 'default', 'function', 'def', 'return', 'match', 'mod', 'ref', 'out', 'params', 'object', 'base', 'byte', 'short', 'case', 'switch', 'enum', 'const', 'static', 'public', 'private', 'void', 'self', 'use', 'crate', 'struct', 'range', 'len', 'map', 'set']);
const ident = (name, i) => {
  let s = String(name || `arg${i + 1}`).replace(/[^A-Za-z0-9_]/g, '_');
  if (/^\d/.test(s)) s = `a_${s}`;
  return RESERVED.has(s) ? `${s}_` : s;
};

// ---- value-type inference (for typed starter signatures) --------------------------------------------
function kindOf(v) {
  if (typeof v === 'boolean') return 'bool';
  if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'double';
  if (typeof v === 'string') return 'string';
  if (Array.isArray(v)) {
    if (!v.length) return 'empty[]';
    if (v.every(Array.isArray)) return 'matrix';
    if (v.every((x) => typeof x === 'boolean')) return 'bool[]';
    if (v.every((x) => typeof x === 'number')) return v.every(Number.isInteger) ? 'int[]' : 'double[]';
    if (v.every((x) => typeof x === 'string')) return 'string[]';
  }
  return 'other';
}
function mergeKinds(kinds) {
  const real = kinds.filter((k) => k !== 'empty[]' && k !== undefined);
  if (!real.length) return kinds.includes('empty[]') ? 'int[]' : 'other';
  let k = real[0];
  for (const n of real.slice(1)) {
    if (n === k) continue;
    if ((k === 'int' && n === 'double') || (k === 'double' && n === 'int')) k = 'double';
    else if ((k === 'int[]' && n === 'double[]') || (k === 'double[]' && n === 'int[]')) k = 'double[]';
    else return 'other';
  }
  return k;
}
export function inferSignature(question) {
  const tests = question.tests || [];
  const names = question.config?.fn?.params || [];
  const n = Math.max(names.length, ...tests.map((t) => (t.args || []).length), 0);
  const params = [];
  for (let i = 0; i < n; i++) params.push({ name: ident(names[i], i), kind: mergeKinds(tests.map((t) => kindOf((t.args || [])[i]))) });
  return { params, result: mergeKinds(tests.map((t) => kindOf(t.expected))) };
}

const T = {
  c: { int: 'long long', double: 'double', bool: 'int', string: 'const char *', 'int[]': 'long long *', 'double[]': 'double *', 'bool[]': 'int *', 'string[]': 'const char **', matrix: 'long long **', other: 'void *' },
  cpp: { int: 'long long', double: 'double', bool: 'bool', string: 'string', 'int[]': 'vector<long long>', 'double[]': 'vector<double>', 'bool[]': 'vector<bool>', 'string[]': 'vector<string>', matrix: 'vector<vector<long long>>', other: 'auto' },
  java: { int: 'int', double: 'double', bool: 'boolean', string: 'String', 'int[]': 'int[]', 'double[]': 'double[]', 'bool[]': 'boolean[]', 'string[]': 'String[]', matrix: 'int[][]', other: 'Object' },
  csharp: { int: 'int', double: 'double', bool: 'bool', string: 'string', 'int[]': 'int[]', 'double[]': 'double[]', 'bool[]': 'bool[]', 'string[]': 'string[]', matrix: 'int[][]', other: 'object' },
  go: { int: 'int', double: 'float64', bool: 'bool', string: 'string', 'int[]': '[]int', 'double[]': '[]float64', 'bool[]': '[]bool', 'string[]': '[]string', matrix: '[][]int', other: 'interface{}' },
  rust: { int: 'i64', double: 'f64', bool: 'bool', string: 'String', 'int[]': 'Vec<i64>', 'double[]': 'Vec<f64>', 'bool[]': 'Vec<bool>', 'string[]': 'Vec<String>', matrix: 'Vec<Vec<i64>>', other: '()' },
  kotlin: { int: 'Int', double: 'Double', bool: 'Boolean', string: 'String', 'int[]': 'List<Int>', 'double[]': 'List<Double>', 'bool[]': 'List<Boolean>', 'string[]': 'List<String>', matrix: 'List<List<Int>>', other: 'Any' },
  swift: { int: 'Int', double: 'Double', bool: 'Bool', string: 'String', 'int[]': '[Int]', 'double[]': '[Double]', 'bool[]': '[Bool]', 'string[]': '[String]', matrix: '[[Int]]', other: 'Any' },
};
const ty = (lang, kind) => T[lang][kind] || T[lang].other;

const names = (q) => {
  const fn = q.config?.fn || {};
  return { js: fn.js || fn.py || 'solution', py: fn.py || fn.js || 'solution' };
};

// ---- starters: a plain function skeleton with the right signature + TODO (no return/loops: those are what we look for) ----
const syntaxStarter = {
  c: (q) => { const s = inferSignature(q); const f = names(q).py; const ps = s.params.flatMap((p) => (/\[\]|matrix/.test(p.kind) ? [`${ty('c', p.kind)}${p.name}`, `int ${p.name}_len`] : [`${ty('c', p.kind)} ${p.name}`])).join(', ').replace(/\* (\w)/g, '*$1'); return `#include <stdio.h>\n#include <stdlib.h>\n\n${ty('c', s.result)} ${f}(${ps}) {\n    // TODO: write your solution here\n}\n`; },
  cpp: (q) => { const s = inferSignature(q); return `#include <bits/stdc++.h>\nusing namespace std;\n\n${ty('cpp', s.result)} ${names(q).js}(${s.params.map((p) => `${ty('cpp', p.kind)} ${p.name}`).join(', ')}) {\n    // TODO: write your solution here\n}\n`; },
  java: (q) => { const s = inferSignature(q); return `import java.util.*;\n\npublic class Solution {\n    public static ${ty('java', s.result)} ${names(q).js}(${s.params.map((p) => `${ty('java', p.kind)} ${p.name}`).join(', ')}) {\n        // TODO: write your solution here\n    }\n}\n`; },
  csharp: (q) => { const s = inferSignature(q); return `using System;\nusing System.Collections.Generic;\nusing System.Linq;\n\npublic class Solution\n{\n    public static ${ty('csharp', s.result)} ${names(q).js}(${s.params.map((p) => `${ty('csharp', p.kind)} ${p.name}`).join(', ')})\n    {\n        // TODO: write your solution here\n    }\n}\n`; },
  go: (q) => { const s = inferSignature(q); return `package main\n\nfunc ${names(q).js}(${s.params.map((p) => `${p.name} ${ty('go', p.kind)}`).join(', ')}) ${ty('go', s.result)} {\n\t// TODO: write your solution here\n}\n`; },
  rust: (q) => { const s = inferSignature(q); return `fn ${names(q).py}(${s.params.map((p) => `${p.name}: ${ty('rust', p.kind)}`).join(', ')}) -> ${ty('rust', s.result)} {\n    // TODO: write your solution here\n}\n`; },
  ruby: (q) => { const s = inferSignature(q); return `def ${names(q).py}(${s.params.map((p) => p.name).join(', ')})\n  # TODO: write your solution here\nend\n`; },
  php: (q) => { const s = inferSignature(q); return `<?php\n\nfunction ${names(q).js}(${s.params.map((p) => `$${p.name}`).join(', ')}) {\n    // TODO: write your solution here\n}\n`; },
  kotlin: (q) => { const s = inferSignature(q); return `fun ${names(q).js}(${s.params.map((p) => `${p.name}: ${ty('kotlin', p.kind)}`).join(', ')}): ${ty('kotlin', s.result)} {\n    // TODO: write your solution here\n}\n`; },
  swift: (q) => { const s = inferSignature(q); return `func ${names(q).js}(${s.params.map((p) => `_ ${p.name}: ${ty('swift', p.kind)}`).join(', ')}) -> ${ty('swift', s.result)} {\n    // TODO: write your solution here\n}\n`; },
  bash: (q) => `${names(q).py}() {\n    : # TODO: read the arguments ($1, $2, ...) and echo the result\n}\n`,
};

export const LANGUAGES = [
  { id: 'python', label: 'Python', monaco: 'python', kind: 'exec', starter: (q) => { const s = inferSignature(q); return `def ${names(q).py}(${s.params.map((p) => p.name).join(', ')}):\n    # write your code\n    pass\n`; } },
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', kind: 'exec', starter: (q) => `function ${names(q).js}(${inferSignature(q).params.map((p) => p.name).join(', ')}) {\n  // write your code\n}\n` },
  { id: 'typescript', label: 'TypeScript', monaco: 'typescript', kind: 'exec', starter: (q) => { const s = inferSignature(q); return `function ${names(q).js}(${s.params.map((p) => `${p.name}: any`).join(', ')}): any {\n  // write your code\n}\n`; } },
  { id: 'c', label: 'C', monaco: 'c', kind: 'syntax', starter: syntaxStarter.c },
  { id: 'cpp', label: 'C++', monaco: 'cpp', kind: 'syntax', starter: syntaxStarter.cpp },
  { id: 'java', label: 'Java', monaco: 'java', kind: 'syntax', starter: syntaxStarter.java },
  { id: 'csharp', label: 'C#', monaco: 'csharp', kind: 'syntax', starter: syntaxStarter.csharp },
  { id: 'go', label: 'Go', monaco: 'go', kind: 'syntax', starter: syntaxStarter.go },
  { id: 'rust', label: 'Rust', monaco: 'rust', kind: 'syntax', starter: syntaxStarter.rust },
  { id: 'ruby', label: 'Ruby', monaco: 'ruby', kind: 'syntax', starter: syntaxStarter.ruby },
  { id: 'php', label: 'PHP', monaco: 'php', kind: 'syntax', starter: syntaxStarter.php },
  { id: 'kotlin', label: 'Kotlin', monaco: 'kotlin', kind: 'syntax', starter: syntaxStarter.kotlin },
  { id: 'swift', label: 'Swift', monaco: 'swift', kind: 'syntax', starter: syntaxStarter.swift },
  { id: 'bash', label: 'Bash', monaco: 'shell', kind: 'syntax', starter: syntaxStarter.bash },
];

const BY_ID = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]));
export const getLanguage = (id) => BY_ID[id] || BY_ID.python;
export const languageKind = (id) => (BY_ID[id] ? BY_ID[id].kind : 'exec');
export const isSyntaxLang = (id) => languageKind(id) === 'syntax';
export const starterFor = (id, question) => getLanguage(id).starter(question);
/** Languages that get live red-squiggle linting from tree-sitter (JS/TS keep Monaco's own diagnostics). */
export const lintLanguage = (id) => (isSyntaxLang(id) || id === 'python' ? id : null);

/** One flat list for the language dropdown (Python, JavaScript, TypeScript first, then the rest). No grouping or labels. */
export const LANGUAGE_LIST = LANGUAGES;
