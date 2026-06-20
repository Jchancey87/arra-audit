import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ComparePlayer from '../ComparePlayer.jsx';
import { AudioProvider } from '../../context/AudioContext.jsx';
import { BackendProvider } from '../../context/BackendContext.jsx';
import { InMemoryBackendAdapter } from '../../adapters/InMemoryBackendAdapter.js';

// Lightweight stub for the YouTube player AudioContext uses; we don't
// actually exercise playback in these tests, just mount + render.
function StubAudioProvider({ children }) {
  // Wrap the real provider but stub the YT-related state by mounting.
  return <AudioProvider>{children}</AudioProvider>;
}

function makeWrapper(backend) {
  return ({ children }) => (
    <MemoryRouter>
      <BackendProvider adapter={backend}>
        <StubAudioProvider>{children}</StubAudioProvider>
      </BackendProvider>
    </MemoryRouter>
  );
}

describe('ComparePlayer', () => {
  let backend;
  let song;

  beforeEach(async () => {
    backend = new InMemoryBackendAdapter();
    backend.currentUser = { id: 'user-1' };
    const out = await backend.importSong('https://youtube.com/watch?v=test');
    song = out.song;
  });

  it('renders the master transport, panels, and metadata when given a sketch', () => {
    const sketch = {
      _id: 'sk-1',
      title: 'Take 1',
      originalName: 'take1.wav',
      publicUrl: '',
      analysis: { tempo_bpm: 124, key: 'A', scale: 'minor', estimated_meter: '4/4' },
      analysisStatus: 'success',
    };
    render(<ComparePlayer sketch={sketch} song={song} />, { wrapper: makeWrapper(backend) });

    expect(screen.getByText(/master clock: YouTube reference/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Reference/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sketch/i).length).toBeGreaterThan(0);
    // Metadata label present
    expect(screen.getByText(/Metadata/i)).toBeInTheDocument();
    // Delta panel appears when reference meta exists
    expect(screen.getByText(/Delta/i)).toBeInTheDocument();
  });

  it('hides the delta panel when neither side has analysis data', () => {
    const sketch = {
      _id: 'sk-2',
      title: 'No analysis',
      originalName: 'na.wav',
      publicUrl: '',
      analysis: null,
      analysisStatus: 'not_started',
    };
    render(<ComparePlayer sketch={sketch} song={song} />, { wrapper: makeWrapper(backend) });
    expect(screen.queryByText(/Delta/i)).toBeNull();
    // But master + panels still render
    expect(screen.getByText(/master clock: YouTube reference/i)).toBeInTheDocument();
  });

  it('renders the playback rate slider at 1.00x and applies the chosen rate', () => {
    const sketch = {
      _id: 'sk-3',
      title: 'Take 3',
      originalName: 't3.wav',
      publicUrl: '',
      analysis: { tempo_bpm: 120, key: 'C', scale: 'major', estimated_meter: '4/4' },
      analysisStatus: 'success',
    };
    render(<ComparePlayer sketch={sketch} song={song} />, { wrapper: makeWrapper(backend) });

    const rateBtn = screen.getByTitle('Reset to 1.0x');
    expect(rateBtn.textContent).toBe('1.00x');
    expect(rateBtn).toBeDisabled();

    const slider = screen.getByLabelText(/Playback rate \(both sources\)/i);
    fireEvent.change(slider, { target: { value: '0.75' } });
    const updatedBtn = screen.getByTitle('Reset to 1.0x');
    expect(updatedBtn.textContent).toBe('0.75x');
    expect(updatedBtn).not.toBeDisabled();

    // Reset back
    fireEvent.click(updatedBtn);
    expect(screen.getByTitle('Reset to 1.0x').textContent).toBe('1.00x');
  });
});
