import React from 'react';

export const StatusCard: React.FC = () => {
  return (
    <div className="companion-card">
      <h1 className="app-title">Desktop-Assistant</h1>
      <p className="app-message">Your desktop companion is getting ready.</p>
      <div className="status-badge">
        <span className="pulse-dot" />
        <span>Ready</span>
      </div>
    </div>
  );
};
