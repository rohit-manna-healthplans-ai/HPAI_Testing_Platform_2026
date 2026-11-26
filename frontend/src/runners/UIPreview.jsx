import { useEffect, useMemo, useState } from 'react';
import CodeEditor from '../components/CodeEditor.jsx';
import { buildSrcDoc } from './ui.js';

const langOf = (name) => (/\.css$/i.test(name) ? 'css' : /\.js$/i.test(name) ? 'javascript' : 'html');

/** Quick-Dev question surface: file tabs + editor on top, live sandboxed preview below. */
export default function UIQuestion({ question, files, onChange, qid }) {
  const names = useMemo(() => {
    const ed = question.config?.editable;
    return ed && ed.length ? ed : Object.keys(question.config?.files || {});
  }, [question]);
  const [tab, setTab] = useState(names[0]);
  const [debounced, setDebounced] = useState(files);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => { setTab(names[0]); }, [qid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => setDebounced(files), 400);
    return () => clearTimeout(t);
  }, [files]);

  const srcDoc = useMemo(() => buildSrcDoc(debounced || {}), [debounced]);
  const active = names.includes(tab) ? tab : names[0];

  return (
    <div className="tr-ui">
      <div className="tr-filetabs">
        {names.map((n) => (
          <button key={n} type="button" className={`tr-filetab ${n === active ? 'on' : ''}`} onClick={() => setTab(n)}>{n}</button>
        ))}
        <button
          type="button"
          className="tr-filetab reset"
          onBlur={() => setConfirmReset(false)}
          onClick={() => { // inline two-step confirm (window.confirm can blur the page and count as leaving it)
            if (!confirmReset) { setConfirmReset(true); return; }
            setConfirmReset(false);
            onChange({ ...question.config.files });
          }}
        >{confirmReset ? 'Click again to reset' : 'Reset'}</button>
      </div>
      <CodeEditor
        key={`${qid}:${active}`}
        path={`${qid}/${active}`}
        language={langOf(active)}
        height={280}
        value={files[active] ?? ''}
        onChange={(v) => onChange({ ...files, [active]: v })}
      />
      <div className="tr-preview-head"><span className="tr-dot" /> Live preview</div>
      <iframe className="tr-preview" title="Live preview" sandbox="allow-scripts" srcDoc={srcDoc} />
    </div>
  );
}
