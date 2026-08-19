import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiError } from '../../lib/api';
import { useAuth, AuthUser } from '../../store/auth';
import { Button, Field, Input } from '../../components/admin/ui';

export default function AdminLogin() {
  // Never prefill credentials. This form shipped with a working admin
  // email/password typed in and printed underneath it — anyone who opened
  // /admin/login on the deployed site had the keys.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // The token comes back in the body and is stored by setUser → see
      // lib/api.ts for why it is not a cookie.
      const { data } = await api.post<{ user: AuthUser; token: string }>('/auth/admin-login', {
        email,
        password,
      });
      setUser(data.user, data.token);
      navigate('/admin');
    } catch (err) {
      setError(apiError(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-admin-bg px-5 text-admin-ink antialiased">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-admin-surface p-8 shadow-card">
        <div className="mb-7">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-red text-sm font-semibold text-white">
            V
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Viannes Admin</h1>
          <p className="mt-1 text-sm text-admin-muted">Sign in to manage the shop.</p>
        </div>

        <div className="space-y-4">
          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-brand-red/5 px-3 py-2 text-sm text-brand-red">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={loading} className="mt-6 w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
