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

  // New UI states
  const [filterType, setFilterType] = useState('all');
  const [plannerExpanded, setPlannerExpanded] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'title-asc' | 'artist-asc' | 'audits-desc'

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

  const filteredSongsList = songs
    .filter((song) => {
      if (filterType === 'all') return true;
      if (filterType === 'researched') return song.researchStatus === 'success';
      const songAudits = getSongAudits(song._id);
      if (filterType === 'audited') return songAudits.length > 0;
      return songAudits.some((audit) =>
        (audit.lensSelection || []).some(
          (l) => typeof l === 'string' && l.toLowerCase() === filterType.toLowerCase()
        )
      );
    })
    .sort((a, b) => {
      if (sortBy === 'title-asc') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'artist-asc') {
        const artistA = a.artistName || a.artist || '';
        const artistB = b.artistName || b.artist || '';
        return artistA.localeCompare(artistB);
      }
      if (sortBy === 'date-asc') {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      if (sortBy === 'date-desc') {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      if (sortBy === 'audits-desc') {
        return getSongAudits(b._id).length - getSongAudits(a._id).length;
      }
      return 0;
    });

  if (loading) return <div className="loading">Loading Song Library...</div>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header Panel */}
      <div className="panel" style={{ background: 'var(--bg-panel)', padding: '12px 16px', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
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
            Song Library
          </h1>
          <Link to="/import">
            <button className="primary" style={{ padding: '8px 16px', fontSize: '12px' }}>+ Import Track</button>
          </Link>
        </div>

        <p className="card-subtitle" style={{ margin: 0 }}>
          {songs.length} tracks imported · {audits.length} audits completed
        </p>

        {error && <div className="error">{error}</div>}

        {/* Search, Sort, View Controls row */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Styled search bar with magnifying glass icon */}
          <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: '#8a8a8a', pointerEvents: 'none' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search tracks by title, artist, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: '#111115',
                borderColor: 'rgba(255,255,255,0.08)',
                paddingLeft: '35px',
                height: '36px',
                fontSize: '12px',
                width: '100%',
              }}
            />
          </div>

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '10px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: '#111115',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '2px',
                height: '36px',
                fontSize: '11px',
                fontFamily: 'Inter',
                padding: '0 8px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="date-desc">Date Added (Newest)</option>
              <option value="date-asc">Date Added (Oldest)</option>
              <option value="title-asc">Track Title (A-Z)</option>
              <option value="artist-asc">Artist (A-Z)</option>
              <option value="audits-desc">Most Audited</option>
            </select>
          </div>

          {/* Grid / List View Toggle */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '2px', height: '36px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                border: 'none',
                height: '100%',
                padding: '0 10px',
                borderRadius: 0,
                background: viewMode === 'grid' ? 'var(--accent-orange)' : '#111115',
                color: viewMode === 'grid' ? '#0c0c0e' : '#8a8a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'none',
                cursor: 'pointer',
              }}
              title="Grid View"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"></rect>
                <rect x="14" y="3" width="7" height="7"></rect>
                <rect x="14" y="14" width="7" height="7"></rect>
                <rect x="3" y="14" width="7" height="7"></rect>
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                border: 'none',
                height: '100%',
                padding: '0 10px',
                borderRadius: 0,
                background: viewMode === 'list' ? 'var(--accent-orange)' : '#111115',
                color: viewMode === 'list' ? '#0c0c0e' : '#8a8a8a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'none',
                cursor: 'pointer',
              }}
              title="List View"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Filter Chips */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Signals' },
            { id: 'researched', label: 'Researched' },
            { id: 'audited', label: 'Audited' },
            { id: 'harmony', label: 'Harmony' },
            { id: 'rhythm', label: 'Rhythm' },
            { id: 'texture', label: 'Texture' },
            { id: 'form', label: 'Form' },
            { id: 'arrangement', label: 'Arrangement' },
          ].map(chip => {
            const isSelected = filterType === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFilterType(chip.id)}
                className={isSelected ? 'primary' : 'secondary'}
                style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontFamily: 'Roboto Mono',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  background: isSelected ? 'rgba(255, 102, 0, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? '#ff6600' : '#8a8a8a',
                  borderColor: isSelected ? 'rgba(255, 102, 0, 0.35)' : 'rgba(255, 255, 255, 0.05)',
                  boxShadow: 'none',
                  textTransform: 'uppercase'
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible Study Plan Widget */}
      {activePlanProgress && (
        <div style={{
          background: 'var(--bg-panel)',
          border: 'none',
          padding: plannerExpanded ? '16px' : '10px 14px',
          borderRadius: '2px',
          marginBottom: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: plannerExpanded ? '12px' : '6px',
          transition: 'all 0.2s ease-in-out'
        }}>
          {!plannerExpanded ? (
            /* COLLAPSED Slim Widget */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="badge primary" style={{ textTransform: 'uppercase', fontSize: '8px' }}>
                  Study Plan Active
                </span>
                <span style={{ fontWeight: '600', fontSize: '13px' }}>
                  {activePlanProgress.curriculumId?.title || 'Active Curriculum'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                  Session {activePlanProgress.currentDay} of {activePlanProgress.dayProgress?.length || 14}
                </span>
              </div>
              
              {/* Mini Progress Indicator */}
              {(() => {
                const completedCount = activePlanProgress.dayProgress?.filter(dp => dp.status === 'completed').length || 0;
                const totalCount = activePlanProgress.dayProgress?.length || 14;
                const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '10px', fontFamily: 'Roboto Mono', color: '#8a8a8a' }}>
                      <span>{completedCount}/{totalCount} COMPLETED ({percent}%)</span>
                    </div>
                    <div style={{ width: '80px', height: '4px', background: '#282828', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent-orange)' }} />
                    </div>
                    
                    <Link to={`/planner/session/${activePlanProgress.currentDay}`}>
                      <button className="primary" style={{ padding: '4px 10px', fontSize: '10px' }}>
                        Resume Session
                      </button>
                    </Link>
                    <button 
                      onClick={() => setPlannerExpanded(true)} 
                      className="secondary"
                      style={{ padding: '4px 8px', fontSize: '10px' }}
                    >
                      Expand ▾
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* EXPANDED full details card */
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span className="badge primary" style={{ marginBottom: '6px', textTransform: 'uppercase' }}>
                    Current Study Plan
                  </span>
                  <h2 style={{ fontSize: '1.2rem', margin: 0, border: 'none', padding: 0 }}>
                    {activePlanProgress.curriculumId?.title || 'Active Curriculum'}
                  </h2>
                  <p className="card-subtitle" style={{ margin: '4px 0 0 0' }}>
                    Current Session: Day {activePlanProgress.currentDay} of {activePlanProgress.dayProgress?.length || 14}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Link to={`/planner`}>
                    <button className="secondary" style={{ fontSize: '11px', padding: '6px 12px' }}>
                      Planner Dashboard
                    </button>
                  </Link>
                  <button 
                    onClick={() => setPlannerExpanded(false)} 
                    className="secondary"
                    style={{ fontSize: '11px', padding: '6px 12px' }}
                  >
                    Collapse ▴
                  </button>
                </div>
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
                      <span>CURRICULUM PROGRESS ({percent}%)</span>
                      <span>{completedCount} OF {totalCount} SESSIONS COMPLETED</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#282828', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: 'var(--accent-orange)', transition: 'width 0.3s ease' }} />
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
                        <Link to={`/planner/session/${activePlanProgress.currentDay}`} style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 'bold', textDecoration: 'underline', color: '#ff6600' }}>
                          Start Day {activePlanProgress.currentDay} Session →
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {filteredSongsList.length === 0 ? (
        <EmptyState
          icon={
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
            </svg>
          }
          title={search || filterType !== 'all' ? 'No Tracks Found Matching Query' : 'Song Library Empty'}
          description={
            search || filterType !== 'all'
              ? 'Refine filter queries or reset filter parameters.'
              : 'Import a reference track from YouTube to begin auditing.'
          }
          ctaLabel={search || filterType !== 'all' ? 'Reset Filters' : 'Import First Song'}
          onCtaClick={search || filterType !== 'all' ? () => { setSearch(''); setFilterType('all'); } : null}
          ctaLink={search || filterType !== 'all' ? null : '/import'}
        />
      ) : viewMode === 'list' ? (
        /* LIST VIEW (Serato/DAW-Style) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* Table Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 15px',
            background: 'var(--bg-panel)',
            border: 'none',
            borderRadius: '2px',
            fontSize: '10px',
            fontFamily: 'Roboto Mono, monospace',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
          }}>
            <div style={{ width: '40px', marginRight: '12px' }}>Cover</div>
            <div style={{ flex: 3, minWidth: 0, paddingRight: '10px' }}>Title</div>
            <div style={{ flex: 2, minWidth: 0, paddingRight: '10px' }}>Artist</div>
            <div style={{ width: '120px', textAlign: 'center' }}>BPM / Key</div>
            <div style={{ width: '100px', textAlign: 'center' }}>Audits</div>
            <div style={{ width: '110px', textAlign: 'center' }}>Research</div>
            <div style={{ width: '220px', textAlign: 'right' }}>Actions</div>
          </div>

          {/* Table Rows */}
          {filteredSongsList.map((song) => {
            const isActive = activeSong && activeSong._id === song._id;
            const songAuditList = getSongAudits(song._id);
            const isExpanded = !!expandedSongs[song._id];

            const bpm = song.audioOverrides?.tempo_bpm || song.audioAnalysis?.tempo_bpm || null;
            const key = song.audioOverrides?.key 
              ? `${song.audioOverrides.key}${song.audioOverrides.scale === 'minor' ? 'm' : ''}` 
              : (song.audioAnalysis?.key ? `${song.audioAnalysis.key}${song.audioAnalysis.scale === 'minor' ? 'm' : ''}` : null);

            return (
              <div
                key={song._id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: isActive ? '#141c18' : 'var(--bg-panel)',
                  border: isActive ? '1px solid var(--status-high)' : 'none',
                  borderRadius: '2px',
                  transition: 'all 0.15s ease',
                  padding: '6px 15px',
                  boxShadow: isActive ? '0 0 12px rgba(52,211,153,0.1)' : '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Small Thumbnail */}
                  <div style={{ width: '40px', height: '30px', marginRight: '12px', background: '#202025', borderRadius: '1px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {(song.thumbnailUrl || song.thumbnail) ? (
                      <img
                        src={song.thumbnailUrl || song.thumbnail}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                      </svg>
                    )}
                  </div>

                  {/* Title */}
                  <div 
                    style={{ flex: 3, minWidth: 0, paddingRight: '10px', fontSize: '13px', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: '#ffffff' }}
                    title={song.title}
                  >
                    {song.title}
                  </div>

                  {/* Artist */}
                  <div 
                    style={{ flex: 2, minWidth: 0, paddingRight: '10px', fontSize: '12px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.6)', fontFamily: 'Roboto Mono' }}
                    title={song.artistName || song.artist}
                  >
                    {song.artistName || song.artist}
                  </div>

                  {/* BPM / Key */}
                  <div style={{ width: '120px', textAlign: 'center', fontSize: '11px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.8)' }}>
                    {bpm || key ? (
                      <span>
                        {bpm ? `${Math.round(bpm)} BPM` : ''}
                        {bpm && key ? ' · ' : ''}
                        {key ? `${key}` : ''}
                      </span>
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.2)' }}>--</span>
                    )}
                  </div>

                  {/* Audits */}
                  <div style={{ width: '100px', textAlign: 'center' }}>
                    <span 
                      className="badge" 
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                      {songAuditList.length}
                    </span>
                  </div>

                  {/* Research */}
                  <div style={{ width: '110px', textAlign: 'center' }}>
                    <span 
                      className={`badge ${song.researchStatus === 'success' ? 'success' : ''}`}
                      style={{ 
                        fontSize: '9px', 
                        padding: '2px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: song.researchStatus === 'success' ? '#4ade80' : 'rgba(255,255,255,0.2)' }} />
                      {song.researchStatus === 'success' ? 'Researched' : 'None'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ width: '220px', display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button
                      onClick={() => { loadSong(song); play(); }}
                      className={isActive ? 'success' : 'secondary'}
                      style={{
                        height: '26px',
                        fontSize: '10px',
                        padding: '0 10px',
                        fontWeight: 'bold'
                      }}
                    >
                      {isActive ? '● Active' : '▲ Load'}
                    </button>
                    
                    <Link to={`/audit/create/${song._id}`}>
                      <button className="primary" style={{ height: '26px', fontSize: '10px', padding: '0 10px' }}>
                        Audit
                      </button>
                    </Link>

                    {songAuditList.length > 0 && (
                      <button
                        onClick={() => toggleAudits(song._id)}
                        className="secondary"
                        style={{
                          height: '26px',
                          padding: '0 8px',
                          fontSize: '10px',
                          fontFamily: 'Roboto Mono',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        History ({songAuditList.length}) {isExpanded ? '▲' : '▼'}
                      </button>
                    )}

                    <button
                      className="secondary"
                      style={{
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        color: 'rgba(255,255,255,0.35)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => openDeleteModal(song)}
                      title="Delete Song"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#ef4444';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Audits List */}
                {isExpanded && songAuditList.length > 0 && (
                  <div style={{ 
                    marginTop: '8px', 
                    padding: '8px 12px', 
                    background: '#0c0c0e', 
                    border: '1px solid rgba(255, 255, 255, 0.04)', 
                    borderRadius: '2px',
                    marginLeft: '52px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ fontSize: '9px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.3)', marginBottom: '4px', textTransform: 'uppercase' }}>
                      Audit History Log
                    </div>
                    {songAuditList.map((audit) => (
                      <div
                        key={audit._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 8px',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          fontSize: '11px'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Roboto Mono' }}>
                            {formatDate(audit.createdAt)}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
                          <span className="badge" style={{ fontSize: '8px', padding: '1px 4px' }}>
                            {audit.workflowType}
                          </span>
                          {(audit.lensSelection || []).map((l) => (
                            <span key={l} className="badge primary" style={{ fontSize: '8px', padding: '1px 4px', textTransform: 'uppercase' }}>
                              {l}
                            </span>
                          ))}
                          <span className={`badge ${audit.status === 'completed' ? 'success' : 'warning'}`} style={{ fontSize: '8px', padding: '1px 4px', textTransform: 'uppercase' }}>
                            {audit.status}
                          </span>
                        </div>
                        <Link to={audit.status === 'completed' ? `/audit/${audit._id}` : `/audit/form/${audit._id}`}>
                          <button
                            className={audit.status === 'completed' ? 'secondary' : 'primary'}
                            style={{
                              padding: '2px 8px',
                              fontSize: '9px',
                              borderRadius: '2px',
                            }}
                          >
                            {audit.status === 'completed' ? 'Review →' : 'Resume'}
                          </button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid">
          {filteredSongsList.map((song) => {
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
                  borderColor: isActive ? 'var(--status-high)' : 'transparent',
                  background: isActive ? '#141c18' : 'var(--bg-panel)',
                  padding: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 0 12px rgba(52,211,153,0.1)' : '0 1px 2px rgba(0,0,0,0.3)'
                }}
              >
                {/* Thumbnail */}
                {(song.thumbnailUrl || song.thumbnail) ? (
                  <div style={{ position: 'relative', width: '100%', height: '140px', background: 'var(--bg-workspace)', overflow: 'hidden' }}>
                    <img
                      src={song.thumbnailUrl || song.thumbnail}
                      alt={song.title}
                      className="song-card-thumbnail"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: isActive ? 0.95 : 0.6,
                        filter: isActive ? 'none' : 'grayscale(30%)',
                      }}
                    />
                    {isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: '#10b981',
                          color: '#0c0c0e',
                          fontFamily: 'Roboto Mono',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '1px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                        }}
                      >
                        Active
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ position: 'relative', width: '100%', height: '140px', background: '#1d1d22', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                      <path d="M9 18V5l12-2v13"></path>
                      <circle cx="6" cy="18" r="3"></circle>
                      <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                    {isActive && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          background: '#10b981',
                          color: '#0c0c0e',
                          fontFamily: 'Roboto Mono',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          padding: '2px 6px',
                          borderRadius: '1px',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                        }}
                      >
                        Active
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
                  <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '8px', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                    {song.artistName || song.artist}
                  </p>

                  {/* Badges row shown by default */}
                  <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ fontSize: '9px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.4)' }} />
                      {songAuditList.length} {songAuditList.length === 1 ? 'Audit' : 'Audits'}
                    </span>
                    <span className={`badge ${song.researchStatus === 'success' ? 'success' : ''}`} style={{ fontSize: '9px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: song.researchStatus === 'success' ? '#4ade80' : 'rgba(255,255,255,0.2)' }} />
                      {song.researchStatus === 'success' ? 'Researched' : 'No Research'}
                    </span>
                  </div>

                  {/* Actions & Dropdowns hidden until hover */}
                  <div className="song-card-actions">
                    {/* Actions Row */}
                    <div style={{ display: 'flex', gap: '6px', width: '100%', marginBottom: '8px' }}>
                      <button
                        onClick={() => { loadSong(song); play(); }}
                        className={isActive ? 'success' : 'secondary'}
                        style={{
                          flex: 1,
                          height: '32px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold'
                        }}
                      >
                        {isActive ? '● Active' : '▲ Load'}
                      </button>
                      <Link to={`/audit/create/${song._id}`} style={{ flex: 1, display: 'flex' }}>
                        <button className="primary" style={{ width: '100%', height: '32px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          Audit
                        </button>
                      </Link>
                      <button
                        className="secondary"
                        style={{
                          width: '36px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          color: 'rgba(255,255,255,0.35)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'transparent',
                          cursor: 'pointer',
                        }}
                        onClick={() => openDeleteModal(song)}
                        title="Delete Song"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444';
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>

                    {/* Audit history toggle */}
                    {songAuditList.length > 0 && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                        <button
                          onClick={() => toggleAudits(song._id)}
                          className="secondary"
                          style={{
                            width: '100%',
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
                          <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {songAuditList.map((audit) => (
                              <div
                                key={audit._id}
                                style={{
                                  background: '#0c0c0e',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                  borderRadius: '2px',
                                  padding: '6px 8px',
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
                                        style={{ fontSize: '8px', textTransform: 'uppercase', padding: '1px 3px' }}
                                      >
                                        {l}
                                      </span>
                                    ))}
                                    <span
                                      className={`badge ${audit.status === 'completed' ? 'success' : 'warning'}`}
                                      style={{ fontSize: '8px', textTransform: 'uppercase', padding: '1px 3px' }}
                                    >
                                      {audit.status}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Roboto Mono' }}>
                                    {formatDate(audit.createdAt)}
                                  </div>
                                </div>
                                <Link to={audit.status === 'completed' ? `/audit/${audit._id}` : `/audit/form/${audit._id}`}>
                                  <button
                                    className={audit.status === 'completed' ? 'secondary' : 'primary'}
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '9px',
                                      borderRadius: '2px',
                                      whiteSpace: 'nowrap',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {audit.status === 'completed' ? 'Review →' : 'Resume'}
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
