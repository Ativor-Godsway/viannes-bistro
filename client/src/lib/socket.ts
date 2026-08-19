import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

/**
 * The live-updates socket.
 *
 * The bearer token travels in the handshake `auth` payload, so the socket
 * authorises `admin:join` from the same session as every HTTP call. It used to
 * ride along as an httpOnly cookie; see lib/api.ts for why it cannot.
 *
 * ┌─ LIVENESS ──────────────────────────────────────────────────────────────┐
 * │ The API runs on a Render free instance, which sleeps after ~15 minutes   │
 * │ idle and cold-starts in 30–60s. When it wakes, the browser is still      │
 * │ holding a Socket.IO session id the new process has never seen, so the    │
 * │ handshake is rejected — and that rejection carries no CORS headers, so   │
 * │ Safari reports it as an access-control failure rather than a 400.        │
 * │                                                                          │
 * │ Two things matter here. Retrying with the dead `sid` never succeeds, so  │
 * │ a rejected session forces a FRESH handshake. And events fired while the  │
 * │ socket was down are gone for good — Socket.IO does not queue or replay   │
 * │ them — so every consumer must refetch on reconnect. That is what makes   │
 * │ an order placed during a cold start still show up.                       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Socket origin. Unlike the API base this must NOT carry a path — Socket.IO
 * appends its own `/socket.io/`. A pasted `.../api` is stripped for the same
 * reason api.ts appends one: the two variables are easy to mix up.
 */
function normaliseSocketUrl(raw: string | undefined): string {
  const base = (raw ?? '').trim().replace(/\/+$/, '').replace(/\/api$/, '');
  return base || '/';
}

export const SOCKET_URL = normaliseSocketUrl(import.meta.env.VITE_SOCKET_URL);

/**
 * `reconnecting` is the honest state for a cold start — brief and expected.
 * `offline` means it has been failing long enough to be worth telling someone
 * that updates are paused. We never stop retrying in either state.
 */
export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

/** Consecutive failures before we stop calling it a blip. ~15s at this backoff. */
const OFFLINE_AFTER_FAILURES = 4;

let socket: Socket | null = null;
let state: ConnectionState = 'reconnecting';
let failures = 0;
let staleSessionTimer: number | null = null;

const listeners = new Set<(s: ConnectionState) => void>();

function setState(next: ConnectionState): void {
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l(next));
}

export function getConnectionState(): ConnectionState {
  return state;
}

/** Subscribe to connection-state changes. Returns an unsubscribe function. */
export function subscribeConnection(cb: (s: ConnectionState) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * True when the server has forgotten our session — the signature of a restart.
 *
 * Engine.IO answers an unknown `sid` with `{"code":1,"message":"Session ID
 * unknown"}`, but the browser may only surface a generic transport/xhr error
 * because the response carries no CORS headers. Both shapes are treated the
 * same: the session cannot be resumed, so start a new one.
 */
function isDeadSession(err: Error): boolean {
  const msg = `${err.message} ${(err as { description?: unknown }).description ?? ''}`.toLowerCase();
  return (
    msg.includes('session id unknown') ||
    msg.includes('invalid session') ||
    msg.includes('xhr poll error') ||
    msg.includes('transport error') ||
    msg.includes('transport close')
  );
}

/** Capped exponential backoff with jitter: ~1s → 30s. */
function backoffMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** Math.min(attempt, 5), 30_000);
  // Jitter spreads reconnects out — otherwise every open tab in the shop
  // hammers a waking instance in lockstep.
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

/**
 * Drops the current connection and opens a brand-new one.
 *
 * Deliberately `disconnect()` + `connect()` on the SAME Socket instance rather
 * than recreating it: listeners live on the Socket, so recreating would
 * silently orphan every `socket.on(...)` a mounted component registered. The
 * Manager opens a fresh engine — and therefore a fresh handshake with no
 * stale `sid` — either way.
 */
function reHandshake(delay: number): void {
  if (!socket || staleSessionTimer !== null) return;
  socket.disconnect();
  staleSessionTimer = window.setTimeout(() => {
    staleSessionTimer = null;
    socket?.connect();
  }, delay);
}

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: true,
    // Read at connect time, so a socket opened after login is authenticated
    // and a re-handshake picks up the current token.
    auth: (cb) => cb({ token: getToken() ?? undefined }),
    /**
     * Pinned, not left to the default.
     *
     * The server's Socket.IO CORS sets `credentials: false`, so its handshake
     * response carries no `Access-Control-Allow-Credentials`. If the client
     * ever sent a credentialed request, the browser would reject the response
     * outright — surfacing as an "access control checks" failure rather than
     * anything that names the real cause.
     *
     * This default has moved between releases of the client (it was `true` in
     * the 4.7.x line), so relying on it is a dependency bump away from
     * breaking. We need no credentials here regardless: the session is a
     * bearer token in the `auth` payload above, not a cookie.
     */
    withCredentials: false,
    // Never give up: a shop laptop left open overnight must come back on its
    // own in the morning.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
    // Generous enough not to abort a legitimate 30–60s cold start.
    timeout: 45_000,
  });

  socket.on('connect', () => {
    failures = 0;
    setState('connected');
  });

  socket.on('disconnect', (reason) => {
    setState('reconnecting');
    // The server explicitly ended it; the client will not auto-reconnect.
    if (reason === 'io server disconnect') reHandshake(backoffMs(failures++));
  });

  socket.on('connect_error', (err) => {
    failures += 1;
    setState(failures >= OFFLINE_AFTER_FAILURES ? 'offline' : 'reconnecting');
    // Retrying with a session the server has forgotten can never succeed, so
    // stop retrying and start a new one instead.
    if (isDeadSession(err)) reHandshake(backoffMs(failures));
  });

  return socket;
}

/**
 * Full teardown, so the next getSocket() builds a new instance.
 *
 * Used when the identity changes (login/logout) and the socket must not keep
 * rooms it was authorised into. Not used for reconnection — see reHandshake.
 */
export function resetSocket(): void {
  if (staleSessionTimer !== null) {
    window.clearTimeout(staleSessionTimer);
    staleSessionTimer = null;
  }
  socket?.disconnect();
  socket = null;
  failures = 0;
  setState('reconnecting');
}
