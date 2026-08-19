import { useLiveConnection } from '../../lib/useLiveConnection';

/**
 * Whether the admin is looking at live data.
 *
 * A dot and a word, nothing more. During a Render cold start the honest
 * message is that updates are paused, because they are — the page still polls
 * every 60s, so it is stale rather than wrong.
 */
const STATES = {
  connected: { dot: 'bg-emerald-500', text: 'text-admin-muted', label: 'Live' },
  reconnecting: { dot: 'bg-amber-500 animate-pulse', text: 'text-amber-700', label: 'Reconnecting…' },
  offline: { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Updates paused' },
} as const;

export default function ConnectionIndicator({ className = '' }: { className?: string }) {
  const state = useLiveConnection();
  const { dot, text, label } = STATES[state];

  return (
    <span
      className={`inline-flex items-center gap-2 text-xs ${text} ${className}`}
      role="status"
      aria-live="polite"
      title={
        state === 'connected'
          ? 'Receiving live updates'
          : 'Live updates are paused — the list still refreshes every minute'
      }
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
