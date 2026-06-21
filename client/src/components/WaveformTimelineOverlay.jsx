import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';
import Spectrogram from 'wavesurfer.js/dist/plugins/spectrogram.js';

/**
 * Waveform timeline overlay backed by wavesurfer.js.
 *
 * Per the production skill rules:
 *  - Container isolation: useRef, not string selectors
 *  - Zero-leak lifecycle: ws.destroy() in the cleanup hook
 *  - Decoupled plugin instantiation: TimelinePlugin + RegionsPlugin
 *    created via .create() before WaveSurfer.create()
 *  - Explicit container separation: TimelinePlugin gets a dedicated
 *    timelineRef (not auto-injected into the main waveform container)
 *  - Decoded math guard: regions.addRegion() only after `decode` fires
 *  - Single <audio> ownership: the parent AudioContext owns ONE <audio>
 *    element. We attach wavesurfer to it via the `media:` option so
 *    waveform + transport share the same MediaElement (no double-load,
 *    no drift, no second Web Audio context).
 *
 * Props:
 *   - audioRef: React ref to the shared <audio> HTMLAudioElement
 *   - regions: array of generic region descriptors:
 *       { id, start, end, color, label, drag?, resize?, selected? }
 *   - pxPerSec: zoom level (pixels per second)
 *   - currentTime: (unused for seek — playhead is implicit via media:)
 *       kept for API compatibility.
 *   - onRegionClick(regionId, e), onRegionUpdate(regionId, { start, end })
 *   - waveHeight: optional height for the waveform (default 80)
 *   - showTimeline: optional bool to render the TimelinePlugin ruler (default true)
 */
const hexToRgba = (hex, opacity = 0.25) => {
  if (!hex) return `rgba(255, 102, 0, ${opacity})`;
  if (hex.startsWith('rgba')) {
    return hex.replace(/[\d.]+\)$/, `${opacity})`);
  }
  if (hex.startsWith('#')) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result
      ? `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`
      : `rgba(255, 102, 0, ${opacity})`;
  }
  return hex;
};

const WaveformTimelineOverlay = ({
  audioRef,
  regions = [],
  pxPerSec = 6,
  currentTime,
  onRegionClick,
  onRegionUpdate,
  onRegionCreate,
  waveHeight = 80,
  showTimeline = true,
  spectrogram = false,
  paddingLeft = 0,
  dragSelectEnabled = false,
  loopRegionId = null,
}) => {
  const waveformRef = useRef(null);
  const timelineRef = useRef(null);
  const spectrogramRef = useRef(null);
  const wsRef = useRef(null);
  const regionsRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const loopRegionIdRef = useRef(loopRegionId);

  useEffect(() => {
    loopRegionIdRef.current = loopRegionId;
  }, [loopRegionId]);

  // ---- Create / destroy waveSurfer (once the <audio> ref is populated) ----
  useEffect(() => {
    const waveformEl = waveformRef.current;
    const timelineEl = timelineRef.current;
    const spectrogramEl = spectrogramRef.current;
    const media = audioRef?.current;
    if (!waveformEl || !media) return;
    if (showTimeline && !timelineEl) return;
    if (spectrogram && !spectrogramEl) return;

    const plugins = [];

    let timeline = null;
    if (showTimeline) {
      timeline = TimelinePlugin.create({
        container: timelineEl,
        height: 22,
      });
      plugins.push(timeline);
    }

    const regionsPlugin = RegionsPlugin.create();
    regionsRef.current = regionsPlugin;
    plugins.push(regionsPlugin);

    if (spectrogram) {
      const spectrogramPlugin = Spectrogram.create({
        container: spectrogramEl,
        labels: true,
        height: waveHeight,
        splitChannels: false,
        scale: 'mel',
        fftSamples: 1024,
        labelsBackground: 'rgba(0, 0, 0, 0.4)',
        useWebWorker: true,
      });
      plugins.push(spectrogramPlugin);
    }

    const ws = WaveSurfer.create({
      container: waveformEl,
      media,                              // attach to the shared <audio>
      waveColor: spectrogram ? 'transparent' : 'rgba(255, 102, 0, 0.35)',
      progressColor: spectrogram ? 'transparent' : 'rgba(255, 102, 0, 0.65)',
      cursorColor: '#00e5ff',
      cursorWidth: 1.5,
      height: waveHeight,
      barWidth: spectrogram ? 0 : 2,
      barGap: spectrogram ? 0 : 1,
      barRadius: spectrogram ? 0 : 2,
      normalize: true,
      minPxPerSec: pxPerSec,
      fillParent: true,
      hideScrollbar: false,
      autoScroll: true,
      autoCenter: false,
      interact: false,
      plugins,
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      setIsReady(true);
    });

    ws.on('decode', () => {
      setIsReady(true);
    });

    regionsPlugin.on('region-clicked', (region, e) => {
      e.stopPropagation();
      onRegionClick?.(region.id, e);
    });

    regionsPlugin.on('region-update-end', (region) => {
      onRegionUpdate?.(region.id, { start: region.start, end: region.end });
    });

    regionsPlugin.on('region-created', (region) => {
      const { start, end } = region;
      try { region.remove(); } catch (_) {}
      onRegionCreate?.({ start, end });
    });

    let activeRegion = null;
    regionsPlugin.on('region-in', (region) => {
      activeRegion = region;
    });

    regionsPlugin.on('region-out', (region) => {
      if (activeRegion === region && loopRegionIdRef.current === region.id) {
        region.play();
      } else if (activeRegion === region) {
        activeRegion = null;
      }
    });

    return () => {
      setIsReady(false);
      try { ws.destroy(); } catch (_) { /* already torn down */ }
      wsRef.current = null;
      regionsRef.current = null;
    };
  // We intentionally only re-create when the underlying <audio> element
  // identity changes (i.e. when a new song loads), not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef?.current?.src, showTimeline, waveHeight, spectrogram]);

  // ---- Keep zoom in sync ----
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try { ws.zoom(pxPerSec); } catch (_) { /* not yet ready */ }
  }, [pxPerSec]);

  // ---- Sync drag selection state ----
  useEffect(() => {
    const regionsPlugin = regionsRef.current;
    if (!regionsPlugin || !isReady) return;

    let disableDrag = null;
    if (dragSelectEnabled) {
      disableDrag = regionsPlugin.enableDragSelection({
        color: 'rgba(255, 102, 0, 0.1)',
      });
    }

    return () => {
      if (disableDrag) {
        try { disableDrag(); } catch (_) {}
      }
    };
  }, [dragSelectEnabled, isReady]);

  // ---- Sync regions when the regions prop changes ----
  useEffect(() => {
    const regionsPlugin = regionsRef.current;
    const ws = wsRef.current;
    if (!regionsPlugin || !ws || !isReady) return;

    regionsPlugin.clearRegions();
    const dur = ws.getDuration();

    regions.forEach((r) => {
      const start = Number.isFinite(r.start) ? r.start : 0;
      const rawEnd = Number.isFinite(r.end) ? r.end : (start + (r.duration || 2));
      const end = Math.min(dur || rawEnd, rawEnd);
      const isSel = r.selected;
      const opacity = r.opacity !== undefined ? r.opacity : (isSel ? 0.45 : 0.25);
      const colorWithOpacity = hexToRgba(r.color, opacity);

      const region = regionsPlugin.addRegion({
        id: r.id,
        start: Math.max(0, start),
        end: Math.max(start + 0.1, end),
        color: colorWithOpacity,
        drag: r.drag !== false,
        resize: Boolean(r.resize),
        content: r.label || '',
      });

      if (region.element) {
        region.element.style.borderLeft = `3px solid ${r.color || 'rgba(255, 102, 0, 0.5)'}`;
        region.element.style.borderRadius = '2px';
        region.element.style.fontSize = '10px';
        region.element.style.fontFamily = '"Roboto Mono", monospace';
        region.element.style.fontWeight = isSel ? 'bold' : 'normal';
        region.element.style.color = 'rgba(255,255,255,0.9)';
        region.element.style.paddingLeft = '6px';
        region.element.style.display = 'flex';
        region.element.style.alignItems = 'center';
        region.element.style.overflow = 'hidden';
        region.element.style.cursor = isSel ? 'col-resize' : 'pointer';
        region.element.style.pointerEvents = 'auto';
      }
    });
  }, [regions, isReady]);

  // NOTE: playhead sync is implicit — wavesurfer reads currentTime from the
  // shared <audio> element via the `media:` option, so no manual setTime()
  // is needed (and doing so would fight the audio engine).

  return (
    <div style={{ position: 'relative', width: '100%', paddingLeft: paddingLeft, boxSizing: 'border-box' }}>
      {spectrogram && (
        <div
          ref={spectrogramRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${waveHeight}px`,
            zIndex: 0,
            background: 'var(--bg-surface-0)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        ref={waveformRef}
        style={{
          width: '100%',
          position: 'relative',
          zIndex: 1,
        }}
      />
      {showTimeline && (
        <div
          ref={timelineRef}
          style={{
            width: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        />
      )}
    </div>
  );
};

export default WaveformTimelineOverlay;
