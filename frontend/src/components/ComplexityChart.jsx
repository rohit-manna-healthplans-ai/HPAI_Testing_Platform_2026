import { useMemo, useState } from 'react';
import { modelById } from '../analysis/complexityFit.js';

const W = 520; const H = 290; const M = { l: 70, r: 18, t: 18, b: 46 };
const PW = W - M.l - M.r; const PH = H - M.t - M.b;

const REF_LABEL = { n: 'O(n)', nlogn: 'O(n log n)', n2: 'O(n²)' };

export function fmtValue(v, unit) {
  if (!Number.isFinite(v)) return '—';
  if (unit === 'KB') return v >= 1024 ? `${(v / 1024).toFixed(2)} MB` : v >= 10 ? `${v.toFixed(0)} KB` : `${v.toFixed(2)} KB`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)} s`;
  if (v >= 10) return `${v.toFixed(1)} ms`;
  if (v >= 1) return `${v.toFixed(2)} ms`;
  return `${(v * 1000).toFixed(0)} µs`;
}
const fmtN = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 ? 1 : 0)}k` : String(Math.round(n)));

/** Illustrative curve of a class over [lo, hi], normalised to 0..1 (used when nothing was measured). */
function theoretical(id, lo, hi) {
  const m = modelById(id); if (!m) return [];
  const exp = id === '2n';
  const a = exp ? 4 : lo; const b = exp ? 30 : hi;
  const f = exp ? (n) => Math.pow(2, n - b) : m.f;
  const top = f(b);
  return Array.from({ length: 41 }, (_, i) => { const n = a * Math.pow(b / a, i / 40); return { n, value: f(n) / top }; });
}

export default function ComplexityChart({ title, unit = 'ms', points = [], fitted = [], refs = [], staticId = null, label, logScale = false, mode = 'measured', ariaLabel }) {
  const [hover, setHover] = useState(null);
  const gid = `cxg-${String(title).replace(/\W+/g, '')}`;
  const isStatic = mode === 'static' || !points.length;

  const model = useMemo(() => {
    let main = []; let guides = []; let pts = [];
    if (isStatic) {
      const lo = 25; const hi = 3200;
      main = theoretical(staticId || '1', lo, hi);
      guides = ['n', 'nlogn', 'n2'].filter((id) => id !== staticId).map((id) => ({ id, curve: theoretical(id, lo, hi) }));
    } else { main = fitted; pts = points; guides = refs.map((r) => ({ id: r.id, curve: r.curve })); }
    const xs = [...pts.map((p) => p.n), ...main.map((p) => p.n)];
    const x0 = Math.min(...xs); const x1 = Math.max(...xs);
    const ys = [...pts.map((p) => p.value), ...main.map((p) => p.value)].filter((v) => v > 0);
    const y1 = (ys.length ? Math.max(...ys) : 1) * 1.08; const yMinPos = ys.length ? Math.min(...ys) : 0.01;
    const y0 = logScale ? Math.max(yMinPos / 2, y1 * 1e-5) : 0;
    const sx = (n) => M.l + (logScale ? (Math.log(n / x0) / Math.log(x1 / x0 || 2)) : ((n - x0) / ((x1 - x0) || 1))) * PW;
    const sy = (v) => M.t + PH - (logScale ? (Math.log(Math.max(v, y0) / y0) / Math.log(y1 / y0 || 2)) : (v / y1)) * PH;
    const path = (curve) => curve.map((p, i) => `${i ? 'L' : 'M'}${sx(p.n).toFixed(1)},${sy(p.value).toFixed(1)}`).join(' ');
    // linear axis: evenly spaced ticks (measured sizes crowd the left edge); log axis: the measured sizes themselves
    const xTicks = logScale
      ? (pts.length ? pts.map((p) => p.n) : [x0, x0 * Math.pow(x1 / x0, 1 / 3), x0 * Math.pow(x1 / x0, 2 / 3), x1]).filter((_, i, a) => a.length <= 6 || i % 2 === 0)
      : [0, 1, 2, 3, 4].map((i) => x0 + ((x1 - x0) * i) / 4);
    const yTicks = logScale
      ? [0, 1, 2, 3].map((i) => y0 * Math.pow(y1 / y0, i / 3))
      : [0, 1, 2, 3, 4].map((i) => (y1 * i) / 4);
    return { main, guides, pts, sx, sy, path, xTicks, yTicks, y1 };
  }, [isStatic, points, fitted, refs, staticId, logScale]);

  const showValues = !isStatic;
  return (
    <figure className="cx-chart">
      <figcaption>
        <strong>{title}</strong>
        <span className="cx-class">{label}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel || `${title}: ${label}`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="1">
            <stop offset="0" stopColor="#1f6688" /><stop offset="1" stopColor="#0bd37a" />
          </linearGradient>
        </defs>
        {/* grid + axes */}
        {model.yTicks.map((t, i) => (
          <g key={`y${i}`}>
            <line x1={M.l} x2={W - M.r} y1={model.sy(t)} y2={model.sy(t)} className="cx-grid" />
            <text x={M.l - 8} y={model.sy(t) + 4} textAnchor="end" className="cx-tick">{showValues ? fmtValue(t, unit) : ''}</text>
          </g>
        ))}
        {model.xTicks.map((t, i) => (
          <g key={`x${i}`}>
            <line x1={model.sx(t)} x2={model.sx(t)} y1={M.t + PH} y2={M.t + PH + 4} className="cx-axis" />
            <text x={model.sx(t)} y={M.t + PH + 17} textAnchor="middle" className="cx-tick">{fmtN(t)}</text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={M.t + PH} y2={M.t + PH} className="cx-axis" />
        <line x1={M.l} x2={M.l} y1={M.t} y2={M.t + PH} className="cx-axis" />
        <text x={M.l + PW / 2} y={H - 6} textAnchor="middle" className="cx-axis-label">input size n{logScale ? ' (log)' : ''}</text>
        <text transform={`translate(12 ${M.t + PH / 2}) rotate(-90)`} textAnchor="middle" className="cx-axis-label">{isStatic ? 'relative cost' : `${unit === 'KB' ? 'memory' : 'time'}${logScale ? ' (log)' : ''}`}</text>

        {/* reference guides */}
        {model.guides.map((g) => (
          <g key={g.id}>
            <path d={model.path(g.curve)} className="cx-ref" />
            {g.curve.length > 0 && (
              <text x={model.sx(g.curve[Math.floor(g.curve.length * 0.74)].n)} y={Math.max(M.t + 10, model.sy(g.curve[Math.floor(g.curve.length * 0.74)].value) - 6)} textAnchor="middle" className="cx-ref-label">{REF_LABEL[g.id]}</text>
            )}
          </g>
        ))}
        {/* fitted / theoretical curve */}
        <path d={model.path(model.main)} pathLength="1" className="cx-fit cx-draw" stroke={`url(#${gid})`} />
        {/* measured points */}
        {model.pts.map((p, i) => (
          <g key={p.n} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`n = ${p.n}: ${fmtValue(p.value, unit)}`}>
            <circle cx={model.sx(p.n)} cy={model.sy(p.value)} r={hover === i ? 7 : 4.5} className="cx-dot" style={{ animationDelay: `${300 + i * 60}ms` }} />
            <circle cx={model.sx(p.n)} cy={model.sy(p.value)} r="13" fill="transparent" />
          </g>
        ))}
        {hover != null && model.pts[hover] && (() => {
          const p = model.pts[hover]; const x = model.sx(p.n); const y = model.sy(p.value);
          const text = `n = ${p.n} → ${fmtValue(p.value, unit)}`; const w = text.length * 6.6 + 16;
          const tx = Math.min(Math.max(x - w / 2, M.l), W - M.r - w);
          const ty = y - 34 < M.t ? y + 12 : y - 34;
          return (
            <g pointerEvents="none">
              <rect x={tx} y={ty} width={w} height="24" rx="7" className="cx-tip" />
              <text x={tx + w / 2} y={ty + 16} textAnchor="middle" className="cx-tip-text">{text}</text>
            </g>
          );
        })()}
        {isStatic && (
          <text x={M.l + PW / 2} y={M.t + 14} textAnchor="middle" className="cx-ref-label">illustrative growth — not measured</text>
        )}
      </svg>
    </figure>
  );
}
