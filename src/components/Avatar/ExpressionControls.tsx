import React from 'react';
import { AvatarExpression, EXPRESSION_CONFIGS } from '../../types/avatar';

export interface ExpressionControlsProps {
  currentExpression: AvatarExpression;
  onSelectExpression: (expression: AvatarExpression) => void;
}

const EXPRESSIONS: AvatarExpression[] = ['happy', 'listening', 'speaking', 'sleeping'];

export const ExpressionControls: React.FC<ExpressionControlsProps> = ({
  currentExpression,
  onSelectExpression,
}) => {
  return (
    <div
      className="expression-controls"
      role="toolbar"
      aria-label="Development Expression Controls"
    >
      <span className="controls-label">Dev expressions:</span>
      <div className="expression-buttons">
        {EXPRESSIONS.map((expr) => {
          const config = EXPRESSION_CONFIGS[expr];
          const isActive = currentExpression === expr;
          return (
            <button
              key={expr}
              type="button"
              className={`expr-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectExpression(expr)}
              title={`Switch expression to ${config.label}`}
              aria-pressed={isActive}
            >
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
