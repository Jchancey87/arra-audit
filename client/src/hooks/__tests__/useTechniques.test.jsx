import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useTechniques } from '../useTechniques.js';
import { BackendProvider } from '../../context/BackendContext.jsx';
import { InMemoryBackendAdapter } from '../../adapters/InMemoryBackendAdapter.js';

function makeWrapper(backend) {
  return ({ children }) => (
    <BackendProvider adapter={backend}>{children}</BackendProvider>
  );
}

describe('useTechniques hook — addFromSentence', () => {
  let backend;
  let song;

  beforeEach(async () => {
    backend = new InMemoryBackendAdapter();
    backend.currentUser = { id: 'user-1' };
    const out = await backend.importSong('https://youtube.com/watch?v=promo123xyz0');
    song = out.song;
  });

  it('promotes a sentence, runs the lens heuristic, and returns the created entry', async () => {
    const { result } = renderHook(() => useTechniques(), { wrapper: makeWrapper(backend) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.addFromSentence(
        'The kick and snare lock into a tight groove at 90 BPM.',
        song
      );
    });

    expect(created._id).toBeDefined();
    expect(created.description).toContain('kick and snare');
    expect(created.lens).toBe('rhythm');
    expect(created.songId).toBe(song._id);
    expect(created.artist).toBe(song.artist);
  });

  it('respects an explicit lensHint and overrides the heuristic', async () => {
    const { result } = renderHook(() => useTechniques(), { wrapper: makeWrapper(backend) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.addFromSentence(
        'The kick and snare lock into a tight groove at 90 BPM.',
        song,
        { lensHint: 'harmony' }
      );
    });

    expect(created.lens).toBe('harmony');
  });

  it('attaches optional tags and notes when provided', async () => {
    const { result } = renderHook(() => useTechniques(), { wrapper: makeWrapper(backend) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.addFromSentence(
        'A long reverb tail shapes the texture of the outro.',
        song,
        { tags: ['reverb', 'outro'], notes: 'Heard at 3:42' }
      );
    });

    expect(created.lens).toBe('texture');
    expect(created.tags).toEqual(['reverb', 'outro']);
    expect(created.notes).toBe('Heard at 3:42');
  });

  it('throws on empty input', async () => {
    const { result } = renderHook(() => useTechniques(), { wrapper: makeWrapper(backend) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(async () => {
        await result.current.addFromSentence('   ', song);
      })
    ).rejects.toThrow(/empty/i);
  });

  it('works without a song (just description + lens)', async () => {
    const { result } = renderHook(() => useTechniques(), { wrapper: makeWrapper(backend) });
    await waitFor(() => expect(result.current.loading).toBe(false));

    let created;
    await act(async () => {
      created = await result.current.addFromSentence(
        'The intro builds tension before the drop.',
        null
      );
    });

    expect(created.lens).toBe('arrangement');
    expect(created.songId).toBeUndefined();
    expect(created.artist).toBeUndefined();
  });
});
