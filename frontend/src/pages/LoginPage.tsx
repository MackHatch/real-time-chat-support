import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { apiFetch, ApiError } from '../lib/api';

export function LoginPage() {
  const { setToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('agent@local.test');
  const [password, setPassword] = useState('Agent123!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const result = await apiFetch<{
        accessToken: string;
        user: {
          id: string;
          email: string;
          role: 'ADMIN' | 'AGENT';
          name: string;
        };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setToken(result.accessToken);
      setUser(result.user);
      navigate('/app/inbox', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Unable to sign in.');
      } else {
        setError('Unable to sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100">
      <div className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-950 p-6 shadow-lg space-y-4">
        <div>
          <h1 className="text-lg font-semibold">Agent login</h1>
          <p className="mt-1 text-xs text-slate-400">
            Use seed credentials: <span className="font-mono">agent@local.test</span> /{' '}
            <span className="font-mono">Agent123!</span>
          </p>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <label className="block text-xs text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              data-testid="login-email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              data-testid="login-password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
          {error && (
            <p className="text-xs text-red-400" data-testid="login-error">
              {error}
            </p>
          )}
          <button
            type="submit"
            data-testid="login-submit"
            disabled={submitting}
            className="mt-2 w-full rounded-md bg-slate-800 px-3 py-2 text-sm font-medium hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

