import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const sourceFile = path.join(projectRoot, 'electron', 'native', 'WindowTracker.cs');
const targetDirDev = path.join(projectRoot, 'electron', 'bin');
const targetDirDist = path.join(projectRoot, 'dist-electron', 'bin');
const targetExeDev = path.join(targetDirDev, 'window-tracker.exe');
const targetExeDist = path.join(targetDirDist, 'window-tracker.exe');

fs.mkdirSync(targetDirDev, { recursive: true });
fs.mkdirSync(targetDirDist, { recursive: true });

if (process.platform === 'win32') {
  const cscCandidates = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe',
    'csc.exe',
  ];

  let cscPath = cscCandidates.find((c) => {
    try {
      return fs.existsSync(c);
    } catch {
      return false;
    }
  });

  if (!cscPath) {
    cscPath = 'csc.exe';
  }

  console.log(`[build-native] Compiling WindowTracker using ${cscPath}...`);
  try {
    execSync(`"${cscPath}" /nologo /optimize /target:exe /out:"${targetExeDev}" "${sourceFile}"`, {
      stdio: 'inherit',
    });
    fs.copyFileSync(targetExeDev, targetExeDist);
    console.log('[build-native] WindowTracker compiled successfully to electron/bin and dist-electron/bin.');
  } catch (err) {
    console.warn('[build-native] Failed to compile WindowTracker:', err.message);
  }
} else {
  console.log('[build-native] Non-Windows platform detected; skipping native WindowTracker compilation.');
}
