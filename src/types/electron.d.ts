export interface WindowActions {
  minimize: () => void;
  close: () => void;
  isAlwaysOnTop: () => Promise<boolean>;
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>;
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
  }
}
