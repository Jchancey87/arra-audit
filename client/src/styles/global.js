import React from 'react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Noto+Sans:wght@400;700&family=Roboto+Mono:wght@400;500;700&display=swap');

  :root {
    --bg-primary: #121212;
    --bg-app: #121212;
    --bg-panel: #1A1A1A;
    --bg-workspace: #1A1A1A;
    --bg-active: #252525;
    --bg-header: #1A1A1A;
    --accent-orange: #D97706;
    --accent-orange-hover: #f59e0b;
    --accent-cyan: #00e5ff;
    --border-color: #2a2a2a;
    --text-muted: #9CA3AF;
    --text-active: #ffffff;
    --status-high: #34D399;
    --status-med: #FACC15;
    --status-low: #f87171;
    
    --color-audio: #00e5ff;
    --color-metadata: #ffd700;
    --color-structure: #e0b0ff;
    --color-error: #ff5252;
  }

  button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
    outline: 2px solid var(--accent-orange);
    outline-offset: 2px;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  ::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  ::-webkit-scrollbar-track {
    background: var(--bg-primary);
  }
  ::-webkit-scrollbar-thumb {
    background: #333;
    border-radius: 2px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--accent-orange);
  }

  body {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 400;
    background: var(--bg-primary);
    color: var(--text-active);
    overflow: hidden;
    height: 100vh;
    -webkit-font-smoothing: antialiased;
    letter-spacing: 0.01em;
  }

  /* Typography — DAW-native scale */
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Roboto Mono', monospace;
    font-weight: 600;
    color: var(--text-active);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  h1 { font-size: 14px; margin-bottom: 8px; color: rgba(255,255,255,0.9); }
  h2 { font-size: 12px; margin-bottom: 8px; color: var(--accent-orange); }
  h3 { font-size: 11px; margin-bottom: 6px; color: rgba(255,255,255,0.6); }

  p {
    font-size: 11px;
    line-height: 1.5;
    color: var(--text-muted);
  }

  .container {
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 8px;
  }

  /* Panels — borderless, depth via background shade */
  .card, .panel {
    background: var(--bg-panel);
    border: none;
    border-radius: 2px;
    padding: 12px;
    margin-bottom: 8px;
    transition: background 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .card:hover, .panel:hover {
    background: var(--bg-active);
  }

  .song-card-thumbnail {
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
  }
  .panel:hover .song-card-thumbnail {
    transform: scale(1.02);
    opacity: 0.85 !important;
  }

  .song-card-actions {
    opacity: 0;
    visibility: hidden;
    max-height: 0;
    overflow: hidden;
    transition: opacity 0.2s ease, max-height 0.25s ease, visibility 0.2s;
  }
  .panel:hover .song-card-actions {
    opacity: 1;
    visibility: visible;
    max-height: 350px;
    margin-top: 12px;
  }

  .card-title {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-active);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .card-subtitle {
    font-size: 10px;
    color: var(--text-muted);
    margin-bottom: 8px;
    font-family: 'Roboto Mono', monospace;
  }

  /* Buttons */
  button, .btn {
    font-family: 'Inter', sans-serif;
    font-size: 10px;
    font-weight: 500;
    background: #222;
    color: var(--text-muted);
    border: 1px solid #333;
    padding: 5px 10px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  button:hover:not(:disabled), .btn:hover:not(:disabled) {
    background: #2a2a2a;
    color: #ffffff;
    border-color: #444;
  }

  button.primary, button.btn-primary, .btn-primary {
    background: var(--accent-orange);
    color: #0c0c0e;
    border-color: var(--accent-orange);
    font-weight: 600;
  }

  button.primary:hover:not(:disabled), button.btn-primary:hover:not(:disabled), .btn-primary:hover:not(:disabled) {
    background: var(--accent-orange-hover);
    color: #ffffff;
    border-color: var(--accent-orange-hover);
  }

  button.secondary, button.btn-secondary, .btn-secondary {
    background: #1e1e1e;
    color: var(--text-muted);
    border-color: #2a2a2a;
  }

  button.secondary:hover:not(:disabled), button.btn-secondary:hover:not(:disabled), .btn-secondary:hover:not(:disabled) {
    background: #252525;
    color: var(--text-active);
    border-color: #3a3a3a;
  }

  button.success, button.btn-success, .btn-success {
    background: rgba(52, 211, 153, 0.1);
    color: var(--status-high);
    border-color: rgba(52, 211, 153, 0.2);
  }

  button.success:hover:not(:disabled), button.btn-success:hover:not(:disabled), .btn-success:hover:not(:disabled) {
    background: rgba(52, 211, 153, 0.2);
    color: #ffffff;
    border-color: var(--status-high);
  }

  button.danger, button.btn-danger, .btn-danger {
    background: rgba(255, 82, 82, 0.1);
    color: var(--color-error);
    border-color: rgba(255, 82, 82, 0.2);
  }

  button.danger:hover:not(:disabled), button.btn-danger:hover:not(:disabled), .btn-danger:hover:not(:disabled) {
    background: rgba(255, 82, 82, 0.2);
    color: #ffffff;
    border-color: var(--color-error);
  }

  button:disabled, .btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    color: var(--text-muted);
    background: #1a1a1a;
    border-color: #2a2a2a;
  }

  /* Forms & Inputs */
  .form-group {
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    color: #6B7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  input, textarea, select {
    background: #222;
    border: 1px solid #444;
    color: var(--text-active);
    padding: 5px 8px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    width: 100%;
    transition: border-color 0.15s ease;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: var(--accent-orange);
  }

  textarea {
    min-height: 70px;
    resize: vertical;
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 5px;
    background: rgba(255,255,255,0.04);
    border: none;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
    font-size: 8px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: default;
    user-select: none;
  }

  .badge.primary {
    background: rgba(217, 119, 6, 0.1);
    color: var(--accent-orange);
  }

  .badge.success {
    background: rgba(52, 211, 153, 0.08);
    color: var(--status-high);
  }

  .badge.warning {
    background: rgba(250, 204, 21, 0.08);
    color: var(--status-med);
  }

  /* Info / Error boxes */
  .error {
    background: rgba(255, 82, 82, 0.06);
    color: var(--color-error);
    border: 1px solid rgba(255, 82, 82, 0.15);
    border-left: 3px solid var(--color-error);
    padding: 8px 12px;
    font-size: 10px;
    margin-bottom: 10px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
  }

  .success {
    background: rgba(52, 211, 153, 0.06);
    color: var(--status-high);
    border: 1px solid rgba(52, 211, 153, 0.15);
    border-left: 3px solid var(--status-high);
    padding: 8px 12px;
    font-size: 10px;
    margin-bottom: 10px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
  }

  .mb-10 { margin-bottom: 10px; }
  .mb-20 { margin-bottom: 20px; }
  .mb-30 { margin-bottom: 30px; }
  .mt-10 { margin-top: 10px; }
  .mt-20 { margin-top: 20px; }

  a {
    color: var(--accent-orange);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  a:hover {
    color: var(--accent-orange-hover);
  }

  .loading {
    text-align: center;
    padding: 20px 10px;
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.1em;
  }

  @keyframes pulse-led {
    0%, 100% { opacity: 0.35; transform: scale(0.9); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  @keyframes vu-level-bounce {
    0% { opacity: 0.85; filter: brightness(0.95); }
    100% { opacity: 1; filter: brightness(1.2); }
  }
`;

const StyleProvider = () => {
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = styles;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return null;
};

export default StyleProvider;

