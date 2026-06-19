import React from 'react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans:wght@400;700&family=Roboto+Mono:wght@400;500;700&display=swap');

  :root {
    /* Surface scale */
    --bg-surface-0: #111114;
    --bg-surface-1: #18181c;
    --bg-surface-2: #202024;
    --bg-surface-3: #28282e;
    --bg-surface-hover: #2e2e36;

    /* App/legacy aliases */
    --bg-app: var(--bg-surface-0);
    --bg-workspace: var(--bg-surface-0);
    --bg-panel: var(--bg-surface-1);
    --bg-header: var(--bg-surface-2);
    --bg-primary: var(--bg-surface-0);

    /* Accent */
    --accent-primary: #ff6a00;
    --accent-primary-muted: #5a2e12;
    --accent-primary-bg: #ff6a0010;
    --accent-orange: var(--accent-primary);
    --accent-orange-hover: #ff8a33;
    --accent-cyan: #00e5ff;

    /* Text */
    --text-primary: #f2f2f2;
    --text-secondary: #9ca0a6;
    --text-tertiary: #5a5d65;
    --text-accent: var(--accent-primary);
    --text-muted: var(--text-secondary);
    --text-active: var(--text-primary);

    /* Status */
    --status-success: #35d777;
    --status-success-muted: #1a3d2a;
    --status-warning: #d8a737;
    --status-warning-muted: #3d3520;
    --status-confident: var(--status-success);
    --status-probable: var(--status-warning);
    --status-high: var(--status-success);
    --status-med: var(--status-warning);
    --status-low: #d84040;
    --color-error: #ff5252;

    /* Borders */
    --border-subtle: #2a2a30;
    --border-none: transparent;
    --border-color: var(--border-subtle);

    /* Track/Category colors (preserved) */
    --color-audio: #00e5ff;
    --color-metadata: #ffd700;
    --color-structure: #e0b0ff;
  }

  button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
    outline: 2px solid var(--accent-primary);
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
    background: var(--bg-surface-0);
  }
  ::-webkit-scrollbar-thumb {
    background: var(--border-subtle);
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--accent-primary);
  }

  body {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    font-weight: 400;
    background: var(--bg-surface-0);
    color: var(--text-primary);
    overflow: hidden;
    height: 100vh;
    -webkit-font-smoothing: antialiased;
    letter-spacing: 0.005em;
  }

  /* Typography scale (per spec 2) */
  h1, h2, h3, h4, h5, h6 {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  h1 {
    font-size: 13px;
    margin-bottom: 8px;
    letter-spacing: 0.08em;
  }
  h2 {
    font-size: 13px;
    margin-bottom: 8px;
    letter-spacing: 0.04em;
    font-weight: 600;
  }
  h3 {
    font-size: 11px;
    margin-bottom: 6px;
    letter-spacing: 0.04em;
  }

  p {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
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
    gap: var(--space-md, 12px);
  }

  /* Panels — NO shadows, NO borders, depth via surface layering */
  .card, .panel {
    background: var(--bg-surface-1);
    border: none;
    border-radius: 0;
    padding: 12px;
    margin-bottom: 8px;
    transition: background 0.2s ease;
  }

  .card:hover, .panel:hover {
    background: var(--bg-surface-1);
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
    color: var(--text-primary);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .card-subtitle {
    font-size: 10px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Buttons — DAW native, no border-radius, no shadow */
  button, .btn {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    background: var(--bg-surface-2);
    color: var(--text-secondary);
    border: none;
    border-radius: 0;
    padding: 6px 12px;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  button:hover:not(:disabled), .btn:hover:not(:disabled) {
    background: var(--bg-surface-3);
    color: var(--text-primary);
  }

  button.primary, button.btn-primary, .btn-primary {
    background: var(--accent-primary);
    color: var(--bg-surface-0);
  }

  button.primary:hover:not(:disabled), button.btn-primary:hover:not(:disabled), .btn-primary:hover:not(:disabled) {
    background: var(--accent-orange-hover);
    color: #ffffff;
  }

  button.secondary, button.btn-secondary, .btn-secondary {
    background: var(--bg-surface-2);
    color: var(--text-secondary);
  }

  button.secondary:hover:not(:disabled), button.btn-secondary:hover:not(:disabled), .btn-secondary:hover:not(:disabled) {
    background: var(--bg-surface-3);
    color: var(--text-primary);
  }

  button.ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid transparent;
  }

  button.ghost:hover:not(:disabled) {
    color: var(--text-primary);
    background: var(--bg-surface-2);
    border-color: var(--border-subtle);
  }

  button.success, button.btn-success, .btn-success {
    background: var(--status-success-muted);
    color: var(--status-success);
  }

  button.success:hover:not(:disabled), button.btn-success:hover:not(:disabled), .btn-success:hover:not(:disabled) {
    background: var(--status-success);
    color: var(--bg-surface-0);
  }

  button.danger, button.btn-danger, .btn-danger {
    background: rgba(255, 82, 82, 0.1);
    color: var(--color-error);
  }

  button.danger:hover:not(:disabled), button.btn-danger:hover:not(:disabled), .btn-danger:hover:not(:disabled) {
    background: var(--color-error);
    color: #ffffff;
  }

  button:disabled, .btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    color: var(--text-tertiary);
    background: var(--bg-surface-2);
  }

  /* Forms & Inputs — per spec, no border-radius */
  .form-group {
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  input, textarea, select {
    background: var(--bg-surface-3);
    border: none;
    color: var(--text-primary);
    padding: 6px 8px;
    border-radius: 0;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    width: 100%;
    transition: outline-color 0.15s ease;
    outline: 1px solid transparent;
  }

  input:focus, textarea:focus, select:focus {
    outline: 1px solid var(--accent-primary);
  }

  textarea {
    min-height: 70px;
    resize: vertical;
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 5px;
    background: var(--bg-surface-2);
    border: none;
    border-radius: 2px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: default;
    user-select: none;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .badge.primary {
    background: var(--accent-primary-bg);
    color: var(--accent-primary);
  }

  .badge.success {
    background: var(--status-success-muted);
    color: var(--status-success);
  }

  .badge.warning {
    background: var(--status-warning-muted);
    color: var(--status-warning);
  }

  /* Info / Error boxes — NO shadows, NO border-radius */
  .error {
    background: rgba(255, 82, 82, 0.06);
    color: var(--color-error);
    border: none;
    border-left: 3px solid var(--color-error);
    padding: 8px 12px;
    font-size: 10px;
    margin-bottom: 10px;
    font-family: 'JetBrains Mono', monospace;
  }

  .success {
    background: var(--status-success-muted);
    color: var(--status-success);
    border: none;
    border-left: 3px solid var(--status-success);
    padding: 8px 12px;
    font-size: 10px;
    margin-bottom: 10px;
    font-family: 'JetBrains Mono', monospace;
  }

  .mb-10 { margin-bottom: 10px; }
  .mb-20 { margin-bottom: 20px; }
  .mb-30 { margin-bottom: 30px; }
  .mt-10 { margin-top: 10px; }
  .mt-20 { margin-top: 20px; }

  a {
    color: var(--accent-primary);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  a:hover {
    color: var(--accent-orange-hover);
  }

  .loading {
    text-align: center;
    padding: 20px 10px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: var(--text-secondary);
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
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes scan-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
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
