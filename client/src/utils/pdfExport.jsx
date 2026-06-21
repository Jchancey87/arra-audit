// Dynamic import wrapper for @react-pdf/renderer to keep ~700KB out of the main bundle.
// Callers await `loadPdfRenderer()` before rendering; subsequent calls hit the cache.

let cached = null;

async function loadPdfRenderer() {
  if (cached) return cached;
  const mod = await import('@react-pdf/renderer');
  cached = {
    Document: mod.Document,
    Page: mod.Page,
    Text: mod.Text,
    View: mod.View,
    StyleSheet: mod.StyleSheet,
    Font: mod.Font,
    pdf: mod.pdf,
    Blob: mod.Blob,
  };
  return cached;
}

export async function renderAuditToBlob(audit, song) {
  const [{ pdf, Blob: RBlob }, { default: AuditReport }, { prepareReportData }, { registerArraFonts }] =
    await Promise.all([
      loadPdfRenderer(),
      import('../pdf/AuditReport.jsx'),
      import('./pdfData.js'),
      import('../pdf/theme.js'),
    ]);
  registerArraFonts();
  const data = prepareReportData(audit, song);
  const doc = <AuditReport data={data} />;
  const instance = pdf(doc);
  const blob = await instance.toBlob();
  // Return a plain Blob (react-pdf Blob is a thin wrapper, but standard interface works)
  return blob;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

export function buildAuditFilename(audit, song) {
  const safe = (s) => (s || 'audit').replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').toLowerCase();
  const songPart = safe(`${song?.title || 'untitled'}-${song?.artist || 'unknown'}`);
  const ts = new Date().toISOString().slice(0, 10);
  return `arra-${songPart}-${ts}.pdf`;
}
