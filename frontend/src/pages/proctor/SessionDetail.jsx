import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import AttemptReview from '../../components/AttemptReview.jsx';
import DataTable from '../../components/DataTable.jsx';
import InvitePanel from '../../components/InvitePanel.jsx';
import SessionPaper from '../../components/SessionPaper.jsx';
import { Badge, Button, Card, ConfirmDialog, ErrorBox, Spinner, StatCard, useAsync, useInterval, useToast } from '../../components/ui.jsx';
import { ATTEMPT_STATUS, downloadCSV, fmtDate, num } from '../../utils/format.js';
import '../../components/invites.css';

export default function SessionDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { loading, data, error, reload } = useAsync(() => api.proctor.session(id), [id]);
  const [review, setReview] = useState(null);
  const [confirm, setConfirm] = useState(false);

  // Keep the candidate list fresh while attempts are running.
  useInterval(() => reload(true), 15000);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const { session, candidates } = data;
  const rows = candidates.map((c) => ({ ...c, id: c.candidate_id, status: c.attempt?.status || 'not_started' }));
  const submitted = rows.filter((r) => r.attempt && r.attempt.status !== 'in_progress');
  const live = rows.filter((r) => r.attempt?.status === 'in_progress').length;
  const avg = submitted.length ? submitted.reduce((s, r) => s + Number(r.attempt.percentage || 0), 0) / submitted.length : 0;
  const open = session.status === 'open';

  const setStatus = async () => {
    try { await api.proctor.updateSession(id, { status: open ? 'closed' : 'open' }); toast(open ? 'Session closed' : 'Session reopened', 'success'); reload(true); } catch (e) { toast(e.message, 'error'); }
    setConfirm(false);
  };

  const cols = [
    { key: 'name', label: 'Candidate', render: (r) => <div className="name-cell"><strong>{r.name}</strong><span>{r.email}</span></div> },
    { key: 'tester_id', label: 'Tester ID', render: (r) => (r.tester_id ? <span className="tester-chip">{r.tester_id}</span> : <span className="muted">—</span>) },
    { key: 'status', label: 'Status', render: (r) => { if (!r.attempt) return <Badge>Not started</Badge>; const s = ATTEMPT_STATUS[r.attempt.status] || { label: r.attempt.status, tone: 'gray' }; return <Badge tone={s.tone}>{s.label}</Badge>; } },
    { key: 'started', label: 'Started', sortValue: (r) => r.attempt?.started_at || '', render: (r) => fmtDate(r.attempt?.started_at) },
    { key: 'submitted', label: 'Submitted', sortValue: (r) => r.attempt?.submitted_at || '', render: (r) => fmtDate(r.attempt?.submitted_at) },
    { key: 'score', label: 'Score', sortValue: (r) => Number(r.attempt?.total_score ?? -1), render: (r) => (!r.attempt || r.attempt.status === 'in_progress' ? '—' : <b>{num(r.attempt.total_score)}<span className="muted"> / {num(r.attempt.max_score)}</span></b>) },
    { key: 'pct', label: '%', sortValue: (r) => Number(r.attempt?.percentage ?? -1), render: (r) => (!r.attempt || r.attempt.status === 'in_progress' ? '—' : `${num(r.attempt.percentage)}%`) },
    { key: 'flags', label: 'Flags', sortValue: (r) => r.attempt?.flag_count ?? 0, render: (r) => (r.attempt ? <span className={r.attempt.flag_count === 0 ? 'flag-0' : r.attempt.flag_count < 5 ? 'flag-low' : 'flag-high'}>{r.attempt.flag_count}</span> : '—') },
    { key: 'actions', label: '', sortable: false, className: 'right', render: (r) => (r.attempt ? <div className="cell-actions"><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setReview(r.attempt.id); }}>Review</Button></div> : null) },
  ];

  const exportCsv = () => downloadCSV(`${session.name.replace(/\W+/g, '_')}_results.csv`, [
    { label: 'Tester ID', value: (r) => r.tester_id }, { label: 'Candidate', value: (r) => r.name }, { label: 'Email', value: (r) => r.email }, { label: 'Status', value: (r) => r.attempt?.status || 'not_started' },
    { label: 'Started', value: (r) => r.attempt?.started_at }, { label: 'Submitted', value: (r) => r.attempt?.submitted_at },
    { label: 'Score', value: (r) => r.attempt?.total_score }, { label: 'Max', value: (r) => r.attempt?.max_score }, { label: 'Percentage', value: (r) => r.attempt?.percentage },
    { label: 'Flags', value: (r) => r.attempt?.flag_count },
  ], rows);

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/proctor/sessions" className="small">← All sessions</Link>
          <h1 style={{ marginTop: 6 }}>{session.name} <Badge tone={open ? 'green' : 'gray'}>{session.status}</Badge></h1>
          <p>{session.duration_mins} min · created {fmtDate(session.created_at)}{session.opens_at ? ` · opens ${fmtDate(session.opens_at)}` : ''}{session.closes_at ? ` · closes ${fmtDate(session.closes_at)}` : ''}</p>
        </div>
        <div className="row">
          <Button variant="ghost" onClick={exportCsv}>⬇ Export CSV</Button>
          <Button variant={open ? 'danger' : 'success'} onClick={() => setConfirm(true)}>{open ? 'Close session' : 'Reopen session'}</Button>
        </div>
      </div>
      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Candidates" value={rows.length} />
        <StatCard label="Live" value={live} tone="amber" />
        <StatCard label="Submitted" value={submitted.length} tone="green" />
        <StatCard label="Average" value={`${num(avg)}%`} tone="red" hint="Submitted attempts" />
      </div>
      <div style={{ marginBottom: 16 }}><SessionPaper session={session} /></div>
      <Card title="Candidates" pad={false}>
        <ErrorBox error={error} onRetry={reload} />
        <DataTable columns={cols} rows={rows} searchKeys={['name', 'email', 'tester_id']} onRowClick={(r) => r.attempt && setReview(r.attempt.id)} toolbar={<Button size="sm" variant="ghost" onClick={() => reload(true)}>↻ Refresh</Button>} />
      </Card>
      <div style={{ marginTop: 16 }}><InvitePanel sessionId={id} sessionOpen={open} onChanged={() => reload(true)} /></div>
      <AttemptReview attemptId={review} onClose={() => setReview(null)} />
      <ConfirmDialog open={confirm} danger={open} title={open ? 'Close this session?' : 'Reopen this session?'}
        message={open ? 'Candidates who have not started will no longer be able to begin. Running attempts continue until their timer ends.' : 'Candidates will be able to start again.'}
        confirmLabel={open ? 'Close session' : 'Reopen'} onCancel={() => setConfirm(false)} onConfirm={setStatus} />
    </>
  );
}
