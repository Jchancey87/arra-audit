import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAudio } from '../context/AudioContext';
import SimilarTechniquesSection from './SimilarTechniquesSection';

const TechniqueDetailModal = ({ isOpen, onClose, tech, songs, onUpdate, onDelete, onOpenTechnique }) => {
  const { loadSong, activeSong, play, seekTo } = useAudio();

  const [name, setName] = useState('');
  const [lens, setLens] = useState('rhythm');
  const [confidence, setConfidence] = useState(3);
  const [nextAction, setNextAction] = useState('');
  const [songId, setSongId] = useState('');
  const [artist, setArtist] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

  // Local state to track updates and show saving feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (tech) {
      setName(tech.techniqueName || '');
      setLens(tech.lens || 'rhythm');
      setConfidence(tech.confidence || 3);
      setNextAction(tech.nextAction || '');
      setSongId(tech.songId?._id || tech.songId || '');
      setArtist(tech.artist || '');
      setTimestamp(tech.exampleTimestamp !== undefined && tech.exampleTimestamp !== null ? formatTime(tech.exampleTimestamp) : '');
      setDescription(tech.description || '');
      setNotes(tech.notes || '');
      setTags(tech.tags ? tech.tags.join(', ') : '');
    }
  }, [tech]);

  if (!isOpen || !tech) return null;

  const formatTime = (seconds) => {
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTime = (str) => {
    if (!str) return undefined;
    if (typeof str === 'number') return str;
    const parts = str.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseInt(parts[1], 10) || 0;
      return minutes * 60 + seconds;
    }
    return parseInt(str, 10) || undefined;
  };

  const getLensColor = (l) => {
    const lensLower = (l || '').toLowerCase();
    if (lensLower === 'rhythm') return '#f97316';
    if (lensLower === 'texture') return '#14b8a6';
    if (lensLower === 'harmony') return '#8b5cf6';
    if (lensLower === 'arrangement') return '#ec4899';
    return 'rgba(255, 255, 255, 0.08)';
  };

  const handleFieldChange = async (field, value) => {
    // Optimistically update parent list state
    const updates = { [field]: value };
    await onUpdate(tech._id, updates);
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const tagsArray = tags
      ? tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : [];

    const parsedTime = parseTime(timestamp);

    // Auto-extract artist from chosen song if empty
    let finalArtist = artist;
    if (songId && !finalArtist) {
      const matched = songs.find((s) => s._id === songId);
      if (matched) {
        finalArtist = matched.artist || matched.artistName || '';
        setArtist(finalArtist);
      }
    }

    const updates = {
      techniqueName: name,
      lens,
      confidence,
      nextAction: nextAction || null,
      songId: songId || null,
      artist: finalArtist || undefined,
      exampleTimestamp: parsedTime,
      description,
      notes: notes || undefined,
      tags: tagsArray,
    };

    try {
      await onUpdate(tech._id, updates);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Failed to save changes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeek = () => {
    const sId = tech.songId?._id || tech.songId;
    if (!sId) return;

    const targetSeconds = parseTime(timestamp) || 0;

    if (activeSong && activeSong._id === sId) {
      seekTo(targetSeconds);
      play();
    } else {
      const fullSong = songs.find((s) => s._id === sId);
      if (fullSong) {
        loadSong(fullSong);
        setTimeout(() => {
          seekTo(targetSeconds);
          play();
        }, 800);
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{
          maxWidth: '650px',
          width: '90%',
          maxHeight: '90vh',
          overflowY: 'auto',
          margin: '20px',
          background: 'var(--bg-panel)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          borderLeft: `5px solid ${getLensColor(lens)}`,
          padding: '25px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
          <div>
            <span
              className="badge"
              style={{
                borderColor: getLensColor(lens),
                color: getLensColor(lens),
                background: `${getLensColor(lens)}15`,
                fontSize: '9px',
                textTransform: 'uppercase',
                marginBottom: '5px',
              }}
            >
              {lens} Lens
            </span>
            <h2 style={{ margin: 0, fontSize: '16px' }}>Musical Technique Details</h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSaveAll}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
            
            {/* Name */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Technique Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Name of this musical technique"
              />
            </div>

            {/* Lens Selector */}
            <div className="form-group">
              <label>Musical Lens</label>
              <select value={lens} onChange={(e) => setLens(e.target.value)}>
                <option value="rhythm">Rhythm</option>
                <option value="texture">Texture</option>
                <option value="harmony">Harmony</option>
                <option value="arrangement">Arrangement</option>
              </select>
            </div>

            {/* Next Action Selector */}
            <div className="form-group">
              <label>Next Action</label>
              <select value={nextAction} onChange={(e) => setNextAction(e.target.value)}>
                <option value="">No Action (Backlog)</option>
                <option value="study">Study</option>
                <option value="practice">Practice</option>
                <option value="transcribe">Transcribe</option>
                <option value="apply">Apply</option>
                <option value="revisit">Revisit</option>
              </select>
            </div>

            {/* Confidence Clickable Rating */}
            <div className="form-group" style={{ justifyContent: 'center' }}>
              <label style={{ marginBottom: '5px' }}>Confidence Rating</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    onClick={() => setConfidence(i)}
                    style={{
                      cursor: 'pointer',
                      fontSize: '18px',
                      color: i <= confidence ? '#ff6600' : 'rgba(255, 255, 255, 0.15)',
                      userSelect: 'none',
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            {/* Associated Song */}
            <div className="form-group">
              <label>Associated Song</label>
              <select value={songId} onChange={(e) => setSongId(e.target.value)}>
                <option value="">None (Standalone)</option>
                {songs.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.title} ({s.artist || s.artistName})
                  </option>
                ))}
              </select>
            </div>

            {/* Artist / Source */}
            <div className="form-group">
              <label>Artist / Creator</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. Stevie Wonder"
              />
            </div>

            {/* Timestamp & Playback Seek Control */}
            <div className="form-group">
              <label>Timestamp</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  placeholder="e.g. 1:42 or 102"
                  style={{ flex: 1 }}
                />
                {songId && (
                  <button
                    type="button"
                    onClick={handleSeek}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(255, 102, 0, 0.1)',
                      borderColor: 'rgba(255, 102, 0, 0.3)',
                      color: '#ff6600',
                    }}
                  >
                    ▶ Seek
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Description *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                style={{ minHeight: '80px' }}
                placeholder="Describe the musical mechanism or sonic technique..."
              />
            </div>

            {/* Practice Notes / Attempts */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Practice Notebook / Attempts</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ minHeight: '85px', fontSize: '11px', fontFamily: 'monospace' }}
                placeholder="Log your practice sessions, setup, chord shapes, or recreation notes here..."
              />
            </div>

            {/* Tags */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. synth, patch, modal-interchange"
              />
            </div>
          </div>

          {/* Audit Link, if available */}
          {tech.auditId && (
            <div
              style={{
                marginTop: '15px',
                padding: '10px 12px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '2px',
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Roboto Mono' }}>
                Discovered in audit sequence:
              </span>
              <Link
                to={`/audit/${tech.auditId?._id || tech.auditId}`}
                onClick={onClose}
                style={{
                  color: '#ff6600',
                  fontWeight: 'bold',
                  textDecoration: 'underline',
                  fontFamily: 'Roboto Mono',
                }}
              >
                Review Source Audit →
              </Link>
            </div>
          )}

          {/* Phase 2.4: similar techniques from the user's notebook */}
          <SimilarTechniquesSection
            technique={tech}
            limit={5}
            onOpenSimilar={onOpenTechnique}
          />

          {/* Buttons Row */}
          <div
            style={{
              marginTop: '25px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              paddingTop: '15px',
            }}
          >
            <button
              type="button"
              className="danger"
              onClick={() => {
                if (window.confirm('Delete this technique from your notebook?')) {
                  onDelete(tech._id);
                  onClose();
                }
              }}
            >
              Delete Technique
            </button>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {saveSuccess && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#4ade80',
                    fontFamily: 'Roboto Mono',
                    fontWeight: 'bold',
                  }}
                >
                  ✓ Synchronized
                </span>
              )}
              <button type="button" className="secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                style={{ background: '#ff6600', color: '#0c0c0e', fontWeight: 'bold' }}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TechniqueDetailModal;
