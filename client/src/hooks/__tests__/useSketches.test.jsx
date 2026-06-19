import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useSketches } from '../useSketches.js';
import { BackendProvider } from '../../context/BackendContext.jsx';
import { InMemoryBackendAdapter } from '../../adapters/InMemoryBackendAdapter.js';

function makeWrapper(backend) {
  return ({ children }) => (
    <BackendProvider adapter={backend}>{children}</BackendProvider>
  );
}

function makeFile(name = 'sketch.wav', size = 2048, type = 'audio/wav') {
  return new File([new Uint8Array(size)], name, { type });
}

describe('useSketches hook', () => {
  let backend;
  let song;

  beforeEach(async () => {
    backend = new InMemoryBackendAdapter();
    backend.currentUser = { id: 'user-1' };
    const out = await backend.importSong('https://youtube.com/watch?v=abc123xyz00');
    song = out.song;
  });

  it('returns empty list when no sketches exist for a song', async () => {
    const { result } = renderHook(() => useSketches(song._id), { wrapper: makeWrapper(backend) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sketches).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('uploads a sketch and prepends it to the list', async () => {
    const { result } = renderHook(() => useSketches(song._id), { wrapper: makeWrapper(backend) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.upload(song._id, makeFile('take1.wav', 4096, 'audio/wav'), { title: 'Take 1' });
    });

    expect(created._id).toBeDefined();
    expect(created.title).toBe('Take 1');
    expect(created.originalName).toBe('take1.wav');
    expect(result.current.sketches.length).toBeGreaterThanOrEqual(1);
    expect(result.current.sketches[0]._id).toBe(created._id);
  });

  it('analyzes a sketch and stores the result on the list entry', async () => {
    const { result } = renderHook(() => useSketches(song._id), { wrapper: makeWrapper(backend) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.upload(song._id, makeFile('take2.wav', 4096, 'audio/wav'));
    });

    await act(async () => {
      await result.current.analyze(created._id);
    });

    const after = result.current.sketches.find((s) => s._id === created._id);
    expect(after.analysisStatus).toBe('success');
    expect(after.analysis).toBeTruthy();
    expect(after.analysis.tempo_bpm).toBeGreaterThan(0);
  });
});
