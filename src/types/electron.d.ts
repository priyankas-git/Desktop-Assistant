export interface LifecycleActions {
  setState: (state: 'sleeping' | 'awake') => Promise<void>;
  getState: () => Promise<'sleeping' | 'awake'>;
  onGoToSleep: (callback: () => void) => () => void;
  onWakeUp: (callback: () => void) => () => void;
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

export interface DesktopAssistantAPI {
  version: string;
  platform: string;
  windowActions: WindowActions;
  lifecycle: LifecycleActions;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    desktopAssistant?: DesktopAssistantAPI;
    __TOGGLE_DEV_CONTROLS__?: () => void;
    __SET_EXPRESSION__?: (expr: string) => void;
    __SET_IDLE_TIMEOUT_MS__?: (ms: number) => void;
    __GET_LIFECYCLE_STATE__?: () => string;
    __WAKE_UP__?: () => void;
    __GO_TO_SLEEP__?: () => void;
    __RESET_IDLE_TIMER__?: () => void;
  }
}

