// Android's resource compiler trusts filename extensions. Metro/iOS can accept a
// JPEG named .png, so catch that mismatch before spending time on a native build.
const fs = require('node:fs');
const path = require('node:path');

function validateImageAssets(root = path.resolve(__dirname, '../assets')) {
  const failures = [];
  let checked = 0;
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(filename);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      if (!entry.isFile() || !['.png', '.jpg', '.jpeg'].includes(extension)) continue;
      checked += 1;
      const header = Buffer.alloc(8);
      const fd = fs.openSync(filename, 'r');
      try {
        fs.readSync(fd, header, 0, header.length, 0);
      } finally {
        fs.closeSync(fd);
      }
      const valid = extension === '.png'
        ? header.equals(pngSignature)
        : header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      if (!valid) failures.push(path.relative(root, filename));
    }
  }

  visit(root);
  if (failures.length) {
    throw new Error(`Image content does not match the filename extension: ${failures.join(', ')}. Correct the extension and imports or provide a correctly encoded image.`);
  }
  return checked;
}

if (require.main === module) {
  try {
    console.log(`[Image assets] ${validateImageAssets()} PNG/JPEG headers verified.`);
  } catch (error) {
    console.error(`[Image assets] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { validateImageAssets };
