import React from 'react';

const formatTime = (seconds) => {
  const s = Math.floor(seconds ?? 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * SessionBookmarks - Horizontal "Session Bookmarks" chip strip for the audit form.
 * Renders nothing if there are no bookmarks.
 */
const SessionBookmarks = ({ bookmarks, onSeek }) => {
  if (!bookmarks || bookmarks.length === 0) return null;
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <h3 style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>
        Session Bookmarks ({bookmarks.length})
      </h3>
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
        {bookmarks.map((bm, idx) => (
          <button key={bm._id || idx} onClick={() => onSeek(bm.timestampSeconds || bm.timestamp)} style={{ background: 'var(--bg-surface-2)', color: 'var(--accent-primary)', padding: '4px 10px', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid var(--border-subtle)' }}>
            {formatTime(bm.timestampSeconds || bm.timestamp)}
            {bm.note ? ` · ${bm.note}` : ''}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SessionBookmarks;
