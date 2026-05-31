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
  dirty:  '#d08f60',
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
  } = useAudio();

  const [audit, setAudit]           = useState(null);
  const [song, setSong]             = useState(null);
  const [responses, setResponses]   = useState({});
  const [techniques, setTechniques] = useState([]);
  const [currentTechnique, setCurrentTechnique] = useState({ techniqueName: '', description: '', lens: 'rhythm' });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  // Issue 4: research panel visibility
  const [showResearch, setShowResearch] = useState(false);

  const { saveStatus, markDirty, saveNow } = useAutosave(auditId, { responses }, backend);

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
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="panel" style={{ background: '#151518', borderBottom: '2px solid #d08f60' }}>

        {/* Save status indicator */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', fontFamily: 'Roboto Mono', fontWeight: 'bold', color: SAVE_COLOR[saveStatus] }}>
            {SAVE_LABEL[saveStatus]}
          </span>
        </div>

        <h1>{template?.title || `${song?.title} DNA Audit`}</h1>
        <p className="card-subtitle" style={{ margin: 0 }}>{song?.artistName || song?.artist}</p>

        {error   && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {/* Issue 4: Research Intelligence Panel */}
        {researchSources.length > 0 && (
          <div style={{
            marginTop: '20px',
            background: 'rgba(208, 143, 96, 0.04)',
            border: '1px solid rgba(208, 143, 96, 0.15)',
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
                color: '#d08f60',
                fontFamily: 'Roboto Mono',
                fontSize: '11px',
                fontWeight: 'bold',
              }}
            >
              <span>📡 RESEARCH INTELLIGENCE ({researchSources.length} SOURCES)</span>
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
                          style={{ fontSize: '10px', color: '#d08f60', whiteSpace: 'nowrap', fontFamily: 'Roboto Mono', flexShrink: 0 }}
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
                if (isActive) { indicatorColor = '#d08f60'; textColor = '#d08f60'; }
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
                      background: isActive ? 'rgba(208, 143, 96, 0.08)' : 'transparent',
                      border: isActive ? '1px solid rgba(208, 143, 96, 0.3)' : '1px solid transparent',
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
                      boxShadow: isActive ? '0 0 8px #d08f60' : isComplete ? '0 0 6px #4ade80' : 'none',
                    }} />
                    {idx + 1} // {step.name.toUpperCase()}
                  </div>
                );
              })}
            </div>

            {currentStep && (
              <div style={{
                background: '#1c1c22',
                padding: '15px',
                borderLeft: '3px solid #d08f60',
                borderRadius: '2px',
              }}>
                <h3 style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px', color: '#d08f60' }}>
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

        {/* Content area */}
        <div style={{ marginTop: '30px' }}>

          {/* STEP 1: LISTEN — Issue 5: clear play instruction */}
          {isGuided && currentStep?.name === 'Listen' && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>🎧</div>
              <p style={{ fontSize: '14px', maxWidth: '500px', margin: '0 auto 20px', lineHeight: '1.6', fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.7)' }}>
                FULL AUDIT FOCUS. EXPERIENCE THE SIGNAL SPECTRUM FROM START TO FINISH.
              </p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(208,143,96,0.1)',
                border: '1px solid rgba(208,143,96,0.3)',
                padding: '10px 20px',
                borderRadius: '2px',
                fontSize: '12px',
                fontFamily: 'Roboto Mono',
                color: '#d08f60',
              }}>
                <span style={{ animation: 'pulse 1.5s infinite', fontSize: '16px' }}>▶</span>
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
                  background: 'rgba(208, 143, 96, 0.05)',
                  border: '1px solid rgba(208, 143, 96, 0.15)',
                  padding: '15px',
                  borderRadius: '2px',
                  marginBottom: '30px',
                }}>
                  <strong style={{ fontFamily: 'Roboto Mono', fontSize: '11px', color: '#d08f60' }}>
                    💡 WORKSPACE SIGNAL ANALYSIS MATRIX:
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
                    <h2 style={{ textTransform: 'uppercase', color: '#d08f60', marginBottom: '8px' }}>
                      {lens} Lens
                    </h2>
                    {lensData?.description && (
                      <p style={{ color: 'rgba(255,255,255,0.45)', marginBottom: '20px', fontSize: '12px' }}>
                        {lensData.description}
                      </p>
                    )}
                    {lens === 'arrangement' && (
                      <ArrangementTimelineWidget
                        responses={responses}
                        onChange={handleResponseChange}
                        song={song}
                      />
                    )}
                    {/* Render Concrete Exercises if available */}
                    {lensData?.exercises && lensData.exercises.length > 0 && (
                      <div style={{
                        marginTop: '15px',
                        marginBottom: '25px',
                        padding: '15px',
                        background: 'rgba(208, 143, 96, 0.03)',
                        border: '1px dashed rgba(208, 143, 96, 0.25)',
                        borderRadius: '2px',
                      }}>
                        <h4 style={{
                          fontFamily: 'Roboto Mono',
                          fontSize: '11px',
                          color: '#d08f60',
                          marginTop: 0,
                          marginBottom: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          🔬 CONCRETE EXERCISES (TAILORED)
                        </h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {lensData.exercises.map((ex, idx) => (
                            <div key={idx} style={{ background: '#0a0a0c', padding: '12px', borderLeft: '2px solid #d08f60', borderRadius: '1px' }}>
                              <strong style={{ fontSize: '12px', color: 'rgba(255,255,255,0.95)', display: 'block', marginBottom: '4px' }}>
                                {ex.name}
                              </strong>
                              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: '1.4' }}>
                                {ex.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {questions.map((question, idx) => {
                      const key = `${lens}-q${idx}`;
                      return (
                        <div key={key} className="form-group" style={{ marginBottom: '20px' }}>
                          <label style={{ fontWeight: '600', marginBottom: '8px', color: 'rgba(255,255,255,0.8)' }}>
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
                  </div>
                );
              })}
            </>
          )}

          {/* STEP 4: RECREATE */}
          {isGuided && currentStep?.name === 'Recreate' && (
            <div>
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ color: '#d08f60', fontSize: '12px', fontFamily: 'Roboto Mono', marginBottom: '12px' }}>
                  🎯 TAILORED RECREATION EXERCISES
                </h3>
                {lenses.map((lens) => {
                  const lensData = template?.lenses?.[lens];
                  if (!lensData?.exercises || lensData.exercises.length === 0) return null;
                  return (
                    <div key={lens} style={{ marginBottom: '15px', padding: '12px', background: '#1c1c22', borderLeft: '3px solid #d08f60' }}>
                      <strong style={{ textTransform: 'uppercase', fontSize: '11px', color: '#d08f60', fontFamily: 'Roboto Mono', display: 'block', marginBottom: '8px' }}>
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
              <h2>📝 Technique Log</h2>
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
                          <strong style={{ fontSize: '12px', color: '#d08f60', fontFamily: 'Roboto Mono' }}>
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
                  background: '#1c1c22',
                  border: '1px solid rgba(208, 143, 96, 0.3)',
                  color: '#d08f60',
                  padding: '5px 12px',
                  borderRadius: '2px',
                  fontSize: '11px',
                  fontFamily: 'Roboto Mono',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#d08f60'; e.currentTarget.style.color = '#0c0c0e'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#1c1c22'; e.currentTarget.style.color = '#d08f60'; }}
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
