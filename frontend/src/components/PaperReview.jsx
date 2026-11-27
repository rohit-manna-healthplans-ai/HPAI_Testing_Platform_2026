import { useMemo, useState } from 'react';
import { Badge, Button, EmptyState, Modal, useToast } from './ui.jsx';
import { QuestionPreview } from './QuestionBankView.jsx';
import { unitsLabel } from './interactive/meta.js';
import { LEVELS, availability, bucketize, paperTotals, shuffleUnlocked, sortPaper, swapSame } from '../pages/proctor/wizardUtils.js';

/**
 * Picker used both for "Replace…" and "Add question". Works only with PUBLIC question fields (no answers).
 * subjectId fixed -> only that subject; null -> the proctor can choose among their subjects.
 */
export function QuestionPicker({ open, title, subjects, bankList, excludeIds, subjectId, initialLevel = '', actionLabel = 'Choose', onChoose, onClose }) {
  const [subj, setSubj] = useState(subjectId || '');
  const [level, setLevel] = useState(initialLevel);
  const [text, setText] = useState('');
  const [view, setView] = useState(null); // question being previewed inside the picker
  const effSubject = subjectId || subj;
  const rows = useMemo(() => bankList.filter((q) =>
    !excludeIds.has(q.id) && (!effSubject || q.subject_id === effSubject) && (!level || q.difficulty === level)
    && (!text || `${q.title} ${(q.tags || []).join(' ')} ${q.type}`.toLowerCase().includes(text.toLowerCase()))
  ).sort((a, b) => LEVELS.indexOf(a.difficulty) - LEVELS.indexOf(b.difficulty) || a.title.localeCompare(b.title)), [bankList, excludeIds, effSubject, level, text]);
  if (!open) return null;
  const choose = (q) => { onChoose(q); setView(null); };
  return (
    <Modal open wide title={view ? view.title : title} onClose={() => (view ? setView(null) : onClose())}
      footer={view ? <><Button type="button" variant="ghost" onClick={() => setView(null)}>← Back to list</Button><Button type="button" onClick={() => choose(view)}>{actionLabel} this question</Button></> : <Button type="button" variant="ghost" onClick={onClose}>Close</Button>}>
      {view ? <QuestionPreview q={view} /> : (
        <div className="stack">
          <div className="filters">
            <input className="input search grow" style={{ flex: '1 1 100%', minWidth: 160 }} type="search" placeholder="Search questions…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search questions" />
            {!subjectId && (
              <select className="input" value={subj} onChange={(e) => setSubj(e.target.value)} aria-label="Subject"><option value="">All my subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            )}
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level"><option value="">All levels</option>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
          </div>
          <div className="picker" style={{ maxHeight: 380 }}>
            {rows.map((q) => (
              <div className="pr-pick-row" key={q.id}>
                <span className="grow"><b>{q.title}</b><span className="muted small"> · {q.subject_name} · {q.marks} marks · {q.time_mins} min</span></span>
                <Badge tone={q.difficulty}>{q.difficulty}</Badge><Badge>{q.type}</Badge>
                <Button type="button" size="sm" variant="ghost" onClick={() => setView(q)}>Preview</Button>
                <Button type="button" size="sm" onClick={() => choose(q)}>{actionLabel}</Button>
              </div>
            ))}
            {rows.length === 0 && <p className="muted small" style={{ padding: 14 }}>No unused questions match. Questions already in the paper are hidden here.</p>}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Step 3 — review the proposed paper: keep what you like, change the rest. */
export default function PaperReview({ subjects, bankList, byId, paper, setPaper, locked, setLocked, subjectOrder }) {
  const toast = useToast();
  const [preview, setPreview] = useState(null);
  const [picker, setPicker] = useState(null); // { mode:'replace'|'add', id?, subjectId? }
  const buckets = useMemo(() => bucketize(bankList), [bankList]);
  const ordered = useMemo(() => sortPaper(paper, byId, subjectOrder), [paper, byId, subjectOrder]);
  const totals = useMemo(() => paperTotals(paper, byId), [paper, byId]);
  const excludeIds = useMemo(() => new Set(paper), [paper]);
  const groups = useMemo(() => subjects.map((s) => ({ s, qs: ordered.map((id) => byId.get(id)).filter((q) => q.subject_id === s.id) })).filter((g) => g.qs.length > 0), [subjects, ordered, byId]);
  const unlockedCount = paper.filter((id) => !locked.has(id)).length;

  const dropLock = (id) => setLocked((l) => { if (!l.has(id)) return l; const n = new Set(l); n.delete(id); return n; });
  const toggleKeep = (id) => setLocked((l) => { const n = new Set(l); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const shuffleOne = (id) => {
    const next = swapSame(paper, id, byId, bankList);
    if (!next) return toast('No other unused question of the same subject and level is available', 'info');
    setPaper(next);
  };
  const shuffleAll = () => {
    if (!unlockedCount) return toast('Every question is marked Keep — nothing to shuffle', 'info');
    const r = shuffleUnlocked(paper, locked, byId, bankList);
    setPaper(r.paper);
    toast(r.changed ? `Shuffled ${r.changed} question${r.changed === 1 ? '' : 's'}${r.stuck ? ` · ${r.stuck} had no alternative` : ''}` : 'No alternatives available for the unlocked questions', r.changed ? 'success' : 'info');
  };
  const remove = (id) => { setPaper((p) => p.filter((x) => x !== id)); dropLock(id); };
  const onPick = (q) => {
    if (picker.mode === 'replace') { setPaper((p) => p.map((x) => (x === picker.id ? q.id : x))); dropLock(picker.id); toast('Question replaced', 'success'); }
    else { setPaper((p) => [...p, q.id]); toast('Question added', 'success'); }
    setPicker(null);
  };
  const replacing = picker?.mode === 'replace' ? byId.get(picker.id) : null;

  return (
    <div className="stack">
      <div className="pr-toolbar">
        <div className="pr-totals" aria-live="polite">
          <span><b>{totals.questions}</b> questions</span><span><b>{totals.marks}</b> marks</span><span><b>{totals.mins}</b> min of work</span>
          <span className="muted small">{locked.size} kept</span>
        </div>
        <div className="row">
          <Button type="button" size="sm" variant="ghost" onClick={shuffleAll}>↻ Shuffle all unlocked ({unlockedCount})</Button>
          <Button type="button" size="sm" onClick={() => setPicker({ mode: 'add', subjectId: null })}>+ Add question</Button>
        </div>
      </div>
      <p className="muted small">These are the questions the system picked at random. Tick <b>Keep</b> on the ones you like — <b>Shuffle all</b> leaves those alone. Use <b>Shuffle</b> for another question of the same subject and level, <b>Replace…</b> to choose one yourself, or <b>Remove</b>. Everyone in the session gets this same paper. Answers and hidden tests are never shown here.</p>

      {groups.length === 0 && <EmptyState title="The paper is empty" hint="Add at least one question to continue." />}
      {groups.map(({ s, qs }) => {
        const t = paperTotals(qs.map((q) => q.id), byId);
        return (
          <section className="pr-group" key={s.id} aria-label={s.name}>
            <header className="pr-group-head">
              <div><h4>{s.name}</h4><span className="muted small">{t.questions} question{t.questions === 1 ? '' : 's'} · {t.marks} marks · {t.mins} min</span></div>
              <div className="pr-chips">
                {LEVELS.map((l) => {
                  const used = qs.filter((q) => q.difficulty === l).length; const total = availability(buckets, s.id, l);
                  return <span key={l} className={`pr-chip ${used ? 'on' : ''}`} title={`${total - used} unused ${l} question(s) left in the bank for this subject`}>{l[0].toUpperCase() + l.slice(1)} {used} · {Math.max(0, total - used)} left</span>;
                })}
                <Button type="button" size="sm" variant="ghost" onClick={() => setPicker({ mode: 'add', subjectId: s.id })}>+ Add</Button>
              </div>
            </header>
            <div className="pr-cards">
              {qs.map((q) => {
                const kept = locked.has(q.id);
                return (
                  <article className={`pr-card ${kept ? 'kept' : ''}`} key={q.id}>
                    <div className="pr-card-top">
                      <div className="pr-title">{kept && <span className="pr-tick" aria-hidden="true">✓</span>}<strong>{q.title}</strong></div>
                      <div className="row" style={{ gap: 6 }}><Badge tone={q.difficulty}>{q.difficulty}</Badge><Badge>{q.type}</Badge></div>
                    </div>
                    <div className="muted small">{q.marks} marks · {q.time_mins} min{q.type === 'mcq' ? '' : ` · ${unitsLabel(q)}`}{(q.tags || []).length ? ` · ${(q.tags || []).slice(0, 3).join(', ')}` : ''}</div>
                    <div className="pr-actions">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setPreview(q)}>Preview</Button>
                      <Button type="button" size="sm" variant={kept ? 'success' : 'ghost'} aria-pressed={kept} onClick={() => toggleKeep(q.id)}>{kept ? '✓ Kept' : 'Keep'}</Button>
                      <Button type="button" size="sm" variant="ghost" disabled={kept} title={kept ? 'Untick Keep to shuffle this question' : 'Swap for another question of the same subject and level'} onClick={() => shuffleOne(q.id)}>↻ Shuffle</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setPicker({ mode: 'replace', id: q.id, subjectId: q.subject_id })}>Replace…</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => remove(q.id)}>Remove</Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}

      <Modal open={!!preview} wide title={preview?.title || ''} onClose={() => setPreview(null)}>{preview && <QuestionPreview q={preview} />}</Modal>
      {picker && (
        <QuestionPicker open subjects={subjects} bankList={bankList} excludeIds={excludeIds} subjectId={picker.subjectId}
          title={picker.mode === 'replace' ? `Replace “${replacing?.title || ''}”` : 'Add a question'} initialLevel={replacing ? replacing.difficulty : ''}
          actionLabel={picker.mode === 'replace' ? 'Use this' : 'Add'} onChoose={onPick} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}
