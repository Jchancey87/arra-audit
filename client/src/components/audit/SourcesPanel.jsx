import React, { useState, useMemo } from 'react';

const SOURCE_DOT_COLORS = {
  youtube: '#ff0033',
  'youtube.com': '#ff0033',
  'youtu.be': '#ff0033',
  genius: '#ffff64',
  'genius.com': '#ffff64',
  wikipedia: '#a0a0a0',
  'wikipedia.org': '#a0a0a0',
  musicbrainz: '#ba478f',
  'musicbrainz.org': '#ba478f',
  whosampled: '#ff6a00',
  'whosampled.com': '#ff6a00',
  discogs: '#9a9a9a',
  'discogs.com': '#9a9a9a',
  allmusic: '#3b6db5',
  'allmusic.com': '#3b66db5',
  default: 'var(--text-secondary)',
};

const VIDEO_HOSTNAMES = new Set([
  'youtube', 'youtu', 'vimeo', 'dailymotion',
]);

const getHostname = (url) => {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace('www.', '').toLowerCase();
  } catch {
    return null;
  }
};

const getDomainRoot = (url) => {
  const host = getHostname(url);
  if (!host) return null;
  return host.split('.')[0] || null;
};

const pickDotColor = (source, url) => {
  if (source) {
    const key = String(source).toLowerCase().trim();
    if (SOURCE_DOT_COLORS[key]) return SOURCE_DOT_COLORS[key];
  }
  const host = getHostname(url);
  if (host && SOURCE_DOT_COLORS[host]) return SOURCE_DOT_COLORS[host];
  const root = getDomainRoot(url);
  if (root && SOURCE_DOT_COLORS[root]) return SOURCE_DOT_COLORS[root];
  return SOURCE_DOT_COLORS.default;
};

const isVideoUrl = (url) => {
  const root = getDomainRoot(url);
  return root && VIDEO_HOSTNAMES.has(root);
};

const SourcesPanel = ({ sources = [], onAddSource, onReimportResearch }) => {
  const [toast, setToast] = useState(null);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = () => {
    if (onAddSource) {
      onAddSource();
    } else {
      showToast('Manual source addition coming in Phase 3');
    }
  };

  const handleReimport = () => {
    if (onReimportResearch) {
      onReimportResearch();
    } else {
      showToast('Re-import coming in Phase 3');
    }
  };

  const validSources = useMemo(
    () => (sources || []).filter((s) => s && s.url && (() => { try { new URL(s.url); return true; } catch { return false; } })()),
    [sources]
  );
  const invalidCount = (sources || []).length - validSources.length;

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
          Linked Sources ({validSources.length})
        </h2>
        <button
          onClick={handleAdd}
          className="ghost"
          title="Add a research source URL"
          style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}
        >
          + Add Source
        </button>
      </div>

      {toast && (
        <div
          role="status"
          style={{
            background: 'var(--accent-primary-bg)',
            color: 'var(--accent-primary)',
            padding: '8px 12px',
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
            marginBottom: '12px',
            border: '1px solid var(--accent-primary-muted)',
          }}
        >
          {toast}
        </div>
      )}

      {validSources.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '11px',
              fontFamily: 'JetBrains Mono, monospace',
              margin: '0 0 12px 0',
              lineHeight: 1.5,
            }}
          >
            No sources linked yet.
            <br />
            {sources.length === 0
              ? 'Re-import research to pull in references for this song.'
              : `${invalidCount} source${invalidCount === 1 ? '' : 's'} had malformed URLs and were skipped.`}
          </p>
          <button
            onClick={handleReimport}
            className="ghost"
            title="Re-run research and reload sources for this song"
            style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}
          >
            Import research on this song
          </button>
        </div>
      ) : (
        <div
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {validSources.map((s, i) => {
            const dotColor = pickDotColor(s.source, s.url);
            const video = isVideoUrl(s.url);
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
                  borderBottom: i < validSources.length - 1 ? '1px solid var(--border-subtle)' : 'none',
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
                  {s.source || getDomainRoot(s.url) || 'Source'}
                  {video && s.source && !/video/i.test(s.source) ? ' · video' : ''}
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

      {invalidCount > 0 && validSources.length > 0 && (
        <p
          style={{
            marginTop: '8px',
            fontSize: '10px',
            color: 'var(--text-tertiary)',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          {invalidCount} source{invalidCount === 1 ? '' : 's'} skipped (malformed URL).
        </p>
      )}
    </section>
  );
};

export default SourcesPanel;
