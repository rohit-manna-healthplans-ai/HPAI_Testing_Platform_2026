import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { ATTEMPT_STATUS, downloadCSV, fmtDate, num } from '../utils/format.js';
import DataTable from './DataTable.jsx';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorBox, Field, Modal, useAsync, useInterval, useToast } from './ui.jsx';
import './invites.css';

const EXPIRY = [[1, '1 hour'], [6, '6 hours'], [24, '24 hours'], [48, '2 days'], [72, '3 days'], [168, '7 days']];
const STATUS_TONE = { unused: 'blue', used: 'green', expired: 'gray', revoked: 'red' };
const linkFor = (token) => `${window.location.origin}/t/${token}`;

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/** One-time invite links for a session: generate, show once, track status, revoke / reissue / resume. */
export default function InvitePanel({ sessionId, sessionOpen, onChanged }) {
  const toast = useToast();
  const { loading, data, error, reload } = useAsync(() => api.proctor.invites(sessionId), [sessionId]);
  const [names, setNames] = useState('');
  const [count, setCount] = useState(1);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null); // [{id,tester_id,label,token,expires_at,purpose?}]
  const [confirm, setConfirm] = useState(null); // {kind:'revoke'|'reissue', row}

  useInterval(() => reload(true), 20000);

  const nameList = useMemo(() => names.split('\n').map((s) => s.trim()).filter(Boolean), [names]);
  const total = nameList.length || count;

  const copy = async (text, msg = 'Copied') => {
    const ok = await copyText(text);
    toast(ok ? msg : 'Could not copy — select the text and copy it manually', ok ? 'success' : 'error');
  };

  const generate = async () => {
    if (total < 1 || total > 200) return toast('Enter between 1 and 200 links', 'error');
    setBusy(true);
    try {
      const res = await api.proctor.createInvites(sessionId, nameList.length ? { names: nameList, expires_hours: hours } : { count, expires_hours: hours });
      setCreated(res.invites);
      setNames(''); setCount(1);
      reload(true); onChanged?.();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  const doConfirm = async () => {
    const { kind, row } = confirm;
    try {
      if (kind === 'revoke') { await api.proctor.revokeInvite(row.id); toast('Link revoked', 'success'); }
      else { const res = await api.proctor.reissueInvite(row.id, { expires_hours: hours }); setCreated([res.invite]); toast('New link created', 'success'); }
      reload(true); onChanged?.();
    } catch (e) { toast(e.message, 'error'); }
    setConfirm(null);
  };

  const downloadLinks = (list) => downloadCSV(`invite_links_${new Date().toISOString().slice(0, 10)}.csv`,
    [{ label: 'Tester ID', value: (r) => r.tester_id }, { label: 'Name / label', value: (r) => r.label || '' }, { label: 'Link', value: (r) => linkFor(r.token) }, { label: 'Expires', value: (r) => r.expires_at }], list);

  const rows = data || [];
  const cols = [
    { key: 'tester_id', label: 'Tester ID', render: (r) => <span className="tester-chip">{r.tester_id}</span> },
    { key: 'who', label: 'Candidate', sortValue: (r) => r.candidate_name || r.label || '', render: (r) => (
      <div className="name-cell"><strong>{r.candidate_name || r.label || '—'}</strong>{r.candidate_name && r.label && r.label !== r.candidate_name ? <span>Label: {r.label}</span> : null}</div>
    ) },
    { key: 'status', label: 'Link', render: (r) => <><Badge tone={STATUS_TONE[r.status] || 'gray'}>{r.status}</Badge>{r.purpose === 'resume' && <> <Badge tone="amber">resume</Badge></>}</> },
    { key: 'attempt', label: 'Attempt', sortValue: (r) => r.attempt?.status || '', render: (r) => {
      if (!r.attempt) return <span className="muted">Not started</span>;
      const s = ATTEMPT_STATUS[r.attempt.status] || { label: r.attempt.status, tone: 'gray' };
      return <><Badge tone={s.tone}>{s.label}</Badge>{r.attempt.total_score !== undefined && <span className="small"> {num(r.attempt.total_score)}/{num(r.attempt.max_score)}</span>}</>;
    } },
    { key: 'expires_at', label: 'Expires', sortValue: (r) => r.expires_at, render: (r) => fmtDate(r.expires_at) },
    { key: 'actions', label: '', sortable: false, className: 'right', render: (r) => {
      const live = r.attempt?.status === 'in_progress';
      return (
        <div className="cell-actions">
          {r.status === 'unused' && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'revoke', row: r })}>Revoke</Button>}
          {(r.status === 'unused' || r.status === 'expired' || r.status === 'revoked') && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'reissue', row: r })}>Reissue</Button>}
          {r.status === 'used' && live && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'reissue', row: r })}>Resume link</Button>}
        </div>
      );
    } },
  ];

  const exportStatus = () => downloadCSV(`invites_status_${new Date().toISOString().slice(0, 10)}.csv`, [
    { label: 'Tester ID', value: (r) => r.tester_id }, { label: 'Label', value: (r) => r.label }, { label: 'Candidate', value: (r) => r.candidate_name },
    { label: 'Link status', value: (r) => r.status }, { label: 'Attempt', value: (r) => r.attempt?.status }, { label: 'Score', value: (r) => r.attempt?.total_score },
    { label: 'Max', value: (r) => r.attempt?.max_score }, { label: 'Expires', value: (r) => r.expires_at },
  ], rows);

  return (
    <Card title="Invite links" subtitle="Each link carries a unique Tester ID and works for ONE start only. Share it privately with a single candidate.">
      {!sessionOpen && <div className="alert alert-warn" style={{ marginBottom: 12 }}>This session is closed. Re-open it to create or reissue links.</div>}
      <div className="invite-gen">
        <Field label="Names (optional — one per line)" hint="Leave empty to generate anonymous links; the candidate types their own name when they start.">
          <textarea className="input" rows={3} value={names} onChange={(e) => setNames(e.target.value)} placeholder={'Asha Verma\nRahul Nair'} />
        </Field>
        <div className="stack">
          <Field label="How many links">
            <input className="input" type="number" min={1} max={200} value={nameList.length || count} disabled={nameList.length > 0} onChange={(e) => setCount(Math.max(1, Math.min(200, parseInt(e.target.value, 10) || 1)))} />
          </Field>
          <Field label="Valid for">
            <select className="input" value={hours} onChange={(e) => setHours(parseInt(e.target.value, 10))}>{EXPIRY.map(([h, l]) => <option key={h} value={h}>{l}</option>)}</select>
          </Field>
          <Button variant="success" onClick={generate} loading={busy} disabled={!sessionOpen}>Generate {total} link{total === 1 ? '' : 's'}</Button>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <ErrorBox error={error} onRetry={reload} />
        {!loading && !error && rows.length === 0
          ? <EmptyState title="No invite links yet" hint="Generate links above and share each one with a single candidate." />
          : <DataTable columns={cols} rows={rows} searchKeys={['tester_id', 'label', 'candidate_name', 'status']} pageSize={10} searchPlaceholder="Search tester ID or name…"
            toolbar={<><Button size="sm" variant="ghost" onClick={() => reload(true)}>↻ Refresh</Button><Button size="sm" variant="ghost" onClick={exportStatus} disabled={!rows.length}>⬇ Status CSV</Button></>} />}
      </div>

      <Modal open={!!created} wide title={created?.length > 1 ? `${created.length} links created` : 'Link created'} onClose={() => setCreated(null)}
        footer={<>
          {created?.length > 1 && <Button variant="ghost" onClick={() => copy(created.map((x) => `${x.tester_id}${x.label ? ` (${x.label})` : ''}\t${linkFor(x.token)}`).join('\n'), 'All links copied')}>Copy all</Button>}
          <Button variant="ghost" onClick={() => downloadLinks(created)}>⬇ Download CSV</Button>
          <Button onClick={() => setCreated(null)}>Done</Button>
        </>}>
        {created && (
          <div className="stack">
            <div className="alert alert-warn"><span><b>Copy these links now.</b> For security they are shown only once and cannot be retrieved later (you can always Reissue a new one). Each link works for one start only.</span></div>
            <div className="invite-links-list">
              {created.map((x) => (
                <div className="invite-link-row" key={x.id}>
                  <span className="tid">{x.tester_id}{x.purpose === 'resume' ? ' · resume' : ''}{x.label && <span className="who">{x.label}</span>}</span>
                  <span className="url" title="Select to copy">{linkFor(x.token)}</span>
                  <Button size="sm" variant="ghost" onClick={() => copy(linkFor(x.token), 'Link copied')}>Copy</Button>
                </div>
              ))}
            </div>
            <span className="small muted">Expires {fmtDate(created[0].expires_at)}.</span>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirm} danger={confirm?.kind === 'revoke'}
        title={confirm?.kind === 'revoke' ? 'Revoke this link?' : confirm?.row?.status === 'used' ? 'Create a resume link?' : 'Reissue this link?'}
        message={confirm?.kind === 'revoke'
          ? `${confirm?.row?.tester_id}: the link stops working immediately.`
          : confirm?.row?.status === 'used'
            ? `${confirm?.row?.tester_id} already started. A one-time resume link lets the same candidate continue the SAME test (timer unchanged) if they lost their browser session. The old link stays used.`
            : `${confirm?.row?.tester_id}: the current link is cancelled and a new one-time link with the same Tester ID is created.`}
        confirmLabel={confirm?.kind === 'revoke' ? 'Revoke' : 'Create new link'} onCancel={() => setConfirm(null)} onConfirm={doConfirm} />
    </Card>
  );
}
