import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { homeFor, useAuth } from '../components/AuthContext.jsx';
import { Button, Field } from '../components/ui.jsx';
import { useWake } from '../utils/wake.js';
import { APP_VERSION_LABEL } from '../version.js';

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const { user } = useAuth();
  const [waking, run] = useWake(); // the free server may be asleep: retry for up to ~90 s with a friendly message
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const v = email.trim();
    if (!EMAIL_OK.test(v)) { setError('Enter the email address you use to sign in.'); return; }
    setBusy(true);
    try {
      const res = await run(() => api.forgotPassword(v));
      setMessage(res?.message || 'If this email belongs to a proctor account, a reset link has been sent or your admin has been notified.');
    } catch (err) {
      setError(err.status === 429 ? err.message : err.message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <div className="login-screen">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <main>
        {message ? (
          <section className="login-card auth-card" aria-labelledby="fp-title">
            <img src="/logo-192.png" alt="HPAI" width="84" height="84" decoding="async" />
            <h1 id="fp-title">Check your email or your admin</h1>
            <div className="alert alert-success auth-msg" role="status">{message}</div>
            <div className="auth-steps">
              <h2>What happens next</h2>
              <ol>
                <li><b>If email reset is enabled</b>, you will get a message within a few minutes (check spam too). The link works <b>once</b> and expires in about 30 minutes.</li>
                <li><b>Otherwise</b>, your admin sees your request under <i>Users → Password reset requests</i> and will send you a one-time link or a temporary password.</li>
                <li>You can also contact your admin directly and ask for a reset.</li>
              </ol>
            </div>
            <p className="auth-foot"><Link className="forgot-link" to="/login">← Back to sign in</Link></p>
            <p className="app-version app-version-login">HPAI Testing Assessment · {APP_VERSION_LABEL}</p>
          </section>
        ) : (
          <form className="login-card auth-card" onSubmit={submit} noValidate aria-labelledby="fp-title">
            <img src="/logo-192.png" alt="HPAI" width="84" height="84" decoding="async" />
            <h1 id="fp-title">Forgot your password?</h1>
            <p className="sub">Enter your proctor email. We will send you a reset link, or ask your admin to help.</p>
            <div className="stack" style={{ textAlign: 'left' }}>
              <Field label="Email">
                <input className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoFocus />
              </Field>
              {waking && busy && <div className="wake-note" role="status"><span className="spinner spinner-sm" /> Waking up the server… this can take up to a minute. Please wait.</div>}
              {error && <div className="alert alert-error" role="alert">{error}</div>}
              <Button type="submit" loading={busy} style={{ width: '100%', minHeight: 48 }}>Send reset link</Button>
              <p className="auth-note">This is for <b>proctors</b>. Candidates do not need a password: use the link your proctor gave you.</p>
            </div>
            <p className="auth-foot"><Link className="forgot-link" to="/login">← Back to sign in</Link></p>
            <p className="app-version app-version-login">HPAI Testing Assessment · {APP_VERSION_LABEL}</p>
          </form>
        )}
      </main>
    </div>
  );
}
