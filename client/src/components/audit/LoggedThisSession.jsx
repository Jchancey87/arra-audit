import React from 'react';

const formatTime = (seconds) => {
  const s = Math.floor(seconds ?? 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const getTechniqueTimestamp = (tech) => {
  const parsed = (() => {
    if (tech?.timestamp == null) return null;
    if (typeof tech.timestamp === 'number') return Number.isFinite(tech.timestamp) ? Math.max(0, Math.floor(tech.timestamp)) : null;
    const s = String(tech.timestamp).trim();
    if (!s) return null;
    const match = s.match(/^(\d+):(\d{1,2})$/);
    if (match) return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  })();
  if (parsed != null) return parsed;
  if (Number.isFinite(tech?.exampleTimestamp) && tech.exampleTimestamp >= 0) {
    return Math.floor(tech.exampleTimestamp);
  }
  return null;
};

/**
 * LoggedThisSession - "Logged This Session" card grid for the audit form.
 * Shows techniques captured during the current session with seek + lens badge.
 */
const LoggedThisSession = ({ techniques, onSeek }) => {
  if (!techniques || techniques.length === 0) return null;
  return (
    <div style={{ padding: '0 16px 16px', background: 'var(--bg-surface-0)' }}>
      <h3 style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>
        Logged This Session ({techniques.length})
      </h3>
      <div style={{ display: 'grid', gap: '8px' }}>
        {techniques.map((tech) => {
          const ts = getTechniqueTimestamp(tech);
          return (
            <div key={tech._id || tech._tempId} style={{ background: 'var(--bg-surface-2)', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: '12px', color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {tech.techniqueName || 'Untitled'}
                </strong>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tech.description}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                {ts != null && (
                  <button onClick={() => onSeek(ts)} title="Seek to timestamp" style={{ background: 'var(--bg-surface-3)', color: 'var(--accent-primary)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', padding: '2px 8px', border: '1px solid var(--border-subtle)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '4px', height: '4px', background: 'var(--accent-primary)', display: 'inline-block' }} />
                    {formatTime(ts)}
                  </button>
                )}
                <span className="badge">{tech.lens}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoggedThisSession;
