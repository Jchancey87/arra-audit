import React, { useRef, useState, useEffect } from 'react';

const LANE_HEIGHT = 40;

const formatTime = (s) => {
  const sec = Math.floor(s || 0);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const useScrubState = (ref, duration, onSeek) => {
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubX, setScrubX] = useState(null);

  useEffect(() => {
    if (!scrubbing) return;
    const handleMove = (e) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      setScrubX(x);
    };
    const handleUp = (e) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const ratio = rect.width > 0 ? x / rect.width : 0;
      onSeek && onSeek(ratio * (duration || 0));
      setScrubbing(false);
      setScrubX(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [scrubbing, duration, onSeek, ref]);

  return { scrubbing, scrubX, startScrub: () => setScrubbing(true), setScrubX };
};

const WaveformLane = ({ audioData, duration, currentTime, scrubX, onScrubStart, onScrubEnd, refProp }) => {
  const ref = useRef(null);
  const fallback = audioData && audioData.length > 0 ? audioData : null;
  const W = 1000;
  const peaks = 200;
  let path = '';
  if (fallback) {
    const step = Math.max(1, Math.floor(fallback.length / peaks));
    for (let i = 0; i < peaks; i++) {
      const v = fallback[i * step] || 0;
      const h = Math.max(0.05, Math.abs(v));
      const x = (i / peaks) * W;
      const y = 50 - h * 45;
      const h2 = h * 90;
      path += `M${x},${y} h1 v${h2} h-1 z `;
    }
  } else {
    // Synthetic continuous peaks for visual interest
    for (let i = 0; i < peaks; i++) {
      const n = Math.sin(i * 0.12) * 0.3 + Math.cos(i * 0.27) * 0.2 + Math.sin(i * 0.6) * 0.15;
      const v = Math.abs(n);
      const x = (i / peaks) * W;
      const h = v * 80;
      path += `M${x},${50 - h / 2} h1 v${h} h-1 z `;
    }
  }
  const totalSec = duration || 1;
  const playX = (currentTime / totalSec) * W;
  const scrubPx = scrubX != null ? scrubX : null;

  return (
    <div
      ref={(el) => { ref.current = el; if (refProp) refProp.current = el; }}
      onMouseDown={onScrubStart}
      style={{
        height: `${LANE_HEIGHT}px`,
        position: 'relative',
        cursor: 'pointer',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
      }}
      aria-label="Audio waveform — click to seek"
      role="slider"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration || 0)}
      aria-valuenow={Math.round(currentTime || 0)}
    >
      <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
        <path d={path} fill="var(--accent-primary)" opacity="0.6" />
      </svg>
      {/* Playhead */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: scrubPx != null ? `${scrubPx}px` : `${playX}px`,
          width: '1px',
          background: 'var(--accent-primary)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

const BeatGridLane = ({ beats, downbeats, duration }) => {
  const totalSec = duration || 1;
  return (
    <div
      style={{
        height: '16px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {(beats || []).map((t, i) => {
        const isDown = downbeats && downbeats.some((d) => Math.abs(d - t) < 0.05);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(t / totalSec) * 100}%`,
              top: 0,
              bottom: 0,
              width: isDown ? '1px' : '1px',
              background: isDown ? 'var(--text-secondary)' : 'var(--text-tertiary)',
              opacity: isDown ? 0.5 : 0.3,
            }}
          />
        );
      })}
    </div>
  );
};

const KeyCenterLane = ({ keyChanges, duration }) => {
  const totalSec = duration || 1;
  return (
    <div
      style={{
        height: '16px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {(keyChanges || []).map((kc, i) => {
        const left = (kc.time / totalSec) * 100;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              fontSize: '9px',
              color: 'var(--status-success)',
              fontFamily: 'JetBrains Mono, monospace',
              transform: 'translateX(2px)',
              whiteSpace: 'nowrap',
            }}
          >
            {kc.key}{kc.scale === 'minor' ? 'm' : ''}
          </span>
        );
      })}
    </div>
  );
};

const SectionsLane = ({ sections, duration, onSectionClick, onAddSection }) => {
  const totalSec = duration || 1;
  return (
    <div
      style={{
        height: '20px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
      }}
    >
      {(sections || []).map((s, i) => {
        const left = (s.start / totalSec) * 100;
        const width = ((s.end - s.start) / totalSec) * 100;
        return (
          <div
            key={i}
            onClick={() => onSectionClick && onSectionClick(s)}
            style={{
              position: 'absolute',
              left: `${left}%`,
              width: `${width}%`,
              top: 2,
              bottom: 2,
              background: 'var(--bg-surface-3)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              padding: '0 4px',
            }}
            title={s.name}
          >
            {s.name}
          </div>
        );
      })}
      {onAddSection && (
        <button
          onClick={onAddSection}
          className="ghost"
          style={{
            position: 'absolute',
            right: 4,
            top: 2,
            bottom: 2,
            padding: '0 6px',
            fontSize: '9px',
            color: 'var(--text-tertiary)',
            background: 'transparent',
          }}
        >
          + Section
        </button>
      )}
    </div>
  );
};

const MarkersLane = ({ markers, duration, onMarkerClick }) => {
  const totalSec = duration || 1;
  return (
    <div
      style={{
        height: '12px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
      }}
    >
      {(markers || []).map((m, i) => {
        const left = (m.time / totalSec) * 100;
        return (
          <button
            key={i}
            onClick={() => onMarkerClick && onMarkerClick(m)}
            aria-label={`Jump to ${formatTime(m.time)}${m.label ? `: ${m.label}` : ''}`}
            style={{
              position: 'absolute',
              left: `${left}%`,
              top: 0,
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '8px solid var(--accent-primary)',
              transform: 'translateX(-4px)',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
            }}
            title={m.label || formatTime(m.time)}
          />
        );
      })}
    </div>
  );
};

const Lane = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
    <div
      style={{
        width: '80px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: '9px',
        fontFamily: 'JetBrains Mono, monospace',
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        background: 'var(--bg-surface-1)',
        borderRight: '1px solid var(--border-subtle)',
      }}
    >
      {label}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

const AuditTimeline = ({ song, currentTime, duration, onSeek, onAddSection, onAddMarker, readOnly = false }) => {
  const waveformRef = useRef(null);
  const { scrubX, startScrub } = useScrubState(waveformRef, duration, onSeek);
  const [showScrubTooltip, setShowScrubTooltip] = useState(false);

  useEffect(() => {
    setShowScrubTooltip(scrubX != null);
  }, [scrubX]);

  if (!song) return null;
  const analysis = song.audioAnalysis || {};
  const sections = (analysis.sectional_key_candidates || []).map((s, i, arr) => ({
    name: s.section,
    start: (i / arr.length) * (duration || 0),
    end: ((i + 1) / arr.length) * (duration || 0),
  }));
  const keyChanges = analysis.key_changes || [{ time: 0, key: analysis.key, scale: analysis.scale }];

  return (
    <section role="region" aria-label="Song timeline with beat grid, key centers, and section markers" style={{ marginTop: '16px' }}>
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
          }}
        >
          Timeline
        </h2>
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Lanes */}
      <div
        style={{
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ height: `${LANE_HEIGHT}px`, borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Waveform">
            <WaveformLane
              refProp={waveformRef}
              audioData={analysis.waveform_peaks}
              duration={duration}
              currentTime={currentTime}
              scrubX={scrubX}
              onScrubStart={startScrub}
            />
          </Lane>
        </div>
        <div style={{ height: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Beat Grid">
            <BeatGridLane beats={analysis.beat_times} downbeats={analysis.downbeat_times} duration={duration} />
          </Lane>
        </div>
        <div style={{ height: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Downbeats">
            <BeatGridLane beats={analysis.downbeat_times || []} downbeats={analysis.downbeat_times || []} duration={duration} />
          </Lane>
        </div>
        <div style={{ height: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Key Center">
            <KeyCenterLane keyChanges={keyChanges} duration={duration} />
          </Lane>
        </div>
        <div style={{ height: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Sections">
            <SectionsLane sections={sections} duration={duration} onAddSection={!readOnly ? onAddSection : null} />
          </Lane>
        </div>
        <div style={{ height: '12px' }}>
          <Lane label="Markers">
            <MarkersLane markers={analysis.markers || []} duration={duration} onMarkerClick={(m) => onSeek && onSeek(m.time)} />
          </Lane>
        </div>

        {/* Scrub tooltip overlay */}
        {showScrubTooltip && scrubX != null && waveformRef.current && (
          <div
            style={{
              position: 'absolute',
              left: `${scrubX + 80 + 8}px`,
              top: 4,
              background: 'var(--bg-surface-3)',
              color: 'var(--text-primary)',
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 6px',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            {formatTime((scrubX / (waveformRef.current.getBoundingClientRect().width || 1)) * (duration || 0))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AuditTimeline;
