import { describe, it, expect } from 'vitest';
import { prepareReportData, formatTimestamp, formatDuration } from '../../utils/pdfData.js';

describe('prepareReportData — minimal / missing data', () => {
  it('survives empty audit and song', () => {
    const data = prepareReportData({}, {});
    expect(data.song.title).toBe('Untitled');
    expect(data.song.artist).toBe('Unknown artist');
    expect(data.song.duration).toBeNull();
    expect(data.song.audio).toEqual({});
    expect(data.bookmarks).toEqual([]);
    expect(data.techniques).toEqual([]);
    expect(data.audit.lensSelection).toEqual(['rhythm', 'texture', 'harmony', 'arrangement']);
  });

  it('falls back to null audit id and default status', () => {
    const data = prepareReportData({}, {});
    expect(data.audit.id).toBeNull();
    expect(data.audit.status).toBe('draft');
    expect(data.audit.workflowType).toBe('quick');
  });

  it('handles missing lens responses gracefully', () => {
    const data = prepareReportData({ responses: undefined }, { title: 'X', artistName: 'Y' });
    expect(data.lensResponses.rhythm).toEqual([]);
    expect(data.lensResponses.texture).toEqual([]);
    expect(data.lensResponses.harmony).toEqual([]);
    expect(data.lensResponses.arrangement).toEqual([]);
  });

  it('skips null / empty response entries', () => {
    const audit = {
      lensSelection: ['rhythm'],
      responses: { rhythm: [null, '', { answer: 'real' }, 'string answer', 42, { question: 'q' }] },
    };
    const data = prepareReportData(audit, {});
    // null and '' are dropped; { answer: 'real' } and 'string answer' and 42 and { question:'q' } kept
    expect(data.lensResponses.rhythm.length).toBeGreaterThanOrEqual(3);
    expect(data.lensResponses.rhythm.some((e) => e.answer === 'real')).toBe(true);
    expect(data.lensResponses.rhythm.some((e) => e.answer === 'string answer')).toBe(true);
    expect(data.lensResponses.rhythm.some((e) => e.answer === '42')).toBe(true);
  });

  it('filters out invalid bookmark timestamps', () => {
    const audit = {
      bookmarks: [
        { _id: 'b1', timestampSeconds: -5, label: 'bad' },
        { _id: 'b2', timestampSeconds: 'not-a-number' },
        { _id: 'b3', timestampSeconds: 200, label: 'good' },
      ],
    };
    const data = prepareReportData(audit, {});
    // Only the valid numeric one is kept
    expect(data.bookmarks).toHaveLength(1);
    expect(data.bookmarks[0].id).toBe('b3');
  });

  it('skips malformed technique entries', () => {
    const audit = {
      techniques: [null, { description: 'kept' }, {}, { description: 'kept 2' }],
    };
    const data = prepareReportData(audit, {});
    expect(data.techniques.length).toBe(2);
    expect(data.techniques[0].description).toBe('kept');
  });

  it('uses audioAnalysis when audioOverrides is missing', () => {
    const song = {
      title: 'X', artistName: 'Y',
      audioAnalysis: { tempo_bpm: 120, key: 'A', scale: 'minor', estimated_meter: '3/4' },
    };
    const data = prepareReportData({}, song);
    expect(data.song.audio.tempo).toBe(120);
    expect(data.song.audio.key).toBe('A');
    expect(data.song.audio.meter).toBe('3/4');
  });
});

describe('formatTimestamp / formatDuration', () => {
  it('formats seconds to M:SS', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(7)).toBe('0:07');
    expect(formatTimestamp(75)).toBe('1:15');
    expect(formatTimestamp(3600)).toBe('60:00');
  });

  it('returns placeholder for invalid timestamps', () => {
    expect(formatTimestamp(null)).toBe('--:--');
    expect(formatTimestamp(NaN)).toBe('--:--');
    expect(formatTimestamp(-1)).toBe('--:--');
  });

  it('formats duration similarly', () => {
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(undefined)).toBeNull();
  });
});
