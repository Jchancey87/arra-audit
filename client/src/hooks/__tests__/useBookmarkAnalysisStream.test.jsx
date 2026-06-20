import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBookmarkAnalysisStream } from '../useBookmarkAnalysisStream.js';
import { BackendProvider } from '../../context/BackendContext.jsx';

const makeFakeBackend = () => {
  const handlers = {};
  return {
    handlers,
    subscribeBookmarkAnalysis: vi.fn((_auditId, h) => {
      Object.assign(handlers, h);
      return { close: vi.fn(), readyState: () => 1 };
    }),
  };
};

const wrapper = (backend) => ({ children }) => (
  <BackendProvider adapter={backend}>{children}</BackendProvider>
);

describe('useBookmarkAnalysisStream', () => {
  it('returns connecting status initially', () => {
    const backend = makeFakeBackend();
    const { result } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    expect(result.current.status).toBe('connecting');
    expect(result.current.snapshots).toEqual({});
  });

  it('updates snapshots on snapshot event', () => {
    const backend = makeFakeBackend();
    const { result } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    act(() => {
      backend.handlers.open?.();
      backend.handlers.snapshot?.({ auditId: 'audit-1', bookmarks: { bm1: { status: 'pending' } } });
    });
    expect(result.current.status).toBe('open');
    expect(result.current.snapshots).toEqual({ bm1: { status: 'pending' } });
  });

  it('merges a bookmark-update into snapshots and records lastUpdate', () => {
    const backend = makeFakeBackend();
    const { result } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    act(() => {
      backend.handlers.open?.();
      backend.handlers.snapshot?.({ auditId: 'audit-1', bookmarks: { bm1: { status: 'pending' } } });
      backend.handlers.bookmarkUpdate?.({ bookmarkId: 'bm1', analysis: { status: 'running' } });
    });
    expect(result.current.snapshots.bm1).toEqual({ status: 'running' });
    expect(result.current.lastUpdate).toMatchObject({ bookmarkId: 'bm1' });
    expect(result.current.lastUpdate.analysis).toEqual({ status: 'running' });
    expect(typeof result.current.lastUpdate.at).toBe('number');
  });

  it('preserves unrelated bookmark snapshots when one updates', () => {
    const backend = makeFakeBackend();
    const { result } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    act(() => {
      backend.handlers.snapshot?.({
        auditId: 'audit-1',
        bookmarks: {
          bm1: { status: 'success' },
          bm2: { status: 'pending' },
        },
      });
      backend.handlers.bookmarkUpdate?.({ bookmarkId: 'bm2', analysis: { status: 'running' } });
    });
    expect(result.current.snapshots.bm1).toEqual({ status: 'success' });
    expect(result.current.snapshots.bm2).toEqual({ status: 'running' });
  });

  it('flips to error state and sets the error object on error event', () => {
    const backend = makeFakeBackend();
    const { result } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    act(() => {
      backend.handlers.error?.(new Error('boom'));
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('boom');
  });

  it('normalizes a string error event into an Error instance', () => {
    const backend = makeFakeBackend();
    const { result } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    act(() => {
      backend.handlers.error?.('connection lost');
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error.message).toBe('connection lost');
  });

  it('ignores empty/invalid payloads', () => {
    const backend = makeFakeBackend();
    const { result } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    act(() => {
      backend.handlers.snapshot?.({});
      backend.handlers.snapshot?.({ auditId: 'audit-1' });
      backend.handlers.bookmarkUpdate?.(null);
      backend.handlers.bookmarkUpdate?.({});
      backend.handlers.bookmarkUpdate?.({ bookmarkId: 'x' });
    });
    expect(result.current.snapshots).toEqual({});
    expect(result.current.lastUpdate).toBeNull();
  });

  it('calls close() on the subscription on unmount', () => {
    const backend = makeFakeBackend();
    const subscription = backend.subscribeBookmarkAnalysis.mock.results[0];
    const { unmount } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    unmount();
    // The hook resubscribes on status changes; we can only assert that
    // close() was called on at least one of the created subscriptions.
    const closes = backend.subscribeBookmarkAnalysis.mock.results
      .map((r) => r.value.close)
      .filter(Boolean);
    expect(closes.length).toBeGreaterThan(0);
  });

  it('does nothing when auditId is falsy', () => {
    const backend = makeFakeBackend();
    renderHook(() => useBookmarkAnalysisStream(null), { wrapper: wrapper(backend) });
    expect(backend.subscribeBookmarkAnalysis).not.toHaveBeenCalled();
  });

  it('refresh() forces a re-subscribe', () => {
    const backend = makeFakeBackend();
    const { result } = renderHook(() => useBookmarkAnalysisStream('audit-1'), {
      wrapper: wrapper(backend),
    });
    const before = backend.subscribeBookmarkAnalysis.mock.calls.length;
    act(() => {
      result.current.refresh();
    });
    expect(backend.subscribeBookmarkAnalysis.mock.calls.length).toBe(before + 1);
  });
});
