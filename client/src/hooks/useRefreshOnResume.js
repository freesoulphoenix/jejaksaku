import { useEffect, useRef } from 'react';

export default function useRefreshOnResume(refresh, intervalMs = 60000) {
  const refreshRef = useRef(refresh);
  const inFlightRef = useRef(false);
  const lastRefreshRef = useRef(Date.now());

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    async function runRefresh(force = false) {
      if (
        inFlightRef.current
        || document.visibilityState !== 'visible'
        || (!force && Date.now() - lastRefreshRef.current < 10000)
      ) {
        return;
      }

      inFlightRef.current = true;
      lastRefreshRef.current = Date.now();

      try {
        await refreshRef.current?.();
      } finally {
        inFlightRef.current = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        runRefresh();
      }
    }

    function handleFocus() {
      runRefresh();
    }

    function handleOnline() {
      runRefresh(true);
    }

    const intervalId = window.setInterval(() => runRefresh(true), intervalMs);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [intervalMs]);
}
