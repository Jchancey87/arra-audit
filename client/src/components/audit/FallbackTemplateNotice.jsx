import React from 'react';

/**
 * FallbackTemplateNotice - Warning banner shown when an audit is using the
 * static fallback template (no AI generation).
 */
const FallbackTemplateNotice = () => (
  <div style={{ background: 'var(--status-warning-muted)', color: 'var(--status-warning)', padding: '10px 12px', marginTop: '16px', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
    Using standard reference template — custom sonic synthesis unavailable.
  </div>
);

export default FallbackTemplateNotice;
