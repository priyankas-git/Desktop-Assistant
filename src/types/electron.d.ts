export interface LifecycleActions {
  setState: (state: 'sleeping' | 'awake') => Promise<void>;
  getState: () => Promise<'sleeping' | 'awake'>;
  onGoToSleep: (callback: (info?: { voiceActivated?: boolean }) => void) => () => void;
  onWakeUp: (callback: (info?: { voiceActivated?: boolean }) => void) => () => void;
}

export interface WindowActions {
  minimize: () => void;
  close: () => void;
  isAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  showContextMenu: (currentExpression: string, isAlwaysOnTop: boolean, isSleeping?: boolean) => void;
  onSetExpression: (callback: (expr: string) => void) => () => void;
  onAlwaysOnTopChanged: (callback: (pinned: boolean) => void) => () => void;
  onToggleDevControls: (callback: () => void) => () => void;
  onManualSleep: (callback: () => void) => () => void;
}

export interface VoiceActivationStatus {
  isMicEnabled: boolean;
  isListening: boolean;
  modelLoaded: boolean;
  modelName: string;
  modelPath: string | null;
  error?: string | null;
  activeDevice?: string;
}

export interface WakeWordDetectionData {
  wakeWord: string;
  score: number;
  state: 'sleeping' | 'awake';
  simulated?: boolean;
  timestamp: number;
}

export interface VoiceActivationActions {
  toggleMic: () => Promise<boolean>;
  setMicEnabled: (enabled: boolean) => Promise<boolean>;
  getStatus: () => Promise<VoiceActivationStatus>;
  simulateWakeWord: (phrase?: string) => Promise<{ success: boolean }>;
  onStatusChanged: (callback: (status: VoiceActivationStatus) => void) => () => void;
  onWakeWordDetected: (callback: (data: WakeWordDetectionData) => void) => () => void;
}

export interface DesktopAssistantAPI {
  version: string;
  platform: string;
  windowActions: WindowActions;
  lifecycle: LifecycleActions;
  voiceActivation: VoiceActivationActions;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    desktopAssistant?: DesktopAssistantAPI;
    __TOGGLE_DEV_CONTROLS__?: () => void;
    __SET_EXPRESSION__?: (expr: string) => void;
    __SET_IDLE_TIMEOUT_MS__?: (ms: number) => void;
    __GET_LIFECYCLE_STATE__?: () => string;
    __WAKE_UP__?: (voiceActivated?: boolean) => void;
    __GO_TO_SLEEP__?: () => void;
    __RESET_IDLE_TIMER__?: () => void;
    __SIMULATE_WAKE_WORD__?: (phrase?: string) => Promise<unknown>;
    __GET_VOICE_STATUS__?: () => Promise<VoiceActivationStatus | undefined>;
    __TOGGLE_MIC__?: () => Promise<boolean | undefined>;
  }
}
