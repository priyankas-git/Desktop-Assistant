import { spawn } from 'child_process';
import electronPath from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('[test:stage2] Launching Electron with STAGE2_VERIFY=true...');

const child = spawn(electronPath, ['.'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    STAGE2_VERIFY: 'true',
  },
});

child.on('exit', (code) => {
  console.log(`[test:stage2] Verification process exited with code ${code}`);
  process.exit(code ?? 0);
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
