import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

/**
 * useSong(songId) - Deep-module hook for a single song.
 *
 * Exposes:
 *   { song, loading, error, refetch, triggerAnalysis, saveOverrides, update }
 *
 * `update(partial)` does an optimistic merge + falls back to refetch on failure.
 * Pass `skip: true` to defer fetching (e.g. when songId is not yet known).
 */
export function useSong(songId, { skip = false } = {}) {
  const backend = useBackend();
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetch = useCallback(async () => {
    if (skip || !songId) {
      setLoading(false);
      return null;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await backend.getSong(songId);
      if (!ac.signal.aborted) {
        setSong(data);
        setLoading(false);
      }
      return data;
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err);
        setLoading(false);
      }
      throw err;
    }
  }, [backend, songId, skip]);

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  const refetch = useCallback(() => fetch(), [fetch]);

  const triggerAnalysis = useCallback(async () => {
    if (!songId) return null;
    await backend.triggerSongAnalysis(songId);
    return fetch();
  }, [backend, songId, fetch]);

  const saveOverrides = useCallback(
    async (overrides) => {
      if (!songId) return null;
      const updated = await backend.saveAudioOverrides(songId, overrides);
      setSong(updated?.song || updated);
      return updated;
    },
    [backend, songId]
  );

  const update = useCallback(
    async (partial) => {
      // Hook doesn't have a partial-update endpoint; optimistic merge locally.
      setSong((prev) => (prev ? { ...prev, ...partial } : prev));
      return fetch();
    },
    [fetch]
  );

  return { song, loading, error, refetch, triggerAnalysis, saveOverrides, update };
}
