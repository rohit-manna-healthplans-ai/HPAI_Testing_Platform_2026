import { useMemo } from 'react';
import { loadBank } from '../bank/index.js';
import { Badge, Card, useAsync } from './ui.jsx';

/** Lists the fixed paper (and random fill) of a session. Public fields only — no answers. */
export default function SessionPaper({ session }) {
  const fixedIds = session.fixed_question_ids || [];
  const cfg = (session.subject_config || []).filter((c) => (c.easy || 0) + (c.medium || 0) + (c.hard || 0) > 0);
  const bank = useAsync(() => (fixedIds.length ? loadBank() : Promise.resolve(null)), [fixedIds.join('|')]);
  const byId = useMemo(() => new Map((bank.data?.QUESTIONS || []).map((q) => [q.id, q])), [bank.data]);
  const subjectName = useMemo(() => new Map((bank.data?.SUBJECTS || []).map((s) => [s.id, s.name])), [bank.data]);
  if (!fixedIds.length && !cfg.length) return null;
  const rows = fixedIds.map((id) => byId.get(id) || { id, title: id, difficulty: '', type: '', marks: 0, time_mins: 0, subject_name: '' });
  const total = rows.reduce((s, q) => s + (q.marks || 0), 0);
  return (
    <Card title="Paper" subtitle={fixedIds.length
      ? `${fixedIds.length} fixed question${fixedIds.length === 1 ? '' : 's'} (${total} marks) — every candidate gets these${cfg.length ? ', plus random fill' : ''}`
      : 'Random questions per candidate'}>
      {rows.length > 0 && (
        <div className="picker" style={{ maxHeight: 280 }}>
          {rows.map((q, i) => (
            <div key={q.id} className="row" style={{ padding: '8px 14px', borderBottom: '1px solid var(--line)' }}>
              <span className="muted small" style={{ width: 22 }}>{i + 1}</span>
              <span className="grow"><b>{q.title}</b><span className="muted small"> · {q.subject_name} · {q.marks} marks · {q.time_mins} min</span></span>
              {q.difficulty && <Badge tone={q.difficulty}>{q.difficulty}</Badge>}{q.type && <Badge>{q.type}</Badge>}
            </div>
          ))}
        </div>
      )}
      {cfg.length > 0 && (
        <p className="muted small" style={{ marginTop: rows.length ? 10 : 0 }}>
          Random: {cfg.map((c) => `${subjectName.get(c.subject_id) || c.subject_id} — ${c.easy || 0} easy, ${c.medium || 0} medium, ${c.hard || 0} hard`).join(' · ')}
        </p>
      )}
    </Card>
  );
}
