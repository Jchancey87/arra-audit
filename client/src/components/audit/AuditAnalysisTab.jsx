import React, { Suspense, lazy, useMemo } from 'react';
import { useAudio } from '../../context/AudioContext.jsx';
import { LENS_REGION_COLOR, SECTION_TYPE_COLORS } from './lensConstants';
import AnalysisPipelineStates from './AnalysisPipelineStates';
import GuidedStepBar from './GuidedStepBar';
import GuidedListenEmpty from './GuidedListenEmpty';
import FallbackTemplateNotice from './FallbackTemplateNotice';

const AuditTimeline = lazy(() => import('./AuditTimeline'));
const WaveformTimelineOverlay = lazy(() => import('../WaveformTimelineOverlay.jsx'));

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
 * Repaces the DAW timeline grid with wavesurfer.js spectrogram when
 * auditing under the Texture lens.
 */
const AuditAnalysisTab = ({
  song, audit, activeLens = 'harmony',
  isGuided, currentStep, stepIndex, totalSteps, fallbackNotice,
  currentTime, duration, globalBookmarks, arrangementSections,
  onChangeOverride, onAddMarker, onUpdateMarker, onDeleteMarker, onAddSection, onUpdateSections, onSeek,
  onBack, onSkip, onAdvance, onComplete, onTriggerAnalysis, onVerifyAnalysis,
  analysisProgress, analysisStage,
}) => {
  const { audioRef } = useAudio();

  const isTexture = activeLens === 'texture';

  const spectrogramRegions = useMemo(() => {
    if (!isTexture) return [];
    const regions = [];

    // (1) Arrangement sections
    (arrangementSections || []).forEach((sec) => {
      regions.push({
        id: sec.id,
        start: sec.startTime || 0,
        end: (sec.startTime || 0) + Math.max(1, sec.duration || 30),
        color: SECTION_TYPE_COLORS[sec.type] || SECTION_TYPE_COLORS.custom || '#f472b6',
        label: sec.name || '',
        drag: false,
        resize: false,
        selected: false,
      });
    });

    // (2) Bookmarks — point markers (2s span) colored by lens
    (globalBookmarks || []).forEach((bm) => {
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

    return regions;
  }, [arrangementSections, globalBookmarks, isTexture]);

  const handleRegionClick = (regionId) => {
    const reg = spectrogramRegions.find((r) => r.id === regionId);
    if (reg && onSeek) {
      onSeek(reg.start);
    }
  };

  return (
    <div className="audit-form-main">
      <AnalysisPipelineStates
        status={song?.audioAnalysisStatus}
        progress={analysisProgress}
        stage={analysisStage}
        onTrigger={onTriggerAnalysis}
      />

      {song?.audioAnalysisStatus === 'success' && song.audioAnalysis && (
        <>
          {isTexture ? (
            <div style={{ padding: '0 12px 16px 12px' }}>
              <div style={{
                background: '#0c0c0f',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
                padding: '12px',
              }}>
                <div style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.35)',
                  fontFamily: '"Roboto Mono", monospace',
                  letterSpacing: '0.06em',
                  marginBottom: '10px',
                  textTransform: 'uppercase',
                }}>
                  ▨ Texture Spectrogram Analysis (Frequency over Time)
                </div>
                {audioRef?.current ? (
                  <Suspense fallback={<TabLoadingPanel label="Loading spectrogram…" />}>
                    <WaveformTimelineOverlay
                      audioRef={audioRef}
                      regions={spectrogramRegions}
                      pxPerSec={8}
                      currentTime={currentTime}
                      onRegionClick={handleRegionClick}
                      waveHeight={240}
                      showTimeline={true}
                      spectrogram={true}
                    />
                  </Suspense>
                ) : (
                  <div style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: 'var(--text-tertiary)',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '11px',
                  }}>
                    Spectrogram unavailable (Audio context missing)
                  </div>
                )}
              </div>
            </div>
          ) : (
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
          )}

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
};

export default AuditAnalysisTab;
