import React from 'react';

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
};

export const parseSummaryText = (text) => {
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

const ResearchSummaryRenderer = ({ summary, compact = false }) => {
  const parsed = parseSummaryText(summary);

  if (parsed.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '12px' : '15px' }}>
      {parsed.map((section, idx) => (
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
          <p style={{
            fontSize: compact ? '11px' : '12px',
            lineHeight: '1.6',
            color: compact ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.8)',
            margin: 0,
            whiteSpace: 'pre-wrap'
          }}>
            {section.content}
          </p>
        </div>
      ))}
    </div>
  );
};

export default ResearchSummaryRenderer;
