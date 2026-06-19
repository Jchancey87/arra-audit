import React, { useState, useRef } from 'react';
import { renderAuditToBlob, downloadBlob, buildAuditFilename } from '../utils/pdfExport.jsx';

const LABEL_IDLE = 'Export PDF';
const LABEL_LOADING = 'Loading…';
const LABEL_RENDER = 'Rendering…';
const LABEL_DONE = 'Downloaded';
const LABEL_ERROR = 'Export failed';

const DownloadIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 6, flexShrink: 0 }}>
    <path d="M6 1v8M3 6l3 3 3-3M2 10h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
  </svg>
);

const Spinner = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 6, flexShrink: 0 }} className="spin">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.25" />
    <path d="M10.5 6a4.5 4.5 0 0 0-4.5-4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin .7s linear infinite; transform-origin:50% 50%}`}</style>
  </svg>
);

export default function ExportPdfButton({ audit, song, style, label = LABEL_IDLE }) {
  const [status, setStatus] = useState('idle');
  const runIdRef = useRef(0);

  const handleClick = async () => {
    if (status === 'loading' || status === 'rendering') return;
    const runId = ++runIdRef.current;
    setStatus('loading');
    try {
      // Small delay so the spinner paints before the heavy import blocks the event loop.
      await new Promise((r) => setTimeout(r, 16));
      if (runIdRef.current !== runId) return;
      setStatus('rendering');
      const blob = await renderAuditToBlob(audit, song);
      if (runIdRef.current !== runId) return;
      downloadBlob(blob, buildAuditFilename(audit, song));
      setStatus('done');
      setTimeout(() => {
        if (runIdRef.current === runId) setStatus('idle');
      }, 1800);
    } catch (err) {
      console.error('[ExportPdf] render failed', err);
      if (runIdRef.current !== runId) return;
      setStatus('error');
      setTimeout(() => {
        if (runIdRef.current === runId) setStatus('idle');
      }, 2400);
    }
  };

  const disabled = status === 'loading' || status === 'rendering';
  const isError = status === 'error';
  const isSuccess = status === 'done';
  const isWorking = status === 'loading' || status === 'rendering';

  let text = label;
  if (isWorking) text = status === 'loading' ? LABEL_LOADING : LABEL_RENDER;
  if (isError) text = LABEL_ERROR;
  if (isSuccess) text = LABEL_DONE;

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 14px',
    background: 'transparent',
    color: isError ? '#ff5252' : isSuccess ? '#35d777' : '#f2f2f2',
    border: `1px solid ${isError ? '#ff5252' : isSuccess ? '#35d777' : '#3a3a44'}`,
    borderRadius: '2px',
    fontFamily: 'Roboto Mono, monospace',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    cursor: disabled ? 'wait' : 'pointer',
    opacity: disabled ? 0.85 : 1,
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Export audit as PDF"
      style={{ ...baseStyle, ...(style || {}) }}
      onMouseEnter={(e) => {
        if (!disabled && !isError && !isSuccess) e.currentTarget.style.background = '#202024';
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isError && !isSuccess) e.currentTarget.style.background = 'transparent';
      }}
    >
      {isWorking ? <Spinner /> : <DownloadIcon />}
      {text}
    </button>
  );
}
