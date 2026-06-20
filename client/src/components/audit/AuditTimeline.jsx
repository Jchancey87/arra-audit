import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { usePlayheadAnnouncer, playheadSrOnlyStyle } from '../../utils/playheadAnnouncer.js';

const LANE_HEIGHT = 40;
const LANE_LABEL_WIDTH = 110;

const formatTime = (s) => {
  const sec = Math.floor(s || 0);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const parseTime = (str) => {
  if (!str) return 0;
  if (typeof str === 'number') return str;
  const parts = String(str).split(':');
  if (parts.length === 2) {
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  }
  return parseFloat(str) || 0;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Section position estimation ───────────────────────────────────────────────
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
  for (const [key, bars] of Object.entries(SECTION_BAR_COUNTS)) {
    if (lower.includes(key)) return key;
  }
  return lower;
}

function estimateSectionPositions(candidates, beatTimes, beatsPerBar) {
  if (!candidates || candidates.length === 0) return [];
  if (!beatTimes || beatTimes.length < 4) {
    return candidates.map((_, i, arr) => ({
      label: _.section,
      key: _.key,
      scale: _.scale,
      start: (i / arr.length) * 240,
      end: ((i + 1) / arr.length) * 240,
    }));
  }
  const bpb = beatsPerBar || DEFAULT_BPB;
  const totalBars = Math.max(1, Math.floor(beatTimes.length / bpb));
  const barDurations = [];
  for (let i = 0; i < totalBars; i++) {
    const startBeat = beatTimes[i * bpb];
    const endBeat = beatTimes[Math.min((i + 1) * bpb, beatTimes.length - 1)];
    barDurations.push(endBeat - startBeat);
  }
  let barBudget = totalBars;
  const sectionBars = candidates.map((c) => {
    const type = parseSectionType(c.section);
    return SECTION_BAR_COUNTS[type] || DEFAULT_SECTION_BARS;
  });
  const totalSectionBars = sectionBars.reduce((a, b) => a + b, 0);
  const scale = Math.max(1, barBudget) / Math.max(1, totalSectionBars);
  const scaled = sectionBars.map((b) => Math.max(1, Math.round(b * scale)));
  let barCursor = 0;
  let timeCursor = 0;
  return candidates.map((c, i) => {
    const bars = scaled[i];
    const start = timeCursor;
    const barSlice = barDurations.slice(barCursor, barCursor + bars);
    const end = start + barSlice.reduce((a, b) => a + b, 0);
    barCursor += bars;
    timeCursor = end;
    return {
      label: c.section,
      key: c.key,
      scale: c.scale,
      start,
      end,
    };
  });
}

// ── Global playhead hook ──────────────────────────────────────────────────────
const useTimelinePlayhead = (containerRef, duration) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [containerRef]);
  const pct = duration > 0 && width > 0 ? (width > 0 ? 1 : 0) : 0;
  return { width, pct };
};

// ── Scrub state ───────────────────────────────────────────────────────────────
const useScrubState = (ref, duration, onSeek) => {
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubRatio, setScrubRatio] = useState(null);

  useEffect(() => {
    if (!scrubbing) return;
    const handleMove = (e) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const pct = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      setScrubRatio(pct);
    };
    const handleUp = (e) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const pct = clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      onSeek && onSeek(pct * (duration || 0));
      setScrubbing(false);
      setScrubRatio(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [scrubbing, duration, onSeek, ref]);

  return { scrubbing, scrubRatio, startScrub: () => setScrubbing(true) };
};

// ── Energy Curve Lane ─────────────────────────────────────────────────────────
const EnergyCurveLane = ({ curve, duration, currentTime, scrubPct, onScrubStart, laneRef }) => {
  const ref = useRef(null);
  const mergedRef = (el) => { ref.current = el; if (laneRef) laneRef.current = el; };
  const totalSec = duration || 1;
  const playPct = Math.min(100, Math.max(0, (currentTime / totalSec) * 100));
  const displayPct = scrubPct != null ? scrubPct * 100 : playPct;
  const data = curve && curve.length > 0 ? curve : [0.3];
  const barCount = Math.min(data.length, 120);

  const bars = useMemo(() => Array.from({ length: barCount }, (_, i) => {
    const idx = Math.floor((i / barCount) * data.length);
    const v = clamp(data[idx] || 0, 0, 1);
    const h = Math.max(2, v * (LANE_HEIGHT - 4));
    return (
      <div
        key={i}
        style={{
          flex: 1,
          height: `${h}px`,
          background: 'var(--accent-primary)',
          opacity: 0.35 + v * 0.35,
          minWidth: '1px',
        }}
      />
    );
  }), [data, barCount]);

  return (
    <div
      ref={mergedRef}
      onMouseDown={onScrubStart}
      style={{
        height: `${LANE_HEIGHT}px`,
        position: 'relative',
        cursor: 'pointer',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '1px',
      }}
      aria-label="Energy curve — click to seek"
      role="slider"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration || 0)}
      aria-valuenow={Math.round(currentTime || 0)}
    >
      {bars}
      {/* Playhead */}
      <div style={{
        position: 'absolute',
        left: `${displayPct}%`,
        top: 0,
        bottom: 0,
        width: '1px',
        background: 'var(--accent-primary)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />
    </div>
  );
};

// ── Beat Grid Lane ────────────────────────────────────────────────────────────
const BeatGridLane = ({ beats, downbeats, duration }) => {
  const totalSec = duration || 1;
  const markers = useMemo(() => (beats || []).map((t, i) => {
    const isDown = downbeats && downbeats.some((d) => Math.abs(d - t) < 0.05);
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: `${(t / totalSec) * 100}%`,
          top: isDown ? 0 : 6,
          bottom: 0,
          width: '1px',
          background: isDown ? 'var(--text-secondary)' : 'var(--text-tertiary)',
          opacity: isDown ? 0.5 : 0.25,
        }}
      />
    );
  }), [beats, downbeats, totalSec]);

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
      {markers}
    </div>
  );
};

// ── Key Regions Lane ──────────────────────────────────────────────────────────
const KeyRegionsLane = ({ regions, duration, currentTime }) => {
  const totalSec = duration || 1;
  const playPct = (currentTime / totalSec) * 100;
  if (!regions || regions.length === 0) return null;

  return (
    <div
      style={{
        height: '18px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
      }}
      aria-label="Key regions"
    >
      {regions.map((r, i) => {
        const left = clamp((r.start / totalSec) * 100, 0, 100);
        const width = clamp(((r.end - r.start) / totalSec) * 100, 0.5, 100);
        const active = playPct >= left && playPct <= left + width;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left}%`,
              width: `${width}%`,
              top: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: '2px',
              borderLeft: '1px solid var(--border-subtle)',
              background: active ? 'rgba(255,255,255,0.04)' : 'transparent',
              fontSize: '9px',
              fontFamily: 'JetBrains Mono, monospace',
              color: active ? 'var(--status-success)' : 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={`${r.label}: ${r.key}${r.scale === 'minor' ? 'm' : ''}`}
          >
            {r.key}{r.scale === 'minor' ? 'm' : ''}
            {width > 4 && ` · ${r.label}`}
          </div>
        );
      })}
    </div>
  );
};

// ── Markers Lane ──────────────────────────────────────────────────────────────
const MarkersLane = ({ markers, duration, onMarkerClick, onUpdateMarker, onDeleteMarker }) => {
  const totalSec = duration || 1;
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const closeMenu = useCallback(() => {
    setOpenMenuId(null);
    setRenamingId(null);
    setRenameValue('');
  }, []);

  const handleContextMenu = useCallback((e, m) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(m._id || m.id);
  }, []);

  const menuRef = useRef(null);
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    const id = setTimeout(() => document.addEventListener('click', handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('click', handler);
    };
  }, [openMenuId, closeMenu]);

  const handleRenameStart = useCallback((m) => {
    setRenamingId(m._id || m.id);
    setRenameValue(m.label || '');
  }, []);

  const handleRenameSubmit = useCallback((m) => {
    const id = m._id || m.id;
    if (onUpdateMarker) onUpdateMarker(id, { label: renameValue.trim() });
    closeMenu();
  }, [renameValue, onUpdateMarker, closeMenu]);

  const handleDelete = useCallback((m) => {
    const id = m._id || m.id;
    if (onDeleteMarker) onDeleteMarker(id);
    closeMenu();
  }, [onDeleteMarker, closeMenu]);

  const handleKeyDown = useCallback((e, m) => {
    if (e.key === 'Enter') handleRenameSubmit(m);
    else if (e.key === 'Escape') closeMenu();
  }, [handleRenameSubmit, closeMenu]);

  return (
    <div
      style={{
        height: '12px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'visible',
      }}
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
              title={`${formatTime(ts)} · ${m.label || 'untitled'}${m.lens ? ` · ${m.lens}` : ''}`}
            />
            {openMenuId === id && (
              <div
                ref={menuRef}
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
                      onKeyDown={(e) => handleKeyDown(e, m)}
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
                    <button onClick={() => handleRenameStart(m)} className="ghost" style={{ fontSize: '10px', textAlign: 'left', padding: '4px 6px' }}>
                      Rename
                    </button>
                    <button onClick={() => handleDelete(m)} className="ghost" style={{ fontSize: '10px', textAlign: 'left', padding: '4px 6px', color: 'var(--color-error)' }}>
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

// ── Lane wrapper ──────────────────────────────────────────────────────────────
const Lane = ({ label, children, borderless }) => (
  <div style={{ display: 'flex', alignItems: 'stretch', borderBottom: borderless ? 'none' : '1px solid var(--border-subtle)' }}>
    <div
      className="audit-lane-label"
      style={{
        width: `${LANE_LABEL_WIDTH}px`,
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
        flexShrink: 0,
        boxSizing: 'border-box',
      }}
    >
      {label}
    </div>
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>{children}</div>
  </div>
);

// ── Predefined DAW Track lanes ────────────────────────────────────────────────
const DAW_LANES = [
  { id: 'arrangement', label: 'Sections', color: 'var(--accent-primary)', emoji: '🎼' },
  { id: 'vocals', label: 'Vocals', color: '#35d777', emoji: '🎤' },
  { id: 'synths', label: 'Synths/Keys', color: '#9b59b6', emoji: '🎹' },
  { id: 'guitars', label: 'Guitars', color: '#1abc9c', emoji: '🎸' },
  { id: 'bass', label: 'Bass', color: '#e67e22', emoji: '🎻' },
  { id: 'drums', label: 'Drums', color: '#e74c3c', emoji: '🥁' },
];

// ── Main AuditTimeline component ──────────────────────────────────────────────
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
  const containerRef = useRef(null);
  const scrubBarRef = useRef(null);
  const [showEnergy, setShowEnergy] = useState(defaultShowEnergy);
  const [showBeatGrid, setShowBeatGrid] = useState(defaultShowBeatGrid);
  const [showKeyRegions, setShowKeyRegions] = useState(defaultShowKeyRegions);

  const { scrubRatio, startScrub } = useScrubState(scrubBarRef, duration, onSeek);
  const [showScrubTooltip, setShowScrubTooltip] = useState(false);
  const [tooltipMounted, setTooltipMounted] = useState(false);
  const playheadAnnouncement = usePlayheadAnnouncer(currentTime, duration);

  // ── Drag and Resize State ──
  const [dragState, setDragState] = useState(null);
  const [editingClip, setEditingClip] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    type: 'verse',
    lane: 'arrangement',
    startTimeStr: '0:00',
    duration: 16,
    notes: '',
  });

  const totalSec = duration || song?.durationSeconds || 0;

  useEffect(() => {
    setShowScrubTooltip(scrubRatio != null);
  }, [scrubRatio]);

  useEffect(() => {
    if (showScrubTooltip) {
      const id = requestAnimationFrame(() => setTooltipMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setTooltipMounted(false);
    return undefined;
  }, [showScrubTooltip]);

  if (!song) return null;

  const analysis = song.audioAnalysis || {};
  const overrides = song.audioOverrides || {};
  const beatsPerBar = overrides.estimated_meter === '3/4' ? 3 : overrides.estimated_meter === '6/8' ? 6 : 4;

  // Key regions from sectional_key_candidates + beat grid
  const keyRegions = useMemo(
    () => estimateSectionPositions(
      analysis.sectional_key_candidates,
      analysis.beat_times,
      beatsPerBar,
    ),
    [analysis.sectional_key_candidates, analysis.beat_times, beatsPerBar],
  );

  // Overall key fallback
  const overallKey = analysis.key ? `${analysis.key}${analysis.scale === 'minor' ? 'm' : ''}` : null;

  // Map and sync flat display clips (with backwards compatibility)
  const displayClips = useMemo(() => {
    const rawClips = arrangementSections && arrangementSections.length > 0
      ? arrangementSections
      : keyRegions.map((r) => ({
          id: `analytical-${r.label}`,
          name: r.label,
          type: parseSectionType(r.label),
          startTime: r.start,
          duration: r.end - r.start,
          analytical: true,
        }));

    return rawClips.map((c) => ({
      ...c,
      lane: c.lane || 'arrangement',
    }));
  }, [arrangementSections, keyRegions]);

  const [localSections, setLocalSections] = useState([]);

  useEffect(() => {
    if (!dragState && !editingClip) {
      setLocalSections(displayClips);
    }
  }, [displayClips, dragState, editingClip]);

  const waveData = useMemo(() => analysis.energy_curve || analysis.waveform_peaks || [0.3], [analysis]);
  const seekBars = useMemo(() => {
    const seekBarCount = 80;
    return Array.from({ length: seekBarCount }, (_, i) => {
      const idx = Math.floor((i / seekBarCount) * waveData.length);
      const v = clamp(waveData[idx] || 0, 0, 1);
      const h = Math.max(2, v * 16);
      return (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}px`,
            background: 'var(--accent-primary)',
            opacity: 0.2 + v * 0.3,
            minWidth: '1px',
          }}
        />
      );
    });
  }, [waveData]);

  const displayPct = scrubRatio != null ? scrubRatio * 100 : (totalSec > 0 ? (currentTime / totalSec) * 100 : 0);

  // ── Drag and Resize Actions ──
  const handleMouseDown = useCallback((e, clip, action) => {
    e.preventDefault();
    e.stopPropagation();
    if (readOnly) return;

    setDragState({
      clipId: clip.id || clip._id,
      action,
      initialStartTime: clip.startTime ?? clip.start ?? 0,
      initialDuration: clip.duration ?? (clip.end ? clip.end - (clip.startTime ?? clip.start) : 30),
      initialX: e.clientX,
    });
  }, [readOnly]);

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const trackWidth = rect.width - LANE_LABEL_WIDTH;
      if (trackWidth <= 0) return;

      const deltaX = e.clientX - dragState.initialX;
      const deltaSecs = (deltaX / trackWidth) * totalSec;

      setLocalSections((prev) => {
        return prev.map((c) => {
          const cid = c.id || c._id;
          if (cid !== dragState.clipId) return c;

          let start = c.startTime ?? c.start ?? 0;
          let dur = c.duration ?? 30;

          if (dragState.action === 'move') {
            start = Math.max(0, Math.min(totalSec - dragState.initialDuration, dragState.initialStartTime + deltaSecs));
          } else if (dragState.action === 'resize-left') {
            const possibleStart = Math.max(0, dragState.initialStartTime + deltaSecs);
            const clampedStart = Math.min(dragState.initialStartTime + dragState.initialDuration - 0.5, possibleStart);
            dur = dragState.initialStartTime + dragState.initialDuration - clampedStart;
            start = clampedStart;
          } else if (dragState.action === 'resize-right') {
            dur = Math.max(0.5, Math.min(totalSec - dragState.initialStartTime, dragState.initialDuration + deltaSecs));
          }

          return {
            ...c,
            startTime: start,
            duration: dur,
            start,
            end: start + dur,
          };
        });
      });
    };

    const handleMouseUp = (e) => {
      const deltaX = Math.abs(e.clientX - dragState.initialX);
      if (deltaX < 3) {
        // Simple click -> open settings editor
        const clickedClip = localSections.find(c => (c.id || c._id) === dragState.clipId);
        if (clickedClip) {
          setEditingClip(clickedClip);
          const start = clickedClip.startTime ?? clickedClip.start ?? 0;
          setEditForm({
            name: clickedClip.name || '',
            type: clickedClip.type || 'verse',
            lane: clickedClip.lane || 'arrangement',
            startTimeStr: formatTime(start),
            duration: Math.max(1, Math.floor(clickedClip.duration ?? 16)),
            notes: clickedClip.notes || '',
          });
        }
      } else {
        // Save dragged changes back
        setLocalSections((latestSections) => {
          if (onUpdateSections) {
            onUpdateSections(latestSections);
          }
          return latestSections;
        });
      }
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, totalSec, onUpdateSections, localSections]);

  // ── Clip Add / Edit / Delete Helpers ──
  const handleAddClip = useCallback((laneId) => {
    const start = currentTime || 0;
    const defaultDur = 16;

    const newClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: '',
      type: laneId === 'arrangement' ? 'verse' : 'custom',
      startTime: Math.max(0, Math.floor(start)),
      duration: defaultDur,
      lane: laneId,
      notes: '',
      isNew: true,
    };

    setEditingClip(newClip);
    setEditForm({
      name: '',
      type: laneId === 'arrangement' ? 'verse' : 'custom',
      lane: laneId,
      startTimeStr: formatTime(start),
      duration: defaultDur,
      notes: '',
    });
  }, [currentTime]);

  const handleSaveClipEdit = useCallback(() => {
    if (!editingClip) return;
    if (!editForm.name.trim()) return; // Validation: name must not be empty!

    const start = parseTime(editForm.startTimeStr);
    const dur = editForm.duration;

    if (editingClip.isNew) {
      if (onAddSection && editingClip.lane === 'arrangement') {
        onAddSection({ name: editForm.name || 'New Section', start });
      } else {
        const fullClip = {
          ...editingClip,
          name: editForm.name || 'New Clip',
          type: editForm.type,
          lane: editForm.lane,
          startTime: start,
          duration: dur,
          start,
          end: start + dur,
          notes: editForm.notes,
          isNew: false,
          analytical: false,
        };
        const updated = [...localSections, fullClip].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
        setLocalSections(updated);
        if (onUpdateSections) {
          onUpdateSections(updated);
        }
      }
    } else {
      const cid = editingClip.id || editingClip._id;
      const updated = localSections.map((c) => {
        const id = c.id || c._id;
        if (id !== cid) return c;
        return {
          ...c,
          name: editForm.name || 'Clip',
          type: editForm.type,
          lane: editForm.lane,
          startTime: start,
          duration: dur,
          start,
          end: start + dur,
          notes: editForm.notes,
          analytical: false,
        };
      });
      setLocalSections(updated);
      if (onUpdateSections) {
        onUpdateSections(updated);
      }
    }

    setEditingClip(null);
  }, [editingClip, editForm, onUpdateSections, onAddSection, localSections]);

  const handleDeleteClip = useCallback(() => {
    if (!editingClip) return;
    const cid = editingClip.id || editingClip._id;

    const updated = localSections.filter((c) => (c.id || c._id) !== cid);
    setLocalSections(updated);
    if (onUpdateSections) {
      onUpdateSections(updated);
    }

    setEditingClip(null);
  }, [editingClip, onUpdateSections, localSections]);

  return (
    <section
      ref={containerRef}
      role="region"
      aria-label="Song timeline with energy curve, beat grid, key regions, and section markers"
      style={{ marginTop: '16px', position: 'relative' }}
    >
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
          {/* Lane Toggles */}
          <div
            style={{
              display: 'inline-flex',
              gap: '4px',
              background: 'var(--bg-surface-3)',
              padding: '2px',
              borderRadius: '4px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setShowEnergy(!showEnergy)}
              className="ghost"
              style={{
                fontSize: '9px',
                padding: '2px 8px',
                borderRadius: '3px',
                color: showEnergy ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                background: showEnergy ? 'var(--bg-surface-1)' : 'transparent',
                fontWeight: showEnergy ? 'bold' : 'normal',
                cursor: 'pointer',
              }}
              title="Toggle Energy waveform lane"
            >
              Waveform
            </button>
            <button
              type="button"
              onClick={() => setShowBeatGrid(!showBeatGrid)}
              className="ghost"
              style={{
                fontSize: '9px',
                padding: '2px 8px',
                borderRadius: '3px',
                color: showBeatGrid ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                background: showBeatGrid ? 'var(--bg-surface-1)' : 'transparent',
                fontWeight: showBeatGrid ? 'bold' : 'normal',
                cursor: 'pointer',
              }}
              title="Toggle vertical beat grid lines"
            >
              Beats
            </button>
            <button
              type="button"
              onClick={() => setShowKeyRegions(!showKeyRegions)}
              className="ghost"
              style={{
                fontSize: '9px',
                padding: '2px 8px',
                borderRadius: '3px',
                color: showKeyRegions ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                background: showKeyRegions ? 'var(--bg-surface-1)' : 'transparent',
                fontWeight: showKeyRegions ? 'bold' : 'normal',
                cursor: 'pointer',
              }}
              title="Toggle Key regions lane"
            >
              Keys
            </button>
          </div>

          {onAddSection && !readOnly && (
            <button
              type="button"
              onClick={() => handleAddClip('arrangement')}
              className="ghost"
              style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}
            >
              + Section
            </button>
          )}

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
            {formatTime(currentTime)} / {formatTime(totalSec)}
          </span>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={playheadSrOnlyStyle}
          >
            {playheadAnnouncement}
          </div>
        </div>
      </div>

      {/* Lanes container */}
      <div
        style={{
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border-subtle)',
          position: 'relative',
        }}
      >
        {/* Vertical Beat Grid Overlay */}
        {showBeatGrid && analysis.beat_times && (
          <div
            style={{
              position: 'absolute',
              left: `${LANE_LABEL_WIDTH}px`,
              right: 0,
              top: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 1,
              overflow: 'hidden',
            }}
          >
            {analysis.beat_times.map((t, i) => {
              const isDown = analysis.downbeat_times && analysis.downbeat_times.some((d) => Math.abs(d - t) < 0.05);
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${(t / totalSec) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    borderLeft: isDown
                      ? '1px dashed rgba(255, 255, 255, 0.12)'
                      : '1px dotted rgba(255, 255, 255, 0.04)',
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Global playhead */}
        <div
          style={{
            position: 'absolute',
            left: `${LANE_LABEL_WIDTH}px`,
            right: 0,
            top: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 8,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${displayPct}%`,
              top: 0,
              bottom: 0,
              width: '1px',
              background: 'var(--accent-primary)',
              boxShadow: '0 0 4px rgba(255,255,255,0.15)',
            }}
          />
        </div>

        {/* Seek / Playhead Scrubber Track */}
        <Lane label="Seek">
          <div
            ref={scrubBarRef}
            onMouseDown={startScrub}
            style={{
              height: '24px',
              position: 'relative',
              background: 'var(--bg-surface-1)',
              cursor: 'pointer',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '1px',
              padding: '0 2px',
            }}
            aria-label="Seek track"
          >
            {/* Subtle Waveform Backdrop */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 2,
                bottom: 2,
                display: 'flex',
                alignItems: 'flex-end',
                gap: '1px',
                opacity: 0.15,
                pointerEvents: 'none',
              }}
            >
              {seekBars}
            </div>

            {/* Time progress background */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                width: `${displayPct}%`,
                top: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.04)',
                borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </Lane>

        {/* Optional Energy Waveform Lane */}
        {showEnergy && (
          <Lane label="Energy">
            <EnergyCurveLane
              curve={analysis.energy_curve || analysis.waveform_peaks}
              duration={totalSec}
              currentTime={currentTime}
              scrubPct={scrubRatio}
              onScrubStart={startScrub}
              laneRef={scrubBarRef}
            />
          </Lane>
        )}

        {/* Optional Beat Grid Lane */}
        {showBeatGrid && (
          <Lane label="Beat Grid">
            <div onMouseDown={startScrub} style={{ height: '100%', cursor: 'pointer' }}>
              <BeatGridLane
                beats={analysis.beat_times}
                downbeats={analysis.downbeat_times}
                duration={totalSec}
              />
            </div>
          </Lane>
        )}

        {/* Optional Key Regions Lane */}
        {showKeyRegions && keyRegions.length > 0 && (
          <Lane label="Key">
            <div onMouseDown={startScrub} style={{ height: '100%', cursor: 'pointer' }}>
              <KeyRegionsLane regions={keyRegions} duration={totalSec} currentTime={currentTime} />
            </div>
          </Lane>
        )}

        {/* Optional Overall Key Fallback */}
        {showKeyRegions && keyRegions.length === 0 && overallKey && (
          <Lane label="Key">
            <div onMouseDown={startScrub} style={{ height: '100%', cursor: 'pointer' }}>
              <div
                style={{
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: '4px',
                  fontSize: '9px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--status-success)',
                  background: 'var(--bg-surface-1)',
                }}
              >
                {overallKey}
              </div>
            </div>
          </Lane>
        )}

        {/* DAW Track Lanes */}
        {DAW_LANES.map((lane, lIdx) => {
          const laneClips = localSections.filter((c) => (c.lane || 'arrangement') === lane.id);
          return (
            <Lane
              key={lane.id}
              label={
                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <span style={{ fontSize: '11px', marginRight: '4px' }}>{lane.emoji}</span>
                  <span style={{ flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{lane.label}</span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleAddClip(lane.id); }}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: 'none',
                        borderRadius: '3px',
                        color: 'var(--text-secondary)',
                        fontSize: '9px',
                        padding: '1px 4px',
                        cursor: 'pointer',
                        marginLeft: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                      }}
                      title={`Add clip to ${lane.label}`}
                    >
                      +
                    </button>
                  )}
                </div>
              }
              borderless={lIdx === DAW_LANES.length - 1}
            >
              <div
                style={{
                  height: `${LANE_HEIGHT}px`,
                  position: 'relative',
                  background: 'var(--bg-surface-1)',
                  overflow: 'hidden',
                  cursor: dragState ? (dragState.action === 'move' ? 'grabbing' : 'col-resize') : 'default',
                }}
              >
                {laneClips.map((s, i) => {
                  const start = s.startTime ?? s.start ?? 0;
                  const dur = s.duration ?? (s.end ? s.end - start : 30);
                  const end = start + dur;
                  const left = clamp((start / totalSec) * 100, 0, 100);
                  const width = clamp((dur / totalSec) * 100, 0.5, 100);
                  const typeColor = {
                    intro: 'var(--status-info)',
                    verse: 'var(--accent-primary)',
                    chorus: 'var(--status-success)',
                    bridge: 'var(--status-warning)',
                    prechorus: 'var(--text-tertiary)',
                    outro: 'var(--status-error)',
                    solo: '#9b59b6',
                    breakdown: '#1abc9c',
                    interlude: '#e67e22',
                  };
                  const color = typeColor[s.type] || 'var(--bg-surface-3)';
                  const active = currentTime >= start && currentTime < end;

                  return (
                    <div
                      key={s.id || s._id || i}
                      onMouseDown={(e) => {
                        if (readOnly) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const mouseX = e.clientX - rect.left;
                        let action = 'move';
                        if (mouseX < 8) {
                          action = 'resize-left';
                        } else if (rect.width - mouseX < 8) {
                          action = 'resize-right';
                        }
                        handleMouseDown(e, s, action);
                      }}
                      style={{
                        position: 'absolute',
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 2,
                        bottom: 2,
                        background: color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontFamily: 'JetBrains Mono, monospace',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        cursor: readOnly ? 'pointer' : (dragState?.clipId === (s.id || s._id) ? (dragState.action === 'move' ? 'grabbing' : 'col-resize') : 'grab'),
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        padding: '0 8px',
                        borderRadius: '3px',
                        border: active ? '1px solid #fff' : '1px solid rgba(0,0,0,0.15)',
                        boxShadow: active ? '0 0 8px rgba(255,255,255,0.2)' : 'none',
                        userSelect: 'none',
                        zIndex: active ? 3 : 1,
                      }}
                      title={`${s.name || s.type || 'Clip'} · ${formatTime(start)} - ${formatTime(end)}`}
                    >
                      {/* Left resize handle cursor overlay */}
                      {!readOnly && (
                        <div style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: '6px',
                          cursor: 'col-resize',
                          zIndex: 4
                        }} />
                      )}

                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.name || s.type || '?'}
                      </span>

                      {/* Right resize handle cursor overlay */}
                      {!readOnly && (
                        <div style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '6px',
                          cursor: 'col-resize',
                          zIndex: 4
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </Lane>
          );
        })}

        {/* Markers Lane */}
        <Lane label="Markers" borderless>
          <div onMouseDown={startScrub} style={{ height: '100%', cursor: 'pointer', position: 'relative' }}>
            <MarkersLane
              markers={markers}
              duration={totalSec}
              onMarkerClick={(m) => onSeek && onSeek(m.timestampSeconds ?? m.time ?? 0)}
              onUpdateMarker={onUpdateMarker}
              onDeleteMarker={onDeleteMarker}
            />
          </div>
        </Lane>

        {/* Scrub tooltip */}
        {showScrubTooltip && scrubRatio != null && scrubBarRef.current && (() => {
          const frameWidth = scrubBarRef.current.getBoundingClientRect().width || 1;
          const timeAtX = scrubRatio * (totalSec || 0);
          const bpm = overrides.tempo_bpm || analysis.tempo_bpm;
          const beatSec = bpm && bpm > 0 ? 60 / bpm : null;
          let content = formatTime(timeAtX);
          if (beatSec) {
            const barNumber = Math.floor(timeAtX / (beatSec * beatsPerBar)) + 1;
            const totalBars = Math.max(1, Math.floor(totalSec / (beatSec * beatsPerBar)));
            content = `${formatTime(timeAtX)} · bar ${barNumber}/${totalBars}`;
          }
          const tooltipLeft = scrubRatio * frameWidth + 4;
          return (
            <div
              style={{
                position: 'absolute',
                left: `${LANE_LABEL_WIDTH + tooltipLeft}px`,
                top: 4,
                background: 'var(--bg-surface-3)',
                color: 'var(--text-primary)',
                fontSize: '10px',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '2px 6px',
                pointerEvents: 'none',
                zIndex: 9,
                border: '1px solid var(--border-subtle)',
                opacity: tooltipMounted ? 1 : 0,
                transition: 'opacity 100ms ease-in',
                whiteSpace: 'nowrap',
              }}
            >
              {content}
            </div>
          );
        })()}
      </div>

      {/* Clip Edit Modal */}
      {editingClip && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveClipEdit();
            }}
            style={{
              background: 'var(--bg-surface-3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              padding: '20px',
              width: '340px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-primary)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              {editingClip.isNew ? 'Add New Clip' : 'Edit Clip Settings'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Clip Name</label>
              <input
                autoFocus
                placeholder="Section name"
                value={editForm.name}
                onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Section Color Type</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm(p => ({ ...p, type: e.target.value }))}
                  style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12px' }}
                >
                  <option value="intro">Intro</option>
                  <option value="verse">Verse</option>
                  <option value="chorus">Chorus</option>
                  <option value="bridge">Bridge</option>
                  <option value="outro">Outro</option>
                  <option value="solo">Solo</option>
                  <option value="breakdown">Breakdown</option>
                  <option value="interlude">Interlude</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Track Lane</label>
                <select
                  value={editForm.lane}
                  onChange={(e) => setEditForm(p => ({ ...p, lane: e.target.value }))}
                  style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '6px 8px', color: '#fff', fontSize: '12px' }}
                >
                  {DAW_LANES.map(l => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Start Time</label>
                <input
                  placeholder="0:00"
                  value={editForm.startTimeStr}
                  onChange={(e) => setEditForm(p => ({ ...p, startTimeStr: e.target.value }))}
                  aria-label="Section start time"
                  style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Duration (s)</label>
                <input
                  type="number"
                  min="0.5"
                  max={totalSec}
                  value={editForm.duration}
                  onChange={(e) => setEditForm(p => ({ ...p, duration: parseFloat(e.target.value) || 16 }))}
                  style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Notes / Details</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))}
                style={{ background: 'var(--bg-surface-1)', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '6px 10px', color: '#fff', fontSize: '12px', minHeight: '60px', resize: 'vertical' }}
                placeholder="e.g. Chord changes, observations"
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <div>
                {!editingClip.isNew && (
                  <button
                    type="button"
                    onClick={handleDeleteClip}
                    style={{ background: 'transparent', border: 'none', color: 'var(--status-error)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    Delete Clip
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setEditingClip(null)}
                  className="ghost"
                  style={{ padding: '6px 12px', fontSize: '11px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={handleSaveClipEdit}
                  className="primary"
                  style={{ padding: '6px 16px', fontSize: '11px', background: 'var(--accent-primary)', border: 'none', color: '#fff' }}
                >
                  {editingClip.isNew ? 'Add' : 'Save'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};

export default AuditTimeline;
