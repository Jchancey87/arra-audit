/**
 * Phase 2.2 — Timestamped responses + scrollytelling helpers.
 *
 * Audit.responses is a Mixed map keyed by question id. Pre-2.2 the value
 * was always a plain string. As of 2.2 an answer may optionally be tagged
 * with the playback time it refers to, in which case the stored shape is:
 *
 *   { text: string, timestampSeconds: number | null }
 *
 * Legacy string values are still allowed and treated as untagged. This
 * module provides the small set of normalizers the UI uses to read/write
 * both shapes uniformly.
 */

const TEXT_KEY = 'text';
const TS_KEY = 'timestampSeconds';

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export const normalizeResponse = (value) => {
  if (value === null || value === undefined) {
    return { text: '', timestampSeconds: null };
  }
  if (typeof value === 'string') {
    return { text: value, timestampSeconds: null };
  }
  if (isObject(value)) {
    const text = typeof value[TEXT_KEY] === 'string' ? value[TEXT_KEY] : '';
    const rawTs = value[TS_KEY];
    const timestampSeconds = Number.isFinite(rawTs) && rawTs >= 0 ? rawTs : null;
    return { text, timestampSeconds };
  }
  return { text: String(value), timestampSeconds: null };
};

export const extractText = (value) => normalizeResponse(value).text;

export const extractTimestamp = (value) => normalizeResponse(value).timestampSeconds;

export const isTaggedResponse = (value) => {
  const ts = extractTimestamp(value);
  return Number.isFinite(ts) && ts >= 0;
};

export const isEmptyResponse = (value) => {
  const { text, timestampSeconds } = normalizeResponse(value);
  return text.trim().length === 0 && timestampSeconds === null;
};

export const withTimestamp = (value, timestampSeconds) => {
  const { text } = normalizeResponse(value);
  if (timestampSeconds === null || timestampSeconds === undefined) {
    return { text, timestampSeconds: null };
  }
  if (Number.isFinite(timestampSeconds) && timestampSeconds >= 0) {
    return { text, timestampSeconds };
  }
  return { text, timestampSeconds: null };
};

export const withText = (value, text) => {
  const { timestampSeconds } = normalizeResponse(value);
  return { text: typeof text === 'string' ? text : '', timestampSeconds };
};

export const formatTimestampLabel = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};
