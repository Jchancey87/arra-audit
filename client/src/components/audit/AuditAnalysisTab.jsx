import React, { Suspense, lazy } from 'react';
import AnalysisPipelineStates from './AnalysisPipelineStates';
import GuidedStepBar from './GuidedStepBar';
import GuidedListenEmpty from './GuidedListenEmpty';
import FallbackTemplateNotice from './FallbackTemplateNotice';
const AuditTimeline = lazy(() => import('./AuditTimeline'));

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

/**
 * AuditAnalysisTab - Body of the Analysis tab in the audit form.
 * Encapsulates the analysis pipeline states, success-state modules,
 * guided workflow controls, and the Step 1 (Listen) empty state.
 *
 * Props:
 *   song, audit: data
 *   isGuided, currentStep, stepIndex, totalSteps, fallbackNotice
 *   currentTime, duration, globalBookmarks
 *   onChangeOverride, onAddMarker, onUpdateMarker, onDeleteMarker, onAddSection, onSeek
 *   onBack, onSkip, onAdvance, onComplete, onTriggerAnalysis
 *   analysisProgress, analysisStage
 */
const AuditAnalysisTab = ({
  song, audit,
  isGuided, currentStep, stepIndex, totalSteps, fallbackNotice,
  currentTime, duration, globalBookmarks, arrangementSections,
  onChangeOverride, onAddMarker, onUpdateMarker, onDeleteMarker, onAddSection, onUpdateSections, onSeek,
  onBack, onSkip, onAdvance, onComplete, onTriggerAnalysis, onVerifyAnalysis,
  analysisProgress, analysisStage,
}) => (
  <div className="audit-form-main">
    <AnalysisPipelineStates
      status={song?.audioAnalysisStatus}
      progress={analysisProgress}
      stage={analysisStage}
      onTrigger={onTriggerAnalysis}
    />

    {song?.audioAnalysisStatus === 'success' && song.audioAnalysis && (
      <>
        <Suspense fallback={<TabLoadingPanel label="Loading timeline…" />}>
          <AuditTimeline
            song={song}
            currentTime={currentTime}
            duration={duration || song.durationSeconds || 0}
            onSeek={onSeek}
            onAddMarker={onAddMarker}
            onUpdateMarker={onUpdateMarker}
            onDeleteMarker={onDeleteMarker}
            onAddSection={onAddSection}
            onUpdateSections={onUpdateSections}
            markers={globalBookmarks}
            arrangementSections={arrangementSections || []}
          />
        </Suspense>
        {fallbackNotice && <FallbackTemplateNotice />}

        {isGuided && (
          <GuidedStepBar
            currentStep={currentStep}
            stepIndex={stepIndex}
            totalSteps={totalSteps}
            onBack={onBack}
            onSkip={onSkip}
            onAdvance={onAdvance}
            onComplete={onComplete}
          />
        )}
      </>
    )}

    {isGuided && currentStep?.name === 'Listen' && (
      <GuidedListenEmpty onAdvance={onAdvance} />
    )}
  </div>
);

export default AuditAnalysisTab;
