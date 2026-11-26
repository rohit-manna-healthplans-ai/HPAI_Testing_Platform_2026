import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api.js';
import AttemptReview from '../../components/AttemptReview.jsx';
import LiveBoard from '../../components/LiveBoard.jsx';
import SessionPaper from '../../components/SessionPaper.jsx';
import { Badge, Button, ErrorBox, Spinner, useAsync, useToast } from '../../components/ui.jsx';
import { fmtDate } from '../../utils/format.js';
import '../../components/invites.css';

/** Session page: header + paper, and the LIVE BOARD (candidates, links, counters, bulk actions). The board polls on its own (ETag, paused when hidden). */
export default function SessionDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { loading, data, error, reload } = useAsync(() => api.proctor.session(id), [id]); // loaded once; the board owns the live data
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error && !data) return <ErrorBox error={error} onRetry={reload} />;
  const { session } = data;
  const open = session.status === 'open';

  const reopen = async () => {
    setBusy(true);
    try { await api.proctor.updateSession(id, { status: 'open' }); toast('Session reopened', 'success'); reload(true); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/proctor/sessions" className="small">← All sessions</Link>
          <h1 style={{ marginTop: 6 }}>{session.name} <Badge tone={open ? 'green' : 'gray'}>{session.status}</Badge></h1>
          <p>{session.duration_mins} min · created {fmtDate(session.created_at)}{session.opens_at ? ` · opens ${fmtDate(session.opens_at)}` : ''}{session.closes_at ? ` · closes ${fmtDate(session.closes_at)}` : ''}</p>
        </div>
        {!open && <div className="row"><Button variant="success" loading={busy} onClick={reopen}>Reopen session</Button></div>}
      </div>
      <LiveBoard sessionId={id} sessionName={session.name} onReview={setReview} onSessionChanged={() => reload(true)} />
      <div style={{ marginTop: 16 }}><SessionPaper session={session} /></div>
      <AttemptReview attemptId={review} onClose={() => setReview(null)} />
    </>
  );
}
