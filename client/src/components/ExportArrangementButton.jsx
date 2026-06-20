import React, { useState, useRef, useEffect } from 'react';
import { useBackend } from '../context/BackendContext';
import { exportArrangementAsImage, buildArrangementFilename } from '../utils/arrangementExport.js';

/**
 * ExportArrangementButton — small "Export ▾" dropdown for the
 * arrangement timeline. Two options:
 *   - PNG: renders the timeline to a 2D canvas (no extra dep) and
 *          triggers a download.
 *   - PDF: dynamically imports @react-pdf/renderer (already a dep
 *          from Phase 1.3) and renders a text-based report.
 *
 * Why a dropdown: keeps the toolbar tidy. The actions are
 * conceptually related (both export) and rare enough that a single
 * button + menu is friendlier than two side-by-side buttons.
 */
const ExportArrangementButton = ({ sections, tracks, song, bpm, timeSignature, viewMode, readOnly }) => {
  const backend = useBackend();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hasContent = (sections?.length || 0) + (tracks?.length || 0) > 0;
  const isDisabled = readOnly || !hasContent || busy;

  const handleImage = async () => {
    setError(null);
    setBusy(true);
    try {
      await exportArrangementAsImage({ sections, tracks, song, bpm, timeSignature, viewMode });
      setOpen(false); // close only on success
    } catch (err) {
      setError(err.message || 'Image export failed');
    } finally {
      setBusy(false);
    }
  };

  const handlePdf = async () => {
    setOpen(false);
    setError(null);
    setBusy(true);
    try {
      const [{ pdf }, { ArrangementReport }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('../utils/arrangementExportPdf.jsx'),
      ]);
      const blob = await pdf(<ArrangementReport
        song={song}
        sections={sections}
        tracks={tracks}
        bpm={bpm}
        timeSignature={timeSignature}
        viewMode={viewMode}
      />).toBlob();
      const filename = buildArrangementFilename({ song, ext: 'pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err.message || 'PDF export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isDisabled}
        data-testid="export-arrangement-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={hasContent ? 'Export the arrangement timeline' : 'Add a section or track first'}
        style={{
          padding: '5px 12px',
          fontSize: '11px',
          background: open ? 'rgba(255, 102, 0, 0.15)' : 'transparent',
          color: isDisabled ? 'rgba(255,255,255,0.25)' : '#ff6600',
          border: `1px solid ${isDisabled ? 'rgba(255,255,255,0.08)' : 'rgba(255, 102, 0, 0.4)'}`,
          borderRadius: '4px',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          fontFamily: '"Roboto Mono", monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 'bold',
        }}
      >
        {busy ? 'Exporting…' : 'Export ▾'}
      </button>
      {open && (
        <div
          role="menu"
          data-testid="export-arrangement-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 50,
            minWidth: 180,
            background: '#15151a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            padding: '4px 0',
            fontFamily: '"Roboto Mono", monospace',
            fontSize: '11px',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleImage}
            disabled={busy}
            data-testid="export-arrangement-image"
            style={menuItemStyle}
          >
            <span style={{ color: '#ff6600', marginRight: 8 }}>PNG</span>
            Export as image
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handlePdf}
            disabled={busy}
            data-testid="export-arrangement-pdf"
            style={menuItemStyle}
          >
            <span style={{ color: '#ff6600', marginRight: 8 }}>PDF</span>
            Export as report
          </button>
          {error && (
            <div
              role="alert"
              style={{ padding: '6px 12px', color: '#fca5a5', fontSize: '10px', borderTop: '1px solid rgba(252, 165, 165, 0.2)' }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const menuItemStyle = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  padding: '6px 12px',
  background: 'transparent',
  color: 'rgba(255,255,255,0.85)',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: '"Roboto Mono", monospace',
  fontSize: '11px',
  letterSpacing: '0.04em',
};

export default ExportArrangementButton;
