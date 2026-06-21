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
    audioRef: { current: null }, // no <audio> in jsdom; waveform won't render
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

    const introBlock = screen.getByTestId('section-block-sec-1');
    expect(introBlock).toBeInTheDocument();

    // Verify click on section block selecting it shows in inspector
    fireEvent.mouseDown(introBlock); 
    fireEvent.mouseUp(window); // Complete action
    expect(screen.getByText(/INSPECTOR: Intro/i)).toBeInTheDocument();

    const verseBlock = screen.getByTestId('section-block-sec-2');
    fireEvent.mouseDown(verseBlock); 
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

    const introBlock = screen.getByTestId('section-block-sec-1');
    expect(introBlock).toBeInTheDocument();

    // Trigger right click / context menu on block
    fireEvent.mouseDown(introBlock, { button: 2 });

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

    const sectionsLane = screen.getByTestId('sections-lane');
    expect(sectionsLane).toBeInTheDocument();

    // Right click on empty sections lane coordinate (clientX: 400 triggers clickedTime = 400 / 6 = 66.6s)
    fireEvent.mouseDown(sectionsLane, { button: 2, clientX: 400 });

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

    const trackBlock = screen.getByTestId('track-block-tb-1');
    expect(trackBlock).toBeInTheDocument();

    // Right click track block
    fireEvent.mouseDown(trackBlock, { button: 2 });

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

    const trackLane = screen.getByTestId('track-lane-track-1');
    expect(trackLane).toBeInTheDocument();

    // Right click empty track lane at clientX: 200
    fireEvent.mouseDown(trackLane, { button: 2, clientX: 200 });

    expect(screen.getByText(/Add Block Here/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear Track/i)).toBeInTheDocument();
    expect(screen.getByText(/Delete Track/i)).toBeInTheDocument();
  });
});
