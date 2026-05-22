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

  const songAuditCount = (songId) => audits.filter((a) => (a.songId?._id || a.songId) === songId).length;

  if (loading) return <div className="loading">LOADING LIBRARY MATRIX...</div>;

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
            placeholder="FILTER CHANNELS BY TITLE, ARTIST, OR RESEARCH TEXT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ 
              background: '#0c0c0e', 
              borderColor: 'rgba(255,255,255,0.08)',
              textTransform: 'uppercase'
            }}
          />
        </div>
      </div>

      {songs.length === 0 ? (
        <EmptyState 
          icon="🎧"
          title={search ? "NO CHANNELS FOUND MATCHING SEARCH" : "LIBRARY CRATE EMPTY"}
          description={search ? "Refine filter queries or reset search parameters." : "Initiate search indexing by importing a reference track from YouTube."}
          ctaLabel={search ? "Clear Filter" : "Import First Song"}
          onCtaClick={search ? () => setSearch('') : null}
          ctaLink={search ? null : "/import"}
        />
      ) : (
        <div className="grid">
          {songs.map((song) => {
            const isActive = activeSong && activeSong._id === song._id;
            return (
              <div 
                key={song._id} 
                className="panel" 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  borderColor: isActive ? '#d08f60' : 'rgba(255,255,255,0.08)',
                  background: isActive ? '#1a1a20' : '#151518'
                }}
              >
                {(song.thumbnailUrl || song.thumbnail) && (
                  <div style={{ position: 'relative', width: '100%', height: '140px', marginBottom: '12px', background: '#0a0a0c', overflow: 'hidden' }}>
                    <img
                      src={song.thumbnailUrl || song.thumbnail}
                      alt={song.title}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: isActive ? 0.85 : 0.6,
                        filter: 'grayscale(30%)'
                      }}
                    />
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        background: '#d08f60',
                        color: '#0c0c0e',
                        fontFamily: 'Roboto Mono',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '1px'
                      }}>
                        ACTIVE FEED
                      </div>
                    )}
                  </div>
                )}
                
                <h3 style={{ fontSize: '13px', marginBottom: '4px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={song.title}>
                  {song.title}
                </h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.45)', marginBottom: '12px', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                  {song.artistName || song.artist}
                </p>

                <div style={{ marginBottom: 'auto', display: 'flex', gap: '6px' }}>
                  <span className="badge primary">{songAuditCount(song._id)} AUDITS</span>
                  {song.researchStatus === 'success' && <span className="badge">RESEARCHED</span>}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '15px' }}>
                  <button 
                    onClick={() => { loadSong(song); play(); }}
                    style={{ 
                      flex: 1, 
                      fontSize: '10px',
                      background: isActive ? '#d08f60' : '#1c1c22',
                      color: isActive ? '#0c0c0e' : '#d08f60',
                      fontWeight: isActive ? 'bold' : 'normal'
                    }}
                  >
                    {isActive ? '■ ACTIVE' : '▲ LOAD'}
                  </button>
                  <Link to={`/audit/create/${song._id}`} style={{ flex: 1.2 }}>
                    <button style={{ width: '100%', fontSize: '10px' }}>AUDIT</button>
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
