import React from 'react';

export const TitleBar: React.FC = () => {
  const handleMinimize = () => {
    if (window.desktopAssistant) {
      window.desktopAssistant.windowActions.minimize();
    }
  };

  const handleClose = () => {
    if (window.desktopAssistant) {
      window.desktopAssistant.windowActions.close();
    }
  };

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <span className="brand-dot" />
        <span>Desktop-Assistant</span>
      </div>
      <div className="titlebar-controls">
        <button
          type="button"
          className="control-btn"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize"
        >
          &#x2212;
        </button>
        <button
          type="button"
          className="control-btn close"
          onClick={handleClose}
          title="Close"
          aria-label="Close"
        >
          &#x2715;
        </button>
      </div>
    </header>
  );
};
