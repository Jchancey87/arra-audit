import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import ArrangementTimelineWidget from '../ArrangementTimelineWidget.jsx';
import { BackendProvider } from '../../context/BackendContext.jsx';

// Mock useAudio
const mockLoadSong = vi.fn();
const mockPlay = vi.fn();
const mockSeekTo = vi.fn();

vi.mock('../../context/AudioContext.jsx', () => ({
  useAudio: () => ({
    loadSong: mockLoadSong,
    activeSong: { _id: 'song-123' },
    play: mockPlay,
    seekTo: mockSeekTo,
    currentTime: 10,
  }),
}));

const mockBackend = { subscribeBookmarkAnalysis: vi.fn() };
const wrapper = ({ children }) => (
  <BackendProvider adapter={mockBackend}>{children}</BackendProvider>
);

const mockOnChange = vi.fn();
const mockSaveNow = vi.fn();

const defaultResponses = {
  'arrangement-bpm': '120',
  'arrangement-view-mode': 'seconds',
  'arrangement-timeline': JSON.stringify([
    { id: 'sec-1', name: 'Intro', type: 'intro', startTime: 0, duration: 16, notes: 'Soft intro' },
    { id: 'sec-2', name: 'Verse 1', type: 'verse', startTime: 16, duration: 32, notes: 'Guitar starts' },
  ]),
  'arrangement-tracks': JSON.stringify([
    {
      id: 'track-1',
      name: 'Synth Bass',
      category: 'bass',
      color: '#fbbf24',
      emoji: '🎸',
      blocks: [
        { id: 'tb-1', startTime: 0, duration: 16 },
      ],
    },
  ]),
};

const defaultSong = {
  _id: 'song-123',
  title: 'Test Song',
  artist: 'Test Artist',
  durationSeconds: 120,
  bpm: 120,
};

describe('ArrangementTimelineWidget', () => {
  beforeEach(() => {
    mockLoadSong.mockClear();
    mockPlay.mockClear();
    mockSeekTo.mockClear();
    mockOnChange.mockClear();
    mockSaveNow.mockClear();

    // Mock HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      getImageData: vi.fn(),
      putImageData: vi.fn(),
      createImageData: vi.fn(),
      setTransform: vi.fn(),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      scale: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      createLinearGradient: vi.fn().mockReturnValue({
        addColorStop: vi.fn(),
      }),
    });

    // Mock getBoundingClientRect for all canvas instances
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders title, BPM, meter, playhead time, and action buttons', () => {
    render(
      <ArrangementTimelineWidget
        responses={defaultResponses}
        onChange={mockOnChange}
        song={defaultSong}
        lensData={{}}
        saveNow={mockSaveNow}
      />,
      { wrapper }
    );

    expect(screen.getByText(/ARRANGEMENT TIMELINE/i)).toBeInTheDocument();
    expect(screen.getByText('Synth Bass')).toBeInTheDocument();
    expect(screen.getByDisplayValue('120')).toBeInTheDocument();

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Verify click on canvas selecting block shows in inspector
    fireEvent.mouseDown(canvas, { clientX: 30, clientY: 50 }); // MouseDown "Intro"
    fireEvent.mouseUp(window); // Complete action
    expect(screen.getByText(/INSPECTOR: Intro/i)).toBeInTheDocument();

    fireEvent.mouseDown(canvas, { clientX: 150, clientY: 50 }); // MouseDown "Verse 1"
    fireEvent.mouseUp(window); // Complete action
    expect(screen.getByText(/INSPECTOR: Verse 1/i)).toBeInTheDocument();
  });

  it('shows section block context menu on right click', () => {
    render(
      <ArrangementTimelineWidget
        responses={defaultResponses}
        onChange={mockOnChange}
        song={defaultSong}
        lensData={{}}
        saveNow={mockSaveNow}
      />,
      { wrapper }
    );

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Trigger right click / context menu on canvas where "Intro" is located (x: 0-96, y: 28-142)
    fireEvent.mouseDown(canvas, { clientX: 30, clientY: 50, button: 2 });

    // Verify context menu is visible
    expect(screen.getByText(/Inspect Section/i)).toBeInTheDocument();
    expect(screen.getByText(/Play Section/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete Section/i)).toBeInTheDocument();

    // Click play section
    fireEvent.click(screen.getByText(/Play Section/i));
    expect(mockSeekTo).toHaveBeenCalledWith(0);

    // Verify context menu closes on click
    expect(screen.queryByText(/Inspect Section/i)).not.toBeInTheDocument();
  });

  it('shows sections lane context menu on right click', () => {
    render(
      <ArrangementTimelineWidget
        responses={defaultResponses}
        onChange={mockOnChange}
        song={defaultSong}
        lensData={{}}
        saveNow={mockSaveNow}
      />,
      { wrapper }
    );

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Right click on empty sections lane coordinate (x: 400, y: 50)
    fireEvent.mouseDown(canvas, { clientX: 400, clientY: 50, button: 2 });

    expect(screen.getByText(/Add Section Here/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Add Section Here/i));

    expect(mockOnChange).toHaveBeenCalledWith('arrangement-timeline', expect.any(String));
  });

  it('shows track block context menu on right click', () => {
    render(
      <ArrangementTimelineWidget
        responses={defaultResponses}
        onChange={mockOnChange}
        song={defaultSong}
        lensData={{}}
        saveNow={mockSaveNow}
      />,
      { wrapper }
    );

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Right click track block tb-1 (x: 0-96, y: 142-188)
    fireEvent.mouseDown(canvas, { clientX: 30, clientY: 160, button: 2 });

    expect(screen.getByText(/Play Block/i)).toBeInTheDocument();
    expect(screen.getByText(/Sync to Playhead/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete Block/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Play Block/i));
    expect(mockSeekTo).toHaveBeenCalledWith(0);
  });

  it('shows track lane context menu on right click', () => {
    render(
      <ArrangementTimelineWidget
        responses={defaultResponses}
        onChange={mockOnChange}
        song={defaultSong}
        lensData={{}}
        saveNow={mockSaveNow}
      />,
      { wrapper }
    );

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();

    // Right click empty track lane (x: 200, y: 160, button: 2)
    fireEvent.mouseDown(canvas, { clientX: 200, clientY: 160, button: 2 });

    expect(screen.getByText(/Add Block Here/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear Track/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete Track/i)).toBeInTheDocument();
  });
});
