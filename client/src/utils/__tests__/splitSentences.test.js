import { describe, it, expect } from 'vitest';
import { splitSentences } from '../splitSentences.js';

describe('splitSentences', () => {
  it('splits on terminal punctuation followed by capital letter', () => {
    expect(splitSentences('First. Second. Third.')).toEqual(['First.', 'Second.', 'Third.']);
  });

  it('splits on ? and ! the same way', () => {
    expect(splitSentences('Who is this? It is the drop!'))
      .toEqual(['Who is this?', 'It is the drop!']);
  });

  it('splits on double newlines as paragraph breaks', () => {
    const text = 'First paragraph one.\n\nSecond paragraph two.';
    expect(splitSentences(text)).toEqual([
      'First paragraph one.',
      'Second paragraph two.',
    ]);
  });

  it('returns a single sentence when no terminators are present', () => {
    expect(splitSentences('Just one flowing thought without terminators')).toEqual([
      'Just one flowing thought without terminators',
    ]);
  });

  it('returns empty array for empty / non-string input', () => {
    expect(splitSentences('')).toEqual([]);
    expect(splitSentences(null)).toEqual([]);
    expect(splitSentences(undefined)).toEqual([]);
    expect(splitSentences(42)).toEqual([]);
  });

  it('does not split after a decimal number', () => {
    const out = splitSentences('BPM is 90.5 today. The groove is tight.');
    expect(out).toEqual(['BPM is 90.5 today.', 'The groove is tight.']);
  });

  it('normalizes CRLF line endings', () => {
    const out = splitSentences('One line.\r\nSecond line.\r\n\r\nNew paragraph.');
    expect(out).toEqual(['One line.', 'Second line.', 'New paragraph.']);
  });
});
