import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, Field, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import PaperReview from '../../components/PaperReview.jsx';
import { loadBank } from '../../bank/index.js'; // public fields only — answers are sealed and no key is ever released to a proctor
import {
  LEVELS, MAX_QUESTIONS, availability, bucketize, countsSignature, estimateFromCounts, generatePaper, paperTotals, sortPaper, suggestDuration, toSubjectConfig,
} from './wizardUtils.js';
import './wizard.css';

const LABELS = { basics: 'Basics', subjects: 'Subjects', review: 'Review paper', time: 'Time', summary: 'Summary' };
const BAR_COLORS = ['#1f6688', '#0bd37a', '#e0a21b', '#8a6fd1', '#d9576c'];

export default function NewSession() {
  const nav = useNavigate();
  const toast = useToast();
  const subjectsQ = useAsync(() => api.subjects(), []);
  const candQ = useAsync(() => api.proctor.candidates(), []);

  const [stepKey, setStepKey] = useState('basics');
  const [paperType, setPaperType] = useState('same'); // same = one reviewed paper for everyone | random = different random set per candidate
  const [name, setName] = useState('');
  const [opens, setOpens] = useState('');
  const [closes, setCloses] = useState('');
  const [chosen, setChosen] = useState([]);
  const [q, setQ] = useState('');
  const [counts, setCounts] = useState({}); // subject_id -> {easy,medium,hard}
  const [paper, setPaper] = useState([]); // ordered question ids (same-paper flow)
  const [locked, setLocked] = useState(() => new Set()); // "Keep" ticks
  const [paperSig, setPaperSig] = useState('');
  const [edited, setEdited] = useState(false);
  const [duration, setDuration] = useState('');
  const [durationTouched, setDurationTouched] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const headRef = useRef(null);

  const subjects = subjectsQ.data || [];
  const subjectOrder = useMemo(() => subjects.map((s) => s.id), [subjects]);
  const candidates = (candQ.data || []).filter((c) => c.active !== false);
  const shown = candidates.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  const allShown = shown.length > 0 && shown.every((c) => chosen.includes(c.id));
  const toggleCand = (id) => setChosen((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // The bank chunk is fetched only once the proctor reaches the Subjects step.
  const needBank = stepKey !== 'basics';
  const bankQ = useAsync(() => (needBank ? loadBank() : Promise.resolve(null)), [needBank]);
  const allowedIds = useMemo(() => new Set(subjectOrder), [subjectOrder]);
  const bankList = useMemo(() => (bankQ.data?.QUESTIONS || []).filter((x) => allowedIds.has(x.subject_id)), [bankQ.data, allowedIds]);
  const byId = useMemo(() => new Map(bankList.map((x) => [x.id, x])), [bankList]);
  const buckets = useMemo(() => bucketize(bankList), [bankList]);

  const flow = paperType === 'same' ? ['basics', 'subjects', 'review', 'time', 'summary'] : ['basics', 'subjects', 'time', 'summary'];
  const idx = flow.indexOf(stepKey);
  const go = (key) => { setErr(''); setStepKey(key); };

  useEffect(() => { headRef.current?.focus({ preventScroll: true }); window.scrollTo?.({ top: 0, behavior: 'smooth' }); }, [stepKey]);

  const setCount = (sid, lvl, v) => {
    const max = bankQ.data ? availability(buckets, sid, lvl) : 20;
    setCounts((m) => ({ ...m, [sid]: { easy: 0, medium: 0, hard: 0, ...m[sid], [lvl]: Math.max(0, Math.min(max, Math.floor(Number(v) || 0))) } }));
  };
  const countTotal = useMemo(() => toSubjectConfig(counts, subjectOrder).reduce((a, s) => a + s.easy + s.medium + s.hard, 0), [counts, subjectOrder]);
  const est = useMemo(() => estimateFromCounts(counts, bankList, subjectOrder), [counts, bankList, subjectOrder]);

  const editPaper = useCallback((u) => { setPaper(u); setEdited(true); }, []);
  const orderedPaper = useMemo(() => sortPaper(paper, byId, subjectOrder), [paper, byId, subjectOrder]);
  const pTotals = useMemo(() => paperTotals(paper, byId), [paper, byId]);
  const same = paperType === 'same';
  const totals = same ? pTotals : est;
  const suggested = suggestDuration(totals.mins);
  const effDuration = durationTouched && duration !== '' ? Number(duration) : suggested;

  const doGenerate = () => {
    const ids = generatePaper(counts, bankList, subjectOrder);
    if (!ids.length) { setErr('No questions could be drawn for those counts.'); return; }
    setPaper(ids); setLocked(new Set()); setPaperSig(countsSignature(counts, subjectOrder)); setEdited(false);
    go('review');
  };

  const validate = (key) => {
    if (key === 'basics') {
      if (!name.trim()) return 'Give the session a name.';
      if (opens && closes && new Date(closes) <= new Date(opens)) return 'Close time must be after the open time.';
    }
    if (key === 'subjects') {
      if (!subjects.length) return 'You have no subjects assigned. Ask an admin to assign subjects to your account.';
      if (countTotal < 1) return 'Choose how many questions you want from at least one subject.';
      if (countTotal > MAX_QUESTIONS) return `A session can have at most ${MAX_QUESTIONS} questions.`;
    }
    if (key === 'review') {
      if (paper.length < 1) return 'The paper is empty — add at least one question.';
      if (paper.length > MAX_QUESTIONS) return `A session can have at most ${MAX_QUESTIONS} questions (you have ${paper.length}).`;
    }
    if (key === 'time') {
      if (!(effDuration >= 5 && effDuration <= 300)) return 'Duration must be between 5 and 300 minutes.';
    }
    return '';
  };

  const next = () => {
    const e = validate(stepKey);
    if (e) { setErr(e); return; }
    setErr('');
    if (stepKey === 'subjects' && same) {
      if (!bankQ.data) { setErr('Questions are still loading — try again in a moment.'); return; }
      if (paper.length && countsSignature(counts, subjectOrder) === paperSig) { go('review'); return; }
      if (paper.length && (edited || locked.size)) { setConfirmRegen(true); return; }
      doGenerate(); return;
    }
    go(flow[idx + 1]);
  };
  const back = () => { setErr(''); go(flow[Math.max(0, idx - 1)]); };

  const create = async () => {
    setErr('');
    for (const k of flow.filter((x) => x !== 'summary')) { const e = validate(k); if (e) { setErr(e); setStepKey(k); return; } }
    const fixed_question_ids = same ? orderedPaper : [];
    const subject_config = same ? [] : toSubjectConfig(counts, subjectOrder);
    setBusy(true);
    try {
      const res = await api.proctor.createSession({
        name: name.trim(), duration_mins: effDuration, subject_config, fixed_question_ids, candidate_ids: chosen,
        opens_at: opens ? new Date(opens).toISOString() : undefined, closes_at: closes ? new Date(closes).toISOString() : undefined,
      });
      toast(chosen.length ? 'Session created' : 'Session created — create invite links from its page to let candidates in', 'success');
      const id = res?.id || res?.session?.id;
      nav(id ? `/proctor/sessions/${id}` : '/proctor/sessions');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const onSubmit = (e) => { e.preventDefault(); if (stepKey === 'summary') create(); else next(); };

  if (subjectsQ.loading || candQ.loading) return <Spinner />;
  const bankLoading = needBank && bankQ.loading && !bankQ.data;
  const sumMins = totals.mins;
  const perSubject = same ? subjects.map((s) => ({ s, ...paperTotals(paper.filter((id) => byId.get(id)?.subject_id === s.id), byId) })).filter((x) => x.questions) : [];

  return (
    <>
      <div className="page-head">
        <div><h1>New session</h1><p>The system proposes a random paper from your subjects — keep the questions you like, change the rest, and the time is worked out from the final paper.</p></div>
        <Link to="/proctor/sessions" className="btn btn-ghost">Cancel</Link>
      </div>
      <ErrorBox error={subjectsQ.error || candQ.error} />

      <ol className="wiz-steps" aria-label="Progress">
        {flow.map((k, i) => (
          <li key={k} className={`wiz-step ${i === idx ? 'active' : ''} ${i < idx ? 'done' : ''}`} aria-current={i === idx ? 'step' : undefined}>
            <button type="button" disabled={i >= idx} onClick={() => i < idx && go(k)} aria-label={`${i < idx ? 'Back to ' : ''}step ${i + 1}: ${LABELS[k]}`}>
              <span className="wiz-dot">{i < idx ? '✓' : i + 1}</span><span className="wiz-label">{LABELS[k]}</span>
            </button>
            {i < flow.length - 1 && <span className={`wiz-line ${i < idx ? 'done' : ''}`} />}
          </li>
        ))}
      </ol>
      <p className="wiz-mobile-title" aria-hidden="true">Step {idx + 1} of {flow.length} · {LABELS[stepKey]}</p>

      <form onSubmit={onSubmit} className="split" noValidate>
        <div className="stack">
          <Card title={<span ref={headRef} tabIndex={-1} style={{ outline: 'none' }}>{`${idx + 1} · ${LABELS[stepKey]}`}</span>}
            subtitle={{
              basics: 'Name the session and (optionally) pick candidates. You can also skip candidates and share one-time invite links afterwards.',
              subjects: 'Choose how many questions you want from each of your subjects, and how the paper is formed.',
              review: 'These are the questions the system picked. Keep what you like, swap or replace the rest.',
              time: 'The duration is worked out from the questions you finalised. Adjust it if you like.',
              summary: 'Check everything, then create the session.',
            }[stepKey]}>

            {stepKey === 'basics' && (
              <div className="stack">
                <div className="form-grid">
                  <Field label="Session name" className="full"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Campus Drive — Batch A" autoFocus maxLength={120} /></Field>
                  <Field label="Opens at (optional)"><input className="input" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></Field>
                  <Field label="Closes at (optional)"><input className="input" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></Field>
                </div>
                <div>
                  <strong>Candidates <span className="muted small">(optional · {chosen.length} selected of {candidates.length})</span></strong>
                  <p className="muted small" style={{ margin: '4px 0 10px' }}>Invite-only sessions are fine: skip this and share one-time invite links from the session page after creating it.</p>
                  {candidates.length === 0 ? <EmptyState title="No candidates yet" hint="No problem — create the session and share one-time invite links, or add candidates first."><Link to="/proctor/candidates" className="btn btn-ghost btn-sm">Go to candidates</Link></EmptyState> : (
                    <div className="stack">
                      <div className="row"><input className="input search grow" type="search" placeholder="Search candidates…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search candidates" />
                        <Button type="button" size="sm" variant="ghost" onClick={() => setChosen((s) => (allShown ? s.filter((id) => !shown.some((c) => c.id === id)) : [...new Set([...s, ...shown.map((c) => c.id)])]))}>{allShown ? 'Clear shown' : 'Select all shown'}</Button></div>
                      <div className="picker">{shown.map((c) => (
                        <label key={c.id}><input type="checkbox" checked={chosen.includes(c.id)} onChange={() => toggleCand(c.id)} /><span className="grow"><b>{c.name}</b><span className="muted small"> · {c.email}</span></span></label>
                      ))}{shown.length === 0 && <p className="muted small" style={{ padding: 14 }}>No matches.</p>}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {stepKey === 'subjects' && (
              subjects.length === 0 ? <EmptyState title="No subjects assigned" hint="Ask an admin to assign subjects to your account." /> : bankLoading ? <Spinner rows={4} /> : bankQ.error ? <ErrorBox error={bankQ.error} onRetry={bankQ.reload} /> : (
                <div className="stack">
                  <div className="wiz-choice" role="group" aria-label="Paper type">
                    <button type="button" className="wiz-opt" aria-pressed={same} onClick={() => setPaperType('same')}>
                      <strong>Same paper for everyone</strong><span>The system proposes random questions per subject; you review them and swap any you don’t like. Everyone gets exactly this paper.</span>
                    </button>
                    <button type="button" className="wiz-opt" aria-pressed={!same} onClick={() => setPaperType('random')}>
                      <strong>Different random set per candidate</strong><span>Each candidate gets their own random questions from the counts below. No review step.</span>
                    </button>
                  </div>
                  <div className="wiz-counts" role="group" aria-label="Question counts per subject">
                    <div className="bucket" style={{ borderBottom: '1px solid var(--line)' }}><span /><span className="bucket-col">Easy</span><span className="bucket-col">Medium</span><span className="bucket-col">Hard</span></div>
                    {subjects.map((s) => (
                      <div className="bucket" key={s.id}>
                        <div><strong>{s.name}</strong><div className="muted small">{s.question_count ?? 0} questions in bank</div></div>
                        {LEVELS.map((l) => {
                          const max = availability(buckets, s.id, l);
                          return (
                            <div key={l} style={{ display: 'grid', gap: 2, justifyItems: 'center' }}>
                              <input className="input input-num" type="number" min="0" max={max} aria-label={`${s.name} ${l} count`} value={counts[s.id]?.[l] ?? 0} onChange={(e) => setCount(s.id, l, e.target.value)} onFocus={(e) => e.target.select()} />
                              <span className="wiz-avail">max {max}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="alert alert-info" role="status">
                    {countTotal ? <><b>{countTotal}</b> question{countTotal === 1 ? '' : 's'} · about <b>{est.marks}</b> marks · about <b>{est.mins}</b> min of work. {same ? 'Press “Generate paper” to see the proposed questions.' : 'Each candidate gets their own random set.'}</> : 'Set at least one count above.'}
                  </div>
                </div>
              )
            )}

            {stepKey === 'review' && (bankLoading ? <Spinner rows={4} /> : (
              <PaperReview subjects={subjects} bankList={bankList} byId={byId} paper={paper} setPaper={editPaper} locked={locked} setLocked={setLocked} subjectOrder={subjectOrder} />
            ))}

            {stepKey === 'time' && (
              <div className="wiz-time">
                <div className="row" style={{ gap: 18 }}>
                  <span><b style={{ fontSize: 20, color: 'var(--navy)' }}>{totals.questions}</b> <span className="muted">questions</span></span>
                  <span><b style={{ fontSize: 20, color: 'var(--navy)' }}>{totals.marks}</b> <span className="muted">marks</span></span>
                  <span><b style={{ fontSize: 20, color: 'var(--navy)' }}>{sumMins}</b> <span className="muted">min of question time{same ? '' : ' (estimate)'}</span></span>
                </div>
                {same && perSubject.length > 0 && (
                  <div className="stack" style={{ gap: 8 }}>
                    <div className="wiz-bar" aria-hidden="true">{perSubject.map((x, i) => <span key={x.s.id} style={{ width: `${(x.mins / Math.max(1, sumMins)) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />)}</div>
                    <table className="wiz-table">
                      <thead><tr><th>Subject</th><th className="num">Questions</th><th className="num">Marks</th><th className="num">Minutes</th></tr></thead>
                      <tbody>{perSubject.map((x, i) => (
                        <tr key={x.s.id}><td><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, marginRight: 8, background: BAR_COLORS[i % BAR_COLORS.length] }} />{x.s.name}</td><td className="num">{x.questions}</td><td className="num">{x.marks}</td><td className="num">{x.mins}</td></tr>
                      ))}</tbody>
                      <tfoot><tr><th>Total</th><th className="num">{totals.questions}</th><th className="num">{totals.marks}</th><th className="num">{sumMins}</th></tr></tfoot>
                    </table>
                  </div>
                )}
                {!same && <div className="alert alert-info">Each candidate gets a different random set, so this is an estimate from the average time of the questions in each bucket.</div>}
                <div className="stack" style={{ gap: 8 }}>
                  <strong>Session duration</strong>
                  <div className="wiz-time-big">
                    <Button type="button" variant="ghost" onClick={() => { setDuration(String(Math.max(5, effDuration - 5))); setDurationTouched(true); }} aria-label="Decrease by 5 minutes">−5</Button>
                    <input className="input" type="number" min="5" max="300" inputMode="numeric" aria-label="Session duration in minutes" value={durationTouched ? duration : String(suggested)}
                      onChange={(e) => { setDuration(e.target.value); setDurationTouched(true); }} />
                    <span className="unit">min</span>
                    <Button type="button" variant="ghost" onClick={() => { setDuration(String(Math.min(300, effDuration + 5))); setDurationTouched(true); }} aria-label="Increase by 5 minutes">+5</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setDurationTouched(false); setDuration(''); }} disabled={!durationTouched}>Use suggested ({suggested})</Button>
                  </div>
                  <span className="muted small">Suggested = question time × 1.2, rounded up to 5 minutes (at least 10): {sumMins} × 1.2 → <b>{suggested} min</b>.</span>
                  {effDuration < sumMins && <div className="alert alert-warn" role="status">This is shorter than the {sumMins} minutes of question time — candidates are unlikely to finish every question.</div>}
                  {effDuration > Math.max(60, sumMins * 3) && <div className="alert alert-info" role="status">That is a lot more than the {sumMins} minutes of question time. Is that intended?</div>}
                </div>
              </div>
            )}

            {stepKey === 'summary' && (
              <div className="stack">
                <dl className="kv">
                  <dt>Session</dt><dd>{name.trim()}</dd>
                  <dt>Paper</dt><dd>{same ? 'Same paper for everyone' : 'Different random set per candidate'}</dd>
                  <dt>Questions</dt><dd>{totals.questions}{!same ? ' per candidate' : ''}</dd>
                  <dt>Total marks</dt><dd>{totals.marks}{!same ? ' (approx.)' : ''}</dd>
                  <dt>Duration</dt><dd><b>{effDuration} min</b></dd>
                  <dt>Candidates</dt><dd>{chosen.length ? `${chosen.length} selected` : 'None yet — create one-time invite links from the session page'}</dd>
                  {(opens || closes) && <><dt>Window</dt><dd>{opens ? new Date(opens).toLocaleString() : 'any time'} → {closes ? new Date(closes).toLocaleString() : 'no end'}</dd></>}
                </dl>
                {same ? (
                  <div>
                    <strong>Paper</strong>
                    <ol className="wiz-list">{orderedPaper.map((id) => { const x = byId.get(id); return x ? <li key={id}>{x.title} <span className="muted small">· {x.subject_name} · {x.difficulty} · {x.marks} marks · {x.time_mins} min</span></li> : null; })}</ol>
                  </div>
                ) : (
                  <div>
                    <strong>Random draw per candidate</strong>
                    <ul className="wiz-list">{toSubjectConfig(counts, subjectOrder).map((c) => <li key={c.subject_id}>{subjects.find((s) => s.id === c.subject_id)?.name}: {c.easy} easy · {c.medium} medium · {c.hard} hard</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {err && <div className="alert alert-error" role="alert" style={{ marginTop: 14 }}>{err}</div>}

            <div className="wiz-nav">
              {idx > 0 ? <Button type="button" variant="ghost" onClick={back}>← Back</Button> : <span />}
              {stepKey === 'summary'
                ? <Button type="submit" variant="success" loading={busy} style={{ minHeight: 46 }}>Create session</Button>
                : <Button type="submit" disabled={bankLoading}>{stepKey === 'subjects' && same ? 'Generate paper →' : 'Next →'}</Button>}
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card title="Summary">
            <dl className="kv">
              <dt>Session</dt><dd>{name.trim() || '—'}</dd>
              <dt>Paper</dt><dd>{same ? 'Same for everyone' : 'Random per candidate'}</dd>
              <dt>Questions</dt><dd>{totals.questions || (countTotal ? countTotal : '—')}</dd>
              <dt>Total marks</dt><dd>{totals.marks || '—'}</dd>
              <dt>Duration</dt><dd>{['time', 'summary'].includes(stepKey) || flow.indexOf(stepKey) > flow.indexOf('time') ? `${effDuration} min` : <span className="muted">set after questions</span>}</dd>
              <dt>Candidates</dt><dd>{chosen.length}</dd>
            </dl>
            {same && locked.size > 0 && <p className="muted small" style={{ marginTop: 10 }}><Badge tone="green">{locked.size} kept</Badge></p>}
          </Card>
        </div>
      </form>

      <ConfirmDialog open={confirmRegen} title="Regenerate the paper?" confirmLabel="Regenerate" danger
        message="You changed the question counts, so a new random paper will be drawn. Your swaps and kept questions will be discarded."
        onCancel={() => setConfirmRegen(false)} onConfirm={() => { setConfirmRegen(false); doGenerate(); }} />
    </>
  );
}
