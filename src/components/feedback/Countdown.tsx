import { useMemo } from 'react';
import { differenceInMilliseconds } from 'date-fns';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function Countdown({ targetAt, now }: { targetAt: string | null; now: Date }) {
  const label = useMemo(() => {
    if (!targetAt) {
      return 'n/a';
    }
    return formatCountdown(differenceInMilliseconds(new Date(targetAt), now));
  }, [now, targetAt]);

  return <span className="font-mono tabular-nums">{label}</span>;
}
