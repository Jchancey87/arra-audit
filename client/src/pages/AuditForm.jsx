import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import { useAudit, useSong, useTechniques, useAuditAutosave, useAnalysisPolling, useAnalysisProgressSim, useCompletionCheck, useAuditShortcuts } from '../hooks';
// Phase 4.3: lazy-load audit panel subcomponents to shrink the initial bundle
const AuditPanelHeader = lazy(() => import('../components/audit/AuditPanelHeader'));
const AuditTabBar = lazy(() => import('../components/audit/AuditTabBar'));
const LensPanel = lazy(() => import('../components/audit/LensPanel'));
const SourcesPanel = lazy(() => import('../components/audit/SourcesPanel'));
const NotebookPanel = lazy(() => import('../components/audit/NotebookPanel'));
const CaptureTechnique = lazy(() => import('../components/audit/CaptureTechnique'));
import AuditAnalysisTab from '../components/audit/AuditAnalysisTab';
import LoggedThisSession from '../components/audit/LoggedThisSession';
import SessionBookmarks from '../components/audit/SessionBookmarks';
import { LENS_PROMPTS, LENS_LABEL } from '../components/audit/lensConstants';

// ── Helpers ──────────────────────────────────────────────────────────────────
// (helpers moved into the new components: AnalysisPipelineStates,
//  LoggedThisSession, SessionBookmarks)

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

// ── AuditForm ────────────────────────────────────────────────────────────────
const AuditForm = () => {
  const { auditId } = useParams();
  const navigate = useNavigate();

  const {
    loadSong, setActiveAudit, bookmarks: globalBookmarks, setBookmarks: setGlobalBookmarks,
    seekTo, isPlaying, currentTime, duration, focusMode, setFocusMode, togglePlay,
  } = useAudio();

  // ── Data hooks (Phase 0.4: deep-module layer) ─────────────────────────────
  const {
    audit, loading: auditLoading, error: auditError,
    saveResponses, setStatus, advanceStep, goBackStep, skipStep,
    addBookmark, updateBookmark, deleteBookmark,
  } = useAudit(auditId);

  const songId = audit?.songId?._id ?? audit?.songId;
  const {
    song, refetch: refetchSong, triggerAnalysis, saveOverrides,
  } = useSong(songId, { skip: !songId });

  const {
    techniques: notebookTechniques, loading: notebookLoading, error: notebookErrorRaw,
    add: addNotebookTechnique, remove: removeNotebookTechnique,
  } = useTechniques(
    songId ? { songId, sortBy: 'createdAt', order: 'desc', limit: 200 } : { sortBy: 'createdAt', order: 'desc', limit: 200 },
    { skip: !songId }
  );
  const notebookError = notebookErrorRaw?.response?.data?.error || notebookErrorRaw?.message || '';

  // ── Local state ──────────────────────────────────────────────────────────
  const [responses, setResponses] = useState({});
  const [sessionTechniques, setSessionTechniques] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [captureSavedTick, setCaptureSavedTick] = useState(0);

  // Seed responses from audit when it first arrives
  useEffect(() => {
    if (audit) setResponses(audit.responses || {});
  }, [audit?._id]);

  // Sync song to global audio context
  useEffect(() => {
    if (song) loadSong(song);
  }, [song?._id, loadSong]);

  // Sync audit to global audio context
  useEffect(() => {
    if (audit) setActiveAudit(audit);
    return () => setActiveAudit(null);
  }, [audit, setActiveAudit]);

  // Sync bookmarks to global audio context when audit bookmarks change
  useEffect(() => {
    if (audit?.bookmarks) setGlobalBookmarks(audit.bookmarks);
  }, [audit?.bookmarks, setGlobalBookmarks]);

  // ── Autosave + analysis progress (extracted custom hooks) ───────────────
  const { saveStatus, markDirty } = useAuditAutosave(auditId, responses, saveResponses);
  useAnalysisPolling(song, refetchSong);
  const { progress: analysisProgress, stage: analysisStage } = useAnalysisProgressSim(song);

  // ── Focus Mode auto-enable on mount ─────────────────────────────────────
  useEffect(() => {
    setFocusMode(true);
    return () => setFocusMode(false);
  }, [setFocusMode]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const flash = useCallback((msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 2500);
  }, []);

  const handleResponseChange = useCallback((key, value) => {
    setResponses((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }, [markDirty]);

  const handleAdvanceStep = useCallback(async () => {
    try { await advanceStep(); flash('Step completed!'); }
    catch (err) { setError(err.message || 'Failed to advance step'); }
  }, [advanceStep, flash]);

  const handleGoBackStep = useCallback(async () => {
    try { await goBackStep(); }
    catch (err) { setError(err.message || 'Failed to go back'); }
  }, [goBackStep]);

  const handleSkipStep = useCallback(async () => {
    try { await skipStep(); }
    catch (err) { setError(err.message || 'Failed to skip step'); }
  }, [skipStep]);

  const saveAudit = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveResponses(responses);
      await setStatus('completed');
      flash('Audit saved!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save audit');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, responses, saveResponses, setStatus, flash, navigate]);

  const handleSaveDraft = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveResponses(responses);
      flash('Draft saved');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save draft');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, responses, saveResponses, flash]);

  // ── Tab state (persists in session via sessionStorage) ──────────────────
  const [activeTab, setActiveTab] = useState(() => {
    try { return sessionStorage.getItem(`audit-tab-${auditId}`) || 'analysis'; } catch { return 'analysis'; }
  });
  useEffect(() => {
    try { sessionStorage.setItem(`audit-tab-${auditId}`, activeTab); } catch {}
  }, [activeTab, auditId]);

  // ── Auto-focus first interactive on tab switch (Phase 3.4) ──────────────
  const tabBodyRef = useRef(null);
  useEffect(() => {
    if (!tabBodyRef.current) return;
    const first = tabBodyRef.current.querySelector(
      'input:not([type="hidden"]), button:not([disabled]), select, textarea, [tabindex="0"]'
    );
    if (first && typeof first.focus === 'function') first.focus();
  }, [activeTab]);

  // ── Active lens (must be above render guards per Rules of Hooks) ───────
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

  // ── Marker (bookmark) handlers ──────────────────────────────────────────
  const handleAddMarker = useCallback(async (time) => {
    if (!auditId) return;
    try {
      await addBookmark({
        timestampSeconds: Math.max(0, Math.floor(time)),
        label: '',
        note: '',
        lens: 'arrangement',
      });
    } catch { setError('Failed to drop marker'); }
  }, [auditId, addBookmark]);

  const handleUpdateMarker = useCallback(async (id, fields) => {
    if (!auditId) return;
    try { await updateBookmark(id, fields); }
    catch { setError('Failed to update marker'); }
  }, [auditId, updateBookmark]);

  const handleDeleteMarker = useCallback(async (id) => {
    if (!auditId) return;
    try { await deleteBookmark(id); }
    catch { setError('Failed to delete marker'); }
  }, [auditId, deleteBookmark]);

  // ── Section handler (arrangement-timeline storage) ────────────────────────
  const handleAddSection = useCallback(({ name, start }) => {
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
  }, [responses, handleResponseChange, flash]);

  // ── Analysis override handler (Track Analysis inline edit) ──────────────
  const handleAnalysisChangeOverride = useCallback(async (draft) => {
    if (!songId) return;
    try {
      await saveOverrides({
        tempo_bpm: draft.tempo_bpm ? parseFloat(draft.tempo_bpm) : null,
        key: draft.key || null,
        scale: draft.scale || null,
        estimated_meter: draft.estimated_meter || null,
      });
      flash('✓ Values updated');
    } catch {
      setError('Failed to save override values');
    }
  }, [songId, saveOverrides, flash]);

  // ── Capture Technique submit ────────────────────────────────────────────
  const handleCaptureTechniqueSubmit = useCallback(async (payload) => {
    const desc = [payload.whatHappened, payload.howReuse].filter(Boolean).join('\n\n');
    if (!desc.trim()) return;
    try {
      const saved = await addNotebookTechnique({
        auditId,
        songId,
        artist: song?.artistName || song?.artist || '',
        techniqueName: payload.name,
        description: desc,
        lens: payload.lens,
        tags: payload.tags,
        timestamp: payload.timestamp,
      });
      setSessionTechniques((prev) => [...prev, saved]);
      setCaptureSavedTick((t) => t + 1);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to save technique';
      setError(msg);
      throw err;
    }
  }, [auditId, songId, song?.artistName, song?.artist, addNotebookTechnique]);

  // ── Notebook delete (optimistic via hook) ───────────────────────────────
  const handleDeleteNotebookTechnique = useCallback(async (id) => {
    if (!id) return;
    try {
      await removeNotebookTechnique(id);
      flash('Technique removed');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete technique');
    }
  }, [removeNotebookTechnique, flash]);

  // ── Trigger initial analysis ────────────────────────────────────────────
  const handleTriggerAnalysis = useCallback(async () => {
    if (!songId) return;
    try {
      await triggerAnalysis();
      flash('✓ Analysis pipeline triggered');
    } catch {
      setError('Failed to trigger analysis pipeline');
    }
  }, [songId, triggerAnalysis, flash]);

  // ── Global keyboard shortcuts + completion check (extracted custom hooks) ─
  useAuditShortcuts({ togglePlay, hasArrangementLens, currentTime, onAddMarker: handleAddMarker });
  const { canComplete, completionReason } = useCompletionCheck(audit, responses, activeLens, sessionTechniques);

  // ── Render guards ───────────────────────────────────────────────────────
  const loading = auditLoading || !audit;
  if (loading) return <div className="loading">Loading audit workspace...</div>;
  if (auditError && !audit) return <div className="error">{auditError.message || String(auditError)}</div>;

  const template = audit.templateQuestions;
  const lenses = template?.lenses ? Object.keys(template.lenses) : audit.lensSelection || [];
  const isGuided = audit.workflowType === 'guided';
  const currentStep = isGuided ? audit.guidedSteps.find((s) => s.status === 'active') : null;
  const stepIndex = isGuided ? audit.guidedSteps.findIndex((s) => s.status === 'active') : -1;

  const researchSources = song?.researchSummary?.results || [];

  const tabs = [
    { id: 'analysis', label: 'Analysis' },
    { id: 'lens', label: `Lens: ${LENS_LABEL[activeLens] || 'Harmony'}` },
    { id: 'sources', label: 'Sources', badge: researchSources.length },
    { id: 'notebook', label: 'Notebook' },
  ];

  return (
    <div style={{ background: 'var(--bg-surface-0)', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {error && <div className="error" style={{ margin: '8px 12px 0' }}>{error}</div>}
      {success && <div className="success" style={{ margin: '8px 12px 0' }}>{success}</div>}

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

      <Suspense fallback={<div style={{ height: '40px', background: 'var(--bg-surface-1)', borderBottom: '1px solid var(--border-subtle)' }} />}>
        <AuditTabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </Suspense>

      <main
        ref={tabBodyRef}
        id={`tab-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg-surface-0)' }}
      >
        {activeTab === 'analysis' && (
          <AuditAnalysisTab
            song={song}
            audit={audit}
            isGuided={isGuided}
            currentStep={currentStep}
            stepIndex={stepIndex}
            totalSteps={audit.guidedSteps.length}
            fallbackNotice={audit.templateVersion?.startsWith('fallback')}
            currentTime={currentTime}
            duration={duration}
            globalBookmarks={globalBookmarks}
            onChangeOverride={handleAnalysisChangeOverride}
            onAddMarker={handleAddMarker}
            onUpdateMarker={handleUpdateMarker}
            onDeleteMarker={handleDeleteMarker}
            onAddSection={handleAddSection}
            onSeek={seekTo}
            onBack={handleGoBackStep}
            onSkip={handleSkipStep}
            onAdvance={handleAdvanceStep}
            onComplete={saveAudit}
            onTriggerAnalysis={handleTriggerAnalysis}
            analysisProgress={analysisProgress}
            analysisStage={analysisStage}
          />
        )}

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

        {activeTab === 'sources' && (
          <Suspense fallback={<TabLoadingPanel label="Loading sources…" />}>
            <SourcesPanel sources={researchSources} />
          </Suspense>
        )}

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

        {sessionTechniques.length > 0 && (
          <LoggedThisSession techniques={sessionTechniques} onSeek={seekTo} />
        )}

        <SessionBookmarks bookmarks={globalBookmarks} onSeek={seekTo} />
      </main>

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
