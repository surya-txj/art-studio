import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';

interface AuthState {
  user: User | null;
  /** True until we know whether a session cookie is valid. */
  checking: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Holds who is logged in, for showing the right menus and pages.
 * This is only for the UI: the server checks the session and role on every request.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api<{ user: User }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 401)) console.error(err);
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ user: User }>('/auth/login', { method: 'POST', body: { email, password } });
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api<{ user: User }>('/auth/register', { method: 'POST', body: { name, email, password } });
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, checking, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
