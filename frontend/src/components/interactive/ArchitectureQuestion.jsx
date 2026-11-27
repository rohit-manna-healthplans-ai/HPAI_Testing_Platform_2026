// type = "architecture": drag services into the boxes of a cloud architecture diagram. Response: { placed: { slotId: paletteId } }.
import { useEffect, useId, useMemo, useState } from 'react';
import CloudIcon from './CloudIcon.jsx';
import { DragGhost, useDnd } from './dnd.js';
import Rich from './Rich.jsx';
import { interactiveProgress } from './meta.js';

const ZONE_TINTS = ['#a2cfe2', '#b8e8cf', '#f6dca6', '#d8cdf2', '#f4c3cd'];
const CANVAS_MIN = 600; // below this container width the diagram degrades to a stacked list (tap-friendly)

/** Callback-ref size observer: re-attaches whenever the element mounts/unmounts (canvas <-> list mode switch). */
function useSize() {
  const [el, setEl] = useState(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return undefined;
    const read = () => { const r = el.getBoundingClientRect(); setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height })); };
    read();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', read); return () => window.removeEventListener('resize', read); }
    const ro = new ResizeObserver(read); ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, size];
}

function Svc({ item, selected, ghost = false, compact = false, ...rest }) {
  return (
    <div className={`ix-svc ix-prov-${item.provider || 'generic'} ${compact ? 'compact' : ''} ${selected ? 'sel' : ''} ${ghost ? 'ix-ghostcard' : ''}`} {...rest}>
      <CloudIcon kind={item.kind || 'compute'} provider={item.provider || 'generic'} size={compact ? 26 : 32} />
      <span className="ix-svclabel">{item.label}</span>
    </div>
  );
}

/** Point where the ray from the rect centre towards (tx,ty) leaves the rectangle (plus a small gap). */
function edge(r, tx, ty, gap = 3) {
  const cx = r.x + r.w / 2; const cy = r.y + r.h / 2;
  const dx = tx - cx; const dy = ty - cy;
  if (!dx && !dy) return [cx, cy];
  const t = Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
  const len = Math.hypot(dx, dy);
  return [cx + dx * t + (dx / len) * gap, cy + dy * t + (dy / len) * gap];
}

export default function ArchitectureQuestion({ question, value, onChange, readOnly = false, hideScenario = false }) {
  const cfg = question.config || {};
  const slots = cfg.slots || []; const palette = cfg.palette || []; const zones = cfg.zones || []; const links = cfg.links || [];
  const ratio = Number(cfg.canvas_ratio) > 0 ? Number(cfg.canvas_ratio) : 1.75;
  const P = useMemo(() => new Map(palette.map((p) => [p.id, p])), [palette]);
  const S = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const placed = {}; const used = new Set();
  Object.entries(value?.placed || {}).forEach(([s, p]) => { if (S.has(s) && P.has(p) && !used.has(p)) { placed[s] = p; used.add(p); } });
  const left = palette.filter((p) => !used.has(p.id));
  const uid = useId().replace(/:/g, '');

  const [wrapRef, wrap] = useSize();
  const [canvasRef, cv] = useSize();
  const canvasMode = wrap.w >= CANVAS_MIN || wrap.w === 0;
  const [sel, setSel] = useState(null); // { id, from: 'palette' | slotId }
  const [note, setNote] = useState('');

  const emit = (next, msg) => { if (readOnly) return; onChange?.({ placed: next }); if (msg) setNote(msg); };
  const place = (pid, sid, from) => {
    const next = { ...placed };
    const oldSlot = from && from !== 'palette' ? from : Object.keys(next).find((k) => next[k] === pid);
    if (oldSlot) delete next[oldSlot];
    if (sid) {
      const occ = next[sid];
      if (occ && occ !== pid && oldSlot) next[oldSlot] = occ; // swap
      next[sid] = pid;
    }
    emit(next, sid ? `${P.get(pid)?.label} placed in ${S.get(sid)?.label}` : `${P.get(pid)?.label} returned to the palette`);
    setSel(null);
  };

  const { drag, bind } = useDnd((payload, target) => {
    if (readOnly || !target) return;
    if (target.startsWith('slot:')) place(payload.id, target.slice(5), payload.from);
    else if (target.startsWith('palette')) place(payload.id, null, payload.from);
  });
  const tapPalette = (id) => { if (!readOnly) setSel((s) => (s && s.id === id ? null : { id, from: 'palette' })); };
  const tapSlot = (sid) => {
    if (readOnly) return;
    if (sel) { place(sel.id, sid, sel.from); return; }
    if (placed[sid]) setSel({ id: placed[sid], from: sid });
  };
  const prog = interactiveProgress(question, { placed });

  const slotBox = (s) => {
    const pid = placed[s.id]; const item = pid ? P.get(pid) : null;
    const over = drag?.over === `slot:${s.id}`;
    return (
      <div key={s.id} className={`ix-aslot ${item ? 'filled' : ''} ${over ? 'over' : ''} ${sel && !item ? 'ready' : ''}`}
        data-dnd={`slot:${s.id}`} role="button" tabIndex={readOnly ? -1 : 0}
        aria-label={item ? `${s.label}: ${item.label}` : `Empty box: ${s.label}`}
        style={canvasMode ? { left: `${s.x}%`, top: `${s.y}%`, width: `${s.w || 16}%`, height: `${s.h || 18}%` } : undefined}
        onClick={() => tapSlot(s.id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapSlot(s.id); } }}>
        <span className="ix-slotlabel" title={s.label}>{s.label}</span>
        {item
          ? <Svc item={item} compact selected={sel?.id === item.id} data-id={item.id} {...(readOnly ? {} : bind({ id: item.id, from: s.id }, { ghost: <Svc item={item} ghost /> }))} />
          : <span className="ix-slothint">{sel ? 'Tap to place' : 'Drop here'}</span>}
      </div>
    );
  };

  // links in pixels (canvas mode only)
  const linkPaths = canvasMode && cv.w > 0 ? links.map((l, i) => {
    const a = S.get(l.from); const b = S.get(l.to);
    if (!a || !b) return null;
    const ra = { x: a.x / 100 * cv.w, y: a.y / 100 * cv.h, w: (a.w || 16) / 100 * cv.w, h: (a.h || 18) / 100 * cv.h };
    const rb = { x: b.x / 100 * cv.w, y: b.y / 100 * cv.h, w: (b.w || 16) / 100 * cv.w, h: (b.h || 18) / 100 * cv.h };
    const [x1, y1] = edge(ra, rb.x + rb.w / 2, rb.y + rb.h / 2);
    const [x2, y2] = edge(rb, ra.x + ra.w / 2, ra.y + ra.h / 2, 5);
    return { i, x1, y1, x2, y2, label: l.label };
  }).filter(Boolean) : [];

  // list mode: follow the arrows (entry point first, then what it connects to); ties by position
  const ordered = useMemo(() => {
    const pos = (a, b) => (a.x - b.x) || (a.y - b.y);
    const indeg = new Map(slots.map((s) => [s.id, 0]));
    links.forEach((l) => { if (S.has(l.from) && S.has(l.to)) indeg.set(l.to, (indeg.get(l.to) || 0) + 1); });
    const out = []; const done = new Set();
    let ready = slots.filter((s) => !indeg.get(s.id)).sort(pos);
    while (ready.length) {
      const s = ready.shift(); out.push(s); done.add(s.id);
      links.filter((l) => l.from === s.id && S.has(l.to)).forEach((l) => { indeg.set(l.to, indeg.get(l.to) - 1); if (!indeg.get(l.to) && !done.has(l.to) && !ready.some((r) => r.id === l.to)) ready.push(S.get(l.to)); });
      ready.sort(pos);
    }
    return [...out, ...slots.filter((s) => !done.has(s.id)).sort(pos)];
  }, [slots, links, S]);
  const zoneOf = (s) => zones.find((z) => (s.x + (s.w || 16) / 2) >= z.x && (s.x + (s.w || 16) / 2) <= z.x + z.w && (s.y + (s.h || 18) / 2) >= z.y && (s.y + (s.h || 18) / 2) <= z.y + z.h);
  const nextOf = (s) => links.filter((l) => l.from === s.id).map((l) => S.get(l.to)?.label).filter(Boolean);

  return (
    <div className="ix ix-arch" ref={wrapRef}>
      {!hideScenario && cfg.scenario && <div className="ix-scenario"><b>Brief</b><p><Rich text={cfg.scenario} /></p></div>}
      <div className="ix-bar">
        <span className="ix-progress" aria-live="polite"><b>{prog.done}</b> of {prog.total} boxes filled</span>
        {!readOnly && <button type="button" className="ix-btn ghost" onClick={() => emit({}, 'Diagram cleared')} disabled={!prog.done}>Reset</button>}
      </div>

      <section className={`ix-zone ix-palette ${drag?.over?.startsWith('palette') ? 'over' : ''}`} data-dnd="palette:" aria-label="Service palette"
        onClick={() => { if (sel && sel.from !== 'palette') place(sel.id, null, sel.from); }}>
        <h4>Services <span className="ix-count">{left.length} left</span></h4>
        <div className="ix-chips">
          {left.map((p) => (
            <Svc key={p.id} item={p} selected={sel?.id === p.id} role="button" tabIndex={readOnly ? -1 : 0} aria-pressed={sel?.id === p.id} aria-label={`Service: ${p.label}`} data-id={p.id}
              onClick={(e) => { e.stopPropagation(); tapPalette(p.id); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapPalette(p.id); } }}
              {...(readOnly ? {} : bind({ id: p.id, from: 'palette' }, { ghost: <Svc item={p} ghost /> }))} />
          ))}
          {left.length === 0 && <p className="ix-empty">All services are placed.</p>}
        </div>
      </section>

      {canvasMode ? (
        <div className="ix-canvaswrap">
          <div className="ix-canvas" ref={canvasRef} style={{ aspectRatio: String(ratio) }}>
            {zones.map((z, i) => (
              <div key={z.id} className="ix-zonebox" style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%`, '--zc': ZONE_TINTS[i % ZONE_TINTS.length] }}><span>{z.label}</span></div>
            ))}
            <svg className="ix-links" width={cv.w || 1} height={cv.h || 1} aria-hidden="true">
              <defs><marker id={`ah${uid}`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1l8 4-8 4z" fill="#1f6688" /></marker></defs>
              {linkPaths.map((p) => {
                const mx = (p.x1 + p.x2) / 2; const my = (p.y1 + p.y2) / 2; const tw = p.label ? p.label.length * 6 + 12 : 0;
                return (
                  <g key={p.i}>
                    <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} className="ix-linkline ix-flow" markerEnd={`url(#ah${uid})`} />
                    {p.label && <g><rect x={mx - tw / 2} y={my - 9} width={tw} height="18" rx="9" className="ix-linkpill" /><text x={mx} y={my + 4} textAnchor="middle" className="ix-linktext">{p.label}</text></g>}
                  </g>
                );
              })}
            </svg>
            {slots.map(slotBox)}
          </div>
        </div>
      ) : (
        <div className="ix-alist">
          {ordered.map((s, i) => {
            const z = zoneOf(s); const pz = i > 0 ? zoneOf(ordered[i - 1]) : null;
            const nx = nextOf(s);
            return (
              <div key={s.id} className="ix-arow">
                {z && (i === 0 || pz?.id !== z.id) && <div className="ix-arowzone">{z.label}</div>}
                {slotBox(s)}
                {nx.length > 0 && <div className="ix-arowlink" aria-hidden="true">↓ connects to {nx.join(', ')}</div>}
              </div>
            );
          })}
        </div>
      )}
      <p className="ix-sr" aria-live="polite">{note}</p>
      <DragGhost drag={drag} />
    </div>
  );
}
