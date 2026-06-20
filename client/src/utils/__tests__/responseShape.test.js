import { describe, it, expect } from 'vitest';
import {
  normalizeResponse,
  extractText,
  extractTimestamp,
  isTaggedResponse,
  isEmptyResponse,
  withTimestamp,
  withText,
  formatTimestampLabel,
} from '../responseShape';

describe('normalizeResponse', () => {
  it('returns empty default for null/undefined', () => {
    expect(normalizeResponse(null)).toEqual({ text: '', timestampSeconds: null });
    expect(normalizeResponse(undefined)).toEqual({ text: '', timestampSeconds: null });
  });

  it('passes through plain strings with null timestamp', () => {
    expect(normalizeResponse('hello world')).toEqual({
      text: 'hello world',
      timestampSeconds: null,
    });
  });

  it('reads text and timestampSeconds from object shape', () => {
    expect(normalizeResponse({ text: 'boom', timestampSeconds: 145 })).toEqual({
      text: 'boom',
      timestampSeconds: 145,
    });
  });

  it('rejects negative or non-finite timestamps', () => {
    expect(normalizeResponse({ text: 'x', timestampSeconds: -1 })).toEqual({
      text: 'x',
      timestampSeconds: null,
    });
    expect(normalizeResponse({ text: 'x', timestampSeconds: 'nope' })).toEqual({
      text: 'x',
      timestampSeconds: null,
    });
    expect(normalizeResponse({ text: 'x', timestampSeconds: NaN })).toEqual({
      text: 'x',
      timestampSeconds: null,
    });
  });

  it('coerces non-string text to empty', () => {
    expect(normalizeResponse({ text: 42, timestampSeconds: 0 })).toEqual({
      text: '',
      timestampSeconds: 0,
    });
  });

  it('coerces non-string non-object values to string text', () => {
    expect(normalizeResponse(42)).toEqual({ text: '42', timestampSeconds: null });
    expect(normalizeResponse(true)).toEqual({ text: 'true', timestampSeconds: null });
  });
});

describe('extractText', () => {
  it('returns string for string input', () => {
    expect(extractText('hello')).toBe('hello');
  });
  it('returns nested text for object input', () => {
    expect(extractText({ text: 'inner', timestampSeconds: 5 })).toBe('inner');
  });
  it('returns empty for null', () => {
    expect(extractText(null)).toBe('');
  });
});

describe('extractTimestamp', () => {
  it('returns null for string', () => {
    expect(extractTimestamp('hello')).toBe(null);
  });
  it('returns number for object', () => {
    expect(extractTimestamp({ text: '', timestampSeconds: 90 })).toBe(90);
  });
  it('returns null for null', () => {
    expect(extractTimestamp(null)).toBe(null);
  });
});

describe('isTaggedResponse', () => {
  it('is false for untagged string', () => {
    expect(isTaggedResponse('just text')).toBe(false);
  });
  it('is true for object with valid timestamp', () => {
    expect(isTaggedResponse({ text: 'x', timestampSeconds: 30 })).toBe(true);
  });
  it('is false for object with null timestamp', () => {
    expect(isTaggedResponse({ text: 'x', timestampSeconds: null })).toBe(false);
  });
  it('is false for null', () => {
    expect(isTaggedResponse(null)).toBe(false);
  });
});

describe('isEmptyResponse', () => {
  it('is true for empty string', () => {
    expect(isEmptyResponse('')).toBe(true);
  });
  it('is true for whitespace-only', () => {
    expect(isEmptyResponse('   \n  ')).toBe(true);
  });
  it('is true for empty object', () => {
    expect(isEmptyResponse({ text: '', timestampSeconds: null })).toBe(true);
  });
  it('is false for text', () => {
    expect(isEmptyResponse('content')).toBe(false);
  });
  it('is false for timestamp-only', () => {
    expect(isEmptyResponse({ text: '', timestampSeconds: 5 })).toBe(false);
  });
});

describe('withTimestamp', () => {
  it('preserves text and sets timestamp', () => {
    expect(withTimestamp('hello', 60)).toEqual({ text: 'hello', timestampSeconds: 60 });
  });
  it('overrides previous timestamp', () => {
    expect(withTimestamp({ text: 'a', timestampSeconds: 5 }, 99)).toEqual({
      text: 'a',
      timestampSeconds: 99,
    });
  });
  it('clears timestamp when null', () => {
    expect(withTimestamp({ text: 'a', timestampSeconds: 5 }, null)).toEqual({
      text: 'a',
      timestampSeconds: null,
    });
  });
  it('rejects invalid timestamps', () => {
    expect(withTimestamp('hi', -1)).toEqual({ text: 'hi', timestampSeconds: null });
    expect(withTimestamp('hi', 'bad')).toEqual({ text: 'hi', timestampSeconds: null });
  });
});

describe('withText', () => {
  it('preserves timestamp and replaces text', () => {
    expect(withText({ text: 'old', timestampSeconds: 30 }, 'new')).toEqual({
      text: 'new',
      timestampSeconds: 30,
    });
  });
  it('null timestamp preserved when starting from string', () => {
    expect(withText('just text', 'more text')).toEqual({
      text: 'more text',
      timestampSeconds: null,
    });
  });
  it('coerces non-string text to empty', () => {
    expect(withText('hi', null)).toEqual({ text: '', timestampSeconds: null });
  });
});

describe('formatTimestampLabel', () => {
  it('formats under a minute', () => {
    expect(formatTimestampLabel(45)).toBe('0:45');
  });
  it('formats minutes and seconds', () => {
    expect(formatTimestampLabel(145)).toBe('2:25');
  });
  it('pads single-digit seconds', () => {
    expect(formatTimestampLabel(63)).toBe('1:03');
  });
  it('returns 0:00 for invalid input', () => {
    expect(formatTimestampLabel(NaN)).toBe('0:00');
    expect(formatTimestampLabel(-1)).toBe('0:00');
    expect(formatTimestampLabel(null)).toBe('0:00');
  });
  it('floors fractional seconds', () => {
    expect(formatTimestampLabel(145.9)).toBe('2:25');
  });
});
