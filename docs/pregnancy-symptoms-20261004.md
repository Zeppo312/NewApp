# Schwangerschafts-Home und Symptom-Tagebuch

Stand: 04.10.2026, 22:48 MESZ. Implementiert und als [EAS Update 2bb7dc6b-68f7-406a-8f6a-f6abe478dadf](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/2bb7dc6b-68f7-406a-8f6a-f6abe478dadf) für iOS und Android auf dem bisherigen Kanal `release-candidate-20261003` veröffentlicht. Runtime `1.0.25`, EAS-Umgebung `production`. Die tatsächlich ausgelieferten Plattform-Manifeste sind geprüft. Die Abnahme auf dem physischen Gerät bleibt offen.

Die Home-Darstellung dieses Stands wurde am 05.10.2026 durch [einheitliche Karten und sichtbare Wochenkacheln](pregnancy-home-uniform-20261005.md) ersetzt. Die folgenden Angaben zur dynamischen Slide-Höhe und zum Home-Abschnitt „Gut zu wissen“ beschreiben den damaligen Stand; das Symptom-Tagebuch bleibt gültig.

## Gewünschter Ablauf

„Dein Tag im Überblick“ umfasst jetzt vier Slides:

1. „Deine Schwangerschaft diese Woche“ mit den vorhandenen Bildkacheln „Dein Baby“ und „Dein Körper“. Beide öffnen weiterhin ihren eigenen Abschnitt im Wochenbegleiter.
2. „Wie fühlst du dich?“ mit dem Einstieg „Symptome eintragen“.
3. Die bisherigen Schwangerschaftszahlen und ihr Countdown-Einstieg.
4. Die vorhandene Shop-Empfehlung.

Die Wochenkacheln stehen damit im Rondell statt nochmals darunter. „Gut zu wissen, gerade jetzt“, Begrüßung und Schnellzugriffe bleiben verfügbar. Die Höhe passt sich an den ausgewählten Slide an; Berühren oder Blättern beendet die automatische Rotation, und auf einer anderen Seite pausiert sie. Die Punkte sind bedienbare Buttons. Eine geänderte Bildschirmbreite richtet den aktuellen Slide neu aus.

## Tagebuch

Die neue Route `/pregnancy-symptoms` erfasst pro lokalem Kalendertag eine optionale Stimmung, mehrere der zwölf angebotenen Symptome mit Stärke und eine Notiz. Frühere Tage lassen sich ansehen und bearbeiten; die letzten sieben gespeicherten Tage bieten direkte Einstiege. Ein Speichern ersetzt den Eintrag dieses Tages. Löschen entfernt nur diesen Tag. Zukunftseinträge und leere Einträge werden abgewiesen.

Die ausgewählten Symptome führen direkt zu bestehenden Themenartikeln. Übelkeit und Erbrechen teilen beispielsweise den Artikel `nausea`; Blähungen und Verstopfung teilen `digestion`. Doppelte Empfehlungen entfallen. Die Intensität wird dokumentiert und dient keiner Diagnose oder Entwarnung. Bei niedriger Stimmung wird der bestehende Artikel über Sorgen und Unterstützung ergänzt.

Die Seite zeigt allgemeine und passende vorhandene Hinweise zur Abklärung. Sie erzeugt keine medizinische Beurteilung und verwendet keine KI. Die bestehenden redaktionellen Artikel sind weiterhin Entwürfe; diese technische Erweiterung ist keine fachliche Freigabe. Die vorhandenen NHS-Quellen zu [Warnzeichen](https://www.nhs.uk/pregnancy/common-symptoms/pregnancy-symptoms-you-need-to-get-help-for/) und [Übelkeit/Erbrechen](https://www.nhs.uk/pregnancy/common-symptoms/vomiting-and-morning-sickness/) wurden am 04.10.2026 erneut gelesen.

## Speicherung und Fehlerfälle

- Speicherung lokal über die vorhandene Geräte-Datenhaltung, getrennt nach Konto und Produktions-/QA-Umgebung. Keine neue Datenbanktabelle und keine Synchronisation. Die Seite erläutert diese Begrenzung einschließlich Löschung beim Abmelden.
- Die Route ist im Einwilligungs-Navigator geschützt. Lesen und Schreiben prüfen zusätzlich aktuelle Identität und Gesundheitseinwilligung, auch nach asynchronen Operationen.
- Das bestehende Aufräumen bei Widerruf, Abmelden und Kontolöschung umfasst die neuen Einträge. Ein zurückkommendes Lesen nach einem Kontowechsel liefert keine Daten. Ein beim Widerruf laufendes Schreiben wird entfernt.
- Ein abgebrochener Vordergrund-Check setzt ein bereits begonnenes Speichern zurück und erhält frühere Einträge, sofern die ursprüngliche Identität und Einwilligung noch gelten.
- Ladefehler öffnen kein leeres bearbeitbares Formular. Beschädigte gespeicherte Daten werden nicht durch einen neuen Eintrag überschrieben. Speicherfehler erhalten den Entwurf für einen erneuten Versuch. Parallele Änderungen werden serialisiert, wiederholtes Absenden ist blockiert.
- Tageswechsel und Zurücknavigieren fragen bei ungespeicherten Änderungen nach. Der Artikelaufruf lässt den Entwurf im bestehenden Screen erhalten. Die Notizansicht berücksichtigt die Tastatur.

## Prüfung

Nachweise unter `output/pregnancy-symptoms-20261004/`:

- `typecheck.log`: App- und Test-Typecheck erfolgreich.
- `tests.log`: 61 Tests in acht Suites erfolgreich, einschließlich Speichern/Retry, Löschfehler, Kontowechsel, Einwilligungsprüfung, beschädigten Daten, Kalendergrenzen, Artikelzuordnung sowie bestehender Wochen-/Story-Navigation.
- `consent-routes.log`: acht Prüfungen erfolgreich, einschließlich der vollständigen Route-Inventur.
- `lint.json`: keine Fehler in den geprüften Dateien; 16 bereits vorhandene Warnungen in `pregnancy-home.tsx`. Neue Module und Tests ohne Warnungen.
- `export.log` und `export/`: lokaler Export für iOS, Android und Web; keine signierten installierbaren Builds.
- `ui-verification.json`: tatsächliche aktuelle React-Native-Web-Komponenten in einer isolierten lokalen Prüfoberfläche. Account, Einwilligungsstatus und Navigation sind simuliert; lokale Speicherung und Komponenten sind echt. Auswahl von Stimmung/Symptom/Stärke, Speichern, Neuladen und zugehöriger Artikel sichtbar geprüft. 390 px sowie 320 px mit 160 % simulierter Schriftgröße geprüft; kein horizontaler Seitenüberlauf und keine JavaScript-Fehler. Wochenkacheln wechseln bei großer Schrift in eine Spalte. Das Foto im Einstiegs-Slide erhält einen eigenen Bildausschnitt.

Offen bleibt die Abnahme im installierten iOS-/Android-Build, insbesondere die Softwaretastatur und native Zurück-/Swipe-Gesten. Die isolierte Browserprüfung und die Komponententests ersetzen diese Abnahme nicht.

## EAS-Veröffentlichung

Der Veröffentlichungsstand baut auf der zuletzt veröffentlichten Gruppe `ebcfb0a8-6ad1-4711-83a6-1221afca012e` auf. Die isolierte Kopie übernimmt zehn Anwendungsdateien und vier aktuelle Tests; 1.007 andere Dateien bleiben unverändert. Die 30 vorhandenen Bilder und aktuellen Story-Korrekturen sind erhalten. Native Konfiguration, Paketversionen, Runtime, Backend und Billing wurden nicht geändert.

Die vorhandenen Kandidaten-Builds sind iOS `1.0.25 (1.0.80)` und Android `1.0.25 (24)`, jeweils Runtime `1.0.25`. App-Typecheck, Typecheck der ausgewählten Schwangerschaftstests, 61 Jest-Tests und acht Einwilligungs-/Route-Prüfungen bestanden. Der gezielte ESLint-Lauf hat keine Fehler; 25 vorhandene Warnungen in bereits bestehenden Dateien bleiben. Die vollständige Test-Typecheck-Konfiguration der isolierten Quelle verweist auch auf Backend-Module, die aus dem bisherigen Kandidatenarchiv ausgeschlossen sind; deshalb wurden die Anwendungsprüfung und die ausgewählten Schwangerschaftstests separat erfolgreich geprüft.

Der mit der vorhandenen EAS-Produktionsumgebung erstellte Export wurde vor Veröffentlichung geprüft und anschließend mit `--skip-bundler` unverändert hochgeladen. Beide Bundles enthalten das Produktionsbackend, dieselben Billing-Schlüssel wie die jeweiligen Kandidaten-Binaries, die Symptomroute und alle 30 Bilder. Die tatsächlichen iOS-/Android-Manifeste liefern die neuen Update-IDs und die SHA-256-Prüfsummen dieser geprüften Bundles.

Alle fünf Kanalzuordnungen und die 22 überprüften Dateien im Hauptarbeitsverzeichnis bleiben unverändert. Der öffentliche Branch `main` bleibt auf Gruppe `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`. Kein neuer Store-Build wurde erstellt.

Belege unter `output/pregnancy-symptoms-ota-20261004/`: [Veröffentlichung](../output/pregnancy-symptoms-ota-20261004/published-update.json), [Auslieferungsprüfung](../output/pregnancy-symptoms-ota-20261004/served-manifest-verification.json), [Exportprüfung](../output/pregnancy-symptoms-ota-20261004/export-verification.json), [Quellvorbereitung](../output/pregnancy-symptoms-ota-20261004/source-preparation.json), [Prüfergebnis](../output/pregnancy-symptoms-ota-20261004/qa-verification.json) und [Erhalt der bestehenden Veröffentlichung](../output/pregnancy-symptoms-ota-20261004/published-release-preservation.json).

Zum Anwenden den vorhandenen Kandidaten vollständig schließen und öffnen. Wird das Update zunächst im Hintergrund geladen, anschließend ein zweites Mal vollständig schließen und öffnen.
