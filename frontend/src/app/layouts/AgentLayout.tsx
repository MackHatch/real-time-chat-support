import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth';
import { apiFetch, ApiError } from '../../lib/api';
import { AgentSocketProvider } from '../../lib/socket-context';
import { DemoTour } from '../../components/demo/DemoTour';
import type { AuthUser } from '../../lib/auth';

export function AgentLayout() {
  const { token, setUser, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  // Always re-validate the JWT (even if user is cached) so expired tokens don't
  // leave the UI "logged in" while every API call returns 401.
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<{ user: AuthUser }>('/auth/me', {}, { token }),
    enabled: Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (meQuery.data?.user) {
      setUser(meQuery.data.user);
    }
  }, [meQuery.data, setUser]);

  useEffect(() => {
    if (meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      signOut();
      navigate('/login', { replace: true });
    }
  }, [meQuery.error, signOut, navigate]);

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  const navLinkBase =
    'block px-3 py-2 rounded-md text-sm font-medium hover:bg-slate-800 hover:text-white';
  const navLinkActive = 'bg-slate-900 text-white';
  const navLinkInactive = 'text-slate-100';

  return (
    <AgentSocketProvider>
      <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
          <div className="text-sm font-semibold tracking-wide text-slate-400">
            Support Chat
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            data-testid="signout"
            className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700"
          >
            Sign out
          </button>
        </header>

        <div className="flex flex-1">
          <nav className="w-52 border-r border-slate-800 bg-slate-950/80 p-3 space-y-1">
            <NavLink
              to="/app/inbox"
              data-testid="nav-inbox"
              className={({ isActive }) =>
                `${navLinkBase} ${
                  isActive ? navLinkActive : navLinkInactive
                }`
              }
            >
              Inbox
            </NavLink>
            <NavLink
              to="/app/tickets"
              data-testid="nav-tickets"
              className={({ isActive }) =>
                `${navLinkBase} ${
                  isActive ? navLinkActive : navLinkInactive
                }`
              }
            >
              Tickets
            </NavLink>
            <NavLink
              to="/app/analytics"
              data-testid="nav-analytics"
              className={({ isActive }) =>
                `${navLinkBase} ${
                  isActive ? navLinkActive : navLinkInactive
                }`
              }
            >
              Analytics
            </NavLink>
            <NavLink
              to="/widget"
              data-testid="nav-widget"
              className={({ isActive }) =>
                `${navLinkBase} ${
                  isActive ? navLinkActive : navLinkInactive
                }`
              }
            >
              Widget
            </NavLink>
          </nav>

          <main className="flex-1 p-4">
            <Outlet />
          </main>
        </div>
        <DemoTour />
      </div>
    </AgentSocketProvider>
  );
}

