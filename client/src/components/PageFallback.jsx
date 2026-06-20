import React from 'react';

const PageFallback = () => (
  <div
    role="status"
    aria-live="polite"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '200px',
      width: '100%',
      padding: '40px 20px',
    }}
  >
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        fontFamily: 'Roboto Mono, monospace',
        color: 'rgba(255, 102, 0, 0.7)',
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}
    >
      <div
        style={{
          width: '24px',
          height: '24px',
          border: '2px solid rgba(255, 102, 0, 0.2)',
          borderTopColor: '#ff6600',
          borderRadius: '50%',
          animation: 'arra-page-fallback-spin 0.8s linear infinite',
        }}
      />
      <span>Loading…</span>
      <style>{`@keyframes arra-page-fallback-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

export default PageFallback;
