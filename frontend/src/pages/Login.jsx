import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { homeFor, useAuth } from '../components/AuthContext.jsx';
import { Button, Field } from '../components/ui.jsx';
import { useWake } from '../utils/wake.js';
import { APP_VERSION_LABEL } from '../version.js';

export default function Login() {
  const { user, login } = useAuth();
  const [waking, run] = useWake(); // free-tier server may be asleep: show a friendly message and retry for up to ~90 s
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    try {
      const u = await run(() => login(email.trim(), password)); // 401 (wrong password) is never retried; network/502/503/504 are
      const from = loc.state?.from;
      nav(from && from.startsWith(homeFor(u.role)) ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(err.status === 401 ? 'Incorrect email or password.' : err.message);
    } finally { setBusy(false); }
  };

  return (
    <div className="login-screen">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <main>
      <form className="login-card" onSubmit={submit} noValidate aria-labelledby="login-title">
        <img src="/logo-192.png" alt="HPAI" width="84" height="84" decoding="async" />
        <h1 id="login-title">HPAI Assessment</h1>
        <p className="sub">Sign in to continue to your dashboard or assessment.</p>
        <div className="stack" style={{ textAlign: 'left' }}>
          <Field label="Email">
            <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoFocus />
          </Field>
          <Field label="Password">
            <div className="pw-wrap">
              <input className="input" id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
              <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </div>
          </Field>
          {waking && busy && <div className="wake-note" role="status"><span className="spinner spinner-sm" /> Waking up the server… this can take up to a minute. Please wait.</div>}
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <Button type="submit" loading={busy} style={{ width: '100%', minHeight: 48 }}>Sign in</Button>
        </div>
        <p className="app-version app-version-login">HPAI Testing Assessment · {APP_VERSION_LABEL}</p>
      </form>
      </main>
    </div>
  );
}
