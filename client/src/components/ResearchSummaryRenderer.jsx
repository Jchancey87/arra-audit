import React, { useState } from 'react';
import { splitSentences } from '../utils/splitSentences.js';
import { guessLens } from '../utils/lensGuess.js';
import PromoteToTechniqueModal from './PromoteToTechniqueModal.jsx';

// Clean SVG icons matching navigator/DAW system styling
const ICONS = {
  overview: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  ),
  rhythm: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="16" x2="6" y2="8"></line>
      <line x1="18" y1="16" x2="18" y2="8"></line>
    </svg>
  ),
  texture: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14"></line>
      <line x1="4" y1="10" x2="4" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12" y2="3"></line>
      <line x1="20" y1="21" x2="20" y2="16"></line>
      <line x1="20" y1="12" x2="20" y2="3"></line>
      <line x1="2" y1="14" x2="6" y2="14"></line>
      <line x1="10" y1="8" x2="14" y2="8"></line>
      <line x1="18" y1="16" x2="22" y2="16"></line>
    </svg>
  ),
  harmony: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  ),
  arrangement: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <line x1="3" y1="9" x2="21" y2="9"></line>
      <line x1="3" y1="15" x2="21" y2="15"></line>
      <line x1="9" y1="9" x2="9" y2="21"></line>
      <line x1="15" y1="9" x2="15" y2="21"></line>
    </svg>
  ),
  plus: (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
};

const parseSummaryText = (text) => {
  if (!text) return [];

  // Check for markdown headings
  if (!text.includes('###')) {
    return [{
      key: 'overview',
      title: 'Production Overview',
      content: text.trim()
    }];
  }

  const sections = text.split(/###\s+/);
  const parsed = [];

  for (const sect of sections) {
    if (!sect.trim()) continue;

    const lines = sect.split('\n');
    const headingLine = lines[0].trim();
    const content = lines.slice(1).join('\n').trim();

    // Strip emojis
    const cleanHeading = headingLine
      .replace(/[💿🌐🥁🎛️🎹📻🎼📡💿⚡🎓🧬⏱️🛠️🔬💡📝🎻🎷🎸🎺🎹🎧🥁🎤]/g, '')
      .trim();

    let key = 'overview';
    const lower = cleanHeading.toLowerCase();
    if (lower.includes('rhythm')) key = 'rhythm';
    else if (lower.includes('texture')) key = 'texture';
    else if (lower.includes('harmony')) key = 'harmony';
    else if (lower.includes('arrangement')) key = 'arrangement';

    parsed.push({
      key,
      title: cleanHeading,
      content
    });
  }
  return parsed;
};

const SentenceSpan = ({ sentence, compact, canPromote, onPromote, dataTestid }) => (
  <span
    data-testid={dataTestid}
    data-sentence
    style={{
      position: 'relative',
      transition: 'background 120ms ease',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'rgba(255, 102, 0, 0.08)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
    }}
  >
    {sentence}
    {canPromote && (
      <button
        type="button"
        aria-label="Promote sentence to technique"
        data-testid="promote-sentence-button"
        onClick={(e) => {
          e.stopPropagation();
          onPromote?.(sentence);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: compact ? '14px' : '16px',
          height: compact ? '14px' : '16px',
          marginLeft: '4px',
          padding: 0,
          background: '#ff6600',
          color: '#0c0c0e',
          border: 'none',
          borderRadius: '2px',
          cursor: 'pointer',
          verticalAlign: 'middle',
          opacity: 0.85,
        }}
      >
        {ICONS.plus}
      </button>
    )}
  </span>
);

const ResearchSummaryRenderer = ({
  summary,
  compact = false,
  song = null,
  onPromote = null,
  onPromoted = null,
}) => {
  const parsed = parseSummaryText(summary);
  const [activeSentence, setActiveSentence] = useState(null);

  if (parsed.length === 0) return null;

  const canPromote = Boolean(song && onPromote);
  const handlePromoteClick = (sentence) => setActiveSentence(sentence);
  const handleClose = () => setActiveSentence(null);
  const handleSubmit = async (formData) => {
    const created = await onPromote?.(formData);
    if (created) {
      onPromoted?.(created);
    }
    return created;
  };
  const initialLens = activeSentence ? guessLens(activeSentence) : 'arrangement';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '12px' : '15px' }}>
      {parsed.map((section, idx) => {
        const sentences = splitSentences(section.content);
        return (
          <div
            key={idx}
            style={{
              background: compact ? 'transparent' : '#0c0c0e',
              border: compact ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
              borderLeft: compact ? 'none' : '3px solid #ff6600',
              padding: compact ? '0' : '15px',
              borderRadius: '2px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#ff6600',
              fontFamily: 'Roboto Mono',
              fontSize: compact ? '9px' : '11px',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: compact ? '4px' : '8px'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {ICONS[section.key] || ICONS.overview}
              </span>
              <span>{section.title}</span>
            </div>
            <p
              data-testid={`section-content-${section.key}`}
              style={{
                fontSize: compact ? '11px' : '12px',
                lineHeight: '1.6',
                color: compact ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.8)',
                margin: 0,
                whiteSpace: 'pre-wrap',
              }}
            >
              {sentences.length > 0 ? (
                sentences.map((sentence, sIdx) => (
                  <React.Fragment key={sIdx}>
                    {sIdx > 0 && ' '}
                    <SentenceSpan
                      sentence={sentence}
                      compact={compact}
                      canPromote={canPromote}
                      onPromote={handlePromoteClick}
                      dataTestid={`sentence-${section.key}-${sIdx}`}
                    />
                  </React.Fragment>
                ))
              ) : (
                section.content
              )}
            </p>
          </div>
        );
      })}

      {canPromote && (
        <PromoteToTechniqueModal
          isOpen={Boolean(activeSentence)}
          onClose={handleClose}
          sentence={activeSentence || ''}
          song={song}
          initialLens={initialLens}
          lensSource="heuristic"
          onPromote={handleSubmit}
        />
      )}
    </div>
  );
};

export default ResearchSummaryRenderer;
