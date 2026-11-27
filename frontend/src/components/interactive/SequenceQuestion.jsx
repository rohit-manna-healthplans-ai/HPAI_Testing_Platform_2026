// type = "sequence": arrange steps (e.g. an ML pipeline) in the right order. Response: { order: [stepId, ...] }.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DragGhost, insertIndexAt, useDnd } from './dnd.js';
import PipelineBar, { stageColor } from './visuals/PipelineBar.jsx';
import Visual from './Visual.jsx';
import Rich from './Rich.jsx';
import { interactiveProgress } from './meta.js';

const Grip = () => (
  <span className="ix-grip" data-grip aria-hidden="true" title="Drag">
    <svg width="14" height="18" viewBox="0 0 14 18"><g fill="currentColor"><circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" /><circle cx="4" cy="9" r="1.5" /><circle cx="10" cy="9" r="1.5" /><circle cx="4" cy="14" r="1.5" /><circle cx="10" cy="14" r="1.5" /></g></svg>
  </span>
);

function StepBody({ item, stages }) {
  return (
    <span className="ix-stepbody">
      <span className="ix-steplabel"><i className="ix-dot" style={{ background: stageColor(stages, item.stage) }} aria-hidden="true" />{item.label}</span>
      {item.detail && <span className="ix-stepdetail">{item.detail}</span>}
    </span>
  );
}

export default function SequenceQuestion({ question, value, onChange, readOnly = false, hideScenario = false }) {
  const cfg = question.config || {};
  const items = cfg.items || [];
  const stages = cfg.stages || [];
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const order = (value?.order || []).filter((id) => byId.has(id));
  const placed = new Set(order);
  const tray = items.filter((i) => !placed.has(i.id));
  const listRef = useRef(null);
  const rootRef = useRef(null);
  const focusReq = useRef(null); // keyboard users keep their place after a card jumps between the tray and the sequence
  const [note, setNote] = useState('');

  useEffect(() => {
    const f = focusReq.current; const root = rootRef.current;
    if (!f || !root) return;
    focusReq.current = null;
    const q = (sel) => root.querySelector(sel);
    let el = null;
    if (f.kind === 'add') el = root.querySelectorAll('.ix-tray [data-act="add"]')[Math.min(f.index, Math.max(0, root.querySelectorAll('.ix-tray [data-act="add"]').length - 1))] || null;
    if (f.kind === 'move') { el = q(`[data-card][data-id="${f.id}"] [data-act="${f.act}"]:not(:disabled)`) || q(`[data-card][data-id="${f.id}"] [data-act]:not(:disabled)`); }
    if (f.kind === 'remove') { const rem = root.querySelectorAll('.ix-seqzone [data-act="remove"]'); el = rem[Math.min(f.index, rem.length - 1)] || q('.ix-tray [data-act="add"]'); }
    if (el) el.focus();
  });

  const emit = (next, msg) => { if (readOnly) return; onChange?.({ order: next }); if (msg) setNote(msg); };
  const add = (id, index = order.length) => {
    const next = order.filter((x) => x !== id);
    const at = Math.max(0, Math.min(index, next.length));
    next.splice(at, 0, id);
    emit(next, `${byId.get(id)?.label} placed at position ${at + 1}`);
  };
  const remove = (id) => emit(order.filter((x) => x !== id), `${byId.get(id)?.label} moved back to available steps`);
  const move = (id, dir) => {
    const i = order.indexOf(id); const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = [...order]; [next[i], next[j]] = [next[j], next[i]];
    emit(next, `${byId.get(id)?.label} is now position ${j + 1}`);
  };

  const { drag, bind } = useDnd((payload, target, pt) => {
    if (readOnly || !target) return;
    if (target.startsWith('seq')) add(payload.id, insertIndexAt(listRef.current, '[data-card]', pt.y, payload.id));
    else if (target.startsWith('tray') && payload.from === 'seq') remove(payload.id);
  });
  const overSeq = drag && drag.over && drag.over.startsWith('seq');
  const hoverIdx = overSeq ? insertIndexAt(listRef.current, '[data-card]', drag.y, drag.payload.id) : null;
  const prog = interactiveProgress(question, { order });
  const ghostFor = (it) => <div className="ix-step ix-ghostcard"><StepBody item={it} stages={stages} /></div>;

  return (
    <div className="ix ix-seq" ref={rootRef}>
      {!hideScenario && cfg.scenario && <div className="ix-scenario"><b>Scenario</b><p><Rich text={cfg.scenario} /></p></div>}
      <Visual visual={cfg.visual} />
      <PipelineBar stages={stages} items={items} placedIds={order} />

      <div className="ix-bar">
        <span className="ix-progress" aria-live="polite"><b>{prog.done}</b> of {prog.total} placed</span>
        {!readOnly && <button type="button" className="ix-btn ghost" onClick={() => emit([], 'Sequence cleared')} disabled={!order.length}>Reset</button>}
      </div>

      <div className="ix-seq-grid">
        <section className="ix-zone ix-tray" data-dnd="tray:" aria-label="Available steps">
          <h4>Available steps <span className="ix-count">{tray.length}</span></h4>
          <div className="ix-stack" role="list">
            {tray.map((it) => (
              <div key={it.id} role="listitem" className="ix-step" data-id={it.id} {...(readOnly ? {} : bind({ id: it.id, from: 'tray' }, { ghost: ghostFor(it) }))}>
                {!readOnly && <Grip />}
                <StepBody item={it} stages={stages} />
                {!readOnly && <button type="button" className="ix-btn add" data-act="add" onClick={() => { focusReq.current = { kind: 'add', index: tray.findIndex((x) => x.id === it.id) }; add(it.id); }} aria-label={`Add step: ${it.label}`}>Add ›</button>}
              </div>
            ))}
            {tray.length === 0 && <p className="ix-empty">All steps are in your sequence.</p>}
          </div>
        </section>

        <section className={`ix-zone ix-seqzone ${overSeq ? 'over' : ''}`} data-dnd="seq:" aria-label="Your sequence">
          <h4>Your sequence <span className="ix-count">{order.length}</span></h4>
          <div className="ix-stack" role="list" ref={listRef}>
            {order.length === 0 && <div className="ix-drophint">Drag steps here, or press <b>Add</b> on a step.</div>}
            {order.map((id, i) => {
              const it = byId.get(id);
              return (
                <div key={id} className="ix-seqrow">
                  {hoverIdx === i && <div className="ix-insert" aria-hidden="true" />}
                  <div role="listitem" className="ix-step in-seq ix-land" data-card data-id={id} {...(readOnly ? {} : bind({ id, from: 'seq' }, { ghost: ghostFor(it) }))}>
                    {!readOnly && <Grip />}
                    <span className="ix-num" style={{ background: stageColor(stages, it.stage) }}>{i + 1}</span>
                    <StepBody item={it} stages={stages} />
                    {!readOnly && (
                      <span className="ix-ctrl">
                        <button type="button" className="ix-btn icon" data-act="up" onClick={() => { focusReq.current = { kind: 'move', id, act: 'up' }; move(id, -1); }} disabled={i === 0} aria-label={`Move up: ${it.label}`}>↑</button>
                        <button type="button" className="ix-btn icon" data-act="down" onClick={() => { focusReq.current = { kind: 'move', id, act: 'down' }; move(id, 1); }} disabled={i === order.length - 1} aria-label={`Move down: ${it.label}`}>↓</button>
                        <button type="button" className="ix-btn icon x" data-act="remove" onClick={() => { focusReq.current = { kind: 'remove', index: i }; remove(id); }} aria-label={`Remove: ${it.label}`}>×</button>
                      </span>
                    )}
                  </div>
                  {i < order.length - 1 && <div className="ix-arrow" aria-hidden="true"><svg width="18" height="22" viewBox="0 0 18 22"><path d="M9 1v16M3.5 12.5L9 18l5.5-5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
                </div>
              );
            })}
            {hoverIdx === order.length && order.length > 0 && <div className="ix-insert" aria-hidden="true" />}
          </div>
        </section>
      </div>
      <p className="ix-sr" aria-live="polite">{note}</p>
      <DragGhost drag={drag} />
    </div>
  );
}
