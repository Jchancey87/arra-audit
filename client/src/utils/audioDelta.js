// audioDelta — decode a sketch's audio buffer and produce a per-bar energy
// envelope, then compare against the reference song's energy curve (already
// extracted server-side) to render an abs-diff waveform.
//
// Web Audio decode path:
//   1. fetch the sketch URL → ArrayBuffer
//   2. AudioContext.decodeAudioData → AudioBuffer
//   3. Downsample to N bars by RMS over a window of (samples / N)
//   4. Normalize to [0, 1]
//
// Reference curve path:
//   1. Use song.audioAnalysis.energy_curve (already an array of floats in [0, 1])
//   2. Resample to N bars via linear interpolation
//   3. Compare against the sketch envelope to produce a delta

const DEFAULT_BARS = 96;

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function envelopeFromAudioBuffer(audioBuffer, bars) {
  const channel = audioBuffer.getChannelData(0); // mono mix
  const samplesPerBar = Math.max(1, Math.floor(channel.length / bars));
  const out = new Array(bars);
  for (let i = 0; i < bars; i += 1) {
    const start = i * samplesPerBar;
    const end = Math.min(channel.length, start + samplesPerBar);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j += 1) {
      const v = channel[j];
      sum += v * v;
      count += 1;
    }
    const rms = count > 0 ? Math.sqrt(sum / count) : 0;
    out[i] = clamp01(rms * 3.5); // perceptual boost
  }
  // Light smoothing
  for (let i = 1; i < out.length; i += 1) {
    out[i] = (out[i] + out[i - 1]) / 2;
  }
  // Normalize
  let max = 0;
  for (let i = 0; i < out.length; i += 1) if (out[i] > max) max = out[i];
  if (max > 0) for (let i = 0; i < out.length; i += 1) out[i] = out[i] / max;
  return out;
}

function envelopeFromReferenceCurve(curve, bars) {
  if (!Array.isArray(curve) || curve.length === 0) return null;
  if (curve.length === bars) return curve.map(clamp01);
  // Linear interp from curve.length -> bars
  const out = new Array(bars);
  for (let i = 0; i < bars; i += 1) {
    const t = (i / Math.max(1, bars - 1)) * (curve.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(curve.length - 1, lo + 1);
    const frac = t - lo;
    const v = curve[lo] * (1 - frac) + curve[hi] * frac;
    out[i] = clamp01(v);
  }
  return out;
}

function deltaEnvelope(sketchEnv, refEnv) {
  if (!sketchEnv) return null;
  if (!refEnv) {
    // No reference → return sketch envelope as-is; renderer treats null
    // differently but a value lets the consumer still paint something.
    return sketchEnv.map((v) => v);
  }
  const bars = Math.max(sketchEnv.length, refEnv.length);
  const out = new Array(bars);
  for (let i = 0; i < bars; i += 1) {
    const sk = sketchEnv[i] || 0;
    const rf = refEnv[i] || 0;
    out[i] = clamp01(Math.abs(sk - rf));
  }
  return out;
}

let cachedContext = null;
function getAudioContext() {
  if (cachedContext) return cachedContext;
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    cachedContext = new Ctx();
  } catch (_) {
    cachedContext = null;
  }
  return cachedContext;
}

export async function decodeSketchEnvelope(url, { bars = DEFAULT_BARS, signal } = {}) {
  if (!url) return null;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const ctx = getAudioContext();
    if (!ctx) return null;
    const audioBuffer = await new Promise((resolve, reject) => {
      // Modern API: ctx.decodeAudioData(arrayBuffer) → Promise<AudioBuffer>
      // Older API: with success/error callbacks
      const out = ctx.decodeAudioData(buf, resolve, reject);
      if (out && typeof out.then === 'function') out.then(resolve, reject);
    });
    return envelopeFromAudioBuffer(audioBuffer, bars);
  } catch (e) {
    if (e && e.name === 'AbortError') return null;
    return null;
  }
}

export function referenceEnvelope(song, { bars = DEFAULT_BARS } = {}) {
  if (!song) return null;
  const curve = song.audioOverrides?.energy_curve
    || song.audioAnalysis?.energy_curve
    || null;
  return envelopeFromReferenceCurve(curve, bars);
}

export function computeDelta(sketchEnv, refEnv) {
  return deltaEnvelope(sketchEnv, refEnv);
}

export const __test__ = {
  envelopeFromAudioBuffer,
  envelopeFromReferenceCurve,
  deltaEnvelope,
  DEFAULT_BARS,
};
