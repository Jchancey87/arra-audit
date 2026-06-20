import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Phase 2.2 — Scrollytelling hook.
 *
 * Given a list of items with refs + a `timestampSeconds` field, observe each
 * one with an IntersectionObserver and expose which item is currently the
 * "most visible" (largest intersectionRatio) inside the viewport.
 *
 * Two consumers:
 *   1. `useMostVisible(items, opts)` → { activeId, ratios }. Visual-only.
 *   2. `useScrollytellingSeek(items, { seek, currentTime, enabled, debounceMs, minJumpSeconds })`
 *      → also debounced auto-seek to the active item's timestampSeconds when
 *        it changes. Skips seeks that would jump < `minJumpSeconds` to avoid
 *        jitter on cards that happen to be near the current playhead.
 *
 * The observer is built once per hook instance and diffs `items` on each
 * render to observe new refs and unobserve dropped ones. This makes the
 * hook safe to call with inline item arrays (refs included).
 */

const DEFAULTS = {
  rootMargin: '-20% 0px -50% 0px',
  threshold: [0, 0.25, 0.5, 0.75, 1],
  debounceMs: 250,
  minJumpSeconds: 5,
};

const stableKey = (threshold) => threshold.join(',');

export const useMostVisible = (items, options = {}) => {
  const opts = { ...DEFAULTS, ...options };
  const [ratios, setRatios] = useState({});
  const ratiosRef = useRef({});
  const observedRef = useRef(new Map());
  const observerRef = useRef(null);

  useEffect(() => {
    ratiosRef.current = ratios;
  }, [ratios]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        setRatios((prev) => {
          const next = { ...prev };
          for (const entry of entries) {
            const id = entry.target.dataset.scrollyId;
            if (id) next[id] = entry.intersectionRatio;
          }
          ratiosRef.current = next;
          return next;
        });
      },
      {
        root: null,
        rootMargin: opts.rootMargin,
        threshold: opts.threshold,
      }
    );
    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
      observedRef.current.clear();
    };
  }, [opts.rootMargin, stableKey(opts.threshold)]);

  useEffect(() => {
    const observer = observerRef.current;
    if (!observer) return;
    const seen = new Set();
    for (const item of items) {
      const el = item?.ref?.current;
      if (!el || !item.id) continue;
      seen.add(item.id);
      el.dataset.scrollyId = item.id;
      if (!observedRef.current.has(item.id)) {
        observedRef.current.set(item.id, el);
        observer.observe(el);
      }
    }
    for (const [id, el] of [...observedRef.current.entries()]) {
      if (!seen.has(id)) {
        observer.unobserve(el);
        observedRef.current.delete(id);
      }
    }
  }, [items]);

  const activeId = (() => {
    let bestId = null;
    let bestRatio = 0;
    for (const item of items) {
      const r = ratios[item.id] || 0;
      if (r > bestRatio) {
        bestRatio = r;
        bestId = item.id;
      }
    }
    return bestRatio > 0 ? bestId : null;
  })();

  return { activeId, ratios };
};

export const useScrollytellingSeek = (
  items,
  { seek, currentTime = 0, enabled = true, debounceMs = DEFAULTS.debounceMs, minJumpSeconds = DEFAULTS.minJumpSeconds } = {}
) => {
  const { activeId } = useMostVisible(items);
  const [lastSeekTarget, setLastSeekTarget] = useState(null);
  const [resetVersion, setResetVersion] = useState(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!activeId) return undefined;
    const item = items.find((i) => i.id === activeId);
    if (!item || !Number.isFinite(item.timestampSeconds)) return undefined;

    const target = item.timestampSeconds;
    if (lastSeekTarget === target) return undefined;
    if (Math.abs(target - currentTime) < minJumpSeconds) return undefined;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLastSeekTarget(target);
      if (typeof seek === 'function') seek(target);
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [activeId, items, seek, enabled, debounceMs, minJumpSeconds, currentTime, lastSeekTarget, resetVersion]);

  const reset = useCallback(() => {
    setLastSeekTarget(null);
    setResetVersion((v) => v + 1);
  }, []);

  return { activeId, reset };
};
