import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useAuditAutosave - Debounced save of audit responses with status tracking.
 *
 * @param {string|undefined} auditId
 * @param {Object} responses - Current responses object
 * @param {(responses: Object) => Promise<any>} save - Save callback (e.g. from useAudit)
 * @param {number} delay - Debounce delay in ms
 *
 * @returns {{ saveStatus, markDirty }}
 *   saveStatus: 'saved' | 'saving' | 'dirty' | 'error'
 *   markDirty: () => void — call when responses change
 */
export function useAuditAutosave(auditId, responses, save, delay = 3000) {
  const [saveStatus, setSaveStatus] = useState('saved');
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const responsesRef = useRef(responses);

  // Keep ref up to date to avoid stale closure in setTimeout
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);

  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!dirtyRef.current) return;
      setSaveStatus('saving');
      try {
        await save(responsesRef.current);
        setSaveStatus('saved');
        dirtyRef.current = false;
      } catch {
        setSaveStatus('error');
      }
    }, delay);
  }, [save, delay]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Beforeunload guard
  useEffect(() => {
    const handler = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  return { saveStatus, markDirty };
}

/**
 * useAnalysisPolling - Poll a song's analysis status while pending.
 *
 * @param {Object|null} song
 * @param {() => Promise<any>} refetchSong
 * @param {number} intervalMs
 */
export function useAnalysisPolling(song, refetchSong, intervalMs = 4000) {
  useEffect(() => {
    let intervalId;
    if (song && song.audioAnalysisStatus === 'pending') {
      intervalId = setInterval(() => {
        refetchSong().catch(() => {});
      }, intervalMs);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [song?.audioAnalysisStatus, refetchSong, intervalMs]);
}

/**
 * useAnalysisProgressSim - Simulated progress bar stages during pending analysis.
 *
 * @param {Object|null} song
 * @returns {{ progress: number, stage: string }}
 */
const SIM_STAGES = [
  { threshold: 15, text: 'Downloading audio source from stream...' },
  { threshold: 40, text: 'Running transient beat & downbeat tracking...' },
  { threshold: 65, text: 'Calculating keys, scales, and chords...' },
  { threshold: 85, text: 'Running CLAP semantic vibe analysis...' },
  { threshold: 98, text: 'Assembling override vectors...' },
];

export function useAnalysisProgressSim(song) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('Initiating extraction pipeline...');

  useEffect(() => {
    let timer;
    if (song && song.audioAnalysisStatus === 'pending') {
      setProgress(0);
      setStage('Connecting to signal source...');
      timer = setInterval(() => {
        setProgress((prev) => {
          const next = Math.min(prev + Math.floor(Math.random() * 4) + 1, 99);
          const currentStage = SIM_STAGES.find((s) => next <= s.threshold);
          if (currentStage) setStage(currentStage.text);
          else setStage('Finalizing background database sync...');
          return next;
        });
      }, 400);
    } else {
      setProgress(0);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [song?.audioAnalysisStatus]);

  return { progress, stage };
}
