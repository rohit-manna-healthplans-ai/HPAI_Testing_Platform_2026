import { useEffect, useRef, useState } from 'react';
import { Badge, Button, ProgressBar } from './ui.jsx';
import ComplexityChart from './ComplexityChart.jsx';
import { analyzeAnswer, cacheKey, isAnalyzable, loadCached, saveCached, MEASURABLE } from '../analysis/analyze.js';
import './complexity.css';

const CONF = { high: ['green', 'High confidence'], medium: ['blue', 'Medium confidence'], low: ['amber', 'Low confidence'] };

/** Reviewer tool: time & space complexity (measured when possible, static otherwise) with graphs. */
export default function ComplexityPanel({ attemptId, answer }) {
  const key = cacheKey(attemptId, answer);
  const [result, setResult] = useState(() => loadCached(key));
  const [state, setState] = useState({ running: false, done: 0, total: 0, n: null, error: null });
  const [logScale, setLogScale] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setResult(loadCached(key)); }, [key]);

  if (!isAnalyzable(answer)) return null;
  const language = answer.response.language;
  const measurable = MEASURABLE.has(language) && answer.response.mode !== 'syntax_only';

  const run = async () => {
    setState({ running: true, done: 0, total: 0, n: null, error: null });
    try {
      const r = await analyzeAnswer(answer, {
        onProgress: ({ n, done, total }) => { if (alive.current) setState((s) => ({ ...s, done, total, n })); },
      });
      if (!alive.current) return;
      setResult(r); saveCached(key, r);
      setState({ running: false, done: 0, total: 0, n: null, error: null });
    } catch (e) {
      if (alive.current) setState({ running: false, done: 0, total: 0, n: null, error: e?.message || 'Analysis failed.' });
    }
  };

  const t = result?.time; const s = result?.space;
  const measuredAny = t?.source === 'measured' || s?.source === 'measured';

  return (
    <section className="cx-panel" aria-label="Complexity analysis">
      <div className="cx-head">
        <div className="cx-title">
          <span className="cx-glyph" aria-hidden="true">⏱</span>
          <div>
            <strong>Time &amp; space complexity</strong>
            <span className="muted small">{measurable ? 'Measured in this browser, with a static cross-check' : 'Static estimate — this language is not executed'}</span>
          </div>
        </div>
        <div className="cx-actions">
          {result && (
            <div className="cx-seg" role="group" aria-label="Chart scale">
              <button type="button" aria-pressed={!logScale} onClick={() => setLogScale(false)}>Linear</button>
              <button type="button" aria-pressed={logScale} onClick={() => setLogScale(true)}>Log-log</button>
            </div>
          )}
          <Button variant={result ? 'ghost' : 'primary'} size="sm" loading={state.running} onClick={run}>{result ? 'Re-run' : 'Analyze complexity'}</Button>
        </div>
      </div>

      {state.running && (
        <div className="cx-progress" role="status" aria-live="polite">
          <ProgressBar value={state.total ? state.done : 0} max={state.total || 1} tone="blue" />
          <span className="muted small">{measurable ? (state.n ? `Measured n = ${state.n} (${state.done}/${state.total})…` : 'Starting runner (Python may need to download its runtime)…') : 'Analyzing code structure…'}</span>
        </div>
      )}
      {state.error && <div className="cx-alert" role="alert">{state.error}</div>}

      {result && !state.running && (
        <div className="cx-body">
          <div className="cx-badges">
            <div className="cx-big"><span>Time</span><b>{t.label}</b>{t.confidence && <Badge tone={CONF[t.confidence][0]}>{CONF[t.confidence][1]}</Badge>}<em className={`cx-src ${t.source}`}>{t.source === 'measured' ? 'measured' : 'static estimate'}</em></div>
            <div className="cx-big"><span>Space</span><b>{s.label}</b>{s.confidence && <Badge tone={CONF[s.confidence][0]}>{CONF[s.confidence][1]}</Badge>}<em className={`cx-src ${s.source}`}>{s.source === 'measured' ? 'measured' : 'static estimate'}</em></div>
          </div>

          {result.error && <div className="cx-alert" role="alert">{result.error}{result.reason === 'error' && t.source === 'static' ? ' Showing the static estimate instead.' : ''}</div>}
          {measuredAny && result.generic && <p className="cx-note">Inputs were generated from the problem’s sample types (no dedicated benchmark inputs for this question).</p>}
          {t.source === 'static' && measurable && !result.error && (
            <p className="cx-note">{t.note ? `Not enough measurements: ${t.note} ` : ''}{result.reason === 'budget' || result.reason === 'timeout' ? 'The code was too slow to measure over a wide enough range, so the static estimate is shown.' : 'Showing the static estimate.'}</p>
          )}
          {t.source === 'measured' && t.staticLabel && t.staticLabel !== t.label && (
            <p className="cx-note">Static analysis of the code suggests <b>{t.staticLabel}</b> time — the measurement above is usually more reliable for the tested range.</p>
          )}

          <div className="cx-charts">
            <ComplexityChart title="Time" unit="ms" label={t.label} mode={t.source} points={t.points || []} fitted={t.fitted || []} refs={t.refs || []} staticId={t.id} logScale={logScale} />
            <ComplexityChart title="Space" unit="KB" label={s.label} mode={s.source} points={s.points || []} fitted={s.fitted || []} refs={s.refs || []} staticId={s.id} logScale={logScale} />
          </div>

          {result.staticResult?.notes?.length > 0 && (
            <details className="cx-why">
              <summary>Why this estimate?</summary>
              <ul>{result.staticResult.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              <p className="muted small">Analyzed function: <code>{result.staticResult.function || '—'}</code> · parser: {result.staticResult.parser}</p>
            </details>
          )}
          <p className="cx-caveat">{measuredAny ? 'Empirical estimate on this browser — treat as indicative.' : 'Static estimate (not measured) — treat as indicative.'}</p>
        </div>
      )}
    </section>
  );
}
