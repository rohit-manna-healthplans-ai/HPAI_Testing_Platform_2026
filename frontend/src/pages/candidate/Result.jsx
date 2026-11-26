import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import { Button, Card, CountUp, ErrorBox, ProgressBar, Spinner, prefersReducedMotion, useAsync, useToast } from '../../components/ui.jsx';
import { fmtDate, num, pct } from '../../utils/format.js';

// jsPDF is heavy: only fetched when the candidate actually clicks a download button.
const loadPdf = () => import('../../utils/pdf.js');

const RING_R = 90;
const RING_C = 2 * Math.PI * RING_R;
const CONFETTI_COLORS = ['#0bd37a', '#a2cfe2', '#1f6688', '#f0a23a', '#ffffff', '#65b2d1'];

/** Lightweight CSS-only confetti (transform/opacity); removed from the DOM after it finishes. */
function Confetti() {
  const [alive, setAlive] = useState(true);
  const pieces = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
    x: `${Math.round(Math.random() * 100)}%`,
    dx: `${Math.round((Math.random() - 0.5) * 220)}px`,
    d: `${(Math.random() * 0.9).toFixed(2)}s`,
    t: `${(2.6 + Math.random() * 1.8).toFixed(2)}s`,
    rot: `${Math.round(360 + Math.random() * 720)}deg`,
    c: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  })), []);
  useEffect(() => { const id = setTimeout(() => setAlive(false), 6000); return () => clearTimeout(id); }, []);
  if (!alive) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => <i key={i} style={{ '--x': p.x, '--dx': p.dx, '--d': p.d, '--t': p.t, '--rot': p.rot, '--c': p.c }} />)}
    </div>
  );
}

function ScoreRing({ score, max, percentage }) {
  const frac = Math.min(1, Math.max(0, percentage / 100));
  return (
    <div className="score-ring" role="img" aria-label={`Score ${score} out of ${max}, ${percentage} percent`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#65b2d1" /><stop offset="100%" stopColor="#0bd37a" /></linearGradient>
        </defs>
        <circle className="trk" cx="100" cy="100" r={RING_R} />
        <circle className="val" cx="100" cy="100" r={RING_R} style={{ '--circ': RING_C, '--off': RING_C * (1 - frac) }} />
      </svg>
      <div className="inner">
        <div className="score-big"><CountUp value={score} duration={1200} /><small> / {max}</small></div>
        <p className="muted"><CountUp value={`${percentage}%`} duration={1200} /></p>
      </div>
    </div>
  );
}

export default function Result() {
  const { attemptId } = useParams();
  const toast = useToast();
  const { loading, data: r, error, reload } = useAsync(() => api.candidate.result(attemptId), [attemptId]);
  const [busy, setBusy] = useState('');

  // Exit fullscreen if we arrived straight from the test.
  useEffect(() => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }, []);

  const run = async (kind, pick) => {
    setBusy(kind);
    try { const mod = await loadPdf(); await mod[pick](r); } catch (e) { toast(`Could not generate the file: ${e.message}`, 'error'); } finally { setBusy(''); }
  };

  if (loading) return <Spinner label="Loading your result…" />;
  if (error) return (
    <div className="stack">
      <ErrorBox error={error} onRetry={reload} />
      <div><Link to="/candidate" className="btn btn-ghost">← Back to assessments</Link></div>
    </div>
  );

  const percentage = num(r.percentage);
  const tone = percentage >= 60 ? '' : percentage >= 40 ? 'grade-Fair' : 'grade-Needs';
  const celebrate = percentage >= 60 && !prefersReducedMotion();

  return (
    <div className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      {celebrate && <Confetti />}
      <Card pad={false}>
        <div className="score-hero">
          <p className="muted small">{r.session_name} · Submitted {fmtDate(r.submitted_at)}</p>
          <h2 style={{ margin: '6px 0 0' }}>{r.candidate_name}</h2>
          <ScoreRing score={num(r.total_score)} max={num(r.max_score)} percentage={percentage} />
          <span className={`grade-pill ${tone}`}>{r.grade}</span>
        </div>
        <div className="row end" style={{ padding: '0 20px 22px', justifyContent: 'center' }}>
          <Button variant="ghost" loading={busy === 'pdf'} onClick={() => run('pdf', 'downloadResultPDF')}>⬇ Download result PDF</Button>
          <Button variant="success" className="btn-shine" loading={busy === 'cert'} onClick={() => run('cert', 'downloadCertificate')}>🏅 Download certificate</Button>
        </div>
      </Card>

      <Card title="Marks by subject">
        {(r.by_subject || []).length === 0 && <p className="muted">No subject breakdown available.</p>}
        {(r.by_subject || []).map((s) => {
          const p = pct(s.score, s.max);
          return (
            <div className="subject-row" key={s.subject}>
              <div className="row between"><strong>{s.subject}</strong><span><b>{num(s.score)}</b> <span className="muted">/ {num(s.max)} · {p}%</span></span></div>
              <ProgressBar value={s.score} max={s.max} tone={p >= 60 ? 'green' : p >= 40 ? 'amber' : 'red'} />
            </div>
          );
        })}
      </Card>
      <div style={{ textAlign: 'center' }}><Link to="/candidate" className="btn btn-ghost">← Back to assessments</Link></div>
    </div>
  );
}
