import { useCallback, useEffect, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

/**
 * useRecommendations(techniqueId, { limit, skip }) — Phase 2.4
 *
 * Wraps IBackendService.findSimilarTechniques(). Exposes:
 *   {
 *     similar:    [{ technique, score }, ...]
 *     target:     { _id, techniqueName, lens } | null
 *     loading:    boolean
 *     error:      Error | null
 *     refetch:    () => Promise<void>
 *   }
 *
 * Re-fetches when the techniqueId or limit changes. Skipped when
 * `skip` is true (e.g. the technique doesn't have enough text yet).
 */
export function useRecommendations(techniqueId, { limit = 10, skip = false } = {}) {
  const backend = useBackend();
  const [similar, setSimilar] = useState([]);
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (skip || !techniqueId) {
      setSimilar([]);
      setTarget(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await backend.findSimilarTechniques(techniqueId, { limit });
      setSimilar(Array.isArray(data?.similar) ? data.similar : []);
      setTarget(data?.target || null);
    } catch (err) {
      setError(err);
      setSimilar([]);
      setTarget(null);
    } finally {
      setLoading(false);
    }
  }, [backend, techniqueId, limit, skip]);

  useEffect(() => {
    refetch();
    // We intentionally exclude `refetch` from deps to avoid an infinite
    // re-fetch loop; the techniqueId/limit/skip are the inputs that
    // should trigger a new fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techniqueId, limit, skip]);

  return {
    similar,
    target,
    loading,
    error,
    refetch,
  };
}
