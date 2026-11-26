import { useEffect, useState } from 'react';
import { Button, Field, Modal } from './ui.jsx';
import { downloadCSV, parseNameEmailLines } from '../utils/format.js';

/** Shows generated passwords ONCE. creds: [{name,email,password}] */
export function CredentialsModal({ open, onClose, creds, skipped = [], title = 'Login credentials' }) {
  return (
    <Modal open={open} title={title} onClose={onClose} wide
      footer={<>
        <Button variant="ghost" disabled={!creds?.length} onClick={() => downloadCSV('hpai_credentials.csv', [{ label: 'Name', key: 'name' }, { label: 'Email', key: 'email' }, { label: 'Temporary password', key: 'password' }], creds)}>⬇ Download CSV</Button>
        <Button onClick={onClose}>Done</Button>
      </>}>
      <div className="alert alert-warn" style={{ marginBottom: 12 }}>Passwords are shown only once. Download or copy them now — they cannot be retrieved later (only reset).</div>
      {(creds || []).length > 0 && (
        <div className="table-scroll"><table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Temporary password</th></tr></thead>
          <tbody>{creds.map((c) => <tr key={c.email}><td>{c.name}</td><td>{c.email}</td><td className="mono">{c.password}</td></tr>)}</tbody>
        </table></div>
      )}
      {skipped.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <strong className="small">Skipped ({skipped.length})</strong>
          <ul className="small muted">{skipped.map((s) => <li key={s.email}>{s.email} — {s.reason}</li>)}</ul>
        </div>
      )}
    </Modal>
  );
}

/** Paste 'name,email' lines. onSubmit(rows) must return {created, skipped}. */
export function BulkAddModal({ open, onClose, onSubmit, label = 'users' }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setText(''); setErr(''); setBusy(false); } }, [open]);
  const parsed = parseNameEmailLines(text);
  const go = async () => {
    if (!parsed.rows.length) { setErr('Add at least one valid "name,email" line.'); return; }
    setBusy(true); setErr('');
    try { await onSubmit(parsed.rows); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title={`Bulk add ${label}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!parsed.rows.length} onClick={go}>Create {parsed.rows.length || ''} {label}</Button></>}>
      <div className="stack">
        <Field label="One per line: name, email" hint="Example: Asha Verma, asha@example.com">
          <textarea className="input mono" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Asha Verma, asha@example.com\nRahul Singh, rahul@example.com'} />
        </Field>
        <div className="small muted">{parsed.rows.length} valid line(s){parsed.bad.length ? ` · ${parsed.bad.length} invalid will be ignored` : ''}</div>
        {err && <div className="alert alert-error">{err}</div>}
      </div>
    </Modal>
  );
}
