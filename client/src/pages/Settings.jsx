import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useBackend } from '../context/BackendContext';

const LENS_META = {
  rhythm:      { emoji: '🥁', label: 'Rhythm',      desc: 'Groove, pocket, and timing' },
  texture:     { emoji: '🎛️', label: 'Texture',     desc: 'Timbre, space, and mixing' },
  harmony:     { emoji: '🎹', label: 'Harmony',     desc: 'Chords, progressions, keys' },
  arrangement: { emoji: '🎼', label: 'Arrangement', desc: 'Transitions and energy arcs' },
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
                  background: isLoading ? 'rgba(208, 143, 96, 0.1)' : '#d08f60',
                  color: isLoading ? '#d08f60' : '#0c0c0e',
                  border: 'none',
                  padding: '2px 6px',
                  borderRadius: '1px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginLeft: '4px',
                }}
              >
                {isLoading ? 'RESEARCHING...' : matched && matched.summary ? 'RE-RUN DIVE' : '🔬 DEEP DIVE (10 SOURCES)'}
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
      <div className="panel" style={{ background: '#151518', borderBottom: '2px solid #d08f60' }}>
        <h1>Preferences & Settings</h1>
        <p className="card-subtitle">Customize the default behavior of your Sonic DNA workshop</p>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleSave}>
          {/* User profile info */}
          <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 style={{ color: '#d08f60', fontSize: '12px', fontFamily: 'Roboto Mono', marginBottom: '15px' }}>
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
                { id: 'quick',   emoji: '⚡', label: 'Quick',   desc: 'Unified single-page form workflow' },
                { id: 'guided',  emoji: '🎓', label: 'Guided',  desc: 'Interactive step-by-step audit sequence' },
              ].map((w) => {
                const active = defaultWorkflow === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setDefaultWorkflow(w.id)}
                    style={{
                      background: active ? '#d08f60' : '#1c1c22',
                      color: active ? '#0c0c0e' : '#d08f60',
                      padding: '15px',
                      textAlign: 'left',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      border: `1px solid ${active ? '#d08f60' : 'rgba(208, 143, 96, 0.3)'}`,
                      borderRadius: '2px',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ fontSize: '13px', fontFamily: 'Roboto Mono' }}>
                      {w.emoji} {w.label}
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
                      background: active ? '#d08f60' : '#1c1c22',
                      color: active ? '#0c0c0e' : '#d08f60',
                      padding: '12px',
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
                    }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{meta.emoji}</div>
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
                <label style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#d08f60' }}>🥁 Rhythm Tastes</label>
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
                <label style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#d08f60' }}>🎛️ Texture Tastes</label>
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
                <label style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#d08f60' }}>🎹 Harmony Tastes</label>
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
                <label style={{ fontSize: '11px', fontFamily: 'Roboto Mono', color: '#d08f60' }}>🎼 Arrangement Tastes</label>
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
              style={{ background: '#0a0a0c', borderColor: 'rgba(255, 255, 255, 0.12)' }}
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
          <div className="panel" style={{ maxWidth: '400px', width: '90%', margin: '20px', background: '#151518' }}>
            <h2 style={{ fontSize: '13px', fontFamily: 'Roboto Mono', color: '#d08f60', marginBottom: '15px' }}>
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
          <div className="panel" style={{ maxWidth: '450px', width: '90%', margin: '20px', borderTop: '4px solid #f87171', background: '#151518' }}>
            <h2 style={{ color: '#f87171', fontSize: '13px', fontFamily: 'Roboto Mono', marginBottom: '15px' }}>
              ⚠️ Critical: Delete System Account
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
