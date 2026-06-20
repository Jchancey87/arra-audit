import React, { useCallback, useEffect, useState } from 'react';
import { buildAuditLink } from '../utils/deepLinks.js';
import { recordLinkOpen } from '../utils/shareAnalytics.js';

/**
 * ShareLinkButton - copy or system-share a deep link to an audit bookmark.
 *
 * Props:
 *   auditId           - required, the audit id
 *   timestampSeconds  - optional, playback position to share
 *   bookmarkId        - optional, bookmark id to highlight on open
 *   label             - optional, button text override
 *   compact           - optional, tighter styling for inline use
 *
 * Behavior:
 *   - Uses navigator.share({ url, title }) when available
 *   - Otherwise copies to clipboard and shows "Copied" confirmation
 *   - Strips the link from history params (handled by buildAuditLink)
 */
const ShareLinkButton = ({
  auditId,
  timestampSeconds,
  bookmarkId,
  label = 'Share',
  compact = false,
  source = 'inline',
}) => {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!copied && !error) return undefined;
    const t = setTimeout(() => {
      setCopied(false);
      setError(null);
    }, 1800);
    return () => clearTimeout(t);
  }, [copied, error]);

  const handleClick = useCallback(async (e) => {
    e.stopPropagation();
    e.preventDefault();
    setError(null);
    const url = buildAuditLink(auditId, { timestampSeconds, bookmarkId });
    if (!url) {
      setError('No link');
      return;
    }
    const shareData = {
      title: typeof document !== 'undefined' ? document.title : 'Arra Audit',
      url,
    };
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        recordLinkOpen({ auditId, bookmarkId, source });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (typeof document !== 'undefined') {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } else {
        throw new Error('Clipboard unavailable');
      }
      setCopied(true);
      recordLinkOpen({ auditId, bookmarkId, source });
    } catch (err) {
      setError('Copy failed');
    }
  }, [auditId, timestampSeconds, bookmarkId, source]);

  const text = error ? error : copied ? 'Copied' : label;
  const color = error ? '#f87171' : copied ? '#22c55e' : '#ff6600';

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Copy share link"
      style={{
        background: 'transparent',
        border: `1px solid ${color}`,
        color,
        padding: compact ? '2px 6px' : '4px 8px',
        fontSize: compact ? '9px' : '10px',
        fontFamily: 'JetBrains Mono, monospace',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderRadius: '2px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </button>
  );
};

export default ShareLinkButton;
