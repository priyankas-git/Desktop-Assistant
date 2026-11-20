import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { PythonProcess } from './pythonProcess';

export interface VoiceActivationStatus {
  isMicEnabled: boolean;
  isListening: boolean;
  modelLoaded: boolean;
  modelName: string;
  modelPath: string | null;
  error?: string | null;
  activeDevice?: string;
}

export interface WakeWordDetection {
  wakeWord: string;
  score: number;
  state: 'sleeping' | 'awake';
  simulated?: boolean;
  timestamp: number;
}

export interface WakeWordServiceCallbacks {
  onWakeUp: () => void;
  onGoToSleep: () => void;
  moveToForeground: () => void;
  moveToSleepingPos: () => void;
}

export class WakeWordService {
  private pythonProcess: PythonProcess;
  private mainWindow: BrowserWindow | null = null;
  private isMicEnabled: boolean = false;
  private isListening: boolean = false;
  private companionState: 'sleeping' | 'awake' = 'sleeping';
  private modelLoaded: boolean = false;
  private modelName: string = 'mischief_managed';
  private modelPath: string | null = null;
  private lastError: string | null = null;
  private activeDevice: string = 'Default';
  private lastDetectionTime: number = 0;
  private readonly cooldownMs: number = 2500;
  private callbacks: WakeWordServiceCallbacks | null = null;
  private settingsFilePath: string;

  constructor() {
    this.pythonProcess = new PythonProcess();
    try {
      this.settingsFilePath = path.join(app.getPath('userData'), 'voice-settings.json');
    } catch {
      this.settingsFilePath = path.join(process.cwd(), '.voice-settings.json');
    }
    this.loadPersistedPreference();
    this.setupPythonProcess();
  }

  private loadPersistedPreference(): void {
    try {
      if (fs.existsSync(this.settingsFilePath)) {
        const raw = fs.readFileSync(this.settingsFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed?.isMicEnabled === 'boolean') {
          this.isMicEnabled = parsed.isMicEnabled;
          console.log(`[WakeWordService] Loaded persisted mic preference: isMicEnabled=${this.isMicEnabled}`);
        }
      }
    } catch (err) {
      console.warn('[WakeWordService] Failed to load persisted mic preference:', err);
      this.isMicEnabled = false;
    }
  }

  private persistPreference(): void {
    try {
      const data = {
        isMicEnabled: this.isMicEnabled,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('[WakeWordService] Failed to persist mic preference:', err);
    }
  }

  private setupPythonProcess(): void {
    this.pythonProcess.onEvent((event: Record<string, unknown>) => {
      this.handlePythonEvent(event);
    });

    this.pythonProcess.onError((err: Error | string) => {
      console.error('[WakeWordService] Python process error:', err);
      this.lastError = typeof err === 'string' ? err : err.message;
      this.broadcastStatus();
    });

    this.pythonProcess.onExit((code: number | null) => {
      console.warn(`[WakeWordService] Python process exited with code ${code}`);
      this.isListening = false;
      this.broadcastStatus();
    });
  }

  private handlePythonEvent(event: Record<string, unknown>): void {
    const type = event.type as string;

    if (type === 'ready' || type === 'status') {
      this.modelLoaded = Boolean(event.model_loaded);
      this.modelName = (event.model_name as string) || 'mischief_managed';
      this.modelPath = (event.model_path as string) || null;
      this.isListening = Boolean(event.is_listening);
      this.lastError = (event.error as string) || null;
      this.broadcastStatus();
    } else if (type === 'listening_started') {
      this.isListening = true;
      this.activeDevice = (event.device as string) || 'Default Microphone';
      this.lastError = null;
      this.broadcastStatus();
    } else if (type === 'listening_stopped') {
      this.isListening = false;
      this.broadcastStatus();
    } else if (type === 'detection') {
      this.handleWakeWordDetection({
        wakeWord: (event.wake_word as string) || 'mischief_managed',
        score: Number(event.score) || 1.0,
        state: (event.state as 'sleeping' | 'awake') || this.companionState,
        simulated: Boolean(event.simulated),
        timestamp: Number(event.timestamp) || Date.now(),
      });
    } else if (type === 'error') {
      this.lastError = (event.message as string) || 'Audio device error';
      console.error(`[WakeWordService] Python reported error [${event.code}]: ${event.message}`);
      this.broadcastStatus();
    }
  }

  /**
   * Handle wake-word detection for "Mischief managed":
   * - If sleeping: transitions companion to awake, moves to active window top-right.
   * - If awake: transitions companion to sleeping, moves to unobtrusive bottom-right.
   * - Enforces cooldown to prevent double triggers.
   */
  public handleWakeWordDetection(detection: WakeWordDetection): void {
    const now = Date.now();
    if (now - this.lastDetectionTime < this.cooldownMs) {
      console.log(`[WakeWordService] Detection ignored due to cooldown (${now - this.lastDetectionTime}ms < ${this.cooldownMs}ms)`);
      return;
    }

    this.lastDetectionTime = now;
    console.log(`[WakeWordService] Wake-word "${detection.wakeWord}" detected in state "${this.companionState}"`);

    // Notify renderer of the detection event
    this.sendToRenderer('voice:wake-word-detected', detection);

    if (this.companionState === 'sleeping') {
      // WAKE UP SEQUENCE
      this.companionState = 'awake';
      this.pythonProcess.sendCommand({ cmd: 'set_state', state: 'awake' });

      // 1. Move to foreground top-right
      if (this.callbacks?.moveToForeground) {
        this.callbacks.moveToForeground();
      }

      // 2. Trigger wake-up in avatar state machine
      if (this.callbacks?.onWakeUp) {
        this.callbacks.onWakeUp();
      }
      this.sendToRenderer('companion:wake-up', { voiceActivated: true });
    } else {
      // GO TO SLEEP SEQUENCE
      this.companionState = 'sleeping';
      this.pythonProcess.sendCommand({ cmd: 'set_state', state: 'sleeping' });

      // 1. Return to unobtrusive sleeping position
      if (this.callbacks?.moveToSleepingPos) {
        this.callbacks.moveToSleepingPos();
      }

      // 2. Trigger sleep in avatar state machine
      if (this.callbacks?.onGoToSleep) {
        this.callbacks.onGoToSleep();
      }
      this.sendToRenderer('companion:go-to-sleep', { voiceActivated: true });
    }
  }

  public init(mainWindow: BrowserWindow, callbacks: WakeWordServiceCallbacks): void {
    this.mainWindow = mainWindow;
    this.callbacks = callbacks;

    // Start Python helper process
    const started = this.pythonProcess.start();
    if (started) {
      // Send initial companion state
      this.pythonProcess.sendCommand({ cmd: 'set_state', state: this.companionState });

      // If user's persisted preference is microphone ON, start listening
      if (this.isMicEnabled) {
        console.log('[WakeWordService] Starting audio capture according to saved user preference.');
        setTimeout(() => {
          this.pythonProcess.sendCommand({ cmd: 'start_listening' });
        }, 300);
      }
    }
  }

  public getStatus(): VoiceActivationStatus {
    return {
      isMicEnabled: this.isMicEnabled,
      isListening: this.isListening,
      modelLoaded: this.modelLoaded,
      modelName: this.modelName,
      modelPath: this.modelPath,
      error: this.lastError,
      activeDevice: this.activeDevice,
    };
  }

  public toggleMic(): boolean {
    return this.setMicEnabled(!this.isMicEnabled);
  }

  public setMicEnabled(enabled: boolean): boolean {
    this.isMicEnabled = Boolean(enabled);
    this.persistPreference();

    if (this.isMicEnabled) {
      if (!this.pythonProcess.isRunning()) {
        this.pythonProcess.start();
      }
      this.pythonProcess.sendCommand({ cmd: 'start_listening' });
    } else {
      this.pythonProcess.sendCommand({ cmd: 'stop_listening' });
      this.isListening = false;
    }

    this.broadcastStatus();
    return this.isMicEnabled;
  }

  public setCompanionState(state: 'sleeping' | 'awake'): void {
    this.companionState = state;
    this.pythonProcess.sendCommand({ cmd: 'set_state', state });
  }

  /**
   * Programmatic simulation for automated tests / verification.
   */
  public simulateWakeWord(phrase: string = 'mischief_managed'): void {
    this.handleWakeWordDetection({
      wakeWord: phrase,
      score: 0.99,
      state: this.companionState,
      simulated: true,
      timestamp: Date.now(),
    });
  }

  public broadcastStatus(): void {
    const status = this.getStatus();
    this.sendToRenderer('voice:status-changed', status);
  }

  private sendToRenderer(channel: string, ...args: unknown[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    }
  }

  public async stop(): Promise<void> {
    if (this.isListening) {
      this.pythonProcess.sendCommand({ cmd: 'stop_listening' });
      this.isListening = false;
    }
    await this.pythonProcess.stop();
  }
}

export const wakeWordService = new WakeWordService();
