import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

/**
 * useTasteProfiles() - List + research hook for taste profiles.
 *
 * Exposes:
 *   { profiles, loading, error, refetch, research }
 *
 * `research(lens, name)` triggers a deep-dive and refreshes the list.
 */
export function useTasteProfiles() {
  const backend = useBackend();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetch = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await backend.getTasteProfiles();
      if (!ac.signal.aborted) {
        setProfiles(Array.isArray(data) ? data : []);
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
  }, [backend]);

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  const refetch = useCallback(() => fetch(), [fetch]);

  const research = useCallback(
    async (lens, name) => {
      const result = await backend.researchTasteProfile(lens, name);
      // Server returns { profile } — refresh list so the new profile appears
      refetch();
      return result;
    },
    [backend, refetch]
  );

  return { profiles, loading, error, refetch, research };
}
