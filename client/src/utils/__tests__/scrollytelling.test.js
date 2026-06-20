import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMostVisible, useScrollytellingSeek } from '../scrollytelling';

class MockIntersectionObserver {
  constructor(cb) {
    this.cb = cb;
    this.observed = [];
    MockIntersectionObserver.instances.push(this);
  }
  observe(el) {
    this.observed.push(el);
  }
  unobserve(el) {
    this.observed = this.observed.filter((e) => e !== el);
  }
  disconnect() {
    this.observed = [];
  }
  trigger(entries) {
    this.cb(entries, this);
  }
}
MockIntersectionObserver.instances = [];

const makeItem = (id, ts, el) => ({ id, timestampSeconds: ts, ref: { current: el, dataset: { id } } });

describe('useMostVisible', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    globalThis.IntersectionObserver = MockIntersectionObserver;
  });
  afterEach(() => {
    delete globalThis.IntersectionObserver;
  });

  it('observes all item refs on mount', () => {
    const a = { dataset: { id: 'a' } };
    const b = { dataset: { id: 'b' } };
    const items = [makeItem('a', 10, a), makeItem('b', 20, b)];
    renderHook(() => useMostVisible(items));
    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].observed).toEqual([a, b]);
  });

  it('returns the id of the item with the highest intersection ratio', () => {
    const a = { dataset: { id: 'a' } };
    const b = { dataset: { id: 'b' } };
    const items = [makeItem('a', 10, a), makeItem('b', 20, b)];
    const { result } = renderHook(() => useMostVisible(items));
    act(() => {
      MockIntersectionObserver.instances[0].trigger([
        { target: a, intersectionRatio: 0.2 },
        { target: b, intersectionRatio: 0.8 },
      ]);
    });
    expect(result.current.activeId).toBe('b');
  });

  it('returns null when nothing is visible', () => {
    const a = { dataset: { id: 'a' } };
    const items = [makeItem('a', 10, a)];
    const { result } = renderHook(() => useMostVisible(items));
    act(() => {
      MockIntersectionObserver.instances[0].trigger([
        { target: a, intersectionRatio: 0 },
      ]);
    });
    expect(result.current.activeId).toBe(null);
  });

  it('handles missing IntersectionObserver (SSR)', () => {
    delete globalThis.IntersectionObserver;
    const a = { dataset: { id: 'a' } };
    const items = [makeItem('a', 10, a)];
    expect(() => renderHook(() => useMostVisible(items))).not.toThrow();
  });
});

describe('useScrollytellingSeek', () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    globalThis.IntersectionObserver = MockIntersectionObserver;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.IntersectionObserver;
  });

  it('debounces and seeks to the active item timestamp when it changes', () => {
    const a = { dataset: { id: 'a' } };
    const b = { dataset: { id: 'b' } };
    const items = [makeItem('a', 10, a), makeItem('b', 90, b)];
    const seek = vi.fn();
    renderHook(() =>
      useScrollytellingSeek(items, { seek, currentTime: 0, debounceMs: 200, minJumpSeconds: 5 })
    );
    act(() => {
      MockIntersectionObserver.instances[0].trigger([
        { target: a, intersectionRatio: 0.1 },
        { target: b, intersectionRatio: 0.9 },
      ]);
    });
    expect(seek).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(seek).toHaveBeenCalledWith(90);
  });

  it('does not seek if the target is within minJumpSeconds of currentTime', () => {
    const a = { dataset: { id: 'a' } };
    const items = [makeItem('a', 5, a)];
    const seek = vi.fn();
    renderHook(() =>
      useScrollytellingSeek(items, { seek, currentTime: 3, debounceMs: 100, minJumpSeconds: 5 })
    );
    act(() => {
      MockIntersectionObserver.instances[0].trigger([
        { target: a, intersectionRatio: 0.9 },
      ]);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(seek).not.toHaveBeenCalled();
  });

  it('does not seek when disabled', () => {
    const a = { dataset: { id: 'a' } };
    const items = [makeItem('a', 50, a)];
    const seek = vi.fn();
    renderHook(() =>
      useScrollytellingSeek(items, { seek, currentTime: 0, enabled: false, debounceMs: 100, minJumpSeconds: 5 })
    );
    act(() => {
      MockIntersectionObserver.instances[0].trigger([
        { target: a, intersectionRatio: 0.9 },
      ]);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(seek).not.toHaveBeenCalled();
  });

  it('does not re-seek to the same target', () => {
    const a = { dataset: { id: 'a' } };
    const items = [makeItem('a', 50, a)];
    const seek = vi.fn();
    const { rerender } = renderHook(
      ({ currentTime }) =>
        useScrollytellingSeek(items, { seek, currentTime, debounceMs: 100, minJumpSeconds: 5 }),
      { initialProps: { currentTime: 0 } }
    );
    act(() => {
      MockIntersectionObserver.instances[0].trigger([
        { target: a, intersectionRatio: 0.9 },
      ]);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(50);
    rerender({ currentTime: 5 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(seek).toHaveBeenCalledTimes(1);
  });

  it('reset() clears last-seek so a re-entry of the same target re-seeks', () => {
    const a = { dataset: { id: 'a' } };
    const items = [makeItem('a', 50, a)];
    const seek = vi.fn();
    const { result } = renderHook(() =>
      useScrollytellingSeek(items, { seek, currentTime: 0, debounceMs: 100, minJumpSeconds: 5 })
    );
    act(() => {
      MockIntersectionObserver.instances[0].trigger([
        { target: a, intersectionRatio: 0.9 },
      ]);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(seek).toHaveBeenCalledTimes(1);
    act(() => result.current.reset());
    act(() => {
      MockIntersectionObserver.instances[0].trigger([
        { target: a, intersectionRatio: 0.9 },
      ]);
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(seek).toHaveBeenCalledTimes(2);
  });
});
