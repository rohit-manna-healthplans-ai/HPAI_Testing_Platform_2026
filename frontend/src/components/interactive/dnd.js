// Minimal pointer-events drag & drop (mouse, touch, pen) — no library.
//  - Drop targets mark themselves with  data-dnd="<kind>:<id>"  (any string, matched by the caller).
//  - Draggable elements spread  bind(payload, { ghost })  : mouse/pen drag from anywhere on the element;
//    touch drag only from an element marked  data-grip  (so the card body still scrolls the page).
//  - A click that ends a drag is swallowed so tap-to-select never fires by accident.
//  - Esc cancels, the page auto-scrolls near the viewport edges.
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const THRESHOLD = 6;
const EDGE = 72;

export function targetAt(x, y) {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    const t = el.closest ? el.closest('[data-dnd]') : null;
    if (t) return t;
  }
  return null;
}

/**
 * onDrop(payload, targetKey|null, point:{x,y}, targetEl|null) is called once when a real drag ends.
 * Returns { drag, bind, cancel } ; render <DragGhost drag={drag} /> once next to the draggables.
 */
export function useDnd(onDrop) {
  const [drag, setDrag] = useState(null);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  const swallow = useRef(false);
  const stopRef = useRef(null);

  const cancel = useCallback(() => { if (stopRef.current) stopRef.current(false); }, []);
  useEffect(() => () => { if (stopRef.current) stopRef.current(false); }, []);

  const bind = useCallback((payload, opts = {}) => ({
    onPointerDown: (e) => {
      if (opts.disabled) return;
      if (e.button !== undefined && e.button !== 0) return;
      const grip = e.target.closest?.('[data-grip]');
      if (e.pointerType === 'touch' && !grip) return;
      if (!grip && e.target.closest?.('button, a, input, select, textarea, [data-nodrag]')) return;
      if (stopRef.current) stopRef.current(false);
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const start = { x: e.clientX, y: e.clientY };
      const ox = e.clientX - rect.left; const oy = e.clientY - rect.top;
      let started = false; let last = { x: e.clientX, y: e.clientY }; let raf = 0; let scrollDy = 0;

      const loop = () => {
        if (!started) return;
        if (scrollDy) window.scrollBy(0, scrollDy);
        raf = requestAnimationFrame(loop);
      };
      const move = (ev) => {
        last = { x: ev.clientX, y: ev.clientY };
        if (!started) {
          if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < THRESHOLD) return;
          started = true;
          document.body.classList.add('ix-dragging');
          raf = requestAnimationFrame(loop);
        }
        scrollDy = ev.clientY < EDGE ? -16 : ev.clientY > window.innerHeight - EDGE ? 16 : 0;
        const t = targetAt(ev.clientX, ev.clientY);
        setDrag({ payload, x: ev.clientX, y: ev.clientY, ox, oy, w: rect.width, h: rect.height, ghost: opts.ghost, over: t ? t.getAttribute('data-dnd') : null });
      };
      const finish = (commit) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancelEv);
        window.removeEventListener('keydown', key);
        cancelAnimationFrame(raf);
        document.body.classList.remove('ix-dragging');
        stopRef.current = null;
        if (started) {
          setDrag(null);
          if (commit) {
            const t = targetAt(last.x, last.y);
            swallow.current = true;
            setTimeout(() => { swallow.current = false; }, 60);
            dropRef.current(payload, t ? t.getAttribute('data-dnd') : null, last, t);
          }
        }
      };
      const up = () => finish(true);
      const cancelEv = () => finish(false);
      const key = (ev) => { if (ev.key === 'Escape') finish(false); };
      stopRef.current = finish;
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancelEv);
      window.addEventListener('keydown', key);
    },
    onClickCapture: (e) => { if (swallow.current) { e.stopPropagation(); e.preventDefault(); } },
    'data-dragging': drag && drag.payload && drag.payload.id === payload.id && drag.payload.from === payload.from ? '1' : undefined,
  }), [drag]);

  return { drag, bind, cancel };
}

export function DragGhost({ drag }) {
  if (!drag || typeof document === 'undefined') return null;
  return createPortal(
    createElement('div', { className: 'ix-ghost', style: { width: drag.w, transform: `translate(${drag.x - drag.ox}px, ${drag.y - drag.oy}px) rotate(1.2deg)` } }, drag.ghost),
    document.body,
  );
}

/** Index at which a card dropped at (x,y) would be inserted into a vertical list (cards matched by selector; skipId ignored). */
export function insertIndexAt(container, selector, y, skipId) {
  if (!container) return 0;
  const cards = [...container.querySelectorAll(selector)].filter((el) => el.dataset.id !== skipId);
  for (let i = 0; i < cards.length; i += 1) {
    const r = cards[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return cards.length;
}

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
