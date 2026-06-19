import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Render error caught by ErrorBoundary:', error, info);
  }

  handleReset() {
    this.setState({ error: null });
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error?.message || 'An unexpected render error occurred.';
      return (
        <div
          role="alert"
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface-0)',
            color: 'var(--text-primary)',
            padding: '24px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              background: 'var(--bg-surface-1)',
              border: '1px solid var(--border-subtle)',
              padding: '24px',
            }}
          >
            <h1
              style={{
                margin: 0,
                marginBottom: '8px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--accent-primary)',
              }}
            >
              Workspace Error
            </h1>
            <p
              style={{
                margin: '0 0 12px 0',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              The workspace hit a render error. Your local edits are preserved.
            </p>
            <pre
              style={{
                margin: '0 0 16px 0',
                padding: '8px 10px',
                background: 'var(--bg-surface-2)',
                color: 'var(--color-error)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '10px',
                lineHeight: 1.4,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {message}
            </pre>
            <button
              type="button"
              onClick={this.handleReset}
              className="primary"
              style={{ minWidth: '160px' }}
            >
              Reload workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
