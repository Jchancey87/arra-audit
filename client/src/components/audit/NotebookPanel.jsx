import React, { useMemo, useState } from 'react';

const LENS_LABEL = {
  harmony: 'Harmony',
  rhythm: 'Rhythm',
  form: 'Form',
  texture: 'Texture',
  melody: 'Melody',
  arrangement: 'Arrangement',
};

const SORT_MODES = [
  { id: 'date-desc', label: 'Newest First' },
  { id: 'date-asc', label: 'Oldest First' },
  { id: 'lens', label: 'By Lens' },
];

const formatTime = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    const s = Math.floor(raw);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  const m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return `${m[1]}:${m[2].padStart(2, '0')}`;
  return s;
};

const parseTimestamp = (raw) => {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
};

const getTimestamp = (tech) => {
  const a = parseTimestamp(tech?.timestamp);
  if (a != null) return a;
  if (Number.isFinite(tech?.exampleTimestamp) && tech.exampleTimestamp >= 0) {
    return Math.floor(tech.exampleTimestamp);
  }
  return null;
};

const lensLabel = (key) => {
  if (!key) return '—';
  return LENS_LABEL[key] || (key.charAt(0).toUpperCase() + key.slice(1));
};

const previewText = (text, max = 140) => {
  if (!text) return '';
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trim()}…` : flat;
};

const formatDate = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
};

const NotebookPanel = ({
  techniques = [],
  loading = false,
  error = '',
  onDelete,
  onSeek,
  onOpenNotebook,
}) => {
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState('date-desc');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = Array.isArray(techniques) ? techniques : [];
    if (q) {
      list = list.filter((t) => {
        const haystack = [
          t.techniqueName,
          t.description,
          t.notes,
          t.lens,
          lensLabel(t.lens),
          Array.isArray(t.tags) ? t.tags.join(' ') : t.tags,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    }
    const sorted = [...list];
    if (sortMode === 'date-asc') {
      sorted.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (sortMode === 'lens') {
      sorted.sort((a, b) => {
        const la = (a.lens || '').localeCompare(b.lens || '');
        if (la !== 0) return la;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } else {
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return sorted;
  }, [techniques, query, sortMode]);

  const handleDeleteClick = (id) => {
    if (confirmDeleteId === id) {
      if (onDelete) onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  const handleDeleteCancel = () => setConfirmDeleteId(null);

  return (
    <section style={{ padding: '16px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div>
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
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-tertiary)',
            }}
          >
            {loading
              ? 'Loading…'
              : `${techniques.length} technique${techniques.length === 1 ? '' : 's'} logged`}
            {query && filtered.length !== techniques.length && !loading
              ? ` · ${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
              : ''}
          </p>
        </div>
        {onOpenNotebook && (
          <button onClick={onOpenNotebook} className="ghost" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
            Open Full Notebook →
          </button>
        )}
      </div>

      {/* Controls row */}
      <div
        role="search"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          alignItems: 'center',
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this song's techniques…"
          aria-label="Search techniques"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--bg-surface-3)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '6px 10px',
            fontSize: '11px',
            fontFamily: 'Inter, sans-serif',
          }}
        />
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value)}
          aria-label="Sort techniques"
          style={{
            background: 'var(--bg-surface-3)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '6px 8px',
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
        >
          {SORT_MODES.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: 'var(--status-warning-muted)',
            color: 'var(--status-warning)',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '11px',
            fontFamily: 'JetBrains Mono, monospace',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
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
          Loading notebook…
        </div>
      ) : techniques.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-subtle)',
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            lineHeight: 1.5,
          }}
        >
          No techniques logged for this song yet.
          <br />
          Use the Capture Technique panel below to log your first observation.
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-subtle)',
            padding: '20px',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
          }}
        >
          No techniques match "{query}".
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '8px' }}>
          {filtered.map((tech) => {
            const ts = getTimestamp(tech);
            const isConfirming = confirmDeleteId === tech._id;
            return (
              <div
                key={tech._id}
                style={{
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-subtle)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                    <strong
                      style={{
                        fontSize: '12px',
                        color: 'var(--accent-primary)',
                        fontFamily: 'JetBrains Mono, monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tech.techniqueName || 'Untitled'}
                    </strong>
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: 'JetBrains Mono, monospace',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: 'var(--accent-primary-bg)',
                        color: 'var(--accent-primary)',
                        padding: '2px 6px',
                        flexShrink: 0,
                      }}
                    >
                      {lensLabel(tech.lens)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {ts != null && (
                      <button
                        onClick={() => onSeek && onSeek(ts)}
                        title="Seek to timestamp"
                        style={{
                          background: 'var(--bg-surface-3)',
                          color: 'var(--accent-primary)',
                          fontSize: '10px',
                          fontFamily: 'JetBrains Mono, monospace',
                          padding: '2px 8px',
                          border: '1px solid var(--border-subtle)',
                          cursor: onSeek ? 'pointer' : 'default',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ width: '4px', height: '4px', background: 'var(--accent-primary)', display: 'inline-block' }} />
                        {formatTime(ts)}
                      </button>
                    )}
                    {onDelete && (
                      isConfirming ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => handleDeleteClick(tech._id)}
                            className="danger"
                            style={{ fontSize: '9px', padding: '2px 6px' }}
                            title="Confirm delete"
                          >
                            Delete
                          </button>
                          <button
                            onClick={handleDeleteCancel}
                            className="ghost"
                            style={{ fontSize: '9px', padding: '2px 6px' }}
                            title="Cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteClick(tech._id)}
                          className="ghost"
                          style={{ fontSize: '10px', padding: '2px 8px' }}
                          title="Delete technique"
                          aria-label={`Delete technique ${tech.techniqueName || ''}`.trim()}
                        >
                          ×
                        </button>
                      )
                    )}
                  </div>
                </div>

                {tech.description && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {previewText(tech.description)}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    fontSize: '9px',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    flexWrap: 'wrap',
                  }}
                >
                  {tech.createdAt && <span>Logged {formatDate(tech.createdAt)}</span>}
                  {Array.isArray(tech.tags) && tech.tags.length > 0 && (
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {tech.tags.map((t) => `#${t}`).join(' ')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default NotebookPanel;
