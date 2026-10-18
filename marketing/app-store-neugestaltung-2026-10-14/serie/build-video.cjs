// App-Vorschauvideo aus echten Simulator-Aufnahmen mit Texteinblendungen der Serie.
// Aufruf: node build-video.cjs <locale>
// Erwartet captures/<locale>/video/<clip>.mp4 (xcrun simctl io <udid> recordVideo).
// Schreibt export/<locale>/APP_PREVIEW_IPHONE/lotti-baby-vorschau.mp4 und ein Posterbild.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const crypto = require('node:crypto');

const root = __dirname;
const locale = process.argv[2] || 'de-DE';
const series = JSON.parse(fs.readFileSync(path.join(root, 'series.json'), 'utf8'));
const video = series.video;
const { w: W, h: H, fps } = video.format;
const work = path.join(root, 'export', locale, '.video-work');
const outDir = path.join(root, 'export', locale, 'APP_PREVIEW_IPHONE');
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

(async () => {
  const missing = video.scenes.filter((s) => !fs.existsSync(path.join(root, 'captures', locale, 'video', s.clip)));
  if (missing.length) {
    console.error('Fehlende Aufnahmen:', missing.map((s) => s.clip).join(', '));
    process.exit(2);
  }
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(root, 'template.html')).href);
  const layout = series.layouts[video.format.device];
  const sceneFiles = [];
  const provenance = [];
  for (const scene of video.scenes) {
    const text = scene.text[locale];
    const spec = { w: W, h: H, device: 'iphone', layout, title: text.title, support: text.support, brand: 'Lotti Baby', lang: locale, image: null, layer: 'caption' };
    await page.evaluate((s) => window.renderSpec(s), spec);
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => window.measure());
    if (m.lines.some((line) => line.left < 40 || line.right > W - 40) || m.copyBottom > 330) {
      throw new Error('Texteinblendung läuft über das Raster: ' + scene.id);
    }
    const overlay = path.join(work, scene.id + '-caption.png');
    await page.screenshot({ path: overlay, omitBackground: true });
    const clip = path.join(root, 'captures', locale, 'video', scene.clip);
    const out = path.join(work, scene.id + '.mp4');
    const sourceProbe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', clip]).toString());
    const sourceDuration = Number(sourceProbe.format.duration);
    if (scene.start + scene.duration > sourceDuration + 0.05) {
      throw new Error('Aufnahme ist zu kurz: ' + scene.clip);
    }
    provenance.push({ scene: scene.id, clip: path.relative(root, clip), sha256: crypto.createHash('sha256').update(fs.readFileSync(clip)).digest('hex'), start: scene.start, duration: scene.duration, sourceDuration, sourceStreams: sourceProbe.streams });
    ff([
      '-ss', String(scene.start), '-t', String(scene.duration), '-i', clip,
      '-loop', '1', '-framerate', String(fps), '-i', overlay,
      '-filter_complex',
      `[0:v]fps=${fps},scale=${W}:${H}:flags=lanczos,setsar=1,format=rgba[scr];` +
      `[scr][1:v]overlay=0:0:shortest=1,format=yuv420p[v]`,
      '-map', '[v]', '-t', String(scene.duration), '-r', String(fps),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out,
    ]);
    sceneFiles.push({ file: out, duration: scene.duration });
  }
  await browser.close();

  // Szenen mit kurzer Überblendung verbinden.
  const xf = video.crossfade;
  const inputs = sceneFiles.flatMap((s) => ['-i', s.file]);
  let filter = '';
  let last = '[0:v]';
  let offset = 0;
  for (let i = 1; i < sceneFiles.length; i++) {
    offset += sceneFiles[i - 1].duration - xf;
    const label = i === sceneFiles.length - 1 ? '[vout]' : `[x${i}]`;
    filter += `${last}[${i}:v]xfade=transition=fade:duration=${xf}:offset=${offset.toFixed(3)}${label};`;
    last = label;
  }
  const total = sceneFiles.reduce((a, s) => a + s.duration, 0) - xf * (sceneFiles.length - 1);
  const out = path.join(outDir, 'lotti-baby-vorschau.mp4');
  ff([
    ...inputs,
    '-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-filter_complex', filter.replace(/;$/, ''),
    '-map', '[vout]', '-map', `${sceneFiles.length}:a`,
    '-c:v', 'libx264', '-profile:v', 'high', '-level:v', '4.0', '-pix_fmt', 'yuv420p',
    '-b:v', '10M', '-minrate', '10M', '-maxrate', '10M', '-bufsize', '20M',
    '-x264-params', 'nal-hrd=cbr:filler=1', '-r', String(fps),
    // AudioToolbox hält auch die bewusst stumme Tonspur bei 256 kbit/s.
    '-c:a', 'aac_at', '-aac_at_mode', 'cbr', '-b:a', '256k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', '-t', total.toFixed(3), out,
  ]);
  // Posterbild: Ende der ersten Szene (Mahlzeitenübersicht sichtbar).
  const poster = path.join(outDir, 'lotti-baby-vorschau-poster.png');
  ff(['-ss', '2.5', '-i', out, '-frames:v', '1', poster]);
  const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,level,width,height,r_frame_rate,channels,sample_rate,bit_rate:format=duration,size', '-of', 'json', out]).toString();
  const technical = JSON.parse(probe);
  const stream = technical.streams.find((s) => s.codec_name === 'h264');
  const audio = technical.streams.find((s) => s.codec_name === 'aac');
  if (!stream || stream.width !== W || stream.height !== H || stream.r_frame_rate !== `${fps}/1` || stream.profile !== 'High' || stream.level !== 40 || Number(stream.bit_rate) < 9_500_000 || Number(stream.bit_rate) > 12_000_000 || !audio || audio.channels !== 2 || audio.sample_rate !== '48000' || Number(audio.bit_rate) < 250_000 || Math.abs(Number(technical.format.duration) - total) > 0.1) throw new Error('Video entspricht nicht dem Exportformat');
  fs.writeFileSync(path.join(outDir, 'pruefung.json'), JSON.stringify({ generated: new Date().toISOString(), passed: true, technical, scenes: provenance, presentation: 'Echte App-Aufnahmen im Vollbild mit Texteinblendungen; keine nachgebauten App-Ansichten.', appleSources: ['https://developer.apple.com/app-store/app-previews/', 'https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications'] }, null, 2) + '\n');
  fs.rmSync(work, { recursive: true, force: true });
  console.log(out, '\n', probe);
})();
