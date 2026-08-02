import { useEffect, useState } from 'react';

function getNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }
  return navigator.onLine;
}

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(getNavigatorOnline);

  useEffect(() => {
    const handleOnline = (): void => {
      setIsOnline(true);
    };
    const handleOffline = (): void => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
