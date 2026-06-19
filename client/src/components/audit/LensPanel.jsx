import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LENS_PROMPTS, LENS_LABEL } from './lensConstants';

const KEY_TO_SCALE_DEGREES = {
  major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
  minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
};

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
  const degrees = KEY_TO_SCALE_DEGREES[scale || 'major'];
  return degrees.map((deg, i) => {
    const noteIdx = (root + intervals[i]) % 12;
    const noteName = KEY_ROOTS[noteIdx];
    let suffix = '';
    if (isMinor) {
      if (deg === 'i' || deg === 'iv' || deg === 'v') suffix = '';
      else if (deg === 'ii°') suffix = 'dim';
      else suffix = '';
    } else {
      if (deg === 'I' || deg === 'IV' || deg === 'V') suffix = '';
      else suffix = 'm';
    }
    return { degree: deg, chord: noteName + suffix };
  });
};

const formatTime = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const ListeningFocus = ({ text }) => (
  <div
    style={{
      background: 'var(--bg-surface-2)',
      padding: '12px',
      border: '1px solid var(--border-subtle)',
      marginBottom: '20px',
    }}
  >
    <div
      style={{
        fontSize: '10px',
        fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        marginBottom: '6px',
      }}
    >
      Listening Focus
    </div>
    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
      {text || 'Tune in to the relationship between the elements below. Use the prompts to guide your ear.'}
    </p>
  </div>
);

const LensPrompt = ({ index, prompt, value, onChange, currentTime, onSaved }) => {
  const [showSaved, setShowSaved] = useState(false);
  const debounceRef = useRef(null);
  const lastValueRef = useRef(value || '');

  // Debounced auto-save on typing
  useEffect(() => {
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSaved && onSaved();
    }, 3000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onSaved]);

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onSaved && onSaved();
  };

  const insertStamp = (e) => {
    const stamp = `[${formatTime(currentTime)}] `;
    const target = e.currentTarget;
    const start = target.selectionStart || 0;
    const end = target.selectionEnd || 0;
    const newVal = (value || '').slice(0, start) + stamp + (value || '').slice(end);
    onChange(newVal);
    requestAnimationFrame(() => {
      target.focus();
      const pos = start + stamp.length;
      target.setSelectionRange(pos, pos);
    });
  };

  return (
    <div
      style={{
        marginBottom: '20px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '6px' }}>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            color: 'var(--text-tertiary)',
            minWidth: '14px',
          }}
        >
          {index + 1}.
        </span>
        <h3
          style={{
            margin: 0,
            fontFamily: 'Inter, sans-serif',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          {prompt.title}
        </h3>
      </div>
      <p
        title={prompt.question}
        style={{
          margin: '0 0 10px 0',
          paddingLeft: '24px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        {prompt.question}
      </p>
      <div style={{ paddingLeft: '24px' }}>
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder="Type your observations…"
          style={{
            minHeight: '80px',
            background: 'var(--bg-surface-3)',
            border: 'none',
            outline: '1px solid transparent',
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '1px solid var(--accent-primary)';
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.outline = '1px solid transparent';
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '6px',
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
          }}
        >
          <button
            type="button"
            onClick={insertStamp}
            className="ghost"
            style={{ fontSize: '10px', color: 'var(--text-tertiary)', padding: '2px 6px' }}
            title="Insert current playback time"
          >
            Stamp {formatTime(currentTime)}
          </button>
          {showSaved && (
            <span style={{ color: 'var(--text-tertiary)' }}>Saved</span>
          )}
        </div>
      </div>
    </div>
  );
};

const LensPanel = ({
  activeLens = 'harmony',
  onChangeLens,
  song,
  currentTime = 0,
  responses = {},
  onResponseChange,
  onPromptsSaved,
  listeningFocus,
  customPrompts,
  lensDescription,
}) => {
  const [showSavedAll, setShowSavedAll] = useState(false);
  const templatePrompts = customPrompts || LENS_PROMPTS[activeLens] || LENS_PROMPTS.harmony;
  const prompts = templatePrompts;
  const keyRoot = song?.audioOverrides?.key || song?.audioAnalysis?.key;
  const scale = song?.audioOverrides?.scale || song?.audioAnalysis?.scale;
  // Phase 4.3: memoize derived scale-degree row + answered count + focus text
  const scaleRow = useMemo(() => buildScaleDegreeRow(keyRoot, scale), [keyRoot, scale]);
  const answeredCount = useMemo(() => {
    if (!Array.isArray(prompts)) return 0;
    return prompts.filter((_, i) => (responses[`lens-${activeLens}-${i}`] || '').trim().length >= 10).length;
  }, [prompts, activeLens, responses]);
  const focusText = useMemo(() => {
    const raw = listeningFocus || lensDescription || '';
    if (!raw) return null;
    if (/today's focus/i.test(raw)) return raw;
    return `Today's focus: ${raw}`;
  }, [listeningFocus, lensDescription]);

  const handleSaved = () => {
    setShowSavedAll(true);
    if (onPromptsSaved) onPromptsSaved();
    setTimeout(() => setShowSavedAll(false), 2000);
  };

  return (
    <section style={{ padding: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
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
            color: 'var(--text-accent)',
          }}
        >
          {LENS_LABEL[activeLens] || 'Harmony'} Lens
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {showSavedAll && (
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}>Saved</span>
          )}
          <label
            htmlFor="lens-switch"
            style={{ fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            Change Lens
          </label>
          <select
            id="lens-switch"
            value={activeLens}
            onChange={(e) => onChangeLens && onChangeLens(e.target.value)}
            style={{ minWidth: '120px' }}
          >
            {Object.keys(LENS_PROMPTS).map((k) => (
              <option key={k} value={k}>{LENS_LABEL[k]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lens description + progress row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        {focusText ? (
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              color: 'var(--text-secondary)',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.4,
              flex: 1,
              minWidth: 0,
            }}
          >
            {focusText}
          </p>
        ) : <span style={{ flex: 1 }} />}
        {Array.isArray(prompts) && prompts.length > 0 && (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              color: answeredCount >= prompts.length ? 'var(--status-success)' : 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
            }}
          >
            {answeredCount}/{prompts.length} answered
          </span>
        )}
      </div>

      {/* Key Center Context (Harmony only) */}
      {activeLens === 'harmony' && keyRoot && (
        <div
          style={{
            background: 'var(--bg-surface-2)',
            padding: '14px 16px',
            border: '1px solid var(--border-subtle)',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-secondary)',
              marginBottom: '8px',
            }}
          >
            Key Center Context
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '-0.01em',
              marginBottom: '10px',
            }}
          >
            {keyRoot} {scale === 'minor' ? 'minor' : 'major'}
          </div>
          {scaleRow && (
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
              {scaleRow.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    {d.degree}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {d.chord}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guided prompts */}
      {Array.isArray(prompts) && prompts.map((p, i) => (
        <LensPrompt
          key={`${activeLens}-${i}`}
          index={i}
          prompt={p}
          value={responses[`lens-${activeLens}-${i}`]}
          onChange={(v) => onResponseChange(`lens-${activeLens}-${i}`, v)}
          currentTime={currentTime}
          onSaved={handleSaved}
        />
      ))}
    </section>
  );
};

export default LensPanel;
