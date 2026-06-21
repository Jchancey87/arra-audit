import React, { createContext, useState, useCallback, useEffect } from 'react';
import { useBackend } from './BackendContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(false);
  
  const backend = useBackend();

  const login = useCallback((userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', authToken);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      if (token) {
        try {
          const profile = await backend.getUserProfile();
          setUser(profile);
          localStorage.setItem('user', JSON.stringify(profile));
        } catch (err) {
          console.error('Failed to load user profile on start:', err);
          if (err.response?.status === 401) {
            logout();
          }
        }
      }
    };
    fetchProfile();
  }, [token, backend, logout]);

  const updateUserPreferences = useCallback(async (preferences) => {
    try {
      const updatedPrefs = await backend.updatePreferences(preferences);
      setUser(prev => {
        const updatedUser = {
          ...prev,
          preferences: updatedPrefs
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
      });
      return updatedPrefs;
    } catch (err) {
      console.error('Failed to update user preferences:', err);
      throw err;
    }
  }, [backend]);

  const updateUserProfile = useCallback(async (profileData) => {
    try {
      const updatedUser = await backend.updateProfile(profileData);
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      console.error('Failed to update user profile:', err);
      throw err;
    }
  }, [backend]);

  const changePassword = useCallback(async (oldPassword, newPassword) => {
    try {
      return await backend.changePassword(oldPassword, newPassword);
    } catch (err) {
      console.error('Failed to change password:', err);
      throw err;
    }
  }, [backend]);

  const deleteAccount = useCallback(async () => {
    try {
      const result = await backend.deleteAccount();
      logout();
      return result;
    } catch (err) {
      console.error('Failed to delete account:', err);
      throw err;
    }
  }, [backend, logout]);

  const value = {
    user,
    token,
    loading,
    setLoading,
    login,
    logout,
    updateUserPreferences,
    updateUserProfile,
    changePassword,
    deleteAccount,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
