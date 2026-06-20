import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import ArrangementTimelineWidget from '../components/ArrangementTimelineWidget';
import ResearchSummaryRenderer from '../components/ResearchSummaryRenderer';
import ShareLinkButton from '../components/ShareLinkButton';
import ExportPdfButton from '../components/ExportPdfButton';
import BookmarkAnalysisTags from '../components/BookmarkAnalysisTags';
import { useBookmarkAnalysisStream } from '../hooks/useBookmarkAnalysisStream.js';
import useDeepLinkParams from '../hooks/useDeepLinkParams';
import { useTechniques } from '../hooks/useTechniques.js';
import { recordLinkOpen } from '../utils/shareAnalytics';
import { normalizeResponse, isTaggedResponse, formatTimestampLabel } from '../utils/responseShape';
import { useScrollytellingSeek, useMostVisible } from '../utils/scrollytelling';
import AuditTimeline from '../components/audit/AuditTimeline';


const AuditDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const backend = useBackend();
  const { timestampSeconds: deepLinkTs, bookmarkId: deepLinkBookmarkId } = useDeepLinkParams();
  const { addFromSentence } = useTechniques();

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

  // Phase 2.3 v2: live bookmark-analysis updates via SSE. The hook keeps
  // a `snapshots` map keyed by bookmarkId; we merge those into the audit's
  // bookmarks below so the BookmarkAnalysisTags card re-renders as the
  // server-side pipeline transitions through pending → running → success.
  const { snapshots: liveBookmarkAnalysis, status: streamStatus } =
    useBookmarkAnalysisStream(id);

  const [scrollytellingEnabled, setScrollytellingEnabled] = useState(false);
  const answerCardRefs = useRef(new Map());

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

  // Phase 2.2: build scrollytelling items from responses that have a tagged
  // timestamp. Each answer card mounts with a ref; the hook observes them and
  // reports which is most visible. `useScrollytellingSeek` debounces a seek
  // to the active card's timestamp when scrollytelling is enabled.
  const scrollytellingItems = useMemo(() => {
    if (!audit?.responses) return [];
    const items = [];
    for (const [key, value] of Object.entries(audit.responses)) {
      const { text, timestampSeconds } = normalizeResponse(value);
      if (!Number.isFinite(timestampSeconds)) continue;
      if (!text || text.trim().length === 0) continue;
      items.push({
        id: `answer-${key}`,
        key,
        timestampSeconds,
        ref: {
          get current() { return answerCardRefs.current.get(key) || null; },
          dataset: { id: `answer-${key}` },
        },
      });
    }
    items.sort((a, b) => a.timestampSeconds - b.timestampSeconds);
    return items;
  }, [audit?.responses]);

  useScrollytellingSeek(scrollytellingItems, {
    seek: seekTo,
    currentTime,
    enabled: scrollytellingEnabled,
    debounceMs: 350,
    minJumpSeconds: 6,
  });

  const { activeId: activeAnswerId } = useMostVisible(scrollytellingItems);

  const arrangementSections = useMemo(() => {
    const raw = audit?.responses?.['arrangement-timeline'];
    if (!raw) return [];
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
    } catch (e) {
      return [];
    }
  }, [audit?.responses]);

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
            {scrollytellingItems.length > 0 && (
              <button
                onClick={() => setScrollytellingEnabled((v) => !v)}
                className={scrollytellingEnabled ? 'primary' : 'secondary'}
                title={scrollytellingEnabled ? 'Scrollytelling on — scrolling scrubs audio' : 'Turn on scrollytelling — scrolling scrubs audio'}
                style={{
                  fontFamily: 'Roboto Mono',
                  fontSize: '11px',
                  padding: '8px 12px',
                  background: scrollytellingEnabled ? '#ff6600' : undefined,
                  color: scrollytellingEnabled ? '#0c0c0e' : undefined,
                  border: scrollytellingEnabled ? 'none' : undefined,
                  fontWeight: scrollytellingEnabled ? 'bold' : undefined,
                }}
              >
                {scrollytellingEnabled ? '⏵ Scrollytelling' : '⏸ Scrollytelling'}
              </button>
            )}
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

        {/* 🧬 SIGNAL AUDIO ANALYSIS TIMELINE (READ-ONLY) */}
        {song && song.audioAnalysisStatus === 'success' && song.audioAnalysis && (
          <div className="panel" style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '2px', padding: '20px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '12px' }} onClick={() => setShowAnalysis(!showAnalysis)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ff6600' }}><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                <h3 style={{ margin: 0, fontFamily: 'Roboto Mono', fontSize: '13px', color: '#ff6600' }}>
                  SONG STRUCTURAL TIMELINE // SCHEMA VISUALIZER
                </h3>
              </div>
              <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '10px', fontFamily: 'Roboto Mono' }}>
                {showAnalysis ? 'COLLAPSE' : 'EXPAND'}
              </button>
            </div>

            {showAnalysis && (
              <AuditTimeline
                song={song}
                currentTime={currentTime}
                duration={duration || song.durationSeconds || 0}
                onSeek={seekTo}
                markers={audit.bookmarks || []}
                arrangementSections={arrangementSections}
                readOnly={true}
                defaultShowEnergy={true}
                defaultShowBeatGrid={true}
                defaultShowKeyRegions={true}
              />
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
            <ResearchSummaryRenderer
              summary={song.researchSummary.summary}
              song={song}
              onPromote={addFromSentence}
            />

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
                  const hasAnswers = questions.some((_, idx) => audit.responses[`lens-${lens}-${idx}`]);
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
                            const key = `lens-${lens}-${idx}`;
                            const answer = audit.responses[key];
                            if (!answer) return null;
                            const { text, timestampSeconds } = normalizeResponse(answer);
                            const tagged = Number.isFinite(timestampSeconds);
                            return (
                              <div
                                key={idx}
                                style={{
                                  marginBottom: '15px',
                                  backgroundColor: '#0c0c0e',
                                  padding: '15px',
                                  borderRadius: '2px',
                                  border: '1px solid rgba(255,255,255,0.04)',
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Roboto Mono' }}>
                                    Q: {question}
                                  </div>
                                  {tagged && (
                                    <button
                                      type="button"
                                      onClick={() => seekTo(timestampSeconds)}
                                      title={`Seek to ${formatTimestampLabel(timestampSeconds)}`}
                                      style={{
                                        fontFamily: 'Roboto Mono',
                                        fontSize: '10px',
                                        color: '#0c0c0e',
                                        background: '#ff6600',
                                        border: 'none',
                                        padding: '2px 8px',
                                        borderRadius: '2px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      ⏱ {formatTimestampLabel(timestampSeconds)}
                                    </button>
                                  )}
                                </div>
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                  {text}
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
                  const { text, timestampSeconds } = normalizeResponse(value);
                  const tagged = Number.isFinite(timestampSeconds);
                  const isActive = tagged && activeAnswerId === `answer-${key}`;
                  return (
                    <div
                      key={key}
                      ref={(el) => {
                        if (el) answerCardRefs.current.set(key, el);
                        else answerCardRefs.current.delete(key);
                      }}
                      data-scrolly-id={`answer-${key}`}
                      onClick={() => tagged && seekTo(timestampSeconds)}
                      style={{
                        marginBottom: '20px',
                        backgroundColor: '#0c0c0e',
                        padding: '15px',
                        borderRadius: '2px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        borderLeft: `4px solid ${isActive ? '#00e5ff' : '#ff6600'}`,
                        cursor: tagged ? 'pointer' : 'default',
                        boxShadow: isActive
                          ? '0 0 0 1px rgba(0,229,255,0.4), 0 0 12px rgba(0,229,255,0.18)'
                          : 'none',
                        transition: 'box-shadow 0.2s, border-color 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '8px' }}>
                        <strong style={{ color: '#ff6600', textTransform: 'uppercase', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                          {lens} Lens // {qRef?.toUpperCase() || ''}
                        </strong>
                        {tagged && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); seekTo(timestampSeconds); }}
                            title={`Seek to ${formatTimestampLabel(timestampSeconds)}`}
                            style={{
                              fontFamily: 'Roboto Mono',
                              fontSize: '10px',
                              color: '#0c0c0e',
                              background: isActive ? '#00e5ff' : '#ff6600',
                              border: 'none',
                              padding: '2px 8px',
                              borderRadius: '2px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ⏱ {formatTimestampLabel(timestampSeconds)}
                          </button>
                        )}
                      </div>
                      <p style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap', color: 'rgba(255, 255, 255, 0.85)', fontSize: '12px', margin: 0 }}>
                        {text}
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
                    {normalizeResponse(audit.responses.recreation).text}
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
                    <BookmarkAnalysisTags
                      auditId={audit._id}
                      bookmarkId={bmId}
                      analysis={liveBookmarkAnalysis[bmId] || bookmark.analysis}
                    />
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
