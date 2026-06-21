import React, { useMemo, useState, useEffect } from 'react';
import { useAudio } from '../context/AudioContext';
import WaveformTimelineOverlay from './WaveformTimelineOverlay.jsx';

/**
 * UniversalWaveformBar
 * --------------------
 * Site-wide wavesurfer.js waveform + RegionsPlugin + TimelinePlugin
 * (timeline2) + a compact transport row. Designed to drop into ANY
 * surface that lives inside <AudioProvider> — every lens tab in the
 * audit form, every daily-goal study session, the analysis tab, etc.
 *
 * One shared <audio> element (owned by AudioContext) drives both the
 * transport and the waveform (wavesurfer attaches via `media:`), so
 * there is no double-engine drift and no second Web Audio context.
 *
 * Recovery states:
 *  - song.publicUrl is null  → "no audio" state with optional re-download
 *  - audioError is set       → "audio file missing" state with re-download
 *    (this is the white-noise-then-silence case: publicUrl points at a
 *    file that no longer exists on disk, express.static 404s, the browser
 *    decodes the HTML error page as audio → static burst → error event)
 *
 * Props:
 *   - regions:        generic region descriptors for the Wavesurfer
 *                     RegionsPlugin:
 *                     { id, start, end, color, label, drag?, resize?, selected? }
 *   - onRegionClick(regionId), onRegionUpdate(regionId, { start, end })
 *   - onRecover:      async handler for the "Re-download audio" button.
 *                     If omitted, the recovery UI shows a static message.
 *   - recovering:     bool — disables the button while onRecover is in flight
 *                     (the parent owns this state since it owns the network call)
 *   - pxPerSec:       zoom (default 8)
 *   - waveHeight:     waveform px height (default 64)
 *   - title:          optional header label (e.g. "HARMONY LENS · WAVEFORM")
 *   - showTimeline:   bool — render the TimelinePlugin ruler (default true)
 */
const fmt = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  const m = Math.floor(n / 60);
  return `${m}:${String(n % 60).padStart(2, '0')}`;
};

const transportBtn = {
  padding: '4px 8px',
  fontSize: '10px',
  fontFamily: '"Roboto Mono", monospace',
  background: 'transparent',
  color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '2px',
  cursor: 'pointer',
};

const panelStyle = {
  background: 'var(--bg-surface-0)',
  borderRadius: '4px',
  border: '1px solid rgba(255,255,255,0.06)',
  overflow: 'hidden',
};

const headerStyle = {
  height: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: '12px',
  paddingRight: '10px',
  background: '#0a0a0d',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
};

const headerLabel = {
  fontSize: '10px',
  color: 'rgba(255,255,255,0.35)',
  fontFamily: '"Roboto Mono", monospace',
  letterSpacing: '0.06em',
};

const PRESET_COLORS = ['#c084fc', '#34d399', '#f472b6', '#22d3ee', '#fbbf24', '#ff6600', '#ef4444'];

const SECTION_TYPES = [
  { value: 'intro', label: 'Intro', color: '#a78bfa' },
  { value: 'verse', label: 'Verse', color: '#34d399' },
  { value: 'chorus', label: 'Chorus', color: '#22d3ee' },
  { value: 'pre-chorus', label: 'Pre-Chorus', color: '#ff6f61' },
  { value: 'bridge', label: 'Bridge', color: '#fbbf24' },
  { value: 'solo', label: 'Solo', color: '#ff6600' },
  { value: 'outro', label: 'Outro', color: '#ffd700' },
  { value: 'custom', label: 'Custom', color: '#f472b6' },
];

const UniversalWaveformBar = ({
  regions = [],
  onRegionClick,
  onRegionUpdate,
  onRegionChange,
  onRegionDelete,
  onRegionCreate,
  onRecover,
  recovering = false,
  pxPerSec = 8,
  waveHeight = 64,
  title = 'WAVEFORM',
  showTimeline = true,
  paddingLeft = 0,
  onZoomChange,
  hideWaveform = false,
}) => {
  const {
    audioRef, activeSong, togglePlay, isPlaying, currentTime, duration,
    seekTo, audioError,
  } = useAudio();

  const hasPlayableAudio = Boolean(activeSong?.publicUrl) && !audioError;
  const [zoom, setZoom] = useState(pxPerSec);
  const [selectedRegionId, setSelectedRegionId] = useState(null);
  const [dragSelectEnabled, setDragSelectEnabled] = useState(false);
  const [loopRegionId, setLoopRegionId] = useState(null);
  const [regionForm, setRegionForm] = useState({ label: '', notes: '', color: '', opacity: 0.25, start: 0, end: 0, type: 'custom' });

  useEffect(() => {
    setZoom(pxPerSec);
  }, [pxPerSec]);

  const selectedRegion = useMemo(() => {
    return regions.find(r => r.id === selectedRegionId);
  }, [regions, selectedRegionId]);

  const isArrangementSection = useMemo(() => {
    return selectedRegionId && !selectedRegionId.startsWith('bm-') && !selectedRegionId.startsWith('tag-');
  }, [selectedRegionId]);

  // Sync selection details to local form state when selected region changes
  useEffect(() => {
    if (selectedRegion) {
      setRegionForm({
        label: selectedRegion.label || '',
        notes: selectedRegion.notes || '',
        color: selectedRegion.color || '',
        opacity: selectedRegion.opacity !== undefined ? selectedRegion.opacity : 0.25,
        start: selectedRegion.start || 0,
        end: selectedRegion.end || 0,
        type: selectedRegion.type || 'custom',
      });
    } else {
      setLoopRegionId(null);
    }
  }, [selectedRegion?.id, selectedRegion?.start, selectedRegion?.end, selectedRegion?.color, selectedRegion?.opacity, selectedRegion?.label, selectedRegion?.notes, selectedRegion?.type]);

  const handleRegionClickInternal = (regionId, e) => {
    setSelectedRegionId(regionId);
    onRegionClick?.(regionId, e);
  };

  const handleRegionFormChange = (field, value) => {
    setRegionForm(prev => ({ ...prev, [field]: value }));
    onRegionChange?.(selectedRegionId, { [field]: value });
  };

  const handleSectionTypeChange = (typeVal) => {
    const typeObj = SECTION_TYPES.find(t => t.value === typeVal);
    const colorVal = typeObj ? typeObj.color : '#f472b6';
    setRegionForm(prev => ({ ...prev, type: typeVal, color: colorVal }));
    onRegionChange?.(selectedRegionId, { type: typeVal, color: colorVal });
  };

  const handleDeleteSelectedRegion = () => {
    if (selectedRegionId) {
      onRegionDelete?.(selectedRegionId);
      setSelectedRegionId(null);
    }
  };

  const handleRegionCreateInternal = ({ start, end }) => {
    setDragSelectEnabled(false); // disable draw mode after drawing
    onRegionCreate?.({ start, end });
  };

  const regionsWithSelection = useMemo(() => {
    return regions.map(r => ({
      ...r,
      selected: r.id === selectedRegionId,
    }));
  }, [regions, selectedRegionId]);

  // ── Recovery state: publicUrl null OR audio error (file missing on disk) ──
  const showRecovery = !activeSong?.publicUrl || audioError;
  const recoveryMessage = audioError
    ? audioError.message
    : 'Audio file missing for this song — the original download didn\'t land. Playback is disabled until audio is re-downloaded.';

  // ── Nothing loaded at all ──
  if (!activeSong) {
    return (
      <div style={panelStyle} role="region" aria-label="Waveform">
        <div style={headerStyle}>
          <span style={headerLabel}>▨ {title}</span>
        </div>
        <div style={{
          padding: '18px 16px', textAlign: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: '11px',
          fontFamily: '"Roboto Mono", monospace',
        }}>
          No song loaded.
        </div>
      </div>
    );
  }

  // Inline Region Inspector Panel
  const inspectorEl = selectedRegion ? (
    <div style={{
      background: '#0d0d11',
      borderTop: '1px solid rgba(255,255,255,0.05)',
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.6)', fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.05em' }}>
          ⚙️ REGION PROPERTIES
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: '"Roboto Mono", monospace' }}>
            <input
              type="checkbox"
              checked={loopRegionId === selectedRegionId}
              onChange={(e) => setLoopRegionId(e.target.checked ? selectedRegionId : null)}
              style={{ margin: 0 }}
            />
            Loop Playback
          </label>
          <button
            type="button"
            onClick={() => setSelectedRegionId(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              fontSize: '11px',
              padding: '2px 4px',
            }}
          >✕ Close</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        {/* Title / Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '2 1 200px' }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>TITLE</span>
          <input
            type="text"
            value={regionForm.label}
            onChange={(e) => handleRegionFormChange('label', e.target.value)}
            placeholder="Name this region..."
            style={{
              background: '#14141c',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '2px',
              color: '#fff',
              fontSize: '11px',
              padding: '4px 6px',
              fontFamily: '"Roboto Mono", monospace',
            }}
          />
        </div>

        {/* Information / Notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '3 1 250px' }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>NOTES / DESCRIPTION</span>
          <input
            type="text"
            value={regionForm.notes}
            onChange={(e) => handleRegionFormChange('notes', e.target.value)}
            placeholder="Details about this region..."
            style={{
              background: '#14141c',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '2px',
              color: '#fff',
              fontSize: '11px',
              padding: '4px 6px',
              fontFamily: '"Roboto Mono", monospace',
            }}
          />
        </div>

        {/* Section Type (for arrangement sections only) */}
        {isArrangementSection && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '120px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>SECTION TYPE</span>
            <select
              value={regionForm.type || 'custom'}
              onChange={(e) => handleSectionTypeChange(e.target.value)}
              style={{
                background: '#14141c',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '2px',
                color: '#fff',
                fontSize: '11px',
                padding: '4px 6px',
                fontFamily: '"Roboto Mono", monospace',
                height: '24px',
                cursor: 'pointer',
              }}
            >
              {SECTION_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Timing */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>START</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontFamily: '"Roboto Mono", monospace', background: '#14141c', padding: '4px 8px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.04)' }}>
              {fmt(regionForm.start)}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>END</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontFamily: '"Roboto Mono", monospace', background: '#14141c', padding: '4px 8px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.04)' }}>
              {fmt(regionForm.end)}
            </span>
          </div>
        </div>

        {/* Opacity Slider */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '90px' }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>OPACITY ({Math.round(regionForm.opacity * 100)}%)</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={regionForm.opacity}
            onChange={(e) => handleRegionFormChange('opacity', parseFloat(e.target.value))}
            style={{ height: '18px', cursor: 'pointer', accentColor: '#ff6600' }}
          />
        </div>

        {/* Color Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>COLOR</span>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', height: '22px' }}>
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleRegionFormChange('color', color)}
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: color,
                  border: regionForm.color === color ? '2px solid #fff' : '1px solid rgba(0,0,0,0.5)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Deletion Button */}
        <div style={{ display: 'flex', alignSelf: 'flex-end', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={handleDeleteSelectedRegion}
            style={{
              ...transportBtn,
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#f87171',
              borderColor: 'rgba(239, 68, 68, 0.25)',
            }}
          >Delete</button>
        </div>
      </div>
    </div>
  ) : null;

  if (hideWaveform) {
    return (
      <div style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        {audioRef?.current && (
          <WaveformTimelineOverlay
            audioRef={audioRef}
            regions={regionsWithSelection}
            pxPerSec={zoom}
            currentTime={currentTime}
            onRegionClick={handleRegionClickInternal}
            onRegionUpdate={onRegionUpdate}
            onRegionCreate={handleRegionCreateInternal}
            waveHeight={waveHeight || 30}
            showTimeline={false}
            paddingLeft={paddingLeft}
            dragSelectEnabled={true}
            loopRegionId={loopRegionId}
            hideWaveform={true}
          />
        )}
        {inspectorEl}
      </div>
    );
  }

  return (
    <div style={panelStyle} role="region" aria-label="Waveform">
      <div style={headerStyle}>
        <span style={headerLabel}>▨ {title}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '10px', fontFamily: '"Roboto Mono", monospace',
            color: hasPlayableAudio
              ? 'rgba(255,255,255,0.5)'
              : 'rgba(248,113,113,0.85)',
            whiteSpace: 'nowrap',
          }} aria-live="off">
            {hasPlayableAudio ? `${fmt(currentTime)} / ${fmt(duration)}` : 'no audio'}
          </span>
        </div>
      </div>

      {showRecovery ? (
        <div style={{
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', flexWrap: 'wrap',
          background: 'rgba(248,113,113,0.06)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span style={{
            fontSize: '11px', color: 'rgba(248,163,163,0.9)',
            fontFamily: '"Roboto Mono", monospace', lineHeight: 1.4, flex: 1, minWidth: 200,
          }}>
            {recoveryMessage}
          </span>
          {onRecover && (
            <button
              type="button"
              onClick={onRecover}
              disabled={recovering}
              style={{
                padding: '6px 14px', fontSize: '11px',
                fontFamily: '"Roboto Mono", monospace',
                background: recovering ? 'rgba(255,102,0,0.1)' : 'rgba(255,102,0,0.18)',
                color: '#ff6600',
                border: '1px solid rgba(255,102,0,0.4)',
                borderRadius: '2px', cursor: recovering ? 'wait' : 'pointer',
              }}
            >
              {recovering ? 'Re-downloading…' : 'Re-download audio'}
            </button>
          )}
        </div>
      ) : (
        <>
          {audioRef?.current && (
            <WaveformTimelineOverlay
              audioRef={audioRef}
              regions={regionsWithSelection}
              pxPerSec={zoom}
              currentTime={currentTime}
              onRegionClick={handleRegionClickInternal}
              onRegionUpdate={onRegionUpdate}
              onRegionCreate={handleRegionCreateInternal}
              waveHeight={waveHeight}
              showTimeline={showTimeline}
              paddingLeft={paddingLeft}
              dragSelectEnabled={dragSelectEnabled}
              loopRegionId={loopRegionId}
            />
          )}
        </>
      )}

      {inspectorEl}

      {/* Compact transport row — always present (drives the shared <audio>) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '6px 10px', background: '#0a0a0d',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <button
          type="button"
          onClick={() => seekTo(currentTime - 10)}
          disabled={!hasPlayableAudio}
          aria-label="Back 10 seconds"
          style={transportBtn}
        >−10s</button>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!hasPlayableAudio}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={!hasPlayableAudio ? 'Audio not available' : (isPlaying ? 'Pause' : 'Play')}
          style={{
            ...transportBtn,
            background: 'rgba(255,102,0,0.18)',
            color: '#ff6600',
            borderColor: 'rgba(255,102,0,0.4)',
            fontWeight: 'bold',
            minWidth: '44px',
          }}
        >{isPlaying ? '⏸' : '▶'}</button>
        <button
          type="button"
          onClick={() => seekTo(currentTime + 10)}
          disabled={!hasPlayableAudio}
          aria-label="Forward 10 seconds"
          style={transportBtn}
        >+10s</button>

        <div style={{ flex: 1 }} />

        {/* Drag selection draw button */}
        <button
          type="button"
          onClick={() => setDragSelectEnabled(!dragSelectEnabled)}
          disabled={!hasPlayableAudio}
          title="Draw a custom region by dragging on the waveform"
          style={{
            ...transportBtn,
            background: dragSelectEnabled ? 'rgba(255, 102, 0, 0.15)' : 'transparent',
            color: dragSelectEnabled ? '#ff6600' : 'rgba(255,255,255,0.7)',
            borderColor: dragSelectEnabled ? 'rgba(255, 102, 0, 0.4)' : 'rgba(255,255,255,0.12)',
            marginRight: '8px',
          }}
        >
          {dragSelectEnabled ? '✏️ Drawing Region' : '✏️ Draw Region'}
        </button>

        {/* Zoom controls */}
        <button
          type="button"
          onClick={() => {
            const next = Math.max(2, Math.round(zoom * 0.7));
            setZoom(next);
            onZoomChange?.(next);
          }}
          disabled={!hasPlayableAudio}
          aria-label="Zoom out"
          title="Zoom out"
          style={transportBtn}
        >−</button>
        <button
          type="button"
          onClick={() => {
            const next = Math.min(200, Math.round(zoom * 1.4));
            setZoom(next);
            onZoomChange?.(next);
          }}
          disabled={!hasPlayableAudio}
          aria-label="Zoom in"
          title="Zoom in"
          style={transportBtn}
        >+</button>
      </div>
    </div>
  );
};

export default UniversalWaveformBar;
