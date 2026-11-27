// Single lazy-loaded entry for the three drag & drop question types.
//   default export  InteractiveQuestion   – candidate (editable) or read-only
//   InteractivePreview                    – admin / proctor question preview (public fields; admin may pass `solution` after "Reveal answers")
//   InteractiveResponseSummary            – compact read-only view of a candidate's saved response (staff attempt review)
import './interactive.css';
import SequenceQuestion from './SequenceQuestion.jsx';
import MatchQuestion from './MatchQuestion.jsx';
import ArchitectureQuestion from './ArchitectureQuestion.jsx';
import { interactiveFromResponse } from './meta.js';

export default function InteractiveQuestion({ question, value, onChange, readOnly = false, hideScenario = false }) {
  const v = interactiveFromResponse(question, value);
  const common = { question, value: v, onChange, readOnly, hideScenario };
  if (question.type === 'sequence') return <SequenceQuestion {...common} />;
  if (question.type === 'match') return <MatchQuestion {...common} />;
  if (question.type === 'architecture') return <ArchitectureQuestion {...common} />;
  return null;
}

/** The answer as a response object, so the read-only components can draw it. */
function solutionAsValue(q, solution) {
  if (!solution) return {};
  if (q.type === 'sequence') return { order: solution.order || [] };
  if (q.type === 'match') return { pairs: solution.pairs || {} };
  if (q.type === 'architecture') {
    const placed = {}; const used = new Set();
    Object.entries(solution.solution || {}).forEach(([slot, ok]) => {
      const pick = (Array.isArray(ok) ? ok : [ok]).find((id) => !used.has(id));
      if (pick) { placed[slot] = pick; used.add(pick); }
    });
    return { placed };
  }
  return {};
}

export function InteractivePreview({ question, solution }) {
  const revealed = !!solution;
  const q = question;
  const slotLabel = new Map((q.config?.slots || []).map((s) => [s.id, s.label]));
  const palLabel = new Map((q.config?.palette || []).map((p) => [p.id, p.label]));
  return (
    <div className="ix-preview">
      <InteractiveQuestion question={q} value={solutionAsValue(q, solution)} readOnly />
      {!revealed && <p className="ix-previewnote">This is what candidates see (steps/services are shuffled). Answers are sealed.</p>}
      {revealed && q.type === 'sequence' && (
        <p className="ix-previewnote ok">Answer revealed: the numbered order above is one valid order. Scoring uses {(solution.constraints || []).length || q.test_count || 0} “step A before step B” rules, so other valid orders also score fully.</p>
      )}
      {revealed && q.type === 'match' && <p className="ix-previewnote ok">Answer revealed: each service is shown on its correct description.</p>}
      {revealed && q.type === 'architecture' && (
        <div className="ix-previewnote ok">
          <b>Answer revealed</b> — accepted services per box:
          <ul>{Object.entries(solution.solution || {}).map(([slot, ok]) => <li key={slot}><b>{slotLabel.get(slot) || slot}</b>: {(Array.isArray(ok) ? ok : [ok]).map((id) => palLabel.get(id) || id).join(' / ')}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export function InteractiveResponseSummary({ question, response }) {
  const cfg = question.config || {};
  const v = interactiveFromResponse(question, response);
  if (question.type === 'sequence') {
    const L = new Map((cfg.items || []).map((i) => [i.id, i.label]));
    const left = (cfg.items || []).filter((i) => !v.order.includes(i.id));
    return (
      <div className="ix-summary">
        {v.order.length ? <ol>{v.order.map((id) => <li key={id}>{L.get(id)}</li>)}</ol> : <span className="ix-muted">No steps placed.</span>}
        {left.length > 0 && <p className="ix-muted">Not placed: {left.map((i) => i.label).join(', ')}</p>}
      </div>
    );
  }
  if (question.type === 'match') {
    const L = new Map((cfg.left || []).map((i) => [i.id, i.label]));
    const R = new Map((cfg.right || []).map((i) => [i.id, i.text]));
    const rows = Object.entries(v.pairs);
    return (
      <div className="ix-summary">
        {rows.length ? <ul>{rows.map(([l, r]) => <li key={l}><b>{L.get(l)}</b> → {R.get(r)}</li>)}</ul> : <span className="ix-muted">Nothing matched.</span>}
        {(cfg.left || []).length > rows.length && <p className="ix-muted">Unmatched: {(cfg.left || []).filter((i) => !v.pairs[i.id]).map((i) => i.label).join(', ')}</p>}
      </div>
    );
  }
  if (question.type === 'architecture') {
    const P = new Map((cfg.palette || []).map((i) => [i.id, i.label]));
    return (
      <div className="ix-summary">
        <ul>{(cfg.slots || []).map((s) => <li key={s.id}><b>{s.label}</b> → {v.placed[s.id] ? P.get(v.placed[s.id]) : <span className="ix-muted">empty</span>}</li>)}</ul>
      </div>
    );
  }
  return null;
}
