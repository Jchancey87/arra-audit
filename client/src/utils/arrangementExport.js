/**
 * Pure helpers + canvas renderer for the "Export arrangement" feature.
 *
 * Two output formats:
 *   1. PNG image  — renders the timeline to a 2D <canvas> via the
 *                    native Canvas API (no extra dep), then toBlob +
 *                    download. Self-contained, works in any modern
 *                    browser, no DOM measurement required.
 *   2. PDF report — defined in arrangementExportPdf.jsx using
 *                    @react-pdf/renderer (already a dep from
 *                    Phase 1.3). Separate file because react-pdf is
 *                    a heavy dep and we lazy-load it only when the
 *                    user actually clicks "Export as PDF".
 *
 * All functions in this file are pure: they take the data, return a
 * Blob (or trigger a download), and don't touch the DOM beyond
 * creating a detached <canvas> for the PNG path.
 */

const SECTION_PALETTE = {
  intro: '#a78bfa', verse: '#34d399', chorus: '#22d3ee',
  bridge: '#fbbf24', outro: '#ffd700', breakdown: '#f87171',
  buildup: '#60a5fa', drop: '#fb923c', custom: '#9ca3af',
};

const pad2 = (n) => String(n).padStart(2, '0');

const formatTime = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`;
};

const computeLayout = ({ sections = [], tracks = [], song, pxPerSec = 8 }) => {
  const sortedSections = [...sections].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
  const sectionEnd = sortedSections.reduce((max, s) => Math.max(max, (s.startTime || 0) + (s.duration || 0)), 0);
  const trackEnd = tracks.reduce(
    (max, t) => Math.max(max, ...(t.blocks || []).map((b) => (b.startTime || 0) + (b.duration || 0))),
    0
  );
  const totalDuration = Math.max(song?.durationSeconds || 0, sectionEnd, trackEnd, 30);
  const RULER = 28;
  const SECTION_ROW = 42;
  const TRACK_ROW = 30;
  const LABEL_WIDTH = 130;
  const PADDING = 12;
  const width = Math.max(900, LABEL_WIDTH + totalDuration * pxPerSec + PADDING * 2);
  const height = RULER + SECTION_ROW + tracks.length * TRACK_ROW + PADDING;
  return { sortedSections, totalDuration, width, height, RULER, SECTION_ROW, TRACK_ROW, LABEL_WIDTH, PADDING };
};

const drawRuler = (ctx, totalDuration, pxPerSec, RULER, LABEL_WIDTH, PADDING, top = 0) => {
  ctx.fillStyle = '#1a1a1f';
  ctx.fillRect(LABEL_WIDTH + PADDING, top, 9999, RULER);
  ctx.font = '10px "Roboto Mono", monospace';
  ctx.textBaseline = 'middle';
  const step = totalDuration > 600 ? 60 : totalDuration > 180 ? 30 : totalDuration > 60 ? 10 : 5;
  for (let t = 0; t <= totalDuration + step; t += step) {
    const x = LABEL_WIDTH + PADDING + t * pxPerSec;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, top + RULER - 6, 1, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(formatTime(t), x + 4, top + RULER / 2);
  }
};

const drawBlock = (ctx, block, color, x, y, width, height, label) => {
  const w = Math.max(8, width);
  ctx.fillStyle = `${color}33`;
  ctx.fillRect(x, y + 2, w, height - 4);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 2, 3, height - 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 2.5, w - 1, height - 5);
  if (w > 40 && label) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '10px "Roboto Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(String(label).slice(0, Math.floor(w / 7)), x + 8, y + 6);
  }
};

const drawLabel = (ctx, text, y, height, LABEL_WIDTH) => {
  ctx.fillStyle = '#1a1a1f';
  ctx.fillRect(0, y, LABEL_WIDTH, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(LABEL_WIDTH + 0.5, y);
  ctx.lineTo(LABEL_WIDTH + 0.5, y + height);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px "Roboto Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text || '').slice(0, 16), 10, y + height / 2);
};

export const renderArrangementToCanvas = ({ sections = [], tracks = [], song, bpm, timeSignature, pxPerSec = 8 } = {}) => {
  const layout = computeLayout({ sections, tracks, song, pxPerSec });
  const { width, height, RULER, SECTION_ROW, TRACK_ROW, LABEL_WIDTH, PADDING, sortedSections, totalDuration } = layout;

  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new Error('renderArrangementToCanvas requires a DOM (use in the browser only)');
  }
  const canvas = document.createElement('canvas');
  // 2x device pixel ratio for crisp output on hi-dpi displays.
  const scale = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#0c0c0e';
  ctx.fillRect(0, 0, width, height);

  // Header strip with song/bpm info
  ctx.fillStyle = '#15151a';
  ctx.fillRect(0, 0, width, 6);

  // Ruler
  drawRuler(ctx, totalDuration, pxPerSec, RULER, LABEL_WIDTH, PADDING);

  // Section row
  const sectionY = RULER;
  drawLabel(ctx, 'SECTIONS', sectionY, SECTION_ROW, LABEL_WIDTH);
  for (const block of sortedSections) {
    const color = SECTION_PALETTE[block.type] || SECTION_PALETTE.custom;
    const x = LABEL_WIDTH + PADDING + (block.startTime || 0) * pxPerSec;
    const w = (block.duration || 30) * pxPerSec;
    drawBlock(ctx, block, color, x, sectionY, w, SECTION_ROW, block.name || block.type);
  }

  // Track rows
  for (let i = 0; i < tracks.length; i += 1) {
    const t = tracks[i];
    const y = RULER + SECTION_ROW + i * TRACK_ROW;
    drawLabel(ctx, t.name || t.category || 'Track', y, TRACK_ROW, LABEL_WIDTH);
    for (const block of (t.blocks || [])) {
      const x = LABEL_WIDTH + PADDING + (block.startTime || 0) * pxPerSec;
      const w = (block.duration || 8) * pxPerSec;
      drawBlock(ctx, block, t.color || '#a78bfa', x, y, w, TRACK_ROW, t.name);
    }
  }

  // Footer with metadata
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px "Roboto Mono", monospace';
  ctx.textBaseline = 'alphabetic';
  const meta = [
    song?.title || song?.name,
    song?.artist,
    bpm ? `${bpm} BPM` : null,
    timeSignature || null,
  ].filter(Boolean).join(' · ');
  if (meta) ctx.fillText(meta, 10, height - 4);

  return canvas;
};

export const canvasToBlob = (canvas, type = 'image/png', quality) =>
  new Promise((resolve, reject) => {
    if (!canvas) return reject(new Error('canvasToBlob: no canvas'));
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('canvas.toBlob returned null'));
      resolve(blob);
    }, type, quality);
  });

const downloadBlob = (blob, filename) => {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const buildArrangementFilename = ({ song, ext = 'png' } = {}) => {
  const safe = (s) => String(s || 'arrangement').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60);
  return `${safe(song?.title || song?.name || 'arrangement')}.${ext}`;
};

export const exportArrangementAsImage = async ({ sections, tracks, song, bpm, timeSignature, pxPerSec, filename } = {}) => {
  const canvas = renderArrangementToCanvas({ sections, tracks, song, bpm, timeSignature, pxPerSec });
  const blob = await canvasToBlob(canvas, 'image/png');
  downloadBlob(blob, filename || buildArrangementFilename({ song, ext: 'png' }));
  return { blob, canvas, filename: filename || buildArrangementFilename({ song, ext: 'png' }) };
};
