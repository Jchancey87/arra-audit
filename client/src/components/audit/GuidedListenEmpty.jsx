import React from 'react';

/**
 * GuidedListenEmpty - Empty state shown on Step 1 (Listen) of a guided audit.
 * Renders the headphone icon, prompt text, and "Next Step" button.
 */
const GuidedListenEmpty = ({ onAdvance }) => (
  <div style={{ textAlign: 'center', padding: '40px 16px' }}>
    <div style={{ color: 'var(--accent-primary)', marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
      </svg>
    </div>
    <p style={{ fontSize: '13px', maxWidth: '500px', margin: '0 auto 20px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
      Full audit focus. Experience the signal spectrum from start to finish.
    </p>
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--accent-primary-bg)', padding: '10px 20px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      Press <strong>Play</strong> in the Tape Deck below or click the video monitor
    </div>
    <div style={{ marginTop: '20px' }}>
      <button onClick={onAdvance} className="primary">Next Step →</button>
    </div>
  </div>
);

export default GuidedListenEmpty;
