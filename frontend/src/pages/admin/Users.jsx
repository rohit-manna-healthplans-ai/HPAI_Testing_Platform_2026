import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import DataTable from '../../components/DataTable.jsx';
import { BulkAddModal, CredentialsModal } from '../../components/UserForms.jsx';
import { Badge, Button, Card, ConfirmDialog, ErrorBox, Field, Modal, Spinner, Tabs, useAsync, useToast } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';

const ROLE_TABS = [{ value: 'admin', label: 'Admins' }, { value: 'proctor', label: 'Proctors' }, { value: 'candidate', label: 'Candidates' }];

function UserModal({ open, role, proctors, onClose, onDone }) {
  const toast = useToast();
  const blank = { name: '', email: '', password: '', proctor_id: '' };
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF(blank); setErr(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = async (e) => {
    e.preventDefault();
    if (f.password && f.password.length < 8) { setErr('Password must be at least 8 characters (or leave blank to auto-generate).'); return; }
    setBusy(true); setErr('');
    try {
      const res = await api.admin.createUser({ name: f.name.trim(), email: f.email.trim(), role, password: f.password || undefined, proctor_id: role === 'candidate' && f.proctor_id ? f.proctor_id : undefined });
      toast(`${role} created`, 'success');
      onDone(res.generated_password ? [{ name: f.name.trim(), email: f.email.trim(), password: res.generated_password }] : null);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title={`Add ${role}`} onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <Field label="Full name"><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Password" hint="Leave blank to auto-generate a secure one"><input className="input" type="text" autoComplete="off" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        {role === 'candidate' && (
          <Field label="Assigned proctor"><select className="input" value={f.proctor_id} onChange={(e) => setF({ ...f, proctor_id: e.target.value })}><option value="">— Unassigned —</option>{proctors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        )}
        {err && <div className="alert alert-error">{err}</div>}
        <div className="row end"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Create</Button></div>
      </form>
    </Modal>
  );
}

function SubjectsModal({ open, user, subjects, onClose, onDone }) {
  const toast = useToast();
  const [sel, setSel] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setSel(user?.subject_ids || []); }, [open, user]);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const save = async () => {
    setBusy(true);
    try { await api.admin.setProctorSubjects(user.id, sel); toast('Subjects updated', 'success'); onDone(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title={`Subjects for ${user?.name || ''}`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save subjects</Button></>}>
      <p className="muted small" style={{ marginBottom: 10 }}>A proctor can only build sessions from the subjects assigned here.</p>
      <div className="picker">{subjects.map((s) => (
        <label key={s.id}><input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggle(s.id)} /> <span className="grow"><b>{s.name}</b> <span className="muted small">{s.question_count ?? 0} questions</span></span></label>
      ))}</div>
    </Modal>
  );
}

function ResetModal({ open, user, onClose }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setPw(''); }, [open]);
  const go = async () => {
    if (pw.length < 8) { toast('Password must be at least 8 characters', 'error'); return; }
    setBusy(true);
    try { await api.admin.updateUser(user.id, { password: pw }); toast('Password reset', 'success'); onClose(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title={`Reset password — ${user?.name || ''}`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={go}>Reset</Button></>}>
      <Field label="New password" hint="Share it with the user securely."><input className="input" type="text" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
    </Modal>
  );
}

export default function Users() {
  const toast = useToast();
  const [role, setRole] = useState('candidate');
  const users = useAsync(() => api.admin.users(), []);
  const subjectsQ = useAsync(() => api.subjects(), []);
  const [add, setAdd] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [creds, setCreds] = useState(null);
  const [skipped, setSkipped] = useState([]);
  const [subj, setSubj] = useState(null);
  const [reset, setReset] = useState(null);
  const [toggleUser, setToggleUser] = useState(null);

  const all = users.data || [];
  const proctors = useMemo(() => all.filter((u) => u.role === 'proctor'), [all]);
  const rows = all.filter((u) => u.role === role);
  const counts = (r) => all.filter((u) => u.role === r).length;
  const subjectName = (id) => (subjectsQ.data || []).find((s) => s.id === id)?.name || '';

  const assign = async (u, proctor_id) => {
    try { await api.admin.updateUser(u.id, { proctor_id: proctor_id || null }); toast('Proctor updated', 'success'); users.reload(true); } catch (e) { toast(e.message, 'error'); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (u) => <div className="name-cell"><strong>{u.name}</strong><span>{u.email}</span></div> },
    ...(role === 'candidate' ? [{ key: 'proctor_name', label: 'Proctor', sortValue: (u) => u.proctor_name || '', render: (u) => (
      <select className="input" style={{ minHeight: 34, padding: '4px 8px', minWidth: 150 }} value={u.proctor_id || ''} onChange={(e) => assign(u, e.target.value)} aria-label={`Proctor for ${u.name}`}>
        <option value="">— Unassigned —</option>{proctors.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>) }] : []),
    ...(role === 'proctor' ? [{ key: 'subject_ids', label: 'Subjects', sortable: false, render: (u) => (u.subject_ids?.length ? <div className="chip-row">{u.subject_ids.map((id) => <Badge key={id} tone="blue">{subjectName(id) || '…'}</Badge>)}</div> : <span className="muted small">None assigned</span>) }] : []),
    { key: 'active', label: 'Status', render: (u) => <Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Active' : 'Disabled'}</Badge> },
    { key: 'created_at', label: 'Created', render: (u) => fmtDate(u.created_at) },
    { key: 'actions', label: '', sortable: false, className: 'right', render: (u) => (
      <div className="cell-actions">
        {u.role === 'proctor' && <Button size="sm" variant="ghost" onClick={() => setSubj(u)}>Subjects</Button>}
        <Button size="sm" variant="ghost" onClick={() => setReset(u)}>Reset password</Button>
        <Button size="sm" variant={u.active ? 'danger' : 'ghost'} onClick={() => setToggleUser(u)}>{u.active ? 'Deactivate' : 'Activate'}</Button>
      </div>) },
  ];

  const after = (c) => { setAdd(false); users.reload(true); if (c?.length) setCreds(c); };

  return (
    <>
      <div className="page-head">
        <div><h1>Users</h1><p>Create admins, proctors and candidates, and manage who proctors whom.</p></div>
        <div className="row">
          {role !== 'admin' && <Button variant="ghost" onClick={() => setBulk(true)}>Bulk add</Button>}
          <Button onClick={() => setAdd(true)}>+ Add {role}</Button>
        </div>
      </div>
      <Tabs tabs={ROLE_TABS.map((t) => ({ ...t, count: counts(t.value) }))} value={role} onChange={setRole} />
      <Card pad={false}>
        <ErrorBox error={users.error} onRetry={users.reload} />
        {users.loading && !users.data ? <Spinner /> : <DataTable columns={columns} rows={rows} searchKeys={['name', 'email', 'proctor_name']} empty={{ title: `No ${role}s yet`, hint: `Use “Add ${role}” to create one.` }} />}
      </Card>

      <UserModal open={add} role={role} proctors={proctors} onClose={() => setAdd(false)} onDone={after} />
      <BulkAddModal open={bulk} onClose={() => setBulk(false)} label={`${role}s`}
        onSubmit={async (list) => {
          const res = await api.admin.bulkUsers({ role, rows: list });
          setBulk(false); users.reload(true); setSkipped(res.skipped || []); setCreds(res.created || []);
        }} />
      <CredentialsModal open={!!creds} creds={creds} skipped={skipped} onClose={() => { setCreds(null); setSkipped([]); }} />
      <SubjectsModal open={!!subj} user={subj} subjects={subjectsQ.data || []} onClose={() => setSubj(null)} onDone={() => { setSubj(null); users.reload(true); }} />
      <ResetModal open={!!reset} user={reset} onClose={() => setReset(null)} />
      <ConfirmDialog open={!!toggleUser} danger={toggleUser?.active} title={toggleUser?.active ? 'Deactivate user?' : 'Activate user?'}
        message={toggleUser?.active ? `${toggleUser?.name} will no longer be able to sign in.` : `${toggleUser?.name} will be able to sign in again.`}
        confirmLabel={toggleUser?.active ? 'Deactivate' : 'Activate'} onCancel={() => setToggleUser(null)}
        onConfirm={async () => { try { await api.admin.updateUser(toggleUser.id, { active: !toggleUser.active }); toast('Updated', 'success'); users.reload(true); } catch (e) { toast(e.message, 'error'); } setToggleUser(null); }} />
    </>
  );
}
