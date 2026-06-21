import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

/**
 * useAudits(filters) - List + CRUD hook for the user's audit collection.
 *
 * Exposes:
 *   {
 *     audits, loading, error, refetch,
 *     createAudit, deleteAudit, restoreAudit, purgeAudit,
 *   }
 *
 * Mutations optimistically remove the affected audit from the list.
 */
function useAudits(filters = {}) {
  const backend = useBackend();
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const filtersKey = JSON.stringify(filters);

  const fetch = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await backend.getAudits();
      if (!ac.signal.aborted) {
        setAudits(Array.isArray(data) ? data : []);
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
    // filters is intentionally in the dep key (via filtersKey) for stable identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, filtersKey]);

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  const refetch = useCallback(() => fetch(), [fetch]);

  const removeFromList = useCallback((id) => {
    setAudits((prev) => prev.filter((a) => (a._id || a.id) !== id));
  }, []);

  const createAudit = useCallback(
    async (auditData) => {
      const { audit } = await backend.createAudit(auditData);
      if (audit) setAudits((prev) => [audit, ...prev]);
      return audit;
    },
    [backend]
  );

  const deleteAudit = useCallback(
    async (id) => {
      await backend.deleteAudit(id);
      removeFromList(id);
    },
    [backend, removeFromList]
  );

  const restoreAudit = useCallback(
    async (id) => {
      const restored = await backend.restoreAudit(id);
      refetch();
      return restored;
    },
    [backend, refetch]
  );

  const purgeAudit = useCallback(
    async (id) => {
      await backend.purgeAudit(id);
      removeFromList(id);
    },
    [backend, removeFromList]
  );

  return {
    audits,
    loading,
    error,
    refetch,
    createAudit,
    deleteAudit,
    restoreAudit,
    purgeAudit,
  };
}
