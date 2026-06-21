import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import { useBackend } from '../context/BackendContext';
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
import { LENS_PROMPTS, LENS_LABEL, LENS_REGION_COLOR, SECTION_TYPE_COLORS } from '../components/audit/lensConstants';
import UniversalWaveformBar from '../components/UniversalWaveformBar';

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
    seekTo, isPlaying, currentTime, duration, focusMode, setFocusMode, togglePlay, audioError,
  } = useAudio();

  // ── Data hooks (Phase 0.4: deep-module layer) ─────────────────────────────
  const {
    audit, loading: auditLoading, error: auditError,
    saveResponses, setStatus, advanceStep, goBackStep, skipStep,
    addBookmark, updateBookmark, deleteBookmark,
  } = useAudit(auditId);

  const songId = audit?.songId?._id ?? audit?.songId;
  const {
    song, refetch: refetchSong, triggerAnalysis, verifyAnalysis, saveOverrides,
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
  const backend = useBackend();
  const [responses, setResponses] = useState({});
  const [sessionTechniques, setSessionTechniques] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [captureSavedTick, setCaptureSavedTick] = useState(0);
  // Recovery UI for stuck legacy songs whose publicUrl is null (audio was
  // never downloaded before /import became synchronous). Without this the
  // <audio> element at AudioContext.jsx:258 doesn't mount and the play
  // button in the MonitorPortal is silently dead. Mirrors the banner
  // already shipped in StudySessionWorkspace.jsx:295.
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

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

  // Re-trigger /songs/:id/download-audio for a stuck song (publicUrl=null).
  // Reuses the synchronous endpoint added on 2026-06-21 — returns the
  // hydrated song with publicUrl set, which we then push into both the
  // audio context (so the <audio> element mounts) and useSong (so the
  // header / panel reflects the new state).
  const handleRedownloadAudio = useCallback(async () => {
    if (!songId || recovering) return;
    setRecovering(true);
    setRecoveryError('');
    try {
      const fresh = await backend.redownloadSongAudio(songId);
      const next = fresh?.song || fresh;
      if (next) {
        loadSong(next);
        refetchSong();
        flash('Audio re-downloaded');
      }
    } catch (err) {
      const data = err.response?.data;
      setRecoveryError(data?.message || err.message || 'Audio re-download failed');
    } finally {
      setRecovering(false);
    }
  }, [songId, recovering, backend, loadSong, refetchSong, flash]);

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

  // Parse user-created arrangement timeline sections for the timeline display
  const arrangementSections = useMemo(() => {
    const raw = responses['arrangement-timeline'];
    if (!raw) return [];
    try { return typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
    catch { return []; }
  }, [responses]);

  // Arrangement lens availability (gates the M key shortcut)
  const hasArrangementLens = useMemo(() => {
    if (!audit) return false;
    if (audit.lensSelection?.includes('arrangement')) return true;
    if (audit.templateQuestions?.lenses?.arrangement) return true;
    return false;
  }, [audit?.lensSelection, audit?.templateQuestions]);

  // ── Universal waveform regions ───────────────────────────────────────────
  // Built from three sources so the UniversalWaveformBar (always visible
  // above the tab bar) shows meaningful regions on EVERY lens + the analysis
  // tab:
  //   1. Arrangement sections (responses['arrangement-timeline']) — draggable
  //   2. Bookmarks (globalBookmarks) — colored by lens, point markers
  //   3. Tagged timestamps for the active lens (responses['lens-<lens>-<i>'])
  //      — only on the lens tab, so the user sees their tag pins for the
  //      lens they're currently working in.
  const waveformRegions = useMemo(() => {
    const regions = [];

    // (1) Arrangement sections
    arrangementSections.forEach((sec) => {
      regions.push({
        id: sec.id,
        start: sec.startTime || 0,
        end: (sec.startTime || 0) + Math.max(1, sec.duration || 30),
        color: SECTION_TYPE_COLORS[sec.type] || SECTION_TYPE_COLORS.custom,
        label: sec.name || '',
        drag: true,
        resize: true,
        selected: false,
      });
    });

    // (2) Bookmarks — point markers (2s span) colored by lens
    globalBookmarks.forEach((bm) => {
      const ts = Number(bm.timestampSeconds);
      if (!Number.isFinite(ts)) return;
      regions.push({
        id: `bm-${bm._id || bm.timestampSeconds}`,
        start: ts,
        end: ts + 2,
        color: LENS_REGION_COLOR[bm.lens] || 'rgba(255,102,0,0.5)',
        label: bm.label || '♪',
        drag: false,
        resize: false,
        selected: false,
      });
    });

    // (3) Tagged timestamps for the active lens (lens tab only)
    if (activeTab === 'lens') {
      const prompts = LENS_PROMPTS[activeLens] || [];
      prompts.forEach((_, i) => {
        const raw = responses[`lens-${activeLens}-${i}`];
        if (!raw) return;
        let ts = null;
        try {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          ts = parsed?.timestampSeconds;
        } catch { ts = null; }
        if (Number.isFinite(ts)) {
          regions.push({
            id: `tag-${activeLens}-${i}`,
            start: ts,
            end: ts + 2,
            color: LENS_REGION_COLOR[activeLens] || '#ff6600',
            label: `#${i + 1}`,
            drag: false,
            resize: false,
            selected: false,
          });
        }
      });
    }

    return regions;
  }, [arrangementSections, globalBookmarks, responses, activeLens, activeTab]);

  const handleWaveformRegionClick = useCallback((regionId) => {
    if (!regionId) return;
    if (regionId.startsWith('bm-')) {
      const bm = globalBookmarks.find(b => `bm-${b._id || b.timestampSeconds}` === regionId);
      if (bm) seekTo(Number(bm.timestampSeconds) || 0);
      return;
    }
    if (regionId.startsWith('tag-')) {
      const parts = regionId.split('-');
      const ts = Number(parts[parts.length - 1]);
      // tagged regions are named tag-<lens>-<index>; the index isn't a ts,
      // so look the ts up from responses
      const lens = parts[1];
      const idx = Number(parts[2]);
      const raw = responses[`lens-${lens}-${idx}`];
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Number.isFinite(parsed?.timestampSeconds)) seekTo(parsed.timestampSeconds);
      } catch { /* ignore */ }
      return;
    }
    // Arrangement section
    const sec = arrangementSections.find(s => s.id === regionId);
    if (sec) seekTo(sec.startTime || 0);
  }, [globalBookmarks, arrangementSections, responses, seekTo]);

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

  const handleUpdateSections = useCallback((newSections) => {
    handleResponseChange('arrangement-timeline', JSON.stringify(newSections));
  }, [handleResponseChange]);

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

  // ── Trigger Tavily cross-verification ────────────────────────────────────
  const handleVerifyAnalysis = useCallback(async () => {
    if (!songId) return;
    try {
      await verifyAnalysis();
      flash('✓ Tavily cross-verification completed');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to cross-verify analysis');
    }
  }, [songId, verifyAnalysis, flash]);

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

      {/* Recovery banner for stuck legacy songs (publicUrl=null) OR when the
          audio file is missing on disk (audioError set — the white-noise-then-
          silence case: publicUrl points at a file express.static 404s on, the
          browser decodes the HTML error page as audio → static burst → error).
          The MonitorPortal's play button is silently dead in both cases.
          Re-downloading via the synchronous /songs/:id/download-audio endpoint
          (added 2026-06-21) hydrates the song with a real publicUrl so
          playback works on every lens tab. Mirrors the StudySessionWorkspace
          banner. */}
      {song && (!song.publicUrl || audioError) && !recovering && (
        <div
          className="error"
          style={{
            margin: '8px 12px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span>
            {audioError
              ? (audioError.message || 'Audio file missing on the server.')
              : 'Audio file missing for this song — the original download didn\'t land. Playback is disabled until audio is re-downloaded.'}
          </span>
          <button
            type="button"
            onClick={handleRedownloadAudio}
            disabled={recovering}
            style={{ padding: '6px 14px', fontSize: '11px' }}
          >
            {recovering ? 'Re-downloading…' : 'Re-download audio'}
          </button>
        </div>
      )}
      {recoveryError && <div className="error" style={{ margin: '8px 12px 0' }}>{recoveryError}</div>}

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

      {/* Universal wavesurfer waveform + RegionsPlugin + TimelinePlugin
          (timeline2). Always visible above the tab bar so every lens
          (harmony / rhythm / texture / melody / form / arrangement) and
          the analysis tab share the same waveform, region pins, and
          transport. Regions adapt to the active context: arrangement
          sections + bookmarks always; tagged timestamps for the active
          lens when on the lens tab. */}
      <div style={{ padding: '8px 12px 0' }}>
        <UniversalWaveformBar
          regions={waveformRegions}
          onRegionClick={handleWaveformRegionClick}
          onRecover={songId ? handleRedownloadAudio : undefined}
          recovering={recovering}
          title={`${LENS_LABEL[activeLens] || 'HARMONY'} LENS · WAVEFORM`}
          paddingLeft={activeLens === 'texture' ? 55 : 0}
        />
      </div>

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
            activeLens={activeLens}
            isGuided={isGuided}
            currentStep={currentStep}
            stepIndex={stepIndex}
            totalSteps={audit.guidedSteps.length}
            fallbackNotice={audit.templateVersion?.startsWith('fallback')}
            currentTime={currentTime}
            duration={duration}
            globalBookmarks={globalBookmarks}
            arrangementSections={arrangementSections}
            onChangeOverride={handleAnalysisChangeOverride}
            onAddMarker={handleAddMarker}
            onUpdateMarker={handleUpdateMarker}
            onDeleteMarker={handleDeleteMarker}
            onAddSection={handleAddSection}
            onUpdateSections={handleUpdateSections}
            onSeek={seekTo}
            onBack={handleGoBackStep}
            onSkip={handleSkipStep}
            onAdvance={handleAdvanceStep}
            onComplete={saveAudit}
            onTriggerAnalysis={handleTriggerAnalysis}
            onVerifyAnalysis={handleVerifyAnalysis}
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
