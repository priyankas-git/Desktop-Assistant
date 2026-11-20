import { app, BrowserWindow, ipcMain, screen, Menu, globalShortcut } from 'electron';
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
let companionState: 'sleeping' | 'awake' = 'sleeping';
let lastForegroundBounds: ForegroundWindowBounds | null = null;

/**
 * Unobtrusive position for sleeping companion.
 * Positioned in the bottom-right corner of the primary display work area with 20px padding.
 */
export function setSleepingPosition(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;
  const compWidth = windowConfig.width;
  const compHeight = windowConfig.height;

  const padding = 20;
  const targetX = workArea.x + workArea.width - compWidth - padding;
  const targetY = workArea.y + workArea.height - compHeight - padding;

  const minX = workArea.x;
  const maxX = workArea.x + workArea.width - compWidth;
  const minY = workArea.y;
  const maxY = workArea.y + workArea.height - compHeight;

  const clampedX = Math.round(Math.max(minX, Math.min(maxX, targetX)));
  const clampedY = Math.round(Math.max(minY, Math.min(maxY, targetY)));

  mainWindow.setBounds({
    x: clampedX,
    y: clampedY,
    width: compWidth,
    height: compHeight,
  });
}

/**
 * Reposition companion relative to the active foreground application.
 * Positioned ~20-25px from application's top and right edges, kept within workArea.
 */
export function repositionRelativeToWindow(bounds: ForegroundWindowBounds): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  lastForegroundBounds = bounds;

  // When sleeping, do not follow foreground windows across the screen
  if (companionState === 'sleeping') return;

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

/**
 * Move companion to top-right of active foreground application or fallback to top-right of screen.
 */
export function moveToActiveForegroundOrTopRight(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (lastForegroundBounds) {
    repositionRelativeToWindow(lastForegroundBounds);
  } else {
    setInitialTopRightPosition();
  }
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

  // Gracefully reveal window in unobtrusive sleeping position without stealing keyboard focus
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      setSleepingPosition();
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

    const isVerify =
      process.env.STAGE2_VERIFY?.trim() === 'true' ||
      process.env.STAGE3_VERIFY?.trim() === 'true';
    const isTestMode = process.env.APP_TEST_MODE?.trim() === 'true';

    if (isVerify) {
      console.log('[main] Automated verification active: executing test suite...');
      mainWindow?.webContents
        .executeJavaScript(
          `(${async () => {
            const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
            const results: Array<{ test: string; pass: boolean; actual: unknown }> = [];

            // 1. Initial State: Sleeping, dialogue "Zzz...", sleeping sprite
            const bubble = document.querySelector('.dialogue-text');
            if (!bubble) throw new Error('Dialogue bubble text element not found');
            const initialText = bubble.textContent?.trim();
            results.push({
              test: 'Initial dialogue text is "Zzz..."',
              pass: initialText === 'Zzz...',
              actual: initialText,
            });

            const avatarImg = document.querySelector('.pixel-avatar') as HTMLImageElement | null;
            if (!avatarImg) throw new Error('Pixel avatar image not found');
            const initialSrc = avatarImg.src;
            results.push({
              test: 'Initial sprite is sleeping.png',
              pass: initialSrc.toLowerCase().includes('sleeping'),
              actual: initialSrc,
            });

            const winAny = window as any;
            const initialLifecycle = typeof winAny.__GET_LIFECYCLE_STATE__ === 'function'
              ? winAny.__GET_LIFECYCLE_STATE__()
              : 'unknown';
            results.push({
              test: 'Initial lifecycle state is sleeping',
              pass: initialLifecycle === 'sleeping',
              actual: initialLifecycle,
            });

            // 2. Avatar dimensions & crisp pixelated style
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

            // 3. Dev expression controls hidden by default
            const devControlsVisibleInitially = Boolean(document.querySelector('.expression-controls'));
            results.push({
              test: 'Dev expression controls hidden by default',
              pass: !devControlsVisibleInitially,
              actual: devControlsVisibleInitially ? 'visible' : 'hidden',
            });

            // 4. Manual wake-up by clicking sleeping owl
            const avatarDisplay = document.querySelector('.avatar-display') as HTMLElement | null;
            if (!avatarDisplay) throw new Error('Avatar display container not found');
            avatarDisplay.click();
            await sleep(100);

            const awakeLifecycle = typeof winAny.__GET_LIFECYCLE_STATE__ === 'function'
              ? winAny.__GET_LIFECYCLE_STATE__()
              : 'unknown';
            results.push({
              test: 'Clicking sleeping owl transitions to awake state',
              pass: awakeLifecycle === 'awake',
              actual: awakeLifecycle,
            });

            const wokenDialogue = bubble.textContent?.trim();
            results.push({
              test: 'Awake dialogue is "I\'m here! What do you need?"',
              pass: wokenDialogue === "I'm here! What do you need?",
              actual: wokenDialogue,
            });

            const wokenSrc = avatarImg.src;
            results.push({
              test: 'Awake sprite uses listening expression',
              pass: wokenSrc.toLowerCase().includes('listening'),
              actual: wokenSrc,
            });

            // 5. Clicking owl while awake does NOT cycle randomly through expressions
            avatarDisplay.click();
            await sleep(80);
            const afterClickDialogue = bubble.textContent?.trim();
            const afterClickSrc = avatarImg.src;
            results.push({
              test: 'Clicking while awake does not cycle expression randomly',
              pass: afterClickDialogue === "I'm here! What do you need?" && afterClickSrc.toLowerCase().includes('listening'),
              actual: `dialogue="${afterClickDialogue}", src="${afterClickSrc}"`,
            });

            // 6. Automatic return to sleep on inactivity timeout
            if (typeof winAny.__SET_IDLE_TIMEOUT_MS__ === 'function') {
              winAny.__SET_IDLE_TIMEOUT_MS__(400); // 400ms for test
            }
            await sleep(650);

            const autoSleepLifecycle = typeof winAny.__GET_LIFECYCLE_STATE__ === 'function'
              ? winAny.__GET_LIFECYCLE_STATE__()
              : 'unknown';
            const autoSleepDialogue = bubble.textContent?.trim();
            const autoSleepSrc = avatarImg.src;
            results.push({
              test: 'Inactivity timeout automatically returns to sleep',
              pass: autoSleepLifecycle === 'sleeping' && autoSleepDialogue === 'Zzz...' && autoSleepSrc.toLowerCase().includes('sleeping'),
              actual: `state=${autoSleepLifecycle}, dialogue="${autoSleepDialogue}"`,
            });

            // Reset timeout back to 30000ms
            if (typeof winAny.__SET_IDLE_TIMEOUT_MS__ === 'function') {
              winAny.__SET_IDLE_TIMEOUT_MS__(30000);
            }

            // 7. Clicking sleeping owl wakes it again
            avatarDisplay.click();
            await sleep(100);
            const rewakeLifecycle = typeof winAny.__GET_LIFECYCLE_STATE__ === 'function'
              ? winAny.__GET_LIFECYCLE_STATE__()
              : 'unknown';
            results.push({
              test: 'Clicking sleeping owl wakes it again',
              pass: rewakeLifecycle === 'awake' && bubble.textContent?.trim() === "I'm here! What do you need?",
              actual: `state=${rewakeLifecycle}, dialogue="${bubble.textContent?.trim()}"`,
            });

            // 8. Manual sleep via keyboard shortcut (Ctrl+Shift+S)
            const sleepEvent = new KeyboardEvent('keydown', {
              key: 'S',
              code: 'KeyS',
              ctrlKey: true,
              shiftKey: true,
              bubbles: true,
              cancelable: true,
            });
            window.dispatchEvent(sleepEvent);
            await sleep(100);

            const shortcutSleepLifecycle = typeof winAny.__GET_LIFECYCLE_STATE__ === 'function'
              ? winAny.__GET_LIFECYCLE_STATE__()
              : 'unknown';
            results.push({
              test: 'Ctrl+Shift+S triggers manual sleep',
              pass: shortcutSleepLifecycle === 'sleeping' && bubble.textContent?.trim() === 'Zzz...',
              actual: `state=${shortcutSleepLifecycle}, dialogue="${bubble.textContent?.trim()}"`,
            });

            // 9. Wake up again, then manual sleep via context menu handler
            if (typeof winAny.__WAKE_UP__ === 'function') {
              winAny.__WAKE_UP__();
              await sleep(80);
            }
            if (typeof winAny.__GO_TO_SLEEP__ === 'function') {
              winAny.__GO_TO_SLEEP__();
              await sleep(80);
            }
            const manualSleepLifecycle = typeof winAny.__GET_LIFECYCLE_STATE__ === 'function'
              ? winAny.__GET_LIFECYCLE_STATE__()
              : 'unknown';
            results.push({
              test: 'Manual sleep action sets sleeping state',
              pass: manualSleepLifecycle === 'sleeping' && bubble.textContent?.trim() === 'Zzz...',
              actual: `state=${manualSleepLifecycle}`,
            });

            // 10. Microphone toggle & wake-up independence
            const micBtn = document.querySelector('.mic-toggle-btn') as HTMLButtonElement | null;
            if (!micBtn) throw new Error('Microphone toggle button not found');
            const initialMicPressed = micBtn.getAttribute('aria-pressed') === 'true';

            // Wake up while mic is disabled (verify mic disabled does not prevent wake-up)
            avatarDisplay.click();
            await sleep(100);
            results.push({
              test: 'Microphone disabled does not prevent manual activation',
              pass: !initialMicPressed && winAny.__GET_LIFECYCLE_STATE__() === 'awake',
              actual: `micPressed=${initialMicPressed}, state=${winAny.__GET_LIFECYCLE_STATE__()}`,
            });

            // Toggle mic on
            micBtn.click();
            await sleep(80);
            const micOn = micBtn.getAttribute('aria-pressed') === 'true';
            const tooltipOn = document.querySelector('.mic-tooltip')?.textContent?.trim();
            results.push({
              test: 'Microphone toggle enabled with tooltip',
              pass: micOn && tooltipOn === 'Voice activation: ON',
              actual: `micOn=${micOn}, tooltip="${tooltipOn}"`,
            });

            // Toggle mic back off
            micBtn.click();
            await sleep(80);
            const micOff = micBtn.getAttribute('aria-pressed') === 'true';
            results.push({
              test: 'Microphone toggle reverted to disabled',
              pass: !micOff,
              actual: `micOff=${micOff}`,
            });

            // 11. Dev controls: reveal and test all 4 expressions
            if (typeof winAny.__TOGGLE_DEV_CONTROLS__ === 'function') {
              winAny.__TOGGLE_DEV_CONTROLS__();
              await sleep(80);
            }
            const devControlsVisible = Boolean(document.querySelector('.expression-controls'));
            results.push({
              test: 'Dev expression controls revealed via dev toggle',
              pass: devControlsVisible,
              actual: devControlsVisible ? 'revealed' : 'hidden',
            });

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

            // 12. Verify background transparency
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

          // 13. Test Window Positioning in Main Process:
          // A. Test Sleeping position calculation
          companionState = 'sleeping';
          setSleepingPosition();
          const sleepingBounds = mainWindow?.getBounds();
          const primaryDisplay = screen.getPrimaryDisplay();
          const workArea = primaryDisplay.workArea;
          const expectedSleepX = workArea.x + workArea.width - windowConfig.width - 20;
          const expectedSleepY = workArea.y + workArea.height - windowConfig.height - 20;
          const sleepPosOk =
            Math.abs((sleepingBounds?.x ?? 0) - expectedSleepX) <= 2 &&
            Math.abs((sleepingBounds?.y ?? 0) - expectedSleepY) <= 2;
          console.log(`[${sleepPosOk ? 'PASS' : 'FAIL'}] Sleeping unobtrusive window position (Actual: x=${sleepingBounds?.x}, y=${sleepingBounds?.y}, Expected: x=${expectedSleepX}, y=${expectedSleepY})`);
          if (!sleepPosOk) allPassed = false;

          // B. Test Foreground window top-right repositioning when awake
          companionState = 'awake';
          const simulatedBounds: ForegroundWindowBounds = {
            left: 200,
            top: 150,
            width: 1000,
            height: 700,
          };
          repositionRelativeToWindow(simulatedBounds);
          const awakeBounds = mainWindow?.getBounds();
          const expectedTargetX = 200 + 1000 - windowConfig.width - 22; // 998
          const expectedTargetY = 150 + 22; // 172
          const awakePosOk =
            Math.abs((awakeBounds?.x ?? 0) - expectedTargetX) <= 2 &&
            Math.abs((awakeBounds?.y ?? 0) - expectedTargetY) <= 2;
          console.log(`[${awakePosOk ? 'PASS' : 'FAIL'}] Awake active application top-right repositioning (Actual: x=${awakeBounds?.x}, y=${awakeBounds?.y}, Expected: x=${expectedTargetX}, y=${expectedTargetY})`);
          if (!awakePosOk) allPassed = false;

          // C. Test that while sleeping, foreground changes do NOT move window
          companionState = 'sleeping';
          setSleepingPosition();
          const beforeForeChange = mainWindow?.getBounds();
          repositionRelativeToWindow({
            left: 50,
            top: 50,
            width: 800,
            height: 600,
          });
          const afterForeChange = mainWindow?.getBounds();
          const staysInSleepPos =
            beforeForeChange?.x === afterForeChange?.x &&
            beforeForeChange?.y === afterForeChange?.y;
          console.log(`[${staysInSleepPos ? 'PASS' : 'FAIL'}] Sleeping companion ignores foreground window movements`);
          if (!staysInSleepPos) allPassed = false;

          const sizeOk =
            Math.abs((sleepingBounds?.width ?? 0) - windowConfig.width) <= 2 &&
            Math.abs((sleepingBounds?.height ?? 0) - windowConfig.height) <= 2;
          console.log(`[${sizeOk ? 'PASS' : 'FAIL'}] Window dimensions ~180x210 (Actual: ${sleepingBounds?.width}x${sleepingBounds?.height})`);
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
    } else if (isTestMode) {
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

// IPC handlers for lifecycle management
ipcMain.handle('lifecycle:set-state', (_event, state: 'sleeping' | 'awake') => {
  companionState = state;
  if (state === 'sleeping') {
    setSleepingPosition();
  } else {
    moveToActiveForegroundOrTopRight();
  }
  return companionState;
});

ipcMain.handle('lifecycle:get-state', () => {
  return companionState;
});

ipcMain.on('window:show-context-menu', (_event, currentExpr: string, isAlwaysOnTop: boolean, isSleeping?: boolean) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const currentlySleeping = typeof isSleeping === 'boolean' ? isSleeping : companionState === 'sleeping';

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
    currentlySleeping
      ? {
          label: 'Wake up',
          click: () => {
            mainWindow?.webContents.send('companion:wake-up');
          },
        }
      : {
          label: 'Go to sleep',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('companion:go-to-sleep');
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

  // Register Ctrl+Shift+S global shortcut for manual sleep
  try {
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('companion:go-to-sleep');
      }
    });
  } catch (err) {
    console.warn('[main] Failed to register global shortcut CommandOrControl+Shift+S:', err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  console.error('Error during app initialization:', err);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopWindowTracker();
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  stopWindowTracker();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
