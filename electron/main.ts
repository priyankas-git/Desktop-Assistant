import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

/**
 * Window Configuration Settings
 * Always-on-top is available via a configurable property, but defaults to false.
 */
interface WindowConfig {
  width: number;
  height: number;
  alwaysOnTop: boolean;
  transparent: boolean;
  frame: boolean;
  resizable: boolean;
}

const windowConfig: WindowConfig = {
  width: 350,
  height: 400,
  alwaysOnTop: false, // Configurable property, not forced on by default
  transparent: true,
  frame: false,
  resizable: false,
};

let mainWindow: BrowserWindow | null = null;

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
    show: false, // Prevent white flash before rendering
    resizable: windowConfig.resizable,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // Gracefully reveal window when ready to show
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
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
    if (process.env.APP_TEST_MODE === 'true') {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
