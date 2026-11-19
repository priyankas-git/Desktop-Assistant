export interface WindowActions {
  minimize: () => void;
  close: () => void;
  isAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
  showContextMenu: (currentExpression: string, isAlwaysOnTop: boolean) => void;
  onSetExpression: (callback: (expr: string) => void) => () => void;
  onAlwaysOnTopChanged: (callback: (pinned: boolean) => void) => () => void;
  onToggleDevControls: (callback: () => void) => () => void;
}

export interface DesktopAssistantAPI {
  version: string;
  platform: string;
  windowActions: WindowActions;
  getAppVersion: () => Promise<string>;
}

declare global {
  interface Window {
    desktopAssistant?: DesktopAssistantAPI;
    __TOGGLE_DEV_CONTROLS__?: () => void;
    __SET_EXPRESSION__?: (expr: string) => void;
  }
}
