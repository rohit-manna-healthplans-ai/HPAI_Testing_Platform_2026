// Small helpers shared by the SVG visuals.
export function niceTicks(min, max, count = 5) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  const raw = span / Math.max(1, count - 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const err = raw / pow;
  const step = (err >= 5 ? 10 : err >= 2.5 ? 5 : err >= 1.2 ? 2 : 1) * pow;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const out = [];
  for (let v = start; v <= end + step * 0.001; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export function fmtNum(v) {
  if (!Number.isFinite(v)) return '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${+(v / 1e6).toFixed(2)}M`;
  if (a >= 1e4) return `${+(v / 1e3).toFixed(1)}k`;
  if (a >= 100) return String(Math.round(v));
  return String(+v.toFixed(2));
}

export const TONE = { sky: '#7fb9d3', blue: '#1f6688', green: '#0bd37a', navy: '#173f59', amber: '#f2a93b', red: '#e0526a' };
