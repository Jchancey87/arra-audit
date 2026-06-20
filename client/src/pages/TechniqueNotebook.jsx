import React, { useState, useEffect } from 'react';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import EmptyState from '../components/EmptyState';
import TechniqueDetailModal from '../components/TechniqueDetailModal';

const TechniqueNotebook = () => {
  const [activeTab, setActiveTab] = useState('library');
  const [techniques, setTechniques] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [selectedTech, setSelectedTech] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = (tech) => {
    setSelectedTech(tech);
    setIsModalOpen(true);
  };
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLens, setFilterLens] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState('desc');

  // Saving states per technique ID
  const [savingStates, setSavingStates] = useState({});
  const [savedStates, setSavedStates] = useState({});

  // Quick Log form states
  const [newTechName, setNewTechName] = useState('');
  const [newLens, setNewLens] = useState('rhythm');
  const [newConfidence, setNewConfidence] = useState(3);
  const [newNextAction, setNewNextAction] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newSongId, setNewSongId] = useState('');
  const [newTimestamp, setNewTimestamp] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newTags, setNewTags] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');

  const backend = useBackend();
  const { seekTo, activeSong, loadSong, play } = useAudio();

  useEffect(() => {
    loadTechniques();
  }, [searchTerm, filterLens, sortBy, order]);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const res = await backend.getSongs();
        setSongs(res || []);
      } catch (err) {
        console.error('Failed to load songs:', err);
      }
    };
    fetchSongs();
  }, [backend]);

  const loadTechniques = async () => {
    try {
      setLoading(true);
      const filters = {
        q: searchTerm,
        lens: filterLens === 'all' ? undefined : filterLens,
        sortBy,
        order
      };
      const response = await backend.getTechniques(filters);
      setTechniques(response.techniques || []);
      setGrouped(response.grouped || {});
    } catch (err) {
      setError('Failed to load techniques');
    } finally {
      setLoading(false);
    }
  };

  const deleteTechnique = async (id) => {
    if (window.confirm('Delete this technique from your notebook?')) {
      try {
        await backend.deleteTechnique(id);
        loadTechniques();
      } catch (err) {
        setError('Failed to delete technique');
      }
    }
  };

  const handleUpdateTechnique = async (id, updates) => {
    setSavingStates(prev => ({ ...prev, [id]: true }));
    try {
      // Local optimistic update
      setTechniques(prev => 
        prev.map(t => t._id === id ? { ...t, ...updates } : t)
      );
      setSelectedTech(prev => prev && prev._id === id ? { ...prev, ...updates } : prev);

      await backend.updateTechnique(id, updates);

      // Reload in background to ensure accurate counts/grouped lists
      const filters = {
        q: searchTerm,
        lens: filterLens === 'all' ? undefined : filterLens,
        sortBy,
        order
      };
      const response = await backend.getTechniques(filters);
      setTechniques(response.techniques || []);
      setGrouped(response.grouped || {});

      setSavingStates(prev => ({ ...prev, [id]: false }));
      setSavedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setSavedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to update technique:', err);
      setError('Failed to update technique');
      setSavingStates(prev => ({ ...prev, [id]: false }));
    }
  };

  const formatTimestamp = (seconds) => {
    if (!seconds && seconds !== 0) return '';
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const parseTimestamp = (str) => {
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

  const getLensColor = (lens) => {
    const l = (lens || '').toLowerCase();
    if (l === 'rhythm') return '#f97316';
    if (l === 'texture') return '#14b8a6';
    if (l === 'harmony') return '#8b5cf6';
    if (l === 'arrangement') return '#ec4899';
    return 'rgba(255, 255, 255, 0.08)';
  };

  const handleLoadAndSeek = async (tech) => {
    const songId = tech.songId?._id || tech.songId;
    if (!songId) return;

    try {
      if (activeSong && activeSong._id === songId) {
        seekTo(tech.exampleTimestamp || 0);
        play();
      } else {
        const fullSong = await backend.getSong(songId);
        if (fullSong) {
          loadSong(fullSong);
          setTimeout(() => {
            seekTo(tech.exampleTimestamp || 0);
            play();
          }, 800);
        }
      }
    } catch (err) {
      console.error('Error loading and seeking song:', err);
    }
  };

  const handleQuickLogSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!newTechName.trim()) {
      setFormError('Technique Name is required');
      return;
    }
    if (!newDescription.trim()) {
      setFormError('Description is required');
      return;
    }

    try {
      const tagsArray = newTags
        ? newTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        : [];
      
      const parsedTime = parseTimestamp(newTimestamp);

      // Auto-extract artist if not manually input but song is chosen
      let artistVal = newArtist;
      if (newSongId) {
        const selectedSong = songs.find(s => s._id === newSongId);
        if (selectedSong && !artistVal) {
          artistVal = selectedSong.artist;
        }
      }

      const payload = {
        techniqueName: newTechName,
        lens: newLens,
        confidence: newConfidence,
        nextAction: newNextAction || undefined,
        artist: artistVal || undefined,
        songId: newSongId || undefined,
        exampleTimestamp: parsedTime,
        description: newDescription,
        notes: newNotes || undefined,
        tags: tagsArray
      };

      await backend.addTechnique(payload);
      
      setFormSuccess('Technique successfully logged to your notebook!');
      
      // Reset form
      setNewTechName('');
      setNewLens('rhythm');
      setNewConfidence(3);
      setNewNextAction('');
      setNewArtist('');
      setNewSongId('');
      setNewTimestamp('');
      setNewDescription('');
      setNewNotes('');
      setNewTags('');

      // Refresh list
      loadTechniques();
    } catch (err) {
      setFormError(err.message || 'Failed to add technique to notebook');
    }
  };

  // Reusable Technique Card
  const TechniqueCard = ({ tech, compact = false }) => {
    const [localNotes, setLocalNotes] = useState(tech.notes || '');

    useEffect(() => {
      setLocalNotes(tech.notes || '');
    }, [tech.notes]);

    const handleNotesBlur = () => {
      if (localNotes !== (tech.notes || '')) {
        handleUpdateTechnique(tech._id, { notes: localNotes });
      }
    };

    // Determine artist/song display label
    let songDisplay = '';
    if (tech.songId && typeof tech.songId === 'object') {
      songDisplay = `${tech.songId.title} - ${tech.songId.artist}`;
    } else {
      const matchingSong = songs.find(s => s._id === tech.songId);
      if (matchingSong) {
        songDisplay = `${matchingSong.title} - ${matchingSong.artist}`;
      } else if (tech.artist) {
        songDisplay = tech.artist;
      }
    }

    const hasTimestamp = tech.exampleTimestamp !== undefined && tech.exampleTimestamp !== null;
    const isSaving = savingStates[tech._id];
    const isSaved = savedStates[tech._id];

    return (
      <div 
        className="panel" 
        onClick={() => openModal(tech)}
        style={{ 
          margin: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          background: 'var(--bg-panel)', 
          borderLeft: `4px solid ${getLensColor(tech.lens)}`,
          borderColor: 'rgba(255,255,255,0.08)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          position: 'relative',
          cursor: 'pointer'
        }}
      >
        {/* Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
          <div style={{ flex: 1, marginRight: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {tech.techniqueName || 'Untitled Technique'}
              {isSaving && (
                <span style={{ fontSize: '9px', color: '#f59e0b', fontFamily: 'Roboto Mono', fontWeight: 'bold' }}>
                  ● Saving...
                </span>
              )}
              {isSaved && (
                <span style={{ fontSize: '9px', color: '#10b981', fontFamily: 'Roboto Mono', fontWeight: 'bold' }}>
                  ✔ Saved
                </span>
              )}
            </h3>
            <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
              <span 
                className="badge primary" 
                style={{ 
                  borderColor: getLensColor(tech.lens), 
                  color: getLensColor(tech.lens), 
                  background: `${getLensColor(tech.lens)}15`,
                  fontSize: '9px'
                }}
              >
                {tech.lens}
              </span>
              {!compact && tech.tags?.map(tag => (
                <span 
                  key={tag} 
                  style={{ 
                    fontSize: '9px', 
                    fontFamily: 'Roboto Mono',
                    color: 'rgba(255,255,255,0.5)', 
                    background: 'rgba(255, 255, 255, 0.04)', 
                    padding: '1px 5px', 
                    borderRadius: '1px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  #{tag.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); deleteTechnique(tech._id); }}
            className="danger"
            style={{ padding: '4px 6px', fontSize: '9px', border: 'none', background: 'transparent' }}
            title="Remove from notebook"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>

        {/* Confidence & Next Action Controls */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: '#0c0c0e', 
          padding: '6px 10px', 
          borderRadius: '2px', 
          marginBottom: '10px',
          border: '1px solid rgba(255,255,255,0.03)',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          {/* Clickable Confidence Stars */}
          <div style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginRight: '6px', fontFamily: 'Roboto Mono' }}>Confidence:</span>
            {[1, 2, 3, 4, 5].map((i) => {
              const isFilled = i <= (tech.confidence || 0);
              return (
                <span 
                  key={i}
                  onClick={(e) => { e.stopPropagation(); handleUpdateTechnique(tech._id, { confidence: i }); }}
                  style={{
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: isFilled ? '#ff6600' : 'rgba(255,255,255,0.2)',
                    marginRight: '2px',
                    userSelect: 'none'
                  }}
                  title={`Rate ${i}/5`}
                >
                  ★
                </span>
              );
            })}
          </div>

          {/* Next Action Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontFamily: 'Roboto Mono' }}>Action:</span>
            <select
              value={tech.nextAction || ''}
              onChange={(e) => handleUpdateTechnique(tech._id, { nextAction: e.target.value || null })}
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                padding: '2px 6px',
                fontSize: '10px',
                fontFamily: 'Roboto Mono',
                width: 'auto',
                height: '22px',
                cursor: 'pointer'
              }}
            >
              <option value="">No Action</option>
              <option value="study">Study</option>
              <option value="practice">Practice</option>
              <option value="transcribe">Transcribe</option>
              <option value="apply">Apply</option>
              <option value="revisit">Revisit</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <p style={{ 
          fontSize: '12px', 
          lineHeight: '1.5', 
          color: 'rgba(255, 255, 255, 0.75)', 
          margin: '0 0 10px 0',
          wordBreak: 'break-word'
        }}>
          {tech.description}
        </p>

        {/* Associated Song Load & Seek */}
        {songDisplay && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'rgba(0,0,0,0.2)', 
            padding: '6px 10px', 
            borderRadius: '2px', 
            border: '1px solid rgba(255,255,255,0.04)',
            fontSize: '11px',
            fontFamily: 'Roboto Mono',
            marginBottom: '10px'
          }}>
            <span style={{ 
              color: 'rgba(255,255,255,0.5)', 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap',
              maxWidth: '65%',
              display: 'inline-flex',
              alignItems: 'center'
            }} title={songDisplay}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
              </svg>
              {songDisplay}
            </span>
            {hasTimestamp && (
              <button
                onClick={(e) => { e.stopPropagation(); handleLoadAndSeek(tech); }}
                style={{
                  padding: '2px 8px',
                  fontSize: '9px',
                  background: 'rgba(255, 102, 0, 0.1)',
                  borderColor: 'rgba(255, 102, 0, 0.3)',
                  color: '#ff6600',
                  borderRadius: '2px',
                  whiteSpace: 'nowrap'
                }}
              >
                ▶ Load & Seek ({formatTimestamp(tech.exampleTimestamp)})
              </button>
            )}
          </div>
        )}

        {/* Inline Practice Notes */}
        {!compact && (
          <div style={{ marginTop: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <label style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', display: 'block' }}>
              Practice Log / Attempts
            </label>
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Type notes or practice experiments here. Click away to auto-save..."
              style={{
                width: '100%',
                minHeight: '50px',
                fontSize: '11px',
                background: 'var(--bg-workspace)',
                borderColor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.85)',
                padding: '6px 8px',
                borderRadius: '2px',
                fontFamily: 'inherit',
                lineHeight: '1.4'
              }}
            />
          </div>
        )}
      </div>
    );

  };

  // Grouping for Practice Kanban Board lanes
  const lanes = [
    { 
      id: 'unassigned', 
      title: (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
          </svg>
          BACKLOG / UNASSIGNED
        </span>
      ), 
      items: techniques.filter(t => !t.nextAction) 
    },
    { 
      id: 'study', 
      title: (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          STUDY
        </span>
      ), 
      items: techniques.filter(t => t.nextAction === 'study') 
    },
    { 
      id: 'practice', 
      title: (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <line x1="6" y1="12" x2="18" y2="12"></line>
            <rect x="2" y="7" width="4" height="10" rx="1"></rect>
            <rect x="18" y="7" width="4" height="10" rx="1"></rect>
          </svg>
          PRACTICE
        </span>
      ), 
      items: techniques.filter(t => t.nextAction === 'practice') 
    },
    { 
      id: 'transcribe', 
      title: (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          TRANSCRIBE
        </span>
      ), 
      items: techniques.filter(t => t.nextAction === 'transcribe') 
    },
    { 
      id: 'apply', 
      title: (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5"></path>
            <path d="M12 2C6.5 2 2 6.5 2 12c0 2.1.6 4.1 1.7 5.7l12.6-12.6C14.7 2.6 13.5 2 12 2z"></path>
            <path d="M12 2c5.5 0 10 4.5 10 10 0 1.5-.6 2.7-1.7 4.3L7.7 3.7C9.3 2.6 10.5 2 12 2z"></path>
          </svg>
          APPLY
        </span>
      ), 
      items: techniques.filter(t => t.nextAction === 'apply') 
    },
    { 
      id: 'revisit', 
      title: (
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          REVISIT
        </span>
      ), 
      items: techniques.filter(t => t.nextAction === 'revisit') 
    }
  ];

  return (
    <div style={{ maxWidth: activeTab === 'practice' ? '100%' : '1200px', margin: '0 auto', transition: 'max-width 0.2s ease' }}>
      
      {/* Header Panel */}
      <div className="panel" style={{ background: 'var(--bg-panel)', borderBottom: '2px solid #ff6600' }}>
        <h1 style={{ display: 'flex', alignItems: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '10px' }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          Technique Notebook
        </h1>
        <p className="card-subtitle" style={{ margin: 0 }}>
          Your personal collection of musical vocabulary, portable patterns, and structural discoveries.
        </p>

        {error && <div className="error">{error}</div>}

        {/* Lens Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginTop: '15px' }}>
          {['rhythm', 'texture', 'harmony', 'arrangement'].map((lens) => (
            <div 
              key={lens} 
              style={{ 
                background: '#0c0c0e', 
                padding: '12px', 
                borderRadius: '2px', 
                textAlign: 'center', 
                borderLeft: `3px solid ${getLensColor(lens)}`,
                borderRight: '1px solid rgba(255, 255, 255, 0.04)',
                borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.04)'
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: getLensColor(lens), fontFamily: 'Roboto Mono' }}>
                {grouped[lens]?.length || 0}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Roboto Mono', marginTop: '2px' }}>
                {lens}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DAW-Style Tabs Selector */}
      <div style={{ display: 'flex', gap: '5px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1px' }}>
        <button 
          onClick={() => setActiveTab('library')}
          title="View and search your full collection of discovered techniques"
          style={{
            background: activeTab === 'library' ? '#1c1c22' : 'transparent',
            color: activeTab === 'library' ? '#ff6600' : 'rgba(255,255,255,0.5)',
            border: '1px solid',
            borderColor: activeTab === 'library' ? 'rgba(255, 102, 0, 0.3) rgba(255, 102, 0, 0.3) transparent rgba(255, 102, 0, 0.3)' : 'transparent',
            borderBottom: activeTab === 'library' ? '2px solid #ff6600' : '1px solid transparent',
            borderRadius: '2px 2px 0 0',
            padding: '10px 20px',
            fontWeight: 'bold',
          }}
        >
          Library
        </button>
        <button 
          onClick={() => setActiveTab('practice')}
          title="Organize your discoveries into a step-by-step practice pipeline (Kanban board)"
          style={{
            background: activeTab === 'practice' ? '#1c1c22' : 'transparent',
            color: activeTab === 'practice' ? '#ff6600' : 'rgba(255,255,255,0.5)',
            border: '1px solid',
            borderColor: activeTab === 'practice' ? 'rgba(255, 102, 0, 0.3) rgba(255, 102, 0, 0.3) transparent rgba(255, 102, 0, 0.3)' : 'transparent',
            borderBottom: activeTab === 'practice' ? '2px solid #ff6600' : '1px solid transparent',
            borderRadius: '2px 2px 0 0',
            padding: '10px 20px',
            fontWeight: 'bold',
          }}
        >
          Practice Room
        </button>
        <button 
          onClick={() => setActiveTab('quicklog')}
          title="Log a new standalone technique or musical discovery manually"
          style={{
            background: activeTab === 'quicklog' ? '#1c1c22' : 'transparent',
            color: activeTab === 'quicklog' ? '#ff6600' : 'rgba(255,255,255,0.5)',
            border: '1px solid',
            borderColor: activeTab === 'quicklog' ? 'rgba(255, 102, 0, 0.3) rgba(255, 102, 0, 0.3) transparent rgba(255, 102, 0, 0.3)' : 'transparent',
            borderBottom: activeTab === 'quicklog' ? '2px solid #ff6600' : '1px solid transparent',
            borderRadius: '2px 2px 0 0',
            padding: '10px 20px',
            fontWeight: 'bold',
          }}
        >
          Quick Log
        </button>
      </div>

      {/* Tabs Content */}
      {activeTab === 'library' && (
        <>
          {/* Filters & Search */}
          <div className="panel" style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', background: 'var(--bg-panel)' }}>
            <div style={{ flex: 2, minWidth: '300px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Search Query</label>
              <input
                type="text"
                placeholder="Filter by name, description, artist, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-workspace)', borderColor: 'rgba(255,255,255,0.12)' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Filter Lens</label>
              <select
                value={filterLens}
                onChange={(e) => setFilterLens(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-workspace)', borderColor: 'rgba(255,255,255,0.12)' }}
              >
                <option value="all">All Lenses</option>
                <option value="rhythm">Rhythm</option>
                <option value="texture">Texture</option>
                <option value="harmony">Harmony</option>
                <option value="arrangement">Arrangement</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Sort Field</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-workspace)', borderColor: 'rgba(255,255,255,0.12)' }}
              >
                <option value="createdAt">Date Added</option>
                <option value="techniqueName">Technique Name</option>
                <option value="lens">Musical Lens</option>
                <option value="artist">Artist/Source</option>
                <option value="confidence">Confidence Rating</option>
              </select>
            </div>
          </div>

          {loading && techniques.length === 0 ? (
            <div className="loading">LOADING LIBRARY REGISTRIES...</div>
          ) : techniques.length === 0 ? (
            <EmptyState 
              icon={
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              }
              title={searchTerm || filterLens !== 'all' ? "No matching techniques" : "Notebook is empty"}
              description={searchTerm || filterLens !== 'all' ? "Try adjusting your filters or search terms." : "Start an audit on a song to discover and log techniques. Your notebook is where you collect the 'how' behind the music you study."}
              ctaLabel={searchTerm || filterLens !== 'all' ? "Clear All Filters" : "Go to Library"}
              onCtaClick={searchTerm || filterLens !== 'all' ? () => { setSearchTerm(''); setFilterLens('all'); } : null}
              ctaLink={searchTerm || filterLens !== 'all' ? null : "/dashboard"}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
              {techniques.map((tech) => (
                <TechniqueCard key={tech._id} tech={tech} />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'practice' && (
        <div>
          {/* Practice Room explanation banner */}
          <div style={{
            background: 'rgba(255, 102, 0, 0.05)',
            border: '1px solid rgba(255, 102, 0, 0.15)',
            borderRadius: '2px',
            padding: '12px 15px',
            marginBottom: '20px',
            fontSize: '12px',
            lineHeight: '1.5',
            color: 'rgba(255, 255, 255, 0.75)'
          }}>
            <strong>Welcome to the Practice Room:</strong> Organize your discoveries into a structured practice pipeline. 
            Assign or update actions on technique cards to move them through study, practice, transcription, and application phases.
          </div>

          {/* Interactive Kanban Board */}
          <div style={{
            display: 'flex',
            gap: '15px',
            overflowX: 'auto',
            paddingBottom: '15px',
            alignItems: 'stretch',
            minHeight: '65vh'
          }}>
            {lanes.map(lane => (
              <div 
                key={lane.id} 
                style={{
                  flex: '0 0 340px',
                  background: 'var(--bg-workspace)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '3px',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '12px'
                }}
              >
                {/* Lane Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  paddingBottom: '6px'
                }}>
                  <h4 style={{ margin: 0, fontSize: '11px', color: '#ff6600', letterSpacing: '0.05em' }}>
                    {lane.title}
                  </h4>
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                    {lane.items.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  overflowY: 'auto',
                  maxHeight: 'calc(100vh - 380px)'
                }}>
                  {lane.items.length === 0 ? (
                    <div style={{
                      padding: '30px 10px',
                      textAlign: 'center',
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.25)',
                      fontStyle: 'italic',
                      border: '1px dashed rgba(255,255,255,0.05)',
                      borderRadius: '2px'
                    }}>
                      No action items logged
                    </div>
                  ) : (
                    lane.items.map(tech => (
                      <TechniqueCard key={tech._id} tech={tech} compact={true} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'quicklog' && (
        <form onSubmit={handleQuickLogSubmit} className="panel" style={{ background: 'var(--bg-panel)', maxWidth: '650px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            QUICK LOG NEW DISCOVERY
          </h2>

          {formSuccess && <div className="success">{formSuccess}</div>}
          {formError && <div className="error">{formError}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Technique Name *</label>
              <input
                type="text"
                placeholder="e.g. Polyrhythmic Chord Comping"
                value={newTechName}
                onChange={(e) => setNewTechName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Musical Lens</label>
              <select value={newLens} onChange={(e) => setNewLens(e.target.value)}>
                <option value="rhythm">Rhythm (Orange)</option>
                <option value="harmony">Harmony (Violet)</option>
                <option value="texture">Texture (Teal)</option>
                <option value="arrangement">Arrangement (Rose)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Initial Next Action</label>
              <select value={newNextAction} onChange={(e) => setNewNextAction(e.target.value)}>
                <option value="">NO ACTION (BACKLOG)</option>
                <option value="study">STUDY</option>
                <option value="practice">PRACTICE</option>
                <option value="transcribe">TRANSCRIBE</option>
                <option value="apply">APPLY</option>
                <option value="revisit">REVISIT</option>
              </select>
            </div>

            <div className="form-group">
              <label>Confidence Rating</label>
              <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    onClick={() => setNewConfidence(i)}
                    style={{
                      cursor: 'pointer',
                      fontSize: '18px',
                      color: i <= newConfidence ? '#ff6600' : 'rgba(255,255,255,0.2)',
                      userSelect: 'none'
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Associated Song (Optional)</label>
              <select value={newSongId} onChange={(e) => setNewSongId(e.target.value)}>
                <option value="">None (Standalone Entry)</option>
                {songs.map(song => (
                  <option key={song._id} value={song._id}>
                    {song.title} ({song.artist})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Artist / Source (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Herbie Hancock"
                value={newArtist}
                onChange={(e) => setNewArtist(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Example Timestamp (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 1:45 or 105"
                value={newTimestamp}
                onChange={(e) => setNewTimestamp(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Description *</label>
              <textarea
                placeholder="Analyze the mechanics of the technique. What makes it unique?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                style={{ minHeight: '80px' }}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Initial Practice Notes (Optional)</label>
              <textarea
                placeholder="Log your initial setup, keyboard settings, or exercise patterns..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                style={{ minHeight: '60px' }}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Tags (Comma separated, optional)</label>
              <input
                type="text"
                placeholder="e.g. jazz, voicings, piano"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setFormSuccess('');
                setFormError('');
                setNewTechName('');
                setNewLens('rhythm');
                setNewConfidence(3);
                setNewNextAction('');
                setNewArtist('');
                setNewSongId('');
                setNewTimestamp('');
                setNewDescription('');
                setNewNotes('');
                setNewTags('');
              }}
            >
              Reset Form
            </button>
            <button type="submit" style={{ background: '#ff6600', color: '#0c0c0e', fontWeight: 'bold' }}>
              Log to Notebook
            </button>
          </div>
        </form>
      )}

      {/* Detail / Edit Modal */}
      <TechniqueDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTech(null);
        }}
        tech={selectedTech}
        songs={songs}
        onUpdate={handleUpdateTechnique}
        onDelete={deleteTechnique}
        onOpenTechnique={(t) => {
          // Phase 2.4: open a similar technique without closing the modal chain
          setSelectedTech(t);
        }}
      />
    </div>
  );
};


export default TechniqueNotebook;

