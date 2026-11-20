import happySprite from '../../assets/sprites/happy.png';
import listeningSprite from '../../assets/sprites/listening.png';
import sleepingSprite from '../../assets/sprites/sleeping.png';
import speakingSprite from '../../assets/sprites/speaking.png';

export type AvatarExpression = 'sleeping' | 'listening' | 'speaking' | 'happy';

export type AvatarLifecycleState = 'sleeping' | 'awake' | 'listening' | 'speaking' | 'happy';

export interface AvatarExpressionConfig {
  expression: AvatarExpression;
  label: string;
  spriteUrl: string;
  defaultDialogue: string;
}

export const EXPRESSION_CONFIGS: Record<AvatarExpression, AvatarExpressionConfig> = {
  sleeping: {
    expression: 'sleeping',
    label: 'Sleeping',
    spriteUrl: sleepingSprite,
    defaultDialogue: 'Zzz...',
  },
  listening: {
    expression: 'listening',
    label: 'Listening',
    spriteUrl: listeningSprite,
    defaultDialogue: "I'm listening!",
  },
  speaking: {
    expression: 'speaking',
    label: 'Speaking',
    spriteUrl: speakingSprite,
    defaultDialogue: "Okay! I'm on it.",
  },
  happy: {
    expression: 'happy',
    label: 'Happy',
    spriteUrl: happySprite,
    defaultDialogue: 'Yay!',
  },
};

export const INITIAL_LIFECYCLE_STATE: AvatarLifecycleState = 'sleeping';
export const INITIAL_EXPRESSION: AvatarExpression = 'sleeping';
export const INITIAL_DIALOGUE = 'Zzz...';
export const WAKE_DIALOGUE = "I'm here! What do you need?";
export const SLEEP_DIALOGUE = 'Zzz...';
export const DEFAULT_IDLE_TIMEOUT_MS = 30000;

