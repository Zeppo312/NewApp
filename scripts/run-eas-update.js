const path = require('path');
const { spawn } = require('child_process');
const { cleanDist, distPath } = require('./prep-eas-update');

function runEasUpdate() {
  const easBinary = process.platform === 'win32' ? 'eas.cmd' : 'eas';
  const args = ['update', ...process.argv.slice(2)];
  const child = spawn(easBinary, args, {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (error) => {
    console.error('Failed to launch EAS CLI:', error);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

(async () => {
  try {
    await cleanDist();
    console.log(`Removed stale export directory: ${path.relative(process.cwd(), distPath)}`);
    runEasUpdate();
  } catch (error) {
    console.error('Failed to clean dist directory before EAS update:', error);
    process.exit(1);
  }
})();
