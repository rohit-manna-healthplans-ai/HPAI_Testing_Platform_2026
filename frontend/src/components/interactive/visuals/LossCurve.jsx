import { fmtNum, niceTicks } from './chartUtils.js';

const W = 480; const H = 290; const M = { l: 50, r: 16, t: 34, b: 44 };
const COLORS = ['#1f6688', '#f2a93b', '#0bd37a', '#e0526a'];

/** One or more series over epochs (e.g. train vs validation loss). The lines draw themselves on mount. */
export default function LossCurve({ title, xLabel = 'Epoch', yLabel = 'Loss', series = [] }) {
  const ss = (series || []).slice(0, 4).map((s) => ({ name: s.name, values: (s.values || []).filter(Number.isFinite) })).filter((s) => s.values.length);
  const n = Math.max(2, ...ss.map((s) => s.values.length));
  const all = ss.flatMap((s) => s.values);
  const yt = niceTicks(Math.min(...all, 0), Math.max(...all, 1), 5);
  const y0 = yt[0]; const y1 = yt[yt.length - 1];
  const sx = (i) => M.l + (i / (n - 1)) * (W - M.l - M.r);
  const sy = (v) => H - M.b - ((v - y0) / (y1 - y0 || 1)) * (H - M.t - M.b);
  const xticks = niceTicks(1, n, 6).filter((v) => v >= 1 && v <= n).map((v) => v - 1); // epoch numbers on round values
  return (
    <figure className="ix-visual">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title || 'Loss curve'} className="ix-svg">
        {title && <text x={M.l} y="20" className="ix-vt">{title}</text>}
        {yt.map((v) => <g key={v}><line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} className="ix-grid" /><text x={M.l - 7} y={sy(v) + 4} textAnchor="end" className="ix-tick">{fmtNum(v)}</text></g>)}
        {[...new Set(xticks)].map((i) => <text key={i} x={sx(i)} y={H - M.b + 17} textAnchor="middle" className="ix-tick">{i + 1}</text>)}
        <line x1={M.l} x2={M.l} y1={M.t - 6} y2={H - M.b} className="ix-axis" />
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} className="ix-axis" />
        <text x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle" className="ix-axl">{xLabel}</text>
        <text transform={`translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle" className="ix-axl">{yLabel}</text>
        {ss.map((s, k) => {
          const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join(' ');
          const len = s.values.reduce((a, v, i) => (i ? a + Math.hypot(sx(i) - sx(i - 1), sy(v) - sy(s.values[i - 1])) : 0), 0);
          const last = s.values.length - 1;
          return (
            <g key={k}>
              <path d={d} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="ix-draw" style={{ '--len': Math.ceil(len) + 4, animationDelay: `${k * 220}ms` }} />
              <circle cx={sx(last)} cy={sy(s.values[last])} r="4" fill={COLORS[k % COLORS.length]} className="ix-pop" style={{ animationDelay: `${700 + k * 220}ms` }} />
            </g>
          );
        })}
      </svg>
      <figcaption className="ix-cap">{ss.map((s, k) => <span key={k}><i className="ix-swatch" style={{ background: COLORS[k % COLORS.length] }} /> {s.name}</span>)}</figcaption>
    </figure>
  );
}
