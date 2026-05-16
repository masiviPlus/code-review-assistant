'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';
import { apiWithAuth, setAccessToken } from '@/lib/auth';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<RegisterResult>;
  logout: () => Promise<void>;
}

type LoginResult =
  | { ok: true }
  | { ok: false; error: { code: string; message: string } };

type RegisterResult = LoginResult;

const AuthContext = createContext<AuthContextValue | null>(null);

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });

  // On mount, try to restore session via refresh token cookie
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await apiWithAuth<{
        id: string;
        email: string;
        displayName: string;
        role: string;
      }>('/api/auth/me');

      if (!cancelled) {
        if (res.ok) {
          setState({ user: res.data, loading: false });
        } else {
          setState({ user: null, loading: false });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const res = await api<{ accessToken: string; user: User }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        },
      );

      if (res.ok) {
        setAccessToken(res.data.accessToken);
        setState({ user: res.data.user, loading: false });
        return { ok: true };
      }

      return { ok: false, error: res.error };
    },
    [],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      displayName: string,
    ): Promise<RegisterResult> => {
      const res = await api<{ accessToken: string; user: User }>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ email, password, displayName }),
          credentials: 'include',
        },
      );

      if (res.ok) {
        setAccessToken(res.data.accessToken);
        setState({ user: res.data.user, loading: false });
        return { ok: true };
      }

      return { ok: false, error: res.error };
    },
    [],
  );

  const logout = useCallback(async () => {
    await api('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setAccessToken(null);
    setState({ user: null, loading: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

export function useUser() {
  const { user, loading } = useAuth();
  return { user, loading };
}

export function useLogin() {
  const { login } = useAuth();
  return login;
}

export function useRegister() {
  const { register } = useAuth();
  return register;
}

export function useLogout() {
  const { logout } = useAuth();
  return logout;
}
