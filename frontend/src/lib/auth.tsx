import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { setUnauthorizedHandler } from './api';
import { disconnectAgentSocket } from './socket';

export type AuthUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  name: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthed: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Agent JWT lives in localStorage for a simple SPA demo (survives refresh, easy Socket.IO auth).
// Tradeoff: any XSS can read the token. A production hardening path would use HttpOnly + Secure
// + SameSite cookies (or a short-lived memory access token + refresh cookie) and stricter CSP.
// See README "Security Features" → Token storage.
const ACCESS_TOKEN_KEY = 'accessToken';
const USER_KEY = 'authUser';

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

function readStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate synchronously so hard navigations (refresh / Playwright goto)
  // do not briefly see isAuthed=false and bounce /login → /app/inbox.
  const [token, setTokenState] = useState<string | null>(() => readStoredToken());
  const [user, setUserState] = useState<AuthUser | null>(() => readStoredUser());

  const setToken = useCallback((value: string | null) => {
    setTokenState(value);
    if (value) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, value);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  }, []);

  const setUser = useCallback((value: AuthUser | null) => {
    setUserState(value);
    if (value) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(USER_KEY);
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    disconnectAgentSocket();
  }, [setToken, setUser]);

  // Expired/invalid JWTs must clear the session instead of spamming 401s while UI looks logged-in
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setUser(null);
      disconnectAgentSocket();
    });
    return () => setUnauthorizedHandler(null);
  }, [setToken, setUser]);

  const value: AuthContextValue = useMemo(
    () => ({
      token,
      user,
      isAuthed: Boolean(token),
      setToken,
      setUser,
      signOut,
    }),
    [token, user, setToken, setUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

