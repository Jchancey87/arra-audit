import React from 'react';

const formatTimeShort = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const stripTopic = (name) => (name || '')
  .replace(/\s*-\s*Topic\s*$/i, '')
  .replace(/\s*\(Official.*?\)/gi, '')
  .replace(/\s*\[Official.*?\]/gi, '')
  .trim();

const AuditPanelHeader = ({
  song,
  audioContext,
  saveStatus = 'saved',
  isComplete = false,
  isSaving = false,
  completionReason = '',
  onComplete,
  onSaveDraft,
  onReturnToPlan,
}) => {
  const isAudioLinked = !!song;
  const isSynced = isAudioLinked && audioContext?.isPlaying;

  const meta = song ? {
    artist: stripTopic(song.artistName || song.artist || ''),
    year: song.year || song.releaseYear || null,
    duration: song.durationSeconds,
    key: song.audioAnalysis?.key || song.audioOverrides?.key || null,
    scale: song.audioAnalysis?.scale || song.audioOverrides?.scale || null,
    bpm: song.audioOverrides?.tempo_bpm || song.audioAnalysis?.tempo_bpm || null,
  } : null;

  return (
    <header
      role="banner"
      style={{
        background: 'var(--bg-surface-2)',
        padding: '20px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* Top row: title + sync + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'Inter, sans-serif',
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: 0,
              textTransform: 'none',
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {stripTopic(song?.title || 'Untitled Track')}
          </h1>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--text-secondary)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {meta?.artist || 'Unknown artist'}
            {song?.lensSelection?.[0] && (
              <span style={{ color: 'var(--text-tertiary)' }}> · {song.lensSelection[0]} Audit</span>
            )}
          </p>
        </div>

        {/* Sync status + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Sync indicator */}
          <div
            role="status"
            aria-label={isSynced ? 'Synchronized' : isAudioLinked ? 'Not playing' : 'Audio not linked'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontFamily: 'JetBrains Mono, monospace',
              color: isSynced ? 'var(--status-success)' : isAudioLinked ? 'var(--text-secondary)' : 'var(--status-warning)',
            }}
          >
            {isSynced ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Synchronized</span>
              </>
            ) : isAudioLinked ? (
              <>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-tertiary)' }} />
                <span>Linked · {audioContext?.isPlaying ? 'Playing' : 'Stopped'}</span>
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>Not synchronized</span>
              </>
            )}
          </div>

          {/* Save status pill */}
          {saveStatus && saveStatus !== 'saved' && (
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'JetBrains Mono, monospace',
                textTransform: 'uppercase',
                color: saveStatus === 'saving'
                  ? 'var(--text-secondary)'
                  : saveStatus === 'dirty'
                  ? 'var(--accent-primary)'
                  : 'var(--status-low)',
                letterSpacing: '0.06em',
              }}
            >
              {saveStatus === 'saving' ? 'Saving' : saveStatus === 'dirty' ? 'Unsaved' : 'Error'}
            </span>
          )}

          {/* Save Draft + Complete (column so warning can sit under them) */}
          {(onComplete || onSaveDraft) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onSaveDraft && (
                  <button
                    onClick={onSaveDraft}
                    disabled={isSaving}
                    className="ghost"
                    style={{ minWidth: '90px' }}
                    title="Save progress without completing the session"
                  >
                    {isSaving ? 'Saving…' : 'Save Draft'}
                  </button>
                )}
                {onComplete && (
                  <button
                    onClick={onComplete}
                    disabled={!isComplete || isSaving}
                    className={isComplete ? 'primary' : 'secondary'}
                    style={{ minWidth: '110px' }}
                    title={
                      !isComplete
                        ? completionReason || 'Answer at least 2 prompts or save a technique to complete'
                        : isSaving
                        ? 'Saving session…'
                        : 'Complete session'
                    }
                  >
                    {isSaving ? 'Saving…' : isComplete ? 'Complete ●' : 'Complete'}
                  </button>
                )}
              </div>
              {!isComplete && completionReason && (
                <span
                  role="status"
                  style={{
                    fontSize: '9px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--status-warning)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    maxWidth: '240px',
                    textAlign: 'right',
                    lineHeight: 1.3,
                  }}
                >
                  {completionReason}
                </span>
              )}
            </div>
          )}

          {/* Return to Plan button */}
          {onReturnToPlan && (
            <button onClick={onReturnToPlan} className="ghost" style={{ minWidth: '120px' }}>
              Return to Plan
            </button>
          )}
        </div>
      </div>

      {/* Metadata chips row */}
      {meta && (
        <div className="audit-meta-chips">
          {meta.year && <span>{meta.year}</span>}
          {meta.duration ? <span>{formatTimeShort(meta.duration)}</span> : null}
          {meta.key && (
            <span>
              {meta.key}
              {meta.scale === 'minor' ? ' minor' : ' major'}
            </span>
          )}
          {meta.bpm && <span>{Math.round(meta.bpm)} BPM</span>}
          {audioContext?.currentTime > 0 && (
            <span style={{ color: 'var(--accent-primary)' }}>
              ▸ {formatTimeShort(audioContext.currentTime)}
            </span>
          )}
        </div>
      )}
    </header>
  );
};

export default AuditPanelHeader;
