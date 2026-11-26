import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import DataTable from '../../components/DataTable.jsx';
import { Badge, Button, Card, ErrorBox, ProgressBar, Spinner, useAsync } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';

export default function Sessions() {
  const nav = useNavigate();
  const { loading, data, error, reload } = useAsync(() => api.proctor.sessions(), []);
  const cols = [
    { key: 'name', label: 'Session', render: (s) => <div className="name-cell"><strong>{s.name}</strong><span>{s.duration_mins} min</span></div> },
    { key: 'status', label: 'Status', render: (s) => <Badge tone={s.status === 'open' ? 'green' : 'gray'}>{s.status}</Badge> },
    { key: 'candidate_count', label: 'Candidates' },
    { key: 'submitted_count', label: 'Progress', sortValue: (s) => s.submitted_count, render: (s) => (
      <div style={{ minWidth: 170 }}><div className="small">{s.submitted_count} submitted{s.in_progress_count ? ` · ${s.in_progress_count} live` : ''}</div><ProgressBar value={s.submitted_count} max={s.candidate_count} /></div>) },
    { key: 'created_at', label: 'Created', render: (s) => fmtDate(s.created_at) },
  ];
  return (
    <>
      <div className="page-head">
        <div><h1>Sessions</h1><p>Each session defines subjects, question mix, duration and candidates.</p></div>
        <Link to="/proctor/sessions/new" className="btn btn-primary">+ New session</Link>
      </div>
      <Card pad={false}>
        <ErrorBox error={error} onRetry={reload} />
        {loading && !data ? <Spinner /> : <DataTable columns={cols} rows={data || []} searchKeys={['name', 'status']} onRowClick={(s) => nav(`/proctor/sessions/${s.id}`)} initialSort={{ key: 'created_at', dir: 'desc' }}
          empty={{ title: 'No sessions yet', hint: 'Create your first session to start assessing candidates.' }}
          toolbar={<Button size="sm" variant="ghost" onClick={() => reload(true)}>↻ Refresh</Button>} />}
      </Card>
    </>
  );
}
