import React, { useState } from 'react';

const SCALE_DEGREES = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];

const NOTE_TO_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

const KEY_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const MAJOR_TRIADS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_TRIADS = [0, 2, 3, 5, 7, 8, 10];

const buildScaleDegreeRow = (keyRoot, scale) => {
  if (!keyRoot) return null;
  const root = NOTE_TO_INDEX[keyRoot.replace('m', '').trim()];
  if (root == null) return null;
  const intervals = scale === 'minor' ? MINOR_TRIADS : MAJOR_TRIADS;
  const isMinor = scale === 'minor';
  return SCALE_DEGREES.map((deg, i) => {
    const noteIdx = (root + intervals[i]) % 12;
    const noteName = KEY_ROOTS[noteIdx];
    const suffix = isMinor
      ? (deg === 'I' ? '' : 'm')
      : (deg === 'I' || deg === 'IV' || deg === 'V' ? '' : 'm');
    const finalSuffix = isMinor && deg === 'vii°' ? 'dim' : suffix;
    return { degree: deg, chord: noteName + finalSuffix };
  });
};

const formatBpm = (bpm) => {
  const n = parseFloat(bpm);
  if (isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

const formatLufs = (lufs) => {
  const n = parseFloat(lufs);
  if (isNaN(n)) return '—';
  return n.toFixed(2);
};

const formatKey = (key, scale) => {
  if (!key) return '—';
  const k = key.trim();
  if (!scale) return k;
  return `${k} ${scale === 'minor' ? 'minor' : 'major'}`;
};

const getConfidenceBucket = (conf) => {
  const n = parseFloat(conf);
  if (isNaN(n)) return 'low';
  if (n >= 0.8) return 'high';
  if (n >= 0.5) return 'medium';
  return 'low';
};

const ConfidenceDot = ({ conf, prefix = '●' }) => {
  const bucket = getConfidenceBucket(conf);
  const color =
    bucket === 'high'
      ? 'var(--status-success)'
      : bucket === 'medium'
      ? 'var(--status-warning)'
      : 'var(--text-tertiary)';
  const text =
    bucket === 'high' ? 'confident' : bucket === 'medium' ? 'probable' : 'low';
  const pct = Math.round((parseFloat(conf) || 0) * 100);
  return (
    <span
      style={{
        fontSize: '10px',
        fontFamily: 'JetBrains Mono, monospace',
        color,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {bucket === 'low' ? <span style={{ color, fontSize: '9px' }}>○</span> : <span style={{ color, fontSize: '6px' }}>●</span>}
      {pct}% {text}
    </span>
  );
};

const Module = ({ label, value, meta, extra, isOverridden = false, onOverride }) => (
  <div
    style={{
      flex: 1,
      background: 'var(--bg-surface-2)',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      position: 'relative',
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          fontSize: '10px',
          fontFamily: 'JetBrains Mono, monospace',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-secondary)',
        }}
      >
        {label}
      </span>
      {isOverridden && (
        <span style={{ fontSize: '8px', color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
          MANUAL
        </span>
      )}
    </div>
    <div
      style={{
        fontSize: '22px',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        color: 'var(--text-primary)',
        lineHeight: 1.1,
      }}
    >
      {value}
    </div>
    {meta && <div>{meta}</div>}
    {extra && <div style={{ marginTop: '4px' }}>{extra}</div>}
  </div>
);

const ScaleDegreeRow = ({ row }) => {
  if (!row) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: '4px',
        marginTop: '6px',
        width: '100%',
        justifyContent: 'space-between',
      }}
    >
      {row.map((d, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
            }}
          >
            {d.degree}
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              color: 'var(--text-secondary)',
            }}
          >
            {d.chord}
          </span>
        </div>
      ))}
    </div>
  );
};

const LoudnessMeter = ({ lufs }) => {
  const n = parseFloat(lufs);
  const safe = isNaN(n) ? -14 : n;
  const min = -24;
  const max = -6;
  const pct = Math.max(0, Math.min(100, ((safe - min) / (max - min)) * 100));
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <div
        style={{
          height: '4px',
          background: 'var(--bg-surface-3)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--status-success) 0%, var(--status-warning) 60%, #d84040 100%)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px',
          color: 'var(--text-tertiary)',
          fontFamily: 'JetBrains Mono, monospace',
        }}
      >
        <span>-24 LUFS</span>
        <span>-6 LUFS</span>
      </div>
    </div>
  );
};

const TrackAnalysisModules = ({ song, onChangeOverride }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});

  if (!song) return null;
  const analysis = song.audioAnalysis || {};
  const overrides = song.audioOverrides || {};

  const tempo = overrides.tempo_bpm || analysis.tempo_bpm;
  const key = overrides.key || analysis.key;
  const scale = overrides.scale || analysis.scale;
  const meter = overrides.estimated_meter || analysis.estimated_meter;
  const lufs = analysis.loudness_integrated;

  const scaleRow = buildScaleDegreeRow(key, scale);

  const startEditing = () => {
    setDraft({
      tempo_bpm: tempo || '',
      key: key || '',
      scale: scale || 'major',
      estimated_meter: meter || '4/4',
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
  };

  const saveEditing = () => {
    if (onChangeOverride) onChangeOverride(draft);
    setEditing(false);
  };

  return (
    <section role="group" aria-label="Track Analysis">
      {/* Section header */}
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
          Track Analysis
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--status-success)',
              fontFamily: 'JetBrains Mono, monospace',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Scan Complete
          </span>
          {!editing ? (
            <button
              onClick={startEditing}
              className="ghost"
              style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}
              title="Manually correct detected values"
            >
              Override values
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={cancelEditing} className="ghost" style={{ fontSize: '10px' }}>Cancel</button>
              <button onClick={saveEditing} className="primary" style={{ fontSize: '10px' }}>Save</button>
            </div>
          )}
        </div>
      </div>

      {/* Module row */}
      <div
        style={{
          display: 'flex',
          background: 'var(--bg-surface-1)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* TEMPO */}
        <div
          style={{
            flex: 1,
            background: 'var(--bg-surface-2)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            borderRight: '1px solid var(--border-subtle)',
            position: 'relative',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
            }}
          >
            Tempo
          </span>
          {editing ? (
            <input
              type="number"
              step="0.01"
              value={draft.tempo_bpm}
              onChange={(e) => setDraft({ ...draft, tempo_bpm: e.target.value })}
              style={{ fontSize: '18px', padding: '4px 6px' }}
              autoFocus
            />
          ) : (
            <div
              style={{
                fontSize: '22px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              {formatBpm(tempo)} <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, fontFamily: 'JetBrains Mono, monospace' }}>BPM</span>
              {overrides.tempo_bpm && (
                <span style={{ marginLeft: '6px', fontSize: '8px', color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace' }}>MANUAL</span>
              )}
            </div>
          )}
          <ConfidenceDot conf={analysis.tempo_confidence} />
        </div>

        {/* KEY */}
        <div
          style={{
            flex: 1,
            background: 'var(--bg-surface-2)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
            }}
          >
            Key
          </span>
          {editing ? (
            <div style={{ display: 'flex', gap: '4px' }}>
              <select
                value={draft.key}
                onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                style={{ flex: 1, fontSize: '14px' }}
              >
                <option value="">—</option>
                {KEY_ROOTS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
              <select
                value={draft.scale}
                onChange={(e) => setDraft({ ...draft, scale: e.target.value })}
                style={{ fontSize: '14px' }}
              >
                <option value="major">Major</option>
                <option value="minor">Minor</option>
              </select>
            </div>
          ) : (
            <div
              style={{
                fontSize: '22px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              {formatKey(key, scale)}
              {overrides.key && (
                <span style={{ marginLeft: '6px', fontSize: '8px', color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace' }}>MANUAL</span>
              )}
            </div>
          )}
          <ConfidenceDot conf={analysis.key_confidence} />
          <ScaleDegreeRow row={scaleRow} />
        </div>

        {/* METER */}
        <div
          style={{
            flex: 1,
            background: 'var(--bg-surface-2)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
            }}
          >
            Meter
          </span>
          {editing ? (
            <select
              value={draft.estimated_meter}
              onChange={(e) => setDraft({ ...draft, estimated_meter: e.target.value })}
              style={{ fontSize: '18px' }}
            >
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="5/4">5/4</option>
              <option value="6/8">6/8</option>
              <option value="7/8">7/8</option>
            </select>
          ) : (
            <div
              style={{
                fontSize: '22px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
                lineHeight: 1.1,
              }}
            >
              {meter || '—'}
              {overrides.estimated_meter && (
                <span style={{ marginLeft: '6px', fontSize: '8px', color: 'var(--accent-primary)', fontFamily: 'JetBrains Mono, monospace' }}>MANUAL</span>
              )}
            </div>
          )}
          <ConfidenceDot conf={analysis.meter_confidence} />
        </div>

        {/* LOUDNESS */}
        <div
          style={{
            flex: 1,
            background: 'var(--bg-surface-2)',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
            }}
          >
            Loudness
          </span>
          <div
            style={{
              fontSize: '22px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary)',
              lineHeight: 1.1,
            }}
          >
            {formatLufs(lufs)} <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 400, fontFamily: 'JetBrains Mono, monospace' }}>LUFS</span>
          </div>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Integrated
          </span>
          <LoudnessMeter lufs={lufs} />
        </div>
      </div>
    </section>
  );
};

export default TrackAnalysisModules;
export { buildScaleDegreeRow };
