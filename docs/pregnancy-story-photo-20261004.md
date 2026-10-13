# Schwangerschafts-Stories mit Vollbildfoto

Aktuelle Folgeänderung: [Natürliche Bilder, rahmenlose Stories und übersichtliche Artikel vom 04.10.2026, 09:29 MESZ](pregnancy-story-reading-20261004.md).

Stand: 04.10.2026, 08:32 MESZ. Auf ausdrücklichen Nutzerwunsch umgesetzt und als EAS Update für iOS und Android veröffentlicht: [2eec6f03-230b-4660-9714-6bdbb31e4229](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/2eec6f03-230b-4660-9714-6bdbb31e4229). Kanal/Branch `release-candidate-20261003`, Runtime `1.0.25`, EAS-Umgebung `production`. Der zuvor behobene Absturz wurde vom Nutzer am 04.10.2026 auf seinem Gerät als behoben bestätigt.

## Gestaltung und Bedienung

Das vorhandene Foto füllt die gesamte Story. Eine dezente Abdunklung macht Kopfzeile und Fußbereich lesbar. Der Text liegt unten auf einer abgehobenen, runden Glasfläche in der vorhandenen violetten Farbwelt. Normale Bilder außerhalb der Story behalten ihre bisherige Darstellung.

- Keine sichtbaren Vor-/Zurückpfeile. Die linke Fotofläche blättert zurück, die rechte weiter. Abschnittsleisten bleiben zugänglich.
- Die gesamte Textfläche öffnet den passenden Artikel: Baby und allgemeine Wocheninhalte den vollständigen Wochenartikel; Körper und Wissen den zugeordneten Einzelartikel, falls vorhanden.
- Die zusätzlichen Aktionen für Vorbereitung, Arztfragen und Countdown bleiben als eigene Schaltflächen erhalten. Quellen bleiben erreichbar.
- Laufende Zeit, Pause, Halten und horizontales Wischen bleiben erhalten. Nach unten wischen schließt die Story. Ein Ziehen auf der Textfläche öffnet keinen Artikel; längeres Halten gilt ebenfalls nicht als Artikel-Tipp.
- Bei großer Schrift ist die Textfläche scrollbar; Kopfzeile und Schließen bleiben erreichbar. Tastaturaktivierung und die vollständige Textbeschreibung für Screenreader sind vorhanden. Automatisches Blättern bleibt für Screenreader/reduzierte Bewegung abgeschaltet.

Die stabil gehaltenen `Stack.Screen`-Optionen aus der Absturzkorrektur bleiben erhalten. Home, „Dein Tag im Überblick“, gemeinsamer Header, bestehende Werkzeuge, Wochenreview, fachliche Texte und Review-Metadaten wurden durch diese Änderung nicht bearbeitet. Keine Abhängigkeiten, native Konfiguration, Backend-Funktionen oder Store-Builds wurden geändert.

## Prüfungen

Typecheck und fokussiertes ESLint ohne Warnungen bestanden. 35 Jest-Tests in vier Suites bestanden; die neue Zuordnungsprüfung deckt Artikelziele über alle 42 Wochen sowie erhaltene Countdown-/Werkzeugaktionen ab.

Die Komponentenvorschau mit React Native Web und echtem Gesture Handler bestätigt Vollbildfoto, Glasfläche, links/rechts Tippen, horizontales Wischen, Wegwischen über Foto und Text ohne versehentlichen Artikelaufruf sowie echte Artikelanzeige. Bei 320 × 568 Pixeln, spanischem Text und Schriftfaktor 1,6 beträgt die Dokumentbreite 320 Pixel. Der Textbereich scrollt bis zur Artikelaktion; Enter öffnet den passenden Artikel. Der temporäre Browser-Viewport wurde zurückgesetzt.

Der native Test verwendet eine isolierte Simulator-App aus dem vorhandenen iOS-Release-Binary und echte Expo-Router-/Native-Stack-Navigation. Die Story-Quellen stimmen bytegenau mit Checkout und OTA-Quelle überein. Links/rechts Tippen, Wochenartikelziel, Einzelartikelziel `heartburn`, Rückkehr zur Story, Schließen zum Einstieg und drei erneute Öffnen-/Schließen-Zyklen wurden bestätigt. Die Artikelziele sind in dieser nativen Hülle vereinfachte Anzeigen; der vollständige Artikelinhalt wurde in der Komponentenvorschau geprüft. Automatischer Fortschritt wurde ebenfalls beobachtet.

Native Ziehgesten sind mit der verfügbaren Simulator-UI-Steuerung nicht abgenommen. Die neue Gestaltung und die aktuelle OTA-Übernahme auf dem physischen Gerät sind noch nicht bestätigt; die vorangegangene Absturzbehebung ist dagegen durch die ausdrückliche Nutzerrückmeldung bestätigt.

![Native Story-Vorschau](../output/pregnancy-story-photo-20261004/native-story.png)

## Auslieferung und Schutz der Veröffentlichung

- Android-Update: `01a1059d-a51e-77ff-bf3f-ecb0397fdf86`.
- iOS-Update: `01a1059d-a51e-7e4d-b682-f3565f3866fe`.
- Nachricht: „Schwangerschaft: Vollbildbilder, Text zum Artikel und Tippen statt Pfeilen“.
- Die vorhandene TestFlight-App **1.0.25 / 1.0.80** und der vorhandene Android-Kandidat **1.0.25 / 24** passen zu Kanal und Runtime. Kein neuer Build wurde gestartet oder eingereicht.

Beide finalen Hermes-Bündel enthalten die neuen Storys, alle zwölf vorhandenen Bilder und die bisherigen Routen. Produktionsbackend und Billing-Schlüssel stimmen mit dem jeweiligen vorhandenen Kandidaten überein. Die Exportquelle ist separat eingefroren; Router-App-Wurzel wurde explizit gesetzt und der Bundler-Cache geleert. Testhüllen-/Artikelstubs sind nicht im OTA enthalten.

EAS bestätigt beide Update-IDs und die neue Gruppe als aktuell auf dem Kandidaten-Branch. Alle fünf Kanalzuordnungen und der öffentliche `main`-Branch sind unverändert. Öffentlich bleibt Gruppe `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`. Dreizehn geschützte App-Quellen und fünfzehn geschützte Checkout-Dateien sind unverändert.

Zum Ansehen die bestehende TestFlight-App vollständig schließen und mit Internetverbindung öffnen. Nach dem Download gegebenenfalls ein zweites Mal vollständig schließen und öffnen. Keine Neuinstallation nötig.

Nachweise: `output/pregnancy-story-photo-20261004/` mit Screenshot, Aufgaben-Diff, UI-Prüfungen, Typ-/Lint-/Testlogs, Export- und Veröffentlichungskontrollen. Isolierte Quellen und rohe CLI-/Simulator-Logs liegen unter `.family-qa/pregnancy-story-photo-20261004/`.
