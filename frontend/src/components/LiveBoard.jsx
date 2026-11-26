import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { capMessage, parsePeople } from '../utils/people.js';
import { downloadCSV, fmtClock, fmtDate, num } from '../utils/format.js';
import LinksReady from './LinksReady.jsx';
import PeopleInput from './PeopleInput.jsx';
import { Badge, Button, Card, ConfirmDialog, CountUp, EmptyState, ErrorBox, Field, Modal, ProgressBar, Spinner, useAsync, useToast } from './ui.jsx';
import './invites.css';
import './links.css';

const POLL_MS = 10000;
const PAGE_SIZE = 25;
const STATUS = {
  not_opened: { label: 'Not opened', tone: 'gray' }, opened: { label: 'Opened', tone: 'amber' }, in_progress: { label: 'In progress', tone: 'blue' },
  submitted: { label: 'Submitted', tone: 'green' }, expired: { label: 'Expired', tone: 'gray' }, revoked: { label: 'Revoked', tone: 'red' },
};
const ORDER = { in_progress: 0, opened: 1, not_opened: 2, submitted: 3, expired: 4, revoked: 5 };
const rowKey = (r) => r.invite_id || r.attempt_id || r.email || r.name;

/* ---------------------------------------------------------------------------------------------------------------
 * Polling hook: conditional GET (If-None-Match -> 304 costs almost nothing), every 10 s, paused while the tab is hidden,
 * immediate refresh when it becomes visible again, exponential backoff with jitter on errors.
 * ------------------------------------------------------------------------------------------------------------- */
function useLive(sessionId) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const etagRef = useRef(null);
  const offsetRef = useRef(0);
  const failRef = useRef(0);
  const timerRef = useRef(null);
  const updatedRef = useRef(0);
  const aliveRef = useRef(true);
  const busyRef = useRef(false);

  const schedule = useCallback((poll) => {
    clearTimeout(timerRef.current);
    if (!aliveRef.current || document.hidden) return; // paused while hidden; visibilitychange restarts it
    const fails = failRef.current;
    const delay = fails ? Math.min(60000, POLL_MS * 2 ** Math.min(fails - 1, 3)) * (0.8 + Math.random() * 0.4) : POLL_MS;
    timerRef.current = setTimeout(poll, delay);
  }, []);

  const poll = useCallback(async (force = false) => {
    if (busyRef.current) return;
    busyRef.current = true;
    clearTimeout(timerRef.current);
    try {
      const r = await api.proctor.live(sessionId, force ? '' : etagRef.current);
      if (!aliveRef.current) return;
      updatedRef.current = Date.now();
      if (!r.notModified) {
        etagRef.current = r.etag;
        offsetRef.current = new Date(r.data.server_now).getTime() - Date.now();
        setState({ data: r.data, error: null, loading: false });
      } else setState((s) => (s.error || s.loading ? { ...s, error: null, loading: false } : s)); // nothing changed: no re-render
      failRef.current = 0;
    } catch (e) {
      failRef.current += 1;
      if (aliveRef.current) setState((s) => ({ ...s, error: e, loading: false }));
    } finally {
      busyRef.current = false;
      schedule(() => poll(false));
    }
  }, [sessionId, schedule]);

  useEffect(() => {
    aliveRef.current = true;
    etagRef.current = null;
    poll(true);
    const onVis = () => { if (document.hidden) clearTimeout(timerRef.current); else poll(false); };
    document.addEventListener('visibilitychange', onVis);
    return () => { aliveRef.current = false; clearTimeout(timerRef.current); document.removeEventListener('visibilitychange', onVis); };
  }, [poll]);

  return { ...state, offsetRef, updatedRef, refresh: () => poll(true) };
}

/** "Last updated Ns ago" lives in its own tiny component so the 1 s tick never re-renders the table. */
function Ago({ at }) {
  const [, setN] = useState(0);
  useEffect(() => { const id = setInterval(() => setN((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const s = at.current ? Math.max(0, Math.round((Date.now() - at.current) / 1000)) : null;
  return <>{s === null ? '—' : s < 2 ? 'just now' : `${s}s ago`}</>;
}

const RING_R = 15; const RING_C = 2 * Math.PI * RING_R;
/** Own 1 s interval; computed from ends_at + server clock offset (the row's seconds_left is only a snapshot). */
const Countdown = memo(function Countdown({ endsAt, offset, total }) {
  const calc = () => Math.max(0, Math.floor((new Date(endsAt).getTime() - (Date.now() + offset)) / 1000));
  const [left, setLeft] = useState(calc);
  useEffect(() => { setLeft(calc()); const id = setInterval(() => setLeft(calc()), 1000); return () => clearInterval(id); }, [endsAt, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  const tone = left <= 60 ? 'crit' : left <= 300 ? 'warn' : '';
  return (
    <span className={`cd ${tone}`} role="timer" aria-label={`${fmtClock(left)} remaining`}>
      <span className="cd-ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle className="trk" cx="18" cy="18" r={RING_R} /><circle className="val" cx="18" cy="18" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - frac)} /></svg></span>
      <span className="timer-chip">{fmtClock(left)}</span>
    </span>
  );
});

const minutesAgo = (iso, nowMs) => (iso ? Math.floor((nowMs - new Date(iso).getTime()) / 60000) : null);
const agoText = (iso, nowMs) => { const m = minutesAgo(iso, nowMs); if (m === null) return '—'; if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; return `${Math.floor(m / 60)}h ${m % 60}m ago`; };

/** Smart highlights: stuck links, idle candidates, repeated leaves / flags. */
function attention(r, nowMs) {
  const out = [];
  if (r.status === 'opened') { const m = minutesAgo(r.opened_at, nowMs); if (m !== null && m >= 10) out.push({ k: 'stuck', t: `Opened ${m} min ago, not started`, crit: m >= 20 }); }
  if (r.status === 'in_progress') {
    const m = minutesAgo(r.last_activity_at || r.started_at, nowMs);
    if (m !== null && m >= 5) out.push({ k: 'idle', t: `No activity for ${m} min`, crit: m >= 10 });
    if ((r.screen_leaves || 0) >= 2) out.push({ k: 'leaves', t: `${r.screen_leaves} screen leave${r.screen_leaves === 1 ? '' : 's'}`, crit: r.screen_leaves >= 3 });
    if ((r.flag_count || 0) >= 3) out.push({ k: 'flags', t: `${r.flag_count} flags`, crit: r.flag_count >= 6 });
  }
  return out;
}

const SORTERS = {
  name: (a, b) => String(a.name || '').localeCompare(String(b.name || '')),
  status: (a, b) => ORDER[a.status] - ORDER[b.status],
  time: (a, b) => (a.ends_at ? new Date(a.ends_at).getTime() : Infinity) - (b.ends_at ? new Date(b.ends_at).getTime() : Infinity),
  progress: (a, b) => (b.answered || 0) - (a.answered || 0),
  flags: (a, b) => (b.flag_count || 0) - (a.flag_count || 0),
  activity: (a, b) => new Date(b.last_activity_at || b.started_at || 0).getTime() - new Date(a.last_activity_at || a.started_at || 0).getTime(),
  score: (a, b) => Number(b.percentage ?? -1) - Number(a.percentage ?? -1),
};

function ExtendModal({ open, count, scopeLabel, onClose, onDone }) {
  const [minutes, setMinutes] = useState(5);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => { if (open) { setMinutes(5); setReason(''); } }, [open]);
  const go = async () => { setBusy(true); try { await onDone(Number(minutes), reason.trim()); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); } };
  return (
    <Modal open={open} title="Extend time" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={!reason.trim() || !(minutes >= 1 && minutes <= 60)} onClick={go}>Extend {count} candidate{count === 1 ? '' : 's'}</Button></>}>
      <div className="stack">
        <p>{scopeLabel}</p>
        <Field label="Extra minutes (1–60)"><input className="input" type="number" min="1" max="60" value={minutes} onChange={(e) => setMinutes(e.target.value)} /></Field>
        <Field label="Reason" hint="Recorded in the audit log"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Power cut / network issue in the lab" /></Field>
      </div>
    </Modal>
  );
}

function AddLinksModal({ open, sessionId, cap, already, onClose, onCreated }) {
  const toast = useToast();
  const [count, setCount] = useState(5);
  const [text, setText] = useState('');
  const [locked, setLocked] = useState(true);
  const [hours, setHours] = useState(24);
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parsePeople(text), [text]);
  const n = parsed.rows.length || count;
  const room = Math.max(1, cap - already);
  useEffect(() => { if (open) { setCount(Math.min(5, room)); setText(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const over = capMessage(cap, already, n);
  const go = async () => {
    if (n < 1) return toast('Choose at least 1 candidate', 'error');
    if (parsed.errors.length) return toast(`Fix ${parsed.errors.length} line(s) in the list`, 'error');
    if (over) return toast(over, 'error');
    setBusy(true);
    try {
      const res = await api.proctor.createInvites(sessionId, parsed.rows.length ? { people: parsed.rows, name_locked: locked, expires_hours: hours } : { count, expires_hours: hours });
      onCreated(res.invites || []);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} wide title="Add more links" onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="success" loading={busy} disabled={n < 1} onClick={go}>Generate {n} link{n === 1 ? '' : 's'}</Button></>}>
      <div className="stack">
        <p className="muted small">This session has {already} candidate{already === 1 ? '' : 's'} counting towards the limit of {cap}; you can add {Math.max(0, cap - already)} more.</p>
        <PeopleInput count={count} setCount={setCount} text={text} setText={setText} parsed={parsed} max={room} locked={locked} setLocked={setLocked} hours={hours} setHours={setHours} allowZero={false} />
        {over && <div className="alert alert-error" role="alert">{over}</div>}
      </div>
    </Modal>
  );
}

/**
 * Live board for one session: counters (also filters), search, sort, pagination, smart highlights, selection + bulk actions.
 * Props: sessionId, sessionName, onReview(attemptId), onSessionChanged().
 */
export default function LiveBoard({ sessionId, sessionName, onReview, onSessionChanged }) {
  const toast = useToast();
  const live = useLive(sessionId);
  const limitsQ = useAsync(() => api.proctor.limits().catch(() => ({ max_candidates_per_session: 50 })), []);
  const cap = limitsQ.data?.max_candidates_per_session || 50;
  const data = live.data;
  const offset = live.offsetRef.current;

  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [sort, setSort] = useState({ key: 'status', dir: 1 });
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(() => new Set());
  const [tick, setTick] = useState(0); // 30 s: re-evaluate time-based highlights ("idle 5 min") without re-rendering every second
  const [extend, setExtend] = useState(null); // { ids|null, count, label }
  const [confirm, setConfirm] = useState(null); // { kind:'revoke_unused'|'regen_unused'|'close'|'revoke'|'reissue', row?, count? }
  const [adding, setAdding] = useState(false);
  const [links, setLinks] = useState(null); // { title, invites }

  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setTimeout(() => { setQ(qInput); setPage(0); }, 200); return () => clearTimeout(id); }, [qInput]);

  const rows = useMemo(() => data?.rows || [], [data]);
  const nowMs = Date.now() + offset; // eslint-disable-line react-hooks/exhaustive-deps
  const withAttn = useMemo(() => rows.map((r) => ({ ...r, _attn: attention(r, nowMs) })), [rows, tick, data]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = data?.counts || { total: 0, not_opened: 0, opened: 0, in_progress: 0, submitted: 0, expired: 0, revoked: 0 };
  const attnCount = withAttn.filter((r) => r._attn.length).length;
  const unusedRows = rows.filter((r) => r.invite_id && (r.status === 'not_opened' || r.status === 'opened'));
  const inProg = rows.filter((r) => r.status === 'in_progress' && r.attempt_id);
  const submittedRows = rows.filter((r) => r.status === 'submitted');
  const avg = submittedRows.length ? submittedRows.reduce((s, r) => s + Number(r.percentage || 0), 0) / submittedRows.length : 0;
  const already = Math.max(0, counts.total - counts.expired - counts.revoked);
  const closed = data?.session?.status === 'closed';

  const matches = (r) => {
    if (filter === 'gone') { if (r.status !== 'expired' && r.status !== 'revoked') return false; }
    else if (filter === 'attn') { if (!r._attn.length) return false; }
    else if (filter !== 'all' && r.status !== filter) return false;
    const t = q.trim().toLowerCase();
    return !t || `${r.name || ''} ${r.email || ''} ${r.tester_id || ''}`.toLowerCase().includes(t);
  };
  const view = useMemo(() => {
    const list = withAttn.filter(matches);
    const cmp = SORTERS[sort.key] || SORTERS.status;
    return list.sort((a, b) => sort.dir * cmp(a, b) || String(a.name || '').localeCompare(String(b.name || '')));
  }, [withAttn, filter, q, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const pageRows = view.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  useEffect(() => { if (page > pages - 1) setPage(0); }, [pages, page]);
  useEffect(() => setPage(0), [filter]);

  const selectedRows = rows.filter((r) => sel.has(rowKey(r)));
  const selInProg = selectedRows.filter((r) => r.status === 'in_progress' && r.attempt_id).map((r) => r.attempt_id);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => sel.has(rowKey(r)));
  const toggle = (r) => setSel((s) => { const n = new Set(s); const k = rowKey(r); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const togglePage = () => setSel((s) => { const n = new Set(s); pageRows.forEach((r) => (allOnPage ? n.delete(rowKey(r)) : n.add(rowKey(r)))); return n; });
  const sortBy = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }));

  const changed = () => { live.refresh(); onSessionChanged?.(); };
  const askExtend = (ids) => {
    const target = ids ? rows.filter((r) => ids.includes(r.attempt_id)) : inProg;
    if (!target.length) return toast('No candidate is taking the test right now', 'error');
    setExtend({ ids: ids || null, count: target.length, label: ids ? `Add time for ${target.length === 1 ? target[0].name : `${target.length} selected candidates`}.` : `Add time for all ${target.length} candidates who are taking the test right now.` });
  };
  const doExtend = async (minutes, reason) => {
    const res = await api.proctor.bulk(sessionId, { action: 'extend', minutes, reason, ...(extend.ids ? { attempt_ids: extend.ids } : {}) });
    toast(`Extended ${res.affected ?? extend.count} candidate(s) by ${minutes} min`, 'success');
    setExtend(null); changed();
  };

  const runConfirm = async () => {
    const c = confirm;
    try {
      if (c.kind === 'revoke_unused') { const r = await api.proctor.bulk(sessionId, { action: 'revoke_unused' }); toast(`${r.affected ?? 0} unused link(s) revoked`, 'success'); }
      else if (c.kind === 'regen_unused') { const r = await api.proctor.bulk(sessionId, { action: 'regenerate_unused' }); setLinks({ title: 'New links', invites: r.invites || [] }); toast(`${r.affected ?? (r.invites || []).length} link(s) regenerated`, 'success'); }
      else if (c.kind === 'close') { await api.proctor.bulk(sessionId, { action: 'close' }); toast('Session closed', 'success'); }
      else if (c.kind === 'revoke') { await api.proctor.revokeInvite(c.row.invite_id); toast('Link revoked', 'success'); }
      else if (c.kind === 'reissue') { const r = await api.proctor.reissueInvite(c.row.invite_id, { expires_hours: 24 }); setLinks({ title: c.row.status === 'in_progress' ? 'Resume link' : 'New link', invites: [r.invite] }); }
      changed();
    } catch (e) { toast(e.message, 'error'); }
    setConfirm(null);
  };

  const exportCsv = () => downloadCSV(`${String(sessionName || 'session').replace(/\W+/g, '_')}_results.csv`, [
    { label: 'Tester ID', value: (r) => r.tester_id }, { label: 'Name', value: (r) => r.name }, { label: 'Email', value: (r) => r.email }, { label: 'Status', value: (r) => r.status },
    { label: 'Opened', value: (r) => r.opened_at }, { label: 'Started', value: (r) => r.started_at }, { label: 'Answered', value: (r) => r.answered }, { label: 'Questions', value: (r) => r.total_questions },
    { label: 'Flags', value: (r) => r.flag_count }, { label: 'Screen leaves', value: (r) => r.screen_leaves }, { label: 'Score', value: (r) => r.total_score }, { label: 'Max', value: (r) => r.max_score }, { label: 'Percentage', value: (r) => r.percentage },
  ], rows);

  const chips = [
    { key: 'all', label: 'Total', n: counts.total }, { key: 'not_opened', label: 'Not opened', n: counts.not_opened }, { key: 'opened', label: 'Opened', n: counts.opened, tone: 'amber' },
    { key: 'in_progress', label: 'In progress', n: counts.in_progress, tone: 'blue' }, { key: 'submitted', label: 'Submitted', n: counts.submitted, tone: 'green' },
    { key: 'gone', label: 'Expired / revoked', n: counts.expired + counts.revoked, tone: 'red' },
  ];

  const th = (key, label, sortable = true) => (
    <th scope="col" className={sortable ? 'sortable' : ''} onClick={sortable ? () => sortBy(key) : undefined} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
      {label}{sort.key === key && <span aria-hidden="true"> {sort.dir === 1 ? '▲' : '▼'}</span>}
    </th>
  );

  if (live.loading && !data) return <Card title="Live board" pad={false}><Spinner /></Card>;
  if (live.error && !data) return <ErrorBox error={live.error} onRetry={live.refresh} />;

  return (
    <div className="stack">
      <div className="board-chips" role="group" aria-label="Filter by status">
        {chips.map((c) => (
          <button key={c.key} type="button" className={`board-chip tone-${c.tone || ''}`} aria-pressed={filter === c.key} onClick={() => setFilter(filter === c.key && c.key !== 'all' ? 'all' : c.key)}>
            <b><CountUp value={c.n} duration={500} /></b><span>{c.label}</span>
          </button>
        ))}
        <button type="button" className={`board-chip tone-amber attn ${attnCount ? 'on' : ''}`} aria-pressed={filter === 'attn'} onClick={() => setFilter(filter === 'attn' ? 'all' : 'attn')} title="Stuck links, idle candidates, repeated leaves or flags">
          <b><CountUp value={attnCount} duration={500} /></b><span>Needs attention</span>
        </button>
        {submittedRows.length > 0 && <div className="board-chip" aria-label="Average score"><b><CountUp value={`${num(avg)}%`} duration={500} /></b><span>Average</span></div>}
      </div>

      <Card title="Candidates" pad={false}
        subtitle={<span className="board-meta"><span className={`live-dot ${live.error ? 'err' : document.hidden ? 'off' : ''}`} aria-hidden="true" /> Live · updated <Ago at={live.updatedRef} /> · refreshes every 10 s while this tab is open</span>}
        actions={<Button size="sm" variant="ghost" onClick={live.refresh}>↻ Refresh</Button>}>
        {live.error && <ErrorBox error={live.error} onRetry={live.refresh} />}
        {closed && <div className="alert alert-warn" style={{ margin: 12 }}>This session is closed — candidates who have not started can no longer begin. Running attempts continue until their timer ends.</div>}

        <div className="board-bar">
          <input className="input search grow" type="search" placeholder="Search name, email or Tester ID…" value={qInput} onChange={(e) => setQInput(e.target.value)} aria-label="Search candidates" />
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)} disabled={closed}>+ Add links</Button>
          <Button size="sm" variant="ghost" onClick={exportCsv} disabled={!rows.length}>⬇ Export results</Button>
        </div>

        <div className="board-bulk" role="toolbar" aria-label="Bulk actions">
          <strong className="small">{sel.size ? `${sel.size} selected` : 'Bulk actions'}</strong>
          <Button size="sm" onClick={() => askExtend(selInProg.length ? selInProg : null)} disabled={!inProg.length}>⏱ Extend time{selInProg.length ? ` (${selInProg.length} selected)` : ' (all in progress)'}</Button>
          <Button size="sm" variant="ghost" disabled={!unusedRows.length} onClick={() => setConfirm({ kind: 'revoke_unused', count: unusedRows.length })}>Revoke unused links ({unusedRows.length})</Button>
          <Button size="sm" variant="ghost" disabled={!unusedRows.length || closed} onClick={() => setConfirm({ kind: 'regen_unused', count: unusedRows.length })}>Regenerate unused ({unusedRows.length})</Button>
          <Button size="sm" variant="danger" disabled={closed} onClick={() => setConfirm({ kind: 'close' })}>Close session</Button>
          {sel.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear selection</Button>}
        </div>

        {view.length === 0 ? (
          <EmptyState title={rows.length ? 'No candidates match' : 'No candidates yet'} hint={rows.length ? 'Try another filter or search.' : 'Use “Add links” to generate one-time links for your candidates.'} />
        ) : (
          <div className="table-scroll"><table className="table stackable board-table">
            <thead><tr>
              <th scope="col" style={{ width: 36 }}><input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={togglePage} /></th>
              {th('name', 'Candidate')}{th('status', 'Status')}{th('time', 'Time left')}{th('progress', 'Progress')}{th('flags', 'Flags / leaves')}{th('activity', 'Last activity')}{th('score', 'Score')}
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr></thead>
            <tbody>{pageRows.map((r, i) => {
              const st = STATUS[r.status] || { label: r.status, tone: 'gray' };
              const total = r.started_at && r.ends_at ? Math.max(1, Math.round((new Date(r.ends_at) - new Date(r.started_at)) / 1000)) : 1;
              const crit = r._attn.some((a) => a.crit);
              return (
                <tr key={rowKey(r)} className={r._attn.length ? (crit ? 'hl-crit' : 'hl-warn') : ''} style={{ '--ri': Math.min(i, 12) }}>
                  <td data-label="Select"><input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.has(rowKey(r))} onChange={() => toggle(r)} /></td>
                  <td data-label="Candidate"><div className="name-cell"><strong>{r.name || '—'}</strong><span>{r.email || ''}</span></div>{r.tester_id && <span className="tester-chip">{r.tester_id}</span>}</td>
                  <td data-label="Status"><Badge tone={st.tone} live={r.status === 'in_progress'}>{st.label}</Badge>{r._attn.map((a) => <span key={a.k} className={`hl-pill ${a.crit ? 'crit' : ''}`}>{a.t}</span>)}</td>
                  <td data-label="Time left">{r.status === 'in_progress' && r.ends_at ? <Countdown endsAt={r.ends_at} offset={offset} total={total} /> : <span className="muted">—</span>}</td>
                  <td data-label="Progress" style={{ minWidth: 120 }}>{r.status === 'in_progress' || r.status === 'submitted' ? <><div className="small">{r.answered ?? 0}/{r.total_questions ?? 0} answered</div><ProgressBar value={r.answered || 0} max={r.total_questions || 1} tone="blue" /></> : <span className="muted">—</span>}</td>
                  <td data-label="Flags / leaves">{r.attempt_id ? <span className={(r.flag_count || 0) === 0 ? 'flag-0' : r.flag_count < 5 ? 'flag-low' : 'flag-high'}>⚑ {r.flag_count || 0}<span className="muted"> · leaves {r.screen_leaves || 0}</span></span> : <span className="muted">—</span>}</td>
                  <td data-label="Last activity" className="muted small">{r.status === 'in_progress' ? agoText(r.last_activity_at || r.started_at, nowMs) : r.status === 'opened' ? `opened ${agoText(r.opened_at, nowMs)}` : r.status === 'submitted' ? fmtDate(r.last_activity_at) : '—'}</td>
                  <td data-label="Score">{r.status === 'submitted' ? <b>{num(r.total_score)}<span className="muted"> / {num(r.max_score)} · {num(r.percentage)}%</span></b> : <span className="muted">—</span>}</td>
                  <td data-label=""><div className="cell-actions">
                    {r.attempt_id && <Button size="sm" variant="ghost" onClick={() => onReview?.(r.attempt_id)}>Review</Button>}
                    {r.status === 'in_progress' && r.attempt_id && <Button size="sm" variant="ghost" onClick={() => askExtend([r.attempt_id])}>+ Time</Button>}
                    {r.status === 'in_progress' && r.invite_id && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'reissue', row: r })}>Resume link</Button>}
                    {(r.status === 'not_opened' || r.status === 'opened') && r.invite_id && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'revoke', row: r })}>Revoke</Button>}
                    {['not_opened', 'opened', 'expired', 'revoked'].includes(r.status) && r.invite_id && !closed && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'reissue', row: r })}>Reissue</Button>}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}

        <div className="board-pager">
          <span className="muted small">{view.length} of {rows.length} candidate{rows.length === 1 ? '' : 's'}{pages > 1 ? ` · page ${page + 1} of ${pages}` : ''}</span>
          {pages > 1 && <div className="row"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</Button><Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next →</Button></div>}
        </div>
      </Card>

      <ExtendModal open={!!extend} count={extend?.count || 0} scopeLabel={extend?.label} onClose={() => setExtend(null)} onDone={doExtend} />
      <AddLinksModal open={adding} sessionId={sessionId} cap={cap} already={already} onClose={() => setAdding(false)} onCreated={(inv) => { setAdding(false); setLinks({ title: `${inv.length} new link${inv.length === 1 ? '' : 's'}`, invites: inv }); changed(); }} />
      <Modal open={!!links} wide title={links?.title || 'Links'} onClose={() => setLinks(null)}>
        {links && <LinksReady invites={links.invites} title="Links ready" sessionName={sessionName} onDone={() => setLinks(null)} />}
      </Modal>
      <ConfirmDialog open={!!confirm} danger={['revoke_unused', 'close', 'revoke'].includes(confirm?.kind)}
        title={{ revoke_unused: 'Revoke all unused links?', regen_unused: 'Regenerate unused links?', close: 'Close this session?', revoke: 'Revoke this link?', reissue: confirm?.row?.status === 'in_progress' ? 'Create a resume link?' : 'Reissue this link?' }[confirm?.kind] || 'Are you sure?'}
        message={{
          revoke_unused: `${confirm?.count} link(s) that nobody has started will stop working immediately.`,
          regen_unused: `${confirm?.count} unused link(s) are cancelled and replaced by new ones with the same Tester IDs. You will see the new links once.`,
          close: 'Candidates who have not started will no longer be able to begin. Running attempts continue until their timer ends.',
          revoke: `${confirm?.row?.tester_id}: the link stops working immediately.`,
          reissue: confirm?.row?.status === 'in_progress'
            ? `${confirm?.row?.tester_id} already started. A one-time resume link lets the same candidate continue the SAME test (timer unchanged) if they lost their browser session.`
            : `${confirm?.row?.tester_id}: a new one-time link with the same Tester ID is created and the old one is cancelled.`,
        }[confirm?.kind]}
        confirmLabel={{ revoke_unused: 'Revoke all', regen_unused: 'Regenerate', close: 'Close session', revoke: 'Revoke', reissue: 'Create new link' }[confirm?.kind] || 'Confirm'}
        onCancel={() => setConfirm(null)} onConfirm={runConfirm} />
    </div>
  );
}
