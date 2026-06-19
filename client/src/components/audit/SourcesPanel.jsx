import React from 'react';

const SOURCE_DOT_COLORS = {
  YouTube: '#ff0033',
  Genius: '#ffff64',
  Wikipedia: '#a0a0a0',
  MusicBrainz: '#ba478f',
  WhoSampled: '#ff6a00',
  Discogs: '#333333',
  default: 'var(--text-secondary)',
};

const getDomain = (url) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace('www.', '').split('.')[0];
  } catch {
    return null;
  }
};

const SourcesPanel = ({ sources = [] }) => {
  return (
    <section role="region" aria-label="Linked research sources" style={{ padding: '16px' }}>
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
          Linked Sources ({sources.length})
        </h2>
        <button className="ghost" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
          + Add Source
        </button>
      </div>

      {sources.length === 0 ? (
        <div
          style={{
            color: 'var(--text-tertiary)',
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
            padding: '24px 0',
            textAlign: 'center',
          }}
        >
          No sources linked yet.
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {sources.map((s, i) => {
            const dotColor = SOURCE_DOT_COLORS[s.source] || SOURCE_DOT_COLORS[getDomain(s.url)] || SOURCE_DOT_COLORS.default;
            return (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  height: '36px',
                  padding: '0 14px',
                  color: 'var(--text-primary)',
                  borderBottom: i < sources.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: dotColor,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'JetBrains Mono, monospace',
                    minWidth: '90px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {s.source || getDomain(s.url) || 'Source'}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--text-primary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={s.title}
                >
                  {s.title || s.content?.slice(0, 80) || '(untitled)'}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>↗</span>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default SourcesPanel;
