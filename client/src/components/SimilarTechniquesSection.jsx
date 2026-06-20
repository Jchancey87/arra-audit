import React, { useState } from 'react';
import { useRecommendations } from '../hooks/useRecommendations.js';

const LENS_COLORS = {
  rhythm: '#f97316',
  texture: '#14b8a6',
  harmony: '#8b5cf6',
  arrangement: '#ec4899',
};

const SCORE_PCT = (score) => `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;

const ScoreBar = ({ score }) => (
  <div
    style={{
      flex: 1,
      height: '4px',
      background: 'rgba(255,255,255,0.06)',
      borderRadius: '2px',
      overflow: 'hidden',
    }}
    title={`Similarity: ${SCORE_PCT(score)}`}
  >
    <div
      style={{
        width: SCORE_PCT(score),
        height: '100%',
        background: 'linear-gradient(90deg, #ff6600 0%, #facc15 100%)',
        transition: 'width 0.2s',
      }}
    />
  </div>
);

const Card = ({ technique, score, onOpen }) => {
  const lens = technique?.lens;
  const accent = LENS_COLORS[lens] || 'rgba(255,255,255,0.4)';
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="similar-technique-card"
      data-technique-id={technique?._id}
      data-score={score}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: '2px',
        padding: '10px 12px',
        color: 'inherit',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.92)',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {technique?.techniqueName || technique?.description?.slice(0, 60) || 'Untitled technique'}
        </span>
        {lens && (
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: accent,
            }}
          >
            {lens}
          </span>
        )}
      </div>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, marginBottom: '6px' }}>
        {technique?.description?.slice(0, 140) || <em>(no description)</em>}
        {technique?.description && technique.description.length > 140 ? '…' : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ScoreBar score={score} />
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'JetBrains Mono, monospace',
            color: 'rgba(255,255,255,0.45)',
            minWidth: '32px',
            textAlign: 'right',
          }}
        >
          {SCORE_PCT(score)}
        </span>
      </div>
    </button>
  );
};

const SimilarTechniquesSection = ({ technique, limit = 5, onOpenSimilar }) => {
  const hasDescription = (technique?.description || '').trim().length > 0;
  const { similar, loading, error, refetch } = useRecommendations(technique?._id, {
    limit,
    skip: !hasDescription,
  });
  const [expanded, setExpanded] = useState(true);

  if (!technique?._id) return null;

  if (!hasDescription) {
    return (
      <div
        data-testid="similar-techniques-empty"
        style={{
          marginTop: '20px',
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: '2px',
          fontSize: '11px',
          color: 'rgba(255,255,255,0.5)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        Add a description to this technique to surface similar entries from your notebook.
      </div>
    );
  }

  return (
    <section
      data-testid="similar-techniques-section"
      style={{
        marginTop: '20px',
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '2px',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: expanded ? '10px' : 0,
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          data-testid="similar-techniques-toggle"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>{expanded ? '▾' : '▸'}</span>
          <span>Similar techniques from your notebook</span>
        </button>
        {!loading && similar.length > 0 && (
          <span
            style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {similar.length} match{similar.length === 1 ? '' : 'es'}
          </span>
        )}
      </header>

      {expanded && (
        <>
          {loading && (
            <div
              data-testid="similar-techniques-loading"
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '6px 0',
              }}
            >
              Finding matches…
            </div>
          )}

          {error && !loading && (
            <div
              data-testid="similar-techniques-error"
              style={{
                fontSize: '11px',
                color: '#fca5a5',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '6px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚠ Could not load similar techniques: {error.message || 'unknown'}</span>
              <button
                type="button"
                onClick={refetch}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(252, 165, 165, 0.4)',
                  color: '#fca5a5',
                  padding: '1px 6px',
                  borderRadius: '2px',
                  fontSize: '9px',
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace',
                  textTransform: 'uppercase',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && similar.length === 0 && (
            <div
              data-testid="similar-techniques-none"
              style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '6px 0',
              }}
            >
              No similar techniques yet — log a few more entries with descriptions to discover patterns.
            </div>
          )}

          {!loading && !error && similar.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {similar.map(({ technique: t, score }) => (
                <Card
                  key={t._id}
                  technique={t}
                  score={score}
                  onOpen={() => onOpenSimilar && onOpenSimilar(t)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default SimilarTechniquesSection;
