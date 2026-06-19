import React, { useRef } from 'react';

const AuditTabBar = ({ tabs, activeTab, onChange }) => {
  const barRef = useRef(null);
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);

  const handleKey = (e) => {
    if (e.key === 'ArrowRight' && activeIndex < tabs.length - 1) {
      e.preventDefault();
      onChange(tabs[activeIndex + 1].id);
    } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
      e.preventDefault();
      onChange(tabs[activeIndex - 1].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(tabs[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(tabs[tabs.length - 1].id);
    }
  };

  return (
    <div
      ref={barRef}
      role="tablist"
      aria-label="Audit workspace tabs"
      tabIndex={0}
      onKeyDown={handleKey}
      className="audit-tabbar"
      style={{ outline: 'none' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tab-panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            tabIndex={isActive ? 0 : -1}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
              borderRadius: 0,
              padding: '0 2px',
              margin: 0,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'color 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {tab.icon && <span style={{ display: 'inline-flex' }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge != null && (
              <span
                style={{
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                  fontSize: '10px',
                  fontWeight: 600,
                }}
              >
                ({tab.badge})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default AuditTabBar;
