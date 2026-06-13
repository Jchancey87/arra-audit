import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBackend } from '../context/BackendContext';

const LENS_META = {
  rhythm:      {
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="16" x2="6" y2="8"></line>
        <line x1="18" y1="16" x2="18" y2="8"></line>
      </svg>
    ),
    label: 'Rhythm',
    desc: 'Groove, pocket, and timing'
  },
  texture:     {
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
  harmony:     {
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
    ),
    label: 'Harmony',
    desc: 'Chords, progressions, keys'
  },
  arrangement: {
    icon: (props) => (
      <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const Settings = () => {
  const { user, updateUserPreferences, updateUserProfile, changePassword, deleteAccount } = useAuth();
  const backend = useBackend();

  const currentPrefs = user?.preferences || {};
  const [defaultWorkflow, setDefaultWorkflow] = useState(currentPrefs.defaultWorkflow || 'quick');
  const [preferredLenses, setPreferredLenses] = useState(currentPrefs.preferredLenses || []);
  const [timezone, setTimezone] = useState(currentPrefs.timezone || 'UTC');
  const [name, setName] = useState('');

  const currentTastes = currentPrefs.tastes || {};
  const [rhythmTaste, setRhythmTaste] = useState(currentTastes.rhythm || 'Jamerson, Radiohead');
  const [textureTaste, setTextureTaste] = useState(currentTastes.texture || 'Flaming Lips, Pink Floyd');
  const [harmonyTaste, setHarmonyTaste] = useState(currentTastes.harmony || 'Jimmy Webb, Beach Boys, Radiohead');
  const [arrangementTaste, setArrangementTaste] = useState(currentTastes.arrangement || 'Jimmy Webb, Beach Boys, Pink Floyd, Radiohead');

  const [tasteProfiles, setTasteProfiles] = useState([]);
  const [researching, setResearching] = useState({});

  useEffect(() => {
    const loadTastes = async () => {
      try {
        const profiles = await backend.getTasteProfiles();
        setTasteProfiles(profiles || []);
      } catch (err) {
        console.error('Failed to load taste profiles:', err);
      }
    };
    loadTastes();
  }, [backend]);

  const handleResearchTaste = async (lens, artistName) => {
    if (!artistName) return;
    const key = `${lens}-${artistName}`;
    setResearching(prev => ({ ...prev, [key]: true }));
    try {
      const response = await backend.researchTasteProfile(lens, artistName);
      if (response && response.profile) {
        setTasteProfiles(prev => {
          const idx = prev.findIndex(p => p.lens === lens && p.name.toLowerCase() === artistName.toLowerCase());
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = response.profile;
            return updated;
          }
          return [...prev, response.profile];
        });
      }
    } catch (err) {
      alert(`Research failed: ${err.message}`);
    } finally {
      setResearching(prev => ({ ...prev, [key]: false }));
    }
  };

  const renderTasteStatus = (lens, value) => {
    if (!value || typeof value !== 'string') return null;
    const artists = value.split(',').map(name => name.trim()).filter(Boolean);
    if (artists.length === 0) return null;

    return (
      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {artists.map((artist) => {
          const matched = tasteProfiles.find(
            p => p.lens === lens && p.name.toLowerCase() === artist.toLowerCase()
          );
          const key = `${lens}-${artist}`;
          const isLoading = researching[key];
          
          return (
            <div 
              key={artist}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#0c0c0e',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '4px 8px',
                borderRadius: '2px',
                fontSize: '11px',
                fontFamily: 'Roboto Mono',
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.85)' }}>{artist}</span>
              {matched && matched.summary ? (
                <span 
                  style={{ color: '#4ade80', fontSize: '9px', fontWeight: 'bold', cursor: 'help' }}
                  title={matched.summary}
                >
                  ✓ RESEARCHED
                </span>
              ) : (
                <span style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: '9px' }}>
                  AWAITING DEEP DIVE
                </span>
              )}
              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleResearchTaste(lens, artist)}
                style={{
                  background: isLoading ? 'rgba(255, 102, 0, 0.1)' : '#ff6600',
                  color: isLoading ? '#ff6600' : '#0c0c0e',
                  border: 'none',
                  padding: '2px 6px',
                  borderRadius: '1px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
              >
              {isLoading ? (
                'RESEARCHING...'
              ) : matched && matched.summary ? (
                'RE-RUN DIVE'
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                  DEEP DIVE (10 SOURCES)
                </span>
              )}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Timezone search filter state
  const [tzSearch, setTzSearch] = useState('');

  // Change Password state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Delete Account state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingAcc, setDeletingAcc] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || user.displayName || '');
      const prefs = user.preferences || {};
      setDefaultWorkflow(prefs.defaultWorkflow || 'quick');
      setPreferredLenses(prefs.preferredLenses || []);
      setTimezone(prefs.timezone || 'UTC');
      const tastes = prefs.tastes || {};
      setRhythmTaste(tastes.rhythm || 'Jamerson, Radiohead');
      setTextureTaste(tastes.texture || 'Flaming Lips, Pink Floyd');
      setHarmonyTaste(tastes.harmony || 'Jimmy Webb, Beach Boys, Radiohead');
      setArrangementTaste(tastes.arrangement || 'Jimmy Webb, Beach Boys, Pink Floyd, Radiohead');
    }
  }, [user]);

  const toggleLens = (lens) => {
    setPreferredLenses((prev) =>
      prev.includes(lens) ? prev.filter((l) => l !== lens) : [...prev, lens]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');

    try {
      // Save profile updates (name)
      await updateUserProfile({ name });
      
      // Save preferences
      await updateUserPreferences({
        defaultWorkflow,
        preferredLenses,
        timezone,
        tastes: {
          rhythm: rhythmTaste,
          texture: textureTaste,
          harmony: harmonyTaste,
          arrangement: arrangementTaste
        }
      });
      setSuccess('Preferences saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setChangingPass(true);
    try {
      await changePassword(oldPassword, newPassword);
      setPasswordSuccess('Password successfully updated!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess('');
      }, 1500);
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password');
    } finally {
      setChangingPass(false);
    }
  };

  const handleDeleteAccountSubmit = async (e) => {
    e.preventDefault();
    setDeleteError('');

    if (deleteConfirmText !== user?.email) {
      setDeleteError('Please type your exact email to confirm deletion.');
      return;
    }

    setDeletingAcc(true);
    try {
      await deleteAccount();
      // AuthContext deleteAccount handles redirecting/logging out
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account');
      setDeletingAcc(false);
    }
  };

  const filteredTimezones = TIMEZONES.filter((tz) =>
    tz.toLowerCase().includes(tzSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="panel" style={{ background: 'var(--bg-panel)', borderBottom: '2px solid #ff6600' }}>
        <h1>Preferences & Settings</h1>
        <p className="card-subtitle">Customize the default behavior of your Arra workshop</p>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleSave}>
          {/* User profile info */}
          <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ color: '#ff6600', fontSize: '12px', fontFamily: 'Roboto Mono', marginBottom: '15px' }}>
              Account Profile
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Email:</span>
              <span style={{ fontFamily: 'Roboto Mono', color: 'rgba(255,255,255,0.75)' }}>{user?.email}</span>
              
              <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>Name:</span>
              <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                required
                style={{ 
                  background: '#0c0c0e', 
                  borderColor: 'rgba(255, 255, 255, 0.12)', 
                  padding: '6px 10px', 
                  fontSize: '12px', 
                  width: '100%',
                  maxWidth: '300px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', paddingLeft: '100px' }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setIsPasswordModalOpen(true)}
                style={{ padding: '6px 12px', fontSize: '10px' }}
              >
                Change Password
              </button>
              <button 
                type="button" 
                className="danger" 
                onClick={() => setIsDeleteModalOpen(true)}
                style={{ padding: '6px 12px', fontSize: '10px' }}
              >
                Delete Account
              </button>
            </div>
          </div>

          {/* Workflow setting */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '10px' }}>Default Workflow</h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.45)', marginBottom: '15px', fontSize: '12px' }}>
              Choose which workflow sequence opens by default when configuring a new audit:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {[
                { 
                  id: 'quick',   
                  icon: (props) => (
                    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                  ),
                  label: 'Quick',   
                  desc: 'Unified single-page form workflow' 
                },
                { 
                  id: 'guided',  
                  icon: (props) => (
                    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"></path>
                    </svg>
                  ),
                  label: 'Guided',  
                  desc: 'Interactive step-by-step audit sequence' 
                },
              ].map((w) => {
                const active = defaultWorkflow === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setDefaultWorkflow(w.id)}
                    style={{
                      background: active ? '#ff6600' : '#1c1c22',
                      color: active ? '#0c0c0e' : '#ff6600',
                      padding: '15px',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: `1px solid ${active ? '#ff6600' : 'rgba(255, 102, 0, 0.3)'}`,
                      borderRadius: '2px',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontFamily: 'Roboto Mono', display: 'flex', alignItems: 'center' }}>
                      {w.icon({ width: 14, height: 14, style: { marginRight: '6px' } })} {w.label}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      fontFamily: 'Inter',
                      fontWeight: 'normal',
                      color: active ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.6)',
                      lineHeight: '1.3'
                    }}>
                      {w.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Lenses setting */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ marginBottom: '10px' }}>Preferred Lenses</h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.45)', marginBottom: '15px', fontSize: '12px' }}>
              Select which lenses are pre-checked by default for new audits:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              {Object.entries(LENS_META).map(([lens, meta]) => {
                const active = preferredLenses.includes(lens);
                return (
                  <button
                    key={lens}
                    type="button"
                    onClick={() => toggleLens(lens)}
                    style={{
                      background: active ? '#ff6600' : '#1c1c22',
                      color: active ? '#0c0c0e' : '#ff6600',
                      padding: '12px',
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
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                      {meta.icon({ width: 20, height: 20 })}
                    </div>
                    <div style={{ fontFamily: 'Roboto Mono', fontSize: '10px' }}>
                      {meta.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference Tastes setting */}
          <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ marginBottom: '10px' }}>Reference Tastes (Concrete Exercises)</h3>
            <p style={{ color: 'rgba(255, 255, 255, 0.45)', marginBottom: '15px', fontSize: '12px' }}>
              Specify reference artists, producers, or styles for each lens to tailor the concrete study exercises generated for your audits:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#ff6600', display: 'flex', alignItems: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="16" x2="6" y2="8"></line>
                    <line x1="18" y1="16" x2="18" y2="8"></line>
                  </svg>
                  Rhythm Tastes
                </label>
                <input
                  type="text"
                  value={rhythmTaste}
                  onChange={(e) => setRhythmTaste(e.target.value)}
                  placeholder="e.g. Jamerson, Radiohead"
                  style={{ background: '#0c0c0e', borderColor: 'rgba(255,255,255,0.12)' }}
                />
                {renderTasteStatus('rhythm', rhythmTaste)}
              </div>
              <div className="form-group">
                <label style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#ff6600', display: 'flex', alignItems: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
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
                  Texture Tastes
                </label>
                <input
                  type="text"
                  value={textureTaste}
                  onChange={(e) => setTextureTaste(e.target.value)}
                  placeholder="e.g. Flaming Lips, Pink Floyd"
                  style={{ background: '#0c0c0e', borderColor: 'rgba(255,255,255,0.12)' }}
                />
                {renderTasteStatus('texture', textureTaste)}
              </div>
              <div className="form-group">
                <label style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#ff6600', display: 'flex', alignItems: 'center' }}>
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
                  Harmony Tastes
                </label>
                <input
                  type="text"
                  value={harmonyTaste}
                  onChange={(e) => setHarmonyTaste(e.target.value)}
                  placeholder="e.g. Jimmy Webb, Beach Boys, Radiohead"
                  style={{ background: '#0c0c0e', borderColor: 'rgba(255,255,255,0.12)' }}
                />
                {renderTasteStatus('harmony', harmonyTaste)}
              </div>
              <div className="form-group">
                <label style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#ff6600', display: 'flex', alignItems: 'center' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="3" y1="15" x2="21" y2="15"></line>
                    <line x1="9" y1="9" x2="9" y2="21"></line>
                    <line x1="15" y1="9" x2="15" y2="21"></line>
                  </svg>
                  Arrangement Tastes
                </label>
                <input
                  type="text"
                  value={arrangementTaste}
                  onChange={(e) => setArrangementTaste(e.target.value)}
                  placeholder="e.g. Jimmy Webb, Beach Boys, Pink Floyd, Radiohead"
                  style={{ background: '#0c0c0e', borderColor: 'rgba(255,255,255,0.12)' }}
                />
                {renderTasteStatus('arrangement', arrangementTaste)}
              </div>
            </div>
          </div>

          {/* Timezone setting with filter */}
          <div className="form-group" style={{ marginBottom: '30px' }}>
            <label style={{ marginBottom: '6px' }}>Timezone</label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Filter timezones..."
                value={tzSearch}
                onChange={(e) => setTzSearch(e.target.value)}
                style={{ 
                  background: '#0c0c0e', 
                  borderColor: 'rgba(255, 255, 255, 0.12)', 
                  padding: '6px 10px',
                  fontSize: '11px',
                  maxWidth: '200px'
                }}
              />
              {tzSearch && (
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={() => setTzSearch('')}
                  style={{ padding: '6px 10px', fontSize: '9px' }}
                >
                  Clear
                </button>
              )}
            </div>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={{ background: 'var(--bg-workspace)', borderColor: 'rgba(255, 255, 255, 0.12)' }}
            >
              {/* Ensure currently selected timezone is always shown */}
              {!TIMEZONES.includes(timezone) && (
                <option value={timezone}>{timezone}</option>
              )}
              {filteredTimezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
              {filteredTimezones.length === 0 && (
                <option disabled>No matching timezones found</option>
              )}
            </select>
          </div>

          {/* Submit */}
          <button type="submit" disabled={saving} style={{ width: '100%', padding: '12px', fontWeight: 'bold' }}>
            {saving ? 'Saving Preferences...' : 'Save Preferences'}
          </button>
        </form>
      </div>

      {/* Change Password Modal */}
      {isPasswordModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="panel" style={{ maxWidth: '400px', width: '90%', margin: '20px', background: 'var(--bg-panel)' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'Roboto Mono', color: '#ff6600', marginBottom: '15px' }}>
              Change Password
            </h2>
            
            {passwordError && <div className="error">{passwordError}</div>}
            {passwordSuccess && <div className="success">{passwordSuccess}</div>}

            <form onSubmit={handleChangePasswordSubmit}>
              <div className="form-group">
                <label>Current Password</label>
                <input 
                  type="password" 
                  value={oldPassword} 
                  onChange={(e) => setOldPassword(e.target.value)} 
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label>Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" disabled={changingPass} style={{ flex: 1 }}>
                  {changingPass ? 'Updating...' : 'Update Password'}
                </button>
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={() => {
                    setIsPasswordModalOpen(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                  }}
                  disabled={changingPass}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div className="panel" style={{ maxWidth: '450px', width: '90%', margin: '20px', borderTop: '4px solid #f87171', background: 'var(--bg-panel)' }}>
            <h2 style={{ color: '#f87171', fontSize: '13px', fontFamily: 'Roboto Mono', marginBottom: '15px', display: 'flex', alignItems: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              Critical: Delete System Account
            </h2>
            
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5', marginBottom: '15px' }}>
              This operation will permanently delete your user profile, all song catalogs, audits, and technique descubrimientos. This cannot be undone.
            </p>

            <p style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#f87171', marginBottom: '15px' }}>
              To confirm, type your account email: <strong>{user?.email}</strong>
            </p>

            {deleteError && <div className="error">{deleteError}</div>}

            <form onSubmit={handleDeleteAccountSubmit}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input 
                  type="text" 
                  placeholder="Type your email to confirm..."
                  value={deleteConfirmText} 
                  onChange={(e) => setDeleteConfirmText(e.target.value)} 
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="danger" disabled={deletingAcc} style={{ flex: 1 }}>
                  {deletingAcc ? 'Deleting...' : 'Permanently Delete Account'}
                </button>
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmText('');
                    setDeleteError('');
                  }}
                  disabled={deletingAcc}
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
