// type = "match": drag each service onto the description it matches. Response: { pairs: { leftId: rightId } }.
import { useMemo, useState } from 'react';
import CloudIcon from './CloudIcon.jsx';
import { DragGhost, useDnd } from './dnd.js';
import Rich from './Rich.jsx';
import { interactiveProgress } from './meta.js';

function Chip({ item, selected, ghost = false, ...rest }) {
  return (
    <div className={`ix-chip ix-prov-${item.provider || 'generic'} ${selected ? 'sel' : ''} ${ghost ? 'ix-ghostcard' : ''}`} {...rest}>
      <CloudIcon kind={item.kind || 'compute'} provider={item.provider || 'generic'} size={30} />
      <span className="ix-chiplabel">{item.label}</span>
    </div>
  );
}

export default function MatchQuestion({ question, value, onChange, readOnly = false, hideScenario = false }) {
  const cfg = question.config || {};
  const left = cfg.left || []; const right = cfg.right || [];
  const L = useMemo(() => new Map(left.map((x) => [x.id, x])), [left]);
  const R = useMemo(() => new Map(right.map((x) => [x.id, x])), [right]);
  const pairs = {};
  const usedRight = new Set();
  Object.entries(value?.pairs || {}).forEach(([l, r]) => { if (L.has(l) && R.has(r) && !usedRight.has(r)) { pairs[l] = r; usedRight.add(r); } });
  const byRight = {}; Object.entries(pairs).forEach(([l, r]) => { byRight[r] = l; });
  const pool = left.filter((x) => !pairs[x.id]);
  const [sel, setSel] = useState(null); // tap-to-select alternative: { id, from: 'pool' | rightId }
  const [note, setNote] = useState('');

  const emit = (next, msg) => { if (readOnly) return; onChange?.({ pairs: next }); if (msg) setNote(msg); };
  /** put chip `id` on description `rid` (null = back to the pool). Occupant swaps into the dragged chip's old place. */
  const place = (id, rid) => {
    const next = { ...pairs };
    const oldRid = next[id];
    delete next[id];
    if (rid) {
      const occupant = byRight[rid];
      if (occupant && occupant !== id) { delete next[occupant]; if (oldRid) next[occupant] = oldRid; }
      next[id] = rid;
    }
    emit(next, rid ? `${L.get(id)?.label} matched` : `${L.get(id)?.label} moved back to the list`);
    setSel(null);
  };

  const { drag, bind } = useDnd((payload, target) => {
    if (readOnly || !target) return;
    if (target.startsWith('slot:')) place(payload.id, target.slice(5));
    else if (target.startsWith('pool')) place(payload.id, null);
  });

  const tapChip = (id, from) => { if (readOnly) return; setSel((s) => (s && s.id === id ? null : { id, from })); };
  const tapSlot = (rid) => {
    if (readOnly) return;
    if (sel) { place(sel.id, rid); return; }
    const occ = byRight[rid];
    if (occ) setSel({ id: occ, from: rid });
  };
  const prog = interactiveProgress(question, { pairs });

  return (
    <div className="ix ix-match">
      {!hideScenario && cfg.scenario && <div className="ix-scenario"><p><Rich text={cfg.scenario} /></p></div>}
      <div className="ix-bar">
        <span className="ix-progress" aria-live="polite"><b>{prog.done}</b> of {prog.total} matched</span>
        {!readOnly && <button type="button" className="ix-btn ghost" onClick={() => emit({}, 'All matches cleared')} disabled={!prog.done}>Reset</button>}
      </div>
      <div className="ix-match-grid">
        <section className={`ix-zone ix-pool ${drag?.over?.startsWith('pool') ? 'over' : ''}`} data-dnd="pool:" aria-label="Services" onClick={() => { if (sel && sel.from !== 'pool') place(sel.id, null); }}>
          <h4>Services <span className="ix-count">{pool.length}</span></h4>
          <div className="ix-chips">
            {pool.map((it) => (
              <Chip key={it.id} item={it} selected={sel?.id === it.id} role="button" tabIndex={readOnly ? -1 : 0} aria-pressed={sel?.id === it.id}
                aria-label={`Service: ${it.label}`} data-id={it.id}
                onClick={(e) => { e.stopPropagation(); tapChip(it.id, 'pool'); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapChip(it.id, 'pool'); } }}
                {...(readOnly ? {} : bind({ id: it.id, from: 'pool' }, { ghost: <Chip item={it} ghost /> }))} />
            ))}
            {pool.length === 0 && <p className="ix-empty">Every service is matched.</p>}
          </div>
        </section>

        <section className="ix-zone ix-targets" aria-label="Descriptions">
          <h4>Descriptions <span className="ix-count">{right.length}</span></h4>
          <div className="ix-stack">
            {right.map((r) => {
              const occId = byRight[r.id]; const occ = occId ? L.get(occId) : null;
              const over = drag?.over === `slot:${r.id}`;
              return (
                <div key={r.id} className={`ix-target ${occ ? 'filled' : ''} ${over ? 'over' : ''} ${sel && !occ ? 'ready' : ''}`}>
                  <p className="ix-targettext"><Rich text={r.text} /></p>
                  <div className="ix-slot" data-dnd={`slot:${r.id}`} role="button" tabIndex={readOnly ? -1 : 0}
                    aria-label={occ ? `${r.text}: matched with ${occ.label}` : `Drop zone for: ${r.text}`}
                    onClick={() => tapSlot(r.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapSlot(r.id); } }}>
                    {occ ? (
                      <Chip item={occ} selected={sel?.id === occ.id} data-id={occ.id} {...(readOnly ? {} : bind({ id: occ.id, from: r.id }, { ghost: <Chip item={occ} ghost /> }))} />
                    ) : <span className="ix-slothint">{sel ? 'Tap to place here' : 'Drop service here'}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <p className="ix-sr" aria-live="polite">{note}</p>
      <DragGhost drag={drag} />
    </div>
  );
}
