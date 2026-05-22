import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackend } from '../context/BackendContext';

const ImportSong = () => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();
  const backend = useBackend();

  const handleImport = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!youtubeUrl.trim()) {
      setError('Please enter a YouTube URL');
      return;
    }

    setLoading(true);
    try {
      const response = await backend.importSong(youtubeUrl);
      setSuccess('Song imported successfully!');
      setYoutubeUrl('');
      setTimeout(() => navigate(`/audit/create/${response.song._id}`), 1000);
    } catch (err) {
      const data = err.response?.data;
      // 409: song already imported — redirect to existing song
      if (data?.error === 'already_imported' && data?.songId) {
        setSuccess("You've already imported this song — taking you there now.");
        setTimeout(() => navigate(`/audit/create/${data.songId}`), 1200);
      } else {
        setError(data?.error || err.message || 'Failed to import song');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="panel" style={{ background: '#151518', borderBottom: '2px solid #d08f60' }}>
        <h1>Import Song from YouTube</h1>
        <p className="card-subtitle">Paste a YouTube URL to import a song for analysis</p>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleImport}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label style={{ marginBottom: '6px' }}>YouTube URL</label>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={loading}
              style={{ background: '#0a0a0c', borderColor: 'rgba(255, 255, 255, 0.12)' }}
            />
            <small style={{ color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Roboto Mono', fontSize: '9px', marginTop: '6px', display: 'block' }}>
              SUPPORTED: youtube.com, youtu.be, or any standard YouTube video link
            </small>
          </div>

          <button type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Importing...' : 'Import Song'}
          </button>
        </form>

        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <h3 style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#d08f60', marginBottom: '10px' }}>
            SIGNAL EXTRACTION SEQUENCE
          </h3>
          <ol style={{ marginLeft: '18px', lineHeight: '1.8', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
            <li>Extract song metadata from the video signal source</li>
            <li>Deploy Tavily researcher to index historical production details</li>
            <li>Initiate audit worksheet configuration across selected lenses</li>
            <li>Generate customized GPT synthesis questions for the track</li>
            <li>Log reference observations and export portable production techniques</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ImportSong;
