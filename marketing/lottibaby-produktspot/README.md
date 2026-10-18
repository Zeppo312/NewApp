# LottiBaby · Gemeinsam im Blick

20-sekündiger Produktspot in HyperFrames, 1080 × 1920, 30 fps. Ohne Personen und ohne Sprecherstimme. Vier Szenen: Alltagshook, Schlafübersicht, Unser Tag, Partnerverknüpfung. Enthält eine eigens erzeugte instrumentale Musik mit Rhythmus.

## Dateien

- `LottiBaby-Live-Motion.mp4`: aktueller Videoexport mit mehr Bewegung und echter App-Bedienung.
- `LottiBaby-Live-Produktspot.mp4`: vorherige ruhigere Version.
- `index.html`: bearbeitbare HyperFrames-Komposition.
- `DESIGN.md`: Farben, Typografie und Bewegungsregeln.
- `assets/`: geschnittene Bildschirmvideos und Musik.
- `recordings/schnitt.py`: reproduzierbarer Schnitt und Musikgenerierung.
- `recordings/iphone-bedienung.mov`: ursprüngliche Bildschirmaufnahme.

## Vorschau

Bei laufendem Studio: http://localhost:3017/#project/lottibaby-produktspot

## Bildmaterial – überarbeitete Fassung

Die aktuelle Fassung verwendet eine echte Bildschirmaufnahme des iPhone-17-Simulators (1206 × 2622). Sie zeigt den Wechsel zum Schlaftracker sowie das Öffnen der Schlaf- und Wickeleintragsmasken. Es wurden keine Einträge gespeichert. Der Schnitt verdichtet die Bedienung auf 20 Sekunden, mit Übergängen und eigener Musik.

Die vollständige iPhone-Ansicht bleibt unverzerrt mit `object-fit: contain` sichtbar. Keine Ausschnitte und keine perspektivische Drehung. Der aktuelle Export heißt `LottiBaby-Live-Motion.mp4`. Er ergänzt schnelle Push-Übergänge, gestaffelte Wortanimationen, federnde Produkteintritte und Musikakzente. Frühere Screenshot-Versionen bleiben erhalten.

Das CTA lautet „LottiBaby entdecken“. Vor einer Veröffentlichung den bestätigten Store-/Website-Link als Anzeigenziel oder Link-Sticker ergänzen. Es wurde nichts veröffentlicht und kein Abo abgeschlossen.

## Prüfungen

HyperFrames Lint: keine Fehler oder Warnungen. Validate: keine Konsolenfehler, 41 Texte bestehen den Kontrasttest. Inspect: keine Layoutprobleme an den vier Szenen-Hauptbildern. Die vollständigen Bildschirmbilder werden ohne Zuschneiden angezeigt.

Das zusätzliche Animation-Map-Skript des Plugins ließ sich wegen seines fehlenden Pakets `@hyperframes/producer` nicht starten. Die Timeline wird deshalb zusätzlich anhand des gerenderten Videos kontrolliert.

## Entwicklung

Node.js 22 oder neuer und FFmpeg. Das Projekt wurde mit HyperFrames 0.6.20 erzeugt. Der Download der neueren CLI brach bei einer Abhängigkeit ab; deshalb wurde die bereits vorhandene Version verwendet.

`npm run dev` startet Studio, `npm run check` prüft das Projekt, `npm run render` exportiert MP4.
