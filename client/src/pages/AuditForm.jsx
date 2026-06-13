import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import ArrangementTimelineWidget from '../components/ArrangementTimelineWidget';

// ── Autosave hook ────────────────────────────────────────────────────────────
function useAutosave(auditId, data, backend, delay = 3000) {
  const [saveStatus, setSaveStatus] = useState('saved');
  const timerRef = useRef(null);
  const isDirtyRef = useRef(false);

  const save = useCallback(async () => {
    if (!auditId || !isDirtyRef.current) return;
    setSaveStatus('saving');
    try {
      await backend.updateAudit(auditId, data);
      setSaveStatus('saved');
      isDirtyRef.current = false;
    } catch {
      setSaveStatus('error');
    }
  }, [auditId, data, backend]);

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setSaveStatus('dirty');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, delay);
  }, [save, delay]);

  useEffect(() => {
    const handler = (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { saveStatus, markDirty, saveNow: save };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const s = Math.floor(seconds ?? 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const SAVE_LABEL = {
  saved:  '✓ Synchronized',
  saving: 'Saving signal...',
  dirty:  '● Dirty buffers',
  error:  '✗ Transmission error',
};
const SAVE_COLOR = {
  saved:  '#4ade80',
  saving: 'rgba(255, 255, 255, 0.45)',
  dirty:  '#ff6600',
  error:  '#f87171',
};

// ── AuditForm ────────────────────────────────────────────────────────────────
const AuditForm = () => {
  const { auditId } = useParams();
  const navigate = useNavigate();
  const backend = useBackend();

  const {
    loadSong,
    setActiveAudit,
    bookmarks: globalBookmarks,
    seekTo,
    isPlaying,
    currentTime,
    duration,
  } = useAudio();

  const [audit, setAudit]           = useState(null);
  const [song, setSong]             = useState(null);
  const [responses, setResponses]   = useState({});
  const [techniques, setTechniques] = useState([]);
  const [currentTechnique, setCurrentTechnique] = useState({ techniqueName: '', description: '', lens: 'rhythm' });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [showResearch, setShowResearch] = useState(false);

  // Audio Analysis pipeline state
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showOverrideControls, setShowOverrideControls] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('Initiating extraction pipeline...');
  const [overrideBpm, setOverrideBpm] = useState('');
  const [overrideKey, setOverrideKey] = useState('');
  const [overrideScale, setOverrideScale] = useState('');
  const [overrideMeter, setOverrideMeter] = useState('');
  const [tapTimes, setTapTimes] = useState([]);

  const { saveStatus, markDirty, saveNow } = useAutosave(auditId, { responses }, backend);

  useEffect(() => {
    if (song) {
      setOverrideBpm(song.audioOverrides?.tempo_bpm || song.audioAnalysis?.tempo_bpm || '');
      setOverrideKey(song.audioOverrides?.key || song.audioAnalysis?.key || '');
      setOverrideScale(song.audioOverrides?.scale || song.audioAnalysis?.scale || '');
      setOverrideMeter(song.audioOverrides?.estimated_meter || song.audioAnalysis?.estimated_meter || '');
    }
  }, [song]);

  // Polling for audio analysis status
  useEffect(() => {
    let intervalId;
    if (song && song.audioAnalysisStatus === 'pending') {
      intervalId = setInterval(async () => {
        try {
          const updatedSong = await backend.getSong(song._id);
          if (updatedSong.audioAnalysisStatus !== 'pending') {
            setSong(updatedSong);
            clearInterval(intervalId);
          }
        } catch (err) {
          console.warn('Polling error:', err);
        }
      }, 4000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [song?.audioAnalysisStatus, song?._id]);

  // Simulated progress state driver for analysis
  useEffect(() => {
    let timer;
    if (song && song.audioAnalysisStatus === 'pending') {
      setAnalysisProgress(0);
      setAnalysisStage('Connecting to signal source...');
      
      const stages = [
        { threshold: 15, text: 'Downloading audio source from stream...' },
        { threshold: 40, text: 'Running transient beat & downbeat tracking...' },
        { threshold: 65, text: 'Calculating keys, scales, and chords...' },
        { threshold: 85, text: 'Running CLAP semantic vibe analysis...' },
        { threshold: 98, text: 'Assembling override vectors...' },
      ];

      timer = setInterval(() => {
        setAnalysisProgress((prev) => {
          const next = Math.min(prev + Math.floor(Math.random() * 4) + 1, 99);
          const currentStage = stages.find(s => next <= s.threshold);
          if (currentStage) {
            setAnalysisStage(currentStage.text);
          } else {
            setAnalysisStage('Finalizing background database sync...');
          }
          return next;
        });
      }, 400);
    } else {
      setAnalysisProgress(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [song?.audioAnalysisStatus]);

  const handleTapTempo = () => {
    const now = Date.now();
    const newTaps = [...tapTimes.filter(t => now - t < 3000), now];
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgIntervalMs);
      setOverrideBpm(bpm);
    }
  };

  const handleSaveOverrides = async () => {
    try {
      const updated = await backend.saveAudioOverrides(song._id, {
        tempo_bpm: overrideBpm ? parseFloat(overrideBpm) : null,
        key: overrideKey || null,
        scale: overrideScale || null,
        estimated_meter: overrideMeter || null,
      });
      setSong(updated.song || updated);
      flash('✓ Audio overrides updated!');
      setShowOverrideControls(false);
    } catch (err) {
      setError('Failed to save audio overrides');
    }
  };

  // ── Load audit + song on mount ───────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const auditData = await backend.getAudit(auditId);
        if (!auditData) { setError('Audit not found'); return; }
        setAudit(auditData);
        setResponses(auditData.responses || {});
        // Techniques shown in-form are a display reference only;
        // real storage is TechniqueEntry collection (see addTechnique below)
        setTechniques(auditData.techniques || []);

        const songData = await backend.getSong(auditData.songId?._id ?? auditData.songId);
        setSong(songData);
        loadSong(songData);
      } catch (err) {
        setError('Failed to load audit');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auditId]);

  useEffect(() => {
    if (audit) setActiveAudit(audit);
    return () => setActiveAudit(null);
  }, [audit, setActiveAudit]);

  // ── Responses ────────────────────────────────────────────────────────────
  const handleResponseChange = (key, value) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
    markDirty();
  };

  // ── Techniques — Issue 3 fix ─────────────────────────────────────────────
  // Immediately persist to TechniqueEntry collection via POST /api/techniques
  // so the Technique Notebook page shows them right away.
  const addTechnique = async () => {
    if (!currentTechnique.description.trim()) return;
    try {
      const saved = await backend.addTechnique({
        auditId,
        songId: audit.songId?._id || audit.songId,
        artist: song?.artistName || song?.artist || '',
        techniqueName: currentTechnique.techniqueName || '',
        description: currentTechnique.description,
        lens: currentTechnique.lens,
      });
      // Add the saved entry (with server _id) to the local display list
      setTechniques((prev) => [...prev, saved]);
      setCurrentTechnique({ techniqueName: '', description: '', lens: 'rhythm' });
      flash('✓ Technique saved to notebook!');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save technique');
    }
  };

  const removeTechnique = async (id) => {
    try {
      await backend.deleteTechnique(id);
      setTechniques((prev) => prev.filter((t) => (t._id || t._tempId) !== id));
    } catch (err) {
      setError('Failed to remove technique');
    }
  };

  // ── Save (manual / final) ─────────────────────────────────────────────────
  const saveAudit = async () => {
    try {
      await backend.updateAudit(auditId, {
        responses,
        status: 'completed',
      });
      flash('Audit saved!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save audit');
    }
  };

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  };

  // ── Guided Step Actions ───────────────────────────────────────────────────
  const handleAdvanceStep = async () => {
    try {
      const updated = await backend.advanceStep(auditId);
      setAudit(updated);
      flash('Step completed!');
    } catch (err) {
      setError(err.message || 'Failed to advance step');
    }
  };

  const handleGoBackStep = async () => {
    try {
      const updated = await backend.goBackStep(auditId);
      setAudit(updated);
    } catch (err) {
      setError(err.message || 'Failed to go back');
    }
  };

  const handleSkipStep = async () => {
    try {
      const updated = await backend.skipStep(auditId);
      setAudit(updated);
    } catch (err) {
      setError(err.message || 'Failed to skip step');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="loading">Loading audit workspace...</div>;
  if (error && !audit) return <div className="error">{error}</div>;
  if (!audit) return <div className="loading">Loading audit workspace...</div>;

  const template = audit.templateQuestions;
  const lenses = template?.lenses ? Object.keys(template.lenses) : audit.lensSelection || [];
  const isGuided = audit.workflowType === 'guided';
  const currentStep = isGuided ? audit.guidedSteps.find((s) => s.status === 'active') : null;
  const stepIndex = isGuided ? audit.guidedSteps.findIndex((s) => s.status === 'active') : -1;

  // Issue 4: research sources from the stored song researchSummary
  const researchSources = song?.researchSummary?.results || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="panel" style={{ background: 'var(--bg-panel)', borderBottom: '2px solid #ff6600' }}>

        {/* Save status indicator */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'Roboto Mono', fontWeight: 'bold', color: SAVE_COLOR[saveStatus] }}>
            {SAVE_LABEL[saveStatus]}
          </span>
        </div>

        <h1>{template?.title || `${song?.title} Arra Audit`}</h1>
        <p className="card-subtitle" style={{ margin: 0 }}>{song?.artistName || song?.artist}</p>

        {error   && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {/* Issue 4: Research Intelligence Panel */}
        {researchSources.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(255, 102, 0, 0.04)',
            border: '1px solid rgba(255, 102, 0, 0.15)',
            borderRadius: '2px',
          }}>
            <button
              onClick={() => setShowResearch(!showResearch)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '10px 15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                color: '#ff6600',
                fontFamily: 'Roboto Mono',
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
                RESEARCH INTELLIGENCE ({researchSources.length} SOURCES)
              </span>
              <span>{showResearch ? '▲ COLLAPSE' : '▼ EXPAND'}</span>
            </button>

            {showResearch && (
              <div style={{ padding: '0 15px 15px' }}>
                {researchSources.map((src, i) => (
                  <div
                    key={i}
                    style={{
                      marginBottom: '10px',
                      padding: '10px',
                      background: '#0c0c0e',
                      borderRadius: '2px',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'start', gap: '10px' }}>
                      <strong style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.3' }}>
                        {src.title}
                      </strong>
                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '10px', color: '#ff6600', whiteSpace: 'nowrap', fontFamily: 'Roboto Mono', flexShrink: 0 }}
                        >
                          Open ↗
                        </a>
                      )}
                    </div>
                    {src.content && (
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: '1.5' }}>
                        {src.content.substring(0, 250)}{src.content.length > 250 ? '…' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Guided Workflow Progress Tracker */}
        {isGuided && (
          <div style={{ marginBottom: '30px', marginTop: '20px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: '#0c0c0e',
              padding: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '2px',
              marginBottom: '15px'
            }}>
              {audit.guidedSteps.map((step, idx) => {
                const isActive = step.status === 'active';
                const isComplete = step.status === 'complete';
                let indicatorColor = 'rgba(255, 255, 255, 0.15)';
                let textColor = 'rgba(255, 255, 255, 0.4)';
                if (isActive) { indicatorColor = '#ff6600'; textColor = '#ff6600'; }
                else if (isComplete) { indicatorColor = '#4ade80'; textColor = 'rgba(255,255,255,0.7)'; }
                return (
                  <div
                    key={step.name}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      fontSize: '10px',
                      fontFamily: 'Roboto Mono',
                      fontWeight: 'bold',
                      color: textColor,
                      padding: '8px 4px',
                      margin: '0 4px',
                      background: isActive ? 'rgba(255, 102, 0, 0.08)' : 'transparent',
                      border: isActive ? '1px solid rgba(255, 102, 0, 0.3)' : '1px solid transparent',
                      borderRadius: '1px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: indicatorColor,
                      boxShadow: isActive ? '0 0 8px #ff6600' : isComplete ? '0 0 6px #4ade80' : 'none',
                    }} />
                    {idx + 1} // {step.name.toUpperCase()}
                  </div>
                );
              })}
            </div>

            {currentStep && (
              <div style={{
                background: 'var(--bg-panel)',
                padding: '15px',
                borderLeft: '3px solid #ff6600',
                borderRadius: '2px',
              }}>
                <h3 style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff6600' }}>
                  STEP 0{currentStep.stepNumber} // {currentStep.name.toUpperCase()}
                </h3>
                <p style={{ fontSize: '12px', lineHeight: '1.5', color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
                  {currentStep.instructions}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fallback template notice */}
        {audit.templateVersion?.startsWith('fallback') && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            color: '#f59e0b',
            padding: '12px',
            borderRadius: '2px',
            marginBottom: '20px',
            fontSize: '11px',
            fontFamily: 'Roboto Mono',
          }}>
            ℹ USING STANDARD REFERENCE TEMPLATE — CUSTOM SONIC SYNTHESIS UNAVAILABLE.
          </div>
        )}

        {/* 🧬 SIGNAL AUDIO ANALYSIS MATRIX */}
        {song && (
          <div className="panel" style={{ background: 'var(--bg-panel)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '2px', padding: '20px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowAnalysis(!showAnalysis)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#ff6600' }}><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                <h3 style={{ margin: 0, fontFamily: 'Roboto Mono', fontSize: '13px', color: '#ff6600' }}>
                  SIGNAL ANALYSIS MATRIX // {song.audioAnalysisStatus?.toUpperCase()}
                </h3>
              </div>
              <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '10px', fontFamily: 'Roboto Mono' }}>
                {showAnalysis ? 'COLLAPSE' : 'EXPAND'}
              </button>
            </div>

            {showAnalysis && (
              <div style={{ marginTop: '15px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '15px' }}>
                {song.audioAnalysisStatus === 'not_started' && (
                  <div style={{ textAlign: 'center', padding: '15px 0' }}>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '12px' }}>
                      Audio signal extraction has not been executed yet. Discover the BPM, key signature, meter, and temporal dynamics.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await backend.triggerSongAnalysis(song._id);
                          const updated = await backend.getSong(song._id);
                          setSong(updated);
                          flash(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg> Analysis pipeline triggered!</span>);
                        } catch (e) {
                          setError('Failed to trigger analysis pipeline');
                        }
                      }}
                      style={{ background: '#ff6600', color: '#0c0c0e', fontWeight: 'bold', border: 'none', padding: '8px 16px', cursor: 'pointer', fontFamily: 'Roboto Mono', fontSize: '11px' }}
                    >
                      EXECUTE AUDIO SIGNAL EXTRACTION
                    </button>
                  </div>
                )}

                {song.audioAnalysisStatus === 'pending' && (
                  <div style={{ textAlign: 'center', padding: '25px 0' }}>
                    <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '2.5px solid rgba(255, 102, 0, 0.2)', borderTopColor: '#ff6600', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
                    <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', fontFamily: 'Roboto Mono', color: '#ff6600', margin: '0 0 10px 0', letterSpacing: '0.05em' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
                      EXTRACTING HARMONIC & RHYTHMIC CODES ({analysisProgress}%)
                    </p>
                    
                    {/* Simulated Progress Bar */}
                    <div style={{ width: '80%', maxWidth: '380px', height: '5px', background: 'rgba(255, 255, 255, 0.08)', margin: '0 auto 12px auto', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <div style={{ width: `${analysisProgress}%`, height: '100%', background: 'linear-gradient(90deg, #ff6600, #e2a87c)', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)', borderRadius: '4px' }} />
                    </div>
                    
                    <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.45)', margin: 0, fontFamily: 'Roboto Mono', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {analysisStage}
                    </p>
                  </div>
                )}

                {song.audioAnalysisStatus === 'failed' && (
                  <div style={{ textAlign: 'center', padding: '15px 0' }}>
                    <p style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px' }}>
                      ⚠️ Signal extraction pipeline reported a compilation/execution failure.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await backend.triggerSongAnalysis(song._id);
                          const updated = await backend.getSong(song._id);
                          setSong(updated);
                          flash(<span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"></path></svg> Analysis pipeline retried!</span>);
                        } catch (e) {
                          setError('Failed to retry analysis pipeline');
                        }
                      }}
                      className="btn"
                      style={{ background: '#f87171', color: '#fff', border: 'none', padding: '6px 12px', cursor: 'pointer', fontFamily: 'Roboto Mono', fontSize: '10px' }}
                    >
                      RE-RUN PIPELINE
                    </button>
                  </div>
                )}

                {song.audioAnalysisStatus === 'success' && song.audioAnalysis && (
                  <div>
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
                        const badgeText = isHigh ? 'CONFIDENT' : isMed ? 'PROBABLE' : 'REVIEW NEEDED';

                        return (
                          <div key={idx} style={{ background: '#1e1e1e', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ background: '#2D2D2D', padding: '6px 12px', borderBottom: '1px solid #2a2a2a' }}>
                              <div style={{ fontSize: '9px', fontFamily: 'Roboto Mono', fontWeight: '600', color: '#8a8a8a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                                {item.label}
                              </div>
                            </div>
                            <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <div style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'Roboto Mono', color: '#ffffff', display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '4px' }}>
                                {item.value}
                                {item.isOverridden && (
                                  <span style={{ fontSize: '9px', color: '#ff6600', fontWeight: 'normal' }}>(override)</span>
                                )}
                              </div>
                              {!item.isReadOnly && (
                                <div style={{ fontSize: '9px', fontFamily: 'Roboto Mono', color: badgeColor, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ 
                                    width: '6px', 
                                    height: '6px', 
                                    borderRadius: '50%', 
                                    background: badgeColor,
                                    boxShadow: `0 0 4px ${badgeColor}`,
                                    display: 'inline-block'
                                  }} />
                                  {badgeText} ({Math.round(item.conf * 100)}%)
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Timeline lanes */}
                    {duration > 0 && (
                      <div style={{ background: 'var(--bg-workspace)', padding: '15px', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                        <div style={{ fontSize: '10px', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.45)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            REAL-TIME TEMPORAL LANES
                          </span>
                          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                        </div>
                        
                        {/* Interactive Playhead Lane */}
                        <div 
                          style={{ position: 'relative', height: '28px', background: 'var(--bg-workspace)', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer' }}
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
                                background: 'rgba(255, 102, 0, 0.4)'
                              }}
                            />
                          ))}

                          {/* Playhead */}
                          <div
                            style={{
                              position: 'absolute',
                              left: `${(currentTime / duration) * 100}%`,
                              top: 0,
                              width: '1px',
                              height: '100%',
                              background: '#00e5ff',
                              boxShadow: '0 0 4px #00e5ff',
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

                    {/* Show/Hide Override controls */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => setShowOverrideControls(!showOverrideControls)}
                        style={{ padding: '6px 12px', fontSize: '10px', fontFamily: 'Roboto Mono' }}
                      >
                        {showOverrideControls ? 'CLOSE OVERRIDE CONTROLS' : 'OPEN OVERRIDE CONTROLS'}
                      </button>
                    </div>

                    {showOverrideControls && (
                      <div style={{ marginTop: '20px', padding: '15px', background: '#0c0c0e', border: '1px dashed rgba(255, 102, 0, 0.25)', borderRadius: '2px' }}>
                        <h4 style={{ margin: '0 0 15px 0', fontSize: '11px', fontFamily: 'Roboto Mono', color: '#ff6600' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                          AUDIO METADATA MANUAL CORRECTIONS
                        </h4>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                          {/* BPM */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '10px', marginBottom: '4px' }}>BPM</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <input
                                type="number"
                                step="0.01"
                                value={overrideBpm}
                                onChange={(e) => setOverrideBpm(e.target.value)}
                                style={{ background: 'var(--bg-workspace)', borderColor: 'rgba(255,255,255,0.1)', padding: '4px 8px', fontSize: '12px' }}
                              />
                              <button
                                type="button"
                                onClick={handleTapTempo}
                                style={{
                                  background: 'var(--bg-panel)',
                                  color: '#ff6600',
                                  border: '1px solid rgba(255, 102, 0, 0.4)',
                                  padding: '4px 10px',
                                  fontSize: '9px',
                                  fontFamily: 'Roboto Mono',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}><path d="M12 20v-6M6 20V10M18 20V4"></path></svg>
                                TAP ({tapTimes.length})
                              </button>
                            </div>
                          </div>

                          {/* Key */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '10px', marginBottom: '4px' }}>KEY</label>
                            <select
                              value={overrideKey}
                              onChange={(e) => setOverrideKey(e.target.value)}
                              style={{ background: 'var(--bg-workspace)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)', padding: '4px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                            >
                              <option value="">-- Choose Key --</option>
                              {['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map(k => (
                                <option key={k} value={k}>{k}</option>
                              ))}
                            </select>
                          </div>

                          {/* Scale */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '10px', marginBottom: '4px' }}>SCALE</label>
                            <select
                              value={overrideScale}
                              onChange={(e) => setOverrideScale(e.target.value)}
                              style={{ background: 'var(--bg-workspace)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)', padding: '4px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                            >
                              <option value="">-- Choose Scale --</option>
                              <option value="major">Major</option>
                              <option value="minor">Minor</option>
                            </select>
                          </div>

                          {/* Meter */}
                          <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '10px', marginBottom: '4px' }}>ESTIMATED METER</label>
                            <select
                              value={overrideMeter}
                              onChange={(e) => setOverrideMeter(e.target.value)}
                              style={{ background: 'var(--bg-workspace)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)', padding: '4px 8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                            >
                              <option value="">-- Choose Meter --</option>
                              <option value="4/4">4/4</option>
                              <option value="3/4">3/4</option>
                              <option value="6/8">6/8</option>
                              <option value="5/4">5/4</option>
                            </select>
                          </div>
                        </div>

                        {/* Source Comparison Table */}
                        <div style={{ marginBottom: '15px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'var(--bg-workspace)', borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                                <th style={{ padding: '6px 8px' }}>DATA SOURCE</th>
                                <th style={{ padding: '6px 8px' }}>BPM</th>
                                <th style={{ padding: '6px 8px' }}>KEY SIGNATURE</th>
                                <th style={{ padding: '6px 8px' }}>METER</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>
                                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>Essentia core / madmom (Machine)</td>
                                <td style={{ padding: '6px 8px' }}>{song.audioAnalysis.tempo_bpm}</td>
                                <td style={{ padding: '6px 8px' }}>{song.audioAnalysis.key} {song.audioAnalysis.scale}</td>
                                <td style={{ padding: '6px 8px' }}>{song.audioAnalysis.estimated_meter}</td>
                              </tr>
                              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)' }}>
                                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>Original metadata imports</td>
                                <td style={{ padding: '6px 8px' }}>--</td>
                                <td style={{ padding: '6px 8px' }}>--</td>
                                <td style={{ padding: '6px 8px' }}>--</td>
                              </tr>
                              <tr style={{ color: '#ff6600', background: 'rgba(255, 102, 0, 0.02)' }}>
                                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>ACTIVE VALUE (OVERRIDES EFFECTIVE)</td>
                                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{song.audioOverrides?.tempo_bpm || song.audioAnalysis.tempo_bpm}</td>
                                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                                  {song.audioOverrides?.key || song.audioAnalysis.key} {song.audioOverrides?.scale || song.audioAnalysis.scale}
                                </td>
                                <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>{song.audioOverrides?.estimated_meter || song.audioAnalysis.estimated_meter}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={handleSaveOverrides}
                            style={{ background: '#ff6600', color: '#0c0c0e', fontWeight: 'bold', border: 'none', padding: '6px 12px', cursor: 'pointer', fontFamily: 'Roboto Mono', fontSize: '10px' }}
                          >
                            SAVE OVERRIDES
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOverrideBpm(song.audioAnalysis.tempo_bpm);
                              setOverrideKey(song.audioAnalysis.key);
                              setOverrideScale(song.audioAnalysis.scale);
                              setOverrideMeter(song.audioAnalysis.estimated_meter);
                            }}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '10px', fontFamily: 'Roboto Mono' }}
                          >
                            RESET TO MACHINE
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content area */}
        <div style={{ marginTop: '30px' }}>

          {/* STEP 1: LISTEN — Issue 5: clear play instruction */}
          {isGuided && currentStep?.name === 'Listen' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ color: '#ff6600', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                </svg>
              </div>
              <p style={{ fontSize: '14px', maxWidth: '500px', margin: '0 auto 20px', lineHeight: '1.6', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.7)' }}>
                FULL AUDIT FOCUS. EXPERIENCE THE SIGNAL SPECTRUM FROM START TO FINISH.
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,102,0,0.1)',
                border: '1px solid rgba(255,102,0,0.3)',
                padding: '10px 20px',
                borderRadius: '2px',
                fontSize: '12px',
                fontFamily: 'Roboto Mono',
                color: '#ff6600',
              }}>
                <span style={{ animation: 'pulse 1.5s infinite', display: 'inline-flex', alignItems: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </span>
                Press <strong>Play</strong> in the Tape Deck below or click the video monitor
              </div>
            </div>
          )}

          {/* STEP 2: SKETCH */}
          {isGuided && currentStep?.name === 'Sketch' && (
            <div className="form-group">
              <label>Raw Impressions & Sketches</label>
              <textarea
                placeholder="What sonics surprised you? What's the mood? Note any 'wow' moments. Use the bookmark button in the tape deck to mark timestamps."
                style={{ height: '200px' }}
                value={responses['sketch'] || ''}
                onChange={(e) => handleResponseChange('sketch', e.target.value)}
              />
            </div>
          )}

          {/* QUICK MODE or GUIDED STEP 3: TRANSLATE */}
          {(!isGuided || currentStep?.name === 'Translate') && (
            <>
              {template?.workflow_guidance && !isGuided && (
                <div style={{
                  background: 'rgba(255, 102, 0, 0.05)',
                  border: '1px solid rgba(255, 102, 0, 0.15)',
                  padding: '15px',
                  borderRadius: '2px',
                  marginBottom: '30px',
                }}>
                  <strong style={{ fontFamily: 'Roboto Mono', fontSize: '11px', color: '#ff6600' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}><path d="M9.663 17h4.673M12 3v1m0 16v1m-9-9h1m16 0h1M5.636 5.636l.707.707m11.314 11.314l.707.707M18.364 5.636l-.707.707M5.636 18.364l-.707-.707M12 7a5 5 0 0 0-5 5h10a5 5 0 0 0-5-5z"></path></svg>
                    WORKSPACE SIGNAL ANALYSIS MATRIX:
                  </strong>
                  <p style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>
                    {template.workflow_guidance}
                  </p>
                </div>
              )}

              {lenses.map((lens) => {
                const lensData = template?.lenses?.[lens];
                const questions = lensData?.questions || [];
                return (
                  <div key={lens} style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <h2 style={{ textTransform: 'uppercase', color: '#ff6600', marginBottom: '8px' }}>
                      {lens} Lens
                    </h2>
                    {lensData?.description && (
                      <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '20px', fontSize: '12px' }}>
                        {lensData.description}
                      </p>
                    )}
                    {lens === 'arrangement' ? (
                      <ArrangementTimelineWidget
                        responses={responses}
                        onChange={handleResponseChange}
                        song={song}
                        lensData={lensData}
                        saveNow={saveNow}
                      />
                    ) : (
                      <>
                        {/* Render Concrete Exercises if available */}
                        {lensData?.exercises && lensData.exercises.length > 0 && (
                          <div style={{
                            marginTop: '15px',
                            marginBottom: '25px',
                            padding: '15px',
                            background: 'rgba(255, 102, 0, 0.03)',
                            border: '1px dashed rgba(255, 102, 0, 0.25)',
                            borderRadius: '2px',
                          }}>
                            <h4 style={{
                              fontFamily: 'Roboto Mono',
                              fontSize: '11px',
                              color: '#ff6600',
                              marginTop: 0,
                              marginBottom: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                              CONCRETE EXERCISES (TAILORED)
                            </h4>
                            <div className="flex flex-col gap-6">
                              {lensData.exercises.map((ex, idx) => (
                                <div key={idx} className="p-6 border-l-2 border-[#ff6600] rounded-[1px] bg-[var(--bg-workspace)]">
                                  <strong style={{ fontSize: '13px', color: 'rgba(255,255,255,0.95)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {ex.name}
                                  </strong>
                                  <div className="space-y-3 mt-3">
                                    {(ex.description || '').split('\n').filter(line => line.trim()).map((para, pIdx) => {
                                      const trimmed = para.trim();
                                      const isBullet = trimmed.startsWith('-') || trimmed.startsWith('*');
                                      const cleanText = isBullet ? trimmed.substring(1).trim() : para;
                                      if (isBullet) {
                                        return (
                                          <ul key={pIdx} className="list-disc list-inside text-sm leading-7 text-zinc-300 w-full pl-1">
                                            <li>{cleanText}</li>
                                          </ul>
                                        );
                                      }
                                      return (
                                        <p key={pIdx} className="text-sm leading-7 text-zinc-300 w-full">
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
                          const key = `${lens}-q${idx}`;
                          return (
                            <div key={key} className="form-group" style={{ marginBottom: '20px' }}>
                              <label style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'rgba(255,255,255,0.8)' }}>
                                {question}
                              </label>
                              <textarea
                                id={`response-${key}`}
                                value={responses[key] || ''}
                                onChange={(e) => handleResponseChange(key, e.target.value)}
                                onBlur={saveNow}
                                placeholder="Type technical observations..."
                              />
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {/* STEP 4: RECREATE */}
          {isGuided && currentStep?.name === 'Recreate' && (
            <div>
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ color: '#ff6600', fontSize: '12px', fontFamily: 'Roboto Mono', marginBottom: '12px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                  TAILORED RECREATION EXERCISES
                </h3>
                {lenses.map((lens) => {
                  const lensData = template?.lenses?.[lens];
                  if (!lensData?.exercises || lensData.exercises.length === 0) return null;
                  return (
                    <div key={lens} style={{ marginBottom: '15px', padding: '12px', background: 'var(--bg-panel)', borderLeft: '3px solid #ff6600' }}>
                      <strong style={{ textTransform: 'uppercase', fontSize: '11px', color: '#ff6600', fontFamily: 'Roboto Mono', display: 'block', marginBottom: '8px' }}>
                        {lens} Lens
                      </strong>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {lensData.exercises.map((ex, idx) => (
                          <div key={idx} style={{ fontSize: '12px', padding: '8px', background: '#0c0c0e', borderRadius: '2px' }}>
                            <strong style={{ color: 'rgba(255,255,255,0.85)' }}>{ex.name}:</strong>
                            <span style={{ color: 'rgba(255,255,255,0.65)', marginLeft: '6px' }}>{ex.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-group">
                <label>Recreation Notes</label>
                <textarea
                  placeholder="If you were to transcribe or recreate a part of this, what would it be? Describe the tools, settings, or performance choices needed."
                  style={{ height: '200px' }}
                  value={responses['recreation'] || ''}
                  onChange={(e) => handleResponseChange('recreation', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* QUICK MODE or GUIDED STEP 5: LOG — Issue 3 fix */}
          {(!isGuided || currentStep?.name === 'Log') && (
            <div style={{ marginTop: '30px', paddingTop: '20px' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                Technique Log
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.45)', marginBottom: '20px' }}>
                Distill observations into portable techniques. Each entry saves immediately to your notebook.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label>Lens</label>
                  <select
                    id="technique-lens"
                    value={currentTechnique.lens}
                    onChange={(e) => setCurrentTechnique({ ...currentTechnique, lens: e.target.value })}
                  >
                    <option value="rhythm">Rhythm</option>
                    <option value="texture">Texture</option>
                    <option value="harmony">Harmony</option>
                    <option value="arrangement">Arrangement</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Technique Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ghost Note Pocket"
                    value={currentTechnique.techniqueName || ''}
                    onChange={(e) => setCurrentTechnique({ ...currentTechnique, techniqueName: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  id="technique-description"
                  value={currentTechnique.description}
                  onChange={(e) => setCurrentTechnique({ ...currentTechnique, description: e.target.value })}
                  placeholder="Explain why this technique works and how to use it."
                  style={{ height: '80px' }}
                />
              </div>

              <button id="add-technique-btn" onClick={addTechnique} className="secondary" style={{ width: '100%' }}>
                + Save to Notebook
              </button>

              {techniques.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Roboto Mono', marginBottom: '10px' }}>
                    Logged in this session ({techniques.length})
                  </h3>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {techniques.map((tech) => (
                      <div
                        key={tech._id || tech._tempId}
                        style={{
                          background: '#0c0c0e',
                          padding: '12px',
                          borderRadius: '2px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid rgba(255,255,255,0.06)',
                          gap: '10px',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <strong style={{ fontSize: '12px', color: '#ff6600', fontFamily: 'Roboto Mono' }}>
                            {tech.techniqueName || 'Untitled Technique'}
                          </strong>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                            {tech.description}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span className="badge" style={{ textTransform: 'uppercase' }}>{tech.lens}</span>
                          {tech._id && (
                            <button
                              onClick={() => removeTechnique(tech._id)}
                              className="danger"
                              style={{ padding: '3px 7px', fontSize: '10px' }}
                              title="Remove from notebook"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bookmarks */}
        <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 style={{ marginBottom: '12px' }}>🔖 Session Bookmarks ({globalBookmarks.length})</h3>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px 0' }}>
            {globalBookmarks.map((bm, idx) => (
              <div
                key={bm._id || idx}
                onClick={() => seekTo(bm.timestampSeconds || bm.timestamp)}
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid rgba(255, 102, 0, 0.3)',
                  color: '#ff6600',
                  padding: '5px 12px',
                  borderRadius: '2px',
                  fontSize: '11px',
                  fontFamily: 'Roboto Mono',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#ff6600'; e.currentTarget.style.color = '#0c0c0e'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#1c1c22'; e.currentTarget.style.color = '#ff6600'; }}
              >
                {formatTime(bm.timestampSeconds || bm.timestamp)} {bm.note ? `- ${bm.note}` : ''}
              </div>
            ))}
            {globalBookmarks.length === 0 && (
              <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '11px', fontFamily: 'Roboto Mono' }}>
                No bookmarks logged in this session.
              </span>
            )}
          </div>
        </div>

        {/* Navigation / Save Footer */}
        <div style={{ marginTop: '40px', display: 'flex', gap: '10px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          {isGuided ? (
            <>
              {stepIndex > 0 && (
                <button onClick={handleGoBackStep} className="secondary">← Back</button>
              )}
              {stepIndex < audit.guidedSteps.length - 1 ? (
                <>
                  <button onClick={handleSkipStep} className="secondary">Skip</button>
                  <button onClick={handleAdvanceStep} style={{ flex: 1 }}>Next Step →</button>
                </>
              ) : (
                <button onClick={saveAudit} style={{ flex: 1 }}>✓ Complete Audit</button>
              )}
            </>
          ) : (
            <>
              <button onClick={saveAudit} style={{ flex: 1, fontSize: '12px' }}>
                ✓ Complete Audit
              </button>
              <button onClick={saveNow} className="secondary">
                Save Draft
              </button>
            </>
          )}
          <button onClick={() => navigate('/dashboard')} className="secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default AuditForm;
