import { fmtNum, niceTicks } from './chartUtils.js';

const W = 480; const H = 290; const M = { l: 50, r: 16, t: 34, b: 44 };

/** Scatter plot with an optional fitted line. Pure SVG; points pop in, the line draws on mount. */
export default function ScatterRegression({ title, xLabel, yLabel, points = [], line = null }) {
  const pts = (points || []).filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])).slice(0, 60);
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const xt = niceTicks(Math.min(...xs, 0), Math.max(...xs, 1), 5);
  const yt = niceTicks(Math.min(...ys, 0), Math.max(...ys, 1), 5);
  const x0 = xt[0]; const x1 = xt[xt.length - 1]; const y0 = yt[0]; const y1 = yt[yt.length - 1];
  const sx = (v) => M.l + ((v - x0) / (x1 - x0 || 1)) * (W - M.l - M.r);
  const sy = (v) => H - M.b - ((v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  let seg = null;
  if (line && Number.isFinite(line.m) && Number.isFinite(line.b)) {
    const a = { x: x0, y: line.m * x0 + line.b }; const b = { x: x1, y: line.m * x1 + line.b };
    seg = [sx(a.x), sy(Math.max(y0, Math.min(y1, a.y))), sx(b.x), sy(Math.max(y0, Math.min(y1, b.y)))];
  }
  const len = seg ? Math.hypot(seg[2] - seg[0], seg[3] - seg[1]) : 0;
  return (
    <figure className="ix-visual">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title || 'Scatter plot with regression line'} className="ix-svg">
        {title && <text x={M.l} y="20" className="ix-vt">{title}</text>}
        {yt.map((v) => (
          <g key={`y${v}`}><line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} className="ix-grid" /><text x={M.l - 7} y={sy(v) + 4} textAnchor="end" className="ix-tick">{fmtNum(v)}</text></g>
        ))}
        {xt.map((v) => (
          <g key={`x${v}`}><line x1={sx(v)} x2={sx(v)} y1={H - M.b} y2={H - M.b + 4} className="ix-axis" /><text x={sx(v)} y={H - M.b + 17} textAnchor="middle" className="ix-tick">{fmtNum(v)}</text></g>
        ))}
        <line x1={M.l} x2={M.l} y1={M.t - 6} y2={H - M.b} className="ix-axis" />
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} className="ix-axis" />
        {xLabel && <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="ix-axl">{xLabel}</text>}
        {yLabel && <text transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" className="ix-axl">{yLabel}</text>}
        {pts.map((p, i) => (
          <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="4.4" className="ix-dot ix-pop" style={{ animationDelay: `${i * 22}ms` }} />
        ))}
        {seg && <line x1={seg[0]} y1={seg[1]} x2={seg[2]} y2={seg[3]} className="ix-fit ix-draw" style={{ '--len': len }} />}
      </svg>
      {seg && <figcaption className="ix-cap"><i className="ix-swatch fit" /> fitted line <i className="ix-swatch dot" /> observations</figcaption>}
    </figure>
  );
}
