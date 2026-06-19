import { describe, it, expect } from 'vitest';
import { prepareReportData } from '../../utils/pdfData.js';

describe('prepareReportData — full data', () => {
  const audit = {
    _id: 'a1',
    title: 'The Fool on the Hill — deep dive',
    status: 'completed',
    workflowType: 'guided',
    completedAt: new Date('2026-06-15T12:00:00Z'),
    createdAt: new Date('2026-06-14T10:00:00Z'),
    lensSelection: ['rhythm', 'harmony', 'arrangement'],
    responses: {
      rhythm: [
        { question: 'Describe the pulse.', answer: 'Laid-back 4/4, swung 16ths.', timestampSeconds: 12 },
        { question: 'Any tempo irregularities?', answer: 'Bridge pulls back ~3 BPM.' },
      ],
      harmony: {
        'Chord progression': 'I – vi – IV – V in C major, with borrowed iv minor in verse 2.',
        'Voice leading': 'Stepwise bass, parallel 3rds in upper voices.',
      },
      arrangement: 'Intro–verse–chorus form, false ending before final chorus.',
      texture: [],
    },
    bookmarks: [
      { _id: 'b1', timestampSeconds: 145, label: 'Key change', note: 'Half-step up into final chorus.', lens: 'harmony' },
      { _id: 'b2', timestampSeconds: 240, note: 'Drum break', lens: 'rhythm' },
    ],
    techniques: [
      { _id: 't1', description: 'Parallel 3rds in upper voices', lens: 'harmony', exampleTimestamp: 100 },
    ],
  };

  const song = {
    _id: 's1',
    title: 'The Fool on the Hill',
    artistName: 'The Beatles',
    durationSeconds: 295,
    publishedAt: new Date('1967-09-26T00:00:00Z'),
    originalUrl: 'https://youtube.com/watch?v=foo',
    audioOverrides: { tempo_bpm: 73, key: 'C', scale: 'major', estimated_meter: '4/4' },
    audioAnalysis: { tempo_bpm: 74, key: 'C', scale: 'major', estimated_meter: '4/4' },
  };

  const data = prepareReportData(audit, song);

  it('prefers audioOverrides over audioAnalysis', () => {
    expect(data.song.audio.tempo).toBe(73);
    expect(data.song.audio.key).toBe('C');
    expect(data.song.audio.scale).toBe('major');
    expect(data.song.audio.meter).toBe('4/4');
  });

  it('formats song duration and year', () => {
    expect(data.song.duration).toBe('4:55');
    expect(data.song.year).toBe(1967);
  });

  it('carries the title and artist cleanly', () => {
    expect(data.song.title).toBe('The Fool on the Hill');
    expect(data.song.artist).toBe('The Beatles');
  });

  it('keeps the selected lens order', () => {
    expect(data.audit.lensSelection).toEqual(['rhythm', 'harmony', 'arrangement']);
  });

  it('normalizes array-shape responses (question/answer/timestamp)', () => {
    expect(data.lensResponses.rhythm).toHaveLength(2);
    expect(data.lensResponses.rhythm[0].question).toBe('Describe the pulse.');
    expect(data.lensResponses.rhythm[0].answer).toBe('Laid-back 4/4, swung 16ths.');
    expect(data.lensResponses.rhythm[0].timestamp).toBe(12);
  });

  it('normalizes object-shape responses (question-key → answer-value)', () => {
    expect(data.lensResponses.harmony).toHaveLength(2);
    expect(data.lensResponses.harmony[0].question).toBe('Chord progression');
    expect(data.lensResponses.harmony[0].answer).toMatch(/I – vi/);
  });

  it('keeps plain-string lens responses', () => {
    expect(data.lensResponses.arrangement).toHaveLength(1);
    expect(data.lensResponses.arrangement[0].answer).toMatch(/Intro–verse/);
  });

  it('drops empty lens arrays', () => {
    expect(data.lensResponses.texture).toEqual([]);
  });

  it('normalizes bookmarks with formatted timestamps', () => {
    expect(data.bookmarks).toHaveLength(2);
    expect(data.bookmarks[0].timestampSeconds).toBe(145);
    expect(data.bookmarks[0].lens).toBe('harmony');
  });

  it('normalizes techniques with example timestamps', () => {
    expect(data.techniques).toHaveLength(1);
    expect(data.techniques[0].description).toBe('Parallel 3rds in upper voices');
    expect(data.techniques[0].exampleTimestamp).toBe(100);
  });
});
