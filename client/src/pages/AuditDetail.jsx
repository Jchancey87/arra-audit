import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import ArrangementTimelineWidget from '../components/ArrangementTimelineWidget';


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

  if (loading) return <div className="loading">Loading audit schematic...</div>;
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

        {/* Research Intelligence Log */}
        {song?.researchSummary?.summary && (
          <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ color: '#d08f60', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em', marginBottom: '12px' }}>
              📡 Song Research Intelligence
            </h2>
            <div style={{
              background: '#0c0c0e',
              padding: '15px',
              borderRadius: '2px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderLeft: '4px solid #d08f60',
              lineHeight: '1.6',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '12px',
              whiteSpace: 'pre-wrap'
            }}>
              {song.researchSummary.summary}
            </div>

            {song.researchSummary.results && song.researchSummary.results.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Roboto Mono', display: 'block', marginBottom: '6px' }}>
                  Sources Referenced:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {song.researchSummary.results.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="badge"
                      style={{
                        fontSize: '9px',
                        borderColor: 'rgba(208, 143, 96, 0.25)',
                        color: '#d08f60',
                        textDecoration: 'none',
                        padding: '3px 8px'
                      }}
                      title={src.content}
                    >
                      🔗 {src.title || `Source ${i+1}`} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audit responses */}
        {audit.responses && Object.keys(audit.responses).length > 0 && (
          <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ color: '#d08f60', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em' }}>
              Signal Observations Matrix
            </h2>
            <div style={{ marginTop: '15px' }}>
              {audit.templateQuestions?.lenses ? (
                // Grouped by template lenses to show actual questions
                Object.entries(audit.templateQuestions.lenses).map(([lens, lensData]) => {
                  const questions = lensData.questions || [];
                  const hasAnswers = questions.some((_, idx) => audit.responses[`${lens}-q${idx}`]);
                  if (!hasAnswers) return null;

                  return (
                    <div key={lens} style={{ marginBottom: '25px' }}>
                      <h3 style={{ textTransform: 'capitalize', color: '#d08f60', fontSize: '12px', fontFamily: 'Roboto Mono', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '12px' }}>
                        {lens} Lens
                      </h3>
                      {lens === 'arrangement' && (
                        <ArrangementTimelineWidget
                          responses={audit.responses}
                          song={song}
                          readOnly={true}
                        />
                      )}
                      {lensData.exercises && lensData.exercises.length > 0 && (
                        <div style={{
                          marginBottom: '15px',
                          padding: '12px',
                          background: 'rgba(208, 143, 96, 0.02)',
                          border: '1px dashed rgba(208, 143, 96, 0.15)',
                          borderRadius: '2px',
                        }}>
                          <strong style={{ display: 'block', fontSize: '10px', fontFamily: 'Roboto Mono', color: '#d08f60', marginBottom: '8px' }}>
                            🔬 CONCRETE EXERCISES (TAILORED)
                          </strong>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {lensData.exercises.map((ex, idx) => (
                              <div key={idx} style={{ background: '#070709', padding: '10px', borderLeft: '2px solid #d08f60', borderRadius: '1px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>{ex.name}</div>
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>{ex.description}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {questions.map((question, idx) => {
                        const answer = audit.responses[`${lens}-q${idx}`];
                        if (!answer) return null;
                        return (
                          <div 
                            key={idx} 
                            style={{ 
                              marginBottom: '15px', 
                              backgroundColor: '#0c0c0e', 
                              padding: '15px', 
                              borderRadius: '2px', 
                              borderLeft: '4px solid #d08f60',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderLeftWidth: '4px',
                              borderLeftColor: '#d08f60'
                            }}
                          >
                            <div style={{ fontWeight: '600', marginBottom: '8px', color: 'rgba(255,255,255,0.85)', fontSize: '12px' }}>
                              {question}
                            </div>
                            <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px', margin: 0 }}>
                              {answer}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                // Fallback to raw responses if templateQuestions is not present
                Object.entries(audit.responses).map(([key, value]) => {
                  if (!value || key === 'recreation') return null;
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
                      <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'rgba(255, 255, 255, 0.85)', fontSize: '12px', margin: 0 }}>
                        {value}
                      </p>
                    </div>
                  );
                })
              )}

              {/* Recreation Notes */}
              {audit.responses.recreation && (
                <div 
                  style={{ 
                    marginTop: '25px', 
                    backgroundColor: '#0c0c0e', 
                    padding: '15px', 
                    borderRadius: '2px', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderLeft: '4px solid #14b8a6',
                    borderLeftWidth: '4px'
                  }}
                >
                  <strong style={{ color: '#14b8a6', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                    🛠️ Recreate / Transcription Lens
                  </strong>
                  <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'rgba(255, 255, 255, 0.65)', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
                    {audit.responses.recreation}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bookmarks */}
        {audit.bookmarks && audit.bookmarks.length > 0 && (
          <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <h2 style={{ color: '#d08f60', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em' }}>
              Session Bookmarks ({audit.bookmarks.length})
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
                Portable Techniques Log ({audit.techniques.length})
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
