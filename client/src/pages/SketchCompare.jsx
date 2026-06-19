// SketchCompare — A/B compare page. Mounted at /compare/:songId/:sketchId.
// Loads the song, hydrates the sketch via useSketches, finds the selected
// sketch, and renders the dual-transport ComparePlayer. The AudioContext
// global transport (YouTube player) is loaded with the reference song.

import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import { useSketches } from '../hooks/useSketches';
import ComparePlayer from '../components/ComparePlayer';

const SAMPLE_SKETCH = {
  _id: 'sample',
  title: 'Demo sketch',
  originalName: 'demo.wav',
  publicUrl: '',
  analysis: null,
  analysisStatus: 'not_started',
};

export default function SketchCompare() {
  const { songId, sketchId } = useParams();
  const navigate = useNavigate();
  const backend = useBackend();
  const { loadSong } = useAudio();
  const { sketches, loading, error, refetch, upload, remove, analyze } = useSketches(songId);

  const [song, setSong] = useState(null);
  const [songLoading, setSongLoading] = useState(true);
  const [songError, setSongError] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [analyzing, setAnalyzing] = useState(null);

  // Load the song
  useEffect(() => {
    let alive = true;
    setSongLoading(true);
    setSongError(null);
    backend
      .getSong(songId)
      .then((s) => {
        if (!alive) return;
        setSong(s);
        setSongLoading(false);
        loadSong(s);
      })
      .catch((e) => {
        if (!alive) return;
        setSongError(e);
        setSongLoading(false);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songId]);

  // Pick the selected sketch
  const selected = sketches.find((s) => (s._id || s.id) === sketchId) || (sketchId === 'sample' ? SAMPLE_SKETCH : null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const created = await upload(songId, file, { title: file.name.replace(/\.[^.]+$/, '') });
      navigate(`/compare/${songId}/${created._id || created.id}`);
    } catch (err) {
      setUploadError(err.message || String(err));
    } finally {
      e.target.value = '';
    }
  };

  const handleAnalyze = async (id) => {
    setAnalyzing(id);
    setUploadError(null);
    try {
      await analyze(id);
    } catch (err) {
      setUploadError(err.message || String(err));
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sketch?')) return;
    try {
      await remove(id);
      // navigate to the latest sketch if any
      const remaining = sketches.filter((s) => (s._id || s.id) !== id);
      if (remaining.length > 0) navigate(`/compare/${songId}/${remaining[0]._id || remaining[0].id}`);
      else navigate(`/compare/${songId}`);
    } catch (err) {
      setUploadError(err.message || String(err));
    }
  };

  if (songLoading) {
    return <Centered>Loading reference track…</Centered>;
  }
  if (songError || !song) {
    return (
      <Centered>
        <div style={{ color: '#ff5252' }}>Failed to load song: {songError?.message || 'not found'}</div>
        <Link to="/dashboard" style={linkStyle}>← Back to library</Link>
      </Centered>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px', color: '#f2f2f2' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#ff6a00', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6 }}>
            A / B Compare
          </div>
          <h1 style={{ margin: 0, fontSize: 24, fontFamily: 'Barlow, sans-serif', fontWeight: 600 }}>
            {song.title} <span style={{ color: '#9ca0a6', fontWeight: 400 }}>— {song.artistName || song.artist || 'Unknown'}</span>
          </h1>
        </div>
        <Link to={`/audit`} style={linkStyle}>← Back</Link>
      </div>

      {/* Sketch list / upload */}
      <div style={{ background: '#18181c', border: '1px solid #2a2a30', borderRadius: 2, padding: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 10, color: '#5a5d65', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Sketches ({sketches.length})
          </div>
          <label style={{ ...buttonStyle, cursor: 'pointer' }}>
            + Upload sketch
            <input
              type="file"
              accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp3,audio/m4a,audio/aac,audio/flac,.mp3,.wav,.m4a,.aac,.flac"
              onChange={handleFile}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        {loading ? (
          <div style={{ color: '#9ca0a6', fontSize: 12 }}>Loading sketches…</div>
        ) : sketches.length === 0 ? (
          <div style={{ color: '#9ca0a6', fontSize: 12 }}>No sketches yet. Upload a DAW export to start comparing.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sketches.map((s) => {
              const id = s._id || s.id;
              const isActive = id === sketchId;
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: isActive ? '#0c0c0e' : 'transparent',
                    border: isActive ? '1px solid #ff6a00' : '1px solid #2a2a30',
                    borderRadius: 2,
                  }}
                >
                  <Link to={`/compare/${songId}/${id}`} style={{ flex: 1, color: '#f2f2f2', textDecoration: 'none', fontSize: 13 }}>
                    {s.title || s.originalName}
                    <span style={{ color: '#5a5d65', fontSize: 11, marginLeft: 8 }}>· {s.analysisStatus || 'not_started'}</span>
                  </Link>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleAnalyze(id)}
                      disabled={analyzing === id}
                      style={miniButtonStyle}
                    >
                      {analyzing === id ? 'Analyzing…' : (s.analysisStatus === 'success' ? 'Re-analyze' : 'Analyze')}
                    </button>
                    <button onClick={() => handleDelete(id)} style={{ ...miniButtonStyle, color: '#ff5252', borderColor: '#3a3a44' }}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {uploadError && <div style={{ marginTop: 8, color: '#ff5252', fontSize: 12 }}>{uploadError}</div>}
        {error && <div style={{ marginTop: 8, color: '#ff5252', fontSize: 12 }}>{error.message || String(error)}</div>}
      </div>

      {/* Compare player */}
      {selected ? (
        <ComparePlayer sketch={selected} song={song} />
      ) : (
        <div style={{ padding: 32, textAlign: 'center', color: '#5a5d65', border: '1px dashed #2a2a30', borderRadius: 2 }}>
          Select a sketch above to compare.
        </div>
      )}
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12, color: '#9ca0a6' }}>
      {children}
    </div>
  );
}

const linkStyle = {
  color: '#9ca0a6',
  fontFamily: 'Roboto Mono, monospace',
  fontSize: 11,
  textDecoration: 'none',
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const buttonStyle = {
  display: 'inline-block',
  padding: '6px 12px',
  background: '#202024',
  color: '#f2f2f2',
  border: '1px solid #3a3a44',
  borderRadius: 2,
  fontFamily: 'Roboto Mono, monospace',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontWeight: 600,
};

const miniButtonStyle = {
  padding: '4px 10px',
  background: 'transparent',
  color: '#f2f2f2',
  border: '1px solid #3a3a44',
  borderRadius: 2,
  fontFamily: 'Roboto Mono, monospace',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  cursor: 'pointer',
};
