const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const distPath = path.resolve(process.cwd(), 'dist');

function runRemovalFallback() {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      const child = spawn('cmd.exe', ['/d', '/s', '/c', `if exist "${distPath}" rd /s /q "${distPath}"`], {
        stdio: 'inherit',
      });

      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`rd exited with code ${code}`))));
      return;
    }

    const child = spawn('rm', ['-rf', distPath], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`rm exited with code ${code}`))));
  });
}

async function cleanDist() {
  try {
    await fs.promises.rm(distPath, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  } catch (error) {
    if (!['EBUSY', 'ENOTEMPTY', 'EPERM'].includes(error.code)) {
      throw error;
    }

    await runRemovalFallback();
  }
}

async function main() {
  try {
    await cleanDist();
    console.log(`Removed stale export directory: ${path.relative(process.cwd(), distPath)}`);
  } catch (error) {
    console.error('Failed to clean dist directory before EAS update:', error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  cleanDist,
  distPath,
};
