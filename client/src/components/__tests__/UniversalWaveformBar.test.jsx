import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import UniversalWaveformBar from '../UniversalWaveformBar.jsx';

// Mock useAudio — each test installs its own return via mockUseAudio
const mockTogglePlay = vi.fn();
const mockSeekTo = vi.fn();

vi.mock('../../context/AudioContext.jsx', () => ({
  useAudio: () => mockUseAudio(),
}));

let mockUseAudio = vi.fn();

const playableState = {
  audioRef: { current: null }, // jsdom has no real <audio>; waveform won't mount
  activeSong: { _id: 'song-1', publicUrl: '/uploads/songs/song-1.mp3', title: 'Test' },
  togglePlay: mockTogglePlay,
  isPlaying: false,
  currentTime: 12,
  duration: 180,
  seekTo: mockSeekTo,
  audioError: null,
};

describe('UniversalWaveformBar', () => {
  beforeEach(() => {
    mockTogglePlay.mockClear();
    mockSeekTo.mockClear();
    mockUseAudio.mockReset();
  });
  afterEach(() => cleanup());

  it('renders the title and transport controls when a playable song is loaded', () => {
    mockUseAudio.mockReturnValue(playableState);
    render(<UniversalWaveformBar title="HARMONY LENS · WAVEFORM" />);
    expect(screen.getByText(/HARMONY LENS · WAVEFORM/i)).toBeTruthy();
    expect(screen.getByLabelText('Play')).toBeTruthy();
    expect(screen.getByLabelText('Back 10 seconds')).toBeTruthy();
    expect(screen.getByLabelText('Forward 10 seconds')).toBeTruthy();
  });

  it('shows the time readout in M:SS / M:SS format', () => {
    mockUseAudio.mockReturnValue(playableState);
    render(<UniversalWaveformBar />);
    expect(screen.getByText('0:12 / 3:00')).toBeTruthy();
  });

  it('disables transport buttons when publicUrl is null', () => {
    mockUseAudio.mockReturnValue({ ...playableState, activeSong: { _id: 's', publicUrl: null } });
    render(<UniversalWaveformBar />);
    expect(screen.getByLabelText('Play')).toBeDisabled();
    expect(screen.getByLabelText('Back 10 seconds')).toBeDisabled();
    expect(screen.getByLabelText('Forward 10 seconds')).toBeDisabled();
    expect(screen.getByText('no audio')).toBeTruthy();
  });

  it('disables transport buttons when audioError is set (white-noise-then-silence case)', () => {
    mockUseAudio.mockReturnValue({
      ...playableState,
      audioError: { code: 4, src: '/uploads/songs/song-1.mp3', message: 'Audio source not found.' },
    });
    render(<UniversalWaveformBar />);
    expect(screen.getByLabelText('Play')).toBeDisabled();
    expect(screen.getByText(/Audio source not found/i)).toBeTruthy();
  });

  it('shows a Re-download button when audioError is set and onRecover is provided', () => {
    mockUseAudio.mockReturnValue({
      ...playableState,
      audioError: { code: 4, src: '/uploads/songs/song-1.mp3', message: 'Audio source not found.' },
    });
    const onRecover = vi.fn();
    render(<UniversalWaveformBar onRecover={onRecover} />);
    const btn = screen.getByRole('button', { name: /Re-download audio/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onRecover).toHaveBeenCalledTimes(1);
  });

  it('disables the Re-download button while recovering', () => {
    mockUseAudio.mockReturnValue({
      ...playableState,
      audioError: { code: 4, src: '/uploads/songs/song-1.mp3', message: 'Audio source not found.' },
    });
    render(<UniversalWaveformBar onRecover={vi.fn()} recovering />);
    expect(screen.getByRole('button', { name: /Re-downloading/i })).toBeDisabled();
  });

  it('calls togglePlay when the play button is clicked', () => {
    mockUseAudio.mockReturnValue(playableState);
    render(<UniversalWaveformBar />);
    fireEvent.click(screen.getByLabelText('Play'));
    expect(mockTogglePlay).toHaveBeenCalledTimes(1);
  });

  it('calls seekTo(currentTime - 10) when −10s is clicked', () => {
    mockUseAudio.mockReturnValue(playableState);
    render(<UniversalWaveformBar />);
    fireEvent.click(screen.getByLabelText('Back 10 seconds'));
    expect(mockSeekTo).toHaveBeenCalledWith(2);
  });

  it('calls seekTo(currentTime + 10) when +10s is clicked', () => {
    mockUseAudio.mockReturnValue(playableState);
    render(<UniversalWaveformBar />);
    fireEvent.click(screen.getByLabelText('Forward 10 seconds'));
    expect(mockSeekTo).toHaveBeenCalledWith(22);
  });

  it('renders "No song loaded" when activeSong is null', () => {
    mockUseAudio.mockReturnValue({ ...playableState, activeSong: null });
    render(<UniversalWaveformBar />);
    expect(screen.getByText(/No song loaded/i)).toBeTruthy();
  });

  it('shows the pause button when isPlaying is true', () => {
    mockUseAudio.mockReturnValue({ ...playableState, isPlaying: true });
    render(<UniversalWaveformBar />);
    expect(screen.getByLabelText('Pause')).toBeTruthy();
  });
});
