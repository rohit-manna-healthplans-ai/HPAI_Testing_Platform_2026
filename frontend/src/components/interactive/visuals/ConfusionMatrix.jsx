const W = 360; const H = 252;

/** n x n confusion matrix: diagonal cells tinted green, errors tinted red, intensity = share of the biggest cell. */
export default function ConfusionMatrix({ title, labels = ['Negative', 'Positive'], matrix = [[0, 0], [0, 0]] }) {
  const n = Math.max(2, Math.min(4, labels.length || matrix.length));
  const max = Math.max(1, ...matrix.flat().filter(Number.isFinite));
  const left = 78; const top = 62; const cw = Math.min(110, (W - left - 12) / n); const ch = Math.min(86, (H - top - 22) / n);
  return (
    <figure className="ix-visual">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title || 'Confusion matrix'} className="ix-svg">
        {title && <text x="14" y="20" className="ix-vt">{title}</text>}
        <text x={left + (cw * n) / 2} y={top - 24} textAnchor="middle" className="ix-axl">Predicted</text>
        <text transform={`translate(16 ${top + (ch * n) / 2}) rotate(-90)`} textAnchor="middle" className="ix-axl">Actual</text>
        {labels.slice(0, n).map((l, j) => <text key={`c${j}`} x={left + j * cw + cw / 2} y={top - 8} textAnchor="middle" className="ix-tick strong">{l}</text>)}
        {labels.slice(0, n).map((l, i) => <text key={`r${i}`} x={left - 8} y={top + i * ch + ch / 2 + 4} textAnchor="end" className="ix-tick strong">{l}</text>)}
        {Array.from({ length: n }).map((_, i) => Array.from({ length: n }).map((__, j) => {
          const v = matrix?.[i]?.[j] ?? 0;
          const a = 0.16 + 0.74 * (v / max);
          const good = i === j;
          return (
            <g key={`${i}-${j}`} className="ix-cell ix-pop" style={{ animationDelay: `${(i * n + j) * 90}ms` }}>
              <rect x={left + j * cw + 2} y={top + i * ch + 2} width={cw - 4} height={ch - 4} rx="9" fill={good ? '#0bd37a' : '#e0526a'} fillOpacity={a} stroke={good ? '#0aa862' : '#c33e56'} strokeOpacity=".35" />
              <text x={left + j * cw + cw / 2} y={top + i * ch + ch / 2 + 6} textAnchor="middle" className="ix-cellnum">{v}</text>
            </g>
          );
        }))}
      </svg>
    </figure>
  );
}
