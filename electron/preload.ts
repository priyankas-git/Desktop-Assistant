import { contextBridge, ipcRenderer } from 'electron';

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

const api: DesktopAssistantAPI = {
  version: '0.1.0',
  platform: process.platform,
  windowActions: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:set-always-on-top', flag),
    showContextMenu: (currentExpression: string, isAlwaysOnTop: boolean) => {
      ipcRenderer.send('window:show-context-menu', currentExpression, isAlwaysOnTop);
    },
    onSetExpression: (callback: (expr: string) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, expr: string) => callback(expr);
      ipcRenderer.on('companion:set-expression', handler);
      return () => ipcRenderer.removeListener('companion:set-expression', handler);
    },
    onAlwaysOnTopChanged: (callback: (pinned: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, pinned: boolean) => callback(pinned);
      ipcRenderer.on('window:always-on-top-changed', handler);
      return () => ipcRenderer.removeListener('window:always-on-top-changed', handler);
    },
    onToggleDevControls: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('companion:toggle-dev-tools', handler);
      return () => ipcRenderer.removeListener('companion:toggle-dev-tools', handler);
    },
  },
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
};

// Safely expose the desktop assistant API via contextBridge
contextBridge.exposeInMainWorld('desktopAssistant', api);
