import React, { useState, useEffect } from 'react';
import { useBackend } from '../context/BackendContext';
import { useAudio } from '../context/AudioContext';
import EmptyState from '../components/EmptyState';

const TechniqueNotebook = () => {
  const [techniques, setTechniques] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLens, setFilterLens] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  
  const backend = useBackend();
  const { seekTo, activeSong } = useAudio();

  useEffect(() => {
    loadTechniques();
  }, [searchTerm, filterLens, sortBy, order]);

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
      setTechniques(response.techniques);
      setGrouped(response.grouped);
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

  const formatTimestamp = (seconds) => {
    if (!seconds && seconds !== 0) return '';
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading && techniques.length === 0) return <div className="loading">LOADING TECHNIQUE REGISTRIES...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="panel" style={{ background: '#151518', borderBottom: '2px solid #d08f60' }}>
        <h1>📚 Technique Notebook</h1>
        <p className="card-subtitle" style={{ margin: 0 }}>
          Your personal collection of musical DNA, portable patterns, and structural discoveries.
        </p>

        {error && <div className="error">{error}</div>}

        {/* Filters & Search */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap', marginTop: '20px' }}>
          <div style={{ flex: 2, minWidth: '300px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Search</label>
            <input
              type="text"
              placeholder="Filter by name, description, artist, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: '#0a0a0c', borderColor: 'rgba(255,255,255,0.12)' }}
            />
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Lens</label>
            <select
              value={filterLens}
              onChange={(e) => setFilterLens(e.target.value)}
              style={{ width: '100%', background: '#0a0a0c', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <option value="all">All Lenses</option>
              <option value="rhythm">Rhythm</option>
              <option value="texture">Texture</option>
              <option value="harmony">Harmony</option>
              <option value="arrangement">Arrangement</option>
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ width: '100%', background: '#0a0a0c', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <option value="createdAt">Date Added</option>
              <option value="techniqueName">Name</option>
              <option value="lens">Lens</option>
              <option value="artist">Artist</option>
            </select>
          </div>
        </div>

        {/* Lens Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
          {['rhythm', 'texture', 'harmony', 'arrangement'].map((lens) => (
            <div 
              key={lens} 
              style={{ 
                background: '#0c0c0e', 
                padding: '12px', 
                borderRadius: '2px', 
                textAlign: 'center', 
                border: '1px solid rgba(255, 255, 255, 0.06)' 
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d08f60', fontFamily: 'Roboto Mono' }}>
                {grouped[lens]?.length || 0}
              </div>
              <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'Roboto Mono', marginTop: '2px' }}>
                {lens}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Techniques list */}
      {techniques.length === 0 ? (
        <EmptyState 
          icon="📓"
          title={searchTerm || filterLens !== 'all' ? "No matching techniques" : "Notebook is empty"}
          description={searchTerm || filterLens !== 'all' ? "Try adjusting your filters or search terms." : "Start an audit on a song to discover and log techniques. Your notebook is where you collect the 'how' behind the music you study."}
          ctaLabel={searchTerm || filterLens !== 'all' ? "Clear All Filters" : "Go to Library"}
          onCtaClick={searchTerm || filterLens !== 'all' ? () => { setSearchTerm(''); setFilterLens('all'); } : null}
          ctaLink={searchTerm || filterLens !== 'all' ? null : "/dashboard"}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))', gap: '20px', marginTop: '20px' }}>
          {techniques.map((tech) => (
            <div key={tech._id} className="panel" style={{ margin: 0, display: 'flex', flexDirection: 'column', background: '#151518', borderColor: 'rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '13px' }}>{tech.techniqueName || 'Untitled Technique'}</h3>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <span className="badge primary" style={{ textTransform: 'uppercase' }}>{tech.lens}</span>
                    {tech.confidence && <span className="badge">CONFIDENCE: {tech.confidence}/5</span>}
                    {tech.nextAction && <span className="badge warning" style={{ textTransform: 'uppercase' }}>{tech.nextAction}</span>}
                  </div>
                </div>
                <button
                  onClick={() => deleteTechnique(tech._id)}
                  className="danger"
                  style={{ padding: '4px 8px', fontSize: '10px' }}
                  title="Remove from notebook"
                >
                  🗑️
                </button>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '12px', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '15px' }}>
                  {tech.description}
                </p>
                
                {(tech.artist || tech.exampleTimestamp !== undefined) && (
                  <div style={{ 
                    backgroundColor: '#0c0c0e', 
                    padding: '8px 12px', 
                    borderRadius: '2px', 
                    fontSize: '11px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.65)',
                    fontFamily: 'Roboto Mono',
                    marginTop: 'auto'
                  }}>
                    {tech.artist && <span>📍 <strong>SOURCE:</strong> {tech.artist}</span>}
                    {tech.exampleTimestamp !== undefined && (
                      <span 
                        onClick={() => {
                          if (activeSong) {
                            seekTo(tech.exampleTimestamp);
                          }
                        }}
                        style={{ 
                          marginLeft: '10px',
                          cursor: activeSong ? 'pointer' : 'not-allowed',
                          color: activeSong ? '#d08f60' : 'rgba(255,255,255,0.4)',
                          textDecoration: activeSong ? 'underline' : 'none'
                        }}
                        title={activeSong ? "Click to seek in player" : "Load active song to seek"}
                      >
                        ⏱️ <strong>TIMESTAMP:</strong> {formatTimestamp(tech.exampleTimestamp)}
                      </span>
                    )}
                  </div>
                )}

                {tech.notes && (
                  <div style={{ 
                    marginTop: '12px', 
                    borderLeft: '3px solid rgba(255,255,255,0.12)', 
                    paddingLeft: '12px', 
                    fontSize: '11px', 
                    color: 'rgba(255,255,255,0.45)', 
                    fontStyle: 'italic' 
                  }}>
                    {tech.notes}
                  </div>
                )}

                {tech.tags?.length > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {tech.tags.map(tag => (
                      <span 
                        key={tag} 
                        style={{ 
                          fontSize: '10px', 
                          fontFamily: 'Roboto Mono',
                          color: '#d08f60', 
                          background: 'rgba(208, 143, 96, 0.1)', 
                          padding: '1px 6px', 
                          borderRadius: '1px',
                          border: '1px solid rgba(208, 143, 96, 0.25)'
                        }}
                      >
                        #{tag.toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TechniqueNotebook;
