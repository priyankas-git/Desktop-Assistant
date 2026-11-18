import { contextBridge, ipcRenderer } from 'electron';

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

const api: DesktopAssistantAPI = {
  version: '0.1.0',
  platform: process.platform,
  windowActions: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:set-always-on-top', flag),
  },
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
};

// Safely expose the desktop assistant API via contextBridge
contextBridge.exposeInMainWorld('desktopAssistant', api);
