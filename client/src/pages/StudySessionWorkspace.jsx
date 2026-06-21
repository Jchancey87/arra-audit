import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import ArrangementTimelineWidget from '../components/ArrangementTimelineWidget';
import UniversalWaveformBar from '../components/UniversalWaveformBar';
import { SECTION_TYPE_COLORS } from '../components/audit/lensConstants';

const getLensStyle = (lens) => {
  switch (lens?.toLowerCase()) {
    case 'harmony':
      return { background: 'rgba(124, 58, 237, 0.15)', color: '#c084fc', border: '1px solid rgba(124, 58, 237, 0.3)' };
    case 'rhythm':
      return { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' };
    case 'texture':
      return { background: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: '1px solid rgba(6, 182, 212, 0.3)' };
    case 'form':
      return { background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' };
    case 'arrangement':
      return { background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' };
    default:
      return { background: '#282828', color: '#8a8a8a', border: '1px solid #383838' };
  }
};

// Inline transport row in the Reference Signal panel. Used for texture /
// harmony / rhythm / melody lens days where the global MonitorPortal is
// hidden and there is no wavesurfer timeline. Mirrors the styling of the
// MonitorPortal's button row so the two surfaces feel consistent.
const transportBtnStyle = {
  flex: 1,
  padding: '4px 6px',
  fontSize: '10px',
  fontFamily: 'Roboto Mono',
  background: 'transparent',
  color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '2px',
  cursor: 'pointer',
};

const StudySessionWorkspace = () => {
  const { dayNumber } = useParams();
  const dayNum = parseInt(dayNumber, 10);
  const navigate = useNavigate();
  const backend = useBackend();
  const { loadSong, activeSong, setShowVideo, togglePlay, isPlaying, currentTime, duration, seekTo, audioError } = useAudio();

  // Format seconds as M:SS for the inline player's time read-out.
  const fmt = (s) => {
    const n = Math.max(0, Math.floor(Number(s) || 0));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  };
  const hasPlayableAudio = Boolean(activeSong?.publicUrl) && !audioError;

  // React states
  const [activeProgress, setActiveProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Search/linking states
  const [existingSongs, setExistingSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importStep, setImportStep] = useState(0);

  // Responses & uploader states
  const [responses, setResponses] = useState({});
  const [syncTechnique, setSyncTechnique] = useState(true);
  const [videoOpen, setVideoOpen] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Recovery for legacy songs stuck with publicUrl=null
  const [recovering, setRecovering] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  // Core update/autosave functions
  const handleResponseChange = useCallback((key, value) => {
    setResponses(prev => ({ ...prev, [key]: value }));
  }, []);

  const saveDraft = useCallback(async (responsesToSave = responses) => {
    if (!activeProgress?._id) return;
    try {
      setSaving(true);
      setError('');
      const updated = await backend.saveDayProgress(activeProgress._id, dayNum, responsesToSave);
      setActiveProgress(updated);
    } catch (err) {
      console.error(err);
      setError('Failed to save draft responses.');
    } finally {
      setSaving(false);
    }
  }, [backend, activeProgress?._id, dayNum, responses]);

  const saveNow = useCallback(async (updatedResponses) => {
    setResponses(prev => {
      const next = { ...prev, ...updatedResponses };
      saveDraft(next);
      return next;
    });
  }, [saveDraft]);

  // Universal waveform regions — arrangement sections from the day's
  // responses (present on arrangement/form days; empty on other lens days,
  // where the waveform still renders with just the timeline + transport).
  const waveformRegions = useMemo(() => {
    const regions = [];
    const raw = responses['arrangement-timeline'];
    let sections = [];
    try { sections = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
    catch { sections = []; }
    sections.forEach((sec) => {
      regions.push({
        id: sec.id,
        start: sec.startTime || 0,
        end: (sec.startTime || 0) + Math.max(1, sec.duration || 30),
        color: sec.color || SECTION_TYPE_COLORS[sec.type] || SECTION_TYPE_COLORS.custom,
        label: sec.name || '',
        drag: true,
        resize: true,
        selected: false,
        opacity: sec.opacity !== undefined ? sec.opacity : 0.25,
        notes: sec.notes || '',
        type: sec.type || 'custom',
      });
    });
    return regions;
  }, [responses]);

  const handleWaveformRegionClick = useCallback((regionId) => {
    if (!regionId) return;
    const raw = responses['arrangement-timeline'];
    let sections = [];
    try { sections = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
    catch { sections = []; }
    const sec = sections.find(s => s.id === regionId);
    if (sec) seekTo(sec.startTime || 0);
  }, [responses, seekTo]);

  const handleWaveformRegionUpdate = useCallback((regionId, { start, end }) => {
    if (!regionId) return;
    let arr = [];
    const raw = responses['arrangement-timeline'];
    if (raw) {
      try { arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
      catch { arr = []; }
    }
    const secIdx = arr.findIndex(s => s.id === regionId);
    if (secIdx !== -1) {
      const duration = Math.max(1, Math.round(end - start));
      const updated = {
        ...arr[secIdx],
        startTime: Math.max(0, Math.floor(start)),
        duration,
      };
      const newArr = [...arr];
      newArr[secIdx] = updated;
      saveNow({ 'arrangement-timeline': JSON.stringify(newArr) });
    }
  }, [responses, saveNow]);

  const handleWaveformRegionChange = useCallback((regionId, fields) => {
    if (!regionId) return;
    let arr = [];
    const raw = responses['arrangement-timeline'];
    if (raw) {
      try { arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
      catch { arr = []; }
    }
    const secIdx = arr.findIndex(s => s.id === regionId);
    if (secIdx !== -1) {
      const updated = {
        ...arr[secIdx],
        ...(fields.label !== undefined ? { name: fields.label } : {}),
        ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
        ...(fields.color !== undefined ? { color: fields.color } : {}),
        ...(fields.opacity !== undefined ? { opacity: fields.opacity } : {}),
        ...(fields.type !== undefined ? { type: fields.type } : {}),
      };
      const newArr = [...arr];
      newArr[secIdx] = updated;
      saveNow({ 'arrangement-timeline': JSON.stringify(newArr) });
    }
  }, [responses, saveNow]);

  const handleWaveformRegionDelete = useCallback((regionId) => {
    if (!regionId) return;
    let arr = [];
    const raw = responses['arrangement-timeline'];
    if (raw) {
      try { arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
      catch { arr = []; }
    }
    const newArr = arr.filter(s => s.id !== regionId);
    saveNow({ 'arrangement-timeline': JSON.stringify(newArr) });
  }, [responses, saveNow]);

  const handleWaveformRegionCreate = useCallback(({ start, end }) => {
    let arr = [];
    const raw = responses['arrangement-timeline'];
    if (raw) {
      try { arr = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []); }
      catch { arr = []; }
    }
    const block = {
      id: `sec-${Date.now()}`,
      name: 'New Section',
      type: 'verse',
      startTime: Math.max(0, Math.floor(start)),
      duration: Math.max(1, Math.round(end - start)),
      notes: '',
    };
    saveNow({ 'arrangement-timeline': JSON.stringify([...arr, block]) });
  }, [responses, saveNow]);

  const handleRedownloadAudio = useCallback(async () => {
    if (!activeSong?._id || recovering) return;
    setRecovering(true);
    setRecoveryError('');
    try {
      const { song: fresh } = await backend.redownloadSongAudio(activeSong._id);
      loadSong(fresh);
    } catch (err) {
      const data = err.response?.data;
      setRecoveryError(data?.message || err.message || 'Audio re-download failed');
    } finally {
      setRecovering(false);
    }
  }, [activeSong?._id, recovering, backend, loadSong]);


  // Disable global video overlay during active session
  useEffect(() => {
    setShowVideo(false);
    return () => setShowVideo(true);
  }, [setShowVideo]);

  // Load progress and library songs on day change
  useEffect(() => {
    loadProgress();
    loadSongs();
  }, [dayNum]);

  const loadProgress = async () => {
    try {
      setLoading(true);
      setError('');
      const progress = await backend.getActiveStudyProgress();
      if (!progress) {
        setError('No active study plan found.');
        return;
      }
      setActiveProgress(progress);

      const dayProgress = progress.dayProgress?.find(dp => dp.dayNumber === dayNum);
      if (!dayProgress) {
        setError(`Day ${dayNum} not found in this curriculum.`);
        return;
      }
      setResponses(dayProgress.responses || {});

      // Automatically load linked song into tape deck
      if (dayProgress.songId && typeof dayProgress.songId === 'object') {
        loadSong(dayProgress.songId);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load active curriculum details.');
    } finally {
      setLoading(false);
    }
  };

  const loadSongs = async () => {
    try {
      const list = await backend.getSongs();
      setExistingSongs(list || []);
    } catch (err) {
      console.error('Failed to load songs list:', err);
    }
  };

  const handleLinkSong = async (songId) => {
    try {
      setSaving(true);
      setError('');
      const updated = await backend.linkSongToDay(activeProgress._id, dayNum, songId);
      setActiveProgress(updated);
      const dayProgress = updated.dayProgress?.find(dp => dp.dayNumber === dayNum);
      if (dayProgress?.songId && typeof dayProgress.songId === 'object') {
        loadSong(dayProgress.songId);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to link song to study day.');
    } finally {
      setSaving(false);
    }
  };

  const handleImportAndLink = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setImporting(true);
    setError('');
    setImportStep(0);

    const timer = setInterval(() => {
      setImportStep((prev) => Math.min(prev + 1, 4));
    }, 2500);

    try {
      const response = await backend.importSong(youtubeUrl);
      const songId = response.song._id;
      const updated = await backend.linkSongToDay(activeProgress._id, dayNum, songId);
      setActiveProgress(updated);
      setYoutubeUrl('');
      const dayProgress = updated.dayProgress?.find(dp => dp.dayNumber === dayNum);
      if (dayProgress?.songId && typeof dayProgress.songId === 'object') {
        loadSong(dayProgress.songId);
      }
    } catch (err) {
      const data = err.response?.data;
      if (data?.error === 'already_imported' && data?.songId) {
        // Link immediately if already in database
        const updated = await backend.linkSongToDay(activeProgress._id, dayNum, data.songId);
        setActiveProgress(updated);
        setYoutubeUrl('');
        const dayProgress = updated.dayProgress?.find(dp => dp.dayNumber === dayNum);
        if (dayProgress?.songId && typeof dayProgress.songId === 'object') {
          loadSong(dayProgress.songId);
        }
      } else {
        setError(data?.error || err.message || 'Failed to import and link song.');
      }
    } finally {
      clearInterval(timer);
      setImporting(false);
      setImportStep(0);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    try {
      const updated = await backend.uploadAudioSketch(activeProgress._id, dayNum, file);
      setActiveProgress(updated);
    } catch (err) {
      console.error(err);
      setUploadError(err.response?.data?.error || err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };



  const handleComplete = async () => {
    try {
      setSaving(true);
      setError('');
      
      const stealNotes = responses['steal_move'] || responses['steal_notes'] || responses['steal'] || '';
      
      await backend.completeDayProgress(
        activeProgress._id,
        dayNum,
        responses,
        syncTechnique,
        stealNotes
      );
      
      navigate('/planner');
    } catch (err) {
      console.error(err);
      setError('Failed to log and complete study session.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading" style={{ color: 'var(--accent-orange)' }}>Loading Study Session...</div>;
  }

  const dayProgress = activeProgress?.dayProgress?.find(dp => dp.dayNumber === dayNum);
  const currDay = activeProgress?.curriculumId?.days?.find(d => d.dayNumber === dayNum) || {};
  const isLinked = dayProgress?.songId != null;
  const song = isLinked && typeof dayProgress.songId === 'object' ? dayProgress.songId : null;

  // Filter existing songs list
  const filteredSongs = existingSongs.filter(s =>
    (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.artist || s.artistName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Recommended Match helper
  const recommendedMatch = existingSongs.find(s =>
    s.title?.toLowerCase() === currDay?.songTitle?.toLowerCase() ||
    s.artist?.toLowerCase() === currDay?.artistName?.toLowerCase()
  );

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* Navigation and Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px' }}>
        <Link 
          to="/planner" 
          style={{ fontSize: '11px', fontFamily: 'Roboto Mono', textTransform: 'uppercase', color: '#ff6600', display: 'flex', alignItems: 'center', gap: '5px' }}
        >
          ◀ Back to Planner
        </Link>
        <span style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#8a8a8a' }}>
          CURRICULUM: {activeProgress?.curriculumId?.title}
        </span>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Audio recovery banner — shows for legacy songs whose background
          download silently failed before /import became synchronous
          (publicUrl === null), OR when the file is missing on disk
          (audioError set — the white-noise-then-silence case where
          publicUrl points at a file express.static 404s on).
          The button re-runs the download via POST /songs/:id/download-audio
          and reloads the song into the global transport. */}
      {isLinked && activeSong && (!activeSong.publicUrl || audioError) && (
        <div
          className="error"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span>
            Audio file missing for this song — the original download didn&apos;t land.
          </span>
          <button
            type="button"
            onClick={handleRedownloadAudio}
            disabled={recovering}
            style={{ padding: '6px 14px', fontSize: '11px' }}
          >
            {recovering ? 'Re-downloading…' : 'Re-download audio'}
          </button>
        </div>
      )}
      {recoveryError && <div className="error">{recoveryError}</div>}

      {/* CASE 1: Song is NOT linked yet */}
      {!isLinked ? (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Target recommendation details */}
          <div className="panel" style={{ background: '#151518', padding: '25px', borderColor: '#383838' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <span style={{ fontFamily: 'Roboto Mono', fontSize: '13px', fontWeight: 'bold', color: '#ff6600' }}>
                DAY {dayNum} TARGET SIGNAL
              </span>
              <span className="badge" style={getLensStyle(currDay.lens)}>
                {currDay.lens}
              </span>
            </div>

            <h2 style={{ color: '#ffffff', fontSize: '1.4rem', border: 'none', padding: 0, margin: '0 0 10px 0' }}>
              {currDay.songTitle}
            </h2>
            <p style={{ fontFamily: 'Roboto Mono', fontSize: '12px', color: '#8a8a8a', marginBottom: '20px' }}>
              by {currDay.artistName}
            </p>

            <div style={{ padding: '15px', background: '#0c0c0e', border: '1px solid rgba(255,102,0,0.15)', borderRadius: '2px', marginBottom: '25px' }}>
              <div style={{ fontFamily: 'Roboto Mono', fontSize: '10px', color: '#ff6600', marginBottom: '6px' }}>
                SEARCH QUERY RECOMMENDATION:
              </div>
              <code style={{ fontSize: '12px', color: '#ffffff', wordBreak: 'break-all' }}>
                {currDay.songQuery}
              </code>
            </div>

            {recommendedMatch ? (
              <div style={{ padding: '15px', background: 'rgba(74, 222, 128, 0.08)', border: '1px solid rgba(74, 222, 128, 0.25)', borderRadius: '2px' }}>
                <p style={{ fontSize: '12px', color: '#4ade80', margin: '0 0 10px 0', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', color: '#4ade80' }}>
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  A matching song was found in your library!
                </p>
                <button 
                  onClick={() => handleLinkSong(recommendedMatch._id)}
                  disabled={saving}
                  style={{ background: '#4ade80', color: '#000000', fontWeight: 'bold', width: '100%' }}
                >
                  Link "{recommendedMatch.title}" from Library
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '12px', color: '#8a8a8a', fontStyle: 'italic' }}>
                No perfect match currently in library. Import from YouTube or select another song.
              </p>
            )}
          </div>

          {/* Import / Library selector section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* YouTube Import form */}
            <div className="panel" style={{ background: 'var(--bg-panel)' }}>
              <h3 style={{ color: '#ff6600', marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                Import via YouTube URL
              </h3>
              <form onSubmit={handleImportAndLink}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <input
                    type="text"
                    required
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    disabled={importing}
                    style={{ background: 'var(--bg-workspace)', borderColor: '#383838' }}
                  />
                </div>
                <button type="submit" disabled={importing} style={{ width: '100%', fontWeight: 'bold' }}>
                  {importing ? 'Importing Signal...' : 'Import & Link Song'}
                </button>
              </form>

              {importing && (
                <div style={{ marginTop: '15px', padding: '10px', background: '#0c0c0e', border: '1px dashed #ff6600', borderRadius: '2px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#ff6600' }}>
                    ● Step {importStep + 1}/5: {
                      [
                        "Downloading audio stream from YouTube",
                        "Extracting song metadata and attributes",
                        "Deploying research crawler for production notes",
                        "Building GPT listening worksheet",
                        "Connecting signal back to local workspace"
                      ][importStep]
                    }
                  </span>
                </div>
              )}
            </div>

            {/* Existing Library Search */}
            <div className="panel" style={{ background: 'var(--bg-panel)', flex: 1, display: 'flex', flexDirection: 'column', maxHeight: '380px' }}>
              <h3 style={{ color: '#ffffff', marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                Select Existing Song
              </h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search library songs..."
                style={{ background: 'var(--bg-workspace)', borderColor: '#383838', marginBottom: '10px' }}
              />

              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {filteredSongs.length === 0 ? (
                  <p style={{ fontSize: '11px', color: '#8a8a8a', padding: '10px 0' }}>No matching songs found.</p>
                ) : (
                  filteredSongs.map(s => (
                    <div 
                      key={s._id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        background: '#151518', 
                        padding: '8px 12px',
                        border: '1px solid #282828',
                        borderRadius: '2px'
                      }}
                    >
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '10px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ffffff' }}>{s.title}</div>
                        <div style={{ fontSize: '10px', color: '#8a8a8a' }}>{s.artist || s.artistName}</div>
                      </div>
                      <button 
                        onClick={() => handleLinkSong(s._id)} 
                        disabled={saving}
                        style={{ padding: '4px 8px', fontSize: '10px' }}
                      >
                        Link
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* CASE 2: Song is linked successfully */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div className="grid" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'start' }}>
            
            {/* Left Column: Prompts, Log Form & Timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Prompts Panel */}
              <div className="panel" style={{ background: '#151518', borderColor: '#ff6600', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'Roboto Mono', fontSize: '13px', fontWeight: 'bold', color: '#ff6600' }}>
                      DAY {dayNum} STUDY DETAILS
                    </span>
                    <span className="badge" style={getLensStyle(currDay.lens)}>
                      {currDay.lens}
                    </span>
                  </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'Roboto Mono', marginBottom: '6px', display: 'flex', alignItems: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                    </svg>
                    LISTENING PROMPT
                  </h4>
                  <p style={{ fontSize: '18px', color: '#ffffff', margin: 0, fontWeight: '400', lineHeight: '1.6' }}>
                    {currDay.listeningPrompt}
                  </p>
                </div>

                <div>
                  <h4 style={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'Roboto Mono', marginBottom: '6px', display: 'flex', alignItems: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                      <rect x="2" y="3" width="20" height="18" rx="2"></rect>
                      <line x1="6" y1="3" x2="6" y2="13"></line>
                      <line x1="10" y1="3" x2="10" y2="13"></line>
                      <line x1="14" y1="3" x2="14" y2="13"></line>
                      <line x1="18" y1="3" x2="18" y2="13"></line>
                      <line x1="2" y1="13" x2="22" y2="13"></line>
                      <line x1="6" y1="13" x2="6" y2="21"></line>
                      <line x1="12" y1="13" x2="12" y2="21"></line>
                      <line x1="18" y1="13" x2="18" y2="21"></line>
                    </svg>
                    DAW SKETCH CHALLENGE
                  </h4>
                  <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: '1.5' }}>
                    {currDay.applicationPrompt}
                  </p>
                </div>
              </div>

              {/* Log Responses Form */}
              <div className="panel" style={{ background: 'var(--bg-panel)', padding: '20px' }}>
                <h3 style={{ color: '#ffffff', marginBottom: '15px', fontSize: '12px', fontFamily: 'Roboto Mono', borderBottom: '1px solid #383838', paddingBottom: '6px', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  OBSERVED STUDY NOTES
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {currDay.logFields?.map((field) => (
                    <div key={field.key} className="form-group">
                      <label style={{ color: '#ff6600' }}>{field.label}</label>
                      <textarea
                        value={responses[field.key] || ''}
                        onChange={(e) => handleResponseChange(field.key, e.target.value)}
                        placeholder={`Write down your ${field.label.toLowerCase()} observations...`}
                        style={{ minHeight: '90px' }}
                      />
                    </div>
                  ))}
                </div>

                {/* Notebook Sync Toggle */}
                <div style={{ 
                  marginTop: '20px', 
                  padding: '12px', 
                  background: '#131316', 
                  border: '1px solid rgba(255,102,0,0.15)',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <input
                    type="checkbox"
                    id="syncTechnique"
                    checked={syncTechnique}
                    onChange={(e) => setSyncTechnique(e.target.checked)}
                    style={{ width: 'auto', marginTop: '3px' }}
                  />
                  <label htmlFor="syncTechnique" style={{ textTransform: 'none', fontSize: '12px', color: '#ffffff', cursor: 'pointer' }}>
                    <strong>Add takeaway to Technique Notebook</strong>
                    <span style={{ display: 'block', fontSize: '10px', color: '#8a8a8a', marginTop: '2px' }}>
                      Automatically syncs your "Steal Move" text into your production notebook reference system.
                    </span>
                  </label>
                </div>

                {/* Save Draft & Log actions */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button 
                    onClick={handleComplete} 
                    disabled={saving}
                    style={{ background: '#ff6600', color: '#000000', fontWeight: 'bold' }}
                  >
                    {saving ? 'Completing Day...' : 'Complete & Log Day'}
                  </button>
                  <button 
                    onClick={() => saveDraft()} 
                    disabled={saving}
                    className="secondary"
                  >
                    {saving ? 'Saving...' : 'Save Draft'}
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column: Audio Stream & DAW Sketch Uploader */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Linked Song Panel */}
              <div className="panel" style={{ background: 'var(--bg-panel)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ color: '#ffffff', margin: 0, display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    Reference Signal
                  </h3>
                  <button 
                    onClick={() => handleLinkSong(null)} 
                    disabled={saving}
                    className="danger" 
                    style={{ padding: '3px 6px', fontSize: '9px' }}
                  >
                    Unlink Song
                  </button>
                </div>

                {song && (
                  <div style={{ background: '#151518', padding: '12px', borderRadius: '2px', border: '1px solid #282828', marginBottom: '15px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }}>{song.title}</div>
                    <div style={{ fontSize: '11px', color: '#ff6600', fontFamily: 'Roboto Mono', marginTop: '2px' }}>{song.artist || song.artistName}</div>

                    {/* Inline transport — gives every lens day (texture, harmony,
                        rhythm, melody) a play button. arrangement/form days also
                        have the wavesurfer-backed timeline widget; this row is
                        additive and stays in the Reference Signal panel so the
                        transport is one click away regardless of lens. */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '10px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => seekTo(currentTime - 10)}
                        disabled={!hasPlayableAudio}
                        aria-label="Back 10 seconds"
                        style={transportBtnStyle}
                      >
                        −10s
                      </button>
                      <button
                        type="button"
                        onClick={togglePlay}
                        disabled={!hasPlayableAudio}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        title={
                          !hasPlayableAudio
                            ? 'Audio not downloaded yet'
                            : isPlaying
                            ? 'Pause'
                            : 'Play'
                        }
                        style={{ ...transportBtnStyle, background: 'rgba(255,102,0,0.18)', color: '#ff6600', borderColor: 'rgba(255,102,0,0.4)' }}
                      >
                        {isPlaying ? '⏸' : '▶'}
                      </button>
                      <button
                        type="button"
                        onClick={() => seekTo(currentTime + 10)}
                        disabled={!hasPlayableAudio}
                        aria-label="Forward 10 seconds"
                        style={transportBtnStyle}
                      >
                        +10s
                      </button>
                      <span
                        style={{
                          flex: 1,
                          textAlign: 'right',
                          fontSize: '10px',
                          fontFamily: 'Roboto Mono',
                          color: hasPlayableAudio ? 'rgba(255,255,255,0.55)' : 'rgba(248,113,113,0.85)',
                          whiteSpace: 'nowrap',
                        }}
                        aria-live="off"
                      >
                        {hasPlayableAudio ? `${fmt(currentTime)} / ${fmt(duration)}` : 'no audio'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Universal wavesurfer waveform + RegionsPlugin + TimelinePlugin
                    (timeline2) — present on EVERY lens day (harmony / rhythm /
                    texture / melody / form / arrangement), not just
                    arrangement/form. On arrangement/form days the detailed
                    ArrangementTimelineWidget below also renders but with its
                    own waveform suppressed (hideWaveform) so we don't get two
                    WaveSurfer.create() instances on the same <audio>. */}
                {song && (
                  <div style={{ marginTop: '12px' }}>
                    <UniversalWaveformBar
                      regions={waveformRegions}
                      onRegionClick={handleWaveformRegionClick}
                      onRegionUpdate={handleWaveformRegionUpdate}
                      onRegionChange={handleWaveformRegionChange}
                      onRegionDelete={handleWaveformRegionDelete}
                      onRegionCreate={handleWaveformRegionCreate}
                      onRecover={activeSong?._id ? handleRedownloadAudio : undefined}
                      recovering={recovering}
                      title={`${(currDay.lens || 'REFERENCE').toUpperCase()} · WAVEFORM`}
                      paddingLeft={currDay.lens?.toLowerCase() === 'texture' ? 55 : 0}
                    />
                  </div>
                )}

                {/* Album art toggle (video screen replaced with thumbnail now that audio is local) */}
                {song && (
                  <div>
                    <button
                      onClick={() => setVideoOpen(!videoOpen)}
                      className="secondary"
                      style={{ width: '100%', fontSize: '10px', marginBottom: '10px' }}
                    >
                      {videoOpen ? 'Hide Art ▲' : 'Show Art ▼'}
                    </button>

                    {videoOpen && (
                      <div style={{
                        height: '200px',
                        background: '#000000',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        border: '1px solid #282828',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {song.thumbnailUrl || song.thumbnail ? (
                          <img src={song.thumbnailUrl || song.thumbnail} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: 'Roboto Mono' }}>♪</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* DAW Sketch Uploader */}
              <div className="panel" style={{ background: 'var(--bg-panel)' }}>
                <h3 style={{ color: '#ff6600', marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  DAW Sketch Uploader
                </h3>
                <p style={{ fontSize: '11px', color: '#8a8a8a', marginBottom: '15px', lineHeight: '1.4' }}>
                  Drag & drop or select your audio sketch file (.mp3/.wav, max 10MB) to review it inside this day's workspace.
                </p>

                {uploadError && <div className="error">{uploadError}</div>}

                {/* Uploader Input Zone */}
                <div style={{
                  border: '2px dashed rgba(255, 102, 0, 0.25)',
                  background: '#151518',
                  borderRadius: '2px',
                  padding: '20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  marginBottom: '15px'
                }}>
                  <input
                    type="file"
                    accept=".mp3,.wav"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#ff6600', fontFamily: 'Roboto Mono' }}>
                    {uploading ? 'Uploading sketch...' : 'Choose Audio Sketch (.mp3/.wav)'}
                  </span>
                </div>

                {/* Sketch Audio player */}
                {dayProgress?.audioFilePath ? (
                  <div style={{ background: '#0c0c0e', padding: '12px', border: '1px solid #282828', borderRadius: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'Roboto Mono', color: '#8a8a8a' }}>SKETCH FILENAME:</span>
                      <span className="badge success">UPLOADED</span>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#ffffff', wordBreak: 'break-all', marginBottom: '10px' }}>
                      {dayProgress.audioOriginalName || 'Uploaded Audio'}
                    </div>
                    <audio 
                      controls 
                      src={dayProgress.audioFilePath}
                      style={{ width: '100%', height: '32px' }} 
                    />
                  </div>
                ) : (
                  <p style={{ fontSize: '11px', color: '#8a8a8a', fontStyle: 'italic', margin: 0 }}>
                    No DAW sketch uploaded for this day yet.
                  </p>
                )}
              </div>

            </div>
          </div>

          {/* Arrangement Timeline Widget for Arrangement/Form Lens days */}
          {['arrangement', 'form'].includes(currDay.lens?.toLowerCase()) && (
            <div className="panel" style={{ background: '#1e1e1e', marginTop: '20px', border: '1px solid #383838', borderRadius: '2px', padding: '15px' }}>
              <div style={{ borderBottom: '1px solid #282828', paddingBottom: '6px', marginBottom: '15px' }}>
                <h3 style={{ color: '#ff6600', margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="9" x2="9" y2="21"></line>
                    <line x1="15" y1="9" x2="15" y2="21"></line>
                  </svg>
                  Arrangement / Form Timeline
                </h3>
                <span style={{ fontSize: '10px', color: '#8a8a8a', fontFamily: 'Roboto Mono' }}>
                  Analyze or chart blocks for the active reference signal. Snap to grid bars, label lanes, or trace dynamic curves.
                </span>
              </div>
              <ArrangementTimelineWidget
                responses={responses}
                onChange={handleResponseChange}
                song={song}
                lensData={currDay}
                saveNow={saveNow}
                hideWaveform
              />
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default StudySessionWorkspace;
