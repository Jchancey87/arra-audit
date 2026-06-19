import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

/**
 * useAudit(auditId) - Single-audit hook with state-machine awareness.
 *
 * Exposes:
 *   {
 *     audit, loading, error, refetch,
 *     saveResponses, setStatus, advanceStep, goBackStep, skipStep,
 *     addBookmark, updateBookmark, deleteBookmark,
 *   }
 *
 * Mutations do optimistic local updates then re-fetch to reconcile.
 */
export function useAudit(auditId, { skip = false } = {}) {
  const backend = useBackend();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const fetch = useCallback(async () => {
    if (skip || !auditId) {
      setLoading(false);
      return null;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      const data = await backend.getAudit(auditId);
      if (!ac.signal.aborted) {
        setAudit(data);
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
  }, [backend, auditId, skip]);

  useEffect(() => {
    fetch().catch(() => {});
  }, [fetch]);

  const refetch = useCallback(() => fetch(), [fetch]);

  const apply = useCallback((updated) => {
    if (updated) setAudit(updated);
  }, []);

  const saveResponses = useCallback(
    async (responses) => {
      const updated = await backend.updateAudit(auditId, { responses });
      apply(updated);
      return updated;
    },
    [backend, auditId, apply]
  );

  const setStatus = useCallback(
    async (status) => {
      const updated = await backend.updateAudit(auditId, { status });
      apply(updated);
      return updated;
    },
    [backend, auditId, apply]
  );

  const advanceStep = useCallback(async () => {
    const updated = await backend.advanceStep(auditId);
    apply(updated);
    return updated;
  }, [backend, auditId, apply]);

  const goBackStep = useCallback(async () => {
    const updated = await backend.goBackStep(auditId);
    apply(updated);
    return updated;
  }, [backend, auditId, apply]);

  const skipStep = useCallback(async () => {
    const updated = await backend.skipStep(auditId);
    apply(updated);
    return updated;
  }, [backend, auditId, apply]);

  const addBookmark = useCallback(
    async (bookmark) => {
      const updated = await backend.addBookmark(auditId, bookmark);
      apply(updated);
      return updated;
    },
    [backend, auditId, apply]
  );

  const updateBookmark = useCallback(
    async (bookmarkId, fields) => {
      const updated = await backend.updateBookmark(auditId, bookmarkId, fields);
      apply(updated);
      return updated;
    },
    [backend, auditId, apply]
  );

  const deleteBookmark = useCallback(
    async (bookmarkId) => {
      const updated = await backend.deleteBookmark(auditId, bookmarkId);
      apply(updated);
      return updated;
    },
    [backend, auditId, apply]
  );

  return {
    audit,
    loading,
    error,
    refetch,
    saveResponses,
    setStatus,
    advanceStep,
    goBackStep,
    skipStep,
    addBookmark,
    updateBookmark,
    deleteBookmark,
  };
}
