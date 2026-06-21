import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

/**
 * useCurricula() - List + generation hook for curricula.
 *
 * Exposes:
 *   { curricula, loading, error, refetch, generate, save }
 */
function useCurricula() {
  const backend = useBackend();
  const [curricula, setCurricula] = useState([]);
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
      const data = await backend.getCurricula();
      if (!ac.signal.aborted) {
        setCurricula(Array.isArray(data) ? data : []);
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

  const generate = useCallback(
    async (focusArea, pastTechniques) => {
      const plan = await backend.generateAICurriculum(focusArea, pastTechniques);
      // Generated plan is not persisted yet — caller decides whether to .save()
      return plan;
    },
    [backend]
  );

  const save = useCallback(
    async (curriculumData) => {
      const saved = await backend.saveCustomCurriculum(curriculumData);
      if (saved) setCurricula((prev) => [saved, ...prev]);
      return saved;
    },
    [backend]
  );

  return { curricula, loading, error, refetch, generate, save };
}
