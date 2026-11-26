import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { Button, Field, Modal, Spinner, useToast } from './ui.jsx';
import { api } from '../api.js';

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/questions', label: 'Questions' },
    { to: '/admin/audit', label: 'Audit log' },
  ],
  proctor: [
    { to: '/proctor', label: 'Dashboard', end: true },
    { to: '/proctor/sessions', label: 'Sessions' },
    { to: '/proctor/questions', label: 'Question bank' },
    { to: '/proctor/candidates', label: 'Candidates' },
  ],
  candidate: [{ to: '/candidate', label: 'My assessments', end: true }],
};

export function Brand({ small }) {
  return (
    <div className="brand">
      <img src="/logo-192.png" alt="HPAI" width="44" height="44" decoding="async" />
      <div>
        <strong>HPAI Assessment</strong>
        {!small && <span>Testing Platform</span>}
      </div>
    </div>
  );
}

function ChangePassword({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ old_password: '', new_password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm({ old_password: '', new_password: '' }); setErr(''); } }, [open]);
  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 8) { setErr('New password must be at least 8 characters.'); return; }
    setBusy(true); setErr('');
    try { await api.changePassword(form.old_password, form.new_password); toast('Password updated', 'success'); onClose(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title="Change password" onClose={onClose}>
      <form onSubmit={submit} className="stack">
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={form.old_password} onChange={(e) => setForm({ ...form, old_password: e.target.value })} required /></Field>
        <Field label="New password" hint="At least 8 characters"><input className="input" type="password" autoComplete="new-password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })} required /></Field>
        {err && <div className="alert alert-error">{err}</div>}
        <div className="row end"><Button variant="ghost" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Update</Button></div>
      </form>
    </Modal>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);
  const [pw, setPw] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const ref = useRef(null);
  const loc = useLocation();
  const items = NAV[user.role] || [];

  // Close the mobile nav on navigation or Escape.
  useEffect(() => { setNavOpen(false); setMenu(false); }, [loc.pathname]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { setNavOpen(false); setMenu(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setMenu(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="shell">
      <a className="skip-link" href="#content">Skip to content</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          {items.length > 1 && (
            <button className="nav-toggle" aria-label="Toggle navigation" aria-expanded={navOpen} aria-controls="main-nav" onClick={() => setNavOpen((o) => !o)}><span /><span /><span /></button>
          )}
          <nav id="main-nav" className={`topnav ${navOpen ? 'open' : ''} ${items.length <= 1 ? 'single' : ''}`} aria-label="Main">
            {items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="user" ref={ref}>
            <span className={`role-pill role-${user.role}`}>{user.role}</span>
            <button className="avatar" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="User menu">{initials}</button>
            {menu && (
              <div className="menu" role="menu">
                <div className="menu-head"><strong>{user.name}</strong><span className="muted small">{user.email}</span></div>
                <button role="menuitem" onClick={() => { setMenu(false); setPw(true); }}>Change password</button>
                <button role="menuitem" onClick={() => { logout(); nav('/login'); }}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="page" id="content" tabIndex={-1}><div key={loc.pathname} className="page-enter"><Suspense fallback={<Spinner />}><Outlet /></Suspense></div></main>
      <footer className="foot">HPAI Testing Assessment · Healthplans.ai</footer>
      <ChangePassword open={pw} onClose={() => setPw(false)} />
    </div>
  );
}
