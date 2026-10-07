# Wochenbegleiter: Header, Storys und SSW-Auswahl

Stand: 03.10.2026. Umsetzung der Rückmeldung zum Screenshot der 7. SSW.

Aktueller Gestaltungsstand nach weiterer Rückmeldung: [Wochenbegleiter im vorhandenen App-Stil](pregnancy-app-style-20261003.md), mit aktuellen Screenshots und abschließender iOS-/Android-Bündelprüfung. Die folgenden Nachweise dokumentieren die ursprüngliche Story-Umsetzung und ihre spätere Textkorrektur.

Die Wissensseiten nutzen nun den bestehenden `components/Header.tsx`. Der bisherige runde Pfeil kam vom nativen Stack-Header. Dieser ist für Wochenbegleiter, Artikel und Bibliothek ausgeblendet; der gemeinsame Header übernimmt den Zurückweg und die obere Safe Area. Am Header selbst wurden nur eine optionale übersetzbare Beschriftung und die Button-Rolle für Barrierefreiheit ergänzt. Seine Gestaltung bleibt erhalten.

Die Wochenübersicht trennt den Einstieg vom längeren Lesen: Eine horizontale SSW-Leiste zeigt die ausgewählte Woche und das Schwangerschaftsalter. Die Wochen 1–42 sind direkt antippbar, die Pfeile stoppen an den Grenzen. Auf schmalen Geräten oder bei großer Schrift wird der kurze SSW-Titel im Header verwendet.

Darunter stehen fünf Story-Einstiege: Baby, Körper, Wissen, Vorbereitung und Gemeinsam. Jeder Abschnitt bleibt stehen, bis die Nutzerin weiterblättert. Fortschrittssegmente, Schaltflächen, linkes/rechtes Antippen des Bildes und horizontales Wischen wechseln den Abschnitt. Vertikales Lesen bleibt möglich. Keine automatische Wiedergabe, keine zusätzlichen Animationen oder nativen Abhängigkeiten. Die Bilder sind vorhandene redaktionelle Cover, keine anatomischen Entwicklungsbilder.

Ein Wochenartikel enthält weiterhin sämtliche bisherigen Abschnitte, Größenhinweis, Countdown, Artikel, Vorbereitung, Fragenentwürfe, Partnertext, Hilfe, Quellen und Bibliothekslink. Themenartikel können aus einer Story geöffnet werden; Zurück führt zum bisherigen Abschnitt. Das Ende einer aus der Übersicht geöffneten Story kehrt zur bestehenden Übersicht zurück, ohne eine zweite Übersicht in den Verlauf einzufügen. Ein direkter Story-Link hat eine Übersicht als Abschluss.

## Dateien

- `app/pregnancy-week.tsx`: dispatcht Übersicht, Story, Wochenartikel und Quellen über bestehende Routenparameter.
- `components/pregnancy-guide/guide-ui.tsx`: gemeinsamer Header und Safe Area.
- `components/pregnancy-guide/week-selector.tsx`: horizontale SSW-Auswahl.
- `components/pregnancy-guide/week-overview.tsx`: Story-Einstiege und Artikellinks.
- `components/pregnancy-guide/week-stories.tsx`: Lesen, Gesten, Fortschritt und Rückkehr.
- `components/pregnancy-guide/week-article.tsx`: bisheriger vollständiger Wocheninhalt.
- `components/pregnancy-guide/guide-card.tsx`: runde Coverdarstellung und deaktiviertes Bild-Dragging.
- `lib/pregnancy-guide/stories.ts`, `copy.ts`: vorhandene Inhalte in Abschnitte aufgeteilt; deutsche, englische und spanische Bedienungstexte.
- `lib/__tests__/pregnancy-guide.test.ts`: Erreichbarkeit sämtlicher vorhandener Absätze, Fragen und Werkzeuge aller 42 Wochen sowie ungültige Story-Links.

## Nachweise

- `npm run typecheck`: erfolgreich, inklusive Test-Typprüfung.
- ESLint für die betroffenen Komponenten, Routen, Texte und Tests: keine Fehler oder Warnungen.
- Drei Jest-Suites für redaktionellen Katalog, Merkliste und Schwangerschaftsalter: 25 Tests erfolgreich.
- Expo-Export für iOS und Android: beide Hermes-Bündel erfolgreich erzeugt. Das ist eine Bündelprüfung, kein neuer signierter Store-Build.
- 19 Browser-Prüfungen mit den tatsächlichen React-Native-Web-Komponenten und `Header.tsx`: SSW 1/42, direkte Auswahl, Story-Fortschritt, Antippen/Wischen, Artikel und Rückkehr, Fragenentwurf, Bibliothekssuche, ungültige Links, Quellenansicht, DE/EN/ES, hell/dunkel sowie 320/414/736 Pixel. Große Schrift wurde bei 320 Pixeln mit Faktor 2 geprüft; kein Text- oder Dokumentüberlauf.
- Die Browser-Hülle ersetzt Konto-, Router- und Plattformkontexte. Entwürfe und externe Quellen werden dort nicht tatsächlich gespeichert beziehungsweise extern geöffnet. Dies ersetzt keine Prüfung von VoiceOver/TalkBack und Gesten auf physischen Geräten.

Nachweise: `output/pregnancy-stories-20261003/{typecheck.log,lint.log,tests.log,native-export.log,ui-verification.json,preservation.json}`. Interaktive Vorschau: Server auf Port 8843, `/?route=pregnancy-week&week=7&theme=light`. Start mit `python3 -m http.server 8843 --bind 127.0.0.1 --directory output/pregnancy-stories-20261003`.

![Aktuelle Wochenübersicht](../output/pregnancy-app-style-20261003/overview-light-414.jpg)

![Aktuelle Körper-Story ohne Entwurfshinweis](../output/pregnancy-app-style-20261003/story-light-414.jpg)

## Bestehender Stand und Veröffentlichung

Der aktuelle Arbeitsstand wurde vor der Änderung geprüft. Die vorhandenen Änderungen bleiben erhalten. SHA-256-Vergleiche bestätigen unveränderte Schwangerschafts-Home-Dateien einschließlich „Dein Tag im Überblick“, Artikel- und Bibliotheksrouten, Wochen-/Artikeltexte sowie `eas.json` und `app.json`. Vorherige Dateien und Ausgangshashes liegen neben den Nachweisen.

Es wurde kein OTA-Update veröffentlicht, kein Store-Build ersetzt und kein Backend verändert. Diese UI-Änderungen sind somit noch nicht Teil des bereits installierten Release-Kandidaten. Quellen und Inhaltsversion bleiben erreichbar.

## Nachtrag: sichtbaren Entwurfshinweis entfernt

Auf Nutzerwunsch wurde der Hinweis „Redaktioneller Entwurf · fachliche Prüfung ausstehend“ aus Übersicht, Storys, Wochenartikel, Themenartikeln und Quellen entfernt, einschließlich Englisch und Spanisch. Die Quellenbeschreibung nennt nur noch Version und Abrufdatum. Die internen Review-Metadaten bleiben unverändert; die Entfernung erzeugt keine fachliche Freigabe.

Für diese Textänderung bestehen Typprüfung, ESLint, acht vorhandene Katalogtests und 15 Browserprüfungen (fünf Ansichten in drei Sprachen). Nachweise und Ausgangshashes: `output/pregnancy-draft-label-removal-20261003/`. Die interaktive Vorschau auf Port 8843 wurde aktualisiert. Die oben dokumentierte Hermes-Bündelprüfung und ihre Exportdateien gehören zum vorherigen Stand; beim Abschluss dieser Textkorrektur wurde kein neuer nativer Build oder Export erstellt. Der spätere [Abgleich mit dem App-Stil](pregnancy-app-style-20261003.md) enthält eine erneute Bündelprüfung des aktuellen Quellstands.

## Nachtrag: Vollbild und zeitgesteuerte Story

Auf ausdrücklichen Nutzerwunsch vom 03.10.2026 folgt die Story jetzt dem vorhandenen Vollbild-Wochenreview mit automatischem Fortschritt, Halten zum Pausieren und Ziehen nach unten zum Schließen. Die aktuelle Vorschau und Nachweise stehen in [pregnancy-story-playback-20261003.md](pregnancy-story-playback-20261003.md); der zwischenzeitlich gestartete und nach Korrektur zu EAS Update abgebrochene Build steht in [pregnancy-story-build-20261003.md](pregnancy-story-build-20261003.md). Die obigen Prüfungen und Veröffentlichungsangaben beziehen sich auf den jeweils früheren Quellstand.
