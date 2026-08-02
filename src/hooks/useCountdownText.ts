import { useEffect, useMemo, useState } from 'react';
import { differenceInMilliseconds } from 'date-fns';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function useCountdownText(targetAt: string | null): string | null {
  const targetTime = useMemo(() => (targetAt ? new Date(targetAt).getTime() : null), [targetAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (targetTime === null) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [targetTime]);

  return useMemo(() => {
    if (targetTime === null) {
      return null;
    }
    return formatCountdown(differenceInMilliseconds(targetTime, now));
  }, [now, targetTime]);
}
