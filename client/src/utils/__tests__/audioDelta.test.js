import { describe, it, expect } from 'vitest';
import {
  __test__ as audioDeltaTest,
  referenceEnvelope,
  computeDelta,
  decodeSketchEnvelope,
} from '../audioDelta.js';

const { envelopeFromReferenceCurve, envelopeFromAudioBuffer, deltaEnvelope } = audioDeltaTest;

describe('audioDelta utility', () => {
  describe('envelopeFromReferenceCurve', () => {
    it('returns null for empty/null input', () => {
      expect(envelopeFromReferenceCurve(null, 10)).toBeNull();
      expect(envelopeFromReferenceCurve([], 10)).toBeNull();
    });

    it('clamps input to [0, 1] and rescales to target bar count', () => {
      const out = envelopeFromReferenceCurve([1.5, -0.2, 0.5, 0.7, 0.3], 10);
      expect(out).toHaveLength(10);
      out.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
      out.forEach((v) => expect(v).toBeLessThanOrEqual(1));
    });

    it('preserves count when source already matches target', () => {
      const out = envelopeFromReferenceCurve([0.1, 0.5, 0.9], 3);
      expect(out).toEqual([0.1, 0.5, 0.9]);
    });
  });

  describe('envelopeFromAudioBuffer (synthesized AudioBuffer)', () => {
    function makeFakeBuffer(samples) {
      return {
        length: samples.length,
        getChannelData: () => Float32Array.from(samples),
      };
    }

    it('returns the requested bar count and clamps to [0, 1]', () => {
      // 4800 samples → 8 bars of 600 samples each
      const fake = makeFakeBuffer(new Array(4800).fill(0).map((_, i) => Math.sin(i / 10) * 0.3));
      const out = envelopeFromAudioBuffer(fake, 8);
      expect(out).toHaveLength(8);
      out.forEach((v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      });
    });

    it('emits zeros for an empty/silent buffer', () => {
      const fake = makeFakeBuffer(new Array(1000).fill(0));
      const out = envelopeFromAudioBuffer(fake, 5);
      expect(out).toEqual([0, 0, 0, 0, 0]);
    });

    it('emits non-zero bars for a sustained non-silent signal', () => {
      // The envelope normalizes to [0, 1] against its own max, so a
      // sustained non-silent input should produce non-zero bars across
      // the board (after smoothing/normalization). This is what the
      // consumer (delta renderer) relies on.
      const fake = makeFakeBuffer(new Array(2000).fill(0).map((_, i) => Math.sin(i / 8) * 0.5));
      const out = envelopeFromAudioBuffer(fake, 6);
      const nonZero = out.filter((v) => v > 0.01).length;
      expect(nonZero).toBe(6);
    });

    it('emits zeros for an empty/silent buffer', () => {
      const fake = makeFakeBuffer(new Array(1000).fill(0));
      const out = envelopeFromAudioBuffer(fake, 5);
      expect(out).toEqual([0, 0, 0, 0, 0]);
    });
  });

  describe('deltaEnvelope', () => {
    it('returns sketch-only envelope when reference is missing', () => {
      const out = deltaEnvelope([0.1, 0.2, 0.3], null);
      expect(out).toEqual([0.1, 0.2, 0.3]);
    });

    it('returns all zeros when sketch matches reference', () => {
      const out = deltaEnvelope([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
      out.forEach((v) => expect(v).toBe(0));
    });

    it('returns the abs diff when they differ', () => {
      const out = deltaEnvelope([0.8, 0.2, 0.5], [0.2, 0.6, 0.5]);
      expect(out[0]).toBeCloseTo(0.6, 5);
      expect(out[1]).toBeCloseTo(0.4, 5);
      expect(out[2]).toBe(0);
    });

    it('handles length mismatch by padding missing slots with 0', () => {
      const out = deltaEnvelope([0.5, 0.5, 0.5], [0.5]);
      expect(out).toHaveLength(3);
      // First bar: |0.5 - 0.5| = 0; remaining bars have ref 0
      expect(out[0]).toBe(0);
      expect(out[1]).toBeCloseTo(0.5, 5);
      expect(out[2]).toBeCloseTo(0.5, 5);
    });
  });

  describe('referenceEnvelope (public API)', () => {
    it('reads energy_curve from audioAnalysis', () => {
      const song = { audioAnalysis: { energy_curve: [0.1, 0.5, 0.9] } };
      const out = referenceEnvelope(song, { bars: 6 });
      expect(out).toHaveLength(6);
      out.forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    });

    it('prefers audioOverrides.energy_curve when present', () => {
      const song = {
        audioOverrides: { energy_curve: [0.9, 0.1] },
        audioAnalysis: { energy_curve: [0.1, 0.9] },
      };
      const out = referenceEnvelope(song, { bars: 4 });
      // Should be dominated by the overrides curve (high at start, low at end)
      expect(out[0]).toBeGreaterThan(out[out.length - 1]);
    });

    it('returns null when no energy curve is present', () => {
      expect(referenceEnvelope(null)).toBeNull();
      expect(referenceEnvelope({})).toBeNull();
      expect(referenceEnvelope({ audioAnalysis: {} })).toBeNull();
    });
  });

  describe('decodeSketchEnvelope (no-network path)', () => {
    it('returns null for a missing URL', async () => {
      const out = await decodeSketchEnvelope(null);
      expect(out).toBeNull();
    });

    it('returns null on a fetch failure (404)', async () => {
      const origFetch = global.fetch;
      global.fetch = () => Promise.resolve({ ok: false, status: 404 });
      const out = await decodeSketchEnvelope('/uploads/missing.wav');
      expect(out).toBeNull();
      global.fetch = origFetch;
    });
  });

  describe('computeDelta (public alias)', () => {
    it('is functionally identical to deltaEnvelope', () => {
      const out = computeDelta([0.3, 0.7], [0.5, 0.5]);
      expect(out).toHaveLength(2);
      expect(out[0]).toBeCloseTo(0.2, 6);
      expect(out[1]).toBeCloseTo(0.2, 6);
    });
  });
});
