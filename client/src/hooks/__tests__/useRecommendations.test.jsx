import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { useRecommendations } from '../useRecommendations';

let mockBackend;
vi.mock('../../context/BackendContext', () => ({
  useBackend: () => mockBackend,
}));

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

describe('useRecommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty state when skipped', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn(),
    };
    const { result } = renderHook(() =>
      useRecommendations(null, { skip: true })
    );
    await act(async () => { await flushPromises(); });
    expect(result.current.similar).toEqual([]);
    expect(result.current.target).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockBackend.findSimilarTechniques).not.toHaveBeenCalled();
  });

  it('fetches similar techniques and exposes the result', async () => {
    const data = {
      target: { _id: 't1', techniqueName: 'Pad', lens: 'texture' },
      similar: [{ technique: { _id: 't2', description: 'soft' }, score: 0.7 }],
    };
    mockBackend = {
      findSimilarTechniques: vi.fn().mockResolvedValue(data),
    };
    const { result } = renderHook(() =>
      useRecommendations('t1', { limit: 5 })
    );
    await waitFor(() => {
      expect(result.current.similar).toHaveLength(1);
    });
    expect(result.current.target).toEqual(data.target);
    expect(result.current.loading).toBe(false);
    expect(mockBackend.findSimilarTechniques).toHaveBeenCalledWith('t1', { limit: 5 });
  });

  it('captures errors', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn().mockRejectedValue(new Error('boom')),
    };
    const { result } = renderHook(() =>
      useRecommendations('t1')
    );
    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
    expect(result.current.similar).toEqual([]);
  });

  it('refetch re-invokes the backend', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn().mockResolvedValue({ target: null, similar: [] }),
    };
    const { result } = renderHook(() => useRecommendations('t1'));
    await waitFor(() => {
      expect(mockBackend.findSimilarTechniques).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      await result.current.refetch();
    });
    expect(mockBackend.findSimilarTechniques).toHaveBeenCalledTimes(2);
  });

  it('coerces a missing similar array to []', async () => {
    mockBackend = {
      findSimilarTechniques: vi.fn().mockResolvedValue({ target: null }),
    };
    const { result } = renderHook(() => useRecommendations('t1'));
    await waitFor(() => {
      expect(result.current.similar).toEqual([]);
    });
  });
});
