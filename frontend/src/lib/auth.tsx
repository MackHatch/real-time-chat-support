import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUserState] = useState<AuthUser | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedUser = window.localStorage.getItem(USER_KEY);
    if (storedToken) {
      setTokenState(storedToken);
    }
    if (storedUser) {
      try {
        setUserState(JSON.parse(storedUser));
      } catch {
        // Invalid stored user, ignore
      }
    }
  }, []);

  const setToken = (value: string | null) => {
    setTokenState(value);
    if (value) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, value);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  };

  const setUser = (value: AuthUser | null) => {
    setUserState(value);
    if (value) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(USER_KEY);
    }
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  const value: AuthContextValue = useMemo(
    () => ({
      token,
      user,
      isAuthed: Boolean(token),
      setToken,
      setUser,
      signOut,
    }),
    [token, user],
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

