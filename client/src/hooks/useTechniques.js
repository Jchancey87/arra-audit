import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';
import { guessLens } from '../utils/lensGuess.js';

/**
 * useTechniques(filters, { skip }) - List + CRUD hook for the technique notebook.
 *
 * Exposes:
 *   { techniques, grouped, loading, error, refetch, add, update, remove }
 *
 * Server returns { techniques, grouped } — both are exposed.
 * Pass `{ skip: true }` to defer fetching until the caller is ready
 * (e.g. until a songId is known).
 */
export function useTechniques(filters = {}, { skip = false } = {}) {
  const backend = useBackend();
  const [techniques, setTechniques] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const filtersKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    if (skip) {
      setLoading(false);
      return null;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const res = await backend.getTechniques(filters);
      if (!ac.signal.aborted) {
        setTechniques(res?.techniques || []);
        setGrouped(res?.grouped || {});
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, filtersKey, skip]);

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  const refetch = useCallback(() => fetch(), [fetch]);

  const add = useCallback(
    async (techniqueData) => {
      const created = await backend.addTechnique(techniqueData);
      // Refresh grouped view; cheaper than manual merge
      refetch();
      return created;
    },
    [backend, refetch]
  );

  const addFromSentence = useCallback(
    async (text, song, { lensHint, confidence = 3, tags, notes } = {}) => {
      if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Cannot promote an empty sentence to a technique.');
      }
      const lens = lensHint || guessLens(text);
      const songId = song?._id || song?.id || song?.songId;
      const artist = song?.artist || song?.artistName || song?.channelTitle;
      const payload = {
        description: text.trim(),
        lens,
        songId,
        artist,
        confidence,
      };
      if (tags && tags.length) payload.tags = tags;
      if (notes && notes.trim()) payload.notes = notes.trim();
      return add(payload);
    },
    [add]
  );

  const update = useCallback(
    async (id, updates) => {
      const updated = await backend.updateTechnique(id, updates);
      setTechniques((prev) =>
        prev.map((t) => ((t._id || t.id) === id ? { ...t, ...updated } : t))
      );
      return updated;
    },
    [backend]
  );

  const remove = useCallback(
    async (id) => {
      await backend.deleteTechnique(id);
      setTechniques((prev) => prev.filter((t) => (t._id || t.id) !== id));
    },
    [backend]
  );

  return { techniques, grouped, loading, error, refetch, add, addFromSentence, update, remove };
}
