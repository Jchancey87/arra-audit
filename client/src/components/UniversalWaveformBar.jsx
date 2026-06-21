import React, { useMemo, useState } from 'react';
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
  background: '#0c0c0f',
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

const UniversalWaveformBar = ({
  regions = [],
  onRegionClick,
  onRegionUpdate,
  onRecover,
  recovering = false,
  pxPerSec = 8,
  waveHeight = 64,
  title = 'WAVEFORM',
  showTimeline = true,
  paddingLeft = 0,
}) => {
  const {
    audioRef, activeSong, togglePlay, isPlaying, currentTime, duration,
    seekTo, audioError,
  } = useAudio();

  const hasPlayableAudio = Boolean(activeSong?.publicUrl) && !audioError;
  const [zoom, setZoom] = useState(pxPerSec);

  const regionsMemo = useMemo(() => regions, [regions]);

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
              regions={regionsMemo}
              pxPerSec={zoom}
              currentTime={currentTime}
              onRegionClick={onRegionClick}
              onRegionUpdate={onRegionUpdate}
              waveHeight={waveHeight}
              showTimeline={showTimeline}
              paddingLeft={paddingLeft}
            />
          )}
        </>
      )}

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

        {/* Zoom controls */}
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(2, Math.round(z * 0.7)))}
          disabled={!hasPlayableAudio}
          aria-label="Zoom out"
          title="Zoom out"
          style={transportBtn}
        >−</button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(200, Math.round(z * 1.4)))}
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
