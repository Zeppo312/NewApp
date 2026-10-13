# Typografie: EAS Update vom 12.10.2026

Die lokal umgesetzten Typografie-Änderungen wurden für die bestehenden Kandidaten-Builds veröffentlicht.

- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b` (`@janzeppi/LottiBaby`).
- Kanal und Branch: `release-candidate-20261003`.
- Environment: `production`.
- Runtime: `1.0.25`, iOS und Android, Expo SDK 57.
- Gruppe: `f662c89a-7401-4942-a21c-f7b33005aa17`.
- iOS: `01a12e8b-1d43-75b4-9927-0eacdb462d0d`.
- Android: `01a12e8b-1d43-7e8e-935d-c0fee709b3d5`.
- [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/f662c89a-7401-4942-a21c-f7b33005aa17).

## Veröffentlichter Umfang

13 Quelldateien ergänzen die 14 gemeinsamen Textrollen, kompatible Aliasse in `ThemedText`, einheitliche Header mit Platz für ihre Aktionen sowie die Anwendung der Rollen in Login, Blog, Wehen-Historie, rechtlichen Dokumenten, `Collapsible` und `EmptyState`. Details stehen in [typography.md](typography.md).

Die isolierte Quelle basiert auf der zuletzt veröffentlichten Gruppe `cbf95e91-e1f0-48f6-811a-de97268ca068`. 1.047 Dateien der Basis wurden per Hash geprüft; bestehende Korrekturen einschließlich der Fürsorge-Einstellungen bleiben enthalten. Paketdateien, native Konfiguration und Assets entsprechen der Kandidatenbasis. Die Runtime der normalen Arbeitskopie wurde nicht geändert.

## Nachweise

- App- und Test-TypeScript-Prüfung bestanden. Fehlende Backend-Dateien wurden ausschließlich für den Test-Typecheck vorübergehend verlinkt und anschließend entfernt.
- ESLint: keine Fehler; dieselben 14 bestehenden Warnungen in Blog und Wehen-Tracker wie vor der Typografie-Änderung.
- Hermes-Exporte für beide Plattformen erfolgreich; neue Typografie-Rollen in beiden Bundles nachgewiesen.
- Ausgelieferte Multipart-Manifeste: Update-ID, Runtime, Bundlehash und sämtliche Assethashes stimmen mit dem lokalen Export überein (120 iOS- und 125 Android-Assets).
- Kanalzuordnungen und die bisherigen EAS-Updates auf Branch `main` unverändert.
- Keine Servermigration oder native Veröffentlichung durchgeführt.

Schlüsselfreie Nachweise liegen in `output/typography-ota-20261012/`: `source-preparation.json`, `export-preflight.json`, `prepublish-verification.json`, `export-verification.json`, `served-manifest-verification.json`, `publication-verification.json`, `typecheck.log` und `lint.json`. Private Rohantworten und die isolierte Quelle liegen unter `.family-qa/typography-ota-20261012/`.

Direkte CDN-Bundleabrufe antworteten mit HTTP 403. Bestätigt sind die Veröffentlichung und die Manifest-/Hash-Übereinstimmung; CDN-Bytes und Geräteinstallation wurden nicht bestätigt. Die native visuelle Prüfung, einschließlich großer Systemschrift, bleibt offen.

## Update auf dem Gerät laden

Eine App mit Kanal `release-candidate-20261003` und Runtime `1.0.25` vollständig beenden, mit Internet öffnen, den Download abwarten und nochmals vollständig beenden und öffnen. Anschließend Header, Login, Blog, Wehen-Historie und rechtliche Dokumente prüfen.
