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
      const [songsRes, auditsRes] = await Promise.all([
        backend.getSongs(search ? { search } : {}),
        backend.getAudits(),
      ]);
      setSongs(songsRes);
      setAudits(auditsRes);
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
      <div className="panel" style={{ background: '#151518', borderBottom: '2px solid #d08f60' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h1 style={{ margin: 0, border: 'none', padding: 0 }}>🎛️ Song Library Crate</h1>
          <Link to="/import">
            <button style={{ background: '#d08f60', color: '#0c0c0e', fontWeight: 'bold' }}>+ Import Track</button>
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

      {songs.length === 0 ? (
        <EmptyState
          icon="🎧"
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
                  borderColor: isActive ? '#d08f60' : 'rgba(255,255,255,0.08)',
                  background: isActive ? '#1a1a20' : '#151518',
                  padding: 0,
                  overflow: 'hidden',
                }}
              >
                {/* Thumbnail */}
                {(song.thumbnailUrl || song.thumbnail) && (
                  <div style={{ position: 'relative', width: '100%', height: '140px', background: '#0a0a0c', overflow: 'hidden' }}>
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
                          background: '#d08f60',
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

                  {/* Badges */}
                  <div style={{ marginBottom: 'auto', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span className="badge primary">{songAuditList.length} {songAuditList.length === 1 ? 'Audit' : 'Audits'}</span>
                    {song.researchStatus === 'success' && <span className="badge success">Researched</span>}
                  </div>

                  {/* Action row */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                    <button
                      onClick={() => { loadSong(song); play(); }}
                      style={{
                        flex: 1,
                        fontSize: '10px',
                        background: isActive ? '#d08f60' : '#1c1c22',
                        color: isActive ? '#0c0c0e' : '#d08f60',
                        fontWeight: isActive ? 'bold' : 'normal',
                      }}
                    >
                      {isActive ? '■ Active' : '▲ Load'}
                    </button>
                    <Link to={`/audit/create/${song._id}`} style={{ flex: 1.2 }}>
                      <button style={{ width: '100%', fontSize: '10px' }}>Audit</button>
                    </Link>
                    <button
                      className="danger"
                      onClick={() => openDeleteModal(song)}
                      style={{ flex: 'none', padding: '8px 10px' }}
                      title="Delete Song"
                    >
                      🗑️
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
                                    background: audit.status === 'completed' ? '#1c1c22' : 'rgba(208, 143, 96, 0.12)',
                                    color: '#d08f60',
                                    border: '1px solid rgba(208,143,96,0.3)',
                                    borderRadius: '2px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    fontWeight: audit.status === 'completed' ? 'normal' : 'bold',
                                  }}
                                >
                                  {audit.status === 'completed' ? 'Review →' : 'Resume ⚡'}
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
