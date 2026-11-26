import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import DataTable from '../../components/DataTable.jsx';
import { BulkAddModal, CredentialsModal } from '../../components/UserForms.jsx';
import { Badge, Button, Card, ConfirmDialog, ErrorBox, Field, Modal, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';

function AddCandidate({ open, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF({ name: '', email: '', password: '' }); setErr(''); } }, [open]);
  const submit = async (e) => {
    e.preventDefault();
    if (f.password && f.password.length < 8) { setErr('Password must be at least 8 characters, or leave it blank.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await api.proctor.createCandidate({ name: f.name.trim(), email: f.email.trim(), password: f.password || undefined });
      toast('Candidate added', 'success');
      onDone(res.generated_password ? [{ name: f.name.trim(), email: f.email.trim(), password: res.generated_password }] : null);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title="Add candidate" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <Field label="Full name"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" hint="Leave blank to auto-generate"><input className="input" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="row end"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Add</Button></div>
      </form>
    </Modal>
  );
}

export default function Candidates() {
  const toast = useToast();
  const { loading, data, error, reload } = useAsync(() => api.proctor.candidates(), []);
  const [add, setAdd] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [creds, setCreds] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [toggle, setToggle] = useState(null);

  const cols = [
    { key: 'name', label: 'Candidate', render: (u) => <div className="name-cell"><strong>{u.name}</strong><span>{u.email}</span></div> },
    { key: 'active', label: 'Status', render: (u) => <Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Disabled'}</Badge> },
    { key: 'created_at', label: 'Added', render: (u) => fmtDate(u.created_at) },
    { key: 'actions', label: '', sortable: false, className: 'right', render: (u) => (
      <div className="cell-actions"><Button size="sm" variant={u.active ? 'danger' : 'ghost'} onClick={() => setToggle(u)}>{u.active ? 'Deactivate' : 'Activate'}</Button></div>) },
  ];

  return (
    <>
      <div className="page-head">
        <div><h1>My candidates</h1><p>Candidates you proctor. Only they can be added to your sessions.</p></div>
        <div className="row"><Button variant="ghost" onClick={() => setBulk(true)}>Bulk add</Button><Button onClick={() => setAdd(true)}>+ Add candidate</Button></div>
      </div>
      <Card pad={false}>
        <ErrorBox error={error} onRetry={reload} />
        {loading && !data ? <Spinner /> : <DataTable columns={cols} rows={data || []} searchKeys={['name', 'email']} empty={{ title: 'No candidates yet', hint: 'Add candidates one by one or paste a list.' }} />}
      </Card>
      <AddCandidate open={add} onClose={() => setAdd(false)} onDone={(c) => { setAdd(false); reload(true); if (c) setCreds(c); }} />
      <BulkAddModal open={bulk} onClose={() => setBulk(false)} label="candidates" onSubmit={async (rows) => {
        const res = await api.proctor.bulkCandidates({ rows });
        setBulk(false); reload(true); setSkipped(res.skipped || []); setCreds(res.created || []);
      }} />
      <CredentialsModal open={!!creds} creds={creds} skipped={skipped} onClose={() => { setCreds(null); setSkipped([]); }} />
      <ConfirmDialog open={!!toggle} danger={toggle?.active} title={toggle?.active ? 'Deactivate candidate?' : 'Activate candidate?'}
        message={toggle?.active ? `${toggle?.name} will no longer be able to sign in.` : `${toggle?.name} will be able to sign in again.`}
        confirmLabel={toggle?.active ? 'Deactivate' : 'Activate'} onCancel={() => setToggle(null)}
        onConfirm={async () => { try { await api.proctor.updateCandidate(toggle.id, { active: !toggle.active }); toast('Updated', 'success'); reload(true); } catch (e) { toast(e.message, 'error'); } setToggle(null); }} />
    </>
  );
}
