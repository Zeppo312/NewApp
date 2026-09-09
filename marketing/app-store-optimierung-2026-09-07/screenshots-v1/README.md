# Neue deutsche App-Store-Screenshots

Erstellt am 7. September 2026. Drei lokale Entwürfe mit frisch aufgenommenen Ansichten aus der laufenden Lotti-Baby-App im iPhone-17-Simulator.

## Dateien und Reihenfolge

1. `01-flaeschchen.png` – Wann war das letzte Fläschchen?
2. `02-gemeinsam.png` – Ihr beide habt den Überblick.
3. `03-schlaf.png` – Schlafzeiten einfach festhalten.

`vorschau.png` zeigt alle drei Motive nebeneinander. Die drei SVG-Dateien enthalten editierbare Texte, Layouts und eingebettete Originalaufnahmen. `render.cjs` erzeugt die PNGs reproduzierbar mit dem Node-Paket sharp. `export-pruefung.json` dokumentiert Auflösung, Farbraum und fehlenden Alphakanal.

## Format

1242 × 2688 Pixel, PNG, sRGB, ohne Transparenz. Dieses Format wird von Apple für den 6,5-Zoll-Screenshot-Satz akzeptiert. Es entspricht dem bisherigen deutschen iPhone-Satz im Projekt. [Apple: Screenshot-Spezifikationen](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)

Die Rohaufnahmen haben 1206 × 2622 Pixel. Sie wurden im Layout proportional verkleinert, in einfache Geräterahmen gesetzt und beim zweiten Motiv gedreht. Texte, Daten und Bedienelemente innerhalb der Aufnahmen wurden nicht nachgezeichnet oder verändert. Das zweite Motiv zeigt zwei Ansichten desselben Testkontos als Illustration gemeinsamer Nutzung; es ist keine Aufnahme eines separat geprüften Synchronisationsvorgangs auf zwei Geräten.

## Demo-Daten und Aufnahmen

Der Nutzer hat am 7. September bestätigt, dass im aktuell angemeldeten Simulator-Testkonto Demo-Einträge angelegt werden dürfen. Neu angelegt wurden ein Fläschchen mit 120 ml um 16:47 und ein Schlaftimer ab 16:49. Weitere sichtbare Einträge waren bereits vorhanden.

Offene Aufräumarbeit: Der Demo-Schlaftimer konnte nach der Aufnahme nicht beendet werden, weil der Mac gesperrt war. Nach dem Entsperren im Testkonto „Schlaf beenden“ wählen. Die Entsperrung wurde beim Nutzer angefragt.

- `raw/day.png`: Tagesübersicht nach dem Mahlzeiten-Eintrag.
- `raw/meals.png`: Mahlzeitenübersicht mit letzter Uhrzeit und Menge.
- `raw/sleep.png`: laufender Demo-Schlaftimer.

Die Aufnahmen zeigen die neue Navigation mit Einkaufsliste anstelle der Community. Die genaue Gleichheit des laufenden Simulator-Builds mit dem eingereichten Release wurde nicht durch einen Build-Vergleich geprüft. Vor dem Upload die sichtbaren Ansichten und Tarifverfügbarkeit am Release abgleichen.

## Verwendung

Der Ordner enthält die drei ersten Motive, keinen vollständigen neuen Zehnersatz. Vor einem Test prüfen, ob die übrigen Bilder und das vorhandene Preview-Video ebenfalls aktuell sind. Der vorhandene Test hatte zwei nicht schlüssige Varianten; für den nächsten Versuch eine Alternative verwenden.

Die Veröffentlichung und Änderung der Screenshot-Zuordnung in `store.config.json` wurden nicht vorgenommen. Titel und Keywords wurden in diesem Arbeitsschritt nicht geändert. Die bisherigen Konfigurationsänderungen im Workspace stammen aus früheren Arbeitsschritten.

## Neu rendern

```sh
NODE_PATH=/Users/janzeppenfeld/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
/Users/janzeppenfeld/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
marketing/app-store-optimierung-2026-09-07/screenshots-v1/render.cjs
```

Geprüft: alle drei Exporte öffnen erfolgreich; einheitliche Abmessungen; kein Alphakanal; vollständige Überschriften; visuelle Prüfung in gemeinsamer Vorschau. Es wurde kein Conversion-Test gestartet.
