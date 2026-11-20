import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

export interface PythonProcessOptions {
  modelDir?: string;
  pythonPath?: string;
}

export type PythonEventHandler = (event: Record<string, unknown>) => void;
export type PythonErrorHandler = (error: Error | string) => void;
export type PythonExitHandler = (code: number | null) => void;

/**
 * Manages the background Python helper process for wake-word detection and local audio processing.
 */
export class PythonProcess {
  private child: ChildProcess | null = null;
  private rl: readline.Interface | null = null;
  private isShuttingDown: boolean = false;
  private eventListeners: PythonEventHandler[] = [];
  private errorListeners: PythonErrorHandler[] = [];
  private exitListeners: PythonExitHandler[] = [];
  private options: PythonProcessOptions;

  constructor(options: PythonProcessOptions = {}) {
    this.options = options;
  }

  /**
   * Resolve path to python executable.
   */
  private getPythonExecutable(): string {
    if (this.options.pythonPath && fs.existsSync(this.options.pythonPath)) {
      return this.options.pythonPath;
    }
    if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
      return process.env.PYTHON_PATH;
    }

    const standardPaths = [
      'C:\\Users\\Priyanka\\AppData\\Local\\Programs\\Python\\Python313\\python.exe',
      'C:\\Users\\Priyanka\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
      'C:\\Users\\Priyanka\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
      'C:\\Program Files\\Python313\\python.exe',
      'C:\\Program Files\\Python312\\python.exe',
      'C:\\Program Files\\Python311\\python.exe',
    ];

    for (const p of standardPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return 'python';
  }

  /**
   * Resolve path to python/wake_word_detector.py.
   */
  private getScriptPath(): string {
    const possiblePaths = [
      path.join(__dirname, '../../python/wake_word_detector.py'),
      path.join(__dirname, '../python/wake_word_detector.py'),
      path.join(process.cwd(), 'python/wake_word_detector.py'),
      path.join(__dirname, 'python/wake_word_detector.py'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return path.resolve(p);
      }
    }

    return path.join(process.cwd(), 'python/wake_word_detector.py');
  }

  /**
   * Resolve path to models/wake_words.
   */
  private getModelDir(): string {
    if (this.options.modelDir && fs.existsSync(this.options.modelDir)) {
      return this.options.modelDir;
    }
    const candidate = path.join(process.cwd(), 'models/wake_words');
    return fs.existsSync(candidate) ? candidate : path.resolve(candidate);
  }

  /**
   * Start the Python helper process.
   */
  public start(): boolean {
    if (this.child && !this.child.killed) {
      return true;
    }

    this.isShuttingDown = false;
    const pythonExe = this.getPythonExecutable();
    const scriptPath = this.getScriptPath();
    const modelDir = this.getModelDir();

    if (!fs.existsSync(scriptPath)) {
      const err = new Error(`Python wake-word detector script not found at ${scriptPath}`);
      this.notifyError(err);
      return false;
    }

    try {
      console.log(`[pythonProcess] Spawning: ${pythonExe} -u ${scriptPath} --model-dir ${modelDir}`);
      this.child = spawn(
        pythonExe,
        ['-u', scriptPath, '--model-dir', modelDir],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1',
          },
        }
      );

      if (!this.child.stdout || !this.child.stdin) {
        throw new Error('Failed to establish stdio pipes with Python helper process.');
      }

      this.rl = readline.createInterface({
        input: this.child.stdout,
        terminal: false,
      });

      this.rl.on('line', (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
          const parsed = JSON.parse(trimmed) as Record<string, unknown>;
          this.notifyEvent(parsed);
        } catch {
          // Ignore malformed lines from stdout
        }
      });

      this.child.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8').trim();
        if (text) {
          console.warn(`[pythonProcess stderr] ${text}`);
        }
      });

      this.child.on('error', (err: Error) => {
        console.error('[pythonProcess error]', err);
        this.notifyError(err);
      });

      this.child.on('exit', (code: number | null, signal: string | null) => {
        console.log(`[pythonProcess exited] code=${code}, signal=${signal}`);
        this.cleanup();
        this.notifyExit(code);
      });

      return true;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      console.error('[pythonProcess] Failed to spawn process:', errorObj);
      this.notifyError(errorObj);
      return false;
    }
  }

  /**
   * Send JSON command to Python helper via stdin.
   */
  public sendCommand(cmd: Record<string, unknown>): boolean {
    if (!this.child || !this.child.stdin || this.child.killed) {
      return false;
    }

    try {
      this.child.stdin.write(JSON.stringify(cmd) + '\n');
      return true;
    } catch (err) {
      console.error('[pythonProcess] Failed to send command to Python:', err);
      return false;
    }
  }

  /**
   * Stop the Python process cleanly.
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.child || this.child.killed) {
        this.cleanup();
        resolve();
        return;
      }

      this.isShuttingDown = true;

      // Attempt graceful quit command first
      this.sendCommand({ cmd: 'quit' });

      const forceKillTimer = setTimeout(() => {
        if (this.child && !this.child.killed) {
          try {
            this.child.kill();
          } catch {
            // Ignore
          }
        }
        this.cleanup();
        resolve();
      }, 800);

      this.child.once('exit', () => {
        clearTimeout(forceKillTimer);
        this.cleanup();
        resolve();
      });
    });
  }

  private cleanup(): void {
    if (this.rl) {
      try {
        this.rl.close();
      } catch {
        // Ignore
      }
      this.rl = null;
    }
    this.child = null;
  }

  public isRunning(): boolean {
    return this.child !== null && !this.child.killed;
  }

  public onEvent(callback: PythonEventHandler): () => void {
    this.eventListeners.push(callback);
    return () => {
      this.eventListeners = this.eventListeners.filter((cb) => cb !== callback);
    };
  }

  public onError(callback: PythonErrorHandler): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter((cb) => cb !== callback);
    };
  }

  public onExit(callback: PythonExitHandler): () => void {
    this.exitListeners.push(callback);
    return () => {
      this.exitListeners = this.exitListeners.filter((cb) => cb !== callback);
    };
  }

  private notifyEvent(event: Record<string, unknown>): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[pythonProcess listener error]', err);
      }
    }
  }

  private notifyError(err: Error | string): void {
    for (const listener of this.errorListeners) {
      try {
        listener(err);
      } catch {
        // Ignore
      }
    }
  }

  private notifyExit(code: number | null): void {
    if (this.isShuttingDown) return;
    for (const listener of this.exitListeners) {
      try {
        listener(code);
      } catch {
        // Ignore
      }
    }
  }
}
