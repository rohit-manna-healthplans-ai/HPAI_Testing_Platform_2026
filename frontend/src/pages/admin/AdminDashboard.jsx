import { useMemo, useState } from 'react';
import { api } from '../../api.js';
import DataTable from '../../components/DataTable.jsx';
import { Badge, Button, Card, ErrorBox, Spinner, StatCard, useAsync } from '../../components/ui.jsx';
import { ATTEMPT_STATUS, downloadCSV, fmtDate, fmtDuration, num } from '../../utils/format.js';
import '../../components/invites.css';

export const attemptColumns = [
  { key: 'tester_id', label: 'Tester ID', render: (r) => (r.tester_id ? <span className="tester-chip">{r.tester_id}</span> : <span className="muted">—</span>) },
  { key: 'candidate_name', label: 'Candidate', render: (r) => <div className="name-cell"><strong>{r.candidate_name}</strong><span>{r.candidate_email}</span></div> },
  { key: 'proctor_name', label: 'Proctor' },
  { key: 'session_name', label: 'Session' },
  { key: 'status', label: 'Status', render: (r) => { const s = ATTEMPT_STATUS[r.status] || { label: r.status, tone: 'gray' }; return <Badge tone={s.tone}>{s.label}</Badge>; } },
  { key: 'started_at', label: 'Started', render: (r) => fmtDate(r.started_at) },
  { key: 'submitted_at', label: 'Submitted', render: (r) => fmtDate(r.submitted_at) },
  { key: 'duration_taken_sec', label: 'Time taken', render: (r) => fmtDuration(r.duration_taken_sec) },
  { key: 'total_score', label: 'Score', sortValue: (r) => Number(r.total_score), render: (r) => r.status === 'in_progress' ? '—' : <b>{num(r.total_score)}<span className="muted"> / {num(r.max_score)}</span></b> },
  { key: 'percentage', label: '%', sortValue: (r) => Number(r.percentage), render: (r) => r.status === 'in_progress' ? '—' : `${num(r.percentage)}%` },
  { key: 'flag_count', label: 'Flags', render: (r) => <span className={r.flag_count === 0 ? 'flag-0' : r.flag_count < 5 ? 'flag-low' : 'flag-high'}>{r.flag_count}</span> },
];

export const attemptCsvColumns = [
  { label: 'Tester ID', value: (r) => r.tester_id },
  { label: 'Candidate', value: (r) => r.candidate_name }, { label: 'Email', value: (r) => r.candidate_email },
  { label: 'Proctor', value: (r) => r.proctor_name }, { label: 'Session', value: (r) => r.session_name },
  { label: 'Status', value: (r) => r.status }, { label: 'Started', value: (r) => r.started_at },
  { label: 'Submitted', value: (r) => r.submitted_at }, { label: 'Duration (sec)', value: (r) => r.duration_taken_sec },
  { label: 'Score', value: (r) => r.total_score }, { label: 'Max', value: (r) => r.max_score },
  { label: 'Percentage', value: (r) => r.percentage }, { label: 'Flags', value: (r) => r.flag_count },
];

export default function AdminDashboard() {
  const stats = useAsync(() => api.admin.stats(), []);
  const attempts = useAsync(() => api.admin.attempts(), []);
  const [f, setF] = useState({ proctor: '', status: '', session: '' });

  const rows = attempts.data || [];
  const opts = useMemo(() => ({
    proctors: [...new Set(rows.map((r) => r.proctor_name).filter(Boolean))].sort(),
    sessions: [...new Set(rows.map((r) => r.session_name).filter(Boolean))].sort(),
  }), [rows]);
  const filtered = rows.filter((r) => (!f.proctor || r.proctor_name === f.proctor) && (!f.status || r.status === f.status) && (!f.session || r.session_name === f.session));

  const s = stats.data;
  return (
    <>
      <div className="page-head">
        <div><h1>Admin dashboard</h1><p>Overview of users, questions and assessment activity.</p></div>
        <Button variant="ghost" onClick={() => { stats.reload(); attempts.reload(); }}>↻ Refresh</Button>
      </div>
      <ErrorBox error={stats.error} onRetry={stats.reload} />
      {stats.loading && !s ? <Spinner /> : s && (
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <StatCard label="Candidates" value={s.users?.candidate ?? 0} hint={`${s.users?.proctor ?? 0} proctors · ${s.users?.admin ?? 0} admins`} />
          <StatCard label="Questions" value={s.questions ?? 0} hint={`${s.sessions ?? 0} sessions created`} tone="green" />
          <StatCard label="Attempts" value={s.attempts?.total ?? 0} hint={`${s.attempts?.submitted ?? 0} submitted · ${s.attempts?.in_progress ?? 0} live`} tone="amber" />
          <StatCard label="Average score" value={`${num(s.avg_percentage)}%`} hint="Across submitted attempts" tone="red" />
        </div>
      )}
      <Card title="Attempts" subtitle="Who was proctored by whom, when, and the marks obtained."
        actions={<Button size="sm" variant="ghost" disabled={!filtered.length} onClick={() => downloadCSV('hpai_attempts.csv', attemptCsvColumns, filtered)}>⬇ Export CSV</Button>} pad={false}>
        <ErrorBox error={attempts.error} onRetry={attempts.reload} />
        {attempts.loading && !attempts.data ? <Spinner /> : (
          <DataTable columns={attemptColumns} rows={filtered} searchKeys={['candidate_name', 'candidate_email', 'proctor_name', 'session_name', 'tester_id']}
            initialSort={{ key: 'started_at', dir: 'desc' }}
            empty={{ title: 'No attempts yet', hint: 'Attempts appear here once candidates start a session.' }}
            toolbar={<div className="filters">
              <select className="input" value={f.proctor} onChange={(e) => setF({ ...f, proctor: e.target.value })} aria-label="Filter by proctor"><option value="">All proctors</option>{opts.proctors.map((p) => <option key={p}>{p}</option>)}</select>
              <select className="input" value={f.session} onChange={(e) => setF({ ...f, session: e.target.value })} aria-label="Filter by session"><option value="">All sessions</option>{opts.sessions.map((p) => <option key={p}>{p}</option>)}</select>
              <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Filter by status"><option value="">All statuses</option>{Object.entries(ATTEMPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            </div>} />
        )}
      </Card>
    </>
  );
}
