/**
 * Deep-link helpers for sharing audit views.
 *
 * Shareable links look like:
 *   /audit/<auditId>?t=<seconds>&bookmark=<bookmarkId>
 *
 * `t` is the playback timestamp (integer seconds, may be negative-tolerant).
 * `bookmark` is the optional audit.bookmarks[i]._id to highlight on load.
 */

const TIMESTAMP_KEY = 't';
const BOOKMARK_KEY = 'bookmark';

const safeOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');

const toInt = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

export const buildAuditLink = (auditId, { timestampSeconds, bookmarkId } = {}) => {
  if (!auditId) return null;
  const params = new URLSearchParams();
  if (Number.isFinite(timestampSeconds) && timestampSeconds >= 0) {
    params.set(TIMESTAMP_KEY, String(Math.floor(timestampSeconds)));
  }
  if (bookmarkId) {
    params.set(BOOKMARK_KEY, String(bookmarkId));
  }
  const qs = params.toString();
  return `${safeOrigin()}/audit/${auditId}${qs ? `?${qs}` : ''}`;
};

export const parseDeepLinkParams = (searchString) => {
  if (!searchString) return { timestampSeconds: null, bookmarkId: null };
  const params = new URLSearchParams(searchString.startsWith('?') ? searchString : `?${searchString}`);
  const rawTs = params.get(TIMESTAMP_KEY);
  const rawBm = params.get(BOOKMARK_KEY);
  return {
    timestampSeconds: toInt(rawTs),
    bookmarkId: rawBm || null,
  };
};

export const DEEP_LINK_KEYS = Object.freeze({ TIMESTAMP_KEY, BOOKMARK_KEY });
