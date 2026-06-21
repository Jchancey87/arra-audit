import React, { useState, useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { usePlayheadAnnouncer, playheadSrOnlyStyle } from '../utils/playheadAnnouncer.js';
import { applyBlockClick, detectModifier, pruneSelection } from '../utils/blockSelection.js';
const ExportArrangementButton = React.lazy(() => import('./ExportArrangementButton.jsx'));
import WaveformTimelineOverlay from './WaveformTimelineOverlay.jsx';

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
const HEADER_H      = 28;   // height of the ruler header
const SECTION_ROW_H = 114;  // height of the sections row
const TRACK_ROW_H   = 46;   // height of each instrument track lane

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
const ArrangementTimelineWidget = ({ responses, onChange, song, lensData, readOnly = false, saveNow, hideWaveform = false }) => {
  const { loadSong, activeSong, play, seekTo, currentTime, audioRef } = useAudio();

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

  // ── Drag & Resize Refs ──
  const isDraggingRef = useRef(false);
  const isResizingRef = useRef(false);
  const dragStartInfoRef = useRef(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, []);

  // ── Existing section state ──
  const [selectedBlockId, setSelectedBlockId]   = useState(null);
  const [showAdvanced,    setShowAdvanced]       = useState(false);

  // ── Multi-select (bulk delete) ──
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

  // Announcement for playhead status updates (accessibility)
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

  // ── DOM Drag Listeners ──
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

  // ── DOM click routing handlers ──

  const handleRulerMouseDown = (e) => {
    const isRightClick = e.button === 2 || e.ctrlKey;
    if (isRightClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedTime = clickX / pxPerSec;
    handleSeek(clickedTime);
  };

  const handleSectionsLaneMouseDown = (e) => {
    const isRightClick = e.button === 2 || e.ctrlKey;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedTime = clickX / pxPerSec;

    if (isRightClick) {
      handleContextMenu(e, 'sections-lane', { time: clickedTime });
    } else {
      setSelectedBlockId(null);
      setSelectedTrackBlock(null);
      setMultiSelectedIds(new Set());
    }
  };

  const handleTrackLaneMouseDown = (e, track) => {
    if (e.target !== e.currentTarget) return; // ignore clicks on blocks themselves
    const isRightClick = e.button === 2 || e.ctrlKey;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickedTime = clickX / pxPerSec;

    if (isRightClick) {
      handleContextMenu(e, 'track-lane', { track, time: clickedTime });
    } else if (!readOnly) {
      let s = clickedTime;
      s = viewMode === 'bars' ? snapStartBars(s, bpm) : Math.round(s);
      addTrackBlock(track.id, s);
    }
  };

  const handleSectionBlockMouseDown = (e, block) => {
    if (readOnly) return;
    e.stopPropagation();
    const isRightClick = e.button === 2 || e.ctrlKey;
    if (isRightClick) {
      handleContextMenu(e, 'section-block', { block });
      return;
    }

    isDraggingRef.current = true;
    dragStartInfoRef.current = {
      type: 'section-move',
      block,
      startX: e.clientX,
      startY: e.clientY,
      isActualDrag: false,
    };
    registerDragListeners();
  };

  const handleSectionResizeMouseDown = (e, block) => {
    e.stopPropagation();
    isResizingRef.current = true;
    dragStartInfoRef.current = {
      type: 'section-resize',
      block,
      startX: e.clientX,
      startDur: block.duration || 30,
    };
    registerDragListeners();
  };

  const handleTrackBlockMouseDown = (e, track, block) => {
    if (readOnly) return;
    e.stopPropagation();
    const isRightClick = e.button === 2 || e.ctrlKey;
    if (isRightClick) {
      handleContextMenu(e, 'track-block', { track, block });
      return;
    }

    isDraggingRef.current = true;
    dragStartInfoRef.current = {
      type: 'track-block-move',
      track,
      block,
      startX: e.clientX,
      startSec: block.startTime || 0,
      didMove: false,
    };
    registerDragListeners();
  };

  const handleTrackBlockResizeMouseDown = (e, track, block) => {
    e.stopPropagation();
    isResizingRef.current = true;
    dragStartInfoRef.current = {
      type: 'track-block-resize',
      track,
      block,
      startX: e.clientX,
      startDur: block.duration || 8,
    };
    registerDragListeners();
  };

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

  // ── DOM Ruler Ticks & Grid Lines Generators ──

  const renderRulerTicks = () => {
    const ticks = [];
    if (viewMode === 'bars') {
      const totalBarsCount = Math.ceil((totalDuration / 60) * (bpm / 4));
      let interval = 1;
      if (totalBarsCount > 128) interval = 16;
      else if (totalBarsCount > 64) interval = 8;
      else if (totalBarsCount > 32) interval = 4;
      else if (totalBarsCount > 16) interval = 2;

      for (let bar = 1; bar <= totalBarsCount + interval; bar += interval) {
        const x = barToSec(bar, bpm) * pxPerSec;
        if (x > contentWidth + 20) break;
        ticks.push(
          <div key={`bar-${bar}`} style={{ position: 'absolute', left: x, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: '10px', fontFamily: '"Roboto Mono", monospace', color: bar === 1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)', transform: 'translateY(2px)' }}>
              {bar === 1 ? 'Bar 1' : String(bar)}
            </span>
            <div style={{ width: '1px', height: '6px', background: 'rgba(255,255,255,0.12)', position: 'absolute', bottom: 0 }} />
          </div>
        );
      }
    } else {
      const tickInterval = totalDuration > 360 ? 60 : 30;
      for (let t = 0; t <= totalDuration + tickInterval; t += tickInterval) {
        const x = t * pxPerSec;
        if (x > contentWidth + 20) break;
        ticks.push(
          <div key={`sec-${t}`} style={{ position: 'absolute', left: x, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: '10px', fontFamily: '"Roboto Mono", monospace', color: t === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)', transform: 'translateY(2px)' }}>
              {formatTime(t)}
            </span>
            <div style={{ width: '1px', height: '6px', background: 'rgba(255,255,255,0.12)', position: 'absolute', bottom: 0 }} />
          </div>
        );
      }
    }
    return ticks;
  };

  const renderGridLines = () => {
    const gridLines = [];
    if (viewMode === 'bars') {
      const totalBarsCount = Math.ceil((totalDuration / 60) * (bpm / 4));
      let interval = 1;
      if (totalBarsCount > 128) interval = 16;
      else if (totalBarsCount > 64) interval = 8;
      else if (totalBarsCount > 32) interval = 4;
      else if (totalBarsCount > 16) interval = 2;

      for (let bar = 1; bar <= totalBarsCount + interval; bar += interval) {
        const x = barToSec(bar, bpm) * pxPerSec;
        if (x > contentWidth + 20) break;
        gridLines.push(
          <div key={`grid-bar-${bar}`} style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
        );
      }
    } else {
      const tickInterval = totalDuration > 360 ? 60 : 30;
      for (let t = 0; t <= totalDuration + tickInterval; t += tickInterval) {
        const x = t * pxPerSec;
        if (x > contentWidth + 20) break;
        gridLines.push(
          <div key={`grid-sec-${t}`} style={{ position: 'absolute', left: x, top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
        );
      }
    }
    return gridLines;
  };

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

          {/* Multi-select bulk action */}
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
          <React.Suspense fallback={<span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Export</span>}>
            <ExportArrangementButton
              sections={sortedBlocks}
              tracks={tracks}
              song={song}
              bpm={bpm}
              timeSignature={timeSignature}
              viewMode={viewMode}
              readOnly={readOnly}
            />
          </React.Suspense>
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
          WAVEFORM OVERLAY (wavesurfer.js — attached to the shared <audio>)
          Skipped when hideWaveform is set — the caller (e.g.
          StudySessionWorkspace) renders the universal UniversalWaveformBar
          above instead, so we avoid two WaveSurfer.create() instances
          attaching to the same <audio>.
      ══════════════════════════════════════════════════════════════════════ */}
      {!hideWaveform && song?.publicUrl && audioRef?.current && (
        <div style={{
          background: '#0c0c0f', borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden',
        }}>
          <div style={{ height: '22px', display: 'flex', alignItems: 'center', paddingLeft: '12px', background: '#0a0a0d', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontFamily: '"Roboto Mono", monospace', letterSpacing: '0.06em' }}>
              ▨ WAVEFORM
            </span>
          </div>
          <WaveformTimelineOverlay
            audioRef={audioRef}
            regions={sortedBlocks.map((b) => {
              const color = TYPE_COLORS[b.type] || TYPE_COLORS.custom;
              const isSel = b.id === selectedBlockId;
              return {
                id: b.id,
                start: b.startTime || 0,
                end: (b.startTime || 0) + Math.max(1, b.duration || 30),
                color,
                label: b.name || '',
                drag: true,
                resize: isSel,
                selected: isSel,
              };
            })}
            pxPerSec={pxPerSec}
            currentTime={currentTime}
            onRegionClick={(sectionId) => {
              setSelectedBlockId(sectionId);
              if (sectionId) {
                const sec = sortedBlocks.find(b => b.id === sectionId);
                if (sec) handleSeek(sec.startTime || 0);
              }
            }}
            onRegionUpdate={(sectionId, { start, end }) => {
              updateBlock(sectionId, {
                startTime: start,
                duration: Math.max(1, end - start),
              });
              if (saveNow) setTimeout(saveNow, 100);
            }}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          EMPTY STATE
      ══════════════════════════════════════════════════════════════════════ */}
      {!hasContent && (
        <div style={{
          padding: '50px 20px', textAlign: 'center', background: 'var(--bg-surface-0)',
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
        <div style={{ background: 'var(--bg-surface-0)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>

          <div style={{ display: 'flex' }}>

            {/* ── LEFT GUTTER ─────────────────────────────────────────────── */}
            <div style={{
              width: GUTTER_W, minWidth: GUTTER_W, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-surface-0)',
              borderRight: '1px solid rgba(255,255,255,0.06)',
              zIndex: 3,
            }}>
              {/* Ruler label row */}
              <div style={{ height: HEADER_H, display: 'flex', alignItems: 'center', paddingLeft: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', boxSizing: 'border-box' }}>
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
                  boxSizing: 'border-box',
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
                  boxSizing: 'border-box',
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
              <div 
                style={{ 
                  minWidth: contentWidth, 
                  width: contentWidth,
                  position: 'relative', 
                  height: HEADER_H + SECTION_ROW_H + tracks.length * TRACK_ROW_H,
                  background: '#0c0c0f',
                  userSelect: 'none',
                }}
              >
                {/* 1. RULER */}
                <div 
                  data-testid="timeline-ruler"
                  onMouseDown={handleRulerMouseDown}
                  style={{ 
                    position: 'absolute', 
                    left: 0, 
                    right: 0, 
                    top: 0, 
                    height: HEADER_H, 
                    background: '#08080b', 
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {renderRulerTicks()}
                </div>

                {/* 2. SECTIONS LANE */}
                <div 
                  data-testid="sections-lane"
                  onMouseDown={handleSectionsLaneMouseDown}
                  style={{ 
                    position: 'absolute', 
                    left: 0, 
                    right: 0, 
                    top: HEADER_H, 
                    height: SECTION_ROW_H, 
                    background: '#070709', 
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Waveform Background Decoration */}
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.08 }} preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path d="M 0 50 Q 25 10, 50 50 T 100 50 Q 75 90, 50 50 T 0 50" fill="url(#waveGrad)" />
                    <path d="M 0 50 Q 15 20, 40 50 T 80 50 Q 60 80, 30 50 T 0 50" fill="url(#waveGrad2)" />
                    <defs>
                      <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#00e5ff" />
                        <stop offset="50%" stopColor="#ff6600" />
                        <stop offset="100%" stopColor="#00e5ff" />
                      </linearGradient>
                      <linearGradient id="waveGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Section Grid Vertical Lines */}
                  {renderGridLines()}

                  {/* Section Blocks */}
                  {sortedBlocks.map(block => {
                    const color = TYPE_COLORS[block.type] || TYPE_COLORS.custom;
                    const isSel = block.id === selectedBlockId;
                    const isMulti = multiSelectedIds.has(block.id);
                    const isCur = activeBlock?.id === block.id;
                    const bx = (block.startTime || 0) * pxPerSec;
                    const bw = Math.max(80, (block.duration || 30) * pxPerSec);
                    const by = 8;
                    const bh = SECTION_ROW_H - 16;

                    const timeStr = viewMode === 'bars'
                      ? formatBarRange(block.startTime || 0, block.duration || 30)
                      : formatTime(block.startTime);

                    const durStr = viewMode === 'bars'
                      ? formatDurBars(block.duration || 30)
                      : `${block.duration}s`;

                    return (
                      <div
                        key={block.id}
                        data-testid={`section-block-${block.id}`}
                        onMouseDown={(e) => handleSectionBlockMouseDown(e, block)}
                        style={{
                          position: 'absolute',
                          left: bx,
                          width: bw,
                          top: by,
                          height: bh,
                          background: isSel || isMulti ? `${color}40` : `${color}18`,
                          border: isSel ? '1.5px solid #ff6600' : isMulti ? '1px solid #fbbf24' : `1px solid ${color}`,
                          borderRadius: '3px',
                          cursor: readOnly ? 'default' : 'grab',
                          boxSizing: 'border-box',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '8px',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Left solid indicator */}
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: color }} />

                        {/* Title */}
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: isSel ? '#ffffff' : 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '4px' }}>
                          {block.name}
                        </div>

                        {/* Notes snippet */}
                        {block.notes && (
                          <div style={{ fontSize: '10px', fontStyle: 'italic', color: 'rgba(255,255,255,0.28)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: '4px' }}>
                            {block.notes}
                          </div>
                        )}

                        {/* Footer row */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingLeft: '4px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: '"Roboto Mono", monospace', color }}>
                            {timeStr}
                          </span>
                          <span style={{ fontSize: '10px', fontFamily: '"Roboto Mono", monospace', color: 'rgba(255,255,255,0.3)' }}>
                            {durStr}
                          </span>
                        </div>

                        {/* Progress Bar (Active) */}
                        {isCur && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: color }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, ((currentTime - (block.startTime || 0)) / (block.duration || 1)) * 100))}%`, height: '100%', background: '#fff', opacity: 0.8 }} />
                          </div>
                        )}

                        {/* Right Edge Resize Handle */}
                        {isSel && !readOnly && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: '8px',
                              cursor: 'col-resize',
                              zIndex: 2,
                            }}
                            onMouseDown={(e) => handleSectionResizeMouseDown(e, block)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 3. TRACK LANES */}
                {tracks.map((track, trackIdx) => {
                  const ty = HEADER_H + SECTION_ROW_H + trackIdx * TRACK_ROW_H;
                  return (
                    <div
                      key={track.id}
                      data-track-id={track.id}
                      data-testid={`track-lane-${track.id}`}
                      onMouseDown={(e) => handleTrackLaneMouseDown(e, track)}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: ty,
                        height: TRACK_ROW_H,
                        background: trackIdx % 2 === 0 ? 'rgba(255,255,255,0.005)' : 'rgba(255,255,255,0.015)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        overflow: 'hidden',
                        boxSizing: 'border-box',
                        cursor: readOnly ? 'default' : 'crosshair',
                      }}
                    >
                      {/* Track Grid Lines */}
                      {renderGridLines()}

                      {/* Track Blocks */}
                      {(track.blocks || []).map(block => {
                        const bx = (block.startTime || 0) * pxPerSec;
                        const bw = Math.max(18, (block.duration || 8) * pxPerSec);
                        const bh = TRACK_ROW_H - 14;
                        const by = 7;

                        const isSel = selectedTrackBlock?.trackId === track.id && selectedTrackBlock?.blockId === block.id;
                        const isMulti = multiSelectedIds.has(block.id);

                        const clipStr = viewMode === 'bars'
                          ? formatBarRange(block.startTime || 0, block.duration || 8)
                          : formatTime(block.startTime);

                        return (
                          <div
                            key={block.id}
                            data-testid={`track-block-${block.id}`}
                            onMouseDown={(e) => handleTrackBlockMouseDown(e, track, block)}
                            style={{
                              position: 'absolute',
                              left: bx,
                              width: bw,
                              top: by,
                              height: bh,
                              background: isSel || isMulti ? `${track.color}45` : `${track.color}28`,
                              border: isSel ? `1.5px solid ${track.color}` : isMulti ? '1px solid #fbbf24' : `${track.color}70`,
                              borderRadius: '3px',
                              cursor: readOnly ? 'default' : 'grab',
                              boxSizing: 'border-box',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0 6px',
                              overflow: 'hidden',
                            }}
                          >
                            <span style={{ fontSize: '9px', fontWeight: 'bold', fontFamily: '"Roboto Mono", monospace', color: track.color, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {clipStr}
                            </span>

                            {/* Right Edge Resize Handle */}
                            {isSel && !readOnly && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  bottom: 0,
                                  width: '6px',
                                  cursor: 'col-resize',
                                  zIndex: 2,
                                }}
                                onMouseDown={(e) => handleTrackBlockResizeMouseDown(e, track, block)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* 4. PLAYHEAD */}
                {playheadLeft !== null && playheadLeft <= contentWidth && (
                  <div
                    style={{
                      position: 'absolute',
                      left: playheadLeft,
                      top: 0,
                      bottom: 0,
                      width: '1.5px',
                      background: '#00e5ff',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    {/* Playhead handle at the top */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-5px',
                        top: 0,
                        width: 0,
                        height: 0,
                        borderLeft: '5px solid transparent',
                        borderRight: '5px solid transparent',
                        borderTop: '7px solid #00e5ff',
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── ADD TRACK INLINE FORM ────────────────────────────────────── */}
          {!readOnly && showAddTrack && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px', background: 'var(--bg-surface-0)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '11px 16px', background: 'var(--bg-surface-0)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
        <div style={{ background: 'var(--bg-surface-0)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '20px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>

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
                      <input
                        type="number"
                        value={Math.max(1, Math.round(selectedBlock.duration / barDurSecs(bpm)))}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10) || 1;
                          updateBlock(selectedBlock.id, { duration: Math.max(1, v * barDurSecs(bpm)) });
                        }}
                        min={1}
                        style={{ width: '100%', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px', color: '#ffffff', fontSize: '14px', outline: 'none', fontFamily: '"Roboto Mono", monospace' }}
                      />
                    ) : (
                      <input
                        type="number"
                        value={selectedBlock.duration}
                        onChange={e => updateBlock(selectedBlock.id, { duration: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        min={1}
                        style={{ width: '100%', background: '#161619', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '10px 12px', color: '#ffffff', fontSize: '14px', outline: 'none', fontFamily: '"Roboto Mono", monospace' }}
                      />
                    )}
                    <span style={{ position: 'absolute', right: '8px', top: '11px', fontSize: '11px', color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}>
                      {viewMode === 'bars' ? 'Bars' : 'Dur(s)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section Type Selector */}
              <div>
                <label style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '6px' }}>Section Type (Theme Color)</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {Object.keys(TYPE_COLORS).map(type => (
                    <button
                      key={type} type="button"
                      onClick={() => updateBlock(selectedBlock.id, { type })}
                      style={{
                        padding: '6px 12px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer',
                        background: selectedBlock.type === type ? TYPE_COLORS[type] : '#161619',
                        color:      selectedBlock.type === type ? '#151518' : 'rgba(255,255,255,0.6)',
                        border: selectedBlock.type === type ? `1px solid ${TYPE_COLORS[type]}` : '1px solid rgba(255,255,255,0.08)',
                        fontWeight: selectedBlock.type === type ? 'bold' : 'normal',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Actions (Play, Sync, Close) */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
              <button
                type="button" onClick={() => handleSeek(selectedBlock.startTime || 0)}
                style={{ padding: '6px 16px', fontSize: '13px', background: 'rgba(255,102,0,0.12)', color: '#ff6600', border: '1px solid rgba(255,102,0,0.4)', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace', fontWeight: 'bold' }}
              >
                ▶ Play Section
              </button>
              <button
                type="button" onClick={() => updateBlock(selectedBlock.id, { startTime: Math.floor(currentTime) })}
                title="Align start boundary to player timeline position"
                style={{ padding: '6px 14px', fontSize: '13px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', cursor: 'pointer', fontFamily: '"Roboto Mono", monospace' }}
              >
                🎯 Sync to Playhead
              </button>
              <button
                type="button" onClick={() => setSelectedBlockId(null)}
                style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: '13px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', cursor: 'pointer' }}
              >
                Close Inspector
              </button>
            </div>

            {/* Template Answers / Questions Section */}
            {lensData?.templateQuestions && lensData.templateQuestions.length > 0 && (
              <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '11px', fontFamily: '"Roboto Mono", monospace', color: '#ff6600', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Observations & Structural Auditing questions
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer', outline: 'none', textDecoration: 'underline' }}
                  >
                    {showAdvanced ? 'Hide inactive questions' : 'Show all questions'}
                  </button>
                </div>

                {lensData.templateQuestions.map((q) => {
                  const key = `section-${selectedBlock.id}-q-${q.id}`;
                  const isAnswered = !!responses[key];
                  const shouldShow = showAdvanced || isAnswered || q.required;
                  if (!shouldShow) return null;

                  const question = q.text || q.label || 'Observation Prompt';
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
        </div>
      )}

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
