# LottiBaby – animierter Partnerclip

## Stand

Der erste 2D-Schnitt ist erstellt: etwa 24 Sekunden im Hochformat, mit zwei animierten Vektorfiguren, synthetischer deutscher Stimme und eingeblendeten Untertiteln. Kopfbewegung, Blinzeln, Armbewegung und einfache, lautstärkegesteuerte Mundbewegungen werden pro Bild berechnet. Die Mundbewegungen sind keine phonetisch exakte Lippensynchronisation.

Die Bediensequenzen zeigen eine **schematische animierte Funktionsdemo**, keine echte App-Aufnahme. Dieser Hinweis ist im Video sichtbar. Der Mac war bei der Aufnahmevorbereitung gesperrt; auch die automatische Entsperrung schlug fehl. Deshalb fehlen weiterhin die ursprünglich gewünschten Live-Aufnahmen von „Schlaf starten“ und dem Speichern eines Eintrags in „Unser Tag“. Zum Fertigstellen der App-Demonstration müssen diese Szenen nach manuellem Entsperren im Testkonto aufgenommen und ersetzt werden.

## Dateien

- `exports/LottiBaby-Partner-2D-Entwurf.mp4`: H.264, 1080 × 1920, 25 Bilder/s, AAC-Ton. Als Entwurf markiert.
- `exports/Vorschaubild.png`: Titelbild.
- `exports/untertitel.srt`: Separate Untertitel, zusätzlich im MP4 eingebrannt.
- `audio/sprecherin.wav`: Deutsche synthetische Stimme „Anna“ aus macOS, keine Stimmimitation einer realen Person.
- `quelle/animate.mjs`: Editierbare Vektorszenen und Animation; Sharp und FFmpeg.
- `quelle/voice.mjs`: Reproduzierbare Sprachspur über macOS `say`.
- `quelle/timeline.json`: Zeitplan aus den tatsächlichen Sprachsegmenten.

Es wurden keine Einträge in einem echten Nutzerkonto angelegt und keine Inhalte veröffentlicht. Alle dargestellten Funktionszustände sind illustrative Testbeispiele. Der App-Code wurde nicht verändert.

## Neu rendern

Im Ordner `quelle` zunächst `npm install`, dann auf macOS `node voice.mjs` und `node animate.mjs`. FFmpeg und die Stimme Anna müssen vorhanden sein. Der Schnitt verwendet für die native SVG-Typografie Arial und Georgia.
