import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

/** True when the user asked the OS/browser for less motion. */
export const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

function parseCount(value) {
  if (typeof value === 'number') return { n: value, dec: Number.isInteger(value) ? 0 : 1, suffix: '' };
  if (typeof value === 'string') {
    const m = value.match(/^(-?\d+(?:\.(\d+))?)(.*)$/);
    if (m) return { n: Number(m[1]), dec: m[2] ? m[2].length : 0, suffix: m[3] };
  }
  return null;
}

/** Number that eases up to its target (rAF, text only — no layout work). Keeps any suffix such as "%". */
export function CountUp({ value, duration = 800 }) {
  const parsed = parseCount(value);
  const target = parsed ? parsed.n : 0;
  const [shown, setShown] = useState(parsed && !prefersReducedMotion() ? 0 : target);
  const from = useRef(0);
  useEffect(() => {
    if (!parsed) return undefined;
    if (prefersReducedMotion()) { setShown(target); return undefined; }
    const start = performance.now();
    const base = from.current;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - start) / duration);
      setShown(base + (target - base) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!parsed) return <>{value}</>;
  return <>{Number(shown).toLocaleString(undefined, { minimumFractionDigits: parsed.dec, maximumFractionDigits: parsed.dec })}{parsed.suffix}</>;
}

/* ---------- Basic building blocks ---------- */
export function Card({ title, subtitle, actions, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, tone = 'blue' }) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value"><CountUp value={value} /></strong>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}

export function Badge({ tone = 'gray', children, live }) {
  // Soft pulse for "live" states such as In progress.
  const pulse = live ?? (typeof children === 'string' && /^(in progress|live)$/i.test(children.trim()));
  return <span className={`badge badge-${tone} ${pulse ? 'badge-live' : ''}`}>{children}</span>;
}

/** Skeleton shimmer placeholder (replaces bare spinners). */
export function Spinner({ label = 'Loading…', rows = 3 }) {
  return (
    <div className="skeleton-wrap" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="skeleton sk-title" />
      {Array.from({ length: rows }, (_, i) => <div key={i} className={`skeleton sk-line ${i % 3 === 1 ? 'w80' : i % 3 === 2 ? 'w60' : ''}`} />)}
    </div>
  );
}

export function EmptyState({ title = 'Nothing here yet', hint, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">∅</div>
      <strong>{title}</strong>
      {hint && <p className="muted small">{hint}</p>}
      {children}
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && <button className="btn btn-sm btn-ghost" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Field({ label, hint, error, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Button({ variant = 'primary', size, loading, children, ...rest }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${rest.className || ''}`}>
      {loading && <span className="spinner spinner-sm" />}
      {children}
    </button>
  );
}

export function Tabs({ tabs, value, onChange }) {
  const wrap = useRef(null);
  const [ind, setInd] = useState(null);
  const measure = useCallback(() => {
    const el = wrap.current?.querySelector('.tab.active');
    if (el) setInd((p) => (p && p.x === el.offsetLeft && p.w === el.offsetWidth ? p : { x: el.offsetLeft, w: el.offsetWidth }));
  }, []);
  useLayoutEffect(measure, [measure, value, tabs.length, tabs.map((t) => t.count).join('|')]);
  useEffect(() => {
    window.addEventListener('resize', measure);
    document.fonts?.ready?.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);
  return (
    <div className={`tabs ${ind ? 'has-ind' : ''}`} role="tablist" ref={wrap}>
      {ind && <span className="tab-ind" aria-hidden="true" style={{ transform: `translateX(${ind.x}px) scaleX(${ind.w / 100})` }} />}
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}{t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max = 100, tone = 'green' }) {
  const p = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}><div className={`bar-fill bar-${tone}`} style={{ '--p': p / 100 }} /></div>;
}

/* ---------- Modal / Drawer ---------- */
export function Modal({ open, title, onClose, children, footer, wide, drawer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`modal-backdrop ${drawer ? 'is-drawer' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${drawer ? 'modal-drawer' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger, onConfirm, onCancel, withReason, reasonLabel = 'Reason' }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) { setReason(''); setBusy(false); } }, [open]);
  const run = async () => {
    setBusy(true);
    try { await onConfirm(reason); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title={title} onClose={onCancel}
      footer={<>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={withReason && !reason.trim()} onClick={run}>{confirmLabel}</Button>
      </>}>
      <p>{message}</p>
      {withReason && (
        <Field label={reasonLabel}><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required for the audit log" /></Field>
      )}
    </Modal>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((l) => [...l, { id, message, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.message}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Data loading hook ---------- */
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const alive = useRef(true);
  const run = useCallback(async (silent) => {
    const quiet = silent === true; // reload(true) refreshes without flashing a spinner
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (alive.current) setState({ loading: false, data, error: null });
    } catch (error) {
      if (alive.current) setState((s) => ({ loading: false, data: quiet ? s.data : null, error }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false; }; }, [run]);
  return { ...state, reload: run };
}

export function useInterval(fn, ms) {
  const saved = useRef(fn);
  useEffect(() => { saved.current = fn; });
  useEffect(() => {
    if (!ms) return undefined;
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
