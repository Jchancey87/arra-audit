import { describe, it, expect } from 'vitest';
import {
  formatPlayheadAnnouncement,
  usePlayheadAnnouncer,
  playheadSrOnlyStyle,
} from '../playheadAnnouncer.js';
import { renderHook, act } from '@testing-library/react';

describe('formatPlayheadAnnouncement', () => {
  it('formats a simple time as minutes and seconds', () => {
    expect(formatPlayheadAnnouncement(83, 200)).toBe('Playhead at 1 minute 23 seconds of 3 minutes 20 seconds');
  });

  it('uses singular units at 1', () => {
    expect(formatPlayheadAnnouncement(61, 121)).toBe('Playhead at 1 minute 1 second of 2 minutes 1 second');
  });

  it('handles 0/0 gracefully', () => {
    expect(formatPlayheadAnnouncement(0, 0)).toBe('Playhead at 0 minutes 0 seconds of 0 minutes 0 seconds');
  });

  it('treats null/undefined as 0', () => {
    expect(formatPlayheadAnnouncement(null, undefined)).toBe('Playhead at 0 minutes 0 seconds of 0 minutes 0 seconds');
  });

  it('floors fractional seconds', () => {
    expect(formatPlayheadAnnouncement(83.9, 200.4)).toBe('Playhead at 1 minute 23 seconds of 3 minutes 20 seconds');
  });

  it('clamps negative times to 0', () => {
    expect(formatPlayheadAnnouncement(-5, -3)).toBe('Playhead at 0 minutes 0 seconds of 0 minutes 0 seconds');
  });
});

describe('usePlayheadAnnouncer', () => {
  it('returns an initial announcement string', () => {
    const { result } = renderHook(() => usePlayheadAnnouncer(30, 120));
    expect(result.current).toBe('Playhead at 0 minutes 30 seconds of 2 minutes 0 seconds');
  });

  it('updates when currentTime changes within the throttle window', () => {
    let time = 0;
    const { result, rerender } = renderHook(() => usePlayheadAnnouncer(time, 120, { intervalMs: 1000 }));
    const first = result.current;
    act(() => { time = 45; rerender(); });
    expect(result.current).toBe(first);
  });

  it('updates when the throttled tick fires and text differs', () => {
    vi.useFakeTimers();
    let time = 0;
    const { result, rerender } = renderHook(() => usePlayheadAnnouncer(time, 120, { intervalMs: 1000 }));
    act(() => { time = 45; rerender(); });
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current).toBe('Playhead at 0 minutes 45 seconds of 2 minutes 0 seconds');
    vi.useRealTimers();
  });

  it('does not re-render if the announcement text is identical at the tick', () => {
    vi.useFakeTimers();
    let time = 45;
    const { result, rerender } = renderHook(() => usePlayheadAnnouncer(time, 120, { intervalMs: 1000 }));
    const before = result.current;
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current).toBe(before);
    vi.useRealTimers();
  });
});

describe('playheadSrOnlyStyle', () => {
  it('is an object with the sr-only CSS properties', () => {
    expect(playheadSrOnlyStyle.position).toBe('absolute');
    expect(playheadSrOnlyStyle.width).toBe('1px');
    expect(playheadSrOnlyStyle.height).toBe('1px');
    expect(playheadSrOnlyStyle.overflow).toBe('hidden');
    expect(playheadSrOnlyStyle.clip).toBe('rect(0, 0, 0, 0)');
  });
});
