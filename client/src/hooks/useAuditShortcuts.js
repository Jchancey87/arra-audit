import { useEffect } from 'react';

const isTextEntry = (el) => {
  if (!el) return false;
  const tag = el.nodeName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!el.isContentEditable;
};

/**
 * useAuditShortcuts - Global keyboard shortcuts for the audit form.
 *   - Space → toggle play/pause
 *   - M     → drop arrangement marker (only if arrangement lens is active)
 */
export function useAuditShortcuts({ togglePlay, hasArrangementLens, currentTime, onAddMarker }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextEntry(e.target)) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (togglePlay) togglePlay();
      } else if ((e.key === 'm' || e.key === 'M') && hasArrangementLens) {
        e.preventDefault();
        onAddMarker(currentTime || 0);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [hasArrangementLens, currentTime, togglePlay, onAddMarker]);
}
