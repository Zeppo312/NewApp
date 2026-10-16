# Lotti Baby – App-Vorschau „Motion" (de-DE), 15.10.2026

Neu gestaltete App-Store-Vorschau auf Basis der echten Simulator-Aufnahmen vom 14.10.2026 (Version 1.0.24, Build 1.0.51).

## App Store Connect – Stand 15.10.2026

- Die Fassung mit Musik ist vollständig in die Asset Library von App `6745569710` hochgeladen. Apple hat das Format 886 × 1920 zugeordnet und das Poster bei `00:00:02:27` erfolgreich erzeugt.
- Das Video wurde separat für iOS zur Prüfung eingereicht: **WAITING_FOR_REVIEW**. Einreichung: `76337f96-7aad-4439-ad0e-48e71259f387`.
- Store-Version **1.0.25** ist als Entwurf angelegt (**PREPARE_FOR_SUBMISSION**, manuelle Veröffentlichung). Die deutsche iPhone-Vorschau verwendet ausschließlich das neue Video; die bisherige Vorschau wurde nur aus diesem Entwurf entfernt, ihr Asset bleibt erhalten.
- Version 1.0.23 ist weiterhin live. Der Entwurf 1.0.25 hat noch keinen Build zugeordnet und ist nicht eingereicht oder veröffentlicht. Die Übereinstimmung des Videos mit dem künftigen Release-Build bleibt zu prüfen.
- `store.config.json` verweist jetzt auf Version 1.0.25, die neue deutsche Videodatei und deren Posterzeit. Die weiteren lokalen Screenshot- und Textänderungen wurden nicht hochgeladen.
- API-Nachweis, Dateihashes und IDs: [`export/app-store-upload.json`](export/app-store-upload.json). Keine Commits oder Pushes in diesem Schritt.

## Ergebnis

| Datei | Inhalt |
| --- | --- |
| `export/lotti-baby-vorschau-motion-de.mp4` | Fertiger Film, 27,5 s, 886 × 1920, 30 fps, H.264 High 4.0, 10,4 Mbit/s, AAC Stereo 256 kbit/s / 48 kHz |
| `export/lotti-baby-vorschau-motion-de-poster.png` | Posterbild aus dem Film (2,9 s) |
| `export/kontaktbogen.png` | 14 repräsentative Bilder mit Zeitmarke |
| `STORYBOARD.md` | Szenen, Zeiten, Schnitte, Animationen |
| `PRUEFBERICHT.md` | Prüfung Technik, Inhalt, Apple-Regeln, Einschränkungen |
| `export/arbeit/` | HyperFrames-Master (`render-master.mp4`) und `technik.json` |

## Projektaufbau

```
projekt/                    HyperFrames-Projekt (HTML + GSAP, deterministisch gerendert)
  index.html                gesamte Komposition: Zeitleiste, Schnitte, Typografie, Hinweise
  assets/clips/             30-fps-Arbeitskopien der echten Aufnahmen (640 × 1392) + quellen.sha256
  assets/fonts/             Inter (SIL Open Font License, OFL-Inter.txt)
  assets/vendor/gsap.min.js GSAP 3.14.2, lokal eingebunden (kein Netzabruf beim Rendern)
  assets/brand/app-icon.png Kopie von assets/images/icon.png (Original unverändert)
  assets/audio/lotti-score.wav  eigene, synthetisch erzeugte Musik
werkzeuge/
  clips-vorbereiten.sh      Rohaufnahmen → 30-fps-Arbeitskopien (keine Zwischenbilder, nur Bildwiederholung)
  musik-erzeugen.mjs        Musik + Tipp-Geräusche synthetisch erzeugen (ohne Abhängigkeiten)
  rendern.sh                Prüfung → Master-Render → Store-Export (ein Befehl)
  store-export.sh           Apple-konforme Kodierung + Poster
  kontaktbogen.py           Kontaktbogen (Pillow)
```

## Rendern

Aus diesem Ordner, Node ≥ 22 und ffmpeg mit `aac_at` (macOS) vorausgesetzt:

```sh
./werkzeuge/clips-vorbereiten.sh      # nur nötig, wenn Aufnahmen neu sind
node werkzeuge/musik-erzeugen.mjs     # nur nötig, wenn Musik geändert wird
./werkzeuge/rendern.sh                # hyperframes check + render + store-export
python3 werkzeuge/kontaktbogen.py     # optional
```

`rendern.sh` nutzt die fest angepinnte CLI `hyperframes@0.8.159` mit abgeschalteter Telemetrie. Posterzeit über `POSTER_T=…` änderbar.

## Bearbeiten

- Interaktiv: `cd projekt && npx hyperframes@0.8.159 preview` öffnet das Studio (Zeitleiste, Text direkt editierbar).
- Schnittpunkte: `data-start` (Filmzeit), `data-duration`, `data-media-start` (Zeit in der Aufnahme) an den `<video>`-Elementen in `projekt/index.html`; jede Zeile ist kommentiert.
- Texte: Abschnitte `Szene 1` bis `Abschluss` in `projekt/index.html`.
- Bewegungen: Zeitleiste im `<script>` am Ende von `index.html` (Funktionen `textIn`, `ring`, `tap`, `dip`, `stepOn`).
- Bei geänderten Zeiten für Tipp-Geräusche `TAPS` in `werkzeuge/musik-erzeugen.mjs` anpassen.
