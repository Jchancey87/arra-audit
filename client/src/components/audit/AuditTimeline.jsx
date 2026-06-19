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

const WaveformLane = ({ audioData, duration, currentTime, scrubX, onScrubStart, onScrubEnd, refProp, beatTimes }) => {
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
    // Synthetic envelope — pulse on beats when available, otherwise sin/cos noise
    const totalSec = duration || 1;
    const beatEnvelope = (i) => {
      if (!beatTimes || beatTimes.length === 0) return 1;
      const t = (i / peaks) * totalSec;
      const beatDur = 60 / 120; // assume 120 bpm if no tempo; visual only
      const phase = (t % beatDur) / beatDur;
      return Math.max(0.15, 1 - phase * 0.7);
    };
    for (let i = 0; i < peaks; i++) {
      const n = Math.sin(i * 0.12) * 0.3 + Math.cos(i * 0.27) * 0.2 + Math.sin(i * 0.6) * 0.15;
      const v = Math.abs(n) * beatEnvelope(i);
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

const SectionsLane = ({ sections, duration, currentTime, onSectionClick, onAddSection, onAddSectionCancel }) => {
  const totalSec = duration || 1;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');

  const startAdd = () => {
    setName('');
    setStartTime(formatTime(currentTime || 0));
    setAdding(true);
  };

  const submit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return;
    const [m, s] = startTime.split(':').map((n) => parseInt(n, 10) || 0);
    const startSeconds = m * 60 + s;
    if (onAddSection) onAddSection({ name: name.trim(), start: startSeconds });
    setAdding(false);
    setName('');
  };

  const cancel = (e) => {
    e?.stopPropagation?.();
    setAdding(false);
    setName('');
    if (onAddSectionCancel) onAddSectionCancel();
  };

  return (
    <div
      style={{
        height: adding ? '68px' : '20px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
        transition: 'height 0.15s ease',
      }}
    >
      {(sections || []).map((s, i) => {
        const left = (s.start / totalSec) * 100;
        const width = ((s.end - s.start) / totalSec) * 100;
        return (
          <div
            key={i}
            onClick={() => onSectionClick && onSectionClick(s)}
            onMouseDown={(e) => e.stopPropagation()}
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
      {!adding && onAddSection && (
        <button
          onClick={startAdd}
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
      {adding && (
        <form
          onSubmit={submit}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            inset: '2px 4px',
            background: 'var(--bg-surface-3)',
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            padding: '0 6px',
            zIndex: 3,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Section name"
            style={{ flex: '0 0 110px', fontSize: '10px', padding: '3px 5px' }}
          />
          <input
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            placeholder="0:00"
            style={{ width: '52px', fontSize: '10px', padding: '3px 5px' }}
            aria-label="Section start time"
          />
          <button type="submit" className="primary" style={{ fontSize: '9px', padding: '3px 8px' }}>Add</button>
          <button type="button" onClick={cancel} className="ghost" style={{ fontSize: '9px', padding: '3px 6px' }}>Cancel</button>
        </form>
      )}
    </div>
  );
};

const MarkersLane = ({ markers, duration, onMarkerClick, onUpdateMarker, onDeleteMarker, onContextMenu }) => {
  const totalSec = duration || 1;
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const handleContextMenu = (e, m) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(m._id || m.id);
  };

  const closeMenu = () => {
    setOpenMenuId(null);
    setRenamingId(null);
    setRenameValue('');
  };

  const handleRenameStart = (m) => {
    setRenamingId(m._id || m.id);
    setRenameValue(m.label || '');
  };

  const handleRenameSubmit = (m) => {
    const id = m._id || m.id;
    if (onUpdateMarker) onUpdateMarker(id, { label: renameValue.trim() });
    closeMenu();
  };

  const handleDelete = (m) => {
    const id = m._id || m.id;
    if (onDeleteMarker) onDeleteMarker(id);
    closeMenu();
  };

  return (
    <div
      style={{
        height: '12px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'visible',
      }}
      onClick={() => openMenuId && closeMenu()}
    >
      {(markers || []).map((m, i) => {
        const ts = m.timestampSeconds ?? m.time ?? 0;
        const left = (ts / totalSec) * 100;
        const id = m._id || m.id || i;
        return (
          <React.Fragment key={id}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onMarkerClick) onMarkerClick(m);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onContextMenu={(e) => handleContextMenu(e, m)}
              aria-label={`Jump to ${formatTime(ts)}${m.label ? `: ${m.label}` : ''}`}
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
                zIndex: 2,
              }}
              title={m.label ? `${formatTime(ts)} — ${m.label}` : formatTime(ts)}
            />
            {openMenuId === id && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: '14px',
                  transform: 'translateX(-4px)',
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '160px',
                  zIndex: 10,
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '10px',
                }}
              >
                {renamingId === id ? (
                  <>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit(m);
                        else if (e.key === 'Escape') closeMenu();
                      }}
                      placeholder="Marker label"
                      style={{ fontSize: '10px', padding: '3px 5px' }}
                    />
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleRenameSubmit(m)} className="primary" style={{ fontSize: '9px', padding: '3px 6px' }}>Save</button>
                      <button onClick={closeMenu} className="ghost" style={{ fontSize: '9px', padding: '3px 6px' }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleRenameStart(m)}
                      className="ghost"
                      style={{ fontSize: '10px', textAlign: 'left', padding: '4px 6px' }}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(m)}
                      className="ghost"
                      style={{ fontSize: '10px', textAlign: 'left', padding: '4px 6px', color: 'var(--color-error)' }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </React.Fragment>
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

const AuditTimeline = ({
  song,
  currentTime,
  duration,
  onSeek,
  onAddSection,
  onAddMarker,
  onUpdateMarker,
  onDeleteMarker,
  markers = [],
  readOnly = false,
}) => {
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onAddMarker && !readOnly && (
            <button
              onClick={() => onAddMarker(currentTime || 0)}
              className="ghost"
              style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}
              title="Drop marker at current playhead (M)"
            >
              + Marker
            </button>
          )}
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
              beatTimes={analysis.beat_times}
              duration={duration}
              currentTime={currentTime}
              scrubX={scrubX}
              onScrubStart={startScrub}
            />
          </Lane>
        </div>
        <div style={{ height: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Beat Grid">
            <div onMouseDown={startScrub} style={{ height: '100%', cursor: 'pointer' }}>
              <BeatGridLane beats={analysis.beat_times} downbeats={analysis.downbeat_times} duration={duration} />
            </div>
          </Lane>
        </div>
        <div style={{ height: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Downbeats">
            <div onMouseDown={startScrub} style={{ height: '100%', cursor: 'pointer' }}>
              <BeatGridLane beats={analysis.downbeat_times || []} downbeats={analysis.downbeat_times || []} duration={duration} />
            </div>
          </Lane>
        </div>
        <div style={{ height: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Key Center">
            <div onMouseDown={startScrub} style={{ height: '100%', cursor: 'pointer' }}>
              <KeyCenterLane keyChanges={keyChanges} duration={duration} />
            </div>
          </Lane>
        </div>
        <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <Lane label="Sections">
            <SectionsLane
              sections={sections}
              duration={duration}
              currentTime={currentTime}
              onAddSection={!readOnly && onAddSection ? (payload) => onAddSection(payload) : null}
            />
          </Lane>
        </div>
        <div style={{ height: '12px', position: 'relative' }}>
          <Lane label="Markers">
            <div onMouseDown={startScrub} style={{ height: '100%', cursor: 'pointer', position: 'relative' }}>
              <MarkersLane
                markers={markers}
                duration={duration}
                onMarkerClick={(m) => onSeek && onSeek(m.timestampSeconds ?? m.time ?? 0)}
                onUpdateMarker={onUpdateMarker}
                onDeleteMarker={onDeleteMarker}
              />
            </div>
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
