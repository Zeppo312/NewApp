# Schwangerschaft: Bildvielfalt und stabile Story-Übergänge

## Umsetzung

Zwölf zusätzliche Motive ergänzen die bisherigen 18 Bilder. Alle 30 gespeicherten JPGs haben unterschiedliche Dateiinhalte. Die 24 Themenartikel verwenden jeweils ein eigenes Motiv. Die erste Baby-/Körper-Story und ihre Wochenkacheln variieren stabil mit der SSW; der Wochenartikel zeigt das zur Baby-Story passende Bild. Benachbarte Wochen haben unterschiedliche erste Baby- und Körperbilder. Bilder bleiben zwischen Aufrufen derselben Woche gleich. Die 42 Wochen nutzen einen gemeinsamen Pool von 30 Motiven; einzelne Motive werden in entfernten Wochen wiederverwendet.

Die Motive sind mit dem eingebauten Imagegen-Tool erzeugte Bilder in fotografischer Bildsprache, keine Fotos dokumentierter Personen. Neue Bilddateien: `assets/images/pregnancy-guide/*-20261004.jpg`. Die zwölf neuen Originaldateien und vollständigen Prompts sind im [Promptmanifest](../output/pregnancy-week-variety-20261004/image-prompts.json) dokumentiert. Tageslicht, natürliche Haut-/Materialdetails und unterschiedliche Alltagsszenen wurden vorgegeben und alle Ergebnisse visuell geprüft. Die optimierten neuen JPGs belegen zusammen rund 2,45 MB. Objektmotive bekommen in breiten Karten einen passenden Ausschnitt. Die Fotografien stellen kein bestimmtes medizinisches Entwicklungsstadium dar.

## Story-Navigation

- Abgebrochene horizontale Gesten wechseln keinen Abschnitt mehr.
- Verspätete Tap-/Timer-/Wisch-Ereignisse einer verlassenen Seite werden verworfen.
- Bei einem Seitenwechsel wird eine noch verschobene Story zurückgesetzt; alte Zieh-Gesten dürfen das neue Bild nicht bewegen.
- Ein erkannter Pan blockiert den zusätzlichen Foto-Tap beim Loslassen. So schließt Runterziehen die Story, statt zugleich weiterzuspringen.
- Der bestehende Countdown-Link sowie medizinische Inhalte, Quellen, Werkzeuge, Header und Home-Struktur bleiben erhalten.

Die Ursache des vom Nutzer auf dem Gerät beobachteten Hin-/Herspringens wurde nicht separat auf seinem Telefon reproduziert. Der Konflikt zwischen Runterziehen und zusätzlichem Tap ließ sich im Browser nachstellen und ist dort nach der Korrektur nicht mehr vorhanden.

## Babyansicht je nach SSW

Für eine eigene Darstellung des Babys im Bauch fehlen passende, nach Entwicklungsphase zugeordnete Illustrationen. Der ausdrücklich angebotene Prompt-Weg wurde umgesetzt: [direkt verwendbarer Einbau-Prompt](pregnancy-baby-visualization-prompt-20261004.md). Diese Entwicklungsdarstellung ist noch nicht Bestandteil des App-Updates. Der vorhandene Größenvergleich und Countdown bleiben erreichbar.

## Prüfung

26 Jest-Tests einschließlich neuer Regressionen für abgesagte Gesten, alte Seitenereignisse, Drag-/Tap-Konflikt, Position nach Seitenwechsel und Zuordnung aller 42 Wochen bestanden. TypeScript und gezielter ESLint ohne Warnungen bestanden.

Die Browser-Vorschau verwendet die tatsächlichen Komponenten mit einem isolierten Testkonto. Geprüft: unterschiedliche SSW-7-/8-Titelbilder, Baby → Körper → Baby, Countdown-Ziel, erfolgreiches Runterziehen, große Schrift bei 320 px ohne Dokumentüberlauf sowie fehlerfreie Browser-Konsole.

Im iOS-26.2-Simulator wurde ein isolierter nativer Expo-Router-Harness mit den echten Story-Komponenten geprüft: automatische Weiterfolge bis Wissen/Vorbereitung, gezielter Rückweg Körper → Baby, Vorwärtswechsel Baby → Körper und unterschiedliche Wochenartikel-Titelbilder. Keine Zeichen für Maximum-update-depth/RCTFatal/Unhandled-JS/SIGABRT in den Laufzeitlogs. Ein neuer Store-Build wurde dabei nicht erstellt. Der native Ziehweg und die Abnahme auf dem Telefon bleiben getrennte Geräteprüfungen.

Die OTA-Exporte für iOS und Android enthalten alle 30 Motive. Produktionsbackend, Einwilligungen, Billing-Schlüssel und Kandidaten-Runtime 1.0.25 entsprechen dem installierten Kandidaten. Veröffentlicht wird ausschließlich auf `release-candidate-20261003`; die öffentliche Version bleibt unverändert.

Nachweise liegen unter `output/pregnancy-week-variety-20261004/`. Das endgültige Update wurde am 04.10.2026 um 12:26 MESZ veröffentlicht: [EAS-Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/9d669626-d1e6-4d6d-91ef-fa5a422b62c3). Gruppe `9d669626-d1e6-4d6d-91ef-fa5a422b62c3`, beide Plattformen, Runtime `1.0.25`. Die ausgelieferten Update-Manifeste verweisen auf genau die geprüften Bundles und enthalten alle 30 Motive. Der öffentliche `main`-Zweig bleibt bei Gruppe `a47827a3-b732-4f64-a539-429d3709849a`; alle fünf Kanalzuordnungen sind vor/nach Veröffentlichung identisch. 995 Dateien der eingefrorenen Kandidatenquelle und 17 besonders geschützte Dateien des Arbeitsverzeichnisses sind unverändert.
