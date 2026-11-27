// Staff attempt review: compact, read-only rendering of a candidate's saved drag & drop response (public question fields only).
import { useEffect, useState } from 'react';
import { getQuestionById } from '../../bank/index.js';
import './interactive.css';
import { InteractiveResponseSummary } from './InteractiveQuestion.jsx';

export default function ReviewResponse({ questionId, response }) {
  const [q, setQ] = useState(undefined);
  useEffect(() => {
    let alive = true;
    getQuestionById(questionId).then((x) => { if (alive) setQ(x || null); }).catch(() => { if (alive) setQ(null); });
    return () => { alive = false; };
  }, [questionId]);
  if (q === undefined) return <span className="ix-muted small">Loading…</span>;
  if (!q) return <span className="ix-muted small">Question not found in this bank version.</span>;
  return <div className="ix"><InteractiveResponseSummary question={q} response={response} /></div>;
}
