# Offline-Tracking per EAS Update

Veröffentlicht am 08.10.2026 um 21:33 MESZ auf Nutzerauftrag.

- [EAS Update 99eb1f46-20c4-4194-ad32-fe935460f38f](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/99eb1f46-20c4-4194-ad32-fe935460f38f)
- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b`
- Kanal/Branch: `release-candidate-20261003`; Environment: `production`
- Plattformen: iOS und Android; Runtime jeweils `1.0.25`, SDK 57
- iOS-Update-ID: `01a11d01-4d24-73da-a026-f1ff11f282d3`
- Android-Update-ID: `01a11d01-4d24-7f00-bc23-c67470e50950`

Die vorhandenen Kandidaten sind kompatibel: iOS 1.0.25 / Build 1.0.80 und Android 1.0.25 / Build 24. Das Update enthält die lokale Schlaf-/Aktivitätserfassung, Timer-Wiederherstellung, Offline-/Synchronisierungsanzeige und den automatischen Partnerabgleich. Details und Grenzen stehen im [Umsetzungsbericht](offline-tracking-umsetzung-20261008.md).

## Server vor Client bereitgestellt

Migration `20261008183517_tracking_offline_outbox.sql` wurde auf `kwniiyayhzgjfqjsjcfu` angewandt und in der Migrationshistorie erfasst. SHA-256: `35225afa153ad11fe3a73c3aee528e2b4ca3885d8531346c1c8bdc2afed86c26`.

Die Migration stellt den idempotenten RPC, private Empfangsbelege mit RLS, Gesundheitsdatenwiderruf-Bereinigung und Löschregistrierung bereit. Sie veröffentlicht `baby_care_entries` für Realtime, damit die geöffnete Partneransicht einen aktuellen autorisierten Abruf auslösen kann. Bestehende Fachtabellen, deren Regeln, andere Serverfunktionen und Einwilligungs-/Löschfreigaben wurden durch einen Katalogvergleich vor und innerhalb der Migration als unverändert geprüft. Das frühere versionierte Schlaf-Paket S bleibt deaktiviert.

Vor und nach dem Commit bestanden Tests mit authentifizierten Rollen gegen die tatsächlichen Tabellen und RLS: alle Aktivitätsarten, Partneransicht/-stopp, aktive Schlafkonflikte, Versionskonflikte, Vitamin D, private Belege, fremdes Konto und Vorräte genau einmal. Sämtliche Testdaten wurden zurückgerollt; keine Testnutzer oder Testkinder bleiben gespeichert. Migrationshash, Security Invoker, Ausführungsrechte, Beleg-RLS, Realtime und anonyme REST-Verweigerung wurden nach dem Commit geprüft.

## Export und Auslieferung geprüft

- Isolierte Quelle auf dem letzten Kandidaten `569f3d69-cba3-48f0-a1fa-ad05b374529a`, ergänzt um die betroffenen Offline-Tracking-Dateien.
- **354 Client-Tests in 29 Suiten**, App-TypeScript und TypeScript der ausgewählten Clienttests bestanden. Die sieben PostgreSQL-Vertragstests bestanden ebenfalls.
- Paket-/Lockdatei und native Konfiguration entsprechen der kompatiblen Kandidatenbasis. Beide RevenueCat-Schlüssel entsprechen den Kandidaten; der Export verwendet das Produktionsbackend.
- iOS- und Android-Hermes-Bundles enthalten das neue Journal, den RPC-Aufruf und die Synchronisierungsanzeige. Die ausgelieferten Manifeste bestätigen beide neuen IDs, Runtime und Bundlehashes sowie sämtliche 120 iOS-/125 Android-Assethashes des geprüften Exports.
- Alle bestehenden Kanalzuordnungen und der öffentliche `main`-Update-Stand `a47827a3-b732-4f64-a539-429d3709849a` bleiben unverändert.

Der separate direkte CDN-Bundleabruf liefert in dieser Umgebung HTTP 403. Manifestprüfung ist erfolgreich; tatsächliche CDN-Bytes und Installation auf physischen Geräten wurden nicht bestätigt. Bestehende lokale Swift-Widget-Änderungen sind kein Bestandteil des OTA-Updates. Ein neuer nativer Build oder Store-Release wurde nicht erstellt.

## Auf dem Handy aktivieren

LottiBaby mit Internet vollständig beenden und öffnen, Zeit für den Download lassen und gegebenenfalls noch einmal vollständig beenden/öffnen. Danach Flugmodus aktivieren, Schlaf bzw. Aktivitäten speichern, die App erneut öffnen und anschließend den Abgleich bei wiederhergestellter Verbindung mit dem Partner prüfen. Für den automatischen Versuch muss die App laufen bzw. erneut geöffnet werden. Die physische Zwei-Geräte-Abnahme bleibt offen.

Schlüsselfreie Nachweise: `output/offline-tracking-ota-20261008/{source-preparation,export-preflight,export-verification,server-verification,server-deployed-test,served-manifest-verification,publication-verification}.json`, `regressions.log`, `database-tests.log`, `typecheck-app.log`, `typecheck-client-tests.log`. Private CLI-Protokolle, Rohmanifeste und rückgerollte SQL-Testdaten liegen unter `.family-qa/offline-tracking-ota-20261008/`.
