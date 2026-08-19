import axios from 'axios';

/**
 * The API client.
 *
 * ┌─ DELIBERATE DOWNGRADE — see SECURITY.md ────────────────────────────────┐
 * │ The session token is kept in localStorage and sent as                   │
 * │ `Authorization: Bearer`. It used to be an httpOnly cookie, which        │
 * │ JavaScript could not read and an XSS therefore could not steal.         │
 * │                                                                         │
 * │ Why: the app (vercel.app) and the API (onrender.com) are different      │
 * │ registrable domains, so the cookie was third-party. Safari blocks those │
 * │ outright, so admin login appeared to work and every request after it    │
 * │ 401'd. Only a shared parent domain fixes that.                          │
 * │                                                                         │
 * │ Restore cookie auth once a custom domain exists — SECURITY.md has the   │
 * │ steps.                                                                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

/**
 * The API base, normalised.
 *
 * `VITE_API_URL` is pasted into a dashboard by a human, and the difference
 * between `https://api.example.com` and `https://api.example.com/api` is
 * invisible until every request 404s. Worse, the storefront *appears* to work
 * because the catalogue falls back to its offline copy — only checkout fails.
 *
 * So accept either form: a trailing slash is dropped and `/api` is appended
 * when it isn't already there. A comment in .env.example was not enough of a
 * guard for something that silently half-works.
 */
function normaliseApiUrl(raw: string | undefined): string {
  const base = (raw ?? '').trim().replace(/\/+$/, '');
  if (!base) return '/api';
  return /\/api$/.test(base) ? base : `${base}/api`;
}

export const API_URL = normaliseApiUrl(import.meta.env.VITE_API_URL);

export const TOKEN_KEY = 'besties_token';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private mode or a blocked storage partition. Failing to read must not
    // throw out of an interceptor and break every request.
    return null;
  }
};

export const setToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* non-fatal: the session simply won't survive a reload */
  }
};

export const clearToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* non-fatal */
  }
};

export const api = axios.create({
  baseURL: API_URL,
  /**
   * Long, deliberately. The API runs on a Render free instance that sleeps
   * after ~15 minutes idle and takes 30–60s to cold-start. A default-ish 10s
   * timeout would abort a legitimate wake-up and show the customer an error on
   * their very first visit, which is the one visit that matters.
   */
  timeout: 60_000,
});

// Attach the bearer token. Nothing is sent ambiently by the browser, which is
// exactly why there is no CSRF layer any more.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * On 401, drop the stored session and send an admin to the login page.
 *
 * Admin tokens expire after 12 hours, so this fires in normal use — without it
 * the admin sits looking at an empty dashboard with no explanation. Storefront
 * routes are left alone: a guest browsing the menu has no session to lose, and
 * bouncing a customer mid-checkout would be worse than the 401.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    // /auth/me is the "am I still logged in?" probe — it is *expected* to 401
    // and the caller handles it. Redirecting from here would fight that.
    const isSessionProbe = url.includes('/auth/me');

    if (status === 401 && !isSessionProbe) {
      clearToken();
      if (
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/admin') &&
        !window.location.pathname.startsWith('/admin/login')
      ) {
        window.location.assign('/admin/login');
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { error?: string })?.error || err.message || fallback;
  }
  return fallback;
}
