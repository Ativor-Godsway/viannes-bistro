import { useEffect, useState } from 'react';
import { getSocket, getConnectionState, subscribeConnection, type ConnectionState } from './socket';

/** The socket's connection state, for UI that needs to be honest about it. */
export function useLiveConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(getConnectionState);
  useEffect(() => {
    // Ensure a socket exists, otherwise the indicator reports on nothing.
    getSocket();
    setState(getConnectionState());
    return subscribeConnection(setState);
  }, []);
  return state;
}

/**
 * Runs `onConnect` once on mount and again on every successful (re)connection.
 *
 * This is the fix for the real bug behind the noisy console error: events
 * emitted while the socket was down are never replayed, so an order placed
 * during a Render cold start would simply never appear. Treating every
 * reconnect as "I may have missed something" and refetching makes live events
 * an optimisation on top of a correct fetch, rather than the only path by
 * which data arrives.
 *
 * `onConnect` should also re-join any rooms — server-side room membership does
 * not survive a restart.
 *
 * The mount call is unconditional on purpose. Firing only on 'connect' would
 * mean a page whose socket never connects (server asleep, websockets blocked
 * by a captive portal) never loads its data at all, even though plain HTTP
 * would have worked. The cost is one duplicate fetch when the socket connects
 * shortly after mount, which is cheaper than a blank page.
 */
export function useOnReconnect(onConnect: () => void): void {
  useEffect(() => {
    const socket = getSocket();
    // Fires on the initial connection AND on every reconnection.
    socket.on('connect', onConnect);
    onConnect();
    return () => {
      socket.off('connect', onConnect);
    };
  }, [onConnect]);
}

/**
 * Calls `tick` every `intervalMs` while the tab is VISIBLE.
 *
 * The safety net: a permanently broken socket degrades to slightly-stale
 * instead of silently-wrong. Suspended when hidden via the Page Visibility API
 * so a backgrounded shop laptop is not polling all night, and fired once on
 * becoming visible again so returning to the tab shows current data.
 */
export function useVisiblePolling(tick: () => void, intervalMs: number): void {
  useEffect(() => {
    let timer: number | null = null;

    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const start = () => {
      stop();
      timer = window.setInterval(tick, intervalMs);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [tick, intervalMs]);
}
