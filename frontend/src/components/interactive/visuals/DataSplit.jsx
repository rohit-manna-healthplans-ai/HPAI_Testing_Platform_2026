import { TONE } from './chartUtils.js';

/** Horizontal stacked bar (e.g. 70 / 15 / 15 train-validation-test). Segments grow in on mount. */
export default function DataSplit({ title, segments = [] }) {
  const segs = (segments || []).filter((s) => Number.isFinite(s.percent) && s.percent > 0);
  const total = segs.reduce((a, s) => a + s.percent, 0) || 1;
  return (
    <figure className="ix-visual ix-split">
      {title && <div className="ix-vt-html">{title}</div>}
      <div className="ix-splitbar" role="img" aria-label={title || 'Data split'}>
        {segs.map((s, i) => (
          <div key={i} className="ix-splitseg ix-grow" style={{ width: `${(s.percent / total) * 100}%`, background: TONE[s.tone] || TONE.blue, animationDelay: `${i * 140}ms` }} title={`${s.label}: ${s.percent}%`}>
            <b>{s.percent}%</b><span>{s.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
