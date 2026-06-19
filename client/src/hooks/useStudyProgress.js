import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackend } from '../context/BackendContext.jsx';

/**
 * useStudyProgress() - Hook for the active study plan + day operations.
 *
 * No argument: resolves the user's active progress document automatically.
 * Exposes:
 *   {
 *     progress, currentDay, loading, error, refetch,
 *     start, linkSong, logDay, completeDay, uploadSketch, submitReview,
 *   }
 */
export function useStudyProgress() {
  const backend = useBackend();
  const [progress, setProgress] = useState(null);
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
      const data = await backend.getActiveStudyProgress();
      if (!ac.signal.aborted) {
        setProgress(data || null);
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

  const apply = useCallback((updated) => {
    if (updated) setProgress(updated);
  }, []);

  const start = useCallback(
    async (curriculumId) => {
      const created = await backend.startCurriculum(curriculumId);
      apply(created);
      return created;
    },
    [backend, apply]
  );

  const linkSong = useCallback(
    async (dayNumber, songId) => {
      if (!progress?._id) throw new Error('No active study progress');
      const updated = await backend.linkSongToDay(progress._id, dayNumber, songId);
      apply(updated);
      return updated;
    },
    [backend, progress, apply]
  );

  const logDay = useCallback(
    async (dayNumber, responses) => {
      if (!progress?._id) throw new Error('No active study progress');
      const updated = await backend.saveDayProgress(progress._id, dayNumber, responses);
      apply(updated);
      return updated;
    },
    [backend, progress, apply]
  );

  const completeDay = useCallback(
    async (dayNumber, responses, syncTechnique, techniqueNotes) => {
      if (!progress?._id) throw new Error('No active study progress');
      const updated = await backend.completeDayProgress(
        progress._id,
        dayNumber,
        responses,
        syncTechnique,
        techniqueNotes
      );
      apply(updated);
      return updated;
    },
    [backend, progress, apply]
  );

  const uploadSketch = useCallback(
    async (dayNumber, file) => {
      if (!progress?._id) throw new Error('No active study progress');
      const updated = await backend.uploadAudioSketch(progress._id, dayNumber, file);
      apply(updated);
      return updated;
    },
    [backend, progress, apply]
  );

  const submitReview = useCallback(
    async (weekNumber, reviewData) => {
      if (!progress?._id) throw new Error('No active study progress');
      const updated = await backend.submitWeeklyReview(progress._id, weekNumber, reviewData);
      apply(updated);
      return updated;
    },
    [backend, progress, apply]
  );

  return {
    progress,
    currentDay: progress?.currentDay,
    loading,
    error,
    refetch,
    start,
    linkSong,
    logDay,
    completeDay,
    uploadSketch,
    submitReview,
  };
}
