import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';
import { useAuth } from '../context/AuthContext';
import ResearchSummaryRenderer from '../components/ResearchSummaryRenderer';

const LENS_META = {
  rhythm: {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '6px' }}>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="16" x2="6" y2="8"></line>
        <line x1="18" y1="16" x2="18" y2="8"></line>
      </svg>
    ),
    label: 'Rhythm',
    desc: 'Groove, pocket, and timing'
  },
  texture: {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '6px' }}>
        <line x1="4" y1="21" x2="4" y2="14"></line>
        <line x1="4" y1="10" x2="4" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12" y2="3"></line>
        <line x1="20" y1="21" x2="20" y2="16"></line>
        <line x1="20" y1="12" x2="20" y2="3"></line>
        <line x1="2" y1="14" x2="6" y2="14"></line>
        <line x1="10" y1="8" x2="14" y2="8"></line>
        <line x1="18" y1="16" x2="22" y2="16"></line>
      </svg>
    ),
    label: 'Texture',
    desc: 'Timbre, space, and mixing'
  },
  harmony: {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '6px' }}>
        <path d="M9 18V5l12-2v13"></path>
        <circle cx="6" cy="18" r="3"></circle>
        <circle cx="18" cy="16" r="3"></circle>
      </svg>
    ),
    label: 'Harmony',
    desc: 'Chords, progressions, keys'
  },
  arrangement: {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '6px' }}>
        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
        <line x1="3" y1="9" x2="21" y2="9"></line>
        <line x1="3" y1="15" x2="21" y2="15"></line>
        <line x1="9" y1="9" x2="9" y2="21"></line>
        <line x1="15" y1="9" x2="15" y2="21"></line>
      </svg>
    ),
    label: 'Arrangement',
    desc: 'Transitions and energy arcs'
  },
};

const AuditCreate = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const backend = useBackend();
  const { user } = useAuth();

  const [song, setSong] = useState(null);
  const [selectedLenses, setSelectedLenses] = useState(() => user?.preferences?.preferredLenses || []);
  const [workflowType, setWorkflowType] = useState(() => user?.preferences?.defaultWorkflow || 'quick');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadSong(); }, [songId]);

  useEffect(() => {
    if (user?.preferences) {
      if (user.preferences.preferredLenses) {
        setSelectedLenses(user.preferences.preferredLenses);
      }
      if (user.preferences.defaultWorkflow) {
        setWorkflowType(user.preferences.defaultWorkflow);
      }
    }
  }, [user]);

  const loadSong = async () => {
    try {
      const response = await backend.getSong(songId);
      setSong(response);
    } catch {
      setError('Failed to load song');
    } finally {
      setLoading(false);
    }
  };

  const toggleLens = (lens) =>
    setSelectedLenses((prev) =>
      prev.includes(lens) ? prev.filter((l) => l !== lens) : [...prev, lens]
    );

  const handleStartAudit = async () => {
    if (selectedLenses.length === 0) {
      setError('Please select at least one lens');
      return;
    }
    setCreating(true);
    setError('');
    try {
      // Single-step creation: server generates + stores the template
      const { audit } = await backend.createAudit({
        songId,
        lenses: selectedLenses,
        workflowType,
      });
      // Navigate to form with the new audit ID — no sessionStorage needed
      navigate(`/audit/form/${audit._id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to create audit');
      setCreating(false);
    }
  };

  if (loading) return <div className="loading">Loading Reference Target...</div>;
  if (!song)   return <div className="error">Song not found</div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="panel" style={{ background: 'var(--bg-panel)', borderBottom: '2px solid #ff6600' }}>
        <h1>Configure New Audit</h1>

        {error && <div className="error">{error}</div>}

        {/* Song info */}
        <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 style={{ color: '#ff6600' }}>{song.title}</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Roboto Mono', fontSize: '11px', marginTop: '2px' }}>
            by {song.artistName || song.artist}
          </p>
          {song.researchSummary?.summary && (
            <div style={{ 
              marginTop: '15px', 
              background: '#0c0c0e', 
              padding: '15px', 
              borderRadius: '2px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <strong style={{ fontFamily: 'Roboto Mono', fontSize: '11px', color: '#ff6600', display: 'block', marginBottom: '10px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
                RESEARCH INTELLIGENCE LOG:
              </strong>
              <ResearchSummaryRenderer summary={song.researchSummary.summary} compact={true} />
            </div>
          )}
          {song.researchStatus === 'failed' && (
            <div style={{ 
              marginTop: '12px', 
              color: '#ff6600', 
              fontSize: '11px', 
              fontFamily: 'Roboto Mono',
              background: 'rgba(255, 102, 0, 0.05)',
              border: '1px solid rgba(255, 102, 0, 0.15)',
              padding: '8px 12px',
              borderRadius: '2px'
            }}>
              ⚠️ Research summary unavailable — initializing direct observation workflow.
            </div>
          )}
        </div>

        {/* Lens selection */}
        <div style={{ marginBottom: '30px' }}>
          <h3>Select Lenses</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.45)', marginBottom: '15px', fontSize: '12px' }}>
            Choose one or more study perspectives:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '15px' }}>
            {Object.entries(LENS_META).map(([lens, meta]) => {
              const active = selectedLenses.includes(lens);
              return (
                <button
                  key={lens}
                  id={`lens-${lens}`}
                  onClick={() => toggleLens(lens)}
                  style={{
                    background: active ? '#ff6600' : '#1c1c22',
                    color: active ? '#0c0c0e' : '#ff6600',
                    padding: '15px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: `1px solid ${active ? '#ff6600' : 'rgba(255, 102, 0, 0.3)'}`,
                    borderRadius: '2px',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '120px'
                  }}
                >
                  {meta.icon}
                  <div style={{ fontFamily: 'Roboto Mono', fontSize: '11px' }}>{meta.label}</div>
                  <div style={{ 
                    fontSize: '9px', 
                    fontFamily: 'Inter',
                    fontWeight: 'normal', 
                    marginTop: '6px', 
                    opacity: 0.8,
                    lineHeight: '1.3'
                  }}>
                    {meta.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Workflow type */}
        <div style={{ marginBottom: '30px' }}>
          <h3>Workflow Type</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {[
              { 
                id: 'quick', 
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                ), 
                label: 'Quick', 
                time: '5–15 Min', 
                hint: 'All questions unified on a single screen' 
              },
              { 
                id: 'guided', 
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
                  </svg>
                ), 
                label: 'Guided', 
                time: '30–60 Min', 
                hint: 'Listen → Sketch → Translate → Recreate → Log' 
              },
            ].map((w) => {
              const active = workflowType === w.id;
              return (
                <button
                  key={w.id}
                  id={`workflow-${w.id}`}
                  onClick={() => setWorkflowType(w.id)}
                  style={{
                    background: active ? '#ff6600' : '#1c1c22',
                    color: active ? '#0c0c0e' : '#ff6600',
                    padding: '15px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: `1px solid ${active ? '#ff6600' : 'rgba(255, 102, 0, 0.3)'}`,
                    borderRadius: '2px',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '14px', fontFamily: 'Roboto Mono' }}>
                    {w.icon}
                    <span>{w.label}</span>
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', fontFamily: 'Roboto Mono', color: active ? '#0c0c0e' : 'rgba(255, 255, 255, 0.65)' }}>{w.time}</div>
                  <div style={{ 
                    fontSize: '9px', 
                    fontFamily: 'Inter',
                    fontWeight: 'normal', 
                    marginTop: '4px', 
                    opacity: 0.8,
                    lineHeight: '1.3'
                  }}>{w.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Start button */}
        <button
          id="start-audit-btn"
          onClick={handleStartAudit}
          disabled={selectedLenses.length === 0 || creating}
          style={{ 
            width: '100%', 
            fontSize: '12px', 
            padding: '12px',
            background: (selectedLenses.length === 0 || creating) ? '#1c1c22' : '#ff6600',
            color: (selectedLenses.length === 0 || creating) ? 'rgba(255,255,255,0.4)' : '#0c0c0e',
            fontWeight: 'bold'
          }}
        >
          {creating ? 'Synthesizing Questions...' : 'Start Audit Sequence →'}
        </button>

        {creating && (
          <p style={{ 
            textAlign: 'center', 
            color: 'rgba(255, 255, 255, 0.45)', 
            marginTop: '12px', 
            fontSize: '11px',
            fontFamily: 'Roboto Mono'
          }}>
            Contacting GPT core module for custom synthesis generation...
          </p>
        )}
      </div>
    </div>
  );
};

export default AuditCreate;
