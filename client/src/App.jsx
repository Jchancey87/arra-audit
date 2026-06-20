import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
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
import Settings from './pages/Settings';
import StudyPlannerDashboard from './pages/StudyPlannerDashboard';
import StudySessionWorkspace from './pages/StudySessionWorkspace';
import SketchCompare from './pages/SketchCompare';
import ResearchSummaryRenderer from './components/ResearchSummaryRenderer';
import ErrorBoundary from './components/ErrorBoundary';
import { useTechniques } from './hooks/useTechniques.js';

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

const stripTopic = (name) => (name || '').replace(/\s*-\s*Topic\s*$/i, '').replace(/\s*\(Official.*?\)/gi, '').replace(/\s*\[Official.*?\]/gi, '').trim();

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
    bottomOpen,
    setBottomOpen,
    videoDock,
    setVideoDock,
    focusMode,
    setFocusMode,
    play,
    pause,
    seekTo,
    setVolume,
    toggleMute,
    addGlobalBookmark,
    isAudioLoading,
  } = useAudio();

  const location = useLocation();
  const navigate = useNavigate();

  // Context-aware EXIT FOCUS: in audit context, navigate to planner; elsewhere, just disable focus.
  const isAuditContext = location.pathname.startsWith('/audit/');
  const handleExitFocus = () => {
    if (isAuditContext) navigate('/planner');
    else setFocusMode(false);
  };

  // Layout Panel States
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  
  // Local state for bookmark notes inside bottom panel
  const [deckBookmarkNote, setDeckBookmarkNote] = useState('');

  const { addFromSentence } = useTechniques();

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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
        
        {/* Floating Focus Mode Close Trigger (Phase 3.4: context-aware) */}
        {isAuthenticated && focusMode && (
          <button
            onClick={handleExitFocus}
            title={isAuditContext ? 'Exit focus and return to planner' : 'Exit focus mode'}
            style={{
              position: 'fixed',
              top: '8px',
              right: '12px',
              zIndex: 99999,
              padding: '5px 12px',
              height: '24px',
              fontSize: '10px',
              fontFamily: 'Roboto Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              background: 'var(--accent-orange)',
              color: '#0c0c0e',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            EXIT FOCUS
          </button>
        )}

        {/* Top Command Bar (Hidden during Focus Mode) */}
        {isAuthenticated && !focusMode && (
          <header style={{
            height: '48px',
            background: '#282828',
            borderBottom: '1px solid #2a2a2a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 15px',
            zIndex: 1000
          }}>
            {/* Logo & Sidebar Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isAuthenticated && (
                <button 
                  onClick={() => setLeftOpen(!leftOpen)} 
                  className="secondary"
                  style={{ padding: '4px 6px', fontSize: '10px', minWidth: '28px' }}
                  title="Toggle Sidebar"
                >
                  {leftOpen ? '◀' : '▶'}
                </button>
              )}
              {activeSong ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                  <span style={{ 
                    fontFamily: 'Roboto Mono, monospace', 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: 'rgba(255,255,255,0.9)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    maxWidth: '340px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {activeSong.title}
                  </span>
                  <span style={{ 
                    fontFamily: 'Inter, sans-serif', 
                    fontSize: '10px', 
                    color: 'var(--text-muted)',
                    maxWidth: '340px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {stripTopic(activeSong.artistName || activeSong.artist)} · {activeSong.year || '—'}
                  </span>
                </div>
              ) : (
                <Link to="/" style={{ 
                  fontFamily: 'Roboto Mono, monospace', 
                  fontSize: '12px', 
                  fontWeight: '600', 
                  color: 'var(--accent-orange)', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  ARRA // AUDIT SYSTEM
                </Link>
              )}
            </div>

            {/* Persistent Transport / Signal Status */}
            {isAuthenticated && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontFamily: 'Roboto Mono, monospace',
                fontSize: '10px',
                color: 'rgba(255,255,255,0.5)'
              }}>
                {isAudioLoading ? (
                  <span style={{ color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                    <span style={{
                      display: 'inline-block',
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: 'var(--accent-orange)',
                      animation: 'pulse-led 1s ease-in-out infinite'
                    }} />
                    INCOMING...
                  </span>
                ) : activeSong ? (
                  <span style={{ color: 'var(--status-high)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    <span style={{ fontSize: '10px', fontWeight: 500 }}>SYNCED</span>
                    <span style={{
                      display: 'inline-block',
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: 'var(--status-high)',
                      animation: isPlaying ? 'pulse-led 1s ease-in-out infinite' : 'none',
                      marginLeft: '2px'
                    }} />
                  </span>
                ) : (
                  <span style={{ color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.12)'
                    }} />
                    NO SIGNAL
                  </span>
                )}
                
                {activeSong && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '3px 8px',
                    borderRadius: '2px'
                  }}>
                    <span>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* User Info & Inspector Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isAuthenticated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontFamily: 'Roboto Mono, monospace' }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>{user?.email}</span>
                  <button 
                    onClick={logout} 
                    className="secondary" 
                    style={{ padding: '3px 7px', fontSize: '9px' }}
                  >
                    LOG OUT
                  </button>
                </div>
              )}
              {isAuthenticated && (
                <button 
                  onClick={() => setRightOpen(!rightOpen)} 
                  className={rightOpen ? 'primary' : 'secondary'}
                  style={{ 
                    padding: '4px 8px',
                    fontSize: '10px',
                    borderColor: rightOpen ? undefined : 'rgba(255, 255, 255, 0.08)' 
                  }}
                  title="Toggle active track metadata & bookmarks inspector"
                >
                  INSPECT
                </button>
              )}
            </div>
          </header>
        )}

        {/* Main Section */}
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'hidden',
          height: `calc(100vh - ${focusMode ? '0px' : '48px'} - ${activeSong ? (bottomOpen ? '140px' : '30px') : '0px'})`
        }}>
          
          {/* Left Sidebar (Navigation - hidden during Focus Mode) */}
          {isAuthenticated && (
            <aside style={{
              width: (leftOpen && !focusMode) ? '180px' : '0px',
              background: '#111111',
              borderRight: '1px solid #2a2a2a',
              transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              overflowX: 'hidden',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ padding: '15px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontFamily: 'Barlow', fontWeight: '600', letterSpacing: '0.08em', fontSize: '10px', color: '#8a8a8a', marginBottom: '5px', paddingLeft: '15px' }}>
                  NAVIGATOR
                </div>
                
                {[
                  { 
                    path: '/dashboard', 
                    label: 'Library', 
                    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> 
                  },
                  { 
                    path: '/import', 
                    label: 'Import Song', 
                    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg> 
                  },
                  { 
                    path: '/techniques', 
                    label: 'Notebook', 
                    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg> 
                  },
                  { 
                    path: '/planner', 
                    label: 'Study Plan', 
                    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  },
                  { 
                    path: '/trash', 
                    label: 'Archives', 
                    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg> 
                  },
                  { 
                    path: '/settings', 
                    label: 'Settings', 
                    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> 
                  }
                ].map(item => {
                  const active = location.pathname === item.path || 
                                 (item.path === '/dashboard' && (location.pathname === '/' || location.pathname.startsWith('/audit'))) ||
                                 (item.path === '/planner' && location.pathname.startsWith('/planner'));
                  return (
                    <Link 
                      key={item.path} 
                      to={item.path}
                      style={{
                        fontFamily: 'Roboto Mono',
                        fontSize: '11px',
                        padding: '8px 15px',
                        background: 'transparent',
                        color: active ? '#ff6600' : '#8a8a8a',
                        borderLeft: active ? '2px solid #ff6600' : '2px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </aside>
          )}

          {/* Left Docked Video Panel */}
          {isAuthenticated && activeSong && showVideo && videoDock === 'left' && !focusMode && (
            <div style={{
              width: '320px',
              background: '#151518',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '12px'
            }}>
              <div id="docked-youtube-container" style={{ width: '100%', height: '210px', background: '#000', borderRadius: '2px', overflow: 'hidden' }} />
              <div style={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'Roboto Mono', marginTop: '10px', textAlign: 'center', letterSpacing: '0.05em' }}>
                SPLIT VIEW // LEFT ANCHOR
              </div>
            </div>
          )}

          {/* Center Workspace (Content) */}
          <main style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '12px', 
            background: 'var(--bg-primary)' 
          }}>
            <ErrorBoundary>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
                <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/import" element={<PrivateRoute><ImportSong /></PrivateRoute>} />
                <Route path="/audit/create/:songId" element={<PrivateRoute><AuditCreate /></PrivateRoute>} />
                <Route path="/audit/form/:auditId" element={<PrivateRoute><AuditForm /></PrivateRoute>} />
                <Route path="/audit/:id" element={<PrivateRoute><AuditDetail /></PrivateRoute>} />
                <Route path="/compare/:songId" element={<PrivateRoute><SketchCompare /></PrivateRoute>} />
                <Route path="/compare/:songId/:sketchId" element={<PrivateRoute><SketchCompare /></PrivateRoute>} />
                <Route path="/techniques" element={<PrivateRoute><TechniqueNotebook /></PrivateRoute>} />
                <Route path="/planner" element={<PrivateRoute><StudyPlannerDashboard /></PrivateRoute>} />
                <Route path="/planner/session/:dayNumber" element={<PrivateRoute><StudySessionWorkspace /></PrivateRoute>} />
                <Route path="/trash" element={<PrivateRoute><Trash /></PrivateRoute>} />
                <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
              </Routes>
            </ErrorBoundary>
          </main>

          {/* Right Docked Video Panel */}
          {isAuthenticated && activeSong && showVideo && videoDock === 'right' && !focusMode && (
            <div style={{
              width: '320px',
              background: '#151518',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              padding: '12px'
            }}>
              <div id="docked-youtube-container" style={{ width: '100%', height: '210px', background: '#000', borderRadius: '2px', overflow: 'hidden' }} />
              <div style={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'Roboto Mono', marginTop: '10px', textAlign: 'center', letterSpacing: '0.05em' }}>
                SPLIT VIEW // RIGHT ANCHOR
              </div>
            </div>
          )}

          {/* Right Inspector Panel */}
          {isAuthenticated && (
            <aside style={{
              width: (rightOpen && !focusMode) ? '280px' : '0px',
              background: '#141418',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              overflowX: 'hidden',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {(rightOpen && !focusMode) && (
                <div style={{ padding: '15px' }}>
                  <div style={{ fontFamily: 'Roboto Mono', fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '12px' }}>
                    INSPECTOR
                  </div>
                  
                   {activeSong ? (
                    <div>
                      <h3 style={{ fontSize: '12px', color: 'var(--accent-orange)', marginBottom: '2px', border: 'none', padding: 0 }}>{activeSong.title}</h3>
                      <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '12px', fontFamily: 'Roboto Mono, monospace' }}>
                        {stripTopic(activeSong.artistName || activeSong.artist)} · {activeSong.year || '—'}
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
                          <ResearchSummaryRenderer
                            summary={activeSong.researchSummary.summary}
                            compact={true}
                            song={activeSong}
                            onPromote={addFromSentence}
                          />
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
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#ff6600'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontFamily: 'Roboto Mono', fontSize: '11px', fontWeight: 'bold', color: '#ff6600' }}>
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
        {isAuthenticated && activeSong && (
          <footer style={{
            height: bottomOpen ? '140px' : '30px',
            background: '#282828',
            borderTop: '1px solid #2a2a2a',
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
                background: '#202020',
                borderBottom: '1px solid #2a2a2a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 15px',
                cursor: 'pointer',
                fontFamily: 'Barlow',
                fontSize: '10px',
                fontWeight: '600',
                letterSpacing: '0.08em',
                color: '#8a8a8a',
                userSelect: 'none',
                textTransform: 'uppercase'
              }}
            >
              <span>Tape Deck // Audio Player & Controls</span>
              <span>{bottomOpen ? 'Minimize ▼' : 'Expand ▲'}</span>
            </div>

            {/* Deck Controls Content */}
            {bottomOpen && (
              <div style={{
                display: 'flex',
                gap: '15px',
                alignItems: 'center',
                padding: '15px 20px',
                flex: 1
              }}>
                {/* Audio controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button 
                    onClick={play} 
                    disabled={!activeSong || isPlaying}
                    style={{ 
                      minWidth: '50px',
                      background: isPlaying ? '#ff6600' : 'linear-gradient(180deg, #333333 0%, #222222 100%)',
                      color: isPlaying ? '#ffffff' : '#ff6600',
                      border: isPlaying ? '1px solid #ff6600' : '1px solid #2a2a2a',
                      opacity: isPlaying ? 1 : undefined
                    }}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Roboto Mono', fontSize: '10px', color: '#8a8a8a' }}>
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                  
                  {/* Timeline track */}
                  <div 
                    onClick={handleScrub}
                    style={{
                      height: '4px',
                      background: '#151515',
                      border: '1px solid #2a2a2a',
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
                        background: '#ff6600',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        boxShadow: '0 0 4px #ff6600'
                      }} />
                    )}
                  </div>
                </div>

                {/* Quick volume & visual monitor toggles */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontFamily: 'Roboto Mono', fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#8a8a8a' }}>Vol</span>
                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      disabled={!activeSong}
                      style={{ width: '70px', height: '3px', accentColor: '#ff6600', padding: 0 }}
                    />
                    <span style={{ minWidth: '22px', textAlign: 'right', color: '#ffffff' }}>{volume}</span>
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
                <div 
                  style={{ 
                    borderLeft: '1px solid #2a2a2a',
                    paddingLeft: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  title={!activeAudit ? "To save bookmarks, you must open or start a song audit." : ""}
                >
                  <form onSubmit={handleDeckBookmarkSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder={activeAudit ? "Quick bookmark note..." : "Open an audit to bookmark"}
                      value={deckBookmarkNote}
                      onChange={(e) => setDeckBookmarkNote(e.target.value)}
                      disabled={!activeAudit}
                      style={{ width: '180px', padding: '6px 10px', fontSize: '11px', background: '#111111', border: '1px solid #2a2a2a' }}
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

