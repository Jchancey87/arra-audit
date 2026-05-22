import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import StyleProvider from './styles/global';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AudioProvider, useAudio } from './context/AudioContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ImportSong from './pages/ImportSong';
import AuditCreate from './pages/AuditCreate';
import AuditForm from './pages/AuditForm';
import AuditDetail from './pages/AuditDetail';
import TechniqueNotebook from './pages/TechniqueNotebook';
import Trash from './pages/Trash';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const AppContent = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const {
    activeSong,
    activeAudit,
    bookmarks,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    showVideo,
    setShowVideo,
    play,
    pause,
    seekTo,
    setVolume,
    toggleMute,
    addGlobalBookmark,
  } = useAudio();

  const location = useLocation();

  // Layout Panel States
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(true);
  
  // Local state for bookmark notes inside bottom panel
  const [deckBookmarkNote, setDeckBookmarkNote] = useState('');

  const handleScrub = (e) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / rect.width;
    seekTo(clickRatio * duration);
  };

  const handleDeckBookmarkSubmit = async (e) => {
    e.preventDefault();
    if (!activeAudit) return;
    await addGlobalBookmark(deckBookmarkNote);
    setDeckBookmarkNote('');
  };

  return (
    <>
      <StyleProvider />
      
      {/* DAW Wrapper */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0c0c0e' }}>
        
        {/* Top Command Bar */}
        <header style={{
          height: '48px',
          background: '#141418',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 15px',
          zIndex: 1000
        }}>
          {/* Logo & Sidebar Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isAuthenticated && (
              <button 
                onClick={() => setLeftOpen(!leftOpen)} 
                style={{ padding: '4px 8px', background: 'transparent', borderColor: 'rgba(255,255,255,0.1)' }}
                title="Toggle Sidebar"
              >
                {leftOpen ? '◀' : '▶'}
              </button>
            )}
            <Link to="/" style={{ 
              fontFamily: 'Roboto Mono', 
              fontSize: '14px', 
              fontWeight: '700', 
              color: '#d08f60', 
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              SONIC DNA // AUDIT SYSTEM
            </Link>
          </div>

          {/* Persistent Transport / Signal Status */}
          {isAuthenticated && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              fontFamily: 'Roboto Mono',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.65)'
            }}>
              <span style={{ color: activeSong ? '#4ade80' : 'rgba(255,255,255,0.3)' }}>
                {activeSong ? '● SIGNAL INCOMING' : '○ NO ACTIVE SIGNAL'}
              </span>
              {activeSong && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: '#0c0c0e',
                  padding: '4px 10px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '2px'
                }}>
                  <span style={{ color: '#d08f60', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeSong.title}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
                  <span>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* User Info & Inspector Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isAuthenticated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{user?.email}</span>
                <button 
                  onClick={logout} 
                  className="secondary" 
                  style={{ padding: '3px 8px', fontSize: '10px', background: 'transparent' }}
                >
                  Logout
                </button>
              </div>
            )}
            {isAuthenticated && (
              <button 
                onClick={() => setRightOpen(!rightOpen)} 
                style={{ 
                  padding: '4px 8px', 
                  background: rightOpen ? '#d08f60' : 'transparent',
                  color: rightOpen ? '#0c0c0e' : '#d08f60',
                  borderColor: 'rgba(208, 143, 96, 0.3)' 
                }}
                title="Toggle Inspector"
              >
                INSPECT
              </button>
            )}
          </div>
        </header>

        {/* Main Section */}
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'hidden',
          height: `calc(100vh - 48px - ${bottomOpen ? '140px' : '30px'})`
        }}>
          
          {/* Left Sidebar (Navigation) */}
          {isAuthenticated && (
            <aside style={{
              width: leftOpen ? '220px' : '0px',
              background: '#141418',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              overflowX: 'hidden',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontFamily: 'Roboto Mono', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '5px' }}>
                  NAVIGATOR
                </div>
                
                {[
                  { path: '/dashboard', label: '🎛️ LIBRARY' },
                  { path: '/import', label: '▲ IMPORT SONG' },
                  { path: '/techniques', label: '📖 NOTEBOOK' },
                  { path: '/trash', label: '🗑️ ARCHIVES' }
                ].map(item => {
                  const active = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');
                  return (
                    <Link 
                      key={item.path} 
                      to={item.path}
                      style={{
                        fontFamily: 'Roboto Mono',
                        fontSize: '11px',
                        padding: '10px 12px',
                        background: active ? 'rgba(208, 143, 96, 0.1)' : 'transparent',
                        color: active ? '#d08f60' : 'rgba(255, 255, 255, 0.75)',
                        border: active ? '1px solid rgba(208, 143, 96, 0.25)' : '1px solid transparent',
                        borderRadius: '2px',
                        display: 'block'
                      }}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Center Workspace (Content) */}
          <main style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '20px', 
            background: '#0c0c0e' 
          }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/import" element={<PrivateRoute><ImportSong /></PrivateRoute>} />
              <Route path="/audit/create/:songId" element={<PrivateRoute><AuditCreate /></PrivateRoute>} />
              <Route path="/audit/form/:auditId" element={<PrivateRoute><AuditForm /></PrivateRoute>} />
              <Route path="/audit/:id" element={<PrivateRoute><AuditDetail /></PrivateRoute>} />
              <Route path="/techniques" element={<PrivateRoute><TechniqueNotebook /></PrivateRoute>} />
              <Route path="/trash" element={<PrivateRoute><Trash /></PrivateRoute>} />
            </Routes>
          </main>

          {/* Right Inspector Panel */}
          {isAuthenticated && (
            <aside style={{
              width: rightOpen ? '280px' : '0px',
              background: '#141418',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              overflowX: 'hidden',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {rightOpen && (
                <div style={{ padding: '15px' }}>
                  <div style={{ fontFamily: 'Roboto Mono', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>
                    INSPECTOR
                  </div>
                  
                  {activeSong ? (
                    <div>
                      <h3 style={{ fontSize: '12px', color: '#d08f60', marginBottom: '4px' }}>{activeSong.title}</h3>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '15px', fontFamily: 'Roboto Mono' }}>
                        by {activeSong.artistName || activeSong.artist}
                      </p>

                      {/* Tavily Research snippet */}
                      {activeSong.researchSummary?.summary ? (
                        <div style={{ 
                          background: '#0c0c0e', 
                          border: '1px solid rgba(255,255,255,0.05)', 
                          padding: '10px', 
                          borderRadius: '2px',
                          marginBottom: '15px'
                        }}>
                          <div style={{ fontFamily: 'Roboto Mono', fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginBottom: '6px' }}>
                            PRODUCTION NOTE
                          </div>
                          <p style={{ fontSize: '11px', lineHeight: '1.5', color: 'rgba(255,255,255,0.6)' }}>
                            {activeSong.researchSummary.summary}
                          </p>
                        </div>
                      ) : (
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginBottom: '15px' }}>
                          No research metadata loaded.
                        </p>
                      )}

                      {/* Session Bookmarks */}
                      <div style={{ marginTop: '20px' }}>
                        <div style={{ fontFamily: 'Roboto Mono', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>
                          SESSION BOOKMARKS ({bookmarks.length})
                        </div>
                        {bookmarks.length === 0 ? (
                          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                            No bookmarks logged yet. Click "+ Bookmark" in the tape deck during playback.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {bookmarks.map((bm, index) => (
                              <div 
                                key={bm._id || index}
                                onClick={() => seekTo(bm.timestampSeconds || bm.timestamp)}
                                style={{
                                  background: '#0c0c0e',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  borderRadius: '2px',
                                  padding: '8px',
                                  cursor: 'pointer',
                                  transition: 'border-color 0.2s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#d08f60'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontFamily: 'Roboto Mono', fontSize: '11px', fontWeight: 'bold', color: '#d08f60' }}>
                                    {formatTime(bm.timestampSeconds || bm.timestamp)}
                                  </span>
                                  {bm.lens && (
                                    <span className="badge" style={{ fontSize: '8px', padding: '1px 4px' }}>
                                      {bm.lens}
                                    </span>
                                  )}
                                </div>
                                {bm.note && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: 0 }}>{bm.note}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                      No active track loaded into the signal engine. Select a song from the library to begin.
                    </p>
                  )}
                </div>
              )}
            </aside>
          )}

        </div>

        {/* Bottom Tape Deck (Transport & Scrubber) */}
        {isAuthenticated && (
          <footer style={{
            height: bottomOpen ? '140px' : '30px',
            background: '#141418',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'height 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 1000,
            overflow: 'hidden'
          }}>
            {/* Toggle bar */}
            <div 
              onClick={() => setBottomOpen(!bottomOpen)}
              style={{
                height: '30px',
                background: '#1a1a20',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 15px',
                cursor: 'pointer',
                fontFamily: 'Roboto Mono',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.45)',
                userSelect: 'none'
              }}
            >
              <span>TAPE DECK DECK // TRANSPORT PANEL</span>
              <span>{bottomOpen ? 'Minimize ▼' : 'Expand ▲'}</span>
            </div>

            {/* Deck Controls Content */}
            {bottomOpen && (
              <div style={{
                display: 'flex',
                gap: '20px',
                alignItems: 'center',
                padding: '15px 20px',
                flex: 1
              }}>
                {/* Audio controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={play} 
                    disabled={!activeSong || isPlaying}
                    style={{ minWidth: '50px' }}
                  >
                    Play
                  </button>
                  <button 
                    onClick={pause} 
                    disabled={!activeSong || !isPlaying}
                    style={{ minWidth: '50px' }}
                  >
                    Pause
                  </button>
                  <button 
                    onClick={() => { seekTo(0); pause(); }} 
                    disabled={!activeSong}
                    className="secondary"
                  >
                    Stop
                  </button>
                  <button 
                    onClick={toggleMute} 
                    disabled={!activeSong}
                    className="secondary"
                    style={{ minWidth: '55px' }}
                  >
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                </div>

                {/* Scrubber / LED timeline */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Roboto Mono', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  
                  {/* Timeline track */}
                  <div 
                    onClick={handleScrub}
                    style={{
                      height: '8px',
                      background: '#0c0c0e',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '1px',
                      position: 'relative',
                      cursor: activeSong ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {/* Fill */}
                    {activeSong && duration > 0 && (
                      <div style={{
                        width: `${(currentTime / duration) * 100}%`,
                        height: '100%',
                        background: '#d08f60',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }} />
                    )}
                  </div>
                </div>

                {/* Quick volume & visual monitor toggles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontFamily: 'Roboto Mono', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>VOL</span>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      disabled={!activeSong}
                      style={{ width: '70px', height: '3px', accentColor: '#d08f60', padding: 0 }}
                    />
                    <span style={{ minWidth: '22px', textAlign: 'right' }}>{volume}</span>
                  </div>

                  {activeSong && (
                    <button 
                      onClick={() => setShowVideo(!showVideo)}
                      className="secondary"
                      style={{ padding: '4px 8px', fontSize: '9px' }}
                    >
                      {showVideo ? 'Hide Screen' : 'Show Screen'}
                    </button>
                  )}
                </div>

                {/* Bookmark Creator */}
                <div style={{ 
                  borderLeft: '1px solid rgba(255,255,255,0.08)',
                  paddingLeft: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <form onSubmit={handleDeckBookmarkSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder={activeAudit ? "Quick bookmark note..." : "Load an active audit to bookmark"}
                      value={deckBookmarkNote}
                      onChange={(e) => setDeckBookmarkNote(e.target.value)}
                      disabled={!activeAudit}
                      style={{ width: '180px', padding: '6px 10px', fontSize: '11px' }}
                    />
                    <button 
                      type="submit" 
                      disabled={!activeAudit}
                      style={{ padding: '6px 12px' }}
                    >
                      + Mark
                    </button>
                  </form>
                </div>

              </div>
            )}
          </footer>
        )}

      </div>
    </>
  );
};

import { BackendProvider } from './context/BackendContext';

function App() {
  return (
    <BrowserRouter>
      <BackendProvider>
        <AudioProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </AudioProvider>
      </BackendProvider>
    </BrowserRouter>
  );
}

export default App;

