import { app, BrowserWindow, ipcMain, screen, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

/**
 * Window Configuration Settings
 * Target compact desktop companion dimensions: ~180 × 210 px
 */
interface WindowConfig {
  width: number;
  height: number;
  alwaysOnTop: boolean;
  transparent: boolean;
  frame: boolean;
  resizable: boolean;
}

export const windowConfig: WindowConfig = {
  width: 180,
  height: 210,
  alwaysOnTop: false, // Configurable property, not forced on by default
  transparent: true,
  frame: false,
  resizable: false,
};

export interface ForegroundWindowBounds {
  hwnd?: number;
  pid?: number;
  title?: string;
  className?: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

let mainWindow: BrowserWindow | null = null;
let trackerProcess: ChildProcess | null = null;

/**
 * Reposition companion relative to the active foreground application.
 * Positioned ~20-25px from application's top and right edges, kept within workArea.
 */
export function repositionRelativeToWindow(bounds: ForegroundWindowBounds): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const offset = 22; // 20–25 px offset from top and right edges
  const compWidth = windowConfig.width;
  const compHeight = windowConfig.height;

  // Target coordinates near the top-right corner of the foreground application
  const targetX = bounds.left + bounds.width - compWidth - offset;
  const targetY = bounds.top + offset;

  // Retrieve work area for the display closest to the target coordinates
  const display = screen.getDisplayNearestPoint({ x: targetX, y: targetY }) || screen.getPrimaryDisplay();
  const workArea = display.workArea;

  // Clamp within the visible work area to avoid clipping or taskbar overlap
  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - compWidth;
  const minY = workArea.y;
  const maxY = workArea.y + workArea.height - compHeight;

  const clampedX = Math.round(Math.max(minX, Math.min(maxX, targetX)));
  const clampedY = Math.round(Math.max(minY, Math.min(maxY, targetY)));

  // Move without stealing keyboard focus
  mainWindow.setBounds({
    x: clampedX,
    y: clampedY,
    width: compWidth,
    height: compHeight,
  });
}

/**
 * Fallback initial placement at the top-right of the primary screen work area.
 */
export function setInitialTopRightPosition(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const compWidth = windowConfig.width;
  const compHeight = windowConfig.height;

  const targetX = workArea.x + workArea.width - compWidth - 24;
  const targetY = workArea.y + 24;

  mainWindow.setBounds({
    x: Math.round(targetX),
    y: Math.round(targetY),
    width: compWidth,
    height: compHeight,
  });
}

function getWindowTrackerExePath(): string {
  const possiblePaths = [
    path.join(__dirname, 'bin', 'window-tracker.exe'),
    path.join(__dirname, '../electron/bin', 'window-tracker.exe'),
    path.join(__dirname, '../bin', 'window-tracker.exe'),
    path.join(process.cwd(), 'electron', 'bin', 'window-tracker.exe'),
    path.join(process.cwd(), 'dist-electron', 'bin', 'window-tracker.exe'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return '';
}

function startWindowTracker(): void {
  if (process.platform !== 'win32') return;
  if (trackerProcess) return;

  const trackerExe = getWindowTrackerExePath();
  if (!trackerExe) {
    console.warn('[main] window-tracker.exe not found. Window tracking disabled.');
    return;
  }

  const currentPid = process.pid;
  try {
    trackerProcess = spawn(trackerExe, ['--ignore-pid', currentPid.toString()], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });

    let buffer = '';
    trackerProcess.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const data = JSON.parse(trimmed) as ForegroundWindowBounds;
          if (data && typeof data.left === 'number' && typeof data.width === 'number' && data.width > 0) {
            repositionRelativeToWindow(data);
          }
        } catch {
          // Ignore partial/malformed JSON
        }
      }
    });

    trackerProcess.on('close', () => {
      trackerProcess = null;
    });
  } catch (err) {
    console.error('[main] Failed to start window tracker:', err);
  }
}

function stopWindowTracker(): void {
  if (trackerProcess) {
    try {
      trackerProcess.stdout?.destroy();
      trackerProcess.kill();
    } catch {
      // Ignore
    }
    trackerProcess = null;
  }
}

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: windowConfig.width,
    height: windowConfig.height,
    frame: windowConfig.frame,
    transparent: windowConfig.transparent,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: windowConfig.alwaysOnTop,
    autoHideMenuBar: true,
    show: false, // Prevent flash
    resizable: windowConfig.resizable,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Gracefully reveal window without stealing keyboard focus
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      setInitialTopRightPosition();
      mainWindow.showInactive();
      startWindowTracker();
    }
  });

  // Load dev server URL or production build
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl).catch((err) => {
      console.error('Failed to load dev server URL:', err);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html')).catch((err) => {
      console.error('Failed to load production build file:', err);
    });
  }

  // Verification and lifecycle event listeners
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[main] Electron window content loaded successfully.');

    if (process.env.STAGE2_VERIFY === 'true') {
      console.log('[main] STAGE2_VERIFY active: running automated verification...');
      mainWindow?.webContents
        .executeJavaScript(
          `(${async () => {
            const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
            const results: Array<{ test: string; pass: boolean; actual: unknown }> = [];

            // 1. Initial DOM and Dialogue Bubble
            const bubble = document.querySelector('.dialogue-text');
            if (!bubble) throw new Error('Dialogue bubble text element not found');
            const initialText = bubble.textContent?.trim();
            results.push({
              test: 'Initial dialogue text',
              pass: initialText === "Hey! I'm here.",
              actual: initialText,
            });

            // 2. Avatar element & Size check (approximately 105 × 105 px)
            const avatarImg = document.querySelector('.pixel-avatar') as HTMLImageElement | null;
            if (!avatarImg) throw new Error('Pixel avatar image not found');
            const rect = avatarImg.getBoundingClientRect();
            const widthOk = rect.width >= 95 && rect.width <= 115;
            const heightOk = rect.height >= 95 && rect.height <= 115;
            results.push({
              test: 'Avatar displayed dimensions (~105x105 px)',
              pass: widthOk && heightOk,
              actual: `${Math.round(rect.width)}x${Math.round(rect.height)} px`,
            });

            const computedImgStyle = window.getComputedStyle(avatarImg);
            const imageRendering = computedImgStyle.imageRendering;
            results.push({
              test: 'Pixelated rendering style',
              pass:
                imageRendering.includes('pixelated') ||
                imageRendering.includes('crisp-edges'),
              actual: imageRendering,
            });

            // 3. Confirm dev controls are hidden by default in normal UI
            const devControlsVisibleInitially = Boolean(document.querySelector('.expression-controls'));
            results.push({
              test: 'Dev expression controls hidden by default',
              pass: !devControlsVisibleInitially,
              actual: devControlsVisibleInitially ? 'visible' : 'hidden',
            });

            // Reveal dev controls via dev mechanism
            const winAny = window as any;
            if (typeof winAny.__TOGGLE_DEV_CONTROLS__ === 'function') {
              winAny.__TOGGLE_DEV_CONTROLS__();
              await sleep(60);
            }

            const devControlsVisibleAfterToggle = Boolean(document.querySelector('.expression-controls'));
            results.push({
              test: 'Dev expression controls revealed via dev toggle',
              pass: devControlsVisibleAfterToggle,
              actual: devControlsVisibleAfterToggle ? 'revealed' : 'still hidden',
            });

            // 4. Test expression buttons & dialogue updates
            const exprButtons = Array.from(document.querySelectorAll('.expr-btn')) as HTMLButtonElement[];
            const targetExpressions = [
              { label: 'Sleeping', text: 'Zzz...', fileMatch: 'sleeping' },
              { label: 'Listening', text: "I'm listening!", fileMatch: 'listening' },
              { label: 'Speaking', text: "Okay! I'm on it.", fileMatch: 'speaking' },
              { label: 'Happy', text: 'Yay!', fileMatch: 'happy' },
            ];

            for (const target of targetExpressions) {
              const btn = exprButtons.find((b) => b.textContent?.trim() === target.label);
              if (!btn) throw new Error(`Button for ${target.label} not found`);
              btn.click();
              await sleep(80);
              const updatedText = bubble.textContent?.trim();
              const updatedSrc = avatarImg.src;
              results.push({
                test: `Expression switch: ${target.label} dialogue`,
                pass: updatedText === target.text,
                actual: updatedText,
              });
              results.push({
                test: `Expression switch: ${target.label} sprite loaded`,
                pass: updatedSrc.toLowerCase().includes(target.fileMatch),
                actual: updatedSrc,
              });
            }

            // 5. Test Microphone Toggle
            const micBtn = document.querySelector('.mic-toggle-btn') as HTMLButtonElement | null;
            if (!micBtn) throw new Error('Microphone toggle button not found');
            const initialPressed = micBtn.getAttribute('aria-pressed') === 'true';
            micBtn.click();
            await sleep(80);
            const toggledPressed = micBtn.getAttribute('aria-pressed') === 'true';
            const tooltipText = document.querySelector('.mic-tooltip')?.textContent?.trim();
            results.push({
              test: 'Microphone toggle enabled',
              pass: !initialPressed && toggledPressed,
              actual: `initial=${initialPressed}, toggled=${toggledPressed}`,
            });
            results.push({
              test: 'Microphone tooltip text',
              pass: tooltipText === 'Voice activation: ON',
              actual: tooltipText,
            });

            // Toggle back to off
            micBtn.click();
            await sleep(80);
            const revertedPressed = micBtn.getAttribute('aria-pressed') === 'true';
            results.push({
              test: 'Microphone toggle reverted to disabled',
              pass: !revertedPressed,
              actual: revertedPressed,
            });

            // 6. Verify background transparency
            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            results.push({
              test: 'Body background transparent',
              pass: bodyBg === 'rgba(0, 0, 0, 0)' || bodyBg === 'transparent',
              actual: bodyBg,
            });

            return results;
          }})()`
        )
        .then((results: Array<{ test: string; pass: boolean; actual: unknown }>) => {
          console.log('\n--- VERIFICATION TEST RESULTS ---');
          let allPassed = true;
          for (const res of results) {
            console.log(`[${res.pass ? 'PASS' : 'FAIL'}] ${res.test} (Actual: ${res.actual})`);
            if (!res.pass) allPassed = false;
          }

          // Test window repositioning logic
          const simulatedBounds: ForegroundWindowBounds = {
            left: 200,
            top: 150,
            width: 1000,
            height: 700,
          };
          repositionRelativeToWindow(simulatedBounds);
          const currentBounds = mainWindow?.getBounds();
          const expectedTargetX = 200 + 1000 - windowConfig.width - 22; // 998
          const expectedTargetY = 150 + 22; // 172
          const posOk =
            Math.abs((currentBounds?.x ?? 0) - expectedTargetX) <= 2 &&
            Math.abs((currentBounds?.y ?? 0) - expectedTargetY) <= 2;

          console.log(`[${posOk ? 'PASS' : 'FAIL'}] Foreground window top-right repositioning (Actual: x=${currentBounds?.x}, y=${currentBounds?.y}, Expected: x=${expectedTargetX}, y=${expectedTargetY})`);
          if (!posOk) allPassed = false;

          const sizeOk =
            Math.abs((currentBounds?.width ?? 0) - windowConfig.width) <= 2 &&
            Math.abs((currentBounds?.height ?? 0) - windowConfig.height) <= 2;
          console.log(`[${sizeOk ? 'PASS' : 'FAIL'}] Window dimensions ~180x210 (Actual: ${currentBounds?.width}x${currentBounds?.height})`);
          if (!sizeOk) allPassed = false;

          console.log('---------------------------------');
          setTimeout(() => {
            stopWindowTracker();
            const exitCode = allPassed ? 0 : 1;
            if (allPassed) {
              console.log('[main] All verification tests PASSED.');
            } else {
              console.error('[main] Some verification tests FAILED.');
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.destroy();
            }
            app.exit(exitCode);
          }, 400);
        })
        .catch((err: Error) => {
          console.error('[main] Verification suite encountered an error:', err);
          app.exit(1);
        });
    } else if (process.env.APP_TEST_MODE === 'true') {
      console.log('[main] APP_TEST_MODE active: verifying renderer DOM...');
      mainWindow?.webContents
        .executeJavaScript(
          `Boolean(document.getElementById('root') && document.querySelector('.companion-card'))`
        )
        .then((rendered: boolean) => {
          console.log('[main] React companion-card rendered successfully:', rendered);
          setTimeout(() => {
            console.log('[main] Automated verification complete. Exiting cleanly.');
            app.quit();
          }, 1500);
        })
        .catch((err: Error) => {
          console.error('[main] Failed to verify renderer DOM:', err);
          app.exit(1);
        });
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`[main] Failed to load content: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      console.warn(`[renderer warning] ${message} (${sourceId}:${line})`);
    }
  });

  mainWindow.on('closed', () => {
    stopWindowTracker();
    mainWindow = null;
  });

  return mainWindow;
}

// IPC Handlers for native window actions
ipcMain.on('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

ipcMain.handle('window:get-always-on-top', () => {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isAlwaysOnTop() : false;
});

ipcMain.handle('window:set-always-on-top', (_event, flag: boolean) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(Boolean(flag));
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

ipcMain.on('window:show-context-menu', (_event, currentExpr: string, isAlwaysOnTop: boolean) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const menu = Menu.buildFromTemplate([
    {
      label: 'Pin Always on Top',
      type: 'checkbox',
      checked: isAlwaysOnTop,
      click: () => {
        const next = !mainWindow?.isAlwaysOnTop();
        mainWindow?.setAlwaysOnTop(next);
        mainWindow?.webContents.send('window:always-on-top-changed', next);
      },
    },
    { type: 'separator' },
    {
      label: 'Expressions',
      submenu: [
        {
          label: 'Happy',
          type: 'radio',
          checked: currentExpr === 'happy',
          click: () => mainWindow?.webContents.send('companion:set-expression', 'happy'),
        },
        {
          label: 'Listening',
          type: 'radio',
          checked: currentExpr === 'listening',
          click: () => mainWindow?.webContents.send('companion:set-expression', 'listening'),
        },
        {
          label: 'Speaking',
          type: 'radio',
          checked: currentExpr === 'speaking',
          click: () => mainWindow?.webContents.send('companion:set-expression', 'speaking'),
        },
        {
          label: 'Sleeping',
          type: 'radio',
          checked: currentExpr === 'sleeping',
          click: () => mainWindow?.webContents.send('companion:set-expression', 'sleeping'),
        },
      ],
    },
    {
      label: 'Toggle Dev Controls (Ctrl+Shift+D)',
      click: () => mainWindow?.webContents.send('companion:toggle-dev-tools'),
    },
    { type: 'separator' },
    {
      label: 'Minimize',
      click: () => mainWindow?.minimize(),
    },
    {
      label: 'Close Companion',
      click: () => mainWindow?.close(),
    },
  ]);

  menu.popup({ window: mainWindow });
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

// App lifecycle management
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  console.error('Error during app initialization:', err);
});

app.on('will-quit', () => {
  stopWindowTracker();
});

app.on('window-all-closed', () => {
  stopWindowTracker();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
