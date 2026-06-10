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
    seekTo,
    isPlaying,
    currentTime,
    duration,
  } = useAudio();

  const [audit, setAudit] = useState(null);
  const [song, setSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);

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
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
            <button
              onClick={() => navigate(`/audit/form/${audit._id}`)}
              style={{
                background: '#d08f60',
                color: '#0c0c0e',
                fontWeight: 'bold',
                border: 'none',
                padding: '8px 16px',
                cursor: 'pointer',
                fontFamily: 'Roboto Mono',
                fontSize: '11px',
                borderRadius: '2px',
              }}
            >
              {audit.status === 'completed' ? 'Edit Audit' : 'Resume Audit'}
            </button>
            <button onClick={() => setIsDeleteModalOpen(true)} className="danger">
              Delete
            </button>
            <button onClick={() => navigate('/dashboard')} className="secondary">
              Back to Library
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {/* 🧬 SIGNAL AUDIO ANALYSIS MATRIX (READ-ONLY) */}
        {song && song.audioAnalysisStatus === 'success' && song.audioAnalysis && (
          <div className="panel" style={{ background: '#141418', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '2px', padding: '20px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowAnalysis(!showAnalysis)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#d08f60', fontSize: '14px' }}>🧬</span>
                <h3 style={{ margin: 0, fontFamily: 'Roboto Mono', fontSize: '13px', color: '#d08f60' }}>
                  SIGNAL ANALYSIS MATRIX // CANONICAL DESCRIPTORS
                </h3>
              </div>
              <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '10px', fontFamily: 'Roboto Mono' }}>
                {showAnalysis ? 'COLLAPSE' : 'EXPAND'}
              </button>
            </div>

            {showAnalysis && (
              <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '15px' }}>
                {/* Active Values Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                  {[
                    {
                      label: 'TEMPO / BPM',
                      value: song.audioOverrides?.tempo_bpm || song.audioAnalysis.tempo_bpm,
                      conf: song.audioAnalysis.tempo_confidence,
                      isOverridden: !!song.audioOverrides?.tempo_bpm
                    },
                    {
                      label: 'TONAL KEY',
                      value: `${song.audioOverrides?.key || song.audioAnalysis.key} ${song.audioOverrides?.scale || song.audioAnalysis.scale || ''}`,
                      conf: song.audioAnalysis.key_confidence,
                      isOverridden: !!song.audioOverrides?.key
                    },
                    {
                      label: 'METER / TIME',
                      value: song.audioOverrides?.estimated_meter || song.audioAnalysis.estimated_meter,
                      conf: song.audioAnalysis.meter_confidence,
                      isOverridden: !!song.audioOverrides?.estimated_meter
                    },
                    {
                      label: 'LOUDNESS (INTEG)',
                      value: `${song.audioAnalysis.loudness_integrated} LUFS`,
                      conf: 0.99,
                      isReadOnly: true
                    }
                  ].map((item, idx) => {
                    const valNum = parseFloat(item.conf);
                    const isHigh = valNum > 0.8;
                    const isMed = valNum >= 0.5 && valNum <= 0.8;
                    const badgeColor = isHigh ? '#4ade80' : isMed ? '#fbbf24' : '#f87171';
                    const badgeText = isHigh ? 'CONFIDENT' : isMed ? 'PROBABLE' : 'REVIEW NEEDED';

                    return (
                      <div key={idx} style={{ background: '#0a0a0c', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '1px' }}>
                        <div style={{ fontSize: '9px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Roboto Mono', color: '#d08f60', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                          {item.value}
                          {item.isOverridden && (
                            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', fontWeight: 'normal' }}>(override)</span>
                          )}
                        </div>
                        {!item.isReadOnly && (
                          <div style={{ fontSize: '9px', fontFamily: 'Roboto Mono', color: badgeColor, marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: badgeColor }} />
                            {badgeText} ({Math.round(item.conf * 100)}%)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Timeline lanes */}
                {duration > 0 && (
                  <div style={{ background: '#0a0a0c', padding: '15px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.45)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>⏱️ REAL-TIME TEMPORAL LANES</span>
                      <span>{formatTimestamp(currentTime)} / {formatTimestamp(duration)}</span>
                    </div>
                    
                    {/* Interactive Playhead Lane */}
                    <div 
                      style={{ position: 'relative', height: '28px', background: '#101014', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        seekTo(pct * duration);
                      }}
                    >
                      {/* Beat Ticks */}
                      {(song.audioAnalysis.beat_times || []).map((t, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: `${(t / duration) * 100}%`,
                            top: '16px',
                            width: '1px',
                            height: '6px',
                            background: 'rgba(255, 255, 255, 0.12)'
                          }}
                        />
                      ))}

                      {/* Downbeat Ticks */}
                      {(song.audioAnalysis.downbeat_times || []).map((t, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: `${(t / duration) * 100}%`,
                            top: '10px',
                            width: '1.5px',
                            height: '12px',
                            background: 'rgba(208, 143, 96, 0.4)'
                          }}
                        />
                      ))}

                      {/* Playhead */}
                      <div
                        style={{
                          position: 'absolute',
                          left: `${(currentTime / duration) * 100}%`,
                          top: 0,
                          width: '2px',
                          height: '100%',
                          background: '#f87171',
                          boxShadow: '0 0 8px #f87171',
                          zIndex: 10
                        }}
                      >
                        <div style={{ position: 'absolute', top: '-3px', left: '-3px', width: '8px', height: '8px', borderRadius: '50%', background: '#f87171' }} />
                      </div>
                    </div>

                    {/* Tonal lane (Sections) */}
                    <div style={{ position: 'relative', height: '24px', background: '#0a0a0c', marginTop: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                      {(song.audioAnalysis.sectional_key_candidates || []).map((sect, i, arr) => {
                        const pctWidth = 100 / arr.length;
                        return (
                          <div
                            key={i}
                            style={{
                              width: `${pctWidth}%`,
                              height: '100%',
                              borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                              padding: '4px',
                              boxSizing: 'border-box',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              background: Math.abs(currentTime - (duration / arr.length) * (i + 0.5)) < (duration / arr.length / 2) && isPlaying ? 'rgba(208,143,96,0.05)' : 'transparent'
                            }}
                          >
                            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {sect.section}
                            </span>
                            <span style={{ fontSize: '9px', fontWeight: 'bold', fontFamily: 'Roboto Mono', color: '#d08f60' }}>
                              {sect.key} {sect.scale === 'minor' ? 'm' : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                      {lens === 'arrangement' ? (
                        <ArrangementTimelineWidget
                          responses={audit.responses}
                          song={song}
                          lensData={lensData}
                          readOnly={true}
                        />
                      ) : (
                        <>
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
                                  border: '1px solid rgba(255,255,255,0.04)' 
                                }}
                              >
                                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Roboto Mono', marginBottom: '6px' }}>
                                  Q: {question}
                                </div>
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                  {answer}
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
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
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: '4px solid #d08f60'
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
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    borderLeft: '4px solid #14b8a6'
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
