import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import YouTube from 'react-youtube';
import { useBackend } from './BackendContext';

const AudioContext = createContext(null);

export const AudioProvider = ({ children }) => {
  const backend = useBackend();
  const [activeSong, setActiveSong] = useState(null);
  const [activeAudit, setActiveAudit] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [showVideo, setShowVideo] = useState(true);

  // New layout states
  const [videoDock, setVideoDock] = useState('float'); // 'float' | 'left' | 'right'
  const [focusMode, setFocusMode] = useState(false);
  const [dockedTarget, setDockedTarget] = useState(null);

  // Issue 2: track embed errors so we can show a fallback link
  const [embedError, setEmbedError] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(true);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  // yt-dlp fallback state. When the YouTube IFrame embed is blocked (101/150)
  // we surface an audioUrl the consumer can play via <audio>. The fetch is
  // fire-and-forget so the UI doesn't block on it.
  const [audioFallbackUrl, setAudioFallbackUrl] = useState(null);
  const [audioFallbackAvailable, setAudioFallbackAvailable] = useState(false);
  const audioFallbackAbortRef = useRef(null);

  // Deep-link highlight: id of the bookmark currently pulsing in the UI.
  // Cleared automatically after 4s so the visual cue fades.
  const [highlightBookmarkId, setHighlightBookmarkId] = useState(null);
  const highlightTimeoutRef = useRef(null);

  const playerRef = useRef(null);
  const timerRef = useRef(null);
  // Exposed for deep-link consumers: a promise that resolves the next time the
  // YouTube IFrame API is ready. Resets on each new song load so callers can
  // await player mount without guessing a delay.
  const playerReadyResolversRef = useRef([]);
  const playerReadyPromiseRef = useRef(Promise.resolve());

  // Poll current time when playing
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  // Sync bookmarks if active audit updates
  useEffect(() => {
    if (activeAudit) {
      setBookmarks(activeAudit.bookmarks || []);
    } else {
      setBookmarks([]);
    }
  }, [activeAudit]);

  // Safely resolve and track container element for portal docking
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (videoDock === 'left' || videoDock === 'right') {
      const el = document.getElementById('docked-youtube-container');
      if (el) {
        setDockedTarget(el);
      } else {
        // Poll briefly in requestAnimationFrame in case children are still mounting
        let rafId;
        const check = () => {
          const target = document.getElementById('docked-youtube-container');
          if (target) {
            setDockedTarget(target);
          } else {
            rafId = requestAnimationFrame(check);
          }
        };
        rafId = requestAnimationFrame(check);
        return () => {
          if (rafId) cancelAnimationFrame(rafId);
        };
      }
    } else {
      setDockedTarget(null);
    }
  }, [videoDock, activeSong, showVideo, focusMode]);

  const loadSong = (song) => {
    if (!song) return;
    setIsAudioLoading(true);
    setActiveSong(song);
    setCurrentTime(0);
    setDuration(song.durationSeconds || 0);
    setEmbedError(false); // reset error on new song load
    setAudioFallbackUrl(null); // reset fallback on new song load
    setAudioFallbackAvailable(false);
    audioFallbackAbortRef.current?.abort();
    // Reset the player-ready promise: previous resolvers will never fire
    // (we'd have lost their context anyway) and a fresh chain starts.
    playerReadyPromiseRef.current = new Promise((resolve) => {
      playerReadyResolversRef.current.push(resolve);
    });
  };

  const play = () => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo();
    }
  };

  const pause = () => {
    if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
      playerRef.current.pauseVideo();
    }
  };

  const togglePlay = () => {
    if (isPlaying) pause();
    else play();
  };

  const seekTo = (seconds) => {
    if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
      playerRef.current.seekTo(seconds, true);
      setCurrentTime(seconds);
    }
  };

  const changeVolume = (newVolume) => {
    const vol = Math.max(0, Math.min(100, newVolume));
    setVolume(vol);
    if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
      playerRef.current.setVolume(vol);
    }
  };

  const toggleMute = () => {
    if (playerRef.current && typeof playerRef.current.mute === 'function') {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    }
  };

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

  const handleReady = (event) => {
    playerRef.current = event.target;
    playerRef.current.setVolume(volume);
    if (isMuted) playerRef.current.mute();
    else playerRef.current.unMute();
    setDuration(playerRef.current.getDuration() || (activeSong ? activeSong.durationSeconds : 0));
    setIsAudioLoading(false);
    // Resolve any pending waitForPlayerReady() calls.
    const resolvers = playerReadyResolversRef.current;
    playerReadyResolversRef.current = [];
    for (const r of resolvers) {
      try { r(playerRef.current); } catch (_) { /* swallow */ }
    }
  };

  const waitForPlayerReady = useCallback(
    ({ timeoutMs = 3000 } = {}) => {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        return Promise.resolve(playerRef.current);
      }
      const ready = playerReadyPromiseRef.current;
      if (!ready) return Promise.resolve(playerRef.current);
      return new Promise((resolve) => {
        const t = setTimeout(() => resolve(playerRef.current), timeoutMs);
        ready.then((player) => {
          clearTimeout(t);
          resolve(player);
        }).catch(() => {
          clearTimeout(t);
          resolve(playerRef.current);
        });
      });
    },
    []
  );

  const handleStateChange = (event) => {
    const state = event.data;
    setIsPlaying(state === 1);
    if (state === 1) {
      setDuration(playerRef.current.getDuration());
    }
  };

  // Issue 2: handle YouTube player errors (101/150 = embedding blocked)
  const handleError = (event) => {
    const code = event.data;
    console.warn('[YouTube Player] Error code:', code);
    setIsAudioLoading(false);
    // 101 & 150 = video not allowed to be embedded by owner
    if (code === 101 || code === 150) {
      setEmbedError(true);
      // Best-effort: kick off a fetch for the yt-dlp fallback URL so the
      // consumer (compare player, future audio-element transport) can use it.
      try {
        if (backend && typeof backend.isAudioFallbackAvailable === 'function' && activeSong) {
          audioFallbackAbortRef.current?.abort();
          const ac = new AbortController();
          audioFallbackAbortRef.current = ac;
          backend.isAudioFallbackAvailable()
            .then((res) => {
              if (ac.signal.aborted) return;
              setAudioFallbackAvailable(Boolean(res?.available));
              if (res?.available) {
                return backend.getAudioFallbackUrl(activeSong._id || activeSong.id);
              }
              return null;
            })
            .then((audio) => {
              if (ac.signal.aborted) return;
              if (audio && audio.url) setAudioFallbackUrl(audio.url);
            })
            .catch(() => { /* swallow — fallback is best-effort */ });
        }
      } catch (_) { /* swallow */ }
    }
  };

  const youtubeId = activeSong?.sourceId || activeSong?.youtubeId;
  const youtubeWatchUrl = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : null;

  // Issue 2: enable controls and add origin for trusted embedding
  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 1,          // ← was 0; native controls needed for embedding trust + browser policy
      modestbranding: 1,
      rel: 0,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
    },
  };

  const value = {
    activeSong,
    activeAudit,
    setActiveAudit,
    bookmarks,
    setBookmarks,
    youtubeId,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    showVideo,
    setShowVideo,
    embedError,
    audioFallbackUrl,
    audioFallbackAvailable,
    bottomOpen,
    setBottomOpen,
    videoDock,
    setVideoDock,
    focusMode,
    setFocusMode,
    loadSong,
    play,
    pause,
    togglePlay,
    seekTo,
    setVolume: changeVolume,
    toggleMute,
    addGlobalBookmark,
    highlightBookmark,
    highlightBookmarkId,
    isAudioLoading,
    isPlayerReady: Boolean(playerRef.current),
    waitForPlayerReady,
    playerRef,
  };



  const playerContent = (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000' }}>
      {/* Control bar */}
      <div style={{
        height: '24px',
        background: '#202025',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        fontSize: '9px',
        fontFamily: 'Inter',
        color: '#8a8a8a',
        userSelect: 'none'
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
          📹 Video Monitor
        </span>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
          <button 
            onClick={() => setVideoDock('float')} 
            className="secondary" 
            style={{ padding: '2px 4px', fontSize: '8px', border: 'none', background: videoDock === 'float' ? 'rgba(255,102,0,0.15)' : 'transparent', color: videoDock === 'float' ? '#ff6600' : '#8a8a8a', cursor: 'pointer' }}
            title="Float window"
          >
            Float
          </button>
          <button 
            onClick={() => setVideoDock('left')} 
            className="secondary" 
            style={{ padding: '2px 4px', fontSize: '8px', border: 'none', background: videoDock === 'left' ? 'rgba(255,102,0,0.15)' : 'transparent', color: videoDock === 'left' ? '#ff6600' : '#8a8a8a', cursor: 'pointer' }}
            title="Dock Left"
          >
            Dock L
          </button>
          <button 
            onClick={() => setVideoDock('right')} 
            className="secondary" 
            style={{ padding: '2px 4px', fontSize: '8px', border: 'none', background: videoDock === 'right' ? 'rgba(255,102,0,0.15)' : 'transparent', color: videoDock === 'right' ? '#ff6600' : '#8a8a8a', cursor: 'pointer' }}
            title="Dock Right"
          >
            Dock R
          </button>
          <button 
            onClick={() => setShowVideo(false)} 
            className="secondary" 
            style={{ padding: '2px 4px', fontSize: '8px', border: 'none', background: 'transparent', color: '#f87171', cursor: 'pointer', fontWeight: 'bold', marginLeft: '4px' }}
            title="Hide Video"
          >
            ✕ Hide
          </button>
        </div>
      </div>

      {/* Video frame or fallback */}
      <div style={{ flex: 1, position: 'relative', background: '#000' }}>
        {embedError ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px', textAlign: 'center', background: '#0c0c0e' }}>
            <div style={{ fontSize: '16px', marginBottom: '4px' }}>🔒</div>
            <div style={{ fontSize: '9px', color: '#f87171', fontFamily: 'Roboto Mono', marginBottom: '6px', lineHeight: '1.3' }}>
              Embedding restricted by owner
            </div>
            {audioFallbackUrl ? (
              <div style={{ fontSize: '9px', color: '#35d777', fontFamily: 'Roboto Mono', marginBottom: '6px', lineHeight: '1.3' }}>
                Audio fallback ready
              </div>
            ) : audioFallbackAvailable ? (
              <div style={{ fontSize: '9px', color: '#fbbf24', fontFamily: 'Roboto Mono', marginBottom: '6px', lineHeight: '1.3' }}>
                Fetching audio fallback…
              </div>
            ) : null}
            <a href={youtubeWatchUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '9px', color: '#ff6600', fontFamily: 'Roboto Mono', textDecoration: 'underline' }}>
              Open in YouTube →
            </a>
          </div>
        ) : (
          <YouTube
            videoId={youtubeId}
            opts={opts}
            onReady={handleReady}
            onStateChange={handleStateChange}
            onError={handleError}
            style={{ width: '100%', height: '100%' }}
          />
        )}
      </div>
    </div>
  );

  const floatingPlayer = (
    <div
      id="global-youtube-monitor"
      style={{
        position: 'fixed',
        bottom: showVideo ? (bottomOpen ? '155px' : '45px') : '-240px',
        right: '15px',
        width: '280px',
        height: '200px',
        zIndex: 10000,
        background: '#0a0a0c',
        border: `1px solid ${embedError ? 'rgba(248,113,113,0.4)' : 'rgba(255,102,0,0.4)'}`,
        borderRadius: '2px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
        transition: 'bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1), right 0.3s',
        display: showVideo ? 'block' : 'none'
      }}
    >
      {playerContent}
    </div>
  );

  return (
    <AudioContext.Provider value={value}>
      {children}
      {youtubeId && (
        (videoDock === 'float' || !dockedTarget) 
          ? floatingPlayer 
          : createPortal(playerContent, dockedTarget)
      )}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
