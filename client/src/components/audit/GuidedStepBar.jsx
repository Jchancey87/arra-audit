import React from 'react';

/**
 * GuidedStepBar - Bottom-of-analysis guided workflow controls.
 *
 * Props:
 *   currentStep: the active guided step doc (or null if not guided)
 *   stepIndex: 0-based index of the active step
 *   totalSteps: total number of guided steps
 *   onBack: () => void
 *   onSkip: () => void
 *   onAdvance: () => void
 *   onComplete: () => void
 */
const GuidedStepBar = ({ currentStep, stepIndex, totalSteps, onBack, onSkip, onAdvance, onComplete }) => {
  if (!currentStep) return null;
  return (
    <>
      {currentStep.name !== 'Listen' && (
        <div style={{ background: 'var(--bg-surface-2)', borderLeft: '3px solid var(--accent-primary)', padding: '12px 16px', marginTop: '20px' }}>
          <h3 style={{ margin: '0 0 6px 0', color: 'var(--accent-primary)', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Step {String(currentStep.stepNumber).padStart(2, '0')} // {currentStep.name}
          </h3>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {currentStep.instructions}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', gap: '8px' }}>
        {stepIndex > 0 && (
          <button onClick={onBack} className="secondary">← Back</button>
        )}
        <div style={{ flex: 1 }} />
        {stepIndex < totalSteps - 1 ? (
          <>
            <button onClick={onSkip} className="ghost">Skip</button>
            <button onClick={onAdvance} className="primary">Next Step →</button>
          </>
        ) : (
          <button onClick={onComplete} className="primary">✓ Complete Audit</button>
        )}
      </div>
    </>
  );
};

export default GuidedStepBar;
