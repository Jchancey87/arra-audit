import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

/**
 * useSketches(songId) - List + CRUD hook for DAW sketches tied to a song.
 *
 * Exposes:
 *   { sketches, loading, error, refetch, upload, remove, analyze }
 *
 * - `sketches` is sorted newest-first.
 * - Pass `null` songId (or omit) to defer fetching; pass a string to fetch.
 * - `upload(songId, file, opts)` and `analyze(id)` push optimistic updates
 *   and trigger `refetch` so the list stays consistent.
 */
export function useSketches(songId = null) {
  const backend = useBackend();
  const [sketches, setSketches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetch = useCallback(async () => {
    if (!songId) {
      setSketches([]);
      setLoading(false);
      return [];
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await backend.getSketches(songId);
      if (!ac.signal.aborted) {
        setSketches(Array.isArray(res) ? res : []);
        setLoading(false);
      }
      return res;
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err);
        setLoading(false);
      }
      throw err;
    }
  }, [backend, songId]);

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  const refetch = useCallback(() => fetch(), [fetch]);

  const upload = useCallback(
    async (targetSongId, file, opts = {}) => {
      const id = targetSongId || songId;
      if (!id) throw new Error('songId is required to upload a sketch');
      const created = await backend.uploadSketch(id, file, opts);
      // Optimistic prepend; refetch in background for canonical order
      setSketches((prev) => [{ ...created }, ...prev]);
      refetch();
      return created;
    },
    [backend, songId, refetch]
  );

  const remove = useCallback(
    async (id) => {
      await backend.deleteSketch(id);
      setSketches((prev) => prev.filter((s) => (s._id || s.id) !== id));
    },
    [backend]
  );

  const analyze = useCallback(
    async (id) => {
      const out = await backend.analyzeSketch(id);
      // Merge returned analysis into the local list
      if (out?.sketch) {
        setSketches((prev) =>
          prev.map((s) => ((s._id || s.id) === id ? { ...s, ...out.sketch } : s))
        );
      } else if (out?.analysis) {
        setSketches((prev) =>
          prev.map((s) =>
            (s._id || s.id) === id
              ? { ...s, analysis: out.analysis, analysisStatus: 'success' }
              : s
          )
        );
      }
      return out;
    },
    [backend]
  );

  return { sketches, loading, error, refetch, upload, remove, analyze };
}
