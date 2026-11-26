import { memo, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { Button, Card, ConfirmDialog, EmptyState, ErrorBox, Field, Modal, ProgressBar, Spinner, useAsync, useInterval, useToast } from './ui.jsx';
import { fmtClock } from '../utils/format.js';
import './invites.css';

function ExtendModal({ target, onClose, onDone }) {
  const toast = useToast();
  const [minutes, setMinutes] = useState(5);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (target) { setMinutes(5); setReason(''); } }, [target]);
  const go = async () => {
    setBusy(true);
    try { await api.proctor.extend(target.attempt_id, Number(minutes), reason.trim()); toast(`Extended by ${minutes} min`, 'success'); onDone(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!target} title={`Extend time — ${target?.candidate_name || ''}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!reason.trim() || !(Number(minutes) > 0)} onClick={go}>Extend</Button></>}>
      <div className="stack">
        <Field label="Extra minutes"><input className="input" type="number" min="1" max="120" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
        <Field label="Reason" hint="Recorded in the audit log"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Power cut / network issue" /></Field>
      </div>
    </Modal>
  );
}

const RING_R = 15;
const RING_C = 2 * Math.PI * RING_R;

/** Owns its own 1s interval so the rest of the table never re-renders on a tick. */
function Countdown({ base, at, total }) {
  const calc = () => Math.max(0, base - Math.floor((Date.now() - at) / 1000));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    const id = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(id);
  }, [base, at]); // eslint-disable-line react-hooks/exhaustive-deps
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  const tone = left <= 60 ? 'crit' : left <= 300 ? 'warn' : '';
  return (
    <span className={`cd ${tone}`} role="timer" aria-label={`${fmtClock(left)} remaining`}>
      <span className="cd-ring" aria-hidden="true">
        <svg viewBox="0 0 36 36"><circle className="trk" cx="18" cy="18" r={RING_R} /><circle className="val" cx="18" cy="18" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - frac)} /></svg>
      </span>
      <span className="timer-chip">{fmtClock(left)}</span>
    </span>
  );
}

const flagClass = (n) => (n === 0 ? 'flag-0' : n < 5 ? 'flag-low' : 'flag-high');

const MonitorRow = memo(function MonitorRow({ r, i, at, onOpen, onExtend, onKill }) {
  const total = r.started_at && r.ends_at ? Math.max(1, Math.round((new Date(r.ends_at) - new Date(r.started_at)) / 1000)) : Math.max(r.seconds_left || 1, 1);
  return (
    <tr className="clickable" style={{ '--ri': Math.min(i, 12) }} onClick={() => onOpen?.(r.attempt_id)}>
      <td data-label="Candidate"><strong>{r.candidate_name}</strong>{r.tester_id && <div className="small"><span className="tester-chip">{r.tester_id}</span></div>}</td>
      <td data-label="Session">{r.session_name}</td>
      <td data-label="Time left"><Countdown base={r.seconds_left ?? 0} at={at} total={total} /></td>
      <td data-label="Progress" style={{ minWidth: 130 }}><div className="small">{r.answered}/{r.total_questions} answered</div><ProgressBar value={r.answered} max={r.total_questions} tone="blue" /></td>
      <td data-label="Flags" className={flagClass(r.flag_count)}>{r.flag_count}</td>
      <td data-label="Last event" className="muted small">{r.last_event ? String(r.last_event).replace(/_/g, ' ') : '—'}</td>
      <td data-label="" onClick={(e) => e.stopPropagation()}><div className="cell-actions">
        <Button size="sm" variant="ghost" onClick={() => onExtend(r)}>+ Time</Button>
        <Button size="sm" variant="danger" onClick={() => onKill(r)}>Terminate</Button>
      </div></td>
    </tr>
  );
});

/** Polls /proctor/monitor every 10s; each row's countdown ticks on its own. */
export default function LiveMonitor({ onOpenAttempt, onChanged }) {
  const toast = useToast();
  const { loading, data, error, reload } = useAsync(() => api.proctor.monitor(), []);
  const fetchedAt = useMemo(() => Date.now(), [data]); // eslint-disable-line react-hooks/exhaustive-deps
  const [extend, setExtend] = useState(null);
  const [kill, setKill] = useState(null);

  useInterval(() => reload(true), 10000);

  const rows = data || [];

  return (
    <Card title="Live monitor" subtitle="Candidates currently taking a test · refreshes every 10 s" pad={false}
      actions={<Button size="sm" variant="ghost" onClick={() => reload(true)}>↻ Refresh</Button>}>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Spinner /> : rows.length === 0 ? <EmptyState title="Nobody is taking a test right now" hint="Live attempts will appear here automatically." /> : (
        <div className="table-scroll"><table className="table stackable">
          <thead><tr><th scope="col">Candidate</th><th scope="col">Session</th><th scope="col">Time left</th><th scope="col">Progress</th><th scope="col">Flags</th><th scope="col">Last event</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{rows.map((r, i) => <MonitorRow key={r.attempt_id} r={r} i={i} at={fetchedAt} onOpen={onOpenAttempt} onExtend={setExtend} onKill={setKill} />)}</tbody>
        </table></div>
      )}
      <ExtendModal target={extend} onClose={() => setExtend(null)} onDone={() => { setExtend(null); reload(true); onChanged?.(); }} />
      <ConfirmDialog open={!!kill} danger withReason title="Terminate this attempt?" confirmLabel="Terminate & submit"
        message={`${kill?.candidate_name}'s test will be ended now and their saved answers will be marked. This cannot be undone.`}
        onCancel={() => setKill(null)}
        onConfirm={async (reason) => { try { await api.proctor.terminate(kill.attempt_id, reason.trim()); toast('Attempt terminated', 'success'); reload(true); onChanged?.(); } catch (e) { toast(e.message, 'error'); } setKill(null); }} />
    </Card>
  );
}
