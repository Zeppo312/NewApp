// Entfernt Bedien-/Werkzeug-Wartezeiten aus der echten Schlaf-Aufnahme.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const dir = path.join(__dirname, 'captures/de-DE/video');
const source = path.join(dir, 'v4-schlaf-raw.mp4');
const output = path.join(dir, 'v4-schlaf.mp4');
const cuts = [{ start: 6.4, duration: 1.8 }, { start: 13.5, duration: 1.2 }, { start: 30, duration: 5.4 }];
const filter = `[0:v]fps=30,split=${cuts.length}${cuts.map((_, i) => `[s${i}]`).join('')};` +
  cuts.map((c, i) => `[s${i}]trim=start=${c.start}:duration=${c.duration},setpts=PTS-STARTPTS[p${i}];`).join('') +
  cuts.map((_, i) => `[p${i}]`).join('') + `concat=n=${cuts.length}:v=1:a=0[v]`;
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y', '-i', source,
  '-filter_complex', filter,
  '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output,
], { stdio: 'inherit' });
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
fs.writeFileSync(path.join(__dirname, 'video-schnitt.json'), JSON.stringify({
  generated: new Date().toISOString(), source: path.relative(__dirname, source),
  sourceSha256: hash(source), output: path.relative(__dirname, output),
  outputSha256: hash(output), cuts,
  note: 'Echte Aufnahme: Start und Speichern des beendeten Schlafs. Wartezeiten entfernt; keine App-Ansichten ersetzt und keine Bewegung beschleunigt.',
}, null, 2) + '\n');
console.log(output);
