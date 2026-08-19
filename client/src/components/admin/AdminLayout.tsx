import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../store/auth';
import ConnectionIndicator from './ConnectionIndicator';

/**
 * The admin shell.
 *
 * Fixed left sidebar with grouped navigation, a very light neutral canvas, and
 * white cards doing the separating. The Viannes Bistro red appears only on the active
 * row and on primary actions — the rest is grayscale on purpose, so the admin
 * reads as a back-office tool rather than a second storefront.
 */
const NAV_GROUPS: {
  label: string;
  items: { to: string; label: string; icon: string; end?: boolean }[];
}[] = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: '▦', end: true },
      { to: '/admin/orders', label: 'Orders', icon: '☰' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { to: '/admin/menu', label: 'Menu items', icon: '◍' },
      { to: '/admin/modifiers', label: 'Modifier library', icon: '⚗' },
      { to: '/admin/categories', label: 'Categories', icon: '⊞' },
    ],
  },
];

export default function AdminLayout() {
  const { user, status, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);

  // The session is an httpOnly cookie, so the client cannot inspect it — ask
  // the server who we are instead of trusting cached UI state. Every admin
  // route is enforced server-side regardless; this only decides what to paint.
  useEffect(() => {
    if (status === 'unknown') void refresh();
  }, [status, refresh]);

  if (status === 'unknown' || status === 'checking') {
    return (
      <div className="grid min-h-screen place-items-center bg-admin-bg">
        <p className="text-sm text-admin-muted">Checking your session…</p>
      </div>
    );
  }

  if (status === 'anonymous' || user?.role !== 'admin') {
    return <Navigate to="/admin/login" replace />;
  }

  const signOut = async () => {
    await logout();
    navigate('/admin/login');
  };

  const nav = (
    <>
      <div className="flex items-center gap-2.5 px-3 pb-6 pt-1">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-red text-sm text-white">
          V
        </span>
        <span className="text-[0.95rem] font-semibold tracking-tight text-admin-ink">Viannes Bistro</span>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-admin-subtle">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileNav(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150 ${
                      isActive
                        ? 'bg-brand-red/10 font-medium text-brand-red'
                        : 'text-admin-muted hover:bg-admin-bg hover:text-admin-ink'
                    }`
                  }
                >
                  <span aria-hidden className="w-4 text-center text-sm">
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-6 border-t border-admin-line pt-4">
        {/* Whether this admin is looking at live data. */}
        <div className="px-3 pb-3">
          <ConnectionIndicator />
        </div>
        <div className="flex items-center gap-3 px-3 pb-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-admin-bg text-xs font-semibold text-admin-muted">
            {user.name?.[0]?.toUpperCase() ?? 'A'}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-admin-ink">{user.name}</p>
            <p className="truncate text-xs text-admin-subtle">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="w-full rounded-xl px-3 py-2 text-left text-sm text-admin-muted transition-colors duration-150 hover:bg-admin-bg hover:text-admin-ink"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-admin-bg text-admin-ink antialiased">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-admin-line bg-admin-sidebar px-4 py-5 lg:flex">
        {nav}
      </aside>

      {/* Mobile: the same nav, in a sheet. */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-admin-ink/40"
            onClick={() => setMobileNav(false)}
            role="presentation"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-admin-sidebar px-4 py-5">
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <div className="flex items-center gap-3 border-b border-admin-line bg-admin-surface px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
            className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-admin-line"
          >
            ☰
          </button>
          <span className="text-sm font-semibold tracking-tight">Viannes Admin</span>
          <ConnectionIndicator className="ml-auto" />
        </div>

        <main className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
