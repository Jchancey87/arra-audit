import React, { useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline.js';

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
 *   - sections, selectedBlockId, pxPerSec, currentTime: visual state
 *   - onRegionClick, onRegionUpdate: region events
 */
const WaveformTimelineOverlay = ({
  audioRef,
  sections,
  selectedBlockId,
  pxPerSec,
  currentTime,
  onRegionClick,
  onRegionUpdate,
}) => {
  const waveformRef = useRef(null);
  const timelineRef = useRef(null);
  const wsRef = useRef(null);
  const regionsRef = useRef(null);
  const isReadyRef = useRef(false);

  // ---- Create / destroy waveSurfer (once the <audio> ref is populated) ----
  useEffect(() => {
    const waveformEl = waveformRef.current;
    const timelineEl = timelineRef.current;
    const media = audioRef?.current;
    if (!waveformEl || !timelineEl || !media) return;

    const timeline = TimelinePlugin.create({
      container: timelineEl,
      height: 22,
    });

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: waveformEl,
      media,                              // attach to the shared <audio>
      waveColor: 'rgba(255, 102, 0, 0.35)',
      progressColor: 'rgba(255, 102, 0, 0.65)',
      cursorColor: '#00e5ff',
      cursorWidth: 1.5,
      height: 80,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      minPxPerSec: pxPerSec,
      fillParent: true,
      hideScrollbar: false,
      autoScroll: true,
      autoCenter: false,
      interact: false,
      plugins: [timeline, regions],
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      isReadyRef.current = true;
    });

    ws.on('decode', () => {
      isReadyRef.current = true;
    });

    regions.on('region-clicked', (region, e) => {
      e.stopPropagation();
      const sectionId = region.id.replace('section-', '');
      onRegionClick?.(sectionId);
    });

    regions.on('region-updated', (region) => {
      const sectionId = region.id.replace('section-', '');
      onRegionUpdate?.(sectionId, { start: region.start, end: region.end });
    });

    return () => {
      isReadyRef.current = false;
      ws.destroy();
      wsRef.current = null;
      regionsRef.current = null;
    };
  // We intentionally only re-create when the underlying <audio> element
  // identity changes (i.e. when a new song loads), not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef?.current?.src]);

  // ---- Keep zoom in sync ----
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    try { ws.zoom(pxPerSec); } catch (_) { /* not yet ready */ }
  }, [pxPerSec]);

  // ---- Sync regions when sections change ----
  useEffect(() => {
    const regions = regionsRef.current;
    const ws = wsRef.current;
    if (!regions || !ws || !isReadyRef.current) return;

    regions.clearRegions();
    const dur = ws.getDuration();

    sections.forEach((section) => {
      const start = section.startTime || 0;
      const end = Math.min(dur || start + 1, start + Math.max(1, section.duration || 30));
      const color = TYPE_COLORS[section.type] || TYPE_COLORS.custom;
      const isSel = section.id === selectedBlockId;

      const region = regions.addRegion({
        id: `section-${section.id}`,
        start,
        end,
        color: isSel ? `${color}55` : `${color}20`,
        drag: true,
        resize: isSel,
        content: section.name || '',
      });

      if (region.element) {
        region.element.style.borderLeft = `3px solid ${color}`;
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
      }
    });
  }, [sections, selectedBlockId]);

  // NOTE: playhead sync is implicit — wavesurfer reads currentTime from the
  // shared <audio> element via the `media:` option, so no manual setTime()
  // is needed (and doing so would fight the audio engine).

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div ref={waveformRef} style={{ width: '100%' }} />
      <div ref={timelineRef} style={{ width: '100%' }} />
    </div>
  );
};

const TYPE_COLORS = {
  intro:        '#a78bfa',
  verse:        '#34d399',
  chorus:       '#22d3ee',
  bridge:       '#fbbf24',
  outro:        '#ffd700',
  'pre-chorus': '#ff6f61',
  solo:         '#ff6600',
  custom:       '#f472b6',
};

export default WaveformTimelineOverlay;
