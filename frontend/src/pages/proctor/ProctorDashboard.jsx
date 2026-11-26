import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import AttemptReview from '../../components/AttemptReview.jsx';
import LiveMonitor from '../../components/LiveMonitor.jsx';
import { Badge, Button, Card, EmptyState, ErrorBox, ProgressBar, Spinner, StatCard, useAsync } from '../../components/ui.jsx';
import { useAuth } from '../../components/AuthContext.jsx';
import { fmtDate } from '../../utils/format.js';

export default function ProctorDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const sessions = useAsync(() => api.proctor.sessions(), []);
  const [review, setReview] = useState(null);
  const list = sessions.data || [];
  const live = list.reduce((n, s) => n + (s.in_progress_count || 0), 0);
  const done = list.reduce((n, s) => n + (s.submitted_count || 0), 0);
  const cands = list.reduce((n, s) => n + (s.candidate_count || 0), 0);

  return (
    <>
      <div className="page-head">
        <div><h1>Hello, {user.name.split(' ')[0]}</h1><p>Monitor live tests and review results for your candidates.</p></div>
        <Link to="/proctor/sessions/new" className="btn btn-primary">+ New session</Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Sessions" value={list.length} hint={`${list.filter((s) => s.status === 'open').length} open`} />
        <StatCard label="Live now" value={live} tone="amber" hint="Attempts in progress" />
        <StatCard label="Submitted" value={done} tone="green" hint={`of ${cands} assignments`} />
        <StatCard label="Candidates" value={cands} tone="red" hint="Across all sessions" />
      </div>

      <div className="stack">
        <LiveMonitor onOpenAttempt={setReview} onChanged={() => sessions.reload(true)} />
        <Card title="My sessions" actions={<Link to="/proctor/sessions" className="btn btn-sm btn-ghost">View all</Link>} pad={false}>
          <ErrorBox error={sessions.error} onRetry={sessions.reload} />
          {sessions.loading && !sessions.data ? <Spinner /> : list.length === 0 ? (
            <EmptyState title="No sessions yet" hint="Create a session to assign a test to your candidates."><Button onClick={() => nav('/proctor/sessions/new')}>Create session</Button></EmptyState>
          ) : (
            <div className="table-scroll"><table className="table stackable">
              <thead><tr><th scope="col">Session</th><th scope="col">Status</th><th scope="col">Progress</th><th scope="col">Created</th></tr></thead>
              <tbody>{list.slice(0, 6).map((s, i) => (
                <tr key={s.id} className="clickable" style={{ '--ri': i }} onClick={() => nav(`/proctor/sessions/${s.id}`)}>
                  <td data-label="Session"><strong>{s.name}</strong><div className="muted small">{s.duration_mins} min</div></td>
                  <td data-label="Status"><Badge tone={s.status === 'open' ? 'green' : 'gray'}>{s.status}</Badge></td>
                  <td data-label="Progress" style={{ minWidth: 180 }}><div className="small">{s.submitted_count}/{s.candidate_count} submitted{s.in_progress_count ? ` · ${s.in_progress_count} live` : ''}</div><ProgressBar value={s.submitted_count} max={s.candidate_count} /></td>
                  <td data-label="Created" className="muted">{fmtDate(s.created_at)}</td>
                </tr>))}</tbody>
            </table></div>
          )}
        </Card>
      </div>
      <AttemptReview attemptId={review} onClose={() => setReview(null)} />
    </>
  );
}
