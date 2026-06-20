import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { usePlayheadAnnouncer, playheadSrOnlyStyle } from '../../utils/playheadAnnouncer.js';

const LANE_HEIGHT = 40;
const LANE_LABEL_WIDTH = 80;

const formatTime = (s) => {
  const sec = Math.floor(s || 0);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
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

// ── Sections Lane ─────────────────────────────────────────────────────────────
const SectionsLane = ({ sections, duration, currentTime, onSectionClick, onAddSection }) => {
  const totalSec = duration || 1;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');

  const startAdd = useCallback(() => {
    setName('');
    setStartTime(formatTime(currentTime || 0));
    setAdding(true);
  }, [currentTime]);

  const submit = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return;
    const [m, s] = startTime.split(':').map((n) => parseInt(n, 10) || 0);
    const startSeconds = m * 60 + s;
    if (onAddSection) onAddSection({ name: name.trim(), start: startSeconds });
    setAdding(false);
    setName('');
  }, [name, startTime, onAddSection]);

  const cancel = useCallback((e) => {
    e?.stopPropagation?.();
    setAdding(false);
    setName('');
  }, []);

  const sorted = useMemo(
    () => [...(sections || [])].sort((a, b) => (a.startTime || a.start || 0) - (b.startTime || b.start || 0)),
    [sections],
  );

  return (
    <div
      style={{
        height: adding ? '52px' : '22px',
        position: 'relative',
        background: 'var(--bg-surface-1)',
        overflow: 'hidden',
        transition: 'height 0.15s ease',
      }}
    >
      {sorted.map((s, i) => {
        const start = s.startTime ?? s.start ?? 0;
        const dur = s.duration ?? (s.end ? s.end - start : 30);
        const end = start + dur;
        const left = clamp((start / totalSec) * 100, 0, 100);
        const width = clamp(((end - start) / totalSec) * 100, 1, 100);
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
        return (
          <div
            key={s.id || i}
            onClick={() => onSectionClick && onSectionClick(s)}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: `${left}%`,
              width: `${width}%`,
              top: 2,
              bottom: 2,
              background: typeColor[s.type] || 'var(--bg-surface-3)',
              color: '#fff',
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
              borderRadius: '2px',
            }}
            title={`${s.name || s.type || 'Section'} · ${formatTime(start)} - ${formatTime(end)}`}
          >
            {s.name || s.type || '?'}
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

  // Close context menu on outside click (native DOM listener to catch
  // clicks outside React's event delegation root)
  const menuRef = useRef(null);
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    // Use setTimeout to avoid closing on the same click that opened the menu
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
      }}
    >
      {label}
    </div>
    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>{children}</div>
  </div>
);

// ── Main AuditTimeline component ──────────────────────────────────────────────
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
  const totalSec = duration || song.durationSeconds || 0;
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

  // Merge arrangement sections with key region labels
  const displaySections = useMemo(() => {
    if (arrangementSections && arrangementSections.length > 0) return arrangementSections;
    if (!keyRegions || keyRegions.length === 0) return [];
    return keyRegions.map((r) => ({
      id: `analytical-${r.label}`,
      name: r.label,
      type: parseSectionType(r.label),
      startTime: r.start,
      duration: r.end - r.start,
      analytical: true,
    }));
  }, [arrangementSections, keyRegions]);

  const waveData = useMemo(() => analysis.energy_curve || analysis.waveform_peaks || [0.3], [analysis]);
  const seekBars = useMemo(() => {
    const seekBarCount = 80;
    return Array.from({ length: seekBarCount }, (_, i) => {
      const idx = Math.floor((i / seekBarCount) * waveData.length);
      const v = clamp(waveData[idx] || 0, 0, 1);
      const h = Math.max(2, v * 16); // 16px max height
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
  const hasSections = displaySections.length > 0;

  return (
    <section
      ref={containerRef}
      role="region"
      aria-label="Song timeline with energy curve, beat grid, key regions, and section markers"
      style={{ marginTop: '16px' }}
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
        {/* Vertical Beat Grid Overlay (Background grid lines) */}
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

        {/* Seek / Playhead Scrubber Track (Always visible at the top) */}
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

        {/* Optional Overall Key Fallback (when no sectional candidates) */}
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

        {/* Sections Lane */}
        <Lane label="Sections" borderless={!hasSections}>
          <SectionsLane
            sections={displaySections}
            duration={totalSec}
            currentTime={currentTime}
            onAddSection={!readOnly && onAddSection ? onAddSection : null}
          />
        </Lane>

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
    </section>
  );
};

export default AuditTimeline;
