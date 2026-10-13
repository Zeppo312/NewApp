# Schlaftracker-Korrektur per EAS Update

Auf Nutzerauftrag am 09.10.2026 um 10:37 MESZ veröffentlicht:

- [EAS Update 922a68da-f3d7-4823-8a37-33a03a5c4bbc](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/922a68da-f3d7-4823-8a37-33a03a5c4bbc)
- Projekt `d7120520-e4ff-4967-a797-627a2cb3680b`, Kanal/Branch `release-candidate-20261003`, Environment `production`.
- iOS: Update `01a11fcf-d91a-7a87-a4a1-f2e708047248`, Runtime `1.0.25`.
- Android: Update `01a11fcf-d91a-72ee-83a1-404c33b6d605`, Runtime `1.0.25`.

Die isolierte Quelle entspricht der zuletzt veröffentlichten Kandidatenbasis `8f8ce9af-c4c1-4371-8fa0-1d0e058cbf24`, ergänzt ausschließlich um den Hook, dessen Einbindung im Schlaftracker und die zugehörigen Regressionstests. Die [Korrektur](sleep-partner-offline-tracker-fix-20261009.md) prüft einen angezeigten aktiven Schlaf alle 15 Sekunden und lädt den gemeinsamen Stand nach einem bestätigten Ende neu, auch wenn das Realtime-Ereignis ausbleibt.

108 fokussierte Clienttests sowie App- und ausgewählte Test-TypeScript-Prüfungen bestanden in dieser Quelle. Beide frisch erzeugten Hermes-Bundles enthalten die Korrektur; sämtliche Assethashes sind mit der Kandidatenbasis identisch. Die ausgelieferten Multipart-Manifeste bestätigen die beiden neuen Update-IDs, Runtime, Bundlehashes und alle 120 iOS-/125 Android-Assethashes. Der neue Stand ist der jüngste Update-Stand des Kandidatenkanals. Alle Kanalzuordnungen und die Updates auf `main` sind unverändert.

Keine Servermigration, Änderung der Schlaf-Paket-S-Freigabe, native Abhängigkeit oder native Konfiguration enthalten. Ein neuer nativer Build wurde nicht erstellt. Der direkte CDN-Bundleabruf liefert weiterhin HTTP 403; die Manifest-/Hash-Verifikation ist erfolgreich, Installation und tatsächlicher Ablauf auf zwei Handys bleiben unbestätigt.

Auf beiden Handys LottiBaby mit Internet vollständig beenden und öffnen, den Download abwarten und gegebenenfalls noch einmal vollständig beenden/öffnen. Danach den gemeldeten Ablauf wiederholen: Partner startet online, anderes Handy empfängt den Schlaf, geht offline, stoppt und verbindet sich erneut. Der Partner bleibt dabei im geöffneten Schlaftracker.

Schlüsselfreie Nachweise: `output/sleep-partner-ota-20261009/{source-preparation,config-preflight,export-verification,served-manifest-verification,publication-verification}.json`, `regressions.log`, `typecheck-app.log`, `typecheck-tests.log`. Private Rohantworten liegen unter `.family-qa/sleep-partner-ota-20261009/`.
