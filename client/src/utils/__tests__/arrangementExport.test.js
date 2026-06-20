import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  renderArrangementToCanvas,
  canvasToBlob,
  buildArrangementFilename,
} from '../arrangementExport.js';

const makeCtxStub = () => {
  const calls = [];
  return {
    calls,
    fillRect: vi.fn((x, y, w, h) => calls.push(['fillRect', x, y, w, h])),
    fillText: vi.fn((t, x, y) => calls.push(['fillText', t, x, y])),
    strokeRect: vi.fn((x, y, w, h) => calls.push(['strokeRect', x, y, w, h])),
    beginPath: vi.fn(() => calls.push(['beginPath'])),
    moveTo: vi.fn((x, y) => calls.push(['moveTo', x, y])),
    lineTo: vi.fn((x, y) => calls.push(['lineTo', x, y])),
    stroke: vi.fn(() => calls.push(['stroke'])),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textBaseline: '',
    lineWidth: 0,
    scale: vi.fn(),
  };
};

describe('renderArrangementToCanvas', () => {
  beforeEach(() => {
    // jsdom doesn't ship a real Canvas, so stub createElement to return
    // a fake canvas with a tracked context. The renderer only uses the
    // 2D context API we're stubbing here.
    global.document = global.document || {};
    const ctx = makeCtxStub();
    document.createElement = vi.fn((tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          style: {},
          getContext: vi.fn(() => ctx),
        };
      }
      return {};
    });
  });

  it('returns a canvas with non-zero width/height', () => {
    const canvas = renderArrangementToCanvas({ sections: [], tracks: [], song: { title: 'X' } });
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it('scales by devicePixelRatio for crisp output', () => {
    const originalDPR = global.window?.devicePixelRatio;
    global.window = { devicePixelRatio: 2 };
    const canvas = renderArrangementToCanvas({ sections: [], tracks: [] });
    expect(canvas.width).toBeGreaterThan(800);
    if (originalDPR === undefined) delete global.window;
    else global.window.devicePixelRatio = originalDPR;
  });

  it('draws at least one fillRect per section block', () => {
    const ctx = makeCtxStub();
    document.createElement = vi.fn(() => ({ width: 0, height: 0, style: {}, getContext: () => ctx }));
    renderArrangementToCanvas({
      sections: [
        { id: 'a', type: 'verse', name: 'V1', startTime: 0, duration: 30 },
        { id: 'b', type: 'chorus', name: 'C1', startTime: 30, duration: 30 },
      ],
      tracks: [],
      song: { durationSeconds: 60 },
    });
    // expect 1 background + 1 header + 1 label + 1 section-row rect per block
    const fillRects = ctx.calls.filter((c) => c[0] === 'fillRect');
    expect(fillRects.length).toBeGreaterThanOrEqual(4);
  });

  it('draws one row per track', () => {
    const ctx = makeCtxStub();
    document.createElement = vi.fn(() => ({ width: 0, height: 0, style: {}, getContext: () => ctx }));
    renderArrangementToCanvas({
      sections: [],
      tracks: [
        { id: 't1', name: 'Drums', color: '#ff0000', blocks: [{ id: 'b1', startTime: 0, duration: 10 }] },
        { id: 't2', name: 'Bass', color: '#00ff00', blocks: [{ id: 'b2', startTime: 10, duration: 20 }] },
      ],
      song: { durationSeconds: 30 },
    });
    const fillTexts = ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
    expect(fillTexts).toEqual(expect.arrayContaining(['Drums', 'Bass']));
  });

  it('handles empty data without throwing', () => {
    const ctx = makeCtxStub();
    document.createElement = vi.fn(() => ({ width: 0, height: 0, style: {}, getContext: () => ctx }));
    expect(() => renderArrangementToCanvas({ sections: [], tracks: [] })).not.toThrow();
  });

  it('handles missing song', () => {
    const ctx = makeCtxStub();
    document.createElement = vi.fn(() => ({ width: 0, height: 0, style: {}, getContext: () => ctx }));
    expect(() => renderArrangementToCanvas({ sections: [{ id: 'x', type: 'verse', startTime: 0, duration: 30 }], tracks: [] })).not.toThrow();
  });

  it('throws outside a DOM environment', () => {
    const savedDoc = global.document;
    delete global.document;
    expect(() => renderArrangementToCanvas({ sections: [], tracks: [] })).toThrow(/DOM/);
    global.document = savedDoc;
  });

  it('uses pxPerSec to scale the output width', () => {
    const ctx = makeCtxStub();
    document.createElement = vi.fn(() => ({ width: 0, height: 0, style: {}, getContext: () => ctx }));
    const a = renderArrangementToCanvas({
      sections: [{ id: 's', type: 'verse', startTime: 0, duration: 60 }],
      tracks: [],
      song: { durationSeconds: 60 },
      pxPerSec: 4,
    });
    const b = renderArrangementToCanvas({
      sections: [{ id: 's', type: 'verse', startTime: 0, duration: 60 }],
      tracks: [],
      song: { durationSeconds: 60 },
      pxPerSec: 16,
    });
    expect(b.width).toBeGreaterThan(a.width);
  });
});

describe('canvasToBlob', () => {
  it('rejects when no canvas is provided', async () => {
    await expect(canvasToBlob(null)).rejects.toThrow(/no canvas/);
  });

  it('resolves with the blob returned by canvas.toBlob', async () => {
    const fakeBlob = new Blob(['x'], { type: 'image/png' });
    const canvas = { toBlob: (cb) => cb(fakeBlob) };
    await expect(canvasToBlob(canvas)).resolves.toBe(fakeBlob);
  });

  it('rejects when toBlob yields null', async () => {
    const canvas = { toBlob: (cb) => cb(null) };
    await expect(canvasToBlob(canvas)).rejects.toThrow(/null/);
  });
});

describe('buildArrangementFilename', () => {
  it('uses the song title when present', () => {
    expect(buildArrangementFilename({ song: { title: 'My Song' } })).toBe('My_Song.png');
  });

  it('falls back to "arrangement" when no song', () => {
    expect(buildArrangementFilename({})).toBe('arrangement.png');
  });

  it('honors a custom extension', () => {
    expect(buildArrangementFilename({ song: { title: 'X' }, ext: 'pdf' })).toBe('X.pdf');
  });

  it('strips unsafe filename characters', () => {
    const name = buildArrangementFilename({ song: { title: 'a/b\\c:d*e?f"g<h>i|j' } });
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
  });

  it('truncates very long titles to <= 60 chars + ext', () => {
    const long = 'x'.repeat(200);
    const name = buildArrangementFilename({ song: { title: long } });
    const stem = name.split('.')[0];
    expect(stem.length).toBeLessThanOrEqual(60);
  });
});
