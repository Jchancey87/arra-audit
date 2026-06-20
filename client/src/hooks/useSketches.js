import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

function probeAudioDuration(url) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      resolve(null);
      return;
    }
    // Vite/Vitest in jsdom never resolves metadata fetches for /uploads/*.wav,
    // so the probe would otherwise hang until the 5s safety timer fires.
    // Skip in tests; the server-side python analyze path still fills the field.
    try {
      if (import.meta?.env?.MODE === 'test') {
        resolve(null);
        return;
      }
    } catch (_) { /* swallow */ }
    const audio = new Audio();
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      try { audio.src = ''; } catch (_) { /* swallow */ }
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), 5000);
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      clearTimeout(timer);
      const d = audio.duration;
      finish(Number.isFinite(d) && d > 0 ? d : null);
    };
    audio.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    audio.src = url;
  });
}

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
      // Auto-probe duration via a hidden <audio> element so the server has it
      // before the user runs the (slower) Python analysis. Best-effort; ignore
      // failures (e.g. cors, missing file, decode error).
      try {
        if (created?.publicUrl && created?.durationSeconds == null) {
          const probed = await probeAudioDuration(created.publicUrl);
          if (probed != null) {
            const updated = await backend.updateSketch(created._id || created.id, { durationSeconds: probed });
            setSketches((prev) =>
              prev.map((s) => ((s._id || s.id) === (updated._id || updated.id) ? { ...s, ...updated } : s))
            );
            return updated;
          }
        }
      } catch (_) { /* swallow */ }
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
