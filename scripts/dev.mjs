import { createServer } from 'vite';
import { spawn, execSync } from 'child_process';
import electronPath from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function compileElectron() {
  console.log('[dev] Compiling Electron main and preload scripts...');
  try {
    execSync('npx tsc -p tsconfig.electron.json', {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('[dev] Electron compilation completed.');
    return true;
  } catch (error) {
    console.error('[dev] Electron compilation failed:', error);
    return false;
  }
}

async function start() {
  // 1. Initial compilation of Electron
  const compiled = compileElectron();
  if (!compiled) {
    process.exit(1);
  }

  // 2. Start Vite development server
  console.log('[dev] Starting Vite dev server...');
  const server = await createServer({
    configFile: path.resolve(projectRoot, 'vite.config.ts'),
    root: projectRoot,
    server: {
      port: 5173,
      strictPort: false,
    },
  });

  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === 'object' && address ? address.port : 5173;
  const devServerUrl = `http://localhost:${port}`;
  console.log(`[dev] Vite dev server ready at: ${devServerUrl}`);

  // 3. Launch Electron process
  let electronProcess = null;
  let isRestarting = false;

  function launchElectron() {
    console.log('[dev] Launching Electron window...');
    electronProcess = spawn(electronPath, ['.'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: devServerUrl,
      },
    });

    electronProcess.on('close', (code) => {
      if (!isRestarting) {
        console.log(`[dev] Electron closed (code: ${code}). Shutting down dev server.`);
        server.close();
        process.exit(code ?? 0);
      }
    });
  }

  launchElectron();

  // 4. Watch electron/ directory for changes and restart Electron
  const electronDir = path.resolve(projectRoot, 'electron');
  let debounceTimer = null;

  fs.watch(electronDir, { recursive: true }, (_eventType, filename) => {
    if (!filename || (!filename.endsWith('.ts') && !filename.endsWith('.js'))) {
      return;
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(`[dev] Detected change in electron/${filename}. Recompiling...`);
      isRestarting = true;
      if (compileElectron()) {
        if (electronProcess) {
          electronProcess.kill();
        }
        launchElectron();
      }
      isRestarting = false;
    }, 400);
  });

  // Handle process termination signals
  const cleanup = () => {
    if (electronProcess) {
      electronProcess.kill();
    }
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

start().catch((err) => {
  console.error('[dev] Failed to start development environment:', err);
  process.exit(1);
});
