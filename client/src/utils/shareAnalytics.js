// Lightweight client-side analytics for share link events.
//
// Logs to console in dev/test (so we can verify in DevTools) and persists a
// rolling count per (auditId, source) pair in localStorage for the future
// "Share insights" panel. No external network calls; this is purely
// client-side telemetry. We deliberately do NOT include any PII — the audit
// id is the user's own data and the source label is a static string
// (e.g. 'bookmark-card', 'header').

const STORAGE_KEY = 'arra.shareLinkLog.v1';
const MAX_EVENTS = 500;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function safeRead() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function safeWrite(events) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch (_) { /* swallow quota errors */ }
}

function pruneOldEvents(events) {
  const cutoff = Date.now() - MAX_AGE_MS;
  return events.filter((e) => e && e.ts && e.ts >= cutoff);
}

export function recordLinkOpen({ auditId, bookmarkId = null, source = 'unknown' }) {
  if (!auditId) return;
  const event = {
    ts: Date.now(),
    auditId: String(auditId),
    bookmarkId: bookmarkId ? String(bookmarkId) : null,
    source: String(source).slice(0, 64),
  };
  // 1. Console for dev visibility
  if (typeof console !== 'undefined' && console.info) {
    console.info('[Arra][shareLink] open', event);
  }
  // 2. Persist (best-effort)
  if (typeof window === 'undefined') return;
  try {
    const existing = safeRead();
    const pruned = pruneOldEvents(existing);
    pruned.push(event);
    const trimmed = pruned.length > MAX_EVENTS ? pruned.slice(-MAX_EVENTS) : pruned;
    safeWrite(trimmed);
  } catch (_) { /* swallow */ }
  // 3. Future hook: window.dispatchEvent(new CustomEvent('arra:link-open', { detail: event }))
  //    Uncomment when a "Share insights" panel lands.
}

/**
 * getLinkOpenStats() — returns aggregate counts for the UI.
 *   { totalOpens, perAudit: { [auditId]: number }, perSource: { [source]: number } }
 */
export function getLinkOpenStats() {
  const events = pruneOldEvents(safeRead());
  const perAudit = {};
  const perSource = {};
  for (const e of events) {
    if (e.auditId) perAudit[e.auditId] = (perAudit[e.auditId] || 0) + 1;
    if (e.source) perSource[e.source] = (perSource[e.source] || 0) + 1;
  }
  return { totalOpens: events.length, perAudit, perSource };
}

const __test__ = { STORAGE_KEY, MAX_EVENTS, MAX_AGE_MS };
