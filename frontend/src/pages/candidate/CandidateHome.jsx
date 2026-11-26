import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../components/AuthContext.jsx';
import TestRules from '../../components/TestRules.jsx';
import { Badge, Button, Card, EmptyState, ErrorBox, Modal, Spinner, useAsync, useToast } from '../../components/ui.jsx';

export default function CandidateHome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { loading, data, error, reload } = useAsync(() => api.candidate.sessions(), []);
  const [pending, setPending] = useState(null);
  const [agree, setAgree] = useState(false);
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      const res = await api.candidate.start(pending.id);
      // Fullscreen needs a user gesture; this click counts.
      try { await document.documentElement.requestFullscreen?.(); } catch { /* not fatal */ }
      nav(`/test/${res.attempt.id}`);
    } catch (e) {
      toast(e.message, 'error');
      setStarting(false);
    }
  };

  const open = (s) => { setAgree(false); setStarting(false); setPending(s); };

  return (
    <>
      <div className="page-head">
        <div><h1>Welcome, {user.name.split(' ')[0]}</h1><p>Your assigned assessments are listed below.</p></div>
      </div>
      {loading && <Spinner />}
      <ErrorBox error={error} onRetry={reload} />
      {!loading && !error && (data || []).length === 0 && (
        <Card><EmptyState title="No assessments assigned" hint="Your proctor will assign an assessment to you. Check back soon." /></Card>
      )}
      <div className="grid grid-2">
        {(data || []).map((s) => {
          const a = s.attempt;
          const done = a && a.status !== 'in_progress';
          return (
            <Card key={s.id} className="session-card" pad={false}>
              <div className="session-card">
                <div className="row between">
                  <h3>{s.name}</h3>
                  {done ? <Badge tone="green">Submitted</Badge> : a ? <Badge tone="blue">In progress</Badge> : s.status === 'open' ? <Badge tone="amber">Not started</Badge> : <Badge tone="gray">Closed</Badge>}
                </div>
                <div className="session-meta">
                  <span>⏱ <b>{s.duration_mins}</b> min</span>
                  <span>❓ <b>{s.question_count}</b> questions</span>
                  <span>🎯 <b>{s.total_marks}</b> marks</span>
                  <span>👤 Proctor: <b>{s.proctor_name || '—'}</b></span>
                </div>
                <div className="row">
                  {done && <Button onClick={() => nav(`/result/${a.id}`)}>View result</Button>}
                  {a && !done && <Button variant="success" onClick={() => nav(`/test/${a.id}`)}>Resume assessment</Button>}
                  {!a && s.status === 'open' && <Button variant="success" onClick={() => open(s)}>Start assessment</Button>}
                  {!a && s.status !== 'open' && <span className="muted small">This session is closed.</span>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={!!pending} title={pending ? `Before you begin — ${pending.name}` : ''} onClose={() => !starting && setPending(null)}
        footer={<><Button variant="ghost" onClick={() => setPending(null)} disabled={starting}>Cancel</Button><Button variant="success" disabled={!agree} loading={starting} onClick={start}>Start now</Button></>}>
        {pending && (
          <div className="stack">
            <div className="alert alert-info">You have <b>{pending.duration_mins} minutes</b>. The timer starts as soon as you click “Start now” and cannot be paused.</div>
            <TestRules />
            <label className="checkbox"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read and agree to follow these rules.</label>
          </div>
        )}
      </Modal>
    </>
  );
}
