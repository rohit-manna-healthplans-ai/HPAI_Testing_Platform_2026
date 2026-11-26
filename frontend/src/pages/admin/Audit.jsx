import { api } from '../../api.js';
import DataTable from '../../components/DataTable.jsx';
import { Button, Card, ErrorBox, Spinner, useAsync } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';

export default function Audit() {
  const { loading, data, error, reload } = useAsync(() => api.admin.audit(300), []);
  const cols = [
    { key: 'at', label: 'When', render: (r) => fmtDate(r.at) },
    { key: 'actor_name', label: 'Actor', render: (r) => r.actor_name || r.actor_id || 'system' },
    { key: 'action', label: 'Action', render: (r) => <code>{r.action}</code> },
    { key: 'entity', label: 'Entity', render: (r) => `${r.entity || ''}${r.entity_id ? ` · ${String(r.entity_id).slice(0, 8)}` : ''}` },
    { key: 'meta', label: 'Details', sortable: false, render: (r) => <span className="mono muted">{r.meta && Object.keys(r.meta).length ? JSON.stringify(r.meta).slice(0, 140) : '—'}</span> },
  ];
  return (
    <>
      <div className="page-head">
        <div><h1>Audit log</h1><p>Every administrative and proctoring action, newest first.</p></div>
        <Button variant="ghost" onClick={() => reload()}>↻ Refresh</Button>
      </div>
      <Card pad={false}>
        <ErrorBox error={error} onRetry={reload} />
        {loading && !data ? <Spinner /> : <DataTable columns={cols} rows={data || []} searchKeys={['actor_name', 'action', 'entity', 'entity_id']} initialSort={{ key: 'at', dir: 'desc' }} empty={{ title: 'No audit entries yet' }} />}
      </Card>
    </>
  );
}
