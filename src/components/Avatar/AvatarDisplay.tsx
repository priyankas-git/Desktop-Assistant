import React from 'react';
import { AvatarExpression, EXPRESSION_CONFIGS } from '../../types/avatar';

export interface AvatarDisplayProps {
  expression: AvatarExpression;
  onAvatarClick?: () => void;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  expression,
  onAvatarClick,
}) => {
  const currentConfig = EXPRESSION_CONFIGS[expression];

  return (
    <div
      className={`avatar-display expression-${expression}`}
      onClick={onAvatarClick}
      role="img"
      aria-label={`Desktop companion owl in ${currentConfig.label} state`}
      title="Desktop Companion Owl (Click to cycle mood)"
    >
      <img
        src={currentConfig.spriteUrl}
        alt={`Owl companion (${currentConfig.label})`}
        className="pixel-avatar"
        draggable={false}
      />
    </div>
  );
};
