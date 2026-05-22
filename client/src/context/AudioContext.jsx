import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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

  const playerRef = useRef(null);
  const timerRef = useRef(null);

  // Poll current time when playing
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
      }, 500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
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

  const loadSong = (song) => {
    if (!song) return;
    setActiveSong(song);
    setCurrentTime(0);
    setDuration(song.durationSeconds || 0);
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
    if (isPlaying) {
      pause();
    } else {
      play();
    }
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
      // The backend returns either the direct audit or an object wrapped. Handle both.
      const newBookmarks = updated.bookmarks || updated?.audit?.bookmarks || [];
      setBookmarks(newBookmarks);
      // Also update the activeAudit reference so it retains them
      setActiveAudit(prev => prev ? { ...prev, bookmarks: newBookmarks } : prev);
      return newBookmarks;
    } catch (err) {
      console.error('Failed to add global bookmark:', err);
      return null;
    }
  };

  const handleReady = (event) => {
    playerRef.current = event.target;
    playerRef.current.setVolume(volume);
    if (isMuted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
    setDuration(playerRef.current.getDuration() || (activeSong ? activeSong.durationSeconds : 0));
  };

  const handleStateChange = (event) => {
    const state = event.data;
    setIsPlaying(state === 1);
    if (state === 1) {
      setDuration(playerRef.current.getDuration());
    }
  };

  const youtubeId = activeSong?.sourceId || activeSong?.youtubeId;

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      disablekb: 1,
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
    loadSong,
    play,
    pause,
    togglePlay,
    seekTo,
    setVolume: changeVolume,
    toggleMute,
    addGlobalBookmark,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
      {youtubeId && (
        <div 
          id="global-youtube-monitor"
          style={{
            position: 'fixed',
            bottom: showVideo ? '15px' : '-200px',
            right: '15px',
            width: '180px',
            height: '120px',
            zIndex: 10000,
            background: '#0a0a0c',
            border: '1px solid rgba(208, 143, 96, 0.4)',
            borderRadius: '2px',
            padding: '2px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.8)',
            transition: 'bottom 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ width: '100%', height: '100%', pointerEvents: 'auto', overflow: 'hidden' }}>
            <YouTube
              videoId={youtubeId}
              opts={opts}
              onReady={handleReady}
              onStateChange={handleStateChange}
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
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
