# Reproduzierbare Store-Serie

`series.json` definiert Texte, Reihenfolge, Gerätelayouts und Video-Szenen. `template.html` ist die gemeinsame Gestaltungsquelle. Aufnahmen bleiben unverändert unter `captures/<locale>/<device>/<motiv>.png`; HTML setzt den Rahmen und die Texte darüber.

## Export

Aus dem Projektverzeichnis:

```sh
export NODE_PATH=/Users/janzeppenfeld/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules
node marketing/app-store-neugestaltung-2026-10-14/serie/render.cjs
node marketing/app-store-neugestaltung-2026-10-14/serie/build-overview.cjs
node marketing/app-store-neugestaltung-2026-10-14/pruefe-store-texte.cjs
```

Optional eine Sprache als Argument an `render.cjs` und `build-overview.cjs` übergeben. Exit-Code 1 bedeutet ein technisches Layout-Problem, Exit-Code 2 fehlende Aufnahmen. `export/pruefung.json` enthält die Datei- und Aufnahmeprüfung. Zusätzlich immer die Übersichten und die kleinen Vorschauen ansehen.

Formate: iPhone 6,9 Zoll 1320 × 2868; iPhone 6,5 Zoll 1284 × 2778; iPad 13 Zoll 2064 × 2752. PNG, sRGB, ohne Alphakanal.

## Aufnahmen erneuern

Echte App-Ansichten verwenden. Bei Sprachwechsel App neu starten; im Wetter die Suche neu ausführen, damit keine bereits berechneten Texte aus der vorherigen Sprache übrig bleiben. Demo-Inhalte im Planer passend übersetzen. Auf iPad die App im Vollbild aufnehmen. Keine Startseite mit dem echten Kontonamen verwenden.

Der aktuelle Stand und bekannte Eigenheiten der echten App-Ansichten stehen in `../STATUS.md` und `aufnahme-manifest.json`. Alle 42 Rohaufnahmen und 63 Exporte sind vorhanden.

## Video

```sh
node marketing/app-store-neugestaltung-2026-10-14/serie/prepare-video.cjs
node marketing/app-store-neugestaltung-2026-10-14/serie/build-video.cjs de-DE
node marketing/app-store-neugestaltung-2026-10-14/serie/inspect-video.cjs
```

Das benötigt fünf echte Bildschirmaufnahmen unter `captures/de-DE/video/`, entsprechend `video.scenes` in `series.json`. `start` und `duration` wählen den Ausschnitt; der Renderer bricht bei fehlenden oder zu kurzen Clips ab. Kein Ersatzvideo aus stillen Screenshots verwenden.

Fertiger Export: 24 Sekunden, 886 × 1920, 30 fps, H.264 High 4.0 mit rund 10 Mbit/s, stummes Stereo-AAC mit 256 kbit/s bei 48 kHz. Benötigt ffmpeg mit macOS-AudioToolbox-Encoder `aac_at`. Text-Overlays verwenden die Typografie und Farben der Screenshots; die echte App läuft im Vollbild. Der Schluss enthält den Hinweis auf Anmeldung und vom Abo abhängige Funktionen. `APP_PREVIEW_IPHONE/pruefung.json` enthält technische Werte und Hashes der verwendeten Aufnahmen; `video-dekodier-pruefung.json` bestätigt die vollständige Dekodierung, `video-pruefung.png` dient der Sichtprüfung. Die Schnittintervalle der erhaltenen Schlaf-Originalaufnahme stehen in `video-schnitt.json`. `video-layout-pruefung.json` prüft zusätzlich die Einblendungen für DE/EN/ES; Videoaufnahmen und fertiger Film liegen für Deutsch vor.

## Vergleich und Store-Konfiguration

```sh
node marketing/app-store-neugestaltung-2026-10-14/build-preview.cjs /Users/janzeppenfeld/Developer/LottiBaby/marketing/app-store-neugestaltung-2026-10-14/vorher-nachher.html
```

Den Vergleich im Codex-Dateipanel öffnen. Die Screenshot-/Preview-Pfade in `store.config.json` sind auf die vollständige, geprüfte Serie umgestellt; `store-zuordnung-pruefung.json` dokumentiert die Zuordnung. Keine Veröffentlichung erfolgt durch diese Exportbefehle.
