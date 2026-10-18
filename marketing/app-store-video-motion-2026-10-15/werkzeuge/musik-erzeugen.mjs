// Erzeugt die Hintergrundmusik und die Tipp-Geräusche des Films vollständig synthetisch.
// Keine Samples, keine fremden Aufnahmen: Rechte liegen beim Projekt.
// Aufruf: node werkzeuge/musik-erzeugen.mjs  → projekt/assets/audio/lotti-score.wav (48 kHz, Stereo, 24 bit)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SR = 48000;
const DUR = 27.5;
const N = Math.round(SR * DUR);
const L = new Float64Array(N);
const R = new Float64Array(N);

// Zeitpunkte aus projekt/index.html (Filmsekunden).
const TAPS = [5.8, 14.15, 18.72];
const BAR = 23.3 / 8; // ≈ 82,4 bpm, Takt 8 fällt auf den Abschluss (23,3 s)
const BEAT = BAR / 4;

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// F-Dur, warm und ruhig: Fmaj9 – Dm9 – Bbmaj7 – Csus4/C
const CHORDS = [
  [53, 57, 60, 64, 67], // F A C E G
  [50, 53, 57, 60, 64], // D F A C E
  [46, 50, 53, 57, 60], // Bb D F A C
  [48, 53, 55, 57, 60], // C F G A C (sus)
];
const ROOTS = [41, 38, 34, 36];

// Deterministischer Zufall für Anschlagsstärke.
let seed = 20261015;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function add(buf, i, v) { if (i >= 0 && i < N) buf[i] += v; }
// Weiches Ausblenden der letzten 40 % eines Klangs, damit kein Knacken entsteht.
function tail(k, len) { const x = (len - k) / (len * 0.4); return x >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, x)); }

// Flächenklang: weiche Sinus-Obertöne, leicht verstimmt links/rechts.
function pad(notes, t0, t1, gain) {
  const att = 1.4, rel = 1.8;
  const s0 = Math.floor(t0 * SR), s1 = Math.min(N, Math.floor((t1 + rel) * SR));
  for (const m of notes) {
    const f = hz(m + 12);
    for (let i = s0; i < s1; i++) {
      const t = i / SR - t0;
      let env = Math.min(1, t / att);
      if (i / SR > t1) env *= Math.max(0, 1 - (i / SR - t1) / rel);
      env = env * env * (3 - 2 * env);
      const trem = 1 + 0.06 * Math.sin(2 * Math.PI * 0.23 * (i / SR) + m);
      const ph = 2 * Math.PI * f * (i / SR);
      const v = (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph)) * env * trem * gain;
      const d = 2 * Math.PI * f * 0.0016 * (i / SR);
      add(L, i, v * Math.cos(d) * 0.9);
      add(R, i, v * Math.cos(d + 0.6) * 0.9);
    }
  }
}

// Weicher Holz-/Glockenanschlag (Mallet).
function mallet(m, t0, gain, pan = 0) {
  const f = hz(m);
  const s0 = Math.floor(t0 * SR), len = Math.floor(2.2 * SR);
  const parts = [[1, 1, 0.55], [2.0, 0.22, 0.28], [3.01, 0.07, 0.16], [4.2, 0.05, 0.06]];
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const a = Math.min(1, t / 0.006);
    let v = 0;
    for (const [mul, amp, tau] of parts) v += amp * Math.exp(-t / tau) * Math.sin(2 * Math.PI * f * mul * t);
    v *= a * gain * tail(k, len);
    add(L, s0 + k, v * (1 - pan) * 0.8);
    add(R, s0 + k, v * (1 + pan) * 0.8);
  }
}

function bass(m, t0, gain) {
  const f = hz(m);
  const s0 = Math.floor(t0 * SR), len = Math.floor(3.2 * SR);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const v = Math.min(1, t / 0.03) * Math.exp(-t / 1.3) * (Math.sin(2 * Math.PI * f * t) + 0.15 * Math.sin(4 * Math.PI * f * t)) * gain * tail(k, len);
    add(L, s0 + k, v); add(R, s0 + k, v);
  }
}

// Leises „Tock" für die gezeigten Berührungen.
function tick(t0, gain) {
  const s0 = Math.floor(t0 * SR), len = Math.floor(0.12 * SR);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const f = 1500 - 700 * Math.min(1, t / 0.02);
    const v = Math.min(1, t / 0.002) * Math.exp(-t / 0.018) * Math.sin(2 * Math.PI * f * t) * gain * tail(k, len);
    add(L, s0 + k, v); add(R, s0 + k, v);
  }
}

// ---- Arrangement ----
const bars = Math.ceil(DUR / BAR);
for (let b = 0; b < bars; b++) {
  const t = b * BAR;
  const final = b >= 8;
  const c = final ? 0 : b % 4;
  const notes = CHORDS[c];
  pad(notes, t, final ? 26.0 : t + BAR, final ? 0.020 : 0.017);
  bass(ROOTS[c], t, final ? 0.11 : 0.09);
  if (final) {
    // Ruhiger Schlussklang zum Markenabschluss.
    [72, 76, 79, 84].forEach((m, i) => mallet(m, t + 0.05 + i * 0.22, 0.05 - i * 0.006, i % 2 ? 0.25 : -0.25));
    break;
  }
  // Arpeggio: anfangs spärlich, ab Szene 2 dichter.
  const pattern = b < 1 ? [0, 2] : b < 3 ? [0, 1.5, 2, 3] : [0, 0.5, 1.5, 2, 2.5, 3.5];
  pattern.forEach((p, i) => {
    const m = notes[(i + b) % notes.length] + 24;
    mallet(m, t + p * BEAT, 0.026 + 0.012 * rnd(), (i % 2 ? 0.3 : -0.3));
  });
}
for (const t of TAPS) tick(t, 0.06);
// Bestätigung „Wickeln gespeichert" (6,54 s) und beendeter Schlaf (22,16 s): zwei helle Töne.
mallet(84, 6.56, 0.035, -0.2); mallet(88, 6.70, 0.03, 0.2);
mallet(84, 22.18, 0.03, -0.2); mallet(91, 22.32, 0.025, 0.2);

// ---- Hall (Schroeder) ----
function reverb(x, offs) {
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d: d + offs, b: new Float64Array(d + offs), i: 0, fb: 0.80, lp: 0 }));
  const aps = [225, 556].map((d) => ({ d, b: new Float64Array(d), i: 0 }));
  const y = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    let s = 0;
    for (const c of combs) {
      const o = c.b[c.i];
      c.lp = o * 0.7 + c.lp * 0.3;
      c.b[c.i] = x[n] + c.lp * c.fb;
      c.i = (c.i + 1) % c.d;
      s += o;
    }
    s *= 0.25;
    for (const a of aps) {
      const o = a.b[a.i];
      const v = -s + o;
      a.b[a.i] = s + o * 0.5;
      a.i = (a.i + 1) % a.d;
      s = v;
    }
    y[n] = s;
  }
  return y;
}
const wl = reverb(L, 0), wr = reverb(R, 23);
for (let n = 0; n < N; n++) { L[n] = L[n] * 0.78 + wl[n] * 0.32; R[n] = R[n] * 0.78 + wr[n] * 0.32; }

// Ein-/Ausblenden und Normalisieren auf −3 dBFS Spitze.
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const g = Math.min(1, t / 0.25) * (t > 25.9 ? Math.max(0, 1 - (t - 25.9) / 1.55) : 1);
  L[n] *= g; R[n] *= g;
}
let peak = 0;
for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
const norm = Math.pow(10, -3 / 20) / peak;

const out = Buffer.alloc(44 + N * 2 * 3);
out.write("RIFF", 0); out.writeUInt32LE(36 + N * 6, 4); out.write("WAVE", 8);
out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 6, 28); out.writeUInt16LE(6, 32); out.writeUInt16LE(24, 34);
out.write("data", 36); out.writeUInt32LE(N * 6, 40);
let o = 44;
for (let n = 0; n < N; n++) {
  for (const v of [L[n], R[n]]) {
    const s = Math.max(-8388608, Math.min(8388607, Math.round(v * norm * 8388607)));
    out.writeIntLE(s, o, 3); o += 3;
  }
}
const dest = join(root, "projekt/assets/audio/lotti-score.wav");
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, out);
console.log("geschrieben:", dest, (out.length / 1e6).toFixed(1), "MB");
