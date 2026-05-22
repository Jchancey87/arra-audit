import React, { useState, useEffect } from 'react';
import { useBackend } from '../context/BackendContext';

const Trash = () => {
  const backend = useBackend();
  const [activeTab, setActiveTab] = useState('songs'); // 'songs' | 'audits'
  const [songs, setSongs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modal State
  const [purgeTarget, setPurgeTarget] = useState(null); // { type: 'song'|'audit', item }
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    loadTrash();
  }, []);

  const loadTrash = async () => {
    try {
      setLoading(true);
      setError('');
      const [deletedSongs, deletedAudits] = await Promise.all([
        backend.getDeletedSongs(),
        backend.getDeletedAudits(),
      ]);
      setSongs(deletedSongs || []);
      setAudits(deletedAudits || []);
    } catch (err) {
      setError(err.message || 'Failed to load archived items');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (type, id) => {
    try {
      setError('');
      setSuccessMessage('');
      if (type === 'song') {
        await backend.restoreSong(id);
        setSuccessMessage('Song and its associated audits restored successfully!');
      } else {
        await backend.restoreAudit(id);
        setSuccessMessage('Audit restored successfully!');
      }
      await loadTrash();
      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || `Failed to restore ${type}`);
    }
  };

  const openPurgeModal = (type, item) => {
    setPurgeTarget({ type, item });
  };

  const closePurgeModal = () => {
    setPurgeTarget(null);
  };

  const handleConfirmPurge = async () => {
    if (!purgeTarget) return;
    const { type, item } = purgeTarget;
    try {
      setIsPurging(true);
      setError('');
      setSuccessMessage('');
      
      if (type === 'song') {
        await backend.purgeSong(item._id);
        setSuccessMessage('Song permanently deleted along with all its audits and techniques.');
      } else {
        await backend.purgeAudit(item._id);
        setSuccessMessage('Audit permanently deleted.');
      }
      
      closePurgeModal();
      await loadTrash();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.message || `Failed to permanently delete ${type}`);
    } finally {
      setIsPurging(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return dateString;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Styled Tab Button Helper
  const tabStyle = (tabName) => ({
    padding: '12px 24px',
    cursor: 'pointer',
    border: 'none',
    background: activeTab === tabName 
      ? 'linear-gradient(135deg, #1976d2, #1565c0)' 
      : '#f0f0f0',
    color: activeTab === tabName ? 'white' : '#555',
    fontWeight: 'bold',
    fontSize: '15px',
    borderRadius: '30px',
    boxShadow: activeTab === tabName ? '0 4px 10px rgba(25, 118, 210, 0.3)' : 'none',
    transition: 'all 0.3s ease',
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="card" style={{ 
        background: 'linear-gradient(135deg, #ffffff, #fcfdff)', 
        borderLeft: '5px solid #1976d2',
        padding: '30px'
      }}>
        <h1>🗑️ Archives & Trash</h1>
        <p className="card-subtitle" style={{ fontSize: '15px', marginTop: '5px' }}>
          Restore soft-deleted songs and audits, or purge them permanently from the system.
        </p>
      </div>

      {/* Messages */}
      {error && <div className="error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ {error}</div>}
      {successMessage && <div className="success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>✅ {successMessage}</div>}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', marginTop: '10px' }}>
        <button 
          id="tab-deleted-songs"
          style={tabStyle('songs')}
          onClick={() => setActiveTab('songs')}
        >
          🎵 Deleted Songs ({songs.length})
        </button>
        <button 
          id="tab-deleted-audits"
          style={tabStyle('audits')}
          onClick={() => setActiveTab('audits')}
        >
          📝 Deleted Audits ({audits.length})
        </button>
      </div>

      {loading ? (
        <div className="loading" style={{ padding: '60px 0', fontSize: '18px' }}>
          🔄 Loading archived items...
        </div>
      ) : (
        <div>
          {/* Songs Tab */}
          {activeTab === 'songs' && (
            <div>
              {songs.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '50px 20px', color: '#666' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '15px' }}>🎧</span>
                  <h3>Deleted songs folder is empty</h3>
                  <p style={{ marginTop: '5px', fontSize: '14px' }}>Songs deleted from the library will appear here.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {songs.map((song) => (
                    <div 
                      key={song._id} 
                      className="card" 
                      style={{ 
                        display: 'flex', 
                        gap: '20px', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '20px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '10px',
                        transition: 'transform 0.2s',
                        background: '#ffffff'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                    >
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flex: 1 }}>
                        {(song.thumbnailUrl || song.thumbnail) && (
                          <img 
                            src={song.thumbnailUrl || song.thumbnail} 
                            alt={song.title} 
                            style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px' }}
                          />
                        )}
                        <div>
                          <h3 style={{ margin: 0 }}>{song.title}</h3>
                          <p style={{ margin: '2px 0 0', color: '#666', fontSize: '14px' }}>
                            {song.artistName || song.artist}
                          </p>
                          <div style={{ display: 'flex', gap: '15px', marginTop: '8px', fontSize: '12px', color: '#888' }}>
                            <span>⏱️ {formatDuration(song.durationSeconds)}</span>
                            <span>📅 Deleted: {formatDate(song.deletedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          className="secondary"
                          onClick={() => handleRestore('song', song._id)}
                          style={{ 
                            background: '#2e7d32', 
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#27682a'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#2e7d32'}
                        >
                          🔄 Restore
                        </button>
                        <button 
                          className="danger"
                          onClick={() => openPurgeModal('song', song)}
                          style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          🗑️ Purge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Audits Tab */}
          {activeTab === 'audits' && (
            <div>
              {audits.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '50px 20px', color: '#666' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '15px' }}>📝</span>
                  <h3>Deleted audits folder is empty</h3>
                  <p style={{ marginTop: '5px', fontSize: '14px' }}>
                    Audits deleted individually will appear here. Audits deleted as part of a song are restored when restoring the song.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {audits.map((audit) => (
                    <div 
                      key={audit._id} 
                      className="card" 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '20px',
                        border: '1px solid #e0e0e0',
                        borderRadius: '10px',
                        transition: 'transform 0.2s',
                        background: '#ffffff'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
                    >
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0 }}>{audit.title || 'Untitled Audit'}</h3>
                        <p style={{ margin: '2px 0 0', color: '#666', fontSize: '14px' }}>
                          Song: <strong>{audit.songId?.title || 'Unknown Song'}</strong> by {audit.songId?.artistName || audit.songId?.artist || 'Unknown Artist'}
                        </p>
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                          {(audit.lensSelection || []).map((lens) => (
                            <span key={lens} className="badge primary" style={{ fontSize: '11px', textTransform: 'capitalize' }}>
                              {lens}
                            </span>
                          ))}
                          <span style={{ color: '#888', fontSize: '12px', marginLeft: '5px', alignSelf: 'center' }}>
                            📅 Deleted: {formatDate(audit.deletedAt)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          className="secondary"
                          onClick={() => handleRestore('audit', audit._id)}
                          style={{ 
                            background: '#2e7d32', 
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#27682a'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#2e7d32'}
                        >
                          🔄 Restore
                        </button>
                        <button 
                          className="danger"
                          onClick={() => openPurgeModal('audit', audit)}
                          style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          🗑️ Purge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Purging */}
      {purgeTarget && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '90%', margin: '20px', borderTop: '5px solid #d32f2f' }}>
            <h2 style={{ color: '#d32f2f', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⚠️ Permanent Deletion
            </h2>
            <p style={{ marginTop: '15px', lineHeight: '1.5' }}>
              Are you sure you want to permanently delete this {purgeTarget.type === 'song' ? 'Song' : 'Audit'}?
            </p>
            <p style={{ fontWeight: 'bold', margin: '10px 0', padding: '10px', backgroundColor: '#fcf8f8', borderRadius: '4px' }}>
              {purgeTarget.type === 'song' ? purgeTarget.item.title : (purgeTarget.item.title || 'Untitled Audit')}
            </p>
            
            {purgeTarget.type === 'song' ? (
              <p style={{ color: '#d32f2f', fontSize: '13px', marginTop: '10px' }}>
                <strong>CRITICAL WARNING:</strong> Purging this song will permanently delete all associated audits and technique notes. This action <strong>CANNOT</strong> be undone.
              </p>
            ) : (
              <p style={{ color: '#d32f2f', fontSize: '13px', marginTop: '10px' }}>
                <strong>WARNING:</strong> Purging this audit will permanently delete all its bookmarks and technique logs. This action <strong>CANNOT</strong> be undone.
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '25px' }}>
              <button 
                className="danger" 
                onClick={handleConfirmPurge} 
                disabled={isPurging}
                style={{ flex: 1 }}
              >
                {isPurging ? 'Purging...' : 'Yes, Delete Permanently'}
              </button>
              <button 
                className="secondary" 
                onClick={closePurgeModal}
                disabled={isPurging}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trash;
