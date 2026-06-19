import React, { useState, useEffect, useRef } from 'react';
import { useBackend } from '../../context/BackendContext';

const LENS_OPTIONS = [
  { value: 'harmony', label: 'Harmony' },
  { value: 'rhythm', label: 'Rhythm' },
  { value: 'form', label: 'Form' },
  { value: 'texture', label: 'Texture' },
  { value: 'melody', label: 'Melody' },
];

const formatTimeForInput = (seconds) => {
  if (!seconds || isNaN(seconds)) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const CaptureTechnique = ({
  initialLens = 'harmony',
  currentTime = 0,
  onSubmit,
  onDiscard,
  savedIndicator = false,
  onLocalError,
}) => {
  const backend = useBackend();
  const [collapsed, setCollapsed] = useState(false);
  const [lens, setLens] = useState(initialLens);
  const [name, setName] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [howReuse, setHowReuse] = useState('');
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [localError, setLocalError] = useState('');
  const lastSavedRef = useRef(false);

  // Sync lens when session lens changes
  useEffect(() => {
    setLens(initialLens);
  }, [initialLens]);

  // Show "Saved" indicator briefly after save
  useEffect(() => {
    if (savedIndicator && !lastSavedRef.current) {
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(t);
    }
    lastSavedRef.current = savedIndicator;
  }, [savedIndicator]);

  // Fetch 5 most recent tags from the user's notebook (Phase 2.5 §3.5.1)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await backend.getTechniques({ sortBy: 'createdAt', order: 'desc', limit: 50 });
        const techs = res?.techniques || res || [];
        const seen = new Set();
        const ordered = [];
        for (const t of techs) {
          const ts = Array.isArray(t.tags) ? t.tags : [];
          for (const raw of ts) {
            const tag = String(raw || '').trim().toLowerCase();
            if (tag && !seen.has(tag)) {
              seen.add(tag);
              ordered.push(tag);
              if (ordered.length >= 5) break;
            }
          }
          if (ordered.length >= 5) break;
        }
        if (!cancelled) setTagSuggestions(ordered);
      } catch {
        // Non-fatal — keep empty suggestions.
      }
    })();
    return () => { cancelled = true; };
  }, [backend, savedIndicator]);

  const stampFromPlayhead = () => {
    setTimestamp(formatTimeForInput(currentTime));
  };

  const addTag = (raw) => {
    const cleaned = String(raw || '').trim().replace(/,$/, '').toLowerCase();
    if (cleaned && !tags.includes(cleaned) && tags.length < 12) {
      setTags([...tags, cleaned]);
    }
    setTagInput('');
  };

  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  const handleTagKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const reset = () => {
    setName('');
    setTimestamp('');
    setTags([]);
    setTagInput('');
    setWhatHappened('');
    setHowReuse('');
    setLocalError('');
  };

  const isDirty = !!(name || whatHappened || howReuse || tags.length || timestamp);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    if (!name.trim()) return;
    setLocalError('');
    try {
      if (onSubmit) {
        await onSubmit({ lens, name: name.trim(), timestamp, tags, whatHappened, howReuse });
      }
      reset();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save technique';
      setLocalError(msg);
      if (onLocalError) onLocalError(msg);
    }
  };

  const handleDiscardClick = () => {
    if (!isDirty) {
      reset();
      return;
    }
    if (confirmingDiscard) {
      reset();
      setConfirmingDiscard(false);
      if (onDiscard) onDiscard();
    } else {
      setConfirmingDiscard(true);
      setTimeout(() => setConfirmingDiscard(false), 4000);
    }
  };

  // Phase 2.5 §3.5.4/5: Ctrl+Enter saves, Escape confirms discard
  const handleFormKeyDown = (e) => {
    if (e.key === 'Escape' && isDirty && !confirmingDiscard) {
      e.preventDefault();
      setConfirmingDiscard(true);
      setTimeout(() => setConfirmingDiscard(false), 4000);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (canSave) handleSave(e);
    }
  };

  const canSave = name.trim().length > 0;

  if (collapsed) {
    return (
      <footer
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          background: 'var(--bg-surface-2)',
          borderTop: '1px solid var(--border-subtle)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          Capture Technique
        </h2>
        <button
          onClick={() => setCollapsed(false)}
          className="ghost"
          style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
          aria-label="Expand capture technique panel"
        >
          ▲
        </button>
      </footer>
    );
  }

  return (
    <footer
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        background: 'var(--bg-surface-2)',
        borderTop: '1px solid var(--border-subtle)',
        padding: '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
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
          Capture Technique
        </h2>
        <button
          onClick={() => setCollapsed(true)}
          className="ghost"
          style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}
          aria-label="Collapse capture technique panel"
          title="Collapse"
        >
          ▼
        </button>
      </div>

      <form onSubmit={handleSave} onKeyDown={handleFormKeyDown}>
        {/* Top row: Lens + Name + Timestamp */}
        <div
          className="capture-top-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 1fr 100px auto',
            gap: '10px',
            marginBottom: '10px',
            alignItems: 'end',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="capture-lens">Lens</label>
            <select
              id="capture-lens"
              value={lens}
              onChange={(e) => setLens(e.target.value)}
            >
              {LENS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="capture-name">Name</label>
            <input
              id="capture-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ghost Note Pocket"
              autoComplete="off"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="capture-timestamp">Timestamp</label>
            <input
              id="capture-timestamp"
              type="text"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              placeholder="0:00"
              style={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
          </div>

          <button
            type="button"
            onClick={stampFromPlayhead}
            className="ghost"
            style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
            title="Fill with current transport position"
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
            Use Playhead
          </button>
        </div>

        {/* Tags row */}
        <div className="form-group" style={{ margin: '0 0 10px 0' }}>
          <label htmlFor="capture-tag-input">Tags</label>
          {tagSuggestions.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px',
                alignItems: 'center',
                marginBottom: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginRight: '2px',
                }}
              >
                Recent:
              </span>
              {tagSuggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
                  disabled={tags.includes(s)}
                  className="ghost"
                  title={tags.includes(s) ? `${s} already added` : `Click to add this tag: ${s}`}
                  style={{
                    fontSize: '9px',
                    fontFamily: 'JetBrains Mono, monospace',
                    padding: '2px 6px',
                    color: tags.includes(s) ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                    textTransform: 'lowercase',
                    opacity: tags.includes(s) ? 0.5 : 1,
                    cursor: tags.includes(s) ? 'default' : 'pointer',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              alignItems: 'center',
              background: 'var(--bg-surface-3)',
              padding: '4px 6px',
              minHeight: '32px',
            }}
          >
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  background: 'var(--bg-surface-1)',
                  color: 'var(--text-primary)',
                  fontSize: '10px',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '2px 6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  textTransform: 'lowercase',
                }}
              >
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  aria-label={`Remove tag ${t}`}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '12px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="capture-tag-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKey}
              onBlur={() => tagInput && addTag(tagInput)}
              placeholder={tags.length === 0 ? 'chord-motion, tension (Enter to add)' : '+ Add tag'}
              style={{
                flex: 1,
                minWidth: '120px',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                padding: '2px 4px',
                fontSize: '11px',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>

        {/* Textareas row */}
        <div className="capture-textareas" style={{ display: 'grid', gap: '10px', marginBottom: '12px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="capture-what">What happened?</label>
            <textarea
              id="capture-what"
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value)}
              placeholder="Describe the technique you noticed…"
              style={{ minHeight: '60px' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="capture-how">How would you reuse this?</label>
            <textarea
              id="capture-how"
              value={howReuse}
              onChange={(e) => setHowReuse(e.target.value)}
              placeholder="Where and how would you apply this in your own work…"
              style={{ minHeight: '60px' }}
            />
          </div>
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
          {showSaved && (
            <span
              role="status"
              style={{
                fontSize: '11px',
                color: 'var(--status-success)',
                fontFamily: 'JetBrains Mono, monospace',
                marginRight: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Saved
            </span>
          )}
          <button
            type="button"
            onClick={handleDiscardClick}
            className="ghost"
            style={{
              fontSize: '11px',
              color: confirmingDiscard ? 'var(--status-warning)' : 'var(--text-tertiary)',
            }}
          >
            {confirmingDiscard ? 'Are you sure?' : 'Discard'}
          </button>
          <button type="submit" className="primary" disabled={!canSave} style={{ minWidth: '140px' }}>
            Save to Notebook
          </button>
        </div>

        {/* Form-level error (Phase 2.5 §3.5.3) */}
        {localError && (
          <div
            role="alert"
            style={{
              marginTop: '8px',
              padding: '6px 10px',
              background: 'rgba(255, 82, 82, 0.1)',
              border: '1px solid var(--color-error)',
              color: 'var(--color-error)',
              fontSize: '11px',
              fontFamily: 'JetBrains Mono, monospace',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>{localError}</span>
            <button
              type="button"
              onClick={() => setLocalError('')}
              className="ghost"
              aria-label="Dismiss error"
              style={{ fontSize: '11px', padding: '0 6px', color: 'var(--color-error)' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Keyboard shortcut hint */}
        <div
          style={{
            marginTop: '6px',
            fontSize: '9px',
            color: 'var(--text-tertiary)',
            fontFamily: 'JetBrains Mono, monospace',
            textAlign: 'right',
          }}
        >
          Ctrl+Enter to save · Esc to discard
        </div>
      </form>
    </footer>
  );
};

export default CaptureTechnique;
