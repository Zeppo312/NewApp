# Automatische Wiederholung für Lottis Einstellungen

Am 11.10.2026 auf Nutzerauftrag als [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/cbf95e91-e1f0-48f6-811a-de97268ca068) veröffentlicht.

- Kanal/Branch: `release-candidate-20261003`, Environment: `production`, Runtime: `1.0.25`.
- iOS: `01a12c0d-392a-7d95-a506-024802af560c`.
- Android: `01a12c0d-392a-7887-9ee0-d6264406befc`.

Die Themen-Schalter in Lottis Fürsorge reagieren sofort. Unbestätigte Änderungen werden pro Konto und Backend lokal vorgemerkt und bei Speicherfehlern mit wachsenden Abständen erneut gespeichert: 1, 2, 4, 8, 16 und anschließend höchstens 30 Sekunden. Im Hintergrund pausieren die Versuche; beim Aktivieren der App werden sie fortgesetzt. Nach einem Neustart wird ein offener Entwurf beim erneuten Öffnen von Lottis Fürsorge wieder aufgenommen. Ein Hinweis bietet zusätzlich eine sofortige manuelle Wiederholung an.

Speicheraufträge laufen nacheinander und berücksichtigen den neuesten Schalterstand. Ältere Ladeantworten überschreiben keine neueren Änderungen. Eine absichtlich leere Themenauswahl bleibt nach dem Laden leer. Kontowechsel und Abmeldung stoppen die Aufträge; die Gerätebereinigung wartet auf bereits begonnene lokale Schreibvorgänge.

Die isolierte Quelle wurde aus den 1.043 gespeicherten Datei-Prüfsummen der zuletzt veröffentlichten Kandidatenbasis `922a68da-f3d7-4823-8a37-33a03a5c4bbc` wiederhergestellt. Hinzu kamen die sechs Implementierungsdateien und zwei Regressionstestdateien dieser Korrektur. 39 Tests in sieben Suites sowie App- und ausgewählte Test-TypeScript-Prüfungen bestanden in der isolierten Quelle.

Beide exportierten Hermes-Bundles enthalten die neue Speicherlogik. Die ausgelieferten Multipart-Manifeste bestätigen die neuen Update-IDs, Runtime, Bundlehashes und alle 120 iOS-/125 Android-Assethashes. Die Assets entsprechen der bisherigen Kandidatenbasis. Der neue Stand ist der jüngste Update-Stand des Kandidatenkanals; alle Kanalzuordnungen und die Veröffentlichung auf `main` sind unverändert.

Native Konfiguration und Abhängigkeiten entsprechen der bisherigen Kandidatenbasis. Es wurde keine Servermigration und kein nativer Build ausgeführt. Direkte CDN-Bundleabrufe liefern weiterhin HTTP 403; bestätigt sind die Veröffentlichung und Manifest-/Hash-Verifikation. Installation und Verhalten auf dem tatsächlichen Gerät sind noch zu prüfen.

Zum Anschauen die TestFlight-/Kandidaten-App mit Internet vollständig beenden und öffnen, den Download abwarten und bei Bedarf ein zweites Mal vollständig beenden und öffnen. Anschließend in **Lottis Fürsorge → Einstellungen** die Themen-Schalter ausprobieren.

Schlüsselfreie Nachweise: `output/advisor-settings-ota-20261011/{source-preparation,export-preflight,export-verification,served-manifest-verification,publication-verification}.json` sowie `regressions.log`, `typecheck-app.log` und `typecheck-tests.log`. Die eingefrorene Quelle und private Rohantworten liegen unter `.family-qa/advisor-settings-ota-20261011/`.
