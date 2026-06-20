import { useState, useEffect, useRef } from 'react';

const SR_ONLY_STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export const playheadSrOnlyStyle = SR_ONLY_STYLE;

export const formatPlayheadAnnouncement = (currentTime, duration) => {
  const fmt = (s) => {
    const sec = Math.max(0, Math.floor(s || 0));
    const m = Math.floor(sec / 60);
    const s2 = sec % 60;
    return `${m} minute${m === 1 ? '' : 's'} ${s2} second${s2 === 1 ? '' : 's'}`;
  };
  return `Playhead at ${fmt(currentTime)} of ${fmt(duration)}`;
};

export const usePlayheadAnnouncer = (currentTime, duration, { intervalMs = 5000 } = {}) => {
  const [announcement, setAnnouncement] = useState(() => formatPlayheadAnnouncement(currentTime, duration));
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const intervalMsRef = useRef(intervalMs);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { intervalMsRef.current = intervalMs; }, [intervalMs]);

  useEffect(() => {
    setAnnouncement(formatPlayheadAnnouncement(currentTimeRef.current, durationRef.current));
    const id = setInterval(() => {
      setAnnouncement((prev) => {
        const next = formatPlayheadAnnouncement(currentTimeRef.current, durationRef.current);
        return next === prev ? prev : next;
      });
    }, intervalMsRef.current);
    return () => clearInterval(id);
  }, []);

  return announcement;
};
