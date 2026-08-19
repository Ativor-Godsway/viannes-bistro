import axios from 'axios';
import { create } from 'zustand';
import { api, setToken, clearToken, getToken } from '../lib/api';
import { resetSocket } from '../lib/socket';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'admin' | 'staff';
}

/**
 * Auth state.
 *
 * The JWT lives in localStorage (see lib/api.ts) and is sent as a bearer
 * token. This is a documented downgrade from an httpOnly cookie — SECURITY.md
 * explains why and how to reverse it.
 *
 * The cached user is non-sensitive UI state (a name and a role, for painting
 * the shell without a flash). It is never trusted for authorisation: every
 * admin route is enforced server-side, and `refresh()` re-checks the real
 * session against /auth/me on load.
 */
type Status = 'unknown' | 'checking' | 'authenticated' | 'anonymous';

interface AuthState {
  user: AuthUser | null;
  status: Status;
  setUser: (user: AuthUser, token?: string) => void;
  /** Verify the session cookie with the server. */
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const CACHE_KEY = 'viannes_user';

function readCache(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set) => ({
  user: readCache(),
  status: 'unknown',

  setUser: (user, token) => {
    if (token) {
      setToken(token);
      // Re-handshake so the socket carries the new token.
      resetSocket();
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    } catch {
      /* non-fatal */
    }
    set({ user, status: 'authenticated' });
  },

  refresh: async () => {
    // No stored token means no session; skip the round trip.
    if (!getToken()) {
      localStorage.removeItem(CACHE_KEY);
      set({ user: null, status: 'anonymous' });
      return;
    }
    set({ status: 'checking' });
    try {
      const { data } = await api.get<{ user: AuthUser }>('/auth/me');
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data.user));
      } catch {
        /* non-fatal */
      }
      set({ user: data.user, status: 'authenticated' });
    } catch (err) {
      /**
       * Only an actual 401 means the session is dead.
       *
       * A network failure or a timeout means the SERVER is unreachable, which
       * on Render's free tier is the ordinary 30–60s cold start. Treating that
       * as "logged out" wiped the admin's token and bounced them to the login
       * screen every time the instance slept — precisely the thing this page
       * is supposed to survive. Keep the session and let the next request
       * decide.
       */
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401) {
        clearToken();
        localStorage.removeItem(CACHE_KEY);
        set({ user: null, status: 'anonymous' });
        return;
      }
      // Unreachable, not unauthorised. Stay signed in on the cached user.
      set({ status: readCache() ? 'authenticated' : 'anonymous' });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* clear locally regardless */
    }
    clearToken();
    localStorage.removeItem(CACHE_KEY);
    resetSocket();
    set({ user: null, status: 'anonymous' });
  },
}));
