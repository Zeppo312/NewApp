# App-Store-Neugestaltung – Stand 14.10.2026

Lokales Asset-Paket vollständig. Nicht hochgeladen, veröffentlicht, committed oder gepusht.

## Ergebnisse

| Sprache | iPhone-Aufnahmen | iPad-Aufnahmen | PNG-Exporte |
| --- | ---: | ---: | ---: |
| Deutsch | 7/7 | 7/7 | 21/21 |
| Englisch | 7/7 | 7/7 | 21/21 |
| Spanisch | 7/7 | 7/7 | 21/21 |
| Gesamt | 21/21 | 21/21 | 63/63 |

Alle 42 Rohbilder stammen aus echten Simulator-Ansichten. Beide installierten Apps wurden als Version 1.0.24, Build 1.0.51 überprüft. Geräte, Maße und Dateihashes stehen in `serie/aufnahme-manifest.json`.

- Screenshot-Formate: iPhone 6,9 Zoll 1320 × 2868, iPhone 6,5 Zoll 1284 × 2778, iPad 13 Zoll 2064 × 2752; sRGB-PNG ohne Alphakanal.
- Deutsche App-Vorschau: `serie/export/de-DE/APP_PREVIEW_IPHONE/lotti-baby-vorschau.mp4`, 24 Sekunden, 886 × 1920, 30 fps, H.264 High 4.0 mit rund 10 Mbit/s und stummer AAC-Stereospur mit 256 kbit/s bei 48 kHz. Poster bei 2,5 Sekunden.
- Video zeigt Mahlzeitenübersicht, einen tatsächlich gespeicherten Windeleintrag, Tagesübersicht, Start/laufenden Timer/Beenden des Schlafs und eine Schlussansicht mit Anmeldung-/Abo-Hinweis. Bedien-Wartezeiten wurden herausgeschnitten; Originalaufnahme und Schnittintervalle sind erhalten.
- `vorher-nachher.html` zeigt die bisherige lokale Serie und die neue deutsche Serie. Umschaltung geprüft; `vergleich-pruefung.png` zeigt die neue Ansicht.
- `store.config.json` verweist lokal auf alle 63 neuen Screenshots und die deutsche Vorschau. Zuordnung, Existenz und Reihenfolge sind in `serie/store-zuordnung-pruefung.json` geprüft. Die konfigurierte App-Version wurde hier nicht geändert.
- Editierbare Quellen: `serie/series.json`, `serie/template.html` und Renderer. Store-Texte: `store-texte.json`. Icon-Prüfung und Vorschlag ohne Schriftzug bleiben unter `icon-pruefung/`; das produktive Icon wurde nicht geändert.

## Prüfungen

- `serie/export/pruefung.json`: 63 Dateien, keine fehlenden Aufnahmen, keine technischen Layout-Probleme. Maße, sRGB, Transparenz, Textüberläufe und Herkunftshashes geprüft.
- Store-Texte: PASS in DE/EN/ES; Keywords DE 98, EN 89, ES 85 UTF-8-Bytes.
- Video: technische Prüfung in `APP_PREVIEW_IPHONE/pruefung.json`; vollständige Dekodierung in `serie/video-dekodier-pruefung.json`; Sichtprüfung über `serie/video-pruefung.png` und Einzelbilder des Starts und beendeten Timers.
- Gesamtübersichten und kleine Store-Vorschauen für jede Sprache visuell geprüft. Gewichts-Ausschnitte erneuert; englisches iPad-Wetter frisch abgerufen; spanische Schwangerschafts-/Planer-Motive ergänzt; spanischer iPad-Schlaf auf Timer und Verlauf ausgerichtet.
- Vergleich-Umschaltung: PASS in `vergleich-pruefung.json`. Syntax und `git diff --check`: geprüft.

## Bekannte Eigenheiten der echten App-Ansichten

Die Aufnahmen enthalten die tatsächliche Oberfläche des installierten Builds. Texte wurden nicht in die App-Bilder hineingemalt:

- In der spanischen Tages-Kennzahl bleibt der kleine Zusatz „Stillen 1x“ deutsch; der zuvor englische Fläschchen-Hinweis ist nach Neustart spanisch.
- Die Demo-Personenzuordnung „Ich“ erscheint auch in den englischen/spanischen Planer-Aufnahmen.
- Im iPhone-Layout umbrechen einzelne App-Bezeichnungen, etwa „VERÄNDERUNG“, „MEASUREMENTS“ und „Breastfeeding“. Die großen Store-Überschriften haben keinen Textüberlauf.
- Wetter, Uhrzeiten, Timerstände und Carousel-Ansichten unterscheiden sich entsprechend der realen Aufnahmezeit. Keine nachgebauten oder KI-erfundenen App-Ansichten.

Diese Befunde sind im Aufnahme-Manifest dokumentiert. Das lokale Paket ist vollständig; endgültige Store-Freigabe und Abgleich mit der tatsächlich einzureichenden Version bleiben eigene Schritte. Upload und Verarbeitung in App Store Connect wurden nicht ausgeführt.

## Demo-Konto und Simulatoren nach Abschluss

- Beide Simulatoren auf ausdrückliche Bestätigung des Nutzers wieder gestartet; beide bleiben gestartet.
- Demo-Timer seit 13:04 und sämtliche später für Aufnahmen gestarteten Timer beendet. Die Oberfläche zeigt wieder „Schlaf starten“; keine aktive Live Activity in den abschließenden Einstellungen.
- App-Sprache auf beiden Geräten Deutsch. Automatischer Dunkelmodus wieder aktiv, ursprünglicher Zeitraum 20:00–07:00 unverändert.
- Software-Autokorrektur als aktiv geprüft; Hardware-Autokorrektur wieder aktiviert und geprüft.
- Planer-Titel wieder „U4 beim Kinderarzt“, „Babyschwimmen“, „Windeln Gr. 3 nachkaufen“, „Elterngeld-Antrag abschicken“. Der für das Video gespeicherte Demo-Windeleintrag um 23:00 bleibt erhalten.
- Startseite mit dem echten Kontonamen in keinem neuen Export oder Video verwendet. Keine App-/Backend-Korrektur und keine Änderung an den parallelen Android-/Onboarding-Arbeiten.
- Vorhandene Änderung in `ios/Podfile.lock` bleibt erhalten; sie stammt aus dem ursprünglichen Simulator-Build.

Apple-Referenzen, geprüft am 14.10.2026: [Screenshot-Formate](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [App-Preview-Formate](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications/), [Inhalt und Hinweise im Video](https://developer.apple.com/app-store/app-previews/).
