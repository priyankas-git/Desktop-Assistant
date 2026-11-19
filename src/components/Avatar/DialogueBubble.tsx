import React from 'react';

export interface DialogueBubbleProps {
  text: string;
}

export const DialogueBubble: React.FC<DialogueBubbleProps> = ({ text }) => {
  return (
    <div className="dialogue-bubble-container" aria-live="polite">
      <div className="dialogue-bubble">
        <span className="dialogue-text">{text}</span>
        <div className="bubble-tail" />
      </div>
    </div>
  );
};
