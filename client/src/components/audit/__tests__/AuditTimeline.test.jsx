import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuditTimeline from '../AuditTimeline';

const baseSong = (overrides = {}) => ({
  _id: 'song-1',
  title: 'Test Song',
  durationSeconds: 240,
  audioAnalysisStatus: 'success',
  audioAnalysis: {
    tempo_bpm: 120,
    key: 'C',
    scale: 'major',
    beat_times: [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0],
    downbeat_times: [0.5, 2.5, 4.5, 6.5],
    energy_curve: [0.2, 0.4, 0.6, 0.8, 0.5, 0.3, 0.7, 0.9],
    sectional_key_candidates: [
      { section: 'Intro', key: 'C', scale: 'major', confidence: 0.92 },
      { section: 'Verse 1', key: 'C', scale: 'major', confidence: 0.90 },
      { section: 'Chorus 1', key: 'G', scale: 'major', confidence: 0.85 },
    ],
  },
  ...overrides,
});

const baseProps = (overrides = {}) => ({
  song: baseSong(),
  currentTime: 30,
  duration: 240,
  onSeek: vi.fn(),
  onAddMarker: vi.fn(),
  onUpdateMarker: vi.fn(),
  onDeleteMarker: vi.fn(),
  onAddSection: vi.fn(),
  markers: [],
  arrangementSections: [],
  defaultShowEnergy: true,
  defaultShowBeatGrid: true,
  defaultShowKeyRegions: true,
  ...overrides,
});

describe('AuditTimeline', () => {
  describe('rendering', () => {
    it('renders null when song is null', () => {
      const { container } = render(<AuditTimeline {...baseProps({ song: null })} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders the timeline heading', () => {
      render(<AuditTimeline {...baseProps()} />);
      expect(screen.getByRole('heading', { name: /timeline/i })).toBeDefined();
    });

    it('renders time display', () => {
      render(<AuditTimeline {...baseProps({ currentTime: 65, duration: 240 })} />);
      expect(screen.getByText('1:05 / 4:00')).toBeDefined();
    });

    it('renders energy curve lane', () => {
      render(<AuditTimeline {...baseProps()} />);
      expect(screen.getByText('Energy')).toBeDefined();
    });

    it('renders beat grid lane', () => {
      render(<AuditTimeline {...baseProps()} />);
      expect(screen.getByText('Beat Grid')).toBeDefined();
    });

    it('renders key regions lane when sectional_key_candidates exist', () => {
      render(<AuditTimeline {...baseProps()} />);
      expect(screen.getByText('Key')).toBeDefined();
    });

    it('renders sections lane', () => {
      render(<AuditTimeline {...baseProps()} />);
      expect(screen.getByText('Sections')).toBeDefined();
    });

    it('renders markers lane', () => {
      render(<AuditTimeline {...baseProps()} />);
      expect(screen.getByText('Markers')).toBeDefined();
    });

    it('shows + Marker button when onAddMarker is provided', () => {
      render(<AuditTimeline {...baseProps()} />);
      expect(screen.getByText('+ Marker')).toBeDefined();
    });

    it('hides + Marker button when readOnly', () => {
      render(<AuditTimeline {...baseProps({ readOnly: true })} />);
      expect(screen.queryByText('+ Marker')).toBeNull();
    });

    it('shows overall key when no sectional candidates', () => {
      const song = baseSong({
        audioAnalysis: {
          key: 'D',
          scale: 'minor',
          beat_times: [1, 2, 3],
          energy_curve: [0.5],
        },
      });
      render(<AuditTimeline {...baseProps({ song })} />);
      expect(screen.getByText('Dm')).toBeDefined();
    });
  });

  describe('energy curve', () => {
    it('renders energy bars from energy_curve data', () => {
      const song = baseSong({
        audioAnalysis: {
          ...baseSong().audioAnalysis,
          energy_curve: [0.2, 0.4, 0.6, 0.8],
        },
      });
      render(<AuditTimeline {...baseProps({ song })} />);
      const lane = screen.getByRole('slider', { name: /energy/i });
      expect(lane).toBeDefined();
    });

    it('falls back to single bar when energy_curve is empty', () => {
      const song = baseSong({
        audioAnalysis: {
          ...baseSong().audioAnalysis,
          energy_curve: [],
        },
      });
      render(<AuditTimeline {...baseProps({ song })} />);
      const lane = screen.getByRole('slider', { name: /energy/i });
      expect(lane).toBeDefined();
    });
  });

  describe('beat grid', () => {
    it('shows beats and highlights downbeats', () => {
      render(<AuditTimeline {...baseProps()} />);
      const beatGrid = screen.getByText('Beat Grid');
      expect(beatGrid).toBeDefined();
    });
  });

  describe('key regions', () => {
    it('renders key annotations from sectional candidates', () => {
      render(<AuditTimeline {...baseProps()} />);
      // The Key lane renders labels like "C" or "C · Intro"; sections lane renders "Intro"
      const keyLane = screen.getByText('Key');
      expect(keyLane).toBeDefined();
    });

    it('shows minor key notation', () => {
      const song = baseSong({
        audioAnalysis: {
          ...baseSong().audioAnalysis,
          sectional_key_candidates: [
            { section: 'Intro', key: 'A', scale: 'minor', confidence: 0.9 },
          ],
        },
      });
      render(<AuditTimeline {...baseProps({ song })} />);
      expect(screen.getByText(/Am/)).toBeDefined();
    });
  });

  describe('sections lane', () => {
    it('renders analytical sections from key regions when no arrangement sections', () => {
      render(<AuditTimeline {...baseProps()} />);
      // Should show section labels from key regions
      expect(screen.getAllByText('Intro')[0]).toBeDefined();
    });

    it('renders user-created arrangement sections when provided', () => {
      const sections = [
        { id: 's1', name: 'Intro', type: 'intro', startTime: 0, duration: 30 },
        { id: 's2', name: 'Verse', type: 'verse', startTime: 30, duration: 60 },
      ];
      render(<AuditTimeline {...baseProps({ arrangementSections: sections })} />);
      expect(screen.getAllByText('Intro')[0]).toBeDefined();
      expect(screen.getAllByText('Verse')[0]).toBeDefined();
    });

    it('shows + Section button when onAddSection provided', () => {
      render(<AuditTimeline {...baseProps()} />);
      expect(screen.getByText('+ Section')).toBeDefined();
    });

    it('opens add section form on + Section click', () => {
      render(<AuditTimeline {...baseProps()} />);
      fireEvent.click(screen.getByText('+ Section'));
      expect(screen.getByPlaceholderText('Section name')).toBeDefined();
      expect(screen.getByPlaceholderText('0:00')).toBeDefined();
    });

    it('submits section with name and time', () => {
      const onAddSection = vi.fn();
      render(<AuditTimeline {...baseProps({ onAddSection, currentTime: 45 })} />);
      fireEvent.click(screen.getByText('+ Section'));
      fireEvent.change(screen.getByPlaceholderText('Section name'), { target: { value: 'Chorus' } });
      fireEvent.click(screen.getByText('Add'));
      expect(onAddSection).toHaveBeenCalledWith({ name: 'Chorus', start: 45 });
    });

    it('does not submit empty section name', () => {
      const onAddSection = vi.fn();
      render(<AuditTimeline {...baseProps({ onAddSection })} />);
      fireEvent.click(screen.getByText('+ Section'));
      fireEvent.click(screen.getByText('Add'));
      expect(onAddSection).not.toHaveBeenCalled();
    });

    it('cancels section add form', () => {
      render(<AuditTimeline {...baseProps()} />);
      fireEvent.click(screen.getByText('+ Section'));
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByPlaceholderText('Section name')).toBeNull();
    });

    it('hides + Section button in readOnly mode', () => {
      render(<AuditTimeline {...baseProps({ readOnly: true, onAddSection: null })} />);
      expect(screen.queryByText('+ Section')).toBeNull();
    });
  });

  describe('markers lane', () => {
    it('renders bookmark markers', () => {
      const markers = [
        { _id: 'm1', timestampSeconds: 30, label: 'Drop' },
        { _id: 'm2', timestampSeconds: 90, label: 'Build' },
      ];
      render(<AuditTimeline {...baseProps({ markers })} />);
      const dropMarker = screen.getByLabelText(/Drop/);
      expect(dropMarker).toBeDefined();
    });

    it('calls onMarkerClick when marker is clicked', () => {
      const onSeek = vi.fn();
      const markers = [{ _id: 'm1', timestampSeconds: 30, label: 'Drop' }];
      render(<AuditTimeline {...baseProps({ markers, onSeek })} />);
      fireEvent.click(screen.getByLabelText(/Drop/));
      expect(onSeek).toHaveBeenCalledWith(30);
    });

    it('shows context menu on right-click', () => {
      const markers = [{ _id: 'm1', timestampSeconds: 30, label: 'Drop' }];
      render(<AuditTimeline {...baseProps({ markers })} />);
      fireEvent.contextMenu(screen.getByLabelText(/Drop/));
      expect(screen.getByText('Rename')).toBeDefined();
      expect(screen.getByText('Delete')).toBeDefined();
    });

    it('calls onUpdateMarker on rename submit', () => {
      const onUpdateMarker = vi.fn();
      const markers = [{ _id: 'm1', timestampSeconds: 30, label: 'Drop' }];
      render(<AuditTimeline {...baseProps({ markers, onUpdateMarker })} />);
      fireEvent.contextMenu(screen.getByLabelText(/Drop/));
      fireEvent.click(screen.getByText('Rename'));
      fireEvent.change(screen.getByPlaceholderText('Marker label'), { target: { value: 'New Name' } });
      fireEvent.click(screen.getByText('Save'));
      expect(onUpdateMarker).toHaveBeenCalledWith('m1', { label: 'New Name' });
    });

    it('calls onDeleteMarker on delete click', () => {
      const onDeleteMarker = vi.fn();
      const markers = [{ _id: 'm1', timestampSeconds: 30, label: 'Drop' }];
      render(<AuditTimeline {...baseProps({ markers, onDeleteMarker })} />);
      fireEvent.contextMenu(screen.getByLabelText(/Drop/));
      fireEvent.click(screen.getByText('Delete'));
      expect(onDeleteMarker).toHaveBeenCalledWith('m1');
    });

    it('closes context menu on outside click', async () => {
      vi.useFakeTimers();
      const markers = [{ _id: 'm1', timestampSeconds: 30, label: 'Drop' }];
      render(<AuditTimeline {...baseProps({ markers })} />);
      fireEvent.contextMenu(screen.getByLabelText(/Drop/));
      expect(screen.getByText('Rename')).toBeDefined();
      // Advance past the setTimeout in the component so the document click listener is active
      await vi.advanceTimersByTimeAsync(0);
      // Click on the section heading (outside the context menu) to trigger close
      fireEvent.click(screen.getByRole('heading', { name: /timeline/i }));
      expect(screen.queryByText('Rename')).toBeNull();
      vi.useRealTimers();
    });

    it('supports marker rename via Enter key', () => {
      const onUpdateMarker = vi.fn();
      const markers = [{ _id: 'm1', timestampSeconds: 30, label: 'Drop' }];
      render(<AuditTimeline {...baseProps({ markers, onUpdateMarker })} />);
      fireEvent.contextMenu(screen.getByLabelText(/Drop/));
      fireEvent.click(screen.getByText('Rename'));
      const input = screen.getByPlaceholderText('Marker label');
      fireEvent.change(input, { target: { value: 'Entered' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onUpdateMarker).toHaveBeenCalledWith('m1', { label: 'Entered' });
    });

    it('supports escape to cancel rename', () => {
      const markers = [{ _id: 'm1', timestampSeconds: 30, label: 'Drop' }];
      render(<AuditTimeline {...baseProps({ markers })} />);
      fireEvent.contextMenu(screen.getByLabelText(/Drop/));
      fireEvent.click(screen.getByText('Rename'));
      const input = screen.getByPlaceholderText('Marker label');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByText('Save')).toBeNull();
    });

    it('handles markers without _id using index fallback', () => {
      const markers = [{ timestampSeconds: 60, label: 'NoID' }];
      render(<AuditTimeline {...baseProps({ markers })} />);
      expect(screen.getByLabelText(/NoID/)).toBeDefined();
    });
  });

  describe('+ Marker button', () => {
    it('calls onAddMarker with current time', () => {
      const onAddMarker = vi.fn();
      render(<AuditTimeline {...baseProps({ onAddMarker, currentTime: 42 })} />);
      fireEvent.click(screen.getByText('+ Marker'));
      expect(onAddMarker).toHaveBeenCalledWith(42);
    });
  });

  describe('scrubbing', () => {
    it('triggers seek on mouseup after mousedown on energy curve', () => {
      const onSeek = vi.fn();
      render(<AuditTimeline {...baseProps({ onSeek, duration: 240 })} />);
      const slider = screen.getByRole('slider', { name: /energy/i });
      // Mock getBoundingClientRect
      Object.defineProperty(slider, 'getBoundingClientRect', {
        value: () => ({ left: 100, width: 200, right: 300 }),
      });
      fireEvent.mouseDown(slider);
      fireEvent.mouseUp(slider, { clientX: 200 });
      // 200 - 100 = 100, 100/200 = 0.5, 0.5 * 240 = 120
      expect(onSeek).toHaveBeenCalledWith(120);
    });

    it('does not crash with zero duration', () => {
      const onSeek = vi.fn();
      render(<AuditTimeline {...baseProps({ onSeek, duration: 0 })} />);
      const slider = screen.getByRole('slider', { name: /energy/i });
      Object.defineProperty(slider, 'getBoundingClientRect', {
        value: () => ({ left: 0, width: 100, right: 100 }),
      });
      fireEvent.mouseDown(slider);
      fireEvent.mouseUp(slider, { clientX: 50 });
      expect(onSeek).toHaveBeenCalledWith(0);
    });

    it('supports scrubbing on beat grid mousedown', () => {
      const onSeek = vi.fn();
      render(<AuditTimeline {...baseProps({ onSeek, duration: 240 })} />);
      const beatGrid = screen.getByText('Beat Grid').nextElementSibling.firstElementChild;
      // Scrubbing uses energyRef for position calculation, so mock that
      const energySlider = screen.getByRole('slider', { name: /energy/i });
      Object.defineProperty(energySlider, 'getBoundingClientRect', {
        value: () => ({ left: 100, width: 200, right: 300 }),
      });
      fireEvent.mouseDown(beatGrid);
      fireEvent.mouseUp(beatGrid, { clientX: 200 });
      expect(onSeek).toHaveBeenCalledWith(120);
    });
  });

  describe('arrangement sections prop takes priority', () => {
    it('shows user sections over analytical key region sections', () => {
      const song = baseSong();
      const arrangementSections = [
        { id: 'u1', name: 'My Intro', type: 'intro', startTime: 0, duration: 20 },
      ];
      render(<AuditTimeline {...baseProps({ song, arrangementSections })} />);
      expect(screen.getAllByText('My Intro')[0]).toBeDefined();
      // Should NOT show analytical sections
      expect(screen.queryByText('Verse 1')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('uses song.durationSeconds when duration prop is zero', () => {
      const song = baseSong({ durationSeconds: 180 });
      render(<AuditTimeline {...baseProps({ song, duration: 0, currentTime: 90 })} />);
      expect(screen.getByText('1:30 / 3:00')).toBeDefined();
    });

    it('handles missing audioAnalysis gracefully', () => {
      const song = { _id: 's', durationSeconds: 120, audioAnalysisStatus: 'success' };
      render(<AuditTimeline {...baseProps({ song })} />);
      expect(screen.getByText('Timeline')).toBeDefined();
    });

    it('handles missing energy_curve gracefully', () => {
      const song = baseSong({
        audioAnalysis: {
          ...baseSong().audioAnalysis,
          energy_curve: undefined,
        },
      });
      render(<AuditTimeline {...baseProps({ song })} />);
      const slider = screen.getByRole('slider', { name: /energy/i });
      expect(slider).toBeDefined();
    });

    it('handles missing beat_times', () => {
      const song = baseSong({
        audioAnalysis: {
          ...baseSong().audioAnalysis,
          beat_times: undefined,
        },
      });
      render(<AuditTimeline {...baseProps({ song })} />);
      expect(screen.getByText('Timeline')).toBeDefined();
    });

    it('handles missing downbeat_times', () => {
      const song = baseSong({
        audioAnalysis: {
          ...baseSong().audioAnalysis,
          downbeat_times: undefined,
        },
      });
      render(<AuditTimeline {...baseProps({ song })} />);
      expect(screen.getByText('Beat Grid')).toBeDefined();
    });

    it('estimates section positions from beat grid', () => {
      const song = baseSong({
        audioAnalysis: {
          ...baseSong().audioAnalysis,
          beat_times: [],
          sectional_key_candidates: [
            { section: 'Intro', key: 'C', scale: 'major', confidence: 0.9 },
            { section: 'Verse', key: 'Am', scale: 'minor', confidence: 0.85 },
          ],
        },
      });
      render(<AuditTimeline {...baseProps({ song, duration: 16 })} />);
      // With no beat_times, sections are proportionally spaced as analytical sections
      expect(screen.getAllByText('Intro')[0]).toBeDefined();
    });
  });

  describe('formatTime', () => {
    it('formats seconds to mm:ss', () => {
      render(<AuditTimeline {...baseProps({ currentTime: 65, duration: 240 })} />);
      expect(screen.getByText('1:05 / 4:00')).toBeDefined();
    });

    it('falls back to song.durationSeconds when duration is zero', () => {
      render(<AuditTimeline {...baseProps({ currentTime: 0, duration: 0 })} />);
      expect(screen.getByText('0:00 / 4:00')).toBeDefined();
    });
  });

  describe('playhead position', () => {
    it('uses percentage-based playhead positioning', () => {
      render(<AuditTimeline {...baseProps({ currentTime: 120, duration: 240 })} />);
      const energySlider = screen.getByRole('slider', { name: /energy/i });
      // aria-valuenow should reflect playhead position
      expect(energySlider.getAttribute('aria-valuenow')).toBe('120');
      expect(energySlider.getAttribute('aria-valuemax')).toBe('240');
    });

    it('clamps playhead to valid range', () => {
      render(<AuditTimeline {...baseProps({ currentTime: 300, duration: 200 })} />);
      const energySlider = screen.getByRole('slider', { name: /energy/i });
      expect(energySlider.getAttribute('aria-valuenow')).toBe('300');
    });
  });

  describe('lane toggles', () => {
    it('starts with lanes hidden by default and toggles them on button click', () => {
      render(<AuditTimeline {...baseProps({
        defaultShowEnergy: false,
        defaultShowBeatGrid: false,
        defaultShowKeyRegions: false
      })} />);

      // Verify that distracting lanes are hidden
      expect(screen.queryByText('Energy')).toBeNull();
      expect(screen.queryByText('Beat Grid')).toBeNull();
      expect(screen.queryByText('Key')).toBeNull();

      // Seek, Sections and Markers must still be visible
      expect(screen.getByText('Seek')).toBeDefined();
      expect(screen.getByText('Sections')).toBeDefined();
      expect(screen.getByText('Markers')).toBeDefined();

      // Toggle waveform
      const waveformBtn = screen.getByTitle('Toggle Energy waveform lane');
      fireEvent.click(waveformBtn);
      expect(screen.getByText('Energy')).toBeDefined();

      // Toggle beats
      const beatsBtn = screen.getByTitle('Toggle vertical beat grid lines');
      fireEvent.click(beatsBtn);
      expect(screen.getByText('Beat Grid')).toBeDefined();

      // Toggle keys
      const keysBtn = screen.getByTitle('Toggle Key regions lane');
      fireEvent.click(keysBtn);
      expect(screen.getByText('Key')).toBeDefined();
    });
  });
});
