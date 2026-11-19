import React, { useState, useEffect } from 'react';

export const WindowControls: React.FC = () => {
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

  useEffect(() => {
    if (window.desktopAssistant?.windowActions?.isAlwaysOnTop) {
      window.desktopAssistant.windowActions.isAlwaysOnTop().then((pinned) => {
        setIsAlwaysOnTop(Boolean(pinned));
      });
    }
  }, []);

  const handleMinimize = () => {
    window.desktopAssistant?.windowActions?.minimize();
  };

  const handleClose = () => {
    window.desktopAssistant?.windowActions?.close();
  };

  const handleTogglePin = async () => {
    if (window.desktopAssistant?.windowActions?.setAlwaysOnTop) {
      const next = !isAlwaysOnTop;
      const res = await window.desktopAssistant.windowActions.setAlwaysOnTop(next);
      setIsAlwaysOnTop(Boolean(res));
    }
  };

  return (
    <div className="companion-window-controls" aria-label="Window Actions">
      <button
        type="button"
        className={`window-mini-btn pin-btn ${isAlwaysOnTop ? 'pinned' : ''}`}
        onClick={handleTogglePin}
        title={isAlwaysOnTop ? 'Unpin from top' : 'Pin always on top'}
        aria-label="Toggle always on top"
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
        </svg>
      </button>
      <button
        type="button"
        className="window-mini-btn minimize-btn"
        onClick={handleMinimize}
        title="Minimize companion"
        aria-label="Minimize companion"
      >
        &#x2212;
      </button>
      <button
        type="button"
        className="window-mini-btn close-btn"
        onClick={handleClose}
        title="Close companion"
        aria-label="Close companion"
      >
        &#x2715;
      </button>
    </div>
  );
};
