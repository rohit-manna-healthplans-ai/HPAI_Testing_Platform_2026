import { lazy, Suspense } from 'react';
import { api } from '../api.js';
import { ATTEMPT_STATUS, fmtDate, fmtDuration, num, pct } from '../utils/format.js';
import { Badge, ErrorBox, Modal, ProgressBar, Spinner, useAsync } from './ui.jsx';
import { isInteractiveType } from './interactive/meta.js';
import './invites.css';

// Drag & drop answers (sequence / match / architecture) render through a small lazy chunk.
const ReviewResponse = lazy(() => import('./interactive/ReviewResponse.jsx'));

const KEYWORDS = new Set(('def return if else elif for while in not and or is None True False class import from as pass break continue lambda try except finally with yield ' +
  'function const let var new this typeof null undefined true false async await of switch case default throw ' +
  'select from where group by order having join left right inner outer on as insert into values update delete create table limit distinct count sum avg min max like between union ' +
  'int string boolean void static public private protected vector auto char double float long short struct enum fn mut func package namespace using include template typename final extends implements interface ' +
  'fun val when object end then do elsif unless puts require echo function library print println printf cout cin null nil NULL range').split(' '));

/** Tiny dependency-free highlighter -> React nodes (no innerHTML). */
export function highlight(code) {
  const out = [];
  const re = /(#[^\n]*|\/\/[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [tok, comment, str, number, word] = m;
    if (comment) out.push(<span key={i++} className="tok-c">{tok}</span>);
    else if (str) out.push(<span key={i++} className="tok-s">{tok}</span>);
    else if (number) out.push(<span key={i++} className="tok-n">{tok}</span>);
    else if (word && KEYWORDS.has(word.toLowerCase())) out.push(<span key={i++} className="tok-k">{tok}</span>);
    else out.push(tok);
    last = m.index + tok.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

// Complexity analysis (reviewer tool) is loaded on demand so the dashboards stay light.
const ComplexityPanel = lazy(() => import('./ComplexityPanel.jsx'));

const LANG_LABELS = {
  python: 'Python', javascript: 'JavaScript', typescript: 'TypeScript', c: 'C', cpp: 'C++', 'c++': 'C++', java: 'Java', csharp: 'C#', 'c#': 'C#',
  go: 'Go', rust: 'Rust', ruby: 'Ruby', php: 'PHP', kotlin: 'Kotlin', swift: 'Swift', r: 'R', bash: 'Bash',
};
const langLabel = (l) => LANG_LABELS[String(l || '').toLowerCase()] || l;

function responseCode(r) {
  if (!r) return null;
  if (r.files) return Object.entries(r.files).map(([n, c]) => `/* ── ${n} ── */\n${c}`).join('\n\n');
  if (r.selected) return `Selected option(s): ${r.selected.map((i) => i + 1).join(', ') || 'none'}`;
  return r.code ?? null;
}

export default function AttemptReview({ attemptId, onClose }) {
  const { loading, data: d, error, reload } = useAsync(() => (attemptId ? api.proctor.attempt(attemptId) : Promise.resolve(null)), [attemptId]);
  const a = d?.attempt;
  const st = a ? (ATTEMPT_STATUS[a.status] || { label: a.status, tone: 'gray' }) : null;

  return (
    <Modal open={!!attemptId} drawer title={d?.candidate?.name ? `Review — ${d.candidate.name}` : 'Attempt review'} onClose={onClose}>
      {loading && <Spinner />}
      <ErrorBox error={error} onRetry={reload} />
      {d && a && (
        <div className="stack">
          <dl className="kv">
            <dt>Candidate</dt><dd>{d.candidate?.name} <span className="muted">({d.candidate?.email})</span></dd>
            {a.tester_id && (<><dt>Tester ID</dt><dd><span className="tester-chip">{a.tester_id}</span></dd></>)}
            <dt>Session</dt><dd>{d.session?.name || a.session_name || '—'}</dd>
            <dt>Proctor</dt><dd>{d.proctor?.name || a.proctor_name || '—'}</dd>
            <dt>Status</dt><dd><Badge tone={st.tone}>{st.label}</Badge></dd>
            <dt>Started</dt><dd>{fmtDate(a.started_at)}</dd>
            <dt>Submitted</dt><dd>{fmtDate(a.submitted_at)}</dd>
            <dt>Time taken</dt><dd>{a.submitted_at ? fmtDuration((new Date(a.submitted_at) - new Date(a.started_at)) / 1000) : '—'}</dd>
            <dt>Score</dt><dd><b>{num(a.total_score)}</b> / {num(a.max_score)} ({pct(a.total_score, a.max_score)}%)</dd>
            <dt>Flags</dt><dd className={a.flag_count ? 'flag-high' : 'flag-0'}>{a.flag_count}</dd>
          </dl>

          <h4>Answers</h4>
          {(d.answers || []).length === 0 && <p className="muted small">No answers saved yet.</p>}
          {(d.answers || []).map((ans) => {
            const code = responseCode(ans.response);
            return (
              <div key={ans.question_id} className="card" style={{ boxShadow: 'none' }}>
                <div className="card-head">
                  <div className="row"><strong>{ans.title}</strong><Badge>{ans.type}</Badge><Badge tone={ans.difficulty}>{ans.difficulty}</Badge>{ans.response?.language && <Badge tone="blue">{langLabel(ans.response.language)}</Badge>}{ans.response?.mode === 'syntax_only' && <Badge>Syntax-validated language</Badge>}</div>
                  <div><b>{num(ans.score)}</b><span className="muted"> / {num(ans.max_score)}</span> <span className="muted small">· {isInteractiveType(ans.type) ? 'correct' : 'tests'} {ans.tests_passed}/{ans.tests_total}</span></div>
                </div>
                <div className="card-body stack">
                  <ProgressBar value={ans.score} max={ans.max_score} tone={pct(ans.score, ans.max_score) >= 60 ? 'green' : pct(ans.score, ans.max_score) >= 30 ? 'amber' : 'red'} />
                  {isInteractiveType(ans.type)
                    ? <Suspense fallback={<span className="muted small">Loading…</span>}><ReviewResponse questionId={ans.question_id} response={ans.response} /></Suspense>
                    : code ? <pre className="pre">{highlight(code)}</pre> : <span className="muted small">No response.</span>}
                  {ans.type === 'coding' && ans.response?.code && (
                    <Suspense fallback={<span className="muted small">Loading complexity tools…</span>}>
                      <ComplexityPanel attemptId={attemptId} answer={ans} />
                    </Suspense>
                  )}
                  {ans.time_spent_sec != null && <span className="muted small">Time on question: {fmtDuration(ans.time_spent_sec)}</span>}
                </div>
              </div>
            );
          })}

          <h4>Proctoring events</h4>
          {(d.events || []).length === 0 ? <p className="muted small">No events recorded.</p> : (
            <ul className="timeline">
              {d.events.map((e, i) => (
                <li key={e.id || i} className={['screen_leave', 'screenshot_attempt', 'tab_hidden', 'window_blur', 'fullscreen_exit', 'paste', 'devtools', 'terminated'].includes(e.type) ? 'flag' : ''}>
                  <span className="muted mono">{fmtDate(e.at)}</span><b>{e.type.replace(/_/g, ' ')}</b>
                  {e.meta && Object.keys(e.meta).length > 0 && <span className="muted small">{JSON.stringify(e.meta)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
