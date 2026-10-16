// Dekodierprüfung und Kontaktbogen des fertigen Vorschauvideos.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const sharp = require('sharp');
const clip = path.join(__dirname, 'export/de-DE/APP_PREVIEW_IPHONE/lotti-baby-vorschau.mp4');
const times = [0, 2.5, 4, 6, 7.5, 9, 12, 14.5, 16.5, 18, 19.1, 20.5, 22, 23.5];
(async () => {
  execFileSync('ffmpeg', ['-v', 'error', '-xerror', '-i', clip, '-f', 'null', '-']);
  const parts = [];
  times.forEach((t, n) => {
    const frame = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', clip, '-frames:v', '1', '-vf', 'scale=221:480', '-f', 'image2pipe', '-vcodec', 'png', '-']);
    parts.push({ input: frame, left: n % 4 * 221, top: Math.floor(n / 4) * 504 + 24 });
    parts.push({ input: Buffer.from(`<svg width="221" height="24"><rect width="221" height="24" fill="white"/><text x="8" y="17" font-size="14">${t} s</text></svg>`), left: n % 4 * 221, top: Math.floor(n / 4) * 504 });
  });
  await sharp({ create: { width: 884, height: Math.ceil(times.length / 4) * 504, channels: 3, background: 'white' } }).composite(parts).png().toFile(path.join(__dirname, 'video-pruefung.png'));
  fs.writeFileSync(path.join(__dirname, 'video-dekodier-pruefung.json'), JSON.stringify({
    generated: new Date().toISOString(), passed: true,
    videoSha256: crypto.createHash('sha256').update(fs.readFileSync(clip)).digest('hex'),
    frameTimes: times, note: 'Vollständig dekodiert; Kontaktbogen für die zusätzliche Sichtprüfung.',
  }, null, 2) + '\n');
})();
