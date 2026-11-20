import React from 'react';
import { AvatarExpression, EXPRESSION_CONFIGS } from '../../types/avatar';

export interface AvatarDisplayProps {
  expression: AvatarExpression;
  isSleeping?: boolean;
  onAvatarClick?: () => void;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  expression,
  isSleeping = false,
  onAvatarClick,
}) => {
  const currentConfig = EXPRESSION_CONFIGS[expression];
  const tooltip = isSleeping
    ? 'Desktop Companion Owl (Sleeping - click to wake)'
    : 'Desktop Companion Owl';

  return (
    <div
      className={`avatar-display expression-${expression} ${isSleeping ? 'avatar-sleeping' : 'avatar-awake'}`}
      onClick={onAvatarClick}
      role="img"
      aria-label={`Desktop companion owl in ${currentConfig.label} state`}
      title={tooltip}
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
