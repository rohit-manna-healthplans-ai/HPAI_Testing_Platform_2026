import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { Button, Field } from '../components/ui.jsx';
import { clientPasswordProblem, strengthOf } from '../utils/passwordStrength.js';
import { useWake } from '../utils/wake.js';
import { APP_VERSION_LABEL } from '../version.js';

function Shell({ title, children }) {
  return (
    <div className="login-screen">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <main>
        <section className="login-card auth-card" aria-labelledby="rp-title">
          <img src="/logo-192.png" alt="HPAI" width="84" height="84" decoding="async" />
          <h1 id="rp-title">{title}</h1>
          {children}
          <p className="app-version app-version-login">HPAI Testing Assessment · {APP_VERSION_LABEL}</p>
        </section>
      </main>
    </div>
  );
}

export default function ResetPassword() {
  const { token } = useParams(); // undefined on /reset-password (token already stripped from the address bar)
  const nav = useNavigate();
  const [waking, run] = useWake();
  const [state, setState] = useState(token ? 'checking' : 'invalid'); // checking | valid | invalid | done
  const [who, setWho] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    (async () => {
      try {
        const r = await run(() => api.checkResetToken(token));
        if (!alive) return;
        if (r?.valid) { setWho(r.name || ''); setState('valid'); } else setState('invalid');
      } catch { if (alive) setState('invalid'); }
    })();
    return () => { alive = false; };
  }, [token, run]);

  const strength = strengthOf(pw);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const problem = clientPasswordProblem(pw);
    if (problem) { setError(problem); return; }
    if (pw !== pw2) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await run(() => api.resetPassword(token, pw), { retry: false });
      setState('done');
      window.history.replaceState(window.history.state, '', '/reset-password'); // the one-time token must not stay in the address bar / history
    } catch (err) {
      if (err.status === 400 && /invalid or has expired/i.test(err.message)) setState('invalid');
      else setError(err.message);
    } finally { setBusy(false); }
  };

  if (state === 'checking') {
    return <Shell title="Checking your link…"><div className="stack"><div className="wake-note" role="status"><span className="spinner spinner-sm" /> {waking ? 'Waking up the server… this can take up to a minute.' : 'One moment…'}</div></div></Shell>;
  }

  if (state === 'invalid') {
    return (
      <Shell title="This link can’t be used">
        <div className="alert alert-warn auth-msg" role="alert">This reset link is invalid, expired or has already been used. For your security each link works only once and expires after a short time.</div>
        <div className="stack" style={{ marginTop: 18 }}>
          <Link className="btn btn-primary" to="/forgot-password" style={{ width: '100%', minHeight: 48 }}>Request a new link</Link>
          <p className="auth-foot"><Link className="forgot-link" to="/login">← Back to sign in</Link></p>
        </div>
      </Shell>
    );
  }

  if (state === 'done') {
    return (
      <Shell title="Password updated">
        <div className="alert alert-success auth-msg" role="status">Your password has been changed. You were signed out everywhere, so sign in again with the new password.</div>
        <div className="stack" style={{ marginTop: 18 }}>
          <Button style={{ width: '100%', minHeight: 48 }} onClick={() => nav('/login', { replace: true, state: { notice: 'Password updated. Sign in with your new password.' } })}>Go to sign in</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Set a new password">
      <p className="sub">{who ? `Hello ${who}. ` : ''}Choose a new password for your proctor account.</p>
      <form className="stack" style={{ textAlign: 'left' }} onSubmit={submit} noValidate>
        <Field label="New password" hint="At least 8 characters. A longer phrase is stronger.">
          <div className="pw-wrap">
            <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus aria-describedby="pw-meter-label" />
            <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
          </div>
        </Field>
        <div className="pw-meter" aria-hidden={!pw}>
          <div className={`pw-bars s${strength.score}`}><i /><i /><i /><i /></div>
          <span id="pw-meter-label" className="pw-meter-label" role="status">{pw ? `Strength: ${strength.label}` : ''}</span>
        </div>
        <Field label="Confirm new password">
          <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        {waking && busy && <div className="wake-note" role="status"><span className="spinner spinner-sm" /> Waking up the server… please wait.</div>}
        {error && <div className="alert alert-error" role="alert">{error}</div>}
        <Button type="submit" loading={busy} style={{ width: '100%', minHeight: 48 }}>Update password</Button>
      </form>
    </Shell>
  );
}
