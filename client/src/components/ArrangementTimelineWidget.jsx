import React, { useState, useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { usePlayheadAnnouncer, playheadSrOnlyStyle } from '../utils/playheadAnnouncer.js';
import { applyBlockClick, detectModifier, pruneSelection } from '../utils/blockSelection.js';
import ExportArrangementButton from './ExportArrangementButton.jsx';

// ── Section type colors ──────────────────────────────────────────────────────
const TYPE_COLORS = {
  intro:        '#a78bfa',  // soft violet
  verse:        '#34d399',  // emerald
  chorus:       '#22d3ee',  // bright teal / cyan
  bridge:       '#fbbf24',  // amber
  outro:        '#ffd700',  // soft gold
  'pre-chorus': '#ff6f61',  // bright coral
  solo:         '#ff6600',  // orange
  custom:       '#f472b6',  // pink
};

// ── Instrument track categories & defaults ───────────────────────────────────
const TRACK_CATEGORIES = {
  vocals:  { color: '#a78bfa', code: 'VOC', emoji: '🎤', label: 'Vocals'    },
  rhythm:  { color: '#34d399', code: 'DRM', emoji: '🥁', label: 'Rhythm'    },
  bass:    { color: '#fbbf24', code: 'BAS', emoji: '🎸', label: 'Bass'      },
  synth:   { color: '#22d3ee', code: 'SYN', emoji: '🎹', label: 'Synth'     },
  guitar:  { color: '#fb7185', code: 'GTR', emoji: '🎸', label: 'Guitar'    },
  brass:   { color: '#f97316', code: 'BRS', emoji: '🎺', label: 'Brass'     },
  strings: { color: '#f472b6', code: 'STR', emoji: '🎻', label: 'Strings'   },
  fx:      { color: '#9ca3af', code: 'SFX', emoji: '✨', label: 'FX / Other' },
};

// ── Layout constants ─────────────────────────────────────────────────────────

const GUTTER_W      = 140;  // left label column width (px)
const SECTION_ROW_H = 114;  // height of the sections row
const TRACK_ROW_H   = 46;   // height of each instrument track lane

// ── Bar / beat utilities (4/4 time assumed) ──────────────────────────────────
const barDurSecs  = (bpm) => (60 / bpm) * 4;
const secToBar    = (sec, bpm) => Math.floor(sec / barDurSecs(bpm)) + 1;
const barToSec    = (bar, bpm) => (bar - 1) * barDurSecs(bpm);
const snapDurBars = (sec, bpm) => {
  const bd = barDurSecs(bpm);
  return Math.max(bd, Math.round(sec / bd) * bd);
};
const snapStartBars = (sec, bpm) => {
  const bd = barDurSecs(bpm);
  return Math.max(0, Math.round(sec / bd) * bd);
};

// ── Auto-expanding observations textarea ─────────────────────────────────────
const AutoExpandingTextarea = ({ value, onChange, placeholder, disabled }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.height = 'auto';
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%', minHeight: '70px', maxHeight: '260px',
        background: '#161619', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '4px', padding: '10px 12px', color: '#ffffff',
        fontSize: '14px', lineHeight: '1.5', resize: 'none', outline: 'none',
        overflowY: 'auto', fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    />
  );
};

const ContextMenuItem = ({ onClick, children, style = {} }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        background: hover ? 'rgba(255, 102, 0, 0.15)' : 'none',
        border: 'none',
        padding: '8px 16px',
        color: hover ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
        fontSize: '12px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        fontFamily: '"Roboto Mono", monospace',
        transition: 'background 0.15s, color 0.15s',
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const ArrangementTimelineWidget = ({ responses, onChange, song, lensData, readOnly = false, saveNow }) => {
  const { loadSong, activeSong, play, seekTo, currentTime } = useAudio();

  // ── Zoom & Time signature states ──
  const [pxPerSec, setPxPerSec] = useState(6);
  const [timeSignature, setTimeSignature] = useState('4/4');

  const getBeatsPerBar = () => {
    if (timeSignature === '3/4') return 3;
    if (timeSignature === '6/8') return 3; // 6/8 represented with 3 beats for simplified grid mapping
    return 4;
  };

  const barDurSecs  = (bpm) => (60 / bpm) * getBeatsPerBar();
  const secToBar    = (sec, bpm) => Math.floor(sec / barDurSecs(bpm)) + 1;
  const barToSec    = (bar, bpm) => (bar - 1) * barDurSecs(bpm);
  const snapDurBars = (sec, bpm) => {
    const bd = barDurSecs(bpm);
    return Math.max(bd, Math.round(sec / bd) * bd);
  };
  const snapStartBars = (sec, bpm) => {
    const bd = barDurSecs(bpm);
    return Math.max(0, Math.round(sec / bd) * bd);
  };

  // ── Context menu & dragged section states ──
  const [contextMenu, setContextMenu] = useState(null); // { x, y, type, data }
  const [draggedSection, setDraggedSection] = useState(null);
  const [draggedSectionPosition, setDraggedSectionPosition] = useState({ x: 0, y: 0 });

  // ── Sync refs with latest state to prevent stale closures ──
  const blocksRef = useRef([]);
  const tracksRef = useRef([]);
  const selectedBlockIdRef = useRef(null);
  const multiSelectedIdsRef = useRef(new Set());
  const selectedTrackBlockRef = useRef(null);

  // ── Drag & Resize Refs for Canvas ──
  const canvasRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragStartInfoRef = useRef(null);

  // ── Dismiss context menu on click or scroll anywhere ──
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  // ── Existing section state ──
  const [selectedBlockId, setSelectedBlockId]   = useState(null);
  const [showAdvanced,    setShowAdvanced]       = useState(false);

  // ── Multi-select (bulk delete) ──
  // Independent from `selectedBlockId` (single-click inspector). Plain
  // click keeps the old single-select behavior; cmd/ctrl-click + shift
  // + click drive the multi-select. Esc clears the multi-selection.
  const [multiSelectedIds, setMultiSelectedIds] = useState(() => new Set());
  const lastClickedIdRef = useRef(null);

  // ── BPM + view mode ──
  const [bpm, setBpmState] = useState(() => {
    const saved = responses['arrangement-bpm'];
    return saved ? parseInt(saved, 10) : (song?.bpm || 120);
  });
  const [viewMode, setViewModeState] = useState(
    () => responses['arrangement-view-mode'] || 'seconds'
  );

  // ── Instrument tracks ──
  const [tracks, setTracks] = useState(() => {
    const raw = responses['arrangement-tracks'];
    try { return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []; }
    catch { return []; }
  });
  const [showAddTrack,      setShowAddTrack]      = useState(false);
  const [newTrackName,      setNewTrackName]      = useState('');
  const [newTrackCategory,  setNewTrackCategory]  = useState('vocals');
  const [selectedTrackBlock, setSelectedTrackBlock] = useState(null); // { trackId, blockId }

  // ── Parse section blocks ──
  const rawTimeline = responses['arrangement-timeline'];
  let blocks = [];
  try {
    blocks = typeof rawTimeline === 'string' ? JSON.parse(rawTimeline) : (rawTimeline || []);
  } catch { console.error('Failed to parse arrangement timeline'); }

  // Sync the mutable refs synchronously on every render
  blocksRef.current = blocks;
  tracksRef.current = tracks;
  selectedBlockIdRef.current = selectedBlockId;
  multiSelectedIdsRef.current = multiSelectedIds;
  selectedTrackBlockRef.current = selectedTrackBlock;

  const sortedBlocks   = [...blocks].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  const totalDuration  = song?.durationSeconds
    || sortedBlocks.reduce((acc, b) => acc + (parseInt(b.duration) || 0), 0)
    || 120;

  // AC-06: throttled sr-only live-region announcement for the playhead
  const playheadAnnouncement = usePlayheadAnnouncer(currentTime, totalDuration);
  const contentWidth   = Math.max(600, totalDuration * pxPerSec);
  const selectedBlock  = sortedBlocks.find(b => b.id === selectedBlockId);

  // ── Persist helpers ──
  const setBpm = (raw) => {
    const n = Math.max(40, Math.min(300, parseInt(raw, 10) || 120));
    setBpmState(n);
    onChange('arrangement-bpm', String(n));
  };
  const setViewMode = (mode) => {
    setViewModeState(mode);
    onChange('arrangement-view-mode', mode);
  };
  const saveBlocks = (newBlocks) => {
    onChange('arrangement-timeline', JSON.stringify(newBlocks));
  };
  const saveTracks = (newTracks) => {
    setTracks(newTracks);
    onChange('arrangement-tracks', JSON.stringify(newTracks));
    if (saveNow) setTimeout(saveNow, 100);
  };

  // ── Formatting helpers ──
  const formatTime = (seconds) => {
    const s = Math.floor(seconds || 0);
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
  const parseTime = (str) => {
    if (!str) return 0;
    if (typeof str === 'number') return str;
    const parts = str.split(':');
    if (parts.length === 2) return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    return parseInt(str, 10) || 0;
  };
  const formatBarRange = (startSec, durSec) => {
    const s = secToBar(startSec, bpm);
    const e = Math.max(s, secToBar(Math.max(0, startSec + durSec - 0.01), bpm));
    return s === e ? `Bar ${s}` : `Bars ${s}–${e}`;
  };
  const formatDurBars = (durSec) => {
    const bars = Math.max(1, Math.round(durSec / barDurSecs(bpm)));
    return `${bars} bar${bars !== 1 ? 's' : ''}`;
  };

  // ── Active (playing) block ──
  const activeBlock = sortedBlocks.find(b => {
    const start = b.startTime || 0;
    return currentTime >= start && currentTime < start + (b.duration || 0);
  });

  // ── Playhead left position (px) ──
  const playheadLeft =
    activeSong && song?._id === activeSong._id && currentTime > 0 && currentTime <= totalDuration
      ? currentTime * pxPerSec
      : null;

  // ── Audio seek ──
  const handleSeek = (seconds) => {
    if (!song?._id) return;
    if (activeSong && activeSong._id === song._id) {
      seekTo(seconds); play();
    } else {
      loadSong(song);
      setTimeout(() => { seekTo(seconds); play(); }, 800);
    }
  };

  // ── Section CRUD ──
  const addBlock = () => {
    const last = sortedBlocks[sortedBlocks.length - 1];
    const newStart = last ? (last.startTime || 0) + (last.duration || 30) : 0;
    const defDur = viewMode === 'bars' ? snapDurBars(32, bpm) : 32;
    const nb = {
      id: 'block-' + Date.now() + Math.random().toString(36).substr(2, 5),
      name: 'New Section', type: 'verse', startTime: newStart, duration: defDur, notes: '',
    };
    saveBlocks([...blocks, nb]);
    setSelectedBlockId(nb.id);
    if (saveNow) setTimeout(saveNow, 100);
  };
  const updateBlock = (id, fields) => saveBlocks(blocks.map(b => b.id === id ? { ...b, ...fields } : b));
  const deleteBlock = (id) => {
    saveBlocks(blocks.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
    if (saveNow) setTimeout(saveNow, 100);
  };

  // ── Multi-select delete: removes the selected ids from sections,
  //    then from any track's blocks. Both data structures share the
  //    id space (widget generates unique ids with Date.now()+random),
  //    so a single pass with two filters is enough.
  const deleteSelected = () => {
    if (!multiSelectedIds || multiSelectedIds.size === 0) return;
    const ids = multiSelectedIds;
    const remainingSections = blocks.filter((b) => !ids.has(b.id));
    const remainingTracks = tracks.map((t) => ({
      ...t,
      blocks: (t.blocks || []).filter((b) => !ids.has(b.id)),
    }));
    saveBlocks(remainingSections);
    saveTracks(remainingTracks);
    setMultiSelectedIds(new Set());
    if (selectedBlockId && ids.has(selectedBlockId)) setSelectedBlockId(null);
    if (selectedTrackBlock && ids.has(selectedTrackBlock.blockId)) {
      setSelectedTrackBlock(null);
    }
    if (saveNow) setTimeout(saveNow, 100);
  };

  // ── Track CRUD ──
  const addTrack = () => {
    if (!newTrackName.trim()) return;
    const cat = TRACK_CATEGORIES[newTrackCategory] || TRACK_CATEGORIES.fx;
    const t = {
      id: 'track-' + Date.now() + Math.random().toString(36).substr(2, 5),
      name: newTrackName.trim(), category: newTrackCategory,
      color: cat.color, emoji: cat.emoji, blocks: [],
    };
    saveTracks([...tracks, t]);
    setNewTrackName(''); setShowAddTrack(false);
  };
  const deleteTrack = (trackId) => {
    saveTracks(tracksRef.current.filter(t => t.id !== trackId));
    if (selectedTrackBlock?.trackId === trackId) setSelectedTrackBlock(null);
  };
  const addTrackBlock = (trackId, startSec) => {
    const defDur = viewMode === 'bars' ? snapDurBars(16, bpm) : 16;
    const tb = {
      id: 'tb-' + Date.now() + Math.random().toString(36).substr(2, 5),
      startTime: Math.max(0, startSec), duration: defDur,
    };
    const next = tracksRef.current.map(t => t.id === trackId ? { ...t, blocks: [...(t.blocks || []), tb] } : t);
    saveTracks(next);
    setSelectedTrackBlock({ trackId, blockId: tb.id });
  };
  const updateTrackBlock = (trackId, blockId, fields) => {
    saveTracks(tracksRef.current.map(t => t.id !== trackId ? t : {
      ...t, blocks: (t.blocks || []).map(b => b.id === blockId ? { ...b, ...fields } : b),
    }));
  };
  const deleteTrackBlock = (trackId, blockId) => {
    saveTracks(tracksRef.current.map(t => t.id !== trackId ? t : {
      ...t, blocks: (t.blocks || []).filter(b => b.id !== blockId),
    }));
    setSelectedTrackBlock(null);
  };

  // ── Context menu trigger ──
  const handleContextMenu = (e, type, data) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type,
      data
    });
  };

  // ── Canvas text truncater helper ──
  const truncateText = (ctx, text, maxWidth) => {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  };

  // ── Canvas coordinate mapping cursor hover ──
  const handleMouseMoveHover = (e) => {
    if (readOnly) return;
    if (isDraggingRef.current || isResizingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clickedTime = mouseX / pxPerSec;
    
    // Check sections
    if (mouseY >= 28 && mouseY < 28 + 114) {
      const hoverBlock = sortedBlocks.find(
        (b) => clickedTime >= (b.startTime || 0) && clickedTime <= (b.startTime || 0) + (b.duration || 0)
      );
      if (hoverBlock) {
        const isSel = hoverBlock.id === selectedBlockIdRef.current;
        const blockRightEdgeX = ((hoverBlock.startTime || 0) + (hoverBlock.duration || 0)) * pxPerSec;
        if (isSel && Math.abs(mouseX - blockRightEdgeX) < 10) {
          canvas.style.cursor = 'col-resize';
        } else {
          canvas.style.cursor = 'pointer';
        }
        return;
      }
      canvas.style.cursor = 'default';
      return;
    }

    // Check tracks
    let trackIdx = -1;
    if (mouseY >= 28 + 114) {
      trackIdx = Math.floor((mouseY - (28 + 114)) / 46);
    }

    if (trackIdx >= 0 && trackIdx < tracksRef.current.length) {
      const track = tracksRef.current[trackIdx];
      const clickedBlock = track.blocks?.find(
        (b) => clickedTime >= (b.startTime || 0) && clickedTime <= (b.startTime || 0) + (b.duration || 0)
      );

      if (clickedBlock) {
        const isSel = selectedTrackBlockRef.current?.trackId === track.id && selectedTrackBlockRef.current?.blockId === clickedBlock.id;
        const blockRightEdgeX = ((clickedBlock.startTime || 0) + (clickedBlock.duration || 0)) * pxPerSec;
        if (isSel && Math.abs(mouseX - blockRightEdgeX) < 8) {
          canvas.style.cursor = 'col-resize';
        } else {
          canvas.style.cursor = 'grab';
        }
        return;
      }
      canvas.style.cursor = 'crosshair';
      return;
    }

    canvas.style.cursor = 'default';
  };

  // ── Drag Listeners registration ──
  const registerDragListeners = () => {
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragUp);
  };

  const handleDragMove = (e) => {
    const info = dragStartInfoRef.current;
    if (!info) return;

    if (info.type === 'section-resize') {
      let delta = (e.clientX - info.startX) / pxPerSec;
      let dur = Math.max(1, info.startDur + delta);
      dur = viewMode === 'bars' ? snapDurBars(dur, bpm) : Math.round(dur);
      onChange('arrangement-timeline', JSON.stringify(
        blocksRef.current.map(b => b.id === info.block.id ? { ...b, duration: dur } : b)
      ));
    }

    else if (info.type === 'section-move') {
      const dx = e.clientX - info.startX;
      const dy = e.clientY - info.startY;
      if (!info.isActualDrag && Math.sqrt(dx * dx + dy * dy) > 5) {
        info.isActualDrag = true;
        setDraggedSection(info.block);
        document.body.style.cursor = 'copy';
      }
      if (info.isActualDrag) {
        setDraggedSectionPosition({ x: e.clientX, y: e.clientY });
      }
    }

    else if (info.type === 'track-block-resize') {
      let dur = Math.max(1, info.startDur + (e.clientX - info.startX) / pxPerSec);
      dur = viewMode === 'bars' ? snapDurBars(dur, bpm) : Math.max(1, Math.round(dur));
      updateTrackBlock(info.track.id, info.block.id, { duration: dur });
    }

    else if (info.type === 'track-block-move') {
      info.didMove = true;
      let s = Math.max(0, info.startSec + (e.clientX - info.startX) / pxPerSec);
      s = viewMode === 'bars' ? snapStartBars(s, bpm) : Math.round(s);
      updateTrackBlock(info.track.id, info.block.id, { startTime: s });
    }
  };

  const handleDragUp = (e) => {
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragUp);

    const info = dragStartInfoRef.current;
    dragStartInfoRef.current = null;
    isDraggingRef.current = false;
    isResizingRef.current = false;

    if (!info) return;

    if (info.type === 'section-resize') {
      if (saveNow) saveNow();
    }

    else if (info.type === 'section-move') {
      if (info.isActualDrag) {
        setDraggedSection(null);
        document.body.style.cursor = '';
        const element = document.elementFromPoint(e.clientX, e.clientY);
        const trackLane = element?.closest('[data-track-id]');
        if (trackLane) {
          const trackId = trackLane.getAttribute('data-track-id');
          const tb = {
            id: 'tb-' + Date.now() + Math.random().toString(36).substr(2, 5),
            startTime: info.block.startTime,
            duration: info.block.duration,
          };
          const next = tracksRef.current.map(t => t.id === trackId ? { ...t, blocks: [...(t.blocks || []), tb] } : t);
          saveTracks(next);
          setSelectedTrackBlock({ trackId, blockId: tb.id });
        }
      } else {
        const isSel = info.block.id === selectedBlockIdRef.current;
        const mod = detectModifier(e);
        if (mod) {
          const order = sortedBlocks.map((b) => b.id);
          setMultiSelectedIds(applyBlockClick({
            selected: multiSelectedIdsRef.current,
            order,
            clickedId: info.block.id,
            lastClickedId: lastClickedIdRef.current,
            modifier: mod,
          }));
          lastClickedIdRef.current = info.block.id;
        } else {
          setSelectedBlockId(isSel ? null : info.block.id);
          setMultiSelectedIds(new Set());
          lastClickedIdRef.current = info.block.id;
        }
      }
    }

    else if (info.type === 'track-block-resize') {
      if (saveNow) saveNow();
    }

    else if (info.type === 'track-block-move') {
      if (info.didMove) {
        if (saveNow) saveNow();
      } else {
        const isSel = selectedTrackBlockRef.current?.trackId === info.track.id && selectedTrackBlockRef.current?.blockId === info.block.id;
        const mod = detectModifier(e);
        if (mod) {
          const order = (info.track.blocks || []).map((b) => b.id);
          setMultiSelectedIds(applyBlockClick({
            selected: multiSelectedIdsRef.current,
            order,
            clickedId: info.block.id,
            lastClickedId: lastClickedIdRef.current,
            modifier: mod,
          }));
          lastClickedIdRef.current = info.block.id;
        } else {
          setSelectedTrackBlock(isSel ? null : { trackId: info.track.id, blockId: info.block.id });
          setMultiSelectedIds(new Set());
          lastClickedIdRef.current = info.block.id;
        }
      }
    }
  };

  const handleMouseDown = (e) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const clickedTime = mouseX / pxPerSec;
    const isRightClick = e.button === 2 || e.ctrlKey; // support ctrl+click context menu on mac

    // Check if clicked in sections lane (y: 28 to 28 + 114)
    if (mouseY >= 28 && mouseY < 28 + 114) {
      const clickedBlock = sortedBlocks.find(
        (b) => clickedTime >= (b.startTime || 0) && clickedTime <= (b.startTime || 0) + (b.duration || 0)
      );

      if (clickedBlock) {
        if (isRightClick) {
          handleContextMenu(e, 'section-block', { block: clickedBlock });
        } else {
          const isSel = clickedBlock.id === selectedBlockIdRef.current;
          const blockRightEdgeX = ((clickedBlock.startTime || 0) + (clickedBlock.duration || 0)) * pxPerSec;
          const isResize = isSel && Math.abs(mouseX - blockRightEdgeX) < 10;

          if (isResize) {
            isResizingRef.current = true;
            dragStartInfoRef.current = {
              type: 'section-resize',
              block: clickedBlock,
              startX: e.clientX,
              startDur: clickedBlock.duration || 30,
            };
            registerDragListeners();
          } else {
            isDraggingRef.current = true;
            dragStartInfoRef.current = {
              type: 'section-move',
              block: clickedBlock,
              startX: e.clientX,
              startY: e.clientY,
              isActualDrag: false,
            };
            registerDragListeners();
          }
        }
      } else {
        if (isRightClick) {
          handleContextMenu(e, 'sections-lane', { time: clickedTime });
        } else {
          setSelectedBlockId(null);
          setSelectedTrackBlock(null);
          setMultiSelectedIds(new Set());
        }
      }
      return;
    }

    // Check if clicked in tracks lane (y > 28 + 114)
    if (mouseY >= 28 + 114) {
      const trackIdx = Math.floor((mouseY - (28 + 114)) / 46);
      if (trackIdx >= 0 && trackIdx < tracksRef.current.length) {
        const track = tracksRef.current[trackIdx];
        const clickedBlock = track.blocks?.find(
          (b) => clickedTime >= (b.startTime || 0) && clickedTime <= (b.startTime || 0) + (b.duration || 0)
        );

        if (clickedBlock) {
          if (isRightClick) {
            handleContextMenu(e, 'track-block', { track, block: clickedBlock });
          } else {
            const isSel = selectedTrackBlockRef.current?.trackId === track.id && selectedTrackBlockRef.current?.blockId === clickedBlock.id;
            const blockRightEdgeX = ((clickedBlock.startTime || 0) + (clickedBlock.duration || 0)) * pxPerSec;
            const isResize = isSel && Math.abs(mouseX - blockRightEdgeX) < 8;

            if (isResize) {
              isResizingRef.current = true;
              dragStartInfoRef.current = {
                type: 'track-block-resize',
                track,
                block: clickedBlock,
                startX: e.clientX,
                startDur: clickedBlock.duration || 8,
              };
              registerDragListeners();
            } else {
              isDraggingRef.current = true;
              dragStartInfoRef.current = {
                type: 'track-block-move',
                track,
                block: clickedBlock,
                startX: e.clientX,
                startSec: clickedBlock.startTime || 0,
                didMove: false,
              };
              registerDragListeners();
            }
          }
        } else {
          if (isRightClick) {
            handleContextMenu(e, 'track-lane', { track, time: clickedTime });
          } else {
            let s = clickedTime;
            s = viewMode === 'bars' ? snapStartBars(s, bpm) : Math.round(s);
            addTrackBlock(track.id, s);
          }
        }
      }
      return;
    }

    // Check if clicked in ruler (y < 28)
    if (mouseY < 28) {
      if (!isRightClick) {
        handleSeek(clickedTime);
      }
    }
  };

  // ── Canvas Painting Effect ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const HEADER_H = 28;
    const SECTION_ROW_H = 114;
    const TRACK_ROW_H = 46;

    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = contentWidth;
    const logicalHeight = HEADER_H + SECTION_ROW_H + tracks.length * TRACK_ROW_H;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    canvas.style.width = `${logicalWidth}px`;
    canvas.style.height = `${logicalHeight}px`;

    ctx.scale(dpr, dpr);

    // Clear and draw background
    ctx.fillStyle = '#0c0c0f';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Draw ruler background
    ctx.fillStyle = '#08080b';
    ctx.fillRect(0, 0, logicalWidth, HEADER_H);

    // Draw sections lane background
    ctx.fillStyle = '#070709';
    ctx.fillRect(0, HEADER_H, logicalWidth, SECTION_ROW_H);

    // Draw horizontal dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HEADER_H);
    ctx.lineTo(logicalWidth, HEADER_H);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(0, HEADER_H + SECTION_ROW_H);
    ctx.lineTo(logicalWidth, HEADER_H + SECTION_ROW_H);
    ctx.stroke();

    tracks.forEach((track, idx) => {
      const y = HEADER_H + SECTION_ROW_H + (idx + 1) * TRACK_ROW_H;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(logicalWidth, y);
      ctx.stroke();
    });

    // Draw Ticks & Grid Lines
    if (viewMode === 'bars') {
      const totalBarsCount = Math.ceil((totalDuration / 60) * (bpm / 4));
      let interval = 1;
      if (totalBarsCount > 128) interval = 16;
      else if (totalBarsCount > 64) interval = 8;
      else if (totalBarsCount > 32) interval = 4;
      else if (totalBarsCount > 16) interval = 2;

      for (let bar = 1; bar <= totalBarsCount + interval; bar += interval) {
        const x = barToSec(bar, bpm) * pxPerSec;
        if (x > logicalWidth + 20) break;

        // Grid line
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.moveTo(x, HEADER_H);
        ctx.lineTo(x, logicalHeight);
        ctx.stroke();

        // Tick
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.moveTo(x, HEADER_H - 6);
        ctx.lineTo(x, HEADER_H);
        ctx.stroke();

        ctx.fillStyle = bar === 1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)';
        ctx.font = '10px "Roboto Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bar === 1 ? 'Bar 1' : String(bar), x, HEADER_H - 12);
      }
    } else {
      const tickInterval = totalDuration > 360 ? 60 : 30;
      for (let t = 0; t <= totalDuration + tickInterval; t += tickInterval) {
        const x = t * pxPerSec;
        if (x > logicalWidth + 20) break;

        // Grid line
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.moveTo(x, HEADER_H);
        ctx.lineTo(x, logicalHeight);
        ctx.stroke();

        // Tick
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.moveTo(x, HEADER_H - 6);
        ctx.lineTo(x, HEADER_H);
        ctx.stroke();

        ctx.fillStyle = t === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)';
        ctx.font = '10px "Roboto Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(t), x, HEADER_H - 12);
      }
    }

    // Draw Continuous Waveform background
    ctx.save();
    const waveGrad = ctx.createLinearGradient(0, HEADER_H, 0, HEADER_H + SECTION_ROW_H);
    waveGrad.addColorStop(0, '#00e5ff');
    waveGrad.addColorStop(0.5, '#ff6600');
    waveGrad.addColorStop(1, '#00e5ff');

    const waveGrad2 = ctx.createLinearGradient(0, HEADER_H, 0, HEADER_H + SECTION_ROW_H);
    waveGrad2.addColorStop(0, '#22c55e');
    waveGrad2.addColorStop(1, '#10b981');

    ctx.globalAlpha = 0.08;
    
    const pointsCount = 200;
    const midYOffset = HEADER_H + SECTION_ROW_H / 2;

    // Path 1
    ctx.fillStyle = waveGrad;
    ctx.beginPath();
    ctx.moveTo(0, midYOffset);
    for (let i = 0; i <= pointsCount; i++) {
      const x = (i / pointsCount) * logicalWidth;
      const noise = Math.sin(i * 0.06 + 2) * 22 + Math.cos(i * 0.17) * 14 + Math.sin(i * 0.4 + 1) * 8 + Math.cos(i * 0.03) * 5;
      ctx.lineTo(x, midYOffset - noise);
    }
    for (let i = pointsCount; i >= 0; i--) {
      const x = (i / pointsCount) * logicalWidth;
      const noise = Math.sin(i * 0.06 + 2) * 22 + Math.cos(i * 0.17) * 14 + Math.sin(i * 0.4 + 1) * 8 + Math.cos(i * 0.03) * 5;
      ctx.lineTo(x, midYOffset + noise);
    }
    ctx.closePath();
    ctx.fill();

    // Path 2
    ctx.fillStyle = waveGrad2;
    ctx.beginPath();
    ctx.moveTo(0, midYOffset);
    for (let i = 0; i <= pointsCount; i++) {
      const x = (i / pointsCount) * logicalWidth;
      const noise = Math.cos(i * 0.09) * 12 + Math.sin(i * 0.28) * 7 + Math.cos(i * 0.5 + 3) * 5;
      ctx.lineTo(x, midYOffset - noise);
    }
    for (let i = pointsCount; i >= 0; i--) {
      const x = (i / pointsCount) * logicalWidth;
      const noise = Math.cos(i * 0.09) * 12 + Math.sin(i * 0.28) * 7 + Math.cos(i * 0.5 + 3) * 5;
      ctx.lineTo(x, midYOffset + noise);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw Section blocks
    sortedBlocks.forEach(block => {
      const bx = (block.startTime || 0) * pxPerSec;
      const bw = Math.max(80, (block.duration || 30) * pxPerSec);
      const isSel = block.id === selectedBlockId;
      const isMulti = multiSelectedIds.has(block.id);
      const isCur = activeBlock?.id === block.id;
      const color = TYPE_COLORS[block.type] || TYPE_COLORS.custom;
      const by = HEADER_H + 8;
      const bh = SECTION_ROW_H - 16;

      ctx.fillStyle = isSel || isMulti ? `${color}40` : `${color}18`;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 3);
      ctx.fill();

      ctx.strokeStyle = isSel ? '#ff6600' : isMulti ? '#fbbf24' : color;
      ctx.lineWidth = isSel ? 1.5 : 1;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, by, 4, bh, [3, 0, 0, 3]);
      ctx.fill();

      ctx.fillStyle = isSel ? '#ffffff' : 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(truncateText(ctx, block.name || '', bw - 16), bx + 8, by + 8);

      if (block.notes) {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.font = 'italic 10px system-ui, -apple-system, sans-serif';
        ctx.fillText(truncateText(ctx, block.notes, bw - 16), bx + 8, by + 26);
      }

      ctx.fillStyle = color;
      ctx.font = 'bold 10px "Roboto Mono", monospace';
      ctx.textBaseline = 'bottom';
      const timeStr = viewMode === 'bars'
        ? formatBarRange(block.startTime || 0, block.duration || 30)
        : formatTime(block.startTime);
      ctx.fillText(timeStr, bx + 8, by + bh - 8);

      const durStr = viewMode === 'bars'
        ? formatDurBars(block.duration || 30)
        : `${block.duration}s`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px "Roboto Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(durStr, bx + bw - 8, by + bh - 8);

      if (isCur) {
        const prog = Math.min(100, Math.max(0, ((currentTime - (block.startTime || 0)) / (block.duration || 1)) * 100));
        ctx.fillStyle = color;
        ctx.fillRect(bx, by + bh - 2, bw * (prog / 100), 2);
      }

      if (isSel) {
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(bx + bw - 3, by + bh / 2 - 8, 2, 16);
      }
    });

    // Draw Track blocks
    tracks.forEach((track, trackIdx) => {
      const ty = HEADER_H + SECTION_ROW_H + trackIdx * TRACK_ROW_H;
      ctx.fillStyle = trackIdx % 2 === 0 ? 'rgba(255,255,255,0.005)' : 'rgba(255,255,255,0.015)';
      ctx.fillRect(0, ty, logicalWidth, TRACK_ROW_H);

      track.blocks?.forEach(block => {
        const bx = (block.startTime || 0) * pxPerSec;
        const bw = Math.max(18, (block.duration || 8) * pxPerSec);
        const bh = TRACK_ROW_H - 14;
        const by = ty + 7;

        const isSel = selectedTrackBlock?.trackId === track.id && selectedTrackBlock?.blockId === block.id;
        const isMulti = multiSelectedIds.has(block.id);

        ctx.fillStyle = isSel || isMulti ? `${track.color}45` : `${track.color}28`;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 3);
        ctx.fill();

        ctx.strokeStyle = isSel ? track.color : isMulti ? '#fbbf24' : track.color + '70';
        ctx.lineWidth = isSel ? 1.5 : 1;
        ctx.stroke();

        ctx.fillStyle = track.color;
        ctx.font = 'bold 9px "Roboto Mono", monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const clipStr = viewMode === 'bars'
          ? formatBarRange(block.startTime || 0, block.duration || 8)
          : formatTime(block.startTime);
        ctx.fillText(truncateText(ctx, clipStr, bw - 8), bx + 6, by + bh / 2);

        if (isSel) {
          ctx.fillStyle = track.color;
          ctx.fillRect(bx + bw - 2, by + bh / 2 - 5, 1.5, 10);
        }
      });
    });

    // Draw Playhead
    const playheadX = currentTime * pxPerSec;
    if (playheadX <= logicalWidth) {
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, logicalHeight);
      ctx.stroke();

      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 7);
      ctx.closePath();
      ctx.fill();
    }
  }, [tracks, sortedBlocks, bpm, pxPerSec, currentTime, selectedBlockId, selectedTrackBlock, multiSelectedIds, viewMode, activeBlock, totalDuration, contentWidth]);

  // ── Keyboard shortcuts ──

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (selectedBlock) handleSeek(selectedBlock.startTime || 0);
      }
      if (e.code === 'ArrowLeft' && sortedBlocks.length > 0) {
        e.preventDefault();
        const idx = sortedBlocks.findIndex(b => b.id === selectedBlockId);
        if (idx > 0) setSelectedBlockId(sortedBlocks[idx - 1].id);
        else if (idx === -1) setSelectedBlockId(sortedBlocks[sortedBlocks.length - 1].id);
      }
      if (e.code === 'ArrowRight' && sortedBlocks.length > 0) {
        e.preventDefault();
        const idx = sortedBlocks.findIndex(b => b.id === selectedBlockId);
        if (idx < sortedBlocks.length - 1 && idx !== -1) setSelectedBlockId(sortedBlocks[idx + 1].id);
        else if (idx === -1) setSelectedBlockId(sortedBlocks[0].id);
      }
      if ((e.key === 'a' || e.key === 'A') && !e.altKey && !e.ctrlKey && !e.metaKey && !readOnly) {
        e.preventDefault(); addBlock();
      }
      if (e.code === 'Delete' && selectedTrackBlock && !readOnly) {
        deleteTrackBlock(selectedTrackBlock.trackId, selectedTrackBlock.blockId);
      }
      if (e.code === 'Delete' && multiSelectedIds.size > 0 && !readOnly) {
        e.preventDefault();
        if (window.confirm(`Delete ${multiSelectedIds.size} selected block${multiSelectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) {
          deleteSelected();
        }
      }
      if (e.key === 'Escape' && multiSelectedIds.size > 0) {
        setMultiSelectedIds(new Set());
        lastClickedIdRef.current = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedBlockId, sortedBlocks, readOnly, selectedTrackBlock, bpm, viewMode, multiSelectedIds]);

  const hasContent = sortedBlocks.length > 0 || tracks.length > 0;

  // ── Derived: selected track block info ──
  const selTrack = selectedTrackBlock ? tracks.find(t => t.id === selectedTrackBlock.trackId) : null;
  const selTb    = selTrack ? selTrack.blocks.find(b => b.id === selectedTrackBlock.blockId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', margin: '10px 0 25px 0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ══════════════════════════════════════════════════════════════════════
          TOOLBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>

        {/* Left: title + BPM + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '13px', fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.45)' }}>
            🎹 ARRANGEMENT TIMELINE
            {sortedBlocks.length > 0 && (
              <span style={{ marginLeft: '8px', color: 'rgba(255,255,255,0.25)' }}>
                ({viewMode === 'bars'
                  ? `${Math.ceil((totalDuration / 60) * (bpm / 4))} bars`
                  : formatTime(totalDuration)})
              </span>
            )}
          </h3>

          {/* AC-06: playhead readout for sighted users + sr-only live region for AT */}
          <span
            aria-hidden="true"
            style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.45)',
              fontFamily: '"Roboto Mono", monospace',
              padding: '2px 8px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '3px',
            }}
          >
            {formatTime(currentTime)} / {formatTime(totalDuration)}
          </span>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            style={playheadSrOnlyStyle}
          >
            {playheadAnnouncement}
          </div>

          {/* Multi-select bulk action — only visible when ≥1 block is
              selected. Destructive action so the confirm dialog guards
              against accidental clicks. */}
          {multiSelectedIds.size > 0 && !readOnly && (
            <div
              role="group"
              aria-label="Multi-select actions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.4)',
                borderRadius: '3px',
              }}
            >
              <span
                style={{ fontSize: '10px', color: '#fbbf24', fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.04em' }}
                aria-live="polite"
              >
                {multiSelectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete ${multiSelectedIds.size} selected block${multiSelectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) {
                    deleteSelected();
                  }
                }}
                data-testid="bulk-delete-button"
                style={{
                  padding: '3px 10px',
                  fontSize: '10px',
                  background: 'rgba(244, 63, 94, 0.1)',
                  color: '#f43f5e',
                  border: '1px solid rgba(244, 63, 94, 0.4)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontFamily: '"Roboto Mono", monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => { setMultiSelectedIds(new Set()); lastClickedIdRef.current = null; }}
                style={{
                  padding: '3px 8px',
                  fontSize: '10px',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '2px',
                  cursor: 'pointer',
                  fontFamily: '"Roboto Mono", monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
                aria-label="Clear multi-selection"
              >
                Clear
              </button>
            </div>
          )}

          {/* BPM input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.08em' }}>BPM</span>
            <input
              type="number"
              value={bpm}
              onChange={e => setBpm(e.target.value)}
              onBlur={e => setBpm(e.target.value)}
              min={40} max={300}
              style={{
                width: '60px', background: '#161619', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px', padding: '4px 8px', color: '#ffffff', fontSize: '13px',
                outline: 'none', fontFamily: '"Roboto Mono", monospace', textAlign: 'center',
              }}
            />
          </div>

          {/* BARS / SECS toggle */}
          <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            {['bars', 'seconds'].map(mode => (
              <button
                key={mode} type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '4px 13px', fontSize: '11px', border: 'none', cursor: 'pointer',
                  fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.06em',
                  background: viewMode === mode ? '#ff6600' : '#161619',
                  color:      viewMode === mode ? '#151518' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.15s ease',
                }}
              >
                {mode === 'bars' ? 'BARS' : 'SECS'}
              </button>
            ))}
          </div>

          {/* Horizontal Zoom Control */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.08em' }}>ZOOM</span>
            <input 
              type="range" 
              min="2" 
              max="20" 
              value={pxPerSec} 
              onChange={(e) => setPxPerSec(Number(e.target.value))} 
              style={{ width: '80px', height: '3px', accentColor: '#ff6600', background: 'rgba(255,255,255,0.1)', cursor: 'pointer' }}
            />
          </div>

          {/* Time Signature Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.08em' }}>METER</span>
            <select
              value={timeSignature}
              onChange={(e) => setTimeSignature(e.target.value)}
              style={{
                background: '#161619', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px', padding: '4px 8px', color: '#ffffff', fontSize: '11px',
                fontFamily: '"Roboto Mono", monospace', outline: 'none', cursor: 'pointer'
              }}
            >
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="6/8">6/8</option>
            </select>
          </div>
        </div>

        {/* Right: Add Section + Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ExportArrangementButton
            sections={sortedBlocks}
            tracks={tracks}
            song={song}
            bpm={bpm}
            timeSignature={timeSignature}
            viewMode={viewMode}
            readOnly={readOnly}
          />
          {!readOnly && (
            <button
              type="button" onClick={addBlock}
              style={{
                padding: '8px 18px', fontSize: '13px', fontWeight: '600',
                background: '#ff6600', color: '#151518', border: 'none', borderRadius: '4px',
                cursor: 'pointer', fontFamily: '"Roboto Mono", monospace',
                boxShadow: '0 2px 6px rgba(255,102,0,0.25)', transition: 'transform 0.1s ease',
              }}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              + Add Section
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          EMPTY STATE
      ══════════════════════════════════════════════════════════════════════ */}
      {!hasContent && (
        <div style={{
          padding: '50px 20px', textAlign: 'center', background: '#111114',
          border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '4px',
          color: 'rgba(255,255,255,0.3)', fontSize: '14px', fontStyle: 'italic',
        }}>
          No arrangement sections defined. Click "+ Add Section" (or press 'A') to begin mapping.
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TIMELINE WORKSPACE
      ══════════════════════════════════════════════════════════════════════ */}
      {hasContent && (
        <div style={{ background: '#0c0c0f', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>

          {/* Two-column layout: fixed gutter | scrollable content */}
          <div style={{ display: 'flex' }}>

            {/* ── LEFT GUTTER ─────────────────────────────────────────────── */}
            <div style={{
              width: GUTTER_W, minWidth: GUTTER_W, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              background: '#0a0a0d',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              zIndex: 3,
            }}>
              {/* Ruler label row */}
              <div style={{ height: 28, display: 'flex', alignItems: 'center', paddingLeft: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.06em' }}>
                  {viewMode === 'bars' ? '♩ BARS' : '⏱ TIME'}
                </span>
              </div>

              {/* Sections label */}
              {sortedBlocks.length > 0 && (
                <div style={{
                  height: SECTION_ROW_H, display: 'flex', alignItems: 'center',
                  paddingLeft: '12px',
                  borderBottom: tracks.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <span style={{ fontSize: '10px', fontFamily: '"Roboto Mono", monospace', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Sections
                  </span>
                </div>
              )}

              {/* Track label rows */}
              {tracks.map((track, idx) => (
                <div key={track.id} style={{
                  height: TRACK_ROW_H, display: 'flex', alignItems: 'center', gap: '6px',
                  paddingLeft: '10px', paddingRight: '6px',
                  borderBottom: idx < tracks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.008)',
                }}>
                  <span style={{ 
                    fontSize: '8px', 
                    fontFamily: '"Roboto Mono"', 
                    fontWeight: 'bold', 
                    color: '#000', 
                    background: track.color, 
                    padding: '2px 4px', 
                    borderRadius: '2px', 
                    marginRight: '2px',
                    flexShrink: 0
                  }}>
                    {TRACK_CATEGORIES[track.category]?.code || track.emoji || 'FX'}
                  </span>
                  <span style={{
                    flex: 1, fontSize: '11px', fontFamily: '"Roboto Mono", monospace',
                    color: 'rgba(255,255,255,0.65)', letterSpacing: '0.02em',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {track.name}
                  </span>
                  {!readOnly && (
                    <button
                      type="button" onClick={() => deleteTrack(track.id)}
                      title="Remove track"
                      style={{
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.18)',
                        cursor: 'pointer', padding: '2px 4px', fontSize: '14px', lineHeight: 1,
                        flexShrink: 0, transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#f43f5e'}
                      onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.18)'}
                    >×</button>
                  )}
                </div>
              ))}

              {/* Add Track button */}
              {!readOnly && (
                <div style={{ height: 40, display: 'flex', alignItems: 'center', paddingLeft: '12px' }}>
                  <button
                    type="button" onClick={() => setShowAddTrack(v => !v)}
                    style={{
                      background: 'none', border: 'none', color: showAddTrack ? '#ff6600' : 'rgba(255,255,255,0.3)',
                      fontSize: '11px', fontFamily: '"Roboto Mono", monospace',
                      cursor: 'pointer', padding: 0, letterSpacing: '0.04em',
                      transition: 'color 0.15s',
                    }}
                  >
                    {showAddTrack ? '▼ cancel' : '+ track'}
                  </button>
                </div>
              )}
            </div>

            {/* ── SCROLLABLE CONTENT ───────────────────────────────────────── */}
            <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
              <div style={{ minWidth: contentWidth, position: 'relative' }}>
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMoveHover}
                  onContextMenu={(e) => e.preventDefault()}
                  width={contentWidth}
                  height={28 + 114 + tracks.length * 46}
                  style={{ display: 'block', background: '#0c0c0f' }}
                />
              </div>
            </div>
          </div>

          {/* ── ADD TRACK INLINE FORM ────────────────────────────────────── */}
          {!readOnly && showAddTrack && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', background: '#111114', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Track name (e.g. Lead Vocals)"
                value={newTrackName}
                onChange={e => setNewTrackName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTrack()}
                autoFocus
                style={{
                  flex: '1', minWidth: '160px', background: '#161619',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
                  padding: '7px 12px', color: '#ffffff', fontSize: '13px', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {Object.entries(TRACK_CATEGORIES).map(([key, cat]) => (
                  <button key={key} type="button" onClick={() => setNewTrackCategory(key)} style={{
                    padding: '5px 9px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
                    border: `1px solid ${newTrackCategory === key ? cat.color : 'rgba(255,255,255,0.06)'}`,
                    background: newTrackCategory === key ? `${cat.color}20` : '#161619',
                    color: newTrackCategory === key ? '#ffffff' : 'rgba(255,255,255,0.5)',
                    fontFamily: '"Roboto Mono", monospace', transition: 'all 0.15s',
                  }}>
                    {cat.code} | {cat.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={addTrack} style={{ padding: '7px 18px', fontSize: '13px', fontWeight: '600', background: '#ff6600', color: '#151518', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}>
                  Add
                </button>
                <button type="button" onClick={() => { setShowAddTrack(false); setNewTrackName(''); }} style={{ padding: '7px 12px', fontSize: '13px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── TRACK BLOCK INSPECTOR ────────────────────────────────────── */}
          {!readOnly && selTrack && selTb && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '11px 16px', background: '#111114', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: selTrack.color, boxShadow: `0 0 4px ${selTrack.color}` }} />
                <span style={{ fontSize: '11px', fontFamily: '"Roboto Mono", monospace', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {TRACK_CATEGORIES[selTrack.category]?.code || selTrack.emoji || 'FX'} | {selTrack.name}
                </span>
              </div>

              {/* Start input */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>
                  {viewMode === 'bars' ? 'Bar' : 'Start'}
                </span>
                <input
                  type={viewMode === 'bars' ? 'number' : 'text'}
                  value={viewMode === 'bars' ? secToBar(selTb.startTime || 0, bpm) : formatTime(selTb.startTime)}
                  onChange={e => {
                    const val = viewMode === 'bars'
                      ? barToSec(Math.max(1, parseInt(e.target.value, 10) || 1), bpm)
                      : parseTime(e.target.value);
                    updateTrackBlock(selTrack.id, selTb.id, { startTime: Math.max(0, val) });
                  }}
                  style={{ width: '64px', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 8px', color: '#ffffff', fontSize: '12px', outline: 'none', fontFamily: '"Roboto Mono", monospace', textAlign: 'center' }}
                />
              </div>

              {/* Duration input */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace' }}>
                  {viewMode === 'bars' ? 'Bars' : 'Dur (s)'}
                </span>
                <input
                  type="number"
                  value={viewMode === 'bars'
                    ? Math.max(1, Math.round(selTb.duration / barDurSecs(bpm)))
                    : selTb.duration}
                  min={1}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10) || 1;
                    const dur = viewMode === 'bars'
                      ? Math.max(barDurSecs(bpm), v * barDurSecs(bpm))
                      : Math.max(1, v);
                    updateTrackBlock(selTrack.id, selTb.id, { duration: dur });
                  }}
                  style={{ width: '60px', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '5px 8px', color: '#ffffff', fontSize: '12px', outline: 'none', fontFamily: '"Roboto Mono", monospace', textAlign: 'center' }}
                />
              </div>

              <button type="button" onClick={() => handleSeek(selTb.startTime || 0)} style={{ padding: '5px 12px', fontSize: '12px', background: 'rgba(255,102,0,0.1)', color: '#ff6600', border: '1px solid rgba(255,102,0,0.3)', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}>
                ▶ Play
              </button>
              <button type="button" onClick={() => updateTrackBlock(selTrack.id, selTb.id, { startTime: Math.floor(currentTime) })} title="Sync start to player position" style={{ padding: '5px 10px', fontSize: '12px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}>
                🎯 Sync
              </button>
              <button type="button" onClick={() => deleteTrackBlock(selTrack.id, selTb.id)} style={{ padding: '5px 10px', fontSize: '12px', background: 'rgba(244,63,94,0.05)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}>
                Delete Block
              </button>
              <button type="button" onClick={() => setSelectedTrackBlock(null)} style={{ marginLeft: 'auto', padding: '5px 10px', fontSize: '12px', background: 'transparent', color: 'rgba(255,255,255,0.3)', border: 'none', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}>
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION INSPECTOR
      ══════════════════════════════════════════════════════════════════════ */}
      {!readOnly && selectedBlock && (
        <div style={{ background: '#111114', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>

          {/* Inspector header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: TYPE_COLORS[selectedBlock.type] || TYPE_COLORS.custom, boxShadow: `0 0 6px ${TYPE_COLORS[selectedBlock.type] || TYPE_COLORS.custom}` }} />
              <strong style={{ fontSize: '13px', fontFamily: '"Roboto Mono", monospace', color: '#ffffff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                INSPECTOR: {selectedBlock.name}
              </strong>
            </div>
            <button
              type="button" onClick={() => deleteBlock(selectedBlock.id)}
              style={{ padding: '5px 12px', fontSize: '12px', border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.05)', color: '#f43f5e', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}
            >
              Delete Section
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Basic fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>

              {/* Section Name */}
              <div>
                <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>Section Name</label>
                <input
                  type="text"
                  value={selectedBlock.name}
                  onChange={e => updateBlock(selectedBlock.id, { name: e.target.value })}
                  placeholder="e.g. Verse 1, Chorus A"
                  style={{ width: '100%', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px', color: '#ffffff', fontSize: '14px', outline: 'none' }}
                />
              </div>

              {/* Timing controls */}
              <div>
                <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>Timing Boundaries</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Start time / bar */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    {viewMode === 'bars' ? (
                      <input
                        type="number"
                        value={secToBar(selectedBlock.startTime || 0, bpm)}
                        onChange={e => updateBlock(selectedBlock.id, { startTime: barToSec(Math.max(1, parseInt(e.target.value, 10) || 1), bpm) })}
                        min={1}
                        style={{ width: '100%', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px', color: '#ffffff', fontSize: '14px', outline: 'none', fontFamily: '"Roboto Mono", monospace' }}
                      />
                    ) : (
                      <input
                        type="text"
                        value={formatTime(selectedBlock.startTime)}
                        onChange={e => updateBlock(selectedBlock.id, { startTime: parseTime(e.target.value) })}
                        placeholder="mm:ss"
                        style={{ width: '100%', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px', color: '#ffffff', fontSize: '14px', outline: 'none', fontFamily: '"Roboto Mono", monospace' }}
                      />
                    )}
                    <span style={{ position: 'absolute', right: '8px', top: '11px', fontSize: '11px', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}>
                      {viewMode === 'bars' ? 'Bar' : 'Start'}
                    </span>
                  </div>

                  {/* Duration */}
                  <div style={{ position: 'relative', flex: 1 }}>
                    {viewMode === 'bars' ? (
                      <>
                        <input
                          type="number"
                          value={Math.max(1, Math.round((selectedBlock.duration || 0) / barDurSecs(bpm)))}
                          min={1}
                          onChange={e => {
                            const bars = Math.max(1, parseInt(e.target.value, 10) || 1);
                            updateBlock(selectedBlock.id, { duration: bars * barDurSecs(bpm) });
                          }}
                          style={{ width: '100%', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px', color: '#ffffff', fontSize: '14px', outline: 'none', fontFamily: '"Roboto Mono", monospace' }}
                        />
                        <span style={{ position: 'absolute', right: '8px', top: '11px', fontSize: '11px', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}>Bars</span>
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          value={selectedBlock.duration}
                          onChange={e => updateBlock(selectedBlock.id, { duration: parseInt(e.target.value, 10) || 0 })}
                          placeholder="Duration (s)"
                          style={{ width: '100%', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px', color: '#ffffff', fontSize: '14px', outline: 'none', fontFamily: '"Roboto Mono", monospace' }}
                        />
                        <span style={{ position: 'absolute', right: '8px', top: '11px', fontSize: '11px', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}>Secs</span>
                      </>
                    )}
                  </div>

                  {/* Sync button */}
                  <button
                    type="button"
                    onClick={() => updateBlock(selectedBlock.id, { startTime: Math.floor(currentTime) })}
                    title="Capture current player time as start"
                    style={{ padding: '0 14px', fontSize: '13px', background: 'rgba(255,102,0,0.1)', color: '#ff6600', border: '1px solid rgba(255,102,0,0.3)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    🎯 Sync
                  </button>
                </div>

                {/* Show bar hint when in seconds mode and vice versa */}
                <div style={{ marginTop: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.2)', fontFamily: '"Roboto Mono", monospace' }}>
                  {viewMode === 'bars'
                    ? `≈ ${formatTime(selectedBlock.startTime || 0)} · ${selectedBlock.duration ? Math.round(selectedBlock.duration) + 's' : ''}`
                    : `≈ ${formatBarRange(selectedBlock.startTime || 0, selectedBlock.duration || 0)} · ${formatDurBars(selectedBlock.duration || 0)}`
                  }
                </div>
              </div>
            </div>

            {/* Category swatch picker */}
            <div>
              <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '4px' }}>Category / Sound Type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {Object.keys(TYPE_COLORS).map(type => (
                  <button
                    key={type} type="button"
                    onClick={() => updateBlock(selectedBlock.id, { type })}
                    style={{
                      padding: '6px 12px', fontSize: '12px', borderRadius: '4px', cursor: 'pointer',
                      border: `1px solid ${selectedBlock.type === type ? TYPE_COLORS[type] : 'rgba(255,255,255,0.06)'}`,
                      background: selectedBlock.type === type ? `${TYPE_COLORS[type]}20` : '#161619',
                      color: selectedBlock.type === type ? '#ffffff' : 'rgba(255,255,255,0.6)',
                      textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '6px',
                      fontFamily: '"Roboto Mono", monospace', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: TYPE_COLORS[type] }} />
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced production cues toggle */}
            <div>
              <button
                type="button" onClick={() => setShowAdvanced(!showAdvanced)}
                style={{ background: 'transparent', border: 'none', color: '#ff6600', fontSize: '13px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px', fontFamily: '"Roboto Mono", monospace', outline: 'none' }}
              >
                {showAdvanced ? '▼ Hide Advanced Production Cues' : '▶ Show Advanced Production Cues'}
              </button>
            </div>

            {showAdvanced && (
              <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block' }}>Production Cues / Dynamic Actions</label>
                <AutoExpandingTextarea
                  value={selectedBlock.notes || ''}
                  onChange={e => updateBlock(selectedBlock.id, { notes: e.target.value })}
                  placeholder="e.g. Drums filter out, synth pad sweeps, vocal delays increase..."
                />
              </div>
            )}

            {/* Inspector footer actions */}
            <div style={{ marginTop: '10px', display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
              <button
                type="button" onClick={() => handleSeek(selectedBlock.startTime || 0)}
                style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 'bold', background: '#ff6600', color: '#151518', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}
              >
                ▶ Play Section
              </button>
              <button
                type="button" onClick={() => setSelectedBlockId(null)}
                style={{ padding: '8px 14px', fontSize: '13px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          ANALYSIS MATRIX (existing, unchanged)
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', background: '#111114', padding: '20px', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '4px', width: '100%' }}>
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontFamily: '"Roboto Mono", monospace', fontSize: '14px', color: '#ff6600', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            🔬 ANALYSIS MATRIX: ARRANGEMENT
          </h3>
          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
            Map sections, transitions, and dynamic layers over the timeline.
          </p>
        </div>

        {lensData?.description && (
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5', background: '#161619', padding: '14px 16px', borderLeft: '3px solid #ff6600', borderRadius: '2px' }}>
            {lensData.description}
          </div>
        )}

        {lensData?.exercises?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontFamily: '"Roboto Mono", monospace', fontSize: '12px', color: '#ff6600', textTransform: 'uppercase' }}>Exercises</span>
            {lensData.exercises.map((ex, idx) => (
              <div key={idx} style={{ background: '#0c0c0f', padding: '12px 14px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <strong style={{ fontSize: '13px', color: '#ffffff', display: 'block' }}>{ex.name}</strong>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', display: 'block', marginTop: '2px', lineHeight: '1.4' }}>{ex.description}</span>
              </div>
            ))}
          </div>
        )}

        {lensData?.questions?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '5px' }}>
            <span style={{ fontFamily: '"Roboto Mono", monospace', fontSize: '12px', color: '#ff6600', textTransform: 'uppercase' }}>Structural Inquiries</span>
            {lensData.questions.map((question, idx) => {
              const key = `arrangement-q${idx}`;
              const val = responses[key] || '';
              return (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginBottom: '6px', fontWeight: '500', lineHeight: '1.4' }}>
                    {question}
                  </label>
                  {readOnly ? (
                    <div style={{ background: '#0c0c0f', padding: '12px 14px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)', fontSize: '13px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                      {val || <em style={{ color: 'rgba(255,255,255,0.3)' }}>No response entered</em>}
                    </div>
                  ) : (
                    <textarea
                      value={val}
                      onChange={e => onChange(key, e.target.value)}
                      onBlur={saveNow}
                      placeholder="Add technical findings..."
                      style={{ width: '100%', height: '80px', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px', color: '#ffffff', fontSize: '13px', resize: 'vertical', outline: 'none', fontFamily: 'system-ui, sans-serif' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── DRAGGED SECTION GHOST ── */}
      {draggedSection && (
        <div style={{
          position: 'fixed',
          left: draggedSectionPosition.x - 20,
          top: draggedSectionPosition.y - 15,
          width: Math.max(80, (draggedSection.duration || 30) * pxPerSec),
          height: TRACK_ROW_H - 14,
          background: `${TYPE_COLORS[draggedSection.type] || TYPE_COLORS.custom}40`,
          border: `2px dashed ${TYPE_COLORS[draggedSection.type] || TYPE_COLORS.custom}`,
          borderRadius: '3px',
          pointerEvents: 'none',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '8px',
          color: '#fff',
          fontSize: '11px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          📄 Copy {draggedSection.name}
        </div>
      )}

      {/* ── CUSTOM CONTEXT MENU ── */}
      {contextMenu && (
        <div style={{
          position: 'fixed',
          left: contextMenu.x,
          top: contextMenu.y,
          zIndex: 10000,
          background: 'rgba(20, 20, 24, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '6px',
          padding: '6px 0',
          minWidth: '170px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          {contextMenu.type === 'section-block' && (
            <>
              <ContextMenuItem onClick={() => setSelectedBlockId(contextMenu.data.block.id)}>
                🔍 Inspect Section
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleSeek(contextMenu.data.block.startTime || 0)}>
                ▶ Play Section
              </ContextMenuItem>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <div style={{ padding: '4px 12px', fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: '"Roboto Mono", monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Change Type</div>
              {Object.keys(TYPE_COLORS).map(type => (
                <ContextMenuItem
                  key={type}
                  onClick={() => updateBlock(contextMenu.data.block.id, { type })}
                  style={{
                    paddingLeft: '24px',
                    color: contextMenu.data.block.type === type ? '#ffffff' : 'rgba(255,255,255,0.6)',
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: TYPE_COLORS[type],
                    marginRight: '8px',
                    verticalAlign: 'middle'
                  }} />
                  {type}
                </ContextMenuItem>
              ))}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <ContextMenuItem
                onClick={() => deleteBlock(contextMenu.data.block.id)}
                style={{ color: '#f43f5e' }}
              >
                🗑 Delete Section
              </ContextMenuItem>
            </>
          )}

          {contextMenu.type === 'sections-lane' && (
            <ContextMenuItem
              onClick={() => {
                const defDur = viewMode === 'bars' ? snapDurBars(32, bpm) : 32;
                const nb = {
                  id: 'block-' + Date.now() + Math.random().toString(36).substr(2, 5),
                  name: 'New Section',
                  type: 'verse',
                  startTime: contextMenu.data.time,
                  duration: defDur,
                  notes: '',
                };
                saveBlocks([...blocksRef.current, nb]);
                setSelectedBlockId(nb.id);
                if (saveNow) setTimeout(saveNow, 100);
              }}
            >
              ➕ Add Section Here
            </ContextMenuItem>
          )}

          {contextMenu.type === 'track-block' && (
            <>
              <ContextMenuItem onClick={() => handleSeek(contextMenu.data.block.startTime || 0)}>
                ▶ Play Block
              </ContextMenuItem>
              <ContextMenuItem onClick={() => updateTrackBlock(contextMenu.data.track.id, contextMenu.data.block.id, { startTime: Math.floor(currentTime) })}>
                🎯 Sync to Playhead
              </ContextMenuItem>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <ContextMenuItem
                onClick={() => deleteTrackBlock(contextMenu.data.track.id, contextMenu.data.block.id)}
                style={{ color: '#f43f5e' }}
              >
                🗑 Delete Block
              </ContextMenuItem>
            </>
          )}

          {contextMenu.type === 'track-lane' && (
            <>
              <ContextMenuItem onClick={() => addTrackBlock(contextMenu.data.track.id, contextMenu.data.time)}>
                ➕ Add Block Here
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  if (window.confirm(`Clear all blocks in track "${contextMenu.data.track.name}"?`)) {
                    saveTracks(tracksRef.current.map(t => t.id === contextMenu.data.track.id ? { ...t, blocks: [] } : t));
                  }
                }}
              >
                🧹 Clear Track
              </ContextMenuItem>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
              <ContextMenuItem
                onClick={() => {
                  if (window.confirm(`Delete track "${contextMenu.data.track.name}"?`)) {
                    deleteTrack(contextMenu.data.track.id);
                  }
                }}
                style={{ color: '#f43f5e' }}
              >
                🗑 Delete Track
              </ContextMenuItem>
            </>
          )}
        </div>
      )}

    </div>
  );
};

export default ArrangementTimelineWidget;
