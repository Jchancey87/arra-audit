import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBackend } from './BackendContext';

const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const backend = useBackend();

  // Active song + transport state
  const [activeSong, setActiveSong] = useState(null);
  const [activeAudit, setActiveAudit] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  // Floating monitor for the song cover/thumbnail (since we no longer
  // have a video, we just show the thumbnail + playback controls).
  const [showMonitor, setShowMonitor] = useState(true);
  const [videoDock, setVideoDock] = useState('float');
  const [focusMode, setFocusMode] = useState(false);
  const [dockedTarget, setDockedTarget] = useState(null);

  const [bottomOpen, setBottomOpen] = useState(true);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  // Deep-link highlight: id of the bookmark currently pulsing in the UI.
  // Cleared automatically after 4s so the visual cue fades.
  const [highlightBookmarkId, setHighlightBookmarkId] = useState(null);
  const highlightTimeoutRef = useRef(null);

  // The single <audio> element that drives ALL playback. wavesurfer in the
  // arrangement timeline attaches to this same element via the `media:`
  // option so we never have two audio engines playing the same source.
  const audioRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Sync bookmarks if active audit updates
  useEffect(() => {
    if (activeAudit) {
      setBookmarks(activeAudit.bookmarks || []);
    } else {
      setBookmarks([]);
    }
  }, [activeAudit]);

  // Poll currentTime smoothly via requestAnimationFrame when playing.
  // <audio> fires `timeupdate` only ~4×/sec which feels choppy; rAF gives
  // us 60fps for playhead motion in the arranger waveform.
  useEffect(() => {
    if (!isPlaying) {
      // One final sync on pause so the playhead settles.
      if (audioRef.current) {
        const t = audioRef.current.currentTime;
        if (typeof t === 'number' && !isNaN(t)) setCurrentTime(t);
      }
      return;
    }
    let lastTime = -1;
    const poll = () => {
      const el = audioRef.current;
      if (el && typeof el.currentTime === 'number') {
        const t = el.currentTime;
        if (!isNaN(t) && t !== lastTime) {
          lastTime = t;
          setCurrentTime(t);
        }
      }
      animationFrameRef.current = requestAnimationFrame(poll);
    };
    animationFrameRef.current = requestAnimationFrame(poll);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  // Safely resolve and track container element for portal docking
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (videoDock === 'left' || videoDock === 'right') {
      const el = document.getElementById('docked-monitor-container');
      if (el) {
        setDockedTarget(el);
      } else {
        let rafId;
        const check = () => {
          const target = document.getElementById('docked-monitor-container');
          if (target) setDockedTarget(target);
          else rafId = requestAnimationFrame(check);
        };
        rafId = requestAnimationFrame(check);
        return () => { if (rafId) cancelAnimationFrame(rafId); };
      }
    } else {
      setDockedTarget(null);
    }
  }, [videoDock, activeSong, showMonitor, focusMode]);

  // ── Transport API ────────────────────────────────────────────────────────

  const loadSong = async (song) => {
    if (!song) return;
    setIsAudioLoading(true);
    setCurrentTime(0);
    setDuration(song.durationSeconds || 0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // If the song's audio hasn't been downloaded yet (in-flight background
    // download after import), poll the /audio-url endpoint until it lands.
    // Cap at ~6s so we don't hang the UI forever.
    let finalSong = song;
    if (!song.publicUrl && backend?.getAudioFallbackUrl && song._id) {
      const start = Date.now();
      while (Date.now() - start < 6000) {
        try {
          const result = await backend.getAudioFallbackUrl(song._id);
          if (result?.url) {
            finalSong = { ...song, publicUrl: result.url, audioMimeType: result.format || song.audioMimeType };
            break;
          }
        } catch (_) { /* keep polling */ }
        await new Promise(r => setTimeout(r, 600));
      }
    }
    setActiveSong(finalSong);
    setIsAudioLoading(false);
  };

  const play = useCallback(() => {
    if (!audioRef.current) return;
    const p = audioRef.current.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, []);

  const pause = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) play();
    else pause();
  }, [play, pause]);

  const seekTo = useCallback((seconds) => {
    if (!audioRef.current) return;
    const dur = audioRef.current.duration || 0;
    audioRef.current.currentTime = Math.max(0, Math.min(seconds, dur || seconds));
    setCurrentTime(audioRef.current.currentTime);
  }, []);

  const setVolume = useCallback((newVolume) => {
    const v = Math.max(0, Math.min(100, newVolume));
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v / 100;
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = !audioRef.current.muted;
    setIsMuted(audioRef.current.muted);
  }, []);

  const setShowVideo = (v) => {
    // Kept for backward compat — now flips the floating thumbnail monitor.
    setShowMonitor(Boolean(v));
  };

  // ── Bookmarks / deep-link ────────────────────────────────────────────────

  const addGlobalBookmark = async (note) => {
    if (!activeAudit) return null;
    try {
      const ts = Math.max(0, Math.floor(currentTime));
      const updated = await backend.addBookmark(activeAudit._id, {
        timestampSeconds: ts,
        label: '',
        note: note || '',
        lens: null,
      });
      const newBookmarks = updated.bookmarks || updated?.audit?.bookmarks || [];
      setBookmarks(newBookmarks);
      setActiveAudit((prev) => (prev ? { ...prev, bookmarks: newBookmarks } : prev));
      return newBookmarks;
    } catch (err) {
      console.error('Failed to add global bookmark:', err);
      return null;
    }
  };

  const highlightBookmark = (bookmarkId, { durationMs = 4000 } = {}) => {
    if (!bookmarkId) return;
    setHighlightBookmarkId(bookmarkId);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightBookmarkId(null);
      highlightTimeoutRef.current = null;
    }, durationMs);
  };

  useEffect(() => () => {
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
  }, []);

  // ── <audio> event wiring ─────────────────────────────────────────────────
  // We rely on the DOM events as the single source of truth (skill rule:
  // media engine → events → component state, never the other way).
  const onAudioLoadedMetadata = (e) => {
    const d = e.currentTarget.duration;
    if (typeof d === 'number' && !isNaN(d) && isFinite(d) && d > 0) {
      setDuration(d);
    }
    setIsAudioLoading(false);
  };
  const onAudioPlay = () => setIsPlaying(true);
  const onAudioPause = () => setIsPlaying(false);
  const onAudioEnded = () => setIsPlaying(false);
  const onAudioError = () => {
    console.warn('[AudioContext] <audio> error event — src may be unreachable');
    setIsAudioLoading(false);
    setIsPlaying(false);
  };

  const value = {
    activeSong,
    activeAudit,
    setActiveAudit,
    bookmarks,
    setBookmarks,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    showVideo: showMonitor,     // backward-compat alias
    showMonitor,
    setShowVideo,
    bottomOpen,
    setBottomOpen,
    videoDock,
    setVideoDock,
    focusMode,
    setFocusMode,
    audioRef,                  // EXPOSED — wavesurfer attaches to this
    loadSong,
    play,
    pause,
    togglePlay,
    seekTo,
    setVolume,
    toggleMute,
    addGlobalBookmark,
    highlightBookmark,
    highlightBookmarkId,
    isAudioLoading,
    isPlayerReady: Boolean(audioRef.current),
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
      {/* The single <audio> element. wavesurfer's `media:` option points
          at audioRef.current so both share the same MediaElement. */}
      {activeSong?.publicUrl && (
        <audio
          ref={audioRef}
          src={activeSong.publicUrl}
          preload="metadata"
          onLoadedMetadata={onAudioLoadedMetadata}
          onPlay={onAudioPlay}
          onPause={onAudioPause}
          onEnded={onAudioEnded}
          onError={onAudioError}
          style={{ display: 'none' }}
        />
      )}
      {showMonitor && activeSong && <MonitorPortal
        song={activeSong}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        seekBy={(d) => seekTo(currentTime + d)}
        videoDock={videoDock}
        setVideoDock={setVideoDock}
        dockedTarget={dockedTarget}
        onClose={() => setShowMonitor(false)}
      />}
    </AudioContext.Provider>
  );
};

// ── Floating "Now Playing" monitor (replaces the old YouTube embed) ──────
function MonitorPortal({ song, isPlaying, togglePlay, seekBy, videoDock, setVideoDock, dockedTarget, onClose }) {
  const inner = (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#0a0a0c' }}>
      <div style={{
        height: '24px', background: '#202025',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 8px', fontSize: '9px', fontFamily: 'Inter', color: '#8a8a8a',
        userSelect: 'none',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>🎵 Now Playing</span>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          <button onClick={() => setVideoDock('float')} style={{ padding: '2px 4px', fontSize: '8px', border: 'none', background: videoDock === 'float' ? 'rgba(255,102,0,0.15)' : 'transparent', color: videoDock === 'float' ? '#ff6600' : '#8a8a8a', cursor: 'pointer' }} title="Float">Float</button>
          <button onClick={() => setVideoDock('left')} style={{ padding: '2px 4px', fontSize: '8px', border: 'none', background: videoDock === 'left' ? 'rgba(255,102,0,0.15)' : 'transparent', color: videoDock === 'left' ? '#ff6600' : '#8a8a8a', cursor: 'pointer' }} title="Dock L">Dock L</button>
          <button onClick={() => setVideoDock('right')} style={{ padding: '2px 4px', fontSize: '8px', border: 'none', background: videoDock === 'right' ? 'rgba(255,102,0,0.15)' : 'transparent', color: videoDock === 'right' ? '#ff6600' : '#8a8a8a', cursor: 'pointer' }} title="Dock R">Dock R</button>
          <button onClick={onClose} style={{ padding: '2px 4px', fontSize: '8px', border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', fontWeight: 'bold', marginLeft: '4px' }} title="Hide">✕</button>
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {song.thumbnailUrl ? (
          <img src={song.thumbnailUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: 'Roboto Mono' }}>♪</div>
        )}
      </div>
      <div style={{ padding: '8px 10px', background: '#0a0a0c', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: '11px', color: '#ffffff', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Roboto Mono', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artistName || song.artist || ''}</div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
          <button onClick={() => seekBy(-10)} style={monitorBtnStyle}>−10s</button>
          <button onClick={togglePlay} style={{ ...monitorBtnStyle, background: 'rgba(255,102,0,0.18)', color: '#ff6600', borderColor: 'rgba(255,102,0,0.4)' }}>{isPlaying ? '⏸' : '▶'}</button>
          <button onClick={() => seekBy(10)} style={monitorBtnStyle}>+10s</button>
        </div>
      </div>
    </div>
  );
  // The DOM nodes for `float` vs `dock left/right` differ; float uses the
  // global portal slot, dock uses the in-page container App.jsx renders.
  if (videoDock === 'float' || !dockedTarget) {
    return createPortal(
      <div
        style={{
          position: 'fixed', bottom: '45px', right: '15px',
          width: '280px', height: '200px', zIndex: 10000,
          background: '#0a0a0c', border: '1px solid rgba(255,102,0,0.4)',
          borderRadius: '2px', overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
        }}
      >
        {inner}
      </div>,
      document.body,
    );
  }
  return createPortal(inner, dockedTarget);
}

const monitorBtnStyle = {
  flex: 1, padding: '4px 6px', fontSize: '10px', fontFamily: 'Roboto Mono',
  background: 'transparent', color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', cursor: 'pointer',
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
