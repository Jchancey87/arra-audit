// Normalize an audit + song pair into the shape the PDF document consumes.
// Pure function — easy to unit-test.

import { LENS_LABELS } from '../pdf/theme.js';

const TIMESTAMP_KEYS = ['timestampSeconds', 'timestamp', 'ts', 'time'];
const TEXT_KEYS = ['text', 'answer', 'value', 'response', 'content'];
const QUESTION_KEYS = ['question', 'prompt', 'label', 'q', 'name', 'title'];
const NOTE_KEYS = ['note', 'notes', 'comment', 'comments'];

function formatTimestamp(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '--:--';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function firstDefined(obj, keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function pickLensAudio(song) {
  const ovr = song?.audioOverrides;
  const ana = song?.audioAnalysis;
  if (!ovr && !ana) return {};
  return {
    tempo: ovr?.tempo_bpm ?? ana?.tempo_bpm ?? null,
    key: ovr?.key ?? ana?.key ?? null,
    scale: ovr?.scale ?? ana?.scale ?? null,
    meter: ovr?.estimated_meter ?? ana?.estimated_meter ?? null,
  };
}

function normalizeResponseEntry(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    return { question: null, answer: raw, timestamp: null, note: null };
  }
  if (typeof raw !== 'object') {
    return { question: null, answer: String(raw), timestamp: null, note: null };
  }
  const answer = firstDefined(raw, TEXT_KEYS);
  const question = firstDefined(raw, QUESTION_KEYS);
  const note = firstDefined(raw, NOTE_KEYS);
  const tsRaw = firstDefined(raw, TIMESTAMP_KEYS);
  const ts = Number.isFinite(tsRaw) ? tsRaw : null;
  if (!answer && !question && !note) return null;
  return { question: question ?? null, answer: answer ?? '', timestamp: ts, note: note ?? null };
}

function lensEntriesFor(responses, lens) {
  const bag = responses?.[lens];
  if (bag == null) return [];
  if (Array.isArray(bag)) {
    return bag.map(normalizeResponseEntry).filter(Boolean);
  }
  if (typeof bag === 'object') {
    return Object.entries(bag)
      .map(([question, value]) => {
        if (value == null) return null;
        if (typeof value === 'object' && !Array.isArray(value)) {
          return normalizeResponseEntry({ question, ...value });
        }
        return normalizeResponseEntry({ question, answer: value });
      })
      .filter(Boolean);
  }
  if (typeof bag === 'string') {
    return [{ question: null, answer: bag, timestamp: null, note: null }];
  }
  return [];
}

function normalizeBookmark(bm) {
  if (!bm) return null;
  const ts = bm.timestampSeconds ?? bm.timestamp ?? null;
  const validTs = Number.isFinite(ts) && ts >= 0 ? ts : null;
  if (validTs === null) return null;
  return {
    id: bm._id || bm.id || null,
    timestampSeconds: validTs,
    label: bm.label || '',
    note: bm.note || '',
    lens: bm.lens || null,
    createdAt: bm.createdAt || null,
  };
}

function normalizeTechnique(t) {
  if (!t) return null;
  const desc = t.description || '';
  if (!desc) return null;
  const ts = t.exampleTimestamp ?? t.timestampSeconds ?? t.timestamp ?? null;
  return {
    id: t._id || t.id || null,
    description: desc,
    lens: t.lens || null,
    exampleTimestamp: Number.isFinite(ts) ? ts : null,
    createdAt: t.createdAt || null,
  };
}

export function prepareReportData(audit, song) {
  const safe = audit || {};
  const safeSong = song || {};
  const audio = pickLensAudio(safeSong);
  const lensSelection = Array.isArray(safe.lensSelection) && safe.lensSelection.length
    ? safe.lensSelection
    : ['rhythm', 'texture', 'harmony', 'arrangement'];

  const allLenses = ['rhythm', 'texture', 'harmony', 'arrangement'];
  const lensResponses = {};
  for (const lens of allLenses) {
    lensResponses[lens] = lensEntriesFor(safe.responses, lens);
  }

  return {
    audit: {
      id: safe._id || safe.id || null,
      title: safe.title || '',
      status: safe.status || 'draft',
      workflowType: safe.workflowType || 'quick',
      completedAt: safe.completedAt || safe.updatedAt || null,
      createdAt: safe.createdAt || null,
      lensSelection,
    },
    song: {
      title: safeSong.title || 'Untitled',
      artist: safeSong.artistName || safeSong.artist || 'Unknown artist',
      duration: formatDuration(safeSong.durationSeconds),
      year: safeSong.publishedAt ? new Date(safeSong.publishedAt).getFullYear() : null,
      sourceUrl: safeSong.originalUrl || safeSong.youtubeUrl || null,
      audio,
    },
    lensResponses,
    bookmarks: Array.isArray(safe.bookmarks)
      ? safe.bookmarks.map(normalizeBookmark).filter(Boolean)
      : [],
    techniques: Array.isArray(safe.techniques)
      ? safe.techniques.map(normalizeTechnique).filter(Boolean)
      : [],
  };
}

export { formatTimestamp, formatDuration, LENS_LABELS };
