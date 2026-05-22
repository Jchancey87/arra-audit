import React from 'react';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto+Mono:wght@400;500;700&display=swap');

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  /* Custom Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: #0c0c0e;
  }
  ::-webkit-scrollbar-thumb {
    background: #25252b;
    border-radius: 2px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #d08f60;
  }

  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: #0c0c0e;
    color: rgba(255, 255, 255, 0.85);
    overflow: hidden; /* Main window doesn't scroll, panels do */
    height: 100vh;
    -webkit-font-smoothing: antialiased;
  }

  /* Typography */
  h1, h2, h3, h4, h5, h6 {
    font-family: 'Roboto Mono', monospace;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: -0.02em;
    text-transform: uppercase;
  }

  h1 { font-size: 1.5rem; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 6px; }
  h2 { font-size: 1.15rem; margin-bottom: 10px; }
  h3 { font-size: 0.95rem; margin-bottom: 8px; }

  p {
    font-size: 13px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.65);
  }

  /* Layout Base */
  .container {
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 0;
  }

  /* Grid & Flex Utilities */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 15px;
  }

  /* Hard-edged Panels (replacing Cards) */
  .card, .panel {
    background: #151518;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    padding: 15px;
    margin-bottom: 15px;
    transition: border-color 0.2s ease, background 0.2s ease;
  }

  .card:hover, .panel:hover {
    border-color: rgba(208, 143, 96, 0.2);
  }

  .card-title {
    font-family: 'Roboto Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin-bottom: 8px;
    text-transform: uppercase;
  }

  .card-subtitle {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.45);
    margin-bottom: 12px;
    font-family: 'Roboto Mono', monospace;
  }

  /* Buttons (Analog/Instrument theme) */
  button {
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 500;
    background: #1c1c22;
    color: #d08f60;
    border: 1px solid rgba(208, 143, 96, 0.3);
    padding: 8px 16px;
    border-radius: 2px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  button:hover:not(:disabled) {
    background: #d08f60;
    color: #0c0c0e;
    border-color: #d08f60;
  }

  button.secondary {
    background: #151518;
    color: rgba(255, 255, 255, 0.65);
    border-color: rgba(255, 255, 255, 0.15);
  }

  button.secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.95);
    border-color: rgba(255, 255, 255, 0.3);
  }

  button.danger {
    background: #251515;
    color: #f87171;
    border-color: rgba(248, 113, 113, 0.3);
  }

  button.danger:hover:not(:disabled) {
    background: #f87171;
    color: #0c0c0e;
    border-color: #f87171;
  }

  button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    border-color: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.4);
  }

  /* Forms & Inputs */
  .form-group {
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
  }

  input, textarea, select {
    background: #0a0a0c;
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
    padding: 8px 12px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;
    width: 100%;
    transition: border-color 0.15s ease;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    border-color: #d08f60;
  }

  textarea {
    min-height: 80px;
    resize: vertical;
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 6px;
    background: #222226;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  .badge.primary {
    background: rgba(208, 143, 96, 0.1);
    color: #d08f60;
    border-color: rgba(208, 143, 96, 0.2);
  }

  .badge.success {
    background: rgba(56, 142, 60, 0.1);
    color: #4ade80;
    border-color: rgba(74, 222, 128, 0.2);
  }

  .badge.warning {
    background: rgba(178, 106, 0, 0.1);
    color: #f59e0b;
    border-color: rgba(245, 158, 11, 0.2);
  }

  /* Info / Error boxes */
  .error {
    background: rgba(220, 38, 38, 0.1);
    color: #f87171;
    border: 1px solid rgba(220, 38, 38, 0.2);
    border-left: 3px solid #dc2626;
    padding: 10px 15px;
    font-size: 12px;
    margin-bottom: 12px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
  }

  .success {
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-left: 3px solid #10b981;
    padding: 10px 15px;
    font-size: 12px;
    margin-bottom: 12px;
    border-radius: 2px;
    font-family: 'Roboto Mono', monospace;
  }

  /* Spacing helpers */
  .mb-10 { margin-bottom: 10px; }
  .mb-20 { margin-bottom: 20px; }
  .mb-30 { margin-bottom: 30px; }
  .mt-10 { margin-top: 10px; }
  .mt-20 { margin-top: 20px; }

  /* Interactive Elements */
  a {
    color: #d08f60;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  a:hover {
    color: #e5a374;
  }

  /* Loading indicator */
  .loading {
    text-align: center;
    padding: 30px 15px;
    font-family: 'Roboto Mono', monospace;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    letter-spacing: 0.1em;
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

