import React, { useState, useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';
import { usePlayheadAnnouncer, playheadSrOnlyStyle } from '../utils/playheadAnnouncer.js';

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

  // ── Existing section state ──
  const [selectedBlockId, setSelectedBlockId]   = useState(null);
  const [showAdvanced,    setShowAdvanced]       = useState(false);

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
    saveTracks(tracks.filter(t => t.id !== trackId));
    if (selectedTrackBlock?.trackId === trackId) setSelectedTrackBlock(null);
  };
  const addTrackBlock = (trackId, startSec) => {
    const defDur = viewMode === 'bars' ? snapDurBars(16, bpm) : 16;
    const tb = {
      id: 'tb-' + Date.now() + Math.random().toString(36).substr(2, 5),
      startTime: Math.max(0, startSec), duration: defDur,
    };
    const next = tracks.map(t => t.id === trackId ? { ...t, blocks: [...t.blocks, tb] } : t);
    saveTracks(next);
    setSelectedTrackBlock({ trackId, blockId: tb.id });
  };
  const updateTrackBlock = (trackId, blockId, fields) => {
    saveTracks(tracks.map(t => t.id !== trackId ? t : {
      ...t, blocks: t.blocks.map(b => b.id === blockId ? { ...b, ...fields } : b),
    }));
  };
  const deleteTrackBlock = (trackId, blockId) => {
    saveTracks(tracks.map(t => t.id !== trackId ? t : {
      ...t, blocks: t.blocks.filter(b => b.id !== blockId),
    }));
    setSelectedTrackBlock(null);
  };

  // ── Section resize drag ──
  const handleSectionResize = (e, block) => {
    e.preventDefault(); e.stopPropagation();
    if (readOnly) return;
    const startX = e.clientX;
    const startDur = block.duration || 30;
    const onMove = (me) => {
      let delta = (me.clientX - startX) / pxPerSec;
      let dur = Math.max(1, startDur + delta);
      dur = viewMode === 'bars' ? snapDurBars(dur, bpm) : Math.round(dur);
      onChange('arrangement-timeline', JSON.stringify(
        blocks.map(b => b.id === block.id ? { ...b, duration: dur } : b)
      ));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (saveNow) saveNow();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Track block resize drag ──
  const handleTrackBlockResize = (e, track, block) => {
    e.preventDefault(); e.stopPropagation();
    if (readOnly) return;
    const startX = e.clientX;
    const startDur = block.duration || 8;
    const onMove = (me) => {
      let dur = Math.max(1, startDur + (me.clientX - startX) / pxPerSec);
      dur = viewMode === 'bars' ? snapDurBars(dur, bpm) : Math.max(1, Math.round(dur));
      updateTrackBlock(track.id, block.id, { duration: dur });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (saveNow) saveNow();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Track block move drag ──
  const handleTrackBlockMove = (e, track, block) => {
    e.preventDefault(); e.stopPropagation();
    if (readOnly) return;
    const startX = e.clientX;
    const startSec = block.startTime || 0;
    let didMove = false;
    const onMove = (me) => {
      didMove = true;
      let s = Math.max(0, startSec + (me.clientX - startX) / pxPerSec);
      s = viewMode === 'bars' ? snapStartBars(s, bpm) : Math.round(s);
      updateTrackBlock(track.id, block.id, { startTime: s });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (saveNow && didMove) saveNow();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── Lane click → add block ──
  const handleLaneClick = (e, track) => {
    if (readOnly) return;
    if (e.target.closest('[data-track-block]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    let s = (e.clientX - rect.left) / pxPerSec;
    s = viewMode === 'bars' ? snapStartBars(s, bpm) : Math.round(s);
    addTrackBlock(track.id, s);
  };

  // ── Ruler rendering ──
  const renderRuler = () => {
    const ticks = [];
    if (viewMode === 'bars') {
      const totalBarsCount = Math.ceil((totalDuration / 60) * (bpm / 4));
      let interval = 1;
      if (totalBarsCount > 128) interval = 16;
      else if (totalBarsCount > 64) interval = 8;
      else if (totalBarsCount > 32) interval = 4;
      else if (totalBarsCount > 16) interval = 2;

      for (let bar = 1; bar <= totalBarsCount + interval; bar += interval) {
        const left = barToSec(bar, bpm) * pxPerSec;
        if (left > contentWidth + 20) break;
        ticks.push(
          <div key={bar} style={{ position: 'absolute', left, top: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)' }}>
            <span style={{ fontSize: '10px', fontFamily: '"Roboto Mono", monospace', color: bar === 1 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', paddingTop: '5px', letterSpacing: '0.02em' }}>
              {bar === 1 ? 'Bar 1' : bar}
            </span>
            <div style={{ width: '1px', height: '6px', background: 'rgba(255,255,255,0.12)', marginTop: '2px' }} />
          </div>
        );
      }
    } else {
      const tickInterval = totalDuration > 360 ? 60 : 30;
      for (let t = 0; t <= totalDuration + tickInterval; t += tickInterval) {
        const left = t * pxPerSec;
        if (left > contentWidth + 20) break;
        ticks.push(
          <div key={t} style={{ position: 'absolute', left, top: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'translateX(-50%)' }}>
            <span style={{ fontSize: '10px', fontFamily: '"Roboto Mono", monospace', color: t === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap', paddingTop: '5px' }}>
              {formatTime(t)}
            </span>
            <div style={{ width: '1px', height: '6px', background: 'rgba(255,255,255,0.12)', marginTop: '2px' }} />
          </div>
        );
      }
    }
    return ticks;
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
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedBlockId, sortedBlocks, readOnly, selectedTrackBlock, bpm, viewMode]);

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

        {/* Right: Add Section button */}
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

                {/* Ruler */}
                <div style={{
                  height: 28, position: 'relative',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: '#08080b', overflow: 'hidden',
                }}>
                  {renderRuler()}
                </div>

                {/* Sections row */}
                {sortedBlocks.length > 0 && (
                  <div style={{
                    height: SECTION_ROW_H, position: 'relative',
                    background: '#070709',
                    borderBottom: tracks.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}>
                    {/* Decorative waveform background — continuous amplitude peaks */}
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.08 }} preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#00e5ff" stopOpacity="1" />
                          <stop offset="50%" stopColor="#ff6600" stopOpacity="0.5" />
                          <stop offset="100%" stopColor="#00e5ff" stopOpacity="1" />
                        </linearGradient>
                        <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
                        </linearGradient>
                      </defs>
                      {/* Continuous waveform path — amplitude peaks */}
                      {(() => {
                        const points = 200;
                        const midY = 50;
                        let path1 = '';
                        let path2 = '';
                        let pathMirror1 = '';
                        let pathMirror2 = '';
                        for (let i = 0; i <= points; i++) {
                          const x = (i / points) * 100;
                          const noise1 = Math.sin(i * 0.06 + 2) * 22 + Math.cos(i * 0.17) * 14 + Math.sin(i * 0.4 + 1) * 8 + Math.cos(i * 0.03) * 5;
                          const noise2 = Math.cos(i * 0.09) * 12 + Math.sin(i * 0.28) * 7 + Math.cos(i * 0.5 + 3) * 5;
                          const y1 = midY - noise1;
                          const y2 = midY - noise2;
                          const prefix = i === 0 ? 'M' : 'L';
                          path1 += `${prefix}${x} ${y1} `;
                          pathMirror1 = `${i === 0 ? 'M' : 'L'}${x} ${midY + noise1} ` + pathMirror1;
                          path2 += `${prefix}${x} ${y2} `;
                          pathMirror2 = `${i === 0 ? 'M' : 'L'}${x} ${midY + noise2} ` + pathMirror2;
                        }
                        return (
                          <>
                            <path d={path1 + pathMirror1} fill="url(#waveGrad)" />
                            <path d={path2 + pathMirror2} fill="url(#waveGrad2)" />
                          </>
                        );
                      })()}
                    </svg>

                    {/* Section blocks */}
                    {sortedBlocks.map(block => {
                      const left    = (block.startTime || 0) * pxPerSec;
                      const width   = Math.max(80, (block.duration || 30) * pxPerSec);
                      const isSel   = block.id === selectedBlockId;
                      const isCur   = activeBlock?.id === block.id;
                      const color   = TYPE_COLORS[block.type] || TYPE_COLORS.custom;
                      const prog    = isCur ? Math.min(100, Math.max(0, ((currentTime - (block.startTime || 0)) / (block.duration || 1)) * 100)) : 0;

                      return (
                        <div
                          key={block.id}
                          onClick={() => !readOnly ? setSelectedBlockId(isSel ? null : block.id) : handleSeek(block.startTime || 0)}
                          title={block.notes ? `Observations: ${block.notes}` : `Click to ${readOnly ? 'seek' : 'edit'}`}
                          style={{
                            position: 'absolute', left, top: 8, bottom: 8, width,
                            background: isSel ? `${color}40` : `${color}18`,
                            border: `1px solid ${isSel ? '#ff6600' : color}`,
                            borderLeft: `4px solid ${color}`,
                            borderRadius: '3px', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                            padding: '8px 10px',
                            transition: 'background-color 0.15s, border-color 0.15s, box-shadow 0.15s',
                            boxShadow: isSel ? '0 0 12px rgba(255,102,0,0.25)' : isCur ? `0 0 8px ${color}30` : 'none',
                            overflow: 'hidden', userSelect: 'none', zIndex: isSel ? 3 : 1,
                          }}
                        >
                          {/* Playback progress strip */}
                          {isCur && (
                            <div style={{ position: 'absolute', left: 0, bottom: 0, height: '2px', background: color, width: `${prog}%`, transition: 'width 0.4s linear', zIndex: 1 }} />
                          )}

                          {/* Block header */}
                          <div>
                            <span style={{ fontWeight: '600', fontSize: '12px', color: isSel ? '#ffffff' : 'rgba(255,255,255,0.85)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {block.name}
                            </span>
                            {block.notes && (
                              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.28)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px', fontStyle: 'italic' }}>
                                {block.notes}
                              </span>
                            )}
                          </div>

                          {/* Block footer: bar range OR mm:ss */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: '"Roboto Mono", monospace', fontSize: '10px', color, fontWeight: 'bold' }}>
                              {viewMode === 'bars'
                                ? formatBarRange(block.startTime || 0, block.duration || 30)
                                : formatTime(block.startTime)}
                            </span>
                            <span style={{ fontFamily: '"Roboto Mono", monospace', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                              {viewMode === 'bars'
                                ? formatDurBars(block.duration || 30)
                                : `${block.duration}s`}
                            </span>
                          </div>

                          {/* Resize handle */}
                          {!readOnly && (
                            <div
                              onMouseDown={e => handleSectionResize(e, block)}
                              onClick={e => e.stopPropagation()}
                              title="Drag to resize"
                              style={{
                                position: 'absolute', right: 0, top: 0, bottom: 0, width: '7px',
                                cursor: 'col-resize', zIndex: 5,
                                background: isSel ? 'rgba(255,102,0,0.1)' : 'transparent',
                              }}
                            >
                              <div style={{ width: '2px', height: '16px', background: isSel ? '#ff6600' : 'rgba(255,255,255,0.1)', margin: 'auto', position: 'absolute', top: 0, bottom: 0, right: '2px', borderRadius: '1px' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Playhead */}
                    {playheadLeft !== null && (
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: playheadLeft, width: '2px', background: 'var(--accent-cyan)', boxShadow: '0 0 6px var(--accent-cyan)', pointerEvents: 'none', zIndex: 10, transition: 'none' }}>
                        <div style={{
                          position: 'absolute',
                          top: -1,
                          left: '-5px',
                          width: '12px',
                          height: '9px',
                          background: 'var(--accent-cyan)',
                          clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)'
                        }} />
                      </div>
                    )}
                  </div>
                )}

                {/* ── INSTRUMENT TRACK LANES ───────────────────────────── */}
                {tracks.map((track, idx) => (
                  <div
                    key={track.id}
                    onClick={e => handleLaneClick(e, track)}
                    title={readOnly ? undefined : 'Click empty space to add an activity block'}
                    style={{
                      height: TRACK_ROW_H, position: 'relative',
                      background: idx % 2 === 0 ? '#070709' : '#08080b',
                      borderBottom: idx < tracks.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      cursor: readOnly ? 'default' : 'crosshair',
                    }}
                  >
                    {track.blocks.map(block => {
                      const left  = (block.startTime || 0) * pxPerSec;
                      const width = Math.max(18, (block.duration || 8) * pxPerSec);
                      const isSel = selectedTrackBlock?.trackId === track.id && selectedTrackBlock?.blockId === block.id;

                      return (
                        <div
                          key={block.id}
                          data-track-block="true"
                          onClick={e => { e.stopPropagation(); setSelectedTrackBlock(isSel ? null : { trackId: track.id, blockId: block.id }); }}
                          onMouseDown={e => handleTrackBlockMove(e, track, block)}
                          style={{
                            position: 'absolute', left, top: 7, bottom: 7, width,
                            background: isSel ? `${track.color}45` : `${track.color}28`,
                            border: `1px solid ${isSel ? track.color : track.color + '70'}`,
                            borderRadius: '3px',
                            cursor: 'grab',
                            display: 'flex', alignItems: 'center', paddingLeft: '6px',
                            overflow: 'hidden', userSelect: 'none', zIndex: isSel ? 5 : 2,
                            boxShadow: isSel ? `0 0 8px ${track.color}35` : 'none',
                            transition: 'background 0.1s, box-shadow 0.1s',
                          }}
                        >
                          {/* Label */}
                          <span style={{ fontSize: '9px', fontFamily: '"Roboto Mono", monospace', color: track.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', pointerEvents: 'none', letterSpacing: '0.02em' }}>
                            {viewMode === 'bars'
                              ? formatBarRange(block.startTime || 0, block.duration || 8)
                              : formatTime(block.startTime)}
                          </span>

                          {/* Resize handle */}
                          {!readOnly && (
                            <div
                              onMouseDown={e => { e.stopPropagation(); handleTrackBlockResize(e, track, block); }}
                              onClick={e => e.stopPropagation()}
                              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 5 }}
                            >
                              <div style={{ width: '2px', height: '10px', background: track.color, opacity: isSel ? 0.9 : 0.4, margin: 'auto', position: 'absolute', top: 0, bottom: 0, right: '1px', borderRadius: '1px' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Playhead through track */}
                    {playheadLeft !== null && (
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: playheadLeft, width: '2px', background: 'var(--accent-cyan)', opacity: 0.5, pointerEvents: 'none', zIndex: 10, transition: 'none' }} />
                    )}
                  </div>
                ))}

                {/* Spacer below last track for Add Track row */}
                {!readOnly && <div style={{ height: 40 }} />}

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

    </div>
  );
};

export default ArrangementTimelineWidget;
