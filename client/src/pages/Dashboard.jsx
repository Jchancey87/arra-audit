import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import EmptyState from '../components/EmptyState';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const Dashboard = () => {
  const backend = useBackend();
  const { loadSong, activeSong, play } = useAudio();

  const [songs, setSongs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activePlanProgress, setActivePlanProgress] = useState(null);

  // Modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [songToDelete, setSongToDelete] = useState(null);

  // Per-song audit list expansion state
  const [expandedSongs, setExpandedSongs] = useState({});

  useEffect(() => {
    loadData();
  }, [search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [songsRes, auditsRes, activeProgressRes] = await Promise.all([
        backend.getSongs(search ? { search } : {}),
        backend.getAudits(),
        backend.getActiveStudyProgress().catch(() => null)
      ]);
      setSongs(songsRes);
      setAudits(auditsRes);
      setActivePlanProgress(activeProgressRes);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (song) => {
    setSongToDelete(song);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!songToDelete) return;
    try {
      await backend.deleteSong(songToDelete._id);
      setSongs(songs.filter((s) => s._id !== songToDelete._id));
      setAudits(audits.filter((a) => (a.songId?._id || a.songId) !== songToDelete._id));
      setIsDeleteModalOpen(false);
      setSongToDelete(null);
    } catch (err) {
      setError('Failed to delete song');
    }
  };

  const toggleAudits = (songId) =>
    setExpandedSongs((prev) => ({ ...prev, [songId]: !prev[songId] }));

  const getSongAudits = (songId) =>
    audits.filter((a) => (a.songId?._id || a.songId) === songId);

  const formatDate = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

  if (loading) return <div className="loading">Loading Library Crate...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header Panel */}
      <div className="panel" style={{ background: 'var(--bg-panel)', borderBottom: '2px solid #ff6600' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h1 style={{ margin: 0, border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <line x1="4" y1="21" x2="4" y2="14"></line>
              <line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line>
              <line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="2" y1="14" x2="6" y2="14"></line>
              <line x1="10" y1="8" x2="14" y2="8"></line>
              <line x1="18" y1="16" x2="22" y2="16"></line>
            </svg>
            Song Library Crate
          </h1>
          <Link to="/import">
            <button style={{ background: '#ff6600', color: '#0c0c0e', fontWeight: 'bold' }}>+ Import Track</button>
          </Link>
        </div>

        <p className="card-subtitle" style={{ margin: 0 }}>
          {songs.length} audio signals mapped // {audits.length} structural audits logged
        </p>

        {error && <div className="error">{error}</div>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <input
            type="text"
            placeholder="Filter channels by title, artist, or research text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: '#0c0c0e',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          />
        </div>
      </div>

      {activePlanProgress && (
        <div className="panel" style={{
          background: 'linear-gradient(135deg, #1d1d22 0%, #151518 100%)',
          border: '1px solid #383838',
          borderLeft: '4px solid #ff6600',
          padding: '20px',
          borderRadius: '2px',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <span className="badge primary" style={{ marginBottom: '6px', textTransform: 'uppercase' }}>
                Current Study Plan
              </span>
              <h2 style={{ fontSize: '1.2rem', margin: 0, border: 'none', padding: 0 }}>
                {activePlanProgress.curriculumId?.title || 'Active Curriculum'}
              </h2>
              <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
                Day {activePlanProgress.currentDay} of {activePlanProgress.dayProgress?.length || 14}
              </p>
            </div>
            <Link to={`/planner`}>
              <button style={{ background: '#ff6600', color: '#000000', fontWeight: 'bold', fontSize: '12px', padding: '8px 16px' }}>
                ▶ Resume Planner Dashboard
              </button>
            </Link>
          </div>

          {/* Progress metrics */}
          {(() => {
            const completedCount = activePlanProgress.dayProgress?.filter(dp => dp.status === 'completed').length || 0;
            const totalCount = activePlanProgress.dayProgress?.length || 14;
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            
            // Find current day's target song and lens
            const currentDayMeta = activePlanProgress.curriculumId?.days?.find(d => d.dayNumber === activePlanProgress.currentDay);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Roboto Mono', color: '#8a8a8a' }}>
                  <span>PROGRESS ({percent}%)</span>
                  <span>{completedCount} / {totalCount} DAYS COMPLETED</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#282828', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${percent}%`, height: '100%', background: '#ff6600', transition: 'width 0.3s ease' }} />
                </div>
                
                {currentDayMeta && (
                  <div style={{ marginTop: '5px', fontSize: '12px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ color: '#8a8a8a' }}>Today's Target:</span>
                    <span className="badge" style={{
                      background: 'rgba(255, 102, 0, 0.08)',
                      color: '#ff6600',
                      borderColor: 'rgba(255, 102, 0, 0.25)',
                      fontSize: '9px',
                      textTransform: 'uppercase'
                    }}>
                      {currentDayMeta.lens}
                    </span>
                    <span style={{ fontWeight: '500' }}>
                      {currentDayMeta.songTitle} - <span style={{ color: '#8a8a8a' }}>{currentDayMeta.artistName}</span>
                    </span>
                    <Link to={`/planner/session/${activePlanProgress.currentDay}`} style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 'bold', textDecoration: 'underline' }}>
                      Start Day {activePlanProgress.currentDay} Session →
                    </Link>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {songs.length === 0 ? (
        <EmptyState
          icon={
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
            </svg>
          }
          title={search ? 'No Channels Found Matching Search' : 'Library Crate Empty'}
          description={
            search
              ? 'Refine filter queries or reset search parameters.'
              : 'Initiate search indexing by importing a reference track from YouTube.'
          }
          ctaLabel={search ? 'Clear Filter' : 'Import First Song'}
          onCtaClick={search ? () => setSearch('') : null}
          ctaLink={search ? null : '/import'}
        />
      ) : (
        <div className="grid">
          {songs.map((song) => {
            const isActive = activeSong && activeSong._id === song._id;
            const songAuditList = getSongAudits(song._id);
            const isExpanded = !!expandedSongs[song._id];

            return (
              <div
                key={song._id}
                className="panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  borderColor: isActive ? '#ff6600' : 'rgba(255,255,255,0.08)',
                  background: isActive ? '#1a1a20' : '#151518',
                  padding: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Thumbnail */}
                {(song.thumbnailUrl || song.thumbnail) && (
                  <div style={{ position: 'relative', width: '100%', height: '140px', background: 'var(--bg-workspace)', overflow: 'hidden' }}>
                    <img
                      src={song.thumbnailUrl || song.thumbnail}
                      alt={song.title}
                      className="song-card-thumbnail"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: isActive ? 0.85 : 0.6,
                        filter: 'grayscale(30%)',
                      }}
                    />
                    {isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: '#ff6600',
                          color: '#0c0c0e',
                          fontFamily: 'Roboto Mono',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '1px',
                        }}
                      >
                        Active Feed
                      </div>
                    )}
                  </div>
                )}

                {/* Card body */}
                <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <h3
                    style={{ fontSize: '13px', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
                    title={song.title}
                  >
                    {song.title}
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '12px', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                    {song.artistName || song.artist}
                  </p>

                  {/* Status Row */}
                  <div className="flex w-full gap-2 mb-2 mt-auto">
                    <span className="badge primary flex-1 flex items-center justify-center h-10 border rounded text-xs">
                      {songAuditList.length} {songAuditList.length === 1 ? 'Audit' : 'Audits'}
                    </span>
                    <span className={`badge flex-1 flex items-center justify-center h-10 border rounded text-xs ${song.researchStatus === 'success' ? 'success' : ''}`}>
                      {song.researchStatus === 'success' ? 'Researched' : 'No Research'}
                    </span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex w-full gap-2">
                    <button
                      onClick={() => { loadSong(song); play(); }}
                      className={`flex-1 flex items-center justify-center h-10 rounded text-xs ${
                        isActive 
                          ? 'bg-[#ff6600] text-[#0c0c0e] font-bold' 
                          : 'bg-[#1c1c22] text-[#ff6600] border border-[#ff6600]/20'
                      }`}
                    >
                      {isActive ? '■ Active' : '▲ Load'}
                    </button>
                    <Link to={`/audit/create/${song._id}`} className="flex-1">
                      <button className="w-full flex items-center justify-center h-10 rounded text-xs">
                        Audit
                      </button>
                    </Link>
                    <button
                      className="danger w-12 h-10 flex items-center justify-center rounded"
                      onClick={() => openDeleteModal(song)}
                      title="Delete Song"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </button>
                  </div>

                  {/* Audit history toggle */}
                  {songAuditList.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <button
                        onClick={() => toggleAudits(song._id)}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.5)',
                          fontSize: '10px',
                          fontFamily: 'Roboto Mono',
                          padding: '5px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderRadius: '2px',
                        }}
                      >
                        <span>Audit History ({songAuditList.length})</span>
                        <span>{isExpanded ? '▲' : '▼'}</span>
                      </button>

                      {isExpanded && (
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {songAuditList.map((audit) => (
                            <div
                              key={audit._id}
                              style={{
                                background: '#0c0c0e',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '2px',
                                padding: '8px 10px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                  {(audit.lensSelection || []).map((l) => (
                                    <span
                                      key={l}
                                      className="badge"
                                      style={{ fontSize: '9px', textTransform: 'uppercase', padding: '1px 4px' }}
                                    >
                                      {l}
                                    </span>
                                  ))}
                                  <span
                                    className={`badge ${audit.status === 'completed' ? 'success' : 'warning'}`}
                                    style={{ fontSize: '9px', textTransform: 'uppercase', padding: '1px 4px' }}
                                  >
                                    {audit.status}
                                  </span>
                                </div>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Roboto Mono' }}>
                                  {formatDate(audit.createdAt)}
                                  {audit.workflowType && ` · ${audit.workflowType}`}
                                </div>
                              </div>
                              <Link to={audit.status === 'completed' ? `/audit/${audit._id}` : `/audit/form/${audit._id}`}>
                                <button
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '10px',
                                    background: audit.status === 'completed' ? '#1c1c22' : 'rgba(255, 102, 0, 0.12)',
                                    color: '#ff6600',
                                    border: '1px solid rgba(255,102,0,0.3)',
                                    borderRadius: '2px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    fontWeight: audit.status === 'completed' ? 'normal' : 'bold',
                                  }}
                                >
                                  {audit.status === 'completed' ? (
                                    'Review →'
                                  ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                      Resume
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px' }}>
                                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                      </svg>
                                    </span>
                                  )}
                                </button>
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        type="song"
        id={songToDelete?._id}
        backend={backend}
      />
    </div>
  );
};

export default Dashboard;
