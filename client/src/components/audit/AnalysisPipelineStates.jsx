import React from 'react';

/**
 * AnalysisPipelineStates - Pre-analysis / pending / failed UI for the analysis tab.
 *
 * Props:
 *   status: 'not_started' | 'pending' | 'failed' | 'success' | string
 *   progress: number (0-100)
 *   stage: string (current stage label)
 *   onTrigger: () => void
 */
const AnalysisPipelineStates = ({ status, progress, stage, onTrigger }) => {
  if (status === 'not_started') {
    return (
      <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 12px 0' }}>
          Audio signal extraction has not been executed yet. Discover the BPM, key signature, meter, and temporal dynamics.
        </p>
        <button onClick={onTrigger} className="primary">
          Execute Audio Signal Extraction
        </button>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'inline-block', width: '20px', height: '20px', border: '2px solid var(--accent-primary-bg)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '10px' }} />
        <p style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Extracting Harmonic &amp; Rhythmic Codes ({progress}%)
        </p>
        <div style={{ width: '80%', maxWidth: '380px', height: '4px', background: 'var(--bg-surface-3)', margin: '0 auto 10px', overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-primary)', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>
        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace', margin: 0, textTransform: 'uppercase' }}>
          {stage}
        </p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div style={{ background: 'var(--bg-surface-2)', border: '1px solid var(--border-subtle)', padding: '20px', textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ color: 'var(--status-low)', fontSize: '12px', margin: '0 0 10px 0' }}>
          Signal extraction pipeline reported an error.
        </p>
        <button onClick={onTrigger} className="danger">
          Re-run Pipeline
        </button>
      </div>
    );
  }

  return null;
};

export default AnalysisPipelineStates;
