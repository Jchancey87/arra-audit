import { useEffect, useRef, useState, useCallback } from 'react';
import { useBackend } from '../context/BackendContext';

/**
 * useBookmarkAnalysisStream(auditId)
 *
 * Phase 2.3 v2: subscribes to the bookmark-analysis SSE stream and
 * returns the live snapshot map. Designed for `AuditDetail` so the
 * "Queued / Analyzing / Success" pill on each bookmark card updates
 * in real time without polling.
 *
 * Returns:
 *   {
 *     snapshots:   { [bookmarkId]: { status, mood_tags, ... } },
 *     lastUpdate:  { bookmarkId, analysis, at } | null,
 *     status:      'connecting' | 'open' | 'closed' | 'error',
 *     error:       Error | null,
 *     refresh:     () => void,   // force a re-subscribe
 *   }
 *
 * The hook auto-reconnects on transient errors (up to 5 attempts with
 * exponential backoff). After 5 failures it surfaces a `status: 'error'`
 * and stops retrying so the UI can degrade to polling.
 */
export const useBookmarkAnalysisStream = (auditId) => {
  const backend = useBackend();
  const [snapshots, setSnapshots] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const statusRef = useRef('connecting');
  const retryRef = useRef({ count: 0, timer: null });

  const close = useRef(null);

  const subscribe = useCallback(() => {
    if (!auditId || !backend) return undefined;
    if (close.current) {
      try { close.current(); } catch { /* ignore */ }
      close.current = null;
    }
    setStatus('connecting');
    statusRef.current = 'connecting';
    setError(null);

    const subscription = backend.subscribeBookmarkAnalysis(auditId, {
      open: () => {
        retryRef.current.count = 0;
        setStatus('open');
        statusRef.current = 'open';
        setError(null);
      },
      snapshot: (payload) => {
        if (payload && payload.bookmarks) {
          setSnapshots(payload.bookmarks);
        }
      },
      bookmarkUpdate: (payload) => {
        if (!payload) return;
        const { bookmarkId, analysis } = payload;
        if (!bookmarkId || !analysis) return;
        setSnapshots((prev) => ({ ...prev, [bookmarkId]: analysis }));
        setLastUpdate({ bookmarkId, analysis, at: Date.now() });
      },
      error: (err) => {
        setError(err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'SSE error'));
        setStatus('error');
        statusRef.current = 'error';
      },
    });
    close.current = subscription?.close || null;
    return subscription;
  }, [auditId, backend]);

  useEffect(() => {
    if (!auditId) return undefined;
    subscribe();

    // Watchdog: if the subscription errored, retry with backoff.
    // We use a ref for status so the watchdog can read it without
    // re-creating this effect on every status change.
    const watchdog = setInterval(() => {
      if (statusRef.current === 'error' && retryRef.current.count < 5) {
        retryRef.current.count += 1;
        const delay = Math.min(15_000, 1000 * 2 ** retryRef.current.count);
        if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
        retryRef.current.timer = setTimeout(() => {
          subscribe();
        }, delay);
      }
    }, 2000);

    return () => {
      clearInterval(watchdog);
      if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
      if (close.current) {
        try { close.current(); } catch { /* ignore */ }
        close.current = null;
      }
      setStatus('closed');
    };
    // status is intentionally excluded: re-subscribing on status change
    // would re-open the stream every time an event lands, creating a
    // feedback loop. The statusRef + watchdog handles retries instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId, subscribe]);

  const refresh = useCallback(() => {
    subscribe();
  }, [subscribe]);

  return { snapshots, lastUpdate, status, error, refresh };
};

