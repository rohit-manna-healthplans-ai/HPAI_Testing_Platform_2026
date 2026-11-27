import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { Badge, Button, Card, ConfirmDialog, ErrorBox, Modal, Spinner, useAsync, useInterval, useToast } from './ui.jsx';
import { fmtDate } from '../utils/format.js';
import { copyText } from '../utils/people.js';
import { RESETS_CHANGED } from '../utils/resetEvents.js';


const STATUS = {
  pending: { tone: 'amber', label: 'Waiting for you' },
  issued: { tone: 'blue', label: 'Link issued' },
  emailed: { tone: 'green', label: 'Link emailed' },
  expired: { tone: 'gray', label: 'Link expired' },
};

function LinkModal({ info, onClose }) {
  const toast = useToast();
  if (!info) return null;
  const copy = async () => toast((await copyText(info.link)) ? 'Link copied' : 'Could not copy. Select the link and copy it manually.', 'success');
  return (
    <Modal open title={`Reset link for ${info.name}`} onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <div className="stack">
        <div className="alert alert-warn" role="note"><span>This link is shown <b>only once</b>. Close this window and it cannot be shown again (you can create a new one).</span></div>
        <label className="field">
          <span className="field-label">One-time reset link</span>
          <div className="link-box">
            <input className="input mono" readOnly value={info.link} onFocus={(e) => e.target.select()} aria-label="One-time reset link" />
            <Button variant="ghost" onClick={copy}>Copy</Button>
          </div>
        </label>
        <ul className="rules">
          <li>Valid for <b>{info.minutes} minutes</b> (until {info.expires}) and works <b>once</b>.</li>
          <li>Send it <b>only to {info.name}</b> ({info.email}), for example in person or in a private message.</li>
          <li>Creating another link for the same request replaces this one.</li>
        </ul>
      </div>
    </Modal>
  );
}

/** "Password reset requests" panel for the admin Users page. */
export default function ResetRequests() {
  const toast = useToast();
  const q = useAsync(() => api.admin.passwordResets('all'), []);
  const [visible, setVisible] = useState(typeof document === 'undefined' ? true : !document.hidden);
  const [busy, setBusy] = useState('');
  const [link, setLink] = useState(null);
  const [dismiss, setDismiss] = useState(null);

  useEffect(() => {
    const on = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  useInterval(() => { if (visible) q.reload(true); }, 60000);

  const open = (q.data || []).filter((r) => ['pending', 'issued', 'expired'].includes(r.effective_status));
  const pending = open.filter((r) => r.effective_status === 'pending').length;
  const changed = () => { q.reload(true); window.dispatchEvent(new Event(RESETS_CHANGED)); };

  const issue = async (r) => {
    setBusy(r.id);
    try {
      const res = await api.admin.issueReset(r.id);
      setLink({
        link: `${window.location.origin}/reset-password/${res.token}`,
        name: res.name, email: res.email, minutes: res.minutes,
        expires: new Date(res.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      changed();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  const doDismiss = async () => {
    const r = dismiss; setDismiss(null);
    try { await api.admin.dismissReset(r.id); toast('Request dismissed', 'success'); changed(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Card
        className="reset-card"
        title={<>Password reset requests {pending > 0 && <Badge tone="amber">{pending} waiting</Badge>}</>}
        subtitle="Proctors who used “Forgot password”. Create a one-time link and share it only with that proctor."
        actions={<Button size="sm" variant="ghost" onClick={() => q.reload(true)}>Refresh</Button>}>
        <ErrorBox error={q.error} onRetry={q.reload} />
        {q.loading && !q.data ? <Spinner rows={1} /> : open.length === 0 ? (
          <p className="muted small" style={{ margin: 0 }}>No open requests. When a proctor uses “Forgot password”, it appears here (unless the reset email was sent automatically).</p>
        ) : (
          <div className="reset-list">
            {open.map((r) => {
              const st = STATUS[r.effective_status === 'issued' && r.emailed ? 'emailed' : r.effective_status] || STATUS.pending;
              return (
                <div className="reset-item" key={r.id}>
                  <div className="name-cell"><strong>{r.name}</strong><span>{r.email} · requested {fmtDate(r.requested_at)}</span></div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  <div className="cell-actions">
                    <Button size="sm" loading={busy === r.id} onClick={() => issue(r)}>{r.effective_status === 'pending' ? 'Create reset link' : 'Create new link'}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDismiss(r)}>Dismiss</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <LinkModal info={link} onClose={() => setLink(null)} />
      <ConfirmDialog open={!!dismiss} title="Dismiss this request?" message={`${dismiss?.name || 'The proctor'} will need to request a new link if they still need one.`}
        confirmLabel="Dismiss" onCancel={() => setDismiss(null)} onConfirm={doDismiss} />
    </>
  );
}
