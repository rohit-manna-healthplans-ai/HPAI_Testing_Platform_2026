import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { loadBank, unsealAll } from '../bank/index.js';
import DataTable from './DataTable.jsx';
import { Badge, Button, Card, ErrorBox, Field, Modal, Spinner, useAsync, useToast } from './ui.jsx';

const TYPES = ['coding', 'sql', 'nosql', 'ui', 'mcq'];
const DIFFS = ['easy', 'medium', 'hard'];
const pretty = (v) => JSON.stringify(v, null, 2);
const REVEAL_MS = 10 * 60 * 1000;

/** Preview of one question. `full` (unsealed, admin-only) is optional; without it only public fields are shown. */
export function QuestionPreview({ q, full }) {
  const revealed = !!full;
  const src = full || q;
  const visibleTests = q.public_tests || [];
  const hiddenCount = Math.max(0, (q.test_count || 0) - visibleTests.length);
  return (
    <div className="stack">
      <div className="row">
        <Badge tone="blue">{q.subject_name}</Badge><Badge tone={q.difficulty}>{q.difficulty}</Badge><Badge>{q.type}</Badge>
        <span className="muted small">{q.marks} marks · {q.time_mins} min{q.type === 'mcq' ? '' : ` · ${q.test_count || 0} tests (${hiddenCount} hidden)`} · id <code>{q.id}</code></span>
      </div>
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{q.statement}</p>
      {q.config?.scenario && <div className="alert alert-info" style={{ whiteSpace: 'pre-wrap' }}>{q.config.scenario}</div>}
      {q.config?.options && (
        <ol>{q.config.options.map((o, i) => {
          const ok = revealed && src.config?.correct?.includes(i);
          return <li key={i} style={{ fontWeight: ok ? 800 : 400, color: ok ? '#14754a' : undefined }}>{o}{ok ? ' ✓ correct' : ''}</li>;
        })}</ol>
      )}
      {q.config?.constraints?.length > 0 && (
        <div><strong className="small">Constraints</strong><ul className="rules">{q.config.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
      )}
      {q.config?.examples?.length > 0 && (
        <div><strong className="small">Examples</strong>
          {q.config.examples.map((e, i) => <pre className="pre" key={i}>{`Input:  ${e.input}\nOutput: ${e.output}${e.explanation ? `\n${e.explanation}` : ''}`}</pre>)}
        </div>
      )}
      {q.type !== 'mcq' && (
        <details open={!revealed}><summary className="small" style={{ cursor: 'pointer', fontWeight: 800 }}>
          {revealed ? 'All tests incl. hidden (revealed)' : 'Sample tests shown to candidates'}</summary>
          <pre className="pre">{pretty(revealed ? src.tests : visibleTests)}</pre>
          {!revealed && hiddenCount > 0 && <p className="muted small">{hiddenCount} hidden test(s) are not shown.</p>}
        </details>
      )}
      {revealed && <div className="alert alert-warn small">Answers revealed. Do not share this screen.</div>}
    </div>
  );
}

/**
 * Read-only question bank.
 *  - admin: can click "Reveal answers" and enter their admin password (the code); the API then releases the keys that unseal
 *    the hidden tests / MCQ answers, which are held in memory only for 10 minutes.
 *  - proctor: only the subjects assigned to them, public fields only, never any reveal control.
 */
export default function QuestionBankView({ admin = false }) {
  const toast = useToast();
  const bank = useAsync(() => loadBank(), []);
  const subjects = useAsync(() => (admin ? Promise.resolve(null) : api.subjects()), [admin]);
  const [flt, setFlt] = useState({ subject_id: '', type: '', difficulty: '' });
  const [preview, setPreview] = useState(null);
  const [revealed, setRevealed] = useState(null); // Map(id -> full question) | null
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [codeErr, setCodeErr] = useState('');
  const timer = useRef(null);

  const hide = useCallback(() => { clearTimeout(timer.current); setRevealed(null); }, []);
  useEffect(() => () => clearTimeout(timer.current), []); // clear on navigation

  const reveal = async (e) => {
    e?.preventDefault();
    setBusy(true); setCodeErr('');
    try {
      const { keys } = await api.admin.bankKeys(code);
      const map = await unsealAll(keys);
      setRevealed(map); setCodeOpen(false); setCode('');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => { setRevealed(null); toast('Answers hidden again (10 minutes elapsed)', 'info'); }, REVEAL_MS);
    } catch (err) { setCodeErr(err.message || 'Could not reveal answers'); } finally { setBusy(false); }
  };

  const allowed = useMemo(() => (admin ? null : new Set((subjects.data || []).map((s) => s.id))), [admin, subjects.data]);
  const subs = (bank.data?.SUBJECTS || []).filter((s) => !allowed || allowed.has(s.id));
  const all = useMemo(() => (bank.data?.QUESTIONS || []).filter((q) => !allowed || allowed.has(q.subject_id)), [bank.data, allowed]);
  const rows = useMemo(() => all.filter((q) =>
    (!flt.subject_id || q.subject_id === flt.subject_id) && (!flt.type || q.type === flt.type) && (!flt.difficulty || q.difficulty === flt.difficulty)), [all, flt]);

  const cols = [
    { key: 'title', label: 'Question', render: (q) => <div className="name-cell"><strong>{q.title}</strong><span>{q.subject_name}</span></div> },
    { key: 'type', label: 'Type', render: (q) => <Badge>{q.type}</Badge> },
    { key: 'difficulty', label: 'Level', sortValue: (q) => DIFFS.indexOf(q.difficulty), render: (q) => <Badge tone={q.difficulty}>{q.difficulty}</Badge> },
    { key: 'marks', label: 'Marks' },
    { key: 'time_mins', label: 'Time', render: (q) => `${q.time_mins} min` },
    { key: 'test_count', label: 'Tests', render: (q) => (q.type === 'mcq' ? '—' : q.test_count || 0) },
    { key: 'actions', label: '', sortable: false, className: 'right', render: (q) => (
      <div className="cell-actions" onClick={(e) => e.stopPropagation()}><Button size="sm" variant="ghost" onClick={() => setPreview(q)}>Preview</Button></div>) },
  ];

  const loading = (bank.loading && !bank.data) || (!admin && subjects.loading && !subjects.data);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Question bank</h1>
          <p>{rows.length} of {all.length} question(s) shown{admin && bank.data?.BANK_VERSION ? ` · bank version ${bank.data.BANK_VERSION}` : ''}. Score = marks × tests passed ÷ total tests.</p>
        </div>
        {admin && (revealed
          ? <Button variant="ghost" onClick={hide}>Hide answers</Button>
          : <Button onClick={() => { setCode(''); setCodeErr(''); setCodeOpen(true); }}>Reveal answers</Button>)}
      </div>
      {admin ? (
        <div className={`alert ${revealed ? 'alert-warn' : 'alert-info'}`} role="note" style={{ marginBottom: 14 }}>
          {revealed
            ? <>Answers revealed — hidden tests and MCQ answers are visible below. They hide automatically after 10 minutes.</>
            : <>Answers (hidden tests, MCQ correct options) are sealed. Click <b>Reveal answers</b> and enter your admin password to open them. Questions live in <code>question-bank/</code>; run <code>npm run build-bank</code> after editing.</>}
        </div>
      ) : (
        <div className="alert alert-info" role="note" style={{ marginBottom: 14 }}>
          Showing the questions for your assigned subjects. Answers and hidden tests are not shown to proctors.
        </div>
      )}
      <Card pad={false}>
        <ErrorBox error={bank.error || subjects.error} onRetry={() => { bank.reload(); subjects.reload?.(); }} />
        {loading ? <Spinner /> : bank.data && (
          <DataTable columns={cols} rows={rows} searchKeys={['title', 'subject_name', 'type', 'id']} onRowClick={setPreview}
            empty={{ title: 'No questions match', hint: admin ? 'Adjust the filters.' : 'Adjust the filters, or ask the admin to assign subjects to you.' }}
            toolbar={<div className="filters">
              <select className="input" value={flt.subject_id} onChange={(e) => setFlt({ ...flt, subject_id: e.target.value })} aria-label="Subject"><option value="">All subjects</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select className="input" value={flt.type} onChange={(e) => setFlt({ ...flt, type: e.target.value })} aria-label="Type"><option value="">All types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
              <select className="input" value={flt.difficulty} onChange={(e) => setFlt({ ...flt, difficulty: e.target.value })} aria-label="Difficulty"><option value="">All levels</option>{DIFFS.map((t) => <option key={t}>{t}</option>)}</select>
            </div>} />
        )}
      </Card>

      <Modal open={!!preview} wide title={preview?.title || ''} onClose={() => setPreview(null)}>
        {preview && <QuestionPreview q={preview} full={admin ? revealed?.get(preview.id) : null} />}
      </Modal>

      {admin && (
        <Modal open={codeOpen} title="Reveal answers" onClose={() => !busy && setCodeOpen(false)}
          footer={<><Button variant="ghost" onClick={() => setCodeOpen(false)} disabled={busy}>Cancel</Button><Button onClick={reveal} loading={busy} disabled={!code}>Reveal</Button></>}>
          <form className="stack" onSubmit={reveal}>
            <p className="muted">Enter your admin password (code) to reveal answers. Every attempt is recorded in the audit log.</p>
            <Field label="Admin password (code)" error={codeErr}>
              <input className="input" type="password" autoComplete="current-password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}
