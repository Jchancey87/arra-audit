import React from 'react';
import { useBackend } from '../context/BackendContext';
import { formatTimestampLabel } from '../utils/responseShape';

const LENS_PALETTE = {
  warm: '#fb923c',
  bright: '#facc15',
  harsh: '#dc2626',
  smooth: '#14b8a6',
  percussive: '#a855f7',
  distorted: '#7c2d12',
  clean: '#a3e635',
  reverberant: '#3b82f6',
  'lo-fi': '#a16207',
  energetic: '#f97316',
  melancholic: '#0ea5e9',
  dreamy: '#c084fc',
  aggressive: '#ef4444',
  intimate: '#ec4899',
  triumphant: '#eab308',
  tense: '#7f1d1d',
  uplifting: '#22c55e',
  dark: '#1e293b',
  playful: '#f59e0b',
};

const topN = (tags, n) => (Array.isArray(tags) ? tags.slice(0, n) : []);

const Spinner = () => (
  <span
    style={{
      display: 'inline-block',
      width: '10px',
      height: '10px',
      border: '2px solid rgba(255,255,255,0.18)',
      borderTopColor: '#ff6600',
      borderRadius: '50%',
      animation: 'bmspin 0.8s linear infinite',
    }}
  />
);

const TagPill = ({ tag, score, color }) => (
  <span
    data-testid="bookmark-analysis-pill"
    title={Number.isFinite(score) ? `${(score * 100).toFixed(0)}%` : undefined}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 7px',
      background: `${color}22`,
      color,
      border: `1px solid ${color}66`,
      borderRadius: '10px',
      fontSize: '9px',
      fontFamily: 'JetBrains Mono, monospace',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}
  >
    <span
      style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: color,
      }}
    />
    {tag}
  </span>
);

const StatusRow = ({ analysis, onRetry, isRetrying }) => {
  if (!analysis) return null;
  if (analysis.status === 'pending' || analysis.status === 'running') {
    return (
      <div
        data-testid="bookmark-analysis-pending"
        style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.55)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <Spinner />
        <span>{analysis.status === 'pending' ? 'Queued' : 'Analyzing'}…</span>
      </div>
    );
  }
  if (analysis.status === 'error') {
    return (
      <div
        data-testid="bookmark-analysis-error"
        style={{
          marginTop: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '10px',
          color: '#fca5a5',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <span>⚠ {analysis.error || 'Analysis failed'}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            data-testid="bookmark-analysis-retry"
            style={{
              background: 'transparent',
              border: '1px solid rgba(252, 165, 165, 0.4)',
              color: '#fca5a5',
              padding: '1px 6px',
              borderRadius: '2px',
              fontSize: '9px',
              cursor: isRetrying ? 'wait' : 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
            }}
          >
            {isRetrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
      </div>
    );
  }
  if (analysis.status !== 'success') return null;

  const moods = topN(analysis.mood_tags, 3);
  const timbres = topN(analysis.timbre_tags, 3);
  const similar = (analysis.similar_to || []).slice(0, 3);

  return (
    <div
      data-testid="bookmark-analysis-success"
      style={{
        marginTop: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      {(moods.length > 0 || timbres.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {moods.map((t) => (
            <TagPill key={`m-${t.tag}`} tag={t.tag} score={t.score} color={LENS_PALETTE[t.tag] || '#a78bfa'} />
          ))}
          {timbres.map((t) => (
            <TagPill key={`t-${t.tag}`} tag={t.tag} score={t.score} color={LENS_PALETTE[t.tag] || '#60a5fa'} />
          ))}
        </div>
      )}
      {similar.length > 0 && (
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'JetBrains Mono, monospace',
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.4,
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.35)' }}>Similar: </span>
          {similar.map((s, i) => (
            <span key={s}>
              <span style={{ color: 'rgba(255,255,255,0.75)' }}>{s}</span>
              {i < similar.length - 1 ? <span style={{ color: 'rgba(255,255,255,0.3)' }}> · </span> : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const BookmarkAnalysisTags = ({ auditId, bookmarkId, analysis, onReanalyzed }) => {
  const backend = useBackend();
  const [local, setLocal] = React.useState(analysis || null);
  const [retrying, setRetrying] = React.useState(false);

  React.useEffect(() => {
    setLocal(analysis || null);
  }, [analysis, bookmarkId]);

  const handleRetry = async () => {
    if (!backend || retrying) return;
    setRetrying(true);
    try {
      const result = await backend.analyzeBookmark(auditId, bookmarkId);
      const next = { ...(local || {}), ...(result?.analysis || {}) };
      setLocal(next);
      if (onReanalyzed) onReanalyzed(next);
    } catch (err) {
      setLocal({ status: 'error', error: err.message || 'Retry failed' });
    } finally {
      setRetrying(false);
    }
  };

  if (!local) return null;
  return <StatusRow analysis={local} onRetry={handleRetry} isRetrying={retrying} />;
};

export default BookmarkAnalysisTags;
