# Offline-Tracking: EAS Update erneut veröffentlicht

Veröffentlicht am 08.10.2026 um 21:42 MESZ auf ausdrücklichen Nutzerauftrag.

- [EAS Update 8f8ce9af-c4c1-4371-8fa0-1d0e058cbf24](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/8f8ce9af-c4c1-4371-8fa0-1d0e058cbf24)
- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b`
- Kanal/Branch: `release-candidate-20261003`
- Plattformen: iOS und Android; Runtime jeweils `1.0.25`, Environment `production`
- iOS: `01a11d09-ac7d-7cb6-af5a-c7c2933e6d4b`
- Android: `01a11d09-ac7d-7791-8a6c-d59c4fedb6da`

Der bereits veröffentlichte und geprüfte Stand `99eb1f46-20c4-4194-ad32-fe935460f38f` wurde als neue Update-Gruppe erneut veröffentlicht. Sämtliche im damaligen Tracking-Quellmanifest aufgeführten Dateien der Arbeitskopie sind hashgleich. Beide lokalen Hermes-Bundles und alle Assets stimmen weiterhin mit dem ursprünglichen geprüften Export überein. Deshalb war kein erneuter Export oder identischer Testlauf nötig.

Der erneute lesende Servercheck bestätigt den vorhandenen Tracking-RPC als SECURITY INVOKER, Execute für authentifizierte Konten, kein Execute für anonyme Konten, Receipt-RLS, Widerruftrigger, Receipt-Löschregel und Care-Realtime. Dieser Auftrag hat keine Servermigration ausgeführt. Schlaf-Paket S bleibt deaktiviert; lokale Swift-Widgetänderungen sind weiterhin nicht Bestandteil der OTA.

Die ausgelieferten Manifeste wurden mit `curl` geprüft: beide neuen IDs, Runtime und Bundlehashes sowie sämtliche 120 iOS-/125 Android-Assethashes stimmen mit dem Export überein. Alle Kanalzuordnungen und der öffentliche `main`-Stand sind unverändert. Der separate CDN-Bundleabruf antwortet weiterhin mit HTTP 403; physische Installation und Zwei-Geräte-Abnahme sind offen.

Die im [Vorprüfungsbericht](offline-tracking-auslieferung-vorpruefung-20261008.md) dokumentierten RLS- und Vitamin-D-Befunde bleiben offen. Der [erste Tracking-Auslieferungsbericht](offline-tracking-ota-20261008.md) bleibt als Nachweis der ursprünglichen Veröffentlichung erhalten.

Auf dem Handy LottiBaby mit Internet vollständig beenden und öffnen, den Download abwarten und gegebenenfalls ein zweites Mal vollständig beenden/öffnen.

Nachweise: [Vorprüfung](../output/offline-tracking-repeat-20261008/preflight.json), [Auslieferungsmanifeste](../output/offline-tracking-repeat-20261008/served-manifest-verification.json), [Veröffentlichung](../output/offline-tracking-repeat-20261008/publication-verification.json). Private CLI-Rohantworten liegen unter `.family-qa/offline-tracking-repeat-20261008/`.
