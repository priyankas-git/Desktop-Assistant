import React from 'react';

export interface MicToggleProps {
  isEnabled: boolean;
  isListening?: boolean;
  onToggle: () => void;
}

export const MicToggle: React.FC<MicToggleProps> = ({ isEnabled, isListening, onToggle }) => {
  const statusLabel = isEnabled ? 'Voice activation: ON' : 'Voice activation: OFF';
  const tooltipText = isEnabled
    ? 'Voice activation is enabled (Click to mute)'
    : 'Voice activation is disabled (Click to enable)';

  return (
    <div className="mic-toggle-wrapper">
      <button
        type="button"
        className={`mic-toggle-btn ${isEnabled ? 'enabled' : 'disabled'} ${isListening ? 'listening' : ''}`}
        onClick={onToggle}
        aria-pressed={isEnabled}
        aria-label={statusLabel}
        title={tooltipText}
      >
        <span className={`mic-indicator-dot ${isListening ? 'listening-active' : ''}`} />
        <svg
          className="mic-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {isEnabled ? (
            <>
              {/* Active microphone */}
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </>
          ) : (
            <>
              {/* Muted microphone with slash */}
              <line x1="2" y1="2" x2="22" y2="22" />
              <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
              <path d="M5 10v2a7 7 0 0 0 12 5" />
              <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="8" y1="22" x2="16" y2="22" />
            </>
          )}
        </svg>
        <span className="mic-status-text">{isEnabled ? 'Voice On' : 'Voice Off'}</span>
      </button>
      <div className="mic-tooltip" role="status">
        {statusLabel}
      </div>
    </div>
  );
};
