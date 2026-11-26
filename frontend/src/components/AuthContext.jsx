import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api, auth } from '../api.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export const homeFor = (role) => (role === 'admin' ? '/admin' : role === 'proctor' ? '/proctor' : '/candidate');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => (auth.token ? auth.user : null));

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    auth.set(res.token, res.user);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    auth.clear();
    setUser(null);
  }, []);

  // Used by one-time invite links: the backend hands back a ready-made session instead of email+password.
  const setSession = useCallback((token, u) => {
    auth.set(token, u);
    setUser(u);
  }, []);

  const value = useMemo(() => ({ user, login, logout, setSession }), [user, login, logout, setSession]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
