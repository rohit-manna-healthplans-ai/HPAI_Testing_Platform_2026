import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../components/AuthContext.jsx';
import TestRules from '../components/TestRules.jsx';
import { Button, Field } from '../components/ui.jsx';
import { useWake } from '../utils/wake.js';
import '../components/invites.css';

const pad2 = (n) => String(n).padStart(2, '0');
const fmtLeft = (sec) => { const d = Math.floor(sec / 86400); const h = Math.floor((sec % 86400) / 3600); const m = Math.floor((sec % 3600) / 60); const s = sec % 60; return `${d ? `${d}d ` : ''}${pad2(h)}:${pad2(m)}:${pad2(s)}`; };

/** Live countdown to opens_at, measured against the SERVER clock (offset = server_now - local now at fetch time). */
function OpensIn({ opensAt, offset, onOpen }) {
  const calc = () => Math.max(0, Math.ceil((new Date(opensAt).getTime() - (Date.now() + offset)) / 1000));
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => { const l = calc(); setLeft(l); if (l <= 0) { clearInterval(id); onOpen?.(); } }, 1000);
    return () => clearInterval(id);
  }, [opensAt, offset]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="invite-countdown" role="timer" aria-live="off"><span>Opens in</span><b className="mono">{fmtLeft(left)}</b></div>;
}

const GONE = {
  used: { icon: '🔒', title: 'This link has already been used', text: 'Every assessment link works only once, to keep the test secure. If you were disconnected during your test, ask your proctor for a fresh resume link.' },
  expired: { icon: '⌛', title: 'This link has expired', text: 'Please ask your proctor to generate a new link for you.' },
  revoked: { icon: '⛔', title: 'This link is no longer active', text: 'Your proctor cancelled or replaced it. Please ask them for the latest link.' },
  closed: { icon: '🚪', title: 'This assessment is not open right now', text: 'The session is closed or has already finished. Please contact your proctor.' },
  invalid: { icon: '❓', title: 'We could not find this link', text: 'Check that you copied the complete link, or ask your proctor for a new one.' },
  error: { icon: '📡', title: 'Could not load the link', text: 'Please check your internet connection and try again.' },
};

export default function Invite() {
  const { token } = useParams();
  const nav = useNavigate();
  const { user, setSession } = useAuth();
  const [info, setInfo] = useState(null); // {status, ...}
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waking, run] = useWake(); // free-tier server may be asleep: "Waking up the server…" + auto-retry for up to ~90 s
  const [offset, setOffset] = useState(0);

  const load = (silent) => {
    let alive = true;
    run(() => api.invite.get(token))
      .then((d) => {
        if (!alive) return;
        if (d?.server_now) setOffset(new Date(d.server_now).getTime() - Date.now());
        if (d?.prefill) { setName((n) => n || d.prefill.name || ''); setEmail((m) => m || d.prefill.email || ''); }
        setInfo(d);
      })
      .catch(() => alive && !silent && setInfo({ status: 'error' }));
    return () => { alive = false; };
  };
  useEffect(() => load(false), [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const resume = info?.purpose === 'resume';
  const locked = !!info?.prefill?.locked;

  const start = async (e) => {
    e?.preventDefault();
    setError('');
    if (!resume && name.trim().length < 2) { setError('Please enter your full name.'); return; }
    if (!agree) { setError('Please accept the rules to continue.'); return; }
    setBusy(true);
    // Fullscreen needs a user gesture; this click counts. Not fatal if the browser refuses.
    try { await document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
    try {
      // one-time redeem is NOT auto-retried (a second attempt could hit "already used"); the server ignores name/email when the link is locked
      const res = await api.invite.redeem(token, resume ? {} : { name: name.trim(), email: email.trim() || undefined });
      setSession(res.token, res.user);
      nav(`/test/${res.attempt.id}`, { replace: true }); // replace: the one-time link must not sit in the back-stack
    } catch (err) {
      try { await document.exitFullscreen?.(); } catch { /* ignore */ }
      if (err.status === 410) {
        setInfo({ status: /revoked/i.test(err.message) ? 'revoked' : /expired/i.test(err.message) ? 'expired' : 'used' });
      } else if (err.status === 409 && /open|start/i.test(err.message)) { load(true); setError(err.message); } // window not open yet: refresh the status/countdown
      else setError(err.message);
      setBusy(false);
    }
  };

  const gone = info && info.status !== 'valid' && info.status !== 'not_open_yet' ? GONE[info.status] || GONE.invalid : null;
  const staffSignedIn = user && user.role !== 'candidate';

  return (
    <div className="login-screen">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <main>
        <div className="login-card invite-card">
          <img src="/logo-192.png" alt="HPAI" width="84" height="84" decoding="async" />
          {!info && (
            <div className="invite-loading" role="status">
              <span className="spinner" /> {waking ? 'Waking up the server… this can take up to a minute. Please keep this page open.' : 'Checking your link…'}
            </div>
          )}

          {info?.status === 'not_open_yet' && (
            <div className="invite-gone" role="status">
              <div className="invite-gone-icon" aria-hidden="true">⏳</div>
              <h1>Your assessment has not opened yet</h1>
              <p className="sub">{info.session?.name ? `“${info.session.name}” ` : 'It '}opens {info.opens_at ? new Date(info.opens_at).toLocaleString() : 'soon'}. Keep this page open — the Start button appears by itself.</p>
              {info.tester_id && <div className="invite-tester"><span>Tester ID</span><b className="mono">{info.tester_id}</b></div>}
              {info.opens_at && <OpensIn opensAt={info.opens_at} offset={offset} onOpen={() => load(true)} />}
            </div>
          )}

          {gone && (
            <div className="invite-gone" role="alert">
              <div className="invite-gone-icon" aria-hidden="true">{gone.icon}</div>
              <h1>{gone.title}</h1>
              <p className="sub">{gone.text}</p>
              {info.status === 'error' && <Button onClick={() => window.location.reload()}>Try again</Button>}
            </div>
          )}

          {info?.status === 'valid' && (
            <form onSubmit={start} noValidate aria-labelledby="invite-title">
              <h1 id="invite-title">{resume ? 'Resume your assessment' : 'HPAI Assessment'}</h1>
              <p className="sub">{resume ? 'Your proctor sent you a one-time link to continue the test you already started.' : 'You have been invited to take a timed assessment.'}</p>
              <div className="invite-tester" title="Quote this ID if you need help from your proctor">
                <span>Tester ID</span><b className="mono">{info.tester_id}</b>
              </div>
              <div className="invite-facts">
                <div><b>{info.session.name}</b><span>Assessment</span></div>
                <div><b>{info.session.duration_mins} min</b><span>Duration</span></div>
                <div><b>{info.session.question_count}</b><span>Questions</span></div>
                <div><b>{info.session.total_marks}</b><span>Total marks</span></div>
              </div>

              <div className="stack" style={{ textAlign: 'left' }}>
                {staffSignedIn && <div className="alert alert-warn"><span>You are signed in as {user.name} ({user.role}). Starting will sign you out of that account in this browser — use a private window if you are only testing.</span></div>}
                {!resume && (
                  <>
                    <Field label="Full name" hint={locked ? 'Your proctor filled this in for you. Tell them if it is wrong before you start.' : undefined}><input className="input" autoComplete="name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="As it should appear on your certificate" autoFocus={!locked} readOnly={locked} aria-readonly={locked} /></Field>
                    <Field label={locked && email ? 'Email' : 'Email (optional)'} hint={locked ? undefined : 'Only used to identify you in the results.'}><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" readOnly={locked && !!info?.prefill?.email} /></Field>
                  </>
                )}
                <div className="invite-rules">
                  <h2>Read before you start</h2>
                  <div className="alert alert-warn" style={{ marginBottom: 10, textAlign: 'left' }}><span>This link is valid for <b>one start only</b>. As soon as you press Start, it can never be used to begin again.</span></div>
                  <TestRules />
                </div>
                <label className="checkbox"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I have read and agree to follow these rules.</label>
                {error && <div className="alert alert-error" role="alert">{error}</div>}
                <Button type="submit" variant="success" loading={busy} disabled={!agree} style={{ width: '100%', minHeight: 50, fontSize: 16 }}>{resume ? 'Resume test' : 'Start assessment'}</Button>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}

