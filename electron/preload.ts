import { contextBridge, ipcRenderer } from 'electron';

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

const api: DesktopAssistantAPI = {
  version: '0.1.0',
  platform: process.platform,
  lifecycle: {
    setState: (state: 'sleeping' | 'awake') => ipcRenderer.invoke('lifecycle:set-state', state),
    getState: () => ipcRenderer.invoke('lifecycle:get-state'),
    onGoToSleep: (callback: (info?: { voiceActivated?: boolean }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info?: { voiceActivated?: boolean }) => callback(info);
      ipcRenderer.on('companion:go-to-sleep', handler);
      return () => ipcRenderer.removeListener('companion:go-to-sleep', handler);
    },
    onWakeUp: (callback: (info?: { voiceActivated?: boolean }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info?: { voiceActivated?: boolean }) => callback(info);
      ipcRenderer.on('companion:wake-up', handler);
      return () => ipcRenderer.removeListener('companion:wake-up', handler);
    },
  },
  windowActions: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    isAlwaysOnTop: () => ipcRenderer.invoke('window:get-always-on-top'),
    setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:set-always-on-top', flag),
    showContextMenu: (currentExpression: string, isAlwaysOnTop: boolean, isSleeping?: boolean) => {
      ipcRenderer.send('window:show-context-menu', currentExpression, isAlwaysOnTop, isSleeping);
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
    onManualSleep: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('companion:go-to-sleep', handler);
      return () => ipcRenderer.removeListener('companion:go-to-sleep', handler);
    },
  },
  voiceActivation: {
    toggleMic: () => ipcRenderer.invoke('voice:toggle-mic'),
    setMicEnabled: (enabled: boolean) => ipcRenderer.invoke('voice:set-mic-enabled', enabled),
    getStatus: () => ipcRenderer.invoke('voice:get-status'),
    simulateWakeWord: (phrase?: string) => ipcRenderer.invoke('voice:simulate-wake-word', phrase),
    onStatusChanged: (callback: (status: VoiceActivationStatus) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: VoiceActivationStatus) => callback(status);
      ipcRenderer.on('voice:status-changed', handler);
      return () => ipcRenderer.removeListener('voice:status-changed', handler);
    },
    onWakeWordDetected: (callback: (data: WakeWordDetectionData) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: WakeWordDetectionData) => callback(data);
      ipcRenderer.on('voice:wake-word-detected', handler);
      return () => ipcRenderer.removeListener('voice:wake-word-detected', handler);
    },
  },
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
};

// Safely expose the desktop assistant API via contextBridge
contextBridge.exposeInMainWorld('desktopAssistant', api);
