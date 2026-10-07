# Wochenbegleiter im vorhandenen App-Stil

Stand: 03.10.2026. Umsetzung der Rückmeldung, die neuen Schwangerschaftsseiten stärker an die übrige App anzugleichen.

Nachfolgende Auslieferung: [EAS Update für den vorhandenen Release-Kandidaten](pregnancy-ota-20261003.md). Die unten dokumentierte Stilumsetzung wurde anschließend auf Nutzerwunsch auf dessen separatem Kanal veröffentlicht.

Wochenübersicht, Storys, SSW-Auswahl, Bibliothek und Artikel nutzen jetzt die vorhandene `GlassCard` und die Werte aus `constants/DesignGuide.tsx`, wie etwa „Meine Fragen“. Transparentere Flächen, feinere Konturen, Radius 22 und das bestehende Marken-Lila ersetzen die zuvor sehr deckenden Creme-Karten und eigenen Lila-Abstufungen. Überschriften sind kleiner und ruhiger. In Storys und Artikeln bilden Bild und Text eine gemeinsame Karte; die Bildsprache bleibt erhalten.

`GuideSurface` bündelt diese Gestaltung für die Schwangerschaftsseiten. Die optionale `fill`-Eigenschaft der gemeinsamen `GlassCard` lässt gleich hohe Kacheln samt Inhalt ausfüllen, damit „Mehr erfahren“ in einer Reihe auf gleicher Höhe steht. Der Standardwert ist `false`; bisherige Aufrufer behalten ihr Verhalten.

Der normale `Header.tsx`, die Story-Aufteilung, Bildgesten, Fortschritt, SSW 1–42, Artikel-Rückkehr, Suche, Merkliste, Fragen und Werkzeug-Verknüpfungen bleiben erhalten. Die sichtbaren Entwurfshinweise bleiben in Deutsch, Englisch und Spanisch entfernt. Interne Review-Metadaten und Quellen wurden nicht verändert.

## Prüfung und Nachweise

- Typprüfung einschließlich Tests und ESLint der geänderten Dateien erfolgreich.
- Drei vorhandene Jest-Suites: 25 Tests erfolgreich.
- 21 Browser-Prüfungen mit den tatsächlichen React-Native-Web-Komponenten: Story-Gesten, gemeinsamer Header, Artikel-Rückkehr, Wochenwechsel einschließlich Grenzen, gleich hohe Kachel-Links, Suche und Wiederherstellung nach leerem Ergebnis, Quellen sowie DE/EN/ES. Helle/dunkle Ansicht und 320/414/736 Pixel geprüft; bei Schriftfaktor 2 kein Text- oder Dokumentüberlauf.
- Der abschließende Expo-Export des aktuellen Quellstands erzeugt Hermes-Bündel für iOS und Android. Dies ist eine lokale Bündelprüfung, kein signierter installierbarer Build.
- Ausgangskopien, SHA-256-Vergleich und Änderungsdiff bestätigen zehn unveränderte Quellen/Konfigurationen, darunter Schwangerschafts-Home, `Header.tsx`, Designwerte, Inhaltsmodule, `eas.json` und `app.json`. „Dein Tag im Überblick“ und die vorhandenen Funktionen bleiben erhalten.

Nachweise: `output/pregnancy-app-style-20261003/{typecheck.log,lint.log,tests.log,ui-verification.json,native-export-final.log,native-export-verification.json,preservation.json,changes.diff}`.

Die Browser-Hülle ersetzt Konto-, Router- und Plattformkontexte. Merkliste, persönliche Fragen und externe Links wurden dort nicht als reale Speicherung beziehungsweise externe Navigation geprüft. Die Browserprüfung ersetzt keine Gesten-, VoiceOver- oder TalkBack-Abnahme auf physischen Geräten.

## Aktuelle Vorschau

Die bestehende Komponentenvorschau auf Port 8843 wurde mit dem aktuellen Quellstand neu gebündelt: `http://127.0.0.1:8843/?route=pregnancy-week&week=7&theme=light`. Start: `python3 -m http.server 8843 --bind 127.0.0.1 --directory output/pregnancy-stories-20261003`.

![Wochenübersicht im App-Stil](../output/pregnancy-app-style-20261003/overview-light-414.jpg)

![Körper-Story im App-Stil](../output/pregnancy-app-style-20261003/story-light-414.jpg)

Zum Abschluss dieser Stilumsetzung wurde kein OTA-Update veröffentlicht, kein Store-Build ersetzt und kein Backend verändert. Die anschließende OTA-Auslieferung ist oben verlinkt. Das öffentliche Update wurde durch beide Schritte nicht verändert.
