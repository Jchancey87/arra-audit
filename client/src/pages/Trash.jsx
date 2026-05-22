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
    padding: '8px 16px',
    cursor: 'pointer',
    fontFamily: 'Roboto Mono',
    fontSize: '11px',
    textTransform: 'uppercase',
    background: activeTab === tabName ? '#d08f60' : '#1c1c22',
    color: activeTab === tabName ? '#0c0c0e' : '#d08f60',
    border: `1px solid ${activeTab === tabName ? '#d08f60' : 'rgba(208, 143, 96, 0.3)'}`,
    borderRadius: '2px',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="panel" style={{ 
        background: '#151518', 
        borderBottom: '2px solid #d08f60'
      }}>
        <h1>🗑️ Archives & Trash</h1>
        <p className="card-subtitle" style={{ margin: 0 }}>
          Restore soft-deleted songs and audits, or purge them permanently from the system database.
        </p>
      </div>

      {/* Messages */}
      {error && <div className="error">⚠️ {error}</div>}
      {successMessage && <div className="success">✅ {successMessage}</div>}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', marginTop: '10px' }}>
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
        <div className="loading">
          SYNCHRONIZING ARCHIVE STORAGE...
        </div>
      ) : (
        <div>
          {/* Songs Tab */}
          {activeTab === 'songs' && (
            <div>
              {songs.length === 0 ? (
                <div className="panel" style={{ textAlign: 'center', padding: '50px 20px', background: '#151518', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '15px' }}>🎧</span>
                  <h3 style={{ marginBottom: '8px' }}>Deleted songs folder is empty</h3>
                  <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Roboto Mono', fontSize: '11px' }}>
                    Songs deleted from the library will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {songs.map((song) => (
                    <div 
                      key={song._id} 
                      className="panel" 
                      style={{ 
                        display: 'flex', 
                        gap: '20px', 
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '15px',
                        background: '#151518',
                        borderColor: 'rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flex: 1 }}>
                        {(song.thumbnailUrl || song.thumbnail) && (
                          <img 
                            src={song.thumbnailUrl || song.thumbnail} 
                            alt={song.title} 
                            style={{ 
                              width: '80px', 
                              height: '60px', 
                              objectFit: 'cover', 
                              borderRadius: '2px', 
                              border: '1px solid rgba(255,255,255,0.06)' 
                            }}
                          />
                        )}
                        <div>
                          <h3 style={{ margin: 0, fontSize: '13px' }}>{song.title}</h3>
                          <p style={{ margin: '2px 0 0', color: 'rgba(255, 255, 255, 0.45)', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                            {song.artistName || song.artist}
                          </p>
                          <div style={{ display: 'flex', gap: '15px', marginTop: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Roboto Mono' }}>
                            <span>⏱️ {formatDuration(song.durationSeconds)}</span>
                            <span>📅 Deleted: {formatDate(song.deletedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => handleRestore('song', song._id)}
                          style={{ 
                            background: '#1c2d21', 
                            color: '#4ade80',
                            borderColor: 'rgba(74, 222, 128, 0.3)'
                          }}
                        >
                          🔄 Restore
                        </button>
                        <button 
                          className="danger"
                          onClick={() => openPurgeModal('song', song)}
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
                <div className="panel" style={{ textAlign: 'center', padding: '50px 20px', background: '#151518', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <span style={{ fontSize: '48px', display: 'block', marginBottom: '15px' }}>📝</span>
                  <h3 style={{ marginBottom: '8px' }}>Deleted audits folder is empty</h3>
                  <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Roboto Mono', fontSize: '11px' }}>
                    Audits deleted individually will appear here. Audits deleted as part of a song are restored when restoring the song.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {audits.map((audit) => (
                    <div 
                      key={audit._id} 
                      className="panel" 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '15px',
                        background: '#151518',
                        borderColor: 'rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '13px' }}>{audit.title || 'Untitled Audit'}</h3>
                        <p style={{ margin: '2px 0 0', color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px' }}>
                          Song: <strong style={{ color: '#d08f60', fontFamily: 'Roboto Mono' }}>{audit.songId?.title || 'Unknown Song'}</strong> by {audit.songId?.artistName || audit.songId?.artist || 'Unknown Artist'}
                        </p>
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                          {(audit.lensSelection || []).map((lens) => (
                            <span key={lens} className="badge primary" style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                              {lens}
                            </span>
                          ))}
                          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontFamily: 'Roboto Mono', marginLeft: '5px', alignSelf: 'center' }}>
                            📅 Deleted: {formatDate(audit.deletedAt)}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => handleRestore('audit', audit._id)}
                          style={{ 
                            background: '#1c2d21', 
                            color: '#4ade80',
                            borderColor: 'rgba(74, 222, 128, 0.3)'
                          }}
                        >
                          🔄 Restore
                        </button>
                        <button 
                          className="danger"
                          onClick={() => openPurgeModal('audit', audit)}
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
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="panel" style={{ maxWidth: '500px', width: '90%', margin: '20px', borderTop: '4px solid #f87171', background: '#151518' }}>
            <h2 style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontFamily: 'Roboto Mono' }}>
              ⚠️ CRITICAL: PERMANENT PURGE SEQUENCE
            </h2>
            <p style={{ marginTop: '15px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)' }}>
              Are you sure you want to permanently purge this {purgeTarget.type === 'song' ? 'Song' : 'Audit'} from the active disk clusters?
            </p>
            <p style={{ 
              fontWeight: 'bold', 
              margin: '12px 0', 
              padding: '10px', 
              backgroundColor: '#0c0c0e', 
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '2px',
              fontFamily: 'Roboto Mono',
              fontSize: '12px',
              color: '#d08f60'
            }}>
              {purgeTarget.type === 'song' ? purgeTarget.item.title : (purgeTarget.item.title || 'Untitled Audit')}
            </p>
            
            {purgeTarget.type === 'song' ? (
              <p style={{ color: '#f87171', fontSize: '11px', fontFamily: 'Roboto Mono', marginTop: '10px', lineHeight: '1.4' }}>
                <strong>CRITICAL WARNING:</strong> Purging this song will permanently delete all associated audits and technique notes. This action is irreversible.
              </p>
            ) : (
              <p style={{ color: '#f87171', fontSize: '11px', fontFamily: 'Roboto Mono', marginTop: '10px', lineHeight: '1.4' }}>
                <strong>WARNING:</strong> Purging this audit will permanently delete all its bookmarks and technique logs. This action is irreversible.
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
