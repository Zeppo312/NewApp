# Lokale Speicherung per EAS Update für TestFlight

Stand: 08.10.2026, veröffentlicht um 14:34 MESZ auf ausdrücklichen Nutzerauftrag. Das Update ist für den bestehenden iOS-TestFlight-Kandidaten **Version 1.0.25 / Build 1.0.80** veröffentlicht. Die native Buildnummer bleibt gleich.

- [EAS Update 932a17e8-ac91-41d6-9123-4abaec0e4c5b](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/932a17e8-ac91-41d6-9123-4abaec0e4c5b)
- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b`
- Kanal und Branch: `release-candidate-20261003`
- Runtime: `1.0.25`, Expo SDK 57, Plattform ausschließlich iOS
- EAS-Environment: `production`, passend zum Produktionsbackend des vorhandenen TestFlight-Kandidaten. Dies ist keine Veröffentlichung auf dem öffentlichen `main`-Branch.
- iOS-Update-ID: `01a11b82-2d05-7a2f-8734-e1f1d9a3bc40`

## Enthaltenes Verhalten

Die lokalen Ansichtsstände für Home, einzelne Tage, Kinderliste und Schwangerschaft sowie bewusst fortsetzbare Flaschen-/Windelentwürfe sind enthalten. Bereits online bestätigte Daten können bei Verbindungsproblemen als gespeicherter Stand erscheinen. Es gibt keine Vorabladung sämtlicher Daten: Ein Tag muss zuvor auf diesem Gerät geladen worden sein. Entwürfe werden lokal gespeichert; ein bestätigter Eintrag im gemeinsamen Verlauf entsteht weiterhin durch bewusstes Online-Speichern. Nach einer unklaren Speicherantwort ist die Prüfung des frisch geladenen Originalverlaufs erforderlich.

Die aktuellen JavaScript-Korrekturen für Schlafabgleich und verspätete Live-Activity-Antworten sind enthalten. **Schlaf-Paket S bleibt deaktiviert:** Der Export setzt `EXPO_PUBLIC_SLEEP_OFFLINE_ENABLED=false`. Es gibt keinen freigegebenen Offline-Schlafstopp und keine Servermigration. Die beiden lokalen Swift-Änderungen am Schlaf-Widget sind nicht Teil dieser OTA-Auslieferung und benötigen einen neuen nativen Build. Die bestehende native Modul- und Paketbasis bleibt gleich.

Die vollständige lokale Umsetzung und die weiterhin offenen Server-/Partner-Gates stehen im [lokalen Nachweisbericht](offline-phase-a-s-lokalnachweis-20261008.md).

## Aktivieren und prüfen

1. In TestFlight prüfen, dass **1.0.25 / 1.0.80** installiert ist.
2. Lotti Baby mit Internet vollständig beenden und wieder öffnen; dem Hintergrunddownload etwas Zeit geben. Anschließend gegebenenfalls erneut vollständig beenden und öffnen. Hintergrund/Foreground allein ist kein vollständiger Neustart.
3. Home und einen Tag online laden, anschließend ohne Verbindung den gespeicherten Stand prüfen. Einen neuen Flaschen-/Windelentwurf ausfüllen und nach einem App-Neustart bewusst fortsetzen. Ein Entwurf ist noch kein Eintrag im gemeinsamen Verlauf.

Das automatische Download-/Neustartverhalten folgt der vorhandenen `expo-updates`-Konfiguration (`ON_LOAD`, keine zusätzliche Startwartezeit). [Expo-Dokumentation](https://docs.expo.dev/eas-update/download-updates/)

## Verifikation und Grenzen

- Frische EAS-Buildabfrage bestätigt Kandidatenkanal, Runtime `1.0.25`, SDK 57 und Build `1.0.80`; die vorhandene IPA bestätigt dieselbe native Update-Konfiguration.
- Die isolierte Exportquelle enthält den aktuellen Clientstand auf der zuletzt veröffentlichten Kandidatenbasis. Paket-/Lockdatei und native Konfiguration sind identisch zur kompatiblen Basis; die bestehenden lokalen Dateien wurden anhand ihrer SHA-256-Werte unverändert erhalten.
- **300 Tests in 28 Suiten bestanden**, App-TypeScript und TypeScript für diese Clientregressionen bestanden. Der zusätzliche vollständige Test-TypeScript-Lauf der isolierten OTA-Kopie scheitert an dort ausgeschlossenen Backend-Testmodulen; das ist in `typecheck-tests.log` dokumentiert und kein behaupteter vollständiger Test-TypeScript-Erfolg dieser Kopie.
- iOS-Hermes-Bundle erfolgreich: SHA-256 `4c7b981a2f8be3b942970ab7988ec526fb50d8c6784f5463844ddf8b1cbf0f4b`. Produktionsbackend, RevenueCat-Schlüsselübereinstimmung mit dem Kandidaten, neue Speicher-/Entwurfsmarker und vorhandene Routen geprüft. Alle 120 Assets entsprechen dem vorherigen Kandidatenexport.
- Der Update-Server liefert für iOS/Kanal/Runtime die neue Update-ID. Bundlehash und sämtliche Assethashes im ausgelieferten Manifest entsprechen dem geprüften Export. Der separate direkte CDN-Bundleabruf aus dieser Umgebung antwortet mit HTTP 403; tatsächliche CDN-Bytes und Installation auf dem physischen iPhone sind deshalb nicht als verifiziert markiert.
- Alle Kanalzuordnungen und der öffentliche `main`-Update-Stand `a47827a3-b732-4f64-a539-429d3709849a` bleiben unverändert. Android erhält weiterhin die vorherige Update-ID `01a11656-ef91-71a3-bc06-a4c2093a1849`.
- Keine Servermigration, kein neuer nativer Build, kein Push oder Merge. Geräteabnahme und S-Serverfreigabe bleiben offen.

Öffentliche, schlüsselfreie Nachweise: `output/offline-phase-a-ota-20261008/{source-preparation,export-preflight,export-verification,served-manifest-verification,publication-verification}.json`, `regressions.log`, `typecheck-app.log` und `typecheck-client-tests.log`. Private CLI-Protokolle und Rohmanifeste: `.family-qa/offline-phase-a-ota-20261008/`.
