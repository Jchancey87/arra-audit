import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

const AuditDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const backend = useBackend();
  
  const {
    loadSong,
    setActiveAudit,
    seekTo
  } = useAudio();

  const [audit, setAudit] = useState(null);
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const auditRes = await backend.getAudit(id);
      if (!auditRes) {
        setError('Audit not found');
        return;
      }
      setAudit(auditRes);
      
      const songRes = await backend.getSong(auditRes.songId?._id || auditRes.songId);
      setSong(songRes);
      loadSong(songRes); // load song into global transport
    } catch (err) {
      setError('Failed to load audit details');
    } finally {
      setLoading(false);
    }
  };

  // Sync activeAudit to global context
  useEffect(() => {
    if (audit) {
      setActiveAudit(audit);
    }
    return () => {
      setActiveAudit(null);
    };
  }, [audit, setActiveAudit]);

  const handleConfirmDelete = async () => {
    try {
      await backend.deleteAudit(id);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to delete audit');
      setIsDeleteModalOpen(false);
    }
  };

  const formatTimestamp = (seconds) => {
    const s = Math.floor(seconds || 0);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="loading">LOADING AUDIT SCHEMATIC...</div>;
  if (error || !audit) return <div className="error">{error || 'Audit not found'}</div>;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="panel" style={{ background: '#151518', borderBottom: '2px solid #d08f60' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
          <div>
            <h1>{song?.title || 'Unknown Song'}</h1>
            <p className="card-subtitle" style={{ marginBottom: '8px' }}>
              by {song?.artistName || song?.artist || 'Unknown Artist'}
            </p>
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {audit.lensSelection.map((lens) => (
                <span key={lens} className="badge primary" style={{ textTransform: 'capitalize' }}>
                  {lens}
                </span>
              ))}
              <span className="badge" style={{ textTransform: 'capitalize' }}>{audit.workflowType} mode</span>
              <span className={`badge ${audit.status === 'completed' ? 'success' : 'warning'}`} style={{ textTransform: 'uppercase' }}>
                {audit.status}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => setIsDeleteModalOpen(true)} className="danger">
              Delete
            </button>
            <button onClick={() => navigate('/dashboard')} className="secondary">
              Back to Library
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {/* Audit responses */}
        {audit.responses && Object.keys(audit.responses).length > 0 && (
          <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ color: '#d08f60', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em' }}>
              SIGNAL OBSERVATIONS MATRIX
            </h2>
            <div style={{ marginTop: '15px' }}>
              {Object.entries(audit.responses).map(([key, value]) => {
                if (!value) return null;
                // Parse key like "rhythm-q0"
                const [lens, qRef] = key.split('-');
                return (
                  <div 
                    key={key} 
                    style={{ 
                      marginBottom: '20px', 
                      backgroundColor: '#0c0c0e', 
                      padding: '15px', 
                      borderRadius: '2px', 
                      borderLeft: '4px solid #d08f60',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderLeftWidth: '4px',
                      borderLeftColor: '#d08f60'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <strong style={{ color: '#d08f60', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                        {lens} Lens // {qRef?.toUpperCase() || ''}
                      </strong>
                    </div>
                    <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'rgba(255, 255, 255, 0.85)', fontSize: '12px' }}>
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bookmarks */}
        {audit.bookmarks && audit.bookmarks.length > 0 && (
          <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ color: '#d08f60', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em' }}>
              SESSION BOOKMARKS ({audit.bookmarks.length})
            </h2>
            <div style={{ marginTop: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
              {audit.bookmarks.map((bookmark, idx) => (
                <div
                  key={bookmark._id || idx}
                  style={{
                    background: '#0c0c0e',
                    padding: '15px',
                    borderRadius: '2px',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <strong 
                      onClick={() => seekTo(bookmark.timestampSeconds || bookmark.timestamp)}
                      style={{ 
                        color: '#d08f60', 
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontFamily: 'Roboto Mono',
                        fontSize: '11px'
                      }}
                      title="Click to seek in player"
                    >
                      {formatTimestamp(bookmark.timestampSeconds || bookmark.timestamp)}
                    </strong>
                    {bookmark.lens && <span className="badge" style={{ fontSize: '9px', textTransform: 'uppercase' }}>{bookmark.lens}</span>}
                  </div>
                  {bookmark.label && <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.9)' }}>{bookmark.label}</div>}
                  {bookmark.note && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', margin: 0 }}>{bookmark.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Techniques */}
        {audit.techniques && audit.techniques.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ color: '#d08f60', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em', margin: 0 }}>
                PORTABLE TECHNIQUES LOG ({audit.techniques.length})
              </h2>
              <Link to="/techniques">
                <button className="secondary" style={{ padding: '4px 10px', fontSize: '10px' }}>Open Notebook</button>
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
              {audit.techniques.map((tech, idx) => (
                <div
                  key={tech._id || idx}
                  style={{
                    background: '#0c0c0e',
                    padding: '15px',
                    borderRadius: '2px',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#d08f60', fontFamily: 'Roboto Mono' }}>
                        {tech.techniqueName || tech.description}
                      </div>
                      <span className="badge" style={{ marginTop: '5px', display: 'inline-block', textTransform: 'uppercase' }}>
                        {tech.lens || tech.category}
                      </span>
                    </div>
                    {tech.exampleTimestamp !== undefined && (
                      <span 
                        onClick={() => seekTo(tech.exampleTimestamp)}
                        style={{ 
                          color: '#d08f60', 
                          fontWeight: 'bold', 
                          fontSize: '11px',
                          fontFamily: 'Roboto Mono',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        title="Click to seek in player"
                      >
                        {formatTimestamp(tech.exampleTimestamp)}
                      </span>
                    )}
                  </div>
                  {tech.techniqueName && tech.description && (
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', margin: 0 }}>{tech.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDeleteModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        type="audit"
        id={id}
        backend={backend}
      />
    </div>
  );
};

export default AuditDetail;
