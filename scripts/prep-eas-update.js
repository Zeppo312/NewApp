const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '..', 'dist');

(async () => {
  try {
    await fs.promises.rm(distPath, { recursive: true, force: true });
    console.log(`Removed stale export directory: ${path.relative(process.cwd(), distPath)}`);
  } catch (error) {
    console.error('Failed to clean dist directory before EAS update:', error);
    process.exitCode = 1;
  }
})();
