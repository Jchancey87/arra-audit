import React, { useState, useEffect } from 'react';
import { useBackend } from '../context/BackendContext';

const Trash = () => {
  const backend = useBackend();
  const [songs, setSongs] = useState([]);
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Collapsible section states
  const [songsOpen, setSongsOpen] = useState(true);
  const [auditsOpen, setAuditsOpen] = useState(true);

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

  const handleEmptyTrash = async () => {
    if (window.confirm("CRITICAL WARNING: Are you sure you want to permanently empty the trash? All deleted songs, audits, and technique notes will be lost forever. This action is irreversible.")) {
      try {
        setLoading(true);
        setError('');
        setSuccessMessage('');
        await Promise.all([
          backend.purgeAllSongs(),
          backend.purgeAllAudits()
        ]);
        setSuccessMessage('Trash successfully emptied!');
        await loadTrash();
        setTimeout(() => setSuccessMessage(''), 5000);
      } catch (err) {
        setError(err.message || 'Failed to empty trash');
      } finally {
        setLoading(false);
      }
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
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Page Header */}
      <div className="panel" style={{ 
        background: 'var(--bg-panel)', 
        borderBottom: '2px solid #ff6600'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ margin: 0, border: 'none', padding: 0, display: 'flex', alignItems: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
            Archives & Trash
          </h1>
          {(songs.length > 0 || audits.length > 0) && (
            <button 
              onClick={handleEmptyTrash} 
              className="danger"
              style={{ fontSize: '11px', fontWeight: 'bold' }}
            >
              Empty Trash
            </button>
          )}
        </div>
        <p className="card-subtitle" style={{ margin: '8px 0 0 0' }}>
          Restore soft-deleted songs and audits, or purge them permanently from the system database.
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="error" style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          {error}
        </div>
      )}
      {successMessage && (
        <div className="success" style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', color: '#4ade80' }}>
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="loading">
          Synchronizing archive storage...
        </div>
      ) : (
        <div style={{ marginTop: '20px' }}>
          {/* Songs Accordion */}
          <div style={{ marginBottom: '20px' }}>
            <div 
              onClick={() => setSongsOpen(!songsOpen)}
              style={{
                background: 'var(--bg-workspace)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '2px',
                padding: '10px 15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                marginBottom: '10px'
              }}
            >
              <span style={{ fontFamily: 'Roboto Mono', fontSize: '12px', fontWeight: 'bold', color: '#ff6600' }}>
                {songsOpen ? '▼' : '▶'} Deleted Songs ({songs.length})
              </span>
            </div>

            {songsOpen && (
              <div>
                {songs.length === 0 ? (
                  <div className="panel" style={{ textAlign: 'center', padding: '30px 20px', background: 'var(--bg-panel)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                    <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                        <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                      </svg>
                    </span>
                    <h3 style={{ marginBottom: '6px', fontSize: '12px' }}>Deleted songs folder is empty</h3>
                    <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Roboto Mono', fontSize: '11px' }}>
                      Songs deleted from the library will appear here.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {songs.map((song) => (
                      <div 
                        key={song._id} 
                        className="panel" 
                        style={{ 
                          display: 'flex', 
                          gap: '20px', 
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 15px',
                          background: 'var(--bg-panel)',
                          borderColor: 'rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1 }}>
                          {(song.thumbnailUrl || song.thumbnail) && (
                            <img 
                              src={song.thumbnailUrl || song.thumbnail} 
                              alt={song.title} 
                              style={{ 
                                width: '70px', 
                                height: '52px', 
                                objectFit: 'cover', 
                                borderRadius: '2px', 
                                border: '1px solid rgba(255,255,255,0.06)' 
                              }}
                            />
                          )}
                          <div>
                            <h3 style={{ margin: 0, fontSize: '12px' }}>{song.title}</h3>
                            <p style={{ margin: '2px 0 0', color: 'rgba(255, 255, 255, 0.45)', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                              {song.artistName || song.artist}
                            </p>
                            <div style={{ display: 'flex', gap: '15px', marginTop: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontFamily: 'Roboto Mono' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                                {formatDuration(song.durationSeconds)}
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                  <line x1="16" y1="2" x2="16" y2="6"></line>
                                  <line x1="8" y1="2" x2="8" y2="6"></line>
                                  <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                                Deleted: {formatDate(song.deletedAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={() => handleRestore('song', song._id)}
                            style={{ 
                              background: '#1c2d21', 
                              color: '#4ade80',
                              borderColor: 'rgba(74, 222, 128, 0.3)',
                              padding: '6px 12px',
                              fontSize: '10px'
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                              </svg>
                              Restore
                            </span>
                          </button>
                          <button 
                            className="danger"
                            onClick={() => openPurgeModal('song', song)}
                            style={{ padding: '6px 12px', fontSize: '10px' }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                              Purge
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audits Accordion */}
          <div style={{ marginBottom: '20px' }}>
            <div 
              onClick={() => setAuditsOpen(!auditsOpen)}
              style={{
                background: 'var(--bg-workspace)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '2px',
                padding: '10px 15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                marginBottom: '10px'
              }}
            >
              <span style={{ fontFamily: 'Roboto Mono', fontSize: '12px', fontWeight: 'bold', color: '#ff6600' }}>
                {auditsOpen ? '▼' : '▶'} Deleted Audits ({audits.length})
              </span>
            </div>

            {auditsOpen && (
              <div>
                {audits.length === 0 ? (
                  <div className="panel" style={{ textAlign: 'center', padding: '30px 20px', background: 'var(--bg-panel)', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                    <span style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </span>
                    <h3 style={{ marginBottom: '6px', fontSize: '12px' }}>Deleted audits folder is empty</h3>
                    <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Roboto Mono', fontSize: '11px' }}>
                      Audits deleted individually will appear here. Audits deleted as part of a song are restored when restoring the song.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {audits.map((audit) => (
                      <div 
                        key={audit._id} 
                        className="panel" 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 15px',
                          background: 'var(--bg-panel)',
                          borderColor: 'rgba(255, 255, 255, 0.08)'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: 0, fontSize: '12px' }}>{audit.title || 'Untitled Audit'}</h3>
                          <p style={{ margin: '2px 0 0', color: 'rgba(255, 255, 255, 0.65)', fontSize: '11px' }}>
                            Song: <strong style={{ color: '#ff6600', fontFamily: 'Roboto Mono' }}>{audit.songId?.title || 'Unknown Song'}</strong> by {audit.songId?.artistName || audit.songId?.artist || 'Unknown Artist'}
                          </p>
                          
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {(audit.lensSelection || []).map((lens) => (
                              <span key={lens} className="badge primary" style={{ fontSize: '9px', textTransform: 'capitalize' }}>
                                {lens}
                              </span>
                            ))}
                            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '9px', fontFamily: 'Roboto Mono', marginLeft: '5px', alignSelf: 'center', display: 'inline-flex', alignItems: 'center' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                              </svg>
                              Deleted: {formatDate(audit.deletedAt)}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button 
                            onClick={() => handleRestore('audit', audit._id)}
                            style={{ 
                              background: '#1c2d21', 
                              color: '#4ade80',
                              borderColor: 'rgba(74, 222, 128, 0.3)',
                              padding: '6px 12px',
                              fontSize: '10px'
                            }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                <polyline points="23 4 23 10 17 10"></polyline>
                                <polyline points="1 20 1 14 7 14"></polyline>
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                              </svg>
                              Restore
                            </span>
                          </button>
                          <button 
                            className="danger"
                            onClick={() => openPurgeModal('audit', audit)}
                            style={{ padding: '6px 12px', fontSize: '10px' }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                              Purge
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
          <div className="panel" style={{ maxWidth: '500px', width: '90%', margin: '20px', borderTop: '4px solid #f87171', background: 'var(--bg-panel)' }}>
            <h2 style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontFamily: 'Roboto Mono' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              CRITICAL: PERMANENT PURGE SEQUENCE
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
              color: '#ff6600'
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
