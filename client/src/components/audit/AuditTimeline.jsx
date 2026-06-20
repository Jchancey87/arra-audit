import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { usePlayheadAnnouncer, playheadSrOnlyStyle } from '../../utils/playheadAnnouncer.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const EMPTY_ARR = []; // stable ref to prevent re-render loops in useMemo deps
const LANE_HEIGHT = 40;
const LANE_LABEL_WIDTH = 110;

const SECTION_TYPE_COLORS = {
  intro: 'var(--status-info)',
  verse: 'var(--accent-primary)',
  chorus: 'var(--status-success)',
  bridge: 'var(--status-warning)',
  outro: 'var(--status-error)',
  solo: '#9b59b6',
  breakdown: '#1abc9c',
  interlude: '#e67e22',
};

const DAW_LANES = [
  { id: 'sections', label: 'Sections', emoji: '🎼' },
  { id: 'vocals', label: 'Vocals', emoji: '🎤' },
  { id: 'synths', label: 'Synths/Keys', emoji: '🎹' },
  { id: 'guitars', label: 'Guitars', emoji: '🎸' },
  { id: 'bass', label: 'Bass', emoji: '🎻' },
  { id: 'drums', label: 'Drums', emoji: '🥁' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (s) => {
  const sec = Math.floor(s || 0);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const parseTime = (str) => {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const parts = String(str).split(':');
  if (parts.length === 2) return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  return parseFloat(str) || 0;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const SECTION_BAR_COUNTS = {
  intro: 4, verse: 8, chorus: 8, bridge: 8, outro: 4,
  prechorus: 4, 'pre-chorus': 4, interlude: 4, breakdown: 4,
  solo: 8, coda: 4, ending: 4,
};
const DEFAULT_SECTION_BARS = 8;
const DEFAULT_BPB = 4;

function parseSectionType(label) {
  if (!label) return 'verse';
  const lower = label.toLowerCase().trim();
  for (const key of Object.keys(SECTION_BAR_COUNTS)) {
    if (lower.includes(key)) return key;
  }
  return lower;
}

function estimateSectionPositions(candidates, beatTimes, beatsPerBar) {
  if (!candidates || candidates.length === 0) return [];
  if (!beatTimes || beatTimes.length < 4) {
    return candidates.map((_, i, arr) => ({
      label: _.section, key: _.key, scale: _.scale,
      start: (i / arr.length) * 240, end: ((i + 1) / arr.length) * 240,
    }));
  }
  const bpb = beatsPerBar || DEFAULT_BPB;
  const totalBars = Math.max(1, Math.floor(beatTimes.length / bpb));
  const barDurations = [];
  for (let i = 0; i < totalBars; i++) {
    const s = beatTimes[i * bpb];
    const e = beatTimes[Math.min((i + 1) * bpb, beatTimes.length - 1)];
    barDurations.push(e - s);
  }
  const sectionBars = candidates.map((c) => SECTION_BAR_COUNTS[parseSectionType(c.section)] || DEFAULT_SECTION_BARS);
  const totalSectionBars = sectionBars.reduce((a, b) => a + b, 0);
  const scale = Math.max(1, totalBars) / Math.max(1, totalSectionBars);
  const scaled = sectionBars.map((b) => Math.max(1, Math.round(b * scale)));
  let barCursor = 0, timeCursor = 0;
  return candidates.map((c, i) => {
    const bars = scaled[i];
    const start = timeCursor;
    const slice = barDurations.slice(barCursor, barCursor + bars);
    const end = start + slice.reduce((a, b) => a + b, 0);
    barCursor += bars;
    timeCursor = end;
    return { label: c.section, key: c.key, scale: c.scale, start, end };
  });
}

function sectionColor(type) {
  return SECTION_TYPE_COLORS[type] || 'var(--accent-primary)';
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Flex row: label gutter + content area */
const Lane = ({ label, children, style }) => (
  <div style={{ display: 'flex', alignItems: 'stretch', height: LANE_HEIGHT, ...style }}>
    <div style={{
      width: LANE_LABEL_WIDTH, minWidth: LANE_LABEL_WIDTH,
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
      paddingRight: 8, fontSize: 11, color: 'var(--text-secondary)',
      fontFamily: 'JetBrains Mono, monospace', userSelect: 'none',
    }}>{label}</div>
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {children}
    </div>
  </div>
);

/** Markers lane with dots, context menu, and rename UI */
const MarkersLane = ({ markers, totalSec, onSeek, onUpdateMarker, onDeleteMarker, readOnly }) => {
  const [ctxMenu, setCtxMenu] = useState(null); // { id, x, y }
  const [renaming, setRenaming] = useState(null); // { id, label }

  // Close context menu on outside click (setTimeout(0) so listener attaches after current event)
  useEffect(() => {
    if (!ctxMenu) return;
    let handler;
    const timer = setTimeout(() => {
      handler = () => { setCtxMenu(null); setRenaming(null); };
      document.addEventListener('click', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      if (handler) document.removeEventListener('click', handler);
    };
  }, [ctxMenu]);

  const handleRename = (id, label) => {
    if (onUpdateMarker) onUpdateMarker(id, { label });
    setRenaming(null);
    setCtxMenu(null);
  };

  return (
    <Lane label="Markers">
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {(markers || []).map((m, i) => {
          const pct = totalSec > 0 ? (m.timestampSeconds / totalSec) * 100 : 0;
          const id = m._id || `marker-${i}`;
          return (
            <div
              key={id}
              role="button"
              aria-label={m.label || 'Marker'}
              style={{
                position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)',
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--accent-primary)', cursor: 'pointer', zIndex: 2,
              }}
              onClick={(e) => { e.stopPropagation(); if (onSeek) onSeek(m.timestampSeconds); }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation();
                setCtxMenu({ id, x: e.clientX, y: e.clientY });
                setRenaming(null);
              }}
            />
          );
        })}

        {/* Context menu */}
        {ctxMenu && (
          <div
            style={{
              position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 100,
              background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)',
              borderRadius: 4, padding: 4, minWidth: 100,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {renaming ? (
              <div style={{ padding: 4 }}>
                <input
                  placeholder="Marker label"
                  value={renaming.label}
                  onChange={(e) => setRenaming({ ...renaming, label: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(renaming.id, renaming.label);
                    if (e.key === 'Escape') { setRenaming(null); setCtxMenu(null); }
                  }}
                  autoFocus
                  style={{
                    background: 'var(--bg-surface-3)', border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)', padding: '2px 4px', fontSize: 12, width: '100%',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                />
                <button
                  onClick={() => handleRename(renaming.id, renaming.label)}
                  style={{
                    marginTop: 4, fontSize: 11, background: 'var(--accent-primary)',
                    color: '#000', border: 'none', padding: '2px 8px', cursor: 'pointer', borderRadius: 2,
                  }}
                >Save</button>
              </div>
            ) : (
              <>
                <div
                  style={{ padding: '4px 8px', cursor: 'pointer', color: 'var(--text-primary)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const marker = markers.find((m) => (m._id || `marker-${markers.indexOf(m)}`) === ctxMenu.id);
                    setRenaming({ id: ctxMenu.id, label: marker?.label || '' });
                  }}
                >Rename</div>
                <div
                  style={{ padding: '4px 8px', cursor: 'pointer', color: 'var(--status-error)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeleteMarker) onDeleteMarker(ctxMenu.id);
                    setCtxMenu(null);
                  }}
                >Delete</div>
              </>
            )}
          </div>
        )}
      </div>
    </Lane>
  );
};

/** Key regions colored blocks */
const KeyRegionsLane = ({ regions, totalSec }) => (
  <Lane label="Key">
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {regions.map((r, i) => {
        const left = totalSec > 0 ? (r.start / totalSec) * 100 : 0;
        const width = totalSec > 0 ? ((r.end - r.start) / totalSec) * 100 : 0;
        const keyLabel = r.key + (r.scale === 'minor' ? 'm' : '');
        return (
          <div key={i} style={{
            position: 'absolute', left: `${left}%`, width: `${width}%`, top: 0, bottom: 0,
            background: 'var(--bg-surface-3)', borderRight: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace',
            overflow: 'hidden', whiteSpace: 'nowrap',
          }}>
            {keyLabel}
          </div>
        );
      })}
    </div>
  </Lane>
);

// ── Main component ────────────────────────────────────────────────────────────
const AuditTimeline = ({
  song,
  currentTime,
  duration,
  onSeek,
  onAddSection,
  onUpdateSections,
  onAddMarker,
  onUpdateMarker,
  onDeleteMarker,
  markers = [],
  arrangementSections = [],
  readOnly = false,
  defaultShowEnergy = false,
  defaultShowBeatGrid = false,
  defaultShowKeyRegions = false,
}) => {
  // ── State ─────────────────────────────────────────────────────────────────
  const [showEnergy, setShowEnergy] = useState(defaultShowEnergy);
  const [showBeatGrid, setShowBeatGrid] = useState(defaultShowBeatGrid);
  const [showKeyRegions, setShowKeyRegions] = useState(defaultShowKeyRegions);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [sectionTime, setSectionTime] = useState('');
  const [localSections, setLocalSections] = useState([]);
  const [editingClip, setEditingClip] = useState(null);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const energyRef = useRef(null);
  const containerRef = useRef(null);

  // ── Derived data (stable refs to prevent infinite re-render when song is null) ──
  const totalSec = duration || song?.durationSeconds || 0;
  const analysis = song?.audioAnalysis;
  const energyCurve = analysis?.energy_curve || EMPTY_ARR;
  const beatTimes = analysis?.beat_times || EMPTY_ARR;
  const downbeatTimes = analysis?.downbeat_times || EMPTY_ARR;
  const candidates = analysis?.sectional_key_candidates || EMPTY_ARR;

  const announcement = usePlayheadAnnouncer(currentTime, totalSec);

  // Key regions derived from sectional candidates or overall key
  const keyRegions = useMemo(() => {
    if (candidates.length > 0) {
      return estimateSectionPositions(candidates, beatTimes, DEFAULT_BPB);
    }
    if (analysis?.key) {
      return [{ key: analysis.key, scale: analysis.scale, start: 0, end: totalSec, label: 'Overall' }];
    }
    return [];
  }, [candidates, beatTimes, analysis?.key, analysis?.scale, totalSec]);

  // Analytical sections from key candidates
  const analyticalSections = useMemo(() => {
    if (candidates.length === 0) return [];
    return estimateSectionPositions(candidates, beatTimes, DEFAULT_BPB);
  }, [candidates, beatTimes]);

  // Section clips: user arrangement sections take priority over analytical
  const sectionClips = useMemo(() => {
    if (arrangementSections.length > 0) {
      return arrangementSections.map((s) => ({
        id: s.id, name: s.name, type: s.type || parseSectionType(s.name),
        startTime: s.startTime, duration: s.duration, lane: s.lane, notes: s.notes,
      }));
    }
    return analyticalSections.map((s, i) => ({
      id: `analytical-${i}`, name: s.label, type: parseSectionType(s.label),
      startTime: s.start, duration: s.end - s.start,
    }));
  }, [arrangementSections, analyticalSections]);

  // Sync localSections from sectionClips
  useEffect(() => { setLocalSections(sectionClips); }, [sectionClips]);

  // ── Scrub handler (mousedown → window mousemove/mouseup) ──────────────────
  const startScrub = useCallback((e) => {
    setIsScrubbing(true);
    const calcSeek = (clientX) => {
      const el = energyRef.current;
      if (!el || !onSeek) return;
      const rect = el.getBoundingClientRect();
      const pct = rect.width > 0 ? clamp((clientX - rect.left) / rect.width, 0, 1) : 0;
      onSeek(pct * (duration || 0));
    };
    const onUp = (ev) => {
      calcSeek(ev.clientX);
      setIsScrubbing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    const onMove = (ev) => calcSeek(ev.clientX);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [duration, onSeek]);

  // ── Clip drag/resize ──────────────────────────────────────────────────────
  const handleClipPointerDown = useCallback((e, clipId, mode) => {
    e.stopPropagation();
    const el = e.currentTarget.closest('[data-lane-content]');
    if (!el) return;
    el.setPointerCapture?.(e.pointerId);
    const startX = e.clientX;
    const clip = localSections.find((c) => c.id === clipId);
    if (!clip) return;
    const origStart = clip.startTime;
    const origDur = clip.duration;
    const rect = el.getBoundingClientRect();
    const pxPerSec = rect.width / totalSec;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dSec = dx / pxPerSec;
      setLocalSections((prev) => prev.map((c) => {
        if (c.id !== clipId) return c;
        if (mode === 'move') return { ...c, startTime: Math.max(0, origStart + dSec) };
        if (mode === 'resize-left') {
          const newStart = Math.max(0, origStart + dSec);
          return { ...c, startTime: newStart, duration: Math.max(1, origDur - (newStart - origStart)) };
        }
        if (mode === 'resize-right') return { ...c, duration: Math.max(1, origDur + dSec) };
        return c;
      }));
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      if (onUpdateSections) onUpdateSections(localSections);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
  }, [localSections, totalSec, onUpdateSections]);

  // ── Render guard ──────────────────────────────────────────────────────────
  if (!song) return null;

  const playheadPct = totalSec > 0 ? (currentTime / totalSec) * 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{
      fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)',
      background: 'var(--bg-surface-1)', borderRadius: 8,
      border: '1px solid var(--border-subtle)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Timeline</h2>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {formatTime(currentTime)} / {formatTime(totalSec)}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            title="Toggle Energy waveform lane"
            onClick={() => setShowEnergy((v) => !v)}
            style={{
              background: showEnergy ? 'var(--accent-primary)' : 'var(--bg-surface-3)',
              color: showEnergy ? '#000' : 'var(--text-secondary)',
              border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
            }}
          >Waveform</button>
          <button
            title="Toggle vertical beat grid lines"
            onClick={() => setShowBeatGrid((v) => !v)}
            style={{
              background: showBeatGrid ? 'var(--accent-primary)' : 'var(--bg-surface-3)',
              color: showBeatGrid ? '#000' : 'var(--text-secondary)',
              border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
            }}
          >Beats</button>
          <button
            title="Toggle Key regions lane"
            onClick={() => setShowKeyRegions((v) => !v)}
            style={{
              background: showKeyRegions ? 'var(--accent-primary)' : 'var(--bg-surface-3)',
              color: showKeyRegions ? '#000' : 'var(--text-secondary)',
              border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
            }}
          >Keys</button>
          {!readOnly && onAddMarker && (
            <button
              onClick={() => onAddMarker(currentTime)}
              style={{
                background: 'var(--bg-surface-3)', color: 'var(--text-primary)',
                border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >+ Marker</button>
          )}
          {!readOnly && onAddSection && (
            <button
              onClick={() => { setAddSectionOpen(true); setSectionName(''); setSectionTime(''); }}
              style={{
                background: 'var(--bg-surface-3)', color: 'var(--text-primary)',
                border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
              }}
            >+ Section</button>
          )}
        </div>
      </div>

      {/* Add section form */}
      {addSectionOpen && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: '6px 12px',
          borderBottom: '1px solid var(--border-subtle)', fontSize: 12,
        }}>
          <input
            placeholder="Section name"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            style={{
              background: 'var(--bg-surface-3)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', padding: '2px 6px', fontSize: 12, borderRadius: 2,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <input
            placeholder="0:00"
            value={sectionTime}
            onChange={(e) => setSectionTime(e.target.value)}
            style={{
              background: 'var(--bg-surface-3)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', padding: '2px 6px', fontSize: 12, width: 50, borderRadius: 2,
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <button
            onClick={() => {
              if (sectionName.trim()) {
                onAddSection({ name: sectionName.trim(), start: currentTime });
                setAddSectionOpen(false);
              }
            }}
            style={{
              background: 'var(--accent-primary)', color: '#000', border: 'none',
              padding: '2px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 2,
            }}
          >Add</button>
          <button
            onClick={() => setAddSectionOpen(false)}
            style={{
              background: 'var(--bg-surface-3)', color: 'var(--text-secondary)', border: 'none',
              padding: '2px 10px', fontSize: 11, cursor: 'pointer', borderRadius: 2,
            }}
          >Cancel</button>
        </div>
      )}

      {/* Lane stack with global playhead overlay */}
      <div style={{ position: 'relative' }}>
        {/* Global playhead line */}
        <div style={{
          position: 'absolute', left: `calc(${LANE_LABEL_WIDTH}px + ${playheadPct}% * (100% - ${LANE_LABEL_WIDTH}px) / 100%)`,
          top: 0, bottom: 0, width: 1, background: '#00e5ff', zIndex: 10, pointerEvents: 'none',
        }}>
          {/* Use calc with the content area width */}
        </div>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, zIndex: 10, pointerEvents: 'none',
          left: LANE_LABEL_WIDTH, right: 0,
        }}>
          <div style={{
            position: 'absolute', left: `${playheadPct}%`, top: 0, bottom: 0,
            width: 1, background: '#00e5ff',
          }} />
        </div>

        {/* Seek lane (always visible) */}
        <Lane label="Seek">
          <div
            style={{
              width: '100%', height: '100%', cursor: 'pointer',
              background: 'var(--bg-surface-2)',
            }}
            onMouseDown={startScrub}
          />
        </Lane>

        {/* Energy lane (toggleable) */}
        {showEnergy && (
          <Lane label="Energy">
            <div
              ref={energyRef}
              role="slider"
              aria-label="Energy curve — click to seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(totalSec)}
              aria-valuenow={Math.round(currentTime)}
              tabIndex={0}
              style={{
                width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end',
                cursor: 'pointer', background: 'var(--bg-surface-2)',
              }}
              onMouseDown={startScrub}
            >
              {(energyCurve.length > 0 ? energyCurve : [0.5]).map((v, i, arr) => (
                <div key={i} style={{
                  flex: 1, height: `${(v || 0) * 100}%`,
                  background: 'var(--accent-primary)', opacity: 0.6,
                  borderRight: arr.length > 1 ? '1px solid var(--bg-surface-2)' : 'none',
                }} />
              ))}
            </div>
          </Lane>
        )}

        {/* Beat grid lane (toggleable) */}
        {showBeatGrid && (
          <Lane label="Beat Grid">
            <div
              style={{
                width: '100%', height: '100%', position: 'relative',
                cursor: 'pointer', background: 'var(--bg-surface-2)',
              }}
              onMouseDown={startScrub}
            >
              {beatTimes.map((t, i) => {
                const pct = totalSec > 0 ? (t / totalSec) * 100 : 0;
                const isDownbeat = downbeatTimes.includes(t);
                return (
                  <div key={i} style={{
                    position: 'absolute', left: `${pct}%`, top: 0, bottom: 0,
                    width: 1, background: isDownbeat ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    opacity: isDownbeat ? 0.6 : 0.3,
                  }} />
                );
              })}
            </div>
          </Lane>
        )}

        {/* Key regions lane (toggleable) */}
        {showKeyRegions && keyRegions.length > 0 && (
          <KeyRegionsLane regions={keyRegions} totalSec={totalSec} />
        )}

        {/* Sections lane (always visible) */}
        <Lane label="Sections">
          <div data-lane-content style={{
            width: '100%', height: '100%', position: 'relative',
            background: 'var(--bg-surface-2)',
          }}>
            {localSections.filter((c) => !c.lane || c.lane === 'sections').map((clip) => {
              const left = totalSec > 0 ? (clip.startTime / totalSec) * 100 : 0;
              const width = totalSec > 0 ? (clip.duration / totalSec) * 100 : 0;
              const type = clip.type || parseSectionType(clip.name);
              return (
                <div
                  key={clip.id}
                  style={{
                    position: 'absolute', left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
                    top: 2, bottom: 2, borderRadius: 3,
                    background: sectionColor(type), opacity: 0.85, overflow: 'hidden',
                    display: 'flex', alignItems: 'center', cursor: readOnly ? 'default' : 'grab',
                    fontSize: 10, color: '#fff', paddingLeft: 4, whiteSpace: 'nowrap',
                  }}
                  onPointerDown={readOnly ? undefined : (e) => handleClipPointerDown(e, clip.id, 'move')}
                >
                  {/* Resize handle left */}
                  {!readOnly && (
                    <div
                      style={{
                        position: 'absolute', left: 0, top: 0, bottom: 0, width: 5,
                        cursor: 'col-resize', zIndex: 2,
                      }}
                      onPointerDown={readOnly ? undefined : (e) => handleClipPointerDown(e, clip.id, 'resize-left')}
                    />
                  )}
                  <span style={{ position: 'relative', zIndex: 1 }}>{clip.name}</span>
                  {/* Resize handle right */}
                  {!readOnly && (
                    <div
                      style={{
                        position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
                        cursor: 'col-resize', zIndex: 2,
                      }}
                      onPointerDown={readOnly ? undefined : (e) => handleClipPointerDown(e, clip.id, 'resize-right')}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Lane>

        {/* Markers lane (always visible) */}
        <MarkersLane
          markers={markers}
          totalSec={totalSec}
          onSeek={onSeek}
          onUpdateMarker={onUpdateMarker}
          onDeleteMarker={onDeleteMarker}
          readOnly={readOnly}
        />

        {/* DAW track lanes */}
        {DAW_LANES.filter((l) => l.id !== 'sections').map((lane) => (
          <Lane key={lane.id} label={`${lane.emoji} ${lane.label}`}>
            <div data-lane-content style={{
              width: '100%', height: '100%', position: 'relative',
              background: 'var(--bg-surface-2)', borderTop: '1px solid var(--border-subtle)',
            }}>
              {localSections.filter((c) => c.lane === lane.id).map((clip) => {
                const left = totalSec > 0 ? (clip.startTime / totalSec) * 100 : 0;
                const width = totalSec > 0 ? (clip.duration / totalSec) * 100 : 0;
                const type = clip.type || parseSectionType(clip.name);
                return (
                  <div
                    key={clip.id}
                    style={{
                      position: 'absolute', left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
                      top: 2, bottom: 2, borderRadius: 3,
                      background: sectionColor(type), opacity: 0.8,
                      display: 'flex', alignItems: 'center', cursor: readOnly ? 'default' : 'grab',
                      fontSize: 10, color: '#fff', paddingLeft: 4, whiteSpace: 'nowrap',
                    }}
                    onPointerDown={readOnly ? undefined : (e) => handleClipPointerDown(e, clip.id, 'move')}
                  >
                    {!readOnly && (
                      <div
                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 2 }}
                        onPointerDown={(e) => handleClipPointerDown(e, clip.id, 'resize-left')}
                      />
                    )}
                    <span style={{ position: 'relative', zIndex: 1 }}>{clip.name}</span>
                    {!readOnly && (
                      <div
                        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 2 }}
                        onPointerDown={(e) => handleClipPointerDown(e, clip.id, 'resize-right')}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </Lane>
        ))}
      </div>

      {/* Screen-reader playhead announcement */}
      <div aria-live="polite" style={playheadSrOnlyStyle}>{announcement}</div>
    </div>
  );
};

export default AuditTimeline;
