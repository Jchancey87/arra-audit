import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
// Phase 4.3: lazy-load audit panel subcomponents to shrink the initial bundle
const AuditPanelHeader = lazy(() => import('../components/audit/AuditPanelHeader'));
const AuditTabBar = lazy(() => import('../components/audit/AuditTabBar'));
const TrackAnalysisModules = lazy(() => import('../components/audit/TrackAnalysisModules'));
const AuditTimeline = lazy(() => import('../components/audit/AuditTimeline'));
const LensPanel = lazy(() => import('../components/audit/LensPanel'));
const SourcesPanel = lazy(() => import('../components/audit/SourcesPanel'));
const NotebookPanel = lazy(() => import('../components/audit/NotebookPanel'));
const CaptureTechnique = lazy(() => import('../components/audit/CaptureTechnique'));
import { LENS_PROMPTS, LENS_LABEL } from '../components/audit/lensConstants';

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
const stripTopic = (name) => (name || '').replace(/\s*-\s*Topic\s*$/i, '').replace(/\s*\(Official.*?\)/gi, '').replace(/\s*\[Official.*?\]/gi, '').trim();

// ── Suspense fallback (Phase 4.3) ──────────────────────────────────────────
const AuditPanelSkeleton = () => (
  <div
    aria-busy="true"
    style={{
      background: 'var(--bg-surface-2)',
      padding: '20px 24px',
      borderBottom: '1px solid var(--border-subtle)',
      minHeight: '88px',
    }}
  />
);

const TabLoadingPanel = ({ label = 'Loading…' }) => (
  <div
    role="status"
    aria-live="polite"
    style={{
      padding: '32px 16px',
      textAlign: 'center',
      color: 'var(--text-tertiary)',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}
  >
    {label}
  </div>
);

const parseTimestamp = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : null;
  const s = String(raw).trim();
  if (!s) return null;
  const match = s.match(/^(\d+):(\d{1,2})$/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

const getTechniqueTimestamp = (tech) => {
  const parsed = parseTimestamp(tech?.timestamp);
  if (parsed != null) return parsed;
  if (Number.isFinite(tech?.exampleTimestamp) && tech.exampleTimestamp >= 0) {
    return Math.floor(tech.exampleTimestamp);
  }
  return null;
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
    setBookmarks: setGlobalBookmarks,
    seekTo,
    isPlaying,
    currentTime,
    duration,
    focusMode,
    setFocusMode,
    togglePlay,
  } = useAudio();

  const [audit, setAudit]           = useState(null);
  const [song, setSong]             = useState(null);
  const [responses, setResponses]   = useState({});
  const [techniques, setTechniques] = useState([]);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Notebook tab state (song-filtered techniques)
  const [notebookTechniques, setNotebookTechniques] = useState([]);
  const [notebookLoading, setNotebookLoading] = useState(false);
  const [notebookError, setNotebookError] = useState('');

  // Audio Analysis pipeline state
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('Initiating extraction pipeline...');

  const { saveStatus, markDirty, saveNow } = useAutosave(auditId, { responses }, backend);
  const [captureSavedTick, setCaptureSavedTick] = useState(0);

  // Auto-enable Focus Mode on mount, disable on unmount
  useEffect(() => {
    setFocusMode(true);
    return () => setFocusMode(false);
  }, [setFocusMode]);

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
          if (currentStage) setAnalysisStage(currentStage.text);
          else setAnalysisStage('Finalizing background database sync...');
          return next;
        });
      }, 400);
    } else {
      setAnalysisProgress(0);
    }
    return () => { if (timer) clearInterval(timer); };
  }, [song?.audioAnalysisStatus]);

  // Load audit + song on mount
  useEffect(() => {
    const load = async () => {
      try {
        const auditData = await backend.getAudit(auditId);
        if (!auditData) { setError('Audit not found'); return; }
        setAudit(auditData);
        setResponses(auditData.responses || {});
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

  // Notebook tab — song-filtered techniques list (defined before the useEffect that depends on it)
  const loadNotebookTechniques = useCallback(async (songId) => {
    if (!songId) {
      setNotebookTechniques([]);
      return;
    }
    setNotebookLoading(true);
    setNotebookError('');
    try {
      const res = await backend.getTechniques({ songId, sortBy: 'createdAt', order: 'desc', limit: 200 });
      const list = Array.isArray(res?.techniques) ? res.techniques : [];
      setNotebookTechniques(list);
    } catch (err) {
      setNotebookError(err.response?.data?.error || err.message || 'Failed to load techniques');
      setNotebookTechniques([]);
    } finally {
      setNotebookLoading(false);
    }
  }, [backend]);

  // Notebook tab — refresh when songId changes or new technique saved
  useEffect(() => {
    const songId = song?._id;
    if (!songId) return;
    loadNotebookTechniques(songId);
  }, [song?._id, captureSavedTick, loadNotebookTechniques]);

  // Responses
  const handleResponseChange = (key, value) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
    markDirty();
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

  // Save (manual / final)
  const saveAudit = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await backend.updateAudit(auditId, { responses, status: 'completed' });
      flash('Audit saved!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save audit');
    } finally {
      setIsSaving(false);
    }
  };

  // Save draft (no navigation, no status change)
  const handleSaveDraft = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await backend.updateAudit(auditId, { responses });
      flash('Draft saved');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  };

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  };

  // ── Tab state — persists in session via sessionStorage
  const [activeTab, setActiveTab] = useState(() => {
    try { return sessionStorage.getItem(`audit-tab-${auditId}`) || 'analysis'; } catch { return 'analysis'; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(`audit-tab-${auditId}`, activeTab); } catch {}
  }, [activeTab, auditId]);

  // ── Tab body ref + auto-focus first interactive on tab switch (Phase 3.4)
  const tabBodyRef = useRef(null);
  useEffect(() => {
    if (!tabBodyRef.current) return;
    const first = tabBodyRef.current.querySelector(
      'input:not([type="hidden"]), button:not([disabled]), select, textarea, [tabindex="0"]'
    );
    if (first && typeof first.focus === 'function') {
      first.focus();
    }
  }, [activeTab]);

  // Active lens for the Lens tab (must be above render guards per Rules of Hooks)
  const [activeLens, setActiveLens] = useState('harmony');
  useEffect(() => {
    if (audit?.lensSelection && audit.lensSelection.length > 0) {
      const l = audit.lensSelection[0].toLowerCase();
      if (LENS_PROMPTS[l]) setActiveLens(l);
    }
  }, [audit?.lensSelection]);

  // Arrangement lens availability (gates the M key shortcut)
  const hasArrangementLens = useMemo(() => {
    if (!audit) return false;
    if (audit.lensSelection?.includes('arrangement')) return true;
    if (audit.templateQuestions?.lenses?.arrangement) return true;
    return false;
  }, [audit?.lensSelection, audit?.templateQuestions]);

  // Global keyboard shortcuts: M (marker), Space (play/pause)
  useEffect(() => {
    const isTextEntry = (el) => {
      if (!el) return false;
      const tag = el.nodeName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      return !!el.isContentEditable;
    };
    const handler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTextEntry(e.target)) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (togglePlay) togglePlay();
      } else if ((e.key === 'm' || e.key === 'M') && hasArrangementLens) {
        e.preventDefault();
        handleAddMarker(currentTime || 0);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [hasArrangementLens, currentTime, togglePlay, auditId]);

  // Completion check (AC-08): ≥2 prompts answered OR ≥1 technique saved
  const answeredPrompts = useMemo(() => {
    const template = audit?.templateQuestions;
    const customPrompts = template?.lenses?.[activeLens]?.prompts;
    const prompts = (Array.isArray(customPrompts) && customPrompts.length > 0)
      ? customPrompts
      : (LENS_PROMPTS[activeLens] || []);
    return prompts.filter((_, i) => (responses[`lens-${activeLens}-${i}`] || '').trim().length >= 10).length;
  }, [activeLens, responses, audit?.templateQuestions]);
  const hasAnyResponse = useMemo(() => {
    return Object.values(responses || {}).some((v) => {
      if (v == null) return false;
      if (typeof v === 'string') return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object') return Object.keys(v).length > 0;
      return true;
    });
  }, [responses]);
  const canComplete = (techniques.length >= 1 || answeredPrompts >= 2) && hasAnyResponse;
  const completionReason = useMemo(() => {
    if (canComplete) return '';
    if (!hasAnyResponse && techniques.length === 0) {
      return 'Add a response or save a technique to complete this session.';
    }
    if (techniques.length < 1 && answeredPrompts < 2) {
      return `Answer at least 2 prompts or save a technique (${answeredPrompts}/2 prompts, ${techniques.length} technique${techniques.length === 1 ? '' : 's'}).`;
    }
    return 'Complete requirements not yet met.';
  }, [canComplete, hasAnyResponse, techniques.length, answeredPrompts]);

  // ── Render guards ────────────────────────────────────────────────────────
  if (loading) return <div className="loading">Loading audit workspace...</div>;
  if (error && !audit) return <div className="error">{error}</div>;
  if (!audit) return <div className="loading">Loading audit workspace...</div>;

  const template = audit.templateQuestions;
  const lenses = template?.lenses ? Object.keys(template.lenses) : audit.lensSelection || [];
  const isGuided = audit.workflowType === 'guided';
  const currentStep = isGuided ? audit.guidedSteps.find((s) => s.status === 'active') : null;
  const stepIndex = isGuided ? audit.guidedSteps.findIndex((s) => s.status === 'active') : -1;

  const researchSources = song?.researchSummary?.results || [];

  // Tab definitions
  const tabs = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'lens', label: `Lens: ${LENS_LABEL[activeLens] || 'Harmony'}` },
    { id: 'sources', label: 'Sources', badge: researchSources.length },
    { id: 'notebook', label: 'Notebook' },
  ];

  // Override handler (Track Analysis inline edit)
  const handleAnalysisChangeOverride = async (draft) => {
    if (!song?._id) return;
    try {
      const updated = await backend.saveAudioOverrides(song._id, {
        tempo_bpm: draft.tempo_bpm ? parseFloat(draft.tempo_bpm) : null,
        key: draft.key || null,
        scale: draft.scale || null,
        estimated_meter: draft.estimated_meter || null,
      });
      setSong(updated.song || updated);
      flash('✓ Values updated');
    } catch (err) {
      setError('Failed to save override values');
    }
  };

  // ── Marker (bookmark) handlers ──────────────────────────────────────────
  const syncBookmarks = (updated) => {
    const list = updated?.bookmarks || [];
    setAudit((prev) => (prev ? { ...prev, bookmarks: list } : prev));
    setGlobalBookmarks(list);
  };

  const handleAddMarker = async (time) => {
    if (!auditId) return;
    try {
      const updated = await backend.addBookmark(auditId, {
        timestampSeconds: Math.max(0, Math.floor(time)),
        label: '',
        note: '',
        lens: 'arrangement',
      });
      syncBookmarks(updated);
    } catch (err) {
      setError('Failed to drop marker');
    }
  };

  const handleUpdateMarker = async (id, fields) => {
    if (!auditId) return;
    try {
      const updated = await backend.updateBookmark(auditId, id, fields);
      syncBookmarks(updated);
    } catch (err) {
      setError('Failed to update marker');
    }
  };

  const handleDeleteMarker = async (id) => {
    if (!auditId) return;
    try {
      const updated = await backend.deleteBookmark(auditId, id);
      syncBookmarks(updated);
    } catch (err) {
      setError('Failed to delete marker');
    }
  };

  // ── Section handler (arrangement-timeline storage) ────────────────────────
  const handleAddSection = ({ name, start }) => {
    if (!name?.trim()) return;
    let arr = [];
    const raw = responses['arrangement-timeline'];
    if (raw) {
      try { arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
      catch { arr = []; }
    }
    const sorted = [...arr].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    const next = sorted.find((b) => (b.startTime || 0) > start);
    const defaultDur = 30;
    const duration = next ? Math.max(1, Math.round(next.startTime - start)) : defaultDur;
    const block = {
      id: `sec-${Date.now()}`,
      name: name.trim(),
      type: 'verse',
      startTime: Math.max(0, Math.floor(start)),
      duration,
      notes: '',
    };
    handleResponseChange('arrangement-timeline', JSON.stringify([...sorted, block]));
    flash(`Section "${block.name}" added`);
  };

  // Capture Technique submit
  const handleCaptureTechniqueSubmit = async (payload) => {
    const desc = [payload.whatHappened, payload.howReuse].filter(Boolean).join('\n\n');
    if (!desc.trim()) return;
    try {
      const saved = await backend.addTechnique({
        auditId,
        songId: audit.songId?._id || audit.songId,
        artist: song?.artistName || song?.artist || '',
        techniqueName: payload.name,
        description: desc,
        lens: payload.lens,
        tags: payload.tags,
        timestamp: payload.timestamp,
      });
      setTechniques((prev) => [...prev, saved]);
      setCaptureSavedTick((t) => t + 1);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to save technique';
      setError(msg);
      throw err;
    }
  };

  // Notebook tab — song-filtered techniques list
  const handleDeleteNotebookTechnique = async (id) => {
    if (!id) return;
    const prev = notebookTechniques;
    setNotebookTechniques((cur) => cur.filter((t) => t._id !== id));
    try {
      await backend.deleteTechnique(id);
      flash('Technique removed');
    } catch (err) {
      setNotebookTechniques(prev);
      setError(err.response?.data?.error || err.message || 'Failed to delete technique');
    }
  };

  // Trigger initial analysis
  const handleTriggerAnalysis = async () => {
    if (!song?._id) return;
    try {
      await backend.triggerSongAnalysis(song._id);
      const updated = await backend.getSong(song._id);
      setSong(updated);
      flash('✓ Analysis pipeline triggered');
    } catch (e) {
      setError('Failed to trigger analysis pipeline');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'var(--bg-surface-0)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {error && <div className="error" style={{ margin: '8px 12px 0' }}>{error}</div>}
      {success && <div className="success" style={{ margin: '8px 12px 0' }}>{success}</div>}

      {/* ── Panel Header (4.1) ── */}
      <Suspense fallback={<AuditPanelSkeleton />}>
        <AuditPanelHeader
          song={song}
          audioContext={{ isPlaying, currentTime, duration }}
          saveStatus={saveStatus}
          isComplete={canComplete}
          isSaving={isSaving}
          completionReason={completionReason}
          onComplete={saveAudit}
          onSaveDraft={handleSaveDraft}
          onReturnToPlan={() => navigate('/planner')}
        />
      </Suspense>

      {/* ── Tab Bar (4.2) ── */}
      <Suspense fallback={<div style={{ height: '40px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)' }} />}>
        <AuditTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </Suspense>

      {/* ── Tab Content Area (scrolls) ── */}
      <main
        ref={tabBodyRef}
        id={`tab-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          background: 'var(--bg-surface-0)',
        }}
      >
        {/* ── ANALYSIS TAB ── */}
        {activeTab === 'analysis' && (
          <div className="audit-form-main">
            {/* Analysis pipeline states */}
            {song?.audioAnalysisStatus === 'not_started' && (
              <div
                style={{
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '20px',
                }}
              >
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 12px 0' }}>
                  Audio signal extraction has not been executed yet. Discover the BPM, key signature, meter, and temporal dynamics.
                </p>
                <button onClick={handleTriggerAnalysis} className="primary">
                  Execute Audio Signal Extraction
                </button>
              </div>
            )}

            {song?.audioAnalysisStatus === 'pending' && (
              <div
                style={{
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  padding: '24px',
                  textAlign: 'center',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    display: 'inline-block',
                    width: '20px', height: '20px',
                    border: '2px solid var(--accent-primary-bg)',
                    borderTopColor: 'var(--accent-primary)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '10px',
                  }}
                />
                <p
                  style={{
                    fontSize: '12px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent-primary)',
                    margin: '0 0 10px 0',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Extracting Harmonic & Rhythmic Codes ({analysisProgress}%)
                </p>
                <div
                  style={{
                    width: '80%', maxWidth: '380px', height: '4px',
                    background: 'var(--bg-surface-3)',
                    margin: '0 auto 10px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${analysisProgress}%`, height: '100%',
                      background: 'var(--accent-primary)',
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                </div>
                <p
                  style={{
                    fontSize: '10px', color: 'var(--text-tertiary)',
                    fontFamily: 'JetBrains Mono, monospace',
                    margin: 0, textTransform: 'uppercase',
                  }}
                >
                  {analysisStage}
                </p>
              </div>
            )}

            {song?.audioAnalysisStatus === 'failed' && (
              <div
                style={{
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  padding: '20px',
                  textAlign: 'center',
                  marginBottom: '20px',
                }}
              >
                <p style={{ color: 'var(--status-low)', fontSize: '12px', margin: '0 0 10px 0' }}>
                  Signal extraction pipeline reported an error.
                </p>
                <button onClick={handleTriggerAnalysis} className="danger">
                  Re-run Pipeline
                </button>
              </div>
            )}

            {song?.audioAnalysisStatus === 'success' && song.audioAnalysis && (
              <>
                <Suspense fallback={<TabLoadingPanel label="Loading analysis modules…" />}>
                  <TrackAnalysisModules
                    song={song}
                    onChangeOverride={handleAnalysisChangeOverride}
                  />
                </Suspense>
                <Suspense fallback={<TabLoadingPanel label="Loading timeline…" />}>
                  <AuditTimeline
                    song={song}
                    currentTime={currentTime}
                    duration={duration || song.durationSeconds || 0}
                    onSeek={seekTo}
                    onAddMarker={handleAddMarker}
                    onUpdateMarker={handleUpdateMarker}
                    onDeleteMarker={handleDeleteMarker}
                    onAddSection={handleAddSection}
                    markers={globalBookmarks}
                  />
                </Suspense>
                {/* Fallback template notice */}
                {audit.templateVersion?.startsWith('fallback') && (
                  <div
                    style={{
                      background: 'var(--status-warning-muted)',
                      color: 'var(--status-warning)',
                      padding: '10px 12px',
                      marginTop: '16px',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                  >
                    Using standard reference template — custom sonic synthesis unavailable.
                  </div>
                )}

                {/* Guided workflow inline help */}
                {isGuided && currentStep && currentStep.name !== 'Listen' && (
                  <div
                    style={{
                      background: 'var(--bg-surface-2)',
                      borderLeft: '3px solid var(--accent-primary)',
                      padding: '12px 16px',
                      marginTop: '20px',
                    }}
                  >
                    <h3
                      style={{
                        margin: '0 0 6px 0',
                        color: 'var(--accent-primary)',
                        fontSize: '11px',
                        fontFamily: 'JetBrains Mono, monospace',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      Step {String(currentStep.stepNumber).padStart(2, '0')} // {currentStep.name}
                    </h3>
                    <p
                      style={{
                        margin: 0, fontSize: '12px', lineHeight: 1.5,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {currentStep.instructions}
                    </p>
                  </div>
                )}

                {/* Guided step controls */}
                {isGuided && (
                  <div
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      marginTop: '20px', paddingTop: '12px',
                      borderTop: '1px solid var(--border-subtle)',
                      gap: '8px',
                    }}
                  >
                    {stepIndex > 0 && (
                      <button onClick={handleGoBackStep} className="secondary">← Back</button>
                    )}
                    <div style={{ flex: 1 }} />
                    {stepIndex < audit.guidedSteps.length - 1 ? (
                      <>
                        <button onClick={handleSkipStep} className="ghost">Skip</button>
                        <button onClick={handleAdvanceStep} className="primary">Next Step →</button>
                      </>
                    ) : (
                      <button onClick={saveAudit} className="primary">✓ Complete Audit</button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Step 1: Listen (Guided) */}
            {isGuided && currentStep?.name === 'Listen' && (
              <div style={{ textAlign: 'center', padding: '40px 16px' }}>
                <div style={{ color: 'var(--accent-primary)', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                  </svg>
                </div>
                <p
                  style={{
                    fontSize: '13px', maxWidth: '500px', margin: '0 auto 20px', lineHeight: 1.5,
                    color: 'var(--text-primary)',
                  }}
                >
                  Full audit focus. Experience the signal spectrum from start to finish.
                </p>
                <div
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: 'var(--accent-primary-bg)',
                    padding: '10px 20px',
                    fontSize: '12px', fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent-primary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  Press <strong>Play</strong> in the Tape Deck below or click the video monitor
                </div>
                <div style={{ marginTop: '20px' }}>
                  <button onClick={handleAdvanceStep} className="primary">Next Step →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LENS TAB (4.5) ── */}
        {activeTab === 'lens' && (
          <Suspense fallback={<TabLoadingPanel label="Loading lens…" />}>
            <LensPanel
              activeLens={activeLens}
              onChangeLens={setActiveLens}
              song={song}
              currentTime={currentTime}
              responses={responses}
              onResponseChange={handleResponseChange}
              listeningFocus={template?.lenses?.[activeLens]?.focus || template?.lenses?.[activeLens]?.listening_focus}
              lensDescription={template?.lenses?.[activeLens]?.description}
              customPrompts={template?.lenses?.[activeLens]?.prompts}
            />
          </Suspense>
        )}

        {/* ── SOURCES TAB (4.7) ── */}
        {activeTab === 'sources' && (
          <Suspense fallback={<TabLoadingPanel label="Loading sources…" />}>
            <SourcesPanel sources={researchSources} />
          </Suspense>
        )}

        {/* ── NOTEBOOK TAB ── */}
        {activeTab === 'notebook' && (
          <Suspense fallback={<TabLoadingPanel label="Loading notebook…" />}>
            <NotebookPanel
              techniques={notebookTechniques}
              loading={notebookLoading}
              error={notebookError}
              onDelete={handleDeleteNotebookTechnique}
              onSeek={seekTo}
              onOpenNotebook={() => navigate('/techniques')}
            />
          </Suspense>
        )}

        {/* Recently logged techniques (visible on every tab) */}
        {techniques.length > 0 && (
          <div
            style={{
              padding: '0 16px 16px',
              background: 'var(--bg-surface-0)',
            }}
          >
            <h3
              style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                fontFamily: 'JetBrains Mono, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: '0 0 8px 0',
              }}
            >
              Logged This Session ({techniques.length})
            </h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              {techniques.map((tech) => {
                const ts = getTechniqueTimestamp(tech);
                return (
                  <div
                    key={tech._id || tech._tempId}
                    style={{
                      background: 'var(--bg-surface-2)',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '10px',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong
                        style={{
                          fontSize: '12px',
                          color: 'var(--accent-primary)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        {tech.techniqueName || 'Untitled'}
                      </strong>
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tech.description}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {ts != null && (
                        <button
                          onClick={() => seekTo(ts)}
                          title="Seek to timestamp"
                          style={{
                            background: 'var(--bg-surface-3)',
                            color: 'var(--accent-primary)',
                            fontSize: '10px',
                            fontFamily: 'JetBrains Mono, monospace',
                            padding: '2px 8px',
                            border: '1px solid var(--border-subtle)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span style={{ width: '4px', height: '4px', background: 'var(--accent-primary)', display: 'inline-block' }} />
                          {formatTime(ts)}
                        </button>
                      )}
                      <span className="badge">{tech.lens}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Session Bookmarks (visible on every tab) */}
        {globalBookmarks.length > 0 && (
          <div style={{ padding: '0 16px 16px' }}>
            <h3
              style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                fontFamily: 'JetBrains Mono, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: '0 0 8px 0',
              }}
            >
              Session Bookmarks ({globalBookmarks.length})
            </h3>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
              {globalBookmarks.map((bm, idx) => (
                <button
                  key={bm._id || idx}
                  onClick={() => seekTo(bm.timestampSeconds || bm.timestamp)}
                  style={{
                    background: 'var(--bg-surface-2)',
                    color: 'var(--accent-primary)',
                    padding: '4px 10px',
                    fontSize: '10px',
                    fontFamily: 'JetBrains Mono, monospace',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {formatTime(bm.timestampSeconds || bm.timestamp)}
                  {bm.note ? ` · ${bm.note}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Capture Technique (sticky footer, always visible) ── */}
      <Suspense fallback={<div style={{ minHeight: '180px', background: 'var(--bg-surface-2)', borderTop: '1px solid var(--border-subtle)' }} />}>
        <CaptureTechnique
          initialLens={activeLens}
          currentTime={currentTime}
          onSubmit={handleCaptureTechniqueSubmit}
          savedIndicator={captureSavedTick}
        />
      </Suspense>
    </div>
  );
};

export default AuditForm;
