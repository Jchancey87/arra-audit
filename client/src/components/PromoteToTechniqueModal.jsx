import React, { useEffect, useState } from 'react';

const LENSES = [
  { key: 'rhythm',      label: 'Rhythm',      color: '#f97316' },
  { key: 'texture',     label: 'Texture',     color: '#14b8a6' },
  { key: 'harmony',     label: 'Harmony',     color: '#8b5cf6' },
  { key: 'arrangement', label: 'Arrangement', color: '#ec4899' },
];

const PromoteToTechniqueModal = ({
  isOpen,
  onClose,
  sentence,
  song,
  initialLens = 'arrangement',
  lensSource = 'heuristic',
  onPromote,
}) => {
  const [description, setDescription] = useState('');
  const [lens, setLens] = useState(initialLens);
  const [confidence, setConfidence] = useState(3);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setDescription(sentence || '');
      setLens(initialLens || 'arrangement');
      setConfidence(3);
      setTags('');
      setNotes('');
      setIsSaving(false);
      setError(null);
    }
  }, [isOpen, sentence, initialLens]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!description.trim()) {
      setError('Sentence text is required.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const tagsArray = tags
        ? tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
        : undefined;
      const created = await onPromote?.({
        description: description.trim(),
        lens,
        confidence,
        tags: tagsArray,
        notes: notes.trim() || undefined,
      });
      setIsSaving(false);
      if (created) onClose?.();
    } catch (err) {
      setIsSaving(false);
      setError(err?.message || 'Could not promote sentence.');
    }
  };

  const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.72)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  };

  const panelStyle = {
    background: '#1a1a1c',
    border: '1px solid rgba(255, 102, 0, 0.4)',
    borderRadius: '6px',
    width: '100%',
    maxWidth: '560px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '20px',
    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
    fontFamily: 'Roboto Mono, monospace',
    color: '#e5e5e5',
  };

  return (
    <div
      data-testid="promote-modal-backdrop"
      style={backdropStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <form onSubmit={handleSubmit} style={panelStyle} data-testid="promote-modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <h2 style={{ margin: 0, fontSize: '13px', color: '#ff6600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Promote to Technique
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {song && (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
            From: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{song.title || song.name || 'song'}</span>
            {song.artist && <> · <span style={{ color: 'rgba(255,255,255,0.6)' }}>{song.artist}</span></>}
          </div>
        )}

        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Sentence
        </label>
        <textarea
          data-testid="promote-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            background: '#0c0c0e',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e5e5e5',
            fontFamily: 'inherit',
            fontSize: '12px',
            padding: '8px 10px',
            borderRadius: '3px',
            resize: 'vertical',
            boxSizing: 'border-box',
            marginBottom: '14px',
          }}
        />

        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Lens
          {lensSource === 'heuristic' && (
            <span style={{ marginLeft: '6px', color: '#ff6600', opacity: 0.7, textTransform: 'none' }}>(guessed)</span>
          )}
        </label>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }} data-testid="promote-lens-row">
          {LENSES.map((l) => {
            const active = lens === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLens(l.key)}
                data-testid={`promote-lens-${l.key}`}
                style={{
                  flex: 1,
                  background: active ? l.color : 'transparent',
                  border: `1px solid ${active ? l.color : 'rgba(255,255,255,0.12)'}`,
                  color: active ? '#0c0c0e' : 'rgba(255,255,255,0.7)',
                  fontFamily: 'inherit',
                  fontSize: '11px',
                  padding: '6px 4px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontWeight: active ? 'bold' : 'normal',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>

        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Confidence: {confidence}
        </label>
        <input
          type="range"
          min="1"
          max="5"
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          data-testid="promote-confidence"
          style={{ width: '100%', marginBottom: '14px', accentColor: '#ff6600' }}
        />

        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Tags <span style={{ textTransform: 'none', opacity: 0.6 }}>(comma-separated)</span>
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g. sidechain, 808, low-pass"
          data-testid="promote-tags"
          style={{
            width: '100%',
            background: '#0c0c0e',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e5e5e5',
            fontFamily: 'inherit',
            fontSize: '12px',
            padding: '6px 10px',
            borderRadius: '3px',
            boxSizing: 'border-box',
            marginBottom: '14px',
          }}
        />

        <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Notes <span style={{ textTransform: 'none', opacity: 0.6 }}>(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          data-testid="promote-notes"
          style={{
            width: '100%',
            background: '#0c0c0e',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e5e5e5',
            fontFamily: 'inherit',
            fontSize: '12px',
            padding: '8px 10px',
            borderRadius: '3px',
            resize: 'vertical',
            boxSizing: 'border-box',
            marginBottom: '18px',
          }}
        />

        {error && (
          <div
            data-testid="promote-error"
            style={{ color: '#ef4444', fontSize: '11px', marginBottom: '12px' }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              fontFamily: 'inherit',
              fontSize: '11px',
              padding: '6px 14px',
              borderRadius: '3px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            data-testid="promote-submit"
            style={{
              background: '#ff6600',
              border: '1px solid #ff6600',
              color: '#0c0c0e',
              fontFamily: 'inherit',
              fontSize: '11px',
              fontWeight: 'bold',
              padding: '6px 14px',
              borderRadius: '3px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? 'Saving…' : 'Save Technique'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PromoteToTechniqueModal;
