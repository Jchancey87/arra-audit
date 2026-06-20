import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import ArrangementTimelineWidget from '../components/ArrangementTimelineWidget';
import ResearchSummaryRenderer from '../components/ResearchSummaryRenderer';
import ShareLinkButton from '../components/ShareLinkButton';
import ExportPdfButton from '../components/ExportPdfButton';
import useDeepLinkParams from '../hooks/useDeepLinkParams';
import { recordLinkOpen } from '../utils/shareAnalytics';


const AuditDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const backend = useBackend();
  const { timestampSeconds: deepLinkTs, bookmarkId: deepLinkBookmarkId } = useDeepLinkParams();

  const {
    loadSong,
    setActiveAudit,
    seekTo,
    isPlaying,
    currentTime,
    duration,
    highlightBookmark,
    highlightBookmarkId,
    waitForPlayerReady,
  } = useAudio();

  const deepLinkAppliedRef = useRef(false);

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

  // Apply deep-link params once data is loaded: seek to ?t= and pulse ?bookmark=
  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (!audit || !audit.bookmarks) return;
    if (deepLinkTs === null && deepLinkBookmarkId === null) return;
    deepLinkAppliedRef.current = true;

    // Record the click-through so we can build share insights later.
    recordLinkOpen({ auditId: audit._id, bookmarkId: deepLinkBookmarkId, source: 'deep-link' });

    let ts = deepLinkTs;
    if (deepLinkBookmarkId) {
      const bm = audit.bookmarks.find((b) => (b._id || b.id) === deepLinkBookmarkId);
      if (bm) {
        const bmTs = bm.timestampSeconds || bm.timestamp;
        if (bmTs !== undefined && bmTs !== null) ts = bmTs;
        highlightBookmark(deepLinkBookmarkId);
      }
    }
    if (ts !== null && Number.isFinite(ts)) {
      // Wait for the YouTube IFrame to be ready, with a safety timeout. Drops
      // the 350ms heuristic — slow networks and mobile can take longer to
      // mount the player, and on dev machines it can be ready immediately.
      let cancelled = false;
      waitForPlayerReady({ timeoutMs: 4000 })
        .then(() => {
          if (!cancelled) seekTo(ts);
        })
        .catch(() => { /* swallow — best effort */ });
      return () => { cancelled = true; };
    }
    return undefined;
  }, [audit, deepLinkTs, deepLinkBookmarkId, seekTo, highlightBookmark, waitForPlayerReady]);

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
      <style>{`
        @keyframes pulse-led {
          0%, 100% { opacity: 0.35; transform: scale(0.92); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes vu-level-bounce {
          0% { opacity: 0.85; filter: brightness(0.95); }
          100% { opacity: 1; filter: brightness(1.2); }
        }
      `}</style>
      <div className="panel" style={{ background: 'var(--bg-panel)', borderBottom: '2px solid #ff6600' }}>
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
                background: '#ff6600',
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
            {audit.status === 'completed' && (
              <ExportPdfButton audit={audit} song={song} />
            )}
            <button
              onClick={() => navigate(`/compare/${song._id || song.id}`)}
              className="secondary"
              title="A/B compare this song against your DAW sketch"
            >
              A/B Compare
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
          <div className="panel" style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '2px', padding: '20px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowAnalysis(!showAnalysis)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ff6600' }}><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                <h3 style={{ margin: 0, fontFamily: 'Roboto Mono', fontSize: '13px', color: '#ff6600' }}>
                  ANALYSIS MATRIX // KEY TRACK PROPERTIES
                </h3>
              </div>
              <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '10px', fontFamily: 'Roboto Mono' }}>
                {showAnalysis ? 'COLLAPSE' : 'EXPAND'}
              </button>
            </div>

            {showAnalysis && (
              <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '15px' }}>
                {/* Active Values Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  background: '#2a2a2a',
                  gap: '1px',
                  border: '1px solid #2a2a2a',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginBottom: '20px'
                }}>
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
                    const badgeText = isHigh ? 'CONFIDENT' : isMed ? 'PROBABLE' : 'REVIEW';

                    // Extract parameters for visualizers
                    const bpm = parseFloat(song.audioOverrides?.tempo_bpm || song.audioAnalysis?.tempo_bpm || 120);
                    const detectedKey = (song.audioOverrides?.key || song.audioAnalysis?.key || '').trim();
                    const meter = song.audioOverrides?.estimated_meter || song.audioAnalysis?.estimated_meter || '4/4';
                    const beatsPerMeasure = parseInt(meter.split('/')[0]) || 4;
                    const currentBeat = Math.floor(currentTime * (bpm / 60)) % beatsPerMeasure;
                    const lufsVal = parseFloat(song.audioAnalysis?.loudness_integrated) || -14;
                    const lufsPercent = Math.max(5, Math.min(100, ((lufsVal - (-24)) / (-4 - (-24))) * 100));

                    return (
                      <div key={idx} style={{ background: '#18181c', display: 'flex', flexDirection: 'column', padding: '12px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '9px', fontFamily: 'Inter', fontWeight: '700', color: '#8a8a8a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {item.label}
                          </span>
                          {!item.isReadOnly && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ fontSize: '8px', fontFamily: 'Roboto Mono', color: badgeColor, display: 'flex', alignItems: 'center', gap: '3px', lineHeight: 1 }}>
                                <span style={{ 
                                  width: '4.5px', 
                                  height: '4.5px', 
                                  borderRadius: '50%', 
                                  background: badgeColor,
                                  boxShadow: `0 0 4px ${badgeColor}`,
                                  display: 'inline-block'
                                }} />
                                {badgeText} ({Math.round(valNum * 100)}%)
                              </span>
                              <div style={{ width: '45px', height: '2px', background: '#282828', borderRadius: '1px', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.round(valNum * 100)}%`, height: '100%', background: badgeColor }} />
                              </div>
                            </div>
                          )}
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'Roboto Mono', color: '#ffffff', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                            {item.value}
                            {item.isOverridden && (
                              <span style={{ fontSize: '8px', color: '#ff6600', fontWeight: 'normal' }}>(override)</span>
                            )}
                          </div>

                          {/* Micro Visualizers */}
                          {item.label.includes('TEMPO') && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                              <span className={isPlaying ? 'tempo-pulse' : ''} style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#ff6600',
                                boxShadow: '0 0 6px #ff6600',
                                display: 'inline-block',
                                animation: isPlaying ? `pulse-led ${60 / bpm}s ease-in-out infinite` : 'none',
                                opacity: isPlaying ? 1 : 0.4
                              }} />
                              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter' }}>
                                {isPlaying ? 'pulsing grid sync' : 'play to pulse'}
                              </span>
                            </div>
                          )}

                          {item.label.includes('TONAL KEY') && (
                            <div style={{ display: 'flex', gap: '2px', marginTop: '8px', flexWrap: 'wrap' }}>
                              {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => {
                                const isActive = detectedKey.toLowerCase() === k.toLowerCase() || detectedKey.toLowerCase().startsWith(k.toLowerCase());
                                return (
                                  <span
                                    key={k}
                                    style={{
                                      fontSize: '7px',
                                      fontFamily: 'Roboto Mono',
                                      padding: '1px 3px',
                                      borderRadius: '1px',
                                      background: isActive ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.02)',
                                      color: isActive ? '#00e5ff' : 'rgba(255,255,255,0.25)',
                                      border: isActive ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid transparent',
                                      fontWeight: isActive ? 'bold' : 'normal'
                                    }}
                                  >
                                    {k}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {item.label.includes('METER') && (
                            <div style={{ display: 'flex', gap: '3px', marginTop: '10px', alignItems: 'center' }}>
                              {Array.from({ length: beatsPerMeasure }).map((_, bIdx) => {
                                const isCurrent = isPlaying && currentBeat === bIdx;
                                return (
                                  <div
                                    key={bIdx}
                                    style={{
                                      width: '10px',
                                      height: '6px',
                                      borderRadius: '1px',
                                      background: isCurrent ? '#4ade80' : 'rgba(255,255,255,0.06)',
                                      border: `1px solid ${isCurrent ? '#4ade80' : 'rgba(255,255,255,0.08)'}`,
                                      boxShadow: isCurrent ? '0 0 6px #4ade80' : 'none',
                                      transition: 'all 0.08s ease'
                                    }}
                                  />
                                );
                              })}
                              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginLeft: '3px', fontFamily: 'Roboto Mono' }}>
                                {isPlaying ? `B${currentBeat + 1}` : 'stop'}
                              </span>
                            </div>
                          )}

                          {item.label.includes('LOUDNESS') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '10px', width: '100%' }}>
                              <div style={{ height: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '1px', position: 'relative', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div
                                  style={{
                                    height: '100%',
                                    width: `${lufsPercent}%`,
                                    background: 'linear-gradient(90deg, #22c55e 60%, #fbbf24 85%, #f87171 100%)',
                                    boxShadow: isPlaying ? '0 0 4px rgba(34,197,94,0.4)' : 'none',
                                    transition: 'width 0.3s ease',
                                    animation: isPlaying ? 'vu-level-bounce 0.15s ease infinite alternate' : 'none'
                                  }}
                                />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '7px', color: 'rgba(255,255,255,0.25)', fontFamily: 'Roboto Mono' }}>
                                <span>-24 LUFS</span>
                                <span>-4 LUFS</span>
                                </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Timeline lanes */}
                {duration > 0 && (
                  <div style={{ background: 'var(--bg-workspace)', padding: '15px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.45)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        REAL-TIME TEMPORAL LANES
                      </span>
                      <span>{formatTimestamp(currentTime)} / {formatTimestamp(duration)}</span>
                    </div>
                    
                    {/* Interactive Playhead Lane (Step Sequencer Grid) */}
                    <div 
                      style={{ 
                        position: 'relative', 
                        height: '34px', 
                        background: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 20px), #0e0e11', 
                        borderBottom: '1px solid rgba(255,255,255,0.06)', 
                        borderTop: '1px solid rgba(255,255,255,0.06)', 
                        cursor: 'pointer',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const pct = (e.clientX - rect.left) / rect.width;
                        seekTo(pct * duration);
                      }}
                    >
                      {/* Modulated Step Sequencer Ticks */}
                      {(song.audioAnalysis.beat_times || []).map((t, i) => {
                        const isDownbeat = (song.audioAnalysis.downbeat_times || []).some(db => Math.abs(db - t) < 0.08);
                        const isMidBeat = !isDownbeat && (i % 2 === 0);
                        const height = isDownbeat ? '24px' : isMidBeat ? '15px' : '9px';
                        const top = isDownbeat ? '5px' : isMidBeat ? '9px' : '12px';
                        const background = isDownbeat 
                          ? '#ff6600' 
                          : isMidBeat 
                            ? '#00e5ff' 
                            : 'rgba(255, 255, 255, 0.15)';
                        const glow = isDownbeat 
                          ? '0 0 6px rgba(255, 102, 0, 0.6)' 
                          : isMidBeat 
                            ? '0 0 4px rgba(0, 229, 255, 0.4)' 
                            : 'none';

                        return (
                          <div
                            key={i}
                            style={{
                              position: 'absolute',
                              left: `${(t / duration) * 100}%`,
                              top,
                              width: isDownbeat ? '2px' : '1px',
                              height,
                              background,
                              boxShadow: glow,
                              borderRadius: '1px'
                            }}
                          />
                        );
                      })}

                      {/* Playhead */}
                      <div
                        style={{
                          position: 'absolute',
                          left: `${(currentTime / duration) * 100}%`,
                          top: 0,
                          width: '1.5px',
                          height: '100%',
                          background: '#00e5ff',
                          boxShadow: '0 0 6px #00e5ff',
                          zIndex: 10
                        }}
                      >
                        <div style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: '-5px', 
                          width: '11px', 
                          height: '8px', 
                          background: '#00e5ff',
                          clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)'
                        }} />
                      </div>
                    </div>

                    {/* Tonal lane (Sections) */}
                    <div style={{ position: 'relative', height: '24px', background: 'var(--bg-workspace)', marginTop: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
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
                              background: Math.abs(currentTime - (duration / arr.length) * (i + 0.5)) < (duration / arr.length / 2) && isPlaying ? 'rgba(255,102,0,0.05)' : 'transparent'
                            }}
                          >
                            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              {sect.section}
                            </span>
                            <span style={{ fontSize: '9px', fontWeight: 'bold', fontFamily: 'Roboto Mono', color: '#ff6600' }}>
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
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff6600', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em', marginBottom: '12px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
              Song Research Intelligence
            </h2>
            <ResearchSummaryRenderer summary={song.researchSummary.summary} />

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
                        borderColor: 'rgba(255, 102, 0, 0.25)',
                        color: '#ff6600',
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
            <h2 style={{ color: '#ff6600', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em' }}>
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
                      <h3 style={{ textTransform: 'capitalize', color: '#ff6600', fontSize: '12px', fontFamily: 'Roboto Mono', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '12px' }}>
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
                              background: 'rgba(255, 102, 0, 0.02)',
                              border: '1px dashed rgba(255, 102, 0, 0.15)',
                              borderRadius: '2px',
                            }}>
                              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontFamily: 'Roboto Mono', color: '#ff6600', marginBottom: '8px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                                CONCRETE EXERCISES (TAILORED)
                              </strong>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {lensData.exercises.map((ex, idx) => (
                                  <div
                                    key={idx}
                                    style={{
                                      padding: '24px',
                                      borderLeft: '2px solid #ff6600',
                                      borderRadius: '1px',
                                      backgroundColor: '#070709',
                                    }}
                                  >
                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ex.name}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                                      {(ex.description || '').split('\n').filter(line => line.trim()).map((para, pIdx) => {
                                        const trimmed = para.trim();
                                        const isBullet = trimmed.startsWith('-') || trimmed.startsWith('*');
                                        const cleanText = isBullet ? trimmed.substring(1).trim() : para;
                                        if (isBullet) {
                                          return (
                                            <ul
                                              key={pIdx}
                                              style={{
                                                listStyleType: 'disc',
                                                listStylePosition: 'inside',
                                                fontSize: '14px',
                                                lineHeight: '1.75',
                                                color: '#d4d4d8',
                                                width: '100%',
                                                paddingLeft: '4px',
                                                margin: 0,
                                              }}
                                            >
                                              <li>{cleanText}</li>
                                            </ul>
                                          );
                                        }
                                        return (
                                          <p
                                            key={pIdx}
                                            style={{
                                              fontSize: '14px',
                                              lineHeight: '1.75',
                                              color: '#d4d4d8',
                                              width: '100%',
                                              margin: 0,
                                            }}
                                          >
                                            {para}
                                          </p>
                                        );
                                      })}
                                    </div>
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
                        borderLeft: '4px solid #ff6600'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <strong style={{ color: '#ff6600', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
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
                  <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#14b8a6', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                    Recreate / Transcription Lens
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
            <h2 style={{ color: '#ff6600', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em' }}>
              Session Bookmarks ({audit.bookmarks.length})
            </h2>
            <div style={{ marginTop: '15px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
              {audit.bookmarks.map((bookmark, idx) => {
                const bmId = bookmark._id || bookmark.id;
                const isHighlighted = bmId && bmId === highlightBookmarkId;
                const bmTs = bookmark.timestampSeconds || bookmark.timestamp;
                return (
                  <div
                    key={bmId || idx}
                    style={{
                      background: '#0c0c0e',
                      padding: '15px',
                      borderRadius: '2px',
                      border: isHighlighted ? '1px solid #ff6600' : '1px solid rgba(255,255,255,0.06)',
                      boxShadow: isHighlighted ? '0 0 0 1px rgba(255,102,0,0.35), 0 0 12px rgba(255,102,0,0.25)' : 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px', gap: '6px' }}>
                      <strong
                        onClick={() => seekTo(bmTs)}
                        style={{
                          color: '#ff6600',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontFamily: 'Roboto Mono',
                          fontSize: '11px'
                        }}
                        title="Click to seek in player"
                      >
                        {formatTimestamp(bmTs)}
                      </strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {bookmark.lens && <span className="badge" style={{ fontSize: '9px', textTransform: 'uppercase' }}>{bookmark.lens}</span>}
                        <ShareLinkButton
                          auditId={audit._id}
                          timestampSeconds={bmTs}
                          bookmarkId={bmId}
                          label="Share"
                          compact
                          source="bookmark-card"
                        />
                      </div>
                    </div>
                    {bookmark.label && <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '5px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.9)' }}>{bookmark.label}</div>}
                    {bookmark.note && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.65)', margin: 0 }}>{bookmark.note}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Techniques */}
        {audit.techniques && audit.techniques.length > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ color: '#ff6600', fontSize: '13px', fontFamily: 'Roboto Mono', letterSpacing: '0.05em', margin: 0 }}>
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
                      <div style={{ fontWeight: 'bold', fontSize: '12px', color: '#ff6600', fontFamily: 'Roboto Mono' }}>
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
                          color: '#ff6600', 
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
