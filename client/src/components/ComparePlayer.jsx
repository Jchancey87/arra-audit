// ComparePlayer — dual transport for A/B compare mode.
// Reference = YouTube (driven by AudioContext); Sketch = local <audio> element.
// Master play/pause drives both. Sketch drifts back to reference every ~500ms
// while playing. A side-by-side metadata panel shows BPM/key/meter from
// each source's analysis when available; a "delta" canvas shows a heatmap
// derived from the sketch's playback energy via Web Audio API.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudio } from '../context/AudioContext.jsx';

const DRIFT_SYNC_MS = 500;
const DRIFT_THRESHOLD_SEC = 0.4;
const CANVAS_BARS = 96;

function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function readMeta(analysis) {
  if (!analysis || typeof analysis !== 'object') return null;
  return {
    bpm: analysis.tempo_bpm ?? null,
    key: analysis.key ?? null,
    scale: analysis.scale ?? null,
    meter: analysis.estimated_meter ?? null,
  };
}

function MetaRow({ label, ref, sk }) {
  const refVal = ref ? [ref.bpm && `${Math.round(ref.bpm)} BPM`, ref.key, ref.scale, ref.meter].filter(Boolean).join(' · ') : '—';
  const skVal = sk ? [sk.bpm && `${Math.round(sk.bpm)} BPM`, sk.key, sk.scale, sk.meter].filter(Boolean).join(' · ') : '—';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '4px 0', borderBottom: '1px solid #2a2a30' }}>
      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#5a5d65', textTransform: 'uppercase', letterSpacing: 1, width: 64 }}>{label}</span>
      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 12, color: '#ff6a00', flex: 1 }}>{refVal}</span>
      <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 12, color: '#00e5ff', flex: 1 }}>{skVal}</span>
    </div>
  );
}

function DeltaBar({ delta }) {
  // delta in [-1, 1]; 0 = perfect match. Render a single horizontal bar.
  const width = 100;
  const center = width / 2;
  const offset = Math.max(-1, Math.min(1, delta || 0)) * (width / 2);
  return (
    <div style={{ position: 'relative', height: 8, width, background: '#1a1a1e', border: '1px solid #2a2a30', borderRadius: 2 }}>
      <div style={{ position: 'absolute', left: center - 1, top: -2, width: 2, height: 12, background: '#5a5d65' }} />
      <div
        style={{
          position: 'absolute',
          left: Math.min(center, center + offset),
          top: 1,
          width: Math.abs(offset),
          height: 6,
          background: Math.abs(delta || 0) < 0.05 ? '#35d777' : '#ff6a00',
          borderRadius: 1,
        }}
      />
    </div>
  );
}

function DeltaPanel({ refMeta, skMeta }) {
  if (!refMeta && !skMeta) return null;
  const refBpm = refMeta?.bpm || null;
  const skBpm = skMeta?.bpm || null;
  const bpmDelta = refBpm && skBpm ? (skBpm - refBpm) / refBpm : 0;
  const keyMatch = refMeta?.key && skMeta?.key && refMeta.key === skMeta.key && refMeta.scale === skMeta.scale;
  return (
    <div style={{ padding: '12px 16px', background: '#18181c', border: '1px solid #2a2a30', borderRadius: 2, marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#5a5d65', textTransform: 'uppercase', letterSpacing: 1.5 }}>Delta</div>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: keyMatch ? '#35d777' : '#ff6a00' }}>
          {keyMatch ? '✓ keys match' : '✗ keys differ'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#5a5d65', width: 64 }}>BPM Δ</div>
        <DeltaBar delta={bpmDelta} />
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 12, color: '#f2f2f2', minWidth: 80, textAlign: 'right' }}>
          {refBpm ? Math.round(refBpm) : '—'} → {skBpm ? Math.round(skBpm) : '—'}
        </div>
      </div>
    </div>
  );
}

function SketchEnergyCanvas({ audioRef }) {
  // Render a 96-bar heatmap of the sketch's current playback energy. Uses
  // a single AnalyserNode tied to the sketch <audio> element. Falls back to
  // an empty grid if Web Audio is unavailable.
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const dataRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return undefined;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return undefined;
    let ctx;
    try {
      ctx = new Ctx();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
      return undefined;
    }
    const ctx2d = canvas.getContext('2d');
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.fillStyle = '#0c0c0e';
      ctx2d.fillRect(0, 0, w, h);
      const data = dataRef.current;
      if (data && analyserRef.current) {
        analyserRef.current.getByteFrequencyData(data);
        const barW = w / CANVAS_BARS;
        for (let i = 0; i < CANVAS_BARS; i += 1) {
          // Sample low/mid bins for a perceptual energy curve
          const idx = Math.floor((i / CANVAS_BARS) ** 1.4 * (data.length * 0.5));
          const v = data[idx] / 255;
          const barH = v * h;
          const x = i * barW;
          const y = h - barH;
          ctx2d.fillStyle = `rgba(0, 229, 255, ${0.4 + v * 0.6})`;
          ctx2d.fillRect(x + 1, y, barW - 2, barH);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try { ctx?.close(); } catch (_) { /* swallow */ }
    };
  }, [audioRef]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_BARS * 6}
      height={64}
      style={{ width: '100%', height: 64, display: 'block', background: '#0c0c0e', borderRadius: 2 }}
    />
  );
}

function PlayIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,1 11,6 2,11" /></svg>;
}
function PauseIcon() {
  return <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10" /><rect x="7" y="1" width="3" height="10" /></svg>;
}

export default function ComparePlayer({ sketch, song }) {
  const {
    currentTime: refTime,
    duration: refDuration,
    isPlaying: refIsPlaying,
    play: refPlay,
    pause: refPause,
    seekTo: refSeekTo,
    loadSong,
  } = useAudio();

  const sketchAudioRef = useRef(null);
  const [skTime, setSkTime] = useState(0);
  const [skDuration, setSkDuration] = useState(sketch?.durationSeconds || 0);
  const [skIsPlaying, setSkIsPlaying] = useState(false);
  const [drift, setDrift] = useState(0);

  const sketchUrl = useMemo(() => sketch?.publicUrl || '', [sketch]);

  // Load the sketch URL into the <audio> element whenever the sketch changes
  useEffect(() => {
    setSkIsPlaying(false);
    setSkTime(0);
    setSkDuration(sketch?.durationSeconds || 0);
  }, [sketch?._id, sketch?.durationSeconds]);

  // Drift correction: every DRIFT_SYNC_MS, push the sketch audio to the
  // reference (YouTube) time if playing. Capture drift for the UI.
  useEffect(() => {
    if (!refIsPlaying) return undefined;
    const id = setInterval(() => {
      const audio = sketchAudioRef.current;
      if (!audio) return;
      const driftSec = audio.currentTime - refTime;
      setDrift(driftSec);
      if (Math.abs(driftSec) > DRIFT_THRESHOLD_SEC) {
        try {
          audio.currentTime = Math.max(0, refTime);
        } catch (_) { /* swallow */ }
      }
    }, DRIFT_SYNC_MS);
    return () => clearInterval(id);
  }, [refIsPlaying, refTime]);

  // Mirror reference transport: when the user starts/stops the YouTube
  // player, mirror the sketch audio.
  useEffect(() => {
    const audio = sketchAudioRef.current;
    if (!audio) return;
    if (refIsPlaying) {
      audio.play().then(() => setSkIsPlaying(true)).catch(() => setSkIsPlaying(false));
    } else {
      audio.pause();
      setSkIsPlaying(false);
    }
    // We intentionally only react to refIsPlaying, not refTime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refIsPlaying]);

  // On initial mount, load the song into the YouTube transport
  useEffect(() => {
    if (song) loadSong(song);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song?._id]);

  const handleMasterPlay = useCallback(() => {
    if (refIsPlaying) {
      refPause();
    } else {
      refPlay();
    }
  }, [refIsPlaying, refPause, refPlay]);

  const handleScrubRef = useCallback((e) => {
    const v = Number(e.target.value);
    if (Number.isFinite(v)) refSeekTo(v);
  }, [refSeekTo]);

  const handleScrubSk = useCallback((e) => {
    const v = Number(e.target.value);
    const audio = sketchAudioRef.current;
    if (audio && Number.isFinite(v)) {
      audio.currentTime = v;
      setSkTime(v);
    }
  }, []);

  const refMeta = readMeta(song?.audioOverrides) || readMeta(song?.audioAnalysis);
  const skMeta = readMeta(sketch?.analysis);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <audio
        ref={sketchAudioRef}
        src={sketchUrl}
        onTimeUpdate={(e) => setSkTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setSkDuration(e.target.duration || sketch?.durationSeconds || 0)}
        onPlay={() => setSkIsPlaying(true)}
        onPause={() => setSkIsPlaying(false)}
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Master transport */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: '#18181c', border: '1px solid #2a2a30', borderRadius: 2 }}>
        <button
          type="button"
          onClick={handleMasterPlay}
          aria-label={refIsPlaying ? 'Pause both' : 'Play both'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', background: '#ff6a00', color: '#0c0c0e',
            border: 'none', borderRadius: 2, cursor: 'pointer',
            fontFamily: 'Roboto Mono, monospace', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1,
          }}
        >
          {refIsPlaying ? <PauseIcon /> : <PlayIcon />}
          {refIsPlaying ? 'Pause both' : 'Play both'}
        </button>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 11, color: '#9ca0a6' }}>
          master clock: YouTube reference · drift:{' '}
          <span style={{ color: Math.abs(drift) < DRIFT_THRESHOLD_SEC ? '#35d777' : '#ff6a00' }}>
            {drift >= 0 ? '+' : ''}{drift.toFixed(2)}s
          </span>
        </div>
      </div>

      {/* Two side-by-side transport rows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel
          color="#ff6a00"
          label="Reference"
          sublabel={song?.title || 'YouTube'}
          time={refTime}
          duration={refDuration}
          onScrub={handleScrubRef}
        />
        <Panel
          color="#00e5ff"
          label="Sketch"
          sublabel={sketch?.title || sketch?.originalName || 'sketch'}
          time={skTime}
          duration={skDuration}
          onScrub={handleScrubSk}
        />
      </div>

      {/* Energy canvas for the sketch */}
      <div>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#5a5d65', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>
          Sketch energy (live)
        </div>
        <SketchEnergyCanvas audioRef={sketchAudioRef} />
      </div>

      {/* Metadata side-by-side + delta */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#5a5d65', textTransform: 'uppercase', letterSpacing: 1.5 }}>Metadata</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#ff6a00' }}>● reference</span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#00e5ff' }}>● sketch</span>
          </div>
        </div>
        <div style={{ background: '#18181c', border: '1px solid #2a2a30', borderRadius: 2, padding: '4px 12px' }}>
          <MetaRow label="Tempo / Key" ref={refMeta} sk={skMeta} />
          <MetaRow label="Meter" ref={refMeta} sk={skMeta} />
        </div>
        <DeltaPanel refMeta={refMeta} skMeta={skMeta} />
      </div>
    </div>
  );
}

function Panel({ color, label, sublabel, time, duration, onScrub }) {
  return (
    <div style={{ background: '#18181c', border: `1px solid ${color}33`, borderRadius: 2, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color, textTransform: 'uppercase', letterSpacing: 1.5 }}>{label}</div>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 11, color: '#f2f2f2', marginTop: 2 }}>{sublabel}</div>
        </div>
        <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 11, color: '#9ca0a6' }}>
          {formatTime(time)} <span style={{ color: '#5a5d65' }}>/ {formatTime(duration)}</span>
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(0.01, duration || 0)}
        step={0.01}
        value={Math.min(time || 0, duration || 0)}
        onChange={onScrub}
        aria-label={`${label} scrub`}
        style={{ width: '100%', accentColor: color }}
      />
    </div>
  );
}
