import React from 'react';
import { useAvatarState } from '../hooks/useAvatarState';
import { DialogueBubble } from './Avatar/DialogueBubble';
import { AvatarDisplay } from './Avatar/AvatarDisplay';
import { ExpressionControls } from './Avatar/ExpressionControls';
import { MicToggle } from './Controls/MicToggle';

export const Companion: React.FC = () => {
  const {
    expression,
    dialogueText,
    isMicEnabled,
    showDevControls,
    isAlwaysOnTop,
    setExpression,
    toggleMic,
    cycleNextExpression,
    toggleAlwaysOnTop,
    handleContextMenu,
  } = useAvatarState();

  const handleMinimize = () => {
    window.desktopAssistant?.windowActions?.minimize();
  };

  const handleClose = () => {
    window.desktopAssistant?.windowActions?.close();
  };

  return (
    <div
      className="companion-container companion-card"
      onContextMenu={handleContextMenu}
    >
      {/* Subtle hover-only quick window controls */}
      <div className="hover-window-controls" aria-label="Window Actions">
        <button
          type="button"
          className={`mini-icon-btn pin-btn ${isAlwaysOnTop ? 'pinned' : ''}`}
          onClick={toggleAlwaysOnTop}
          title={isAlwaysOnTop ? 'Unpin from top' : 'Pin always on top'}
          aria-label="Toggle always on top"
        >
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </button>
        <button
          type="button"
          className="mini-icon-btn"
          onClick={handleMinimize}
          title="Minimize companion"
          aria-label="Minimize"
        >
          &#x2212;
        </button>
        <button
          type="button"
          className="mini-icon-btn close-btn"
          onClick={handleClose}
          title="Close companion"
          aria-label="Close"
        >
          &#x2715;
        </button>
      </div>

      {/* Main compact stage */}
      <div className="companion-stage">
        <DialogueBubble text={dialogueText} />
        <AvatarDisplay
          expression={expression}
          onAvatarClick={cycleNextExpression}
        />
      </div>

      {/* Microphone toggle beneath owl */}
      <div className="companion-footer">
        <MicToggle isEnabled={isMicEnabled} onToggle={toggleMic} />
      </div>

      {/* Development-only expression switcher (hidden by default, revealed via Ctrl+Shift+D or menu) */}
      {showDevControls && (
        <div className="companion-dev-dock">
          <ExpressionControls
            currentExpression={expression}
            onSelectExpression={setExpression}
          />
        </div>
      )}
    </div>
  );
};
