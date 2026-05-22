import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';

const LENS_META = {
  rhythm:      { emoji: '🥁', label: 'Rhythm',      desc: 'Groove, pocket, and timing' },
  texture:     { emoji: '🎛️', label: 'Texture',     desc: 'Timbre, space, and mixing' },
  harmony:     { emoji: '🎹', label: 'Harmony',     desc: 'Chords, progressions, keys' },
  arrangement: { emoji: '🎼', label: 'Arrangement', desc: 'Transitions and energy arcs' },
};

const AuditCreate = () => {
  const { songId } = useParams();
  const navigate = useNavigate();
  const backend = useBackend();

  const [song, setSong] = useState(null);
  const [selectedLenses, setSelectedLenses] = useState([]);
  const [workflowType, setWorkflowType] = useState('quick');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadSong(); }, [songId]);

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

  if (loading) return <div className="loading">LOADING REFERENCE TARGET...</div>;
  if (!song)   return <div className="error">Song not found</div>;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="panel" style={{ background: '#151518', borderBottom: '2px solid #d08f60' }}>
        <h1>Configure New Audit</h1>

        {error && <div className="error">{error}</div>}

        {/* Song info */}
        <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 style={{ color: '#d08f60' }}>{song.title}</h3>
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
              <strong style={{ fontFamily: 'Roboto Mono', fontSize: '11px', color: '#d08f60' }}>RESEARCH INTELLIGENCE LOG:</strong>
              <p style={{ fontSize: '12px', lineHeight: '1.6', marginTop: '8px', color: 'rgba(255, 255, 255, 0.75)' }}>
                {song.researchSummary.summary}
              </p>
            </div>
          )}
          {song.researchStatus === 'failed' && (
            <div style={{ 
              marginTop: '12px', 
              color: '#d08f60', 
              fontSize: '11px', 
              fontFamily: 'Roboto Mono',
              background: 'rgba(208, 143, 96, 0.05)',
              border: '1px solid rgba(208, 143, 96, 0.15)',
              padding: '8px 12px',
              borderRadius: '2px'
            }}>
              ⚠️ RESEARCH SUMMARY UNAVAILABLE — INITIALIZING DIRECT OBSERVATION WORKFLOW.
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
                    background: active ? '#d08f60' : '#1c1c22',
                    color: active ? '#0c0c0e' : '#d08f60',
                    padding: '15px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: `1px solid ${active ? '#d08f60' : 'rgba(208, 143, 96, 0.3)'}`,
                    borderRadius: '2px',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '120px'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>{meta.emoji}</div>
                  <div style={{ fontFamily: 'Roboto Mono', fontSize: '11px', textTransform: 'uppercase' }}>{meta.label}</div>
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
              { id: 'quick',   emoji: '⚡', label: 'Quick',   time: '5–15 MIN',  hint: 'All questions unified on a single screen' },
              { id: 'guided',  emoji: '🎓', label: 'Guided',  time: '30–60 MIN', hint: 'Listen → Sketch → Translate → Recreate → Log' },
            ].map((w) => {
              const active = workflowType === w.id;
              return (
                <button
                  key={w.id}
                  id={`workflow-${w.id}`}
                  onClick={() => setWorkflowType(w.id)}
                  style={{
                    background: active ? '#d08f60' : '#1c1c22',
                    color: active ? '#0c0c0e' : '#d08f60',
                    padding: '15px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: `1px solid ${active ? '#d08f60' : 'rgba(208, 143, 96, 0.3)'}`,
                    borderRadius: '2px',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <div style={{ fontSize: '14px', fontFamily: 'Roboto Mono', textTransform: 'uppercase' }}>{w.emoji} {w.label}</div>
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
            background: (selectedLenses.length === 0 || creating) ? '#1c1c22' : '#d08f60',
            color: (selectedLenses.length === 0 || creating) ? 'rgba(255,255,255,0.4)' : '#0c0c0e',
            fontWeight: 'bold'
          }}
        >
          {creating ? 'SYNTHESIZING QUESTIONS...' : 'START AUDIT SEQUENCE →'}
        </button>

        {creating && (
          <p style={{ 
            textAlign: 'center', 
            color: 'rgba(255, 255, 255, 0.45)', 
            marginTop: '12px', 
            fontSize: '11px',
            fontFamily: 'Roboto Mono'
          }}>
            CONTACTING GPT CORE MODULE FOR CUSTOM SYNTHESIS GENERATION...
          </p>
        )}
      </div>
    </div>
  );
};

export default AuditCreate;
