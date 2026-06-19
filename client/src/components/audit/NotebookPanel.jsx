import React from 'react';

const NotebookPanel = ({ songId, onOpenNotebook }) => {
  return (
    <section style={{ padding: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '13px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
          }}
        >
          Notebook (this song)
        </h2>
        {onOpenNotebook && (
          <button onClick={onOpenNotebook} className="ghost" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
            Open Full Notebook →
          </button>
        )}
      </div>

      <div
        style={{
          background: 'var(--bg-surface-2)',
          border: '1px solid var(--border-subtle)',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
        }}
      >
        Notebook tab full design — ARRA-014
        <br />
        For now, use the Capture Technique panel below to log observations.
      </div>
    </section>
  );
};

export default NotebookPanel;
