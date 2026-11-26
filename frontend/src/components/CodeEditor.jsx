import { useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';

const THEME = 'hpai-dark';

function defineTheme(monaco) {
  monaco.editor.defineTheme(THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', foreground: 'dffff2', background: '0a2333' },
      { token: 'comment', foreground: '5f8aa3', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c792ea' },
      { token: 'keyword.sql', foreground: 'c792ea' },
      { token: 'operator', foreground: '89ddff' },
      { token: 'operator.sql', foreground: '89ddff' },
      { token: 'delimiter', foreground: '89ddff' },
      { token: 'string', foreground: 'a5e075' },
      { token: 'string.sql', foreground: 'a5e075' },
      { token: 'number', foreground: 'f78c6c' },
      { token: 'type', foreground: 'ffcb6b' },
      { token: 'type.identifier', foreground: 'ffcb6b' },
      { token: 'predefined.sql', foreground: '82aaff' },
      { token: 'tag', foreground: 'ff7b9c' },
      { token: 'attribute.name', foreground: 'ffcb6b' },
      { token: 'attribute.value', foreground: 'a5e075' },
      { token: 'string.key.json', foreground: '82aaff' },
    ],
    colors: {
      'editor.background': '#0a2333',
      'editor.foreground': '#dffff2',
      'editorCursor.foreground': '#55dfa1',
      'editor.selectionBackground': '#1f5a7a',
      'editor.lineHighlightBackground': '#0f2e42',
      'editorLineNumber.foreground': '#4d7389',
      'editorLineNumber.activeForeground': '#a2cfe2',
      'editorIndentGuide.background1': '#16384d',
      'editorIndentGuide.activeBackground1': '#2a5a75',
      'editorBracketMatch.background': '#1f5a7a66',
      'editorBracketMatch.border': '#55dfa1',
      'editorWidget.background': '#0d293b',
    },
  });
  try {
    // keep syntax squiggles, drop type-checker noise (TS types are stripped, not checked)
    const opts = { noSemanticValidation: true, noSyntaxValidation: false };
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions(opts);
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions(opts);
  } catch { /* language service not available */ }
}

const TAB2 = new Set(['javascript', 'html', 'css', 'json', 'typescript', 'ruby', 'shell']);
const LINT_DEBOUNCE_MS = 600;

/**
 * Monaco wrapper. Falls back to a plain textarea if Monaco cannot load (offline CDN).
 * `lint`: optional language id (e.g. 'java') -> live tree-sitter syntax errors shown as red squiggles (debounced).
 */
export default function CodeEditor({ language = 'python', value, onChange, height = 360, readOnly = false, path, lint = null }) {
  const [fallback, setFallback] = useState(false);
  const [instance, setInstance] = useState(null); // { editor, monaco }
  const mounted = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => { if (!mounted.current) setFallback(true); }, 15000);
    return () => clearTimeout(t);
  }, []);

  // live syntax markers (tree-sitter loads lazily, only when a lint language is active)
  useEffect(() => {
    if (!instance) return undefined;
    const { editor, monaco } = instance;
    const model = editor.getModel();
    if (!model) return undefined;
    if (!lint) { monaco.editor.setModelMarkers(model, 'hpai-syntax', []); return undefined; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { lintCode } = await import('../runners/syntaxCheck.js');
        const errors = await lintCode(lint, value);
        if (cancelled || model.isDisposed() || model.getValue() !== value) return;
        monaco.editor.setModelMarkers(model, 'hpai-syntax', errors.map((e) => ({
          severity: monaco.MarkerSeverity.Error,
          message: e.message,
          startLineNumber: e.line, startColumn: e.col, endLineNumber: e.endLine, endColumn: Math.max(e.endCol, e.col + 1),
        })));
      } catch { /* linting is best-effort */ }
    }, LINT_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [instance, lint, value, path]);

  if (fallback) {
    return (
      <textarea
        className="tr-fallback-editor"
        style={{ height }}
        value={value}
        spellCheck={false}
        readOnly={readOnly}
        onChange={(e) => onChange && onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const el = e.target; const s = el.selectionStart;
            el.setRangeText('    ', s, el.selectionEnd, 'end');
            onChange && onChange(el.value);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            const el = e.target; const s = el.selectionStart;
            const before = el.value.slice(0, s);
            const line = before.slice(before.lastIndexOf('\n') + 1);
            const indent = (line.match(/^[ \t]*/) || [''])[0] + (/[:{(\[]\s*$/.test(line) ? '    ' : '');
            el.setRangeText('\n' + indent, s, el.selectionEnd, 'end');
            onChange && onChange(el.value);
          }
        }}
      />
    );
  }

  const tab = TAB2.has(language) ? 2 : 4;
  return (
    <Editor
      height={height}
      language={language}
      path={path}
      value={value}
      theme={THEME}
      beforeMount={defineTheme}
      onMount={(editor, monaco) => { mounted.current = true; setInstance({ editor, monaco }); }}
      onChange={(v) => onChange && onChange(v ?? '')}
      loading={<div className="tr-editor-loading">Loading editor…</div>}
      options={{
        readOnly,
        automaticLayout: true,
        minimap: { enabled: false },
        tabSize: tab,
        insertSpaces: true,
        detectIndentation: false,
        formatOnType: true,
        formatOnPaste: true,
        autoIndent: 'full',
        bracketPairColorization: { enabled: true },
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoSurround: 'languageDefined',
        wordWrap: 'on',
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 13.5,
        lineHeight: 22,
        padding: { top: 12, bottom: 12 },
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        guides: { indentation: true, bracketPairs: true },
        // Assessment fairness: no autocomplete popups / hints.
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        wordBasedSuggestions: 'off',
        parameterHints: { enabled: false },
        acceptSuggestionOnEnter: 'off',
        tabCompletion: 'off',
        snippetSuggestions: 'none',
        hover: { enabled: false },
        lightbulb: { enabled: 'off' },
      }}
    />
  );
}
