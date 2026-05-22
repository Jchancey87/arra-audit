import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import StyleProvider from './styles/global';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ImportSong from './pages/ImportSong';
import AuditCreate from './pages/AuditCreate';
import AuditForm from './pages/AuditForm';
import AuditDetail from './pages/AuditDetail';
import TechniqueNotebook from './pages/TechniqueNotebook';
import Trash from './pages/Trash';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <>
      <StyleProvider />
      <nav className="container">
        <ul>
          <li>
            <Link to="/" style={{ fontSize: '20px', fontWeight: 'bold' }}>
              🎵 Sonic DNA Audit
            </Link>
          </li>
          {isAuthenticated && (
            <>
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
              <li>
                <Link to="/import">Import Song</Link>
              </li>
              <li>
                <Link to="/techniques">Technique Notebook</Link>
              </li>
              <li>
                <Link to="/trash">Trash</Link>
              </li>
            </>
          )}
          {isAuthenticated && (
            <li className="user-info">
              <span>{user?.displayName || user?.name || user?.email}</span>
              <button onClick={logout} className="secondary">
                Logout
              </button>
            </li>
          )}
        </ul>
      </nav>

      <div className="container" style={{ marginTop: '30px', marginBottom: '30px' }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/import"
            element={
              <PrivateRoute>
                <ImportSong />
              </PrivateRoute>
            }
          />
          <Route
            path="/audit/create/:songId"
            element={
              <PrivateRoute>
                <AuditCreate />
              </PrivateRoute>
            }
          />
          <Route
            path="/audit/form/:auditId"
            element={
              <PrivateRoute>
                <AuditForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/audit/:id"
            element={
              <PrivateRoute>
                <AuditDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/techniques"
            element={
              <PrivateRoute>
                <TechniqueNotebook />
              </PrivateRoute>
            }
          />
          <Route
            path="/trash"
            element={
              <PrivateRoute>
                <Trash />
              </PrivateRoute>
            }
          />
        </Routes>
      </div>
    </>
  );
};

import { BackendProvider } from './context/BackendContext';

function App() {
  return (
    <BrowserRouter>
      <BackendProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BackendProvider>
    </BrowserRouter>
  );
}


export default App;
