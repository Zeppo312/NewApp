# Convex aus dem aktuellen App-Build entfernt – 02.10.2026

Der Nutzer wollte Convex aus dem nächsten Build entfernen, sofern die laufende Produktionsdatenbank davon nicht beeinträchtigt wird. Der aktuelle App-Code verwendete bereits Supabase: ConvexContext lieferte seit 17.02.2026 keinen Client und seine Synchronisierung gab false zurück. BackendContext erzwang Supabase; der BackendToggle wurde nicht gerendert. Dennoch konnten Baby-/Sleep-Services über generierte API-Imports Convexmodule in die App aufnehmen.

Diese verbliebenen Runtime-Imports, der leere Provider, No-op-Synchronisierung, tote Umschaltung und Statusanzeigen sind entfernt. Baby- und Schlafservice nutzen unmittelbar ihre unveränderten Supabaseoperationen. Sharingfilter, Fehler-/Rückgabeverträge, Schlaf-Autoclose und Erfolgsevents bleiben erhalten. Die Paketabhängigkeit und ausschließlich ihre transitiven esbuild-/Prettier-Einträge wurden aus Package/Lock entfernt; alle behaltenen Lock-Paketobjekte sind unverändert. Vorhandene fremde lokale Änderungen wurden als Ausgangspunkt gesichert.

Keine Supabase-Datenbank-, Schema-, Secret-, Settings- oder Anbieteränderung. Keine Convex-Deploymentlöschung. Die 14 historischen Serverdateien unter convex/ sind bytegleich erhalten und aus dem App-Typecheck ausgeschlossen; vorhandene historische Team-/URL-Konfiguration hat keinen App-Verbraucher. Lokale Entfernung aus dem Build schließt den historischen Datenschutzfall nicht ab.

Validierung:

- App-Typecheck vor/nach der Änderung und Test-Typecheck ohne Fehler.
- 20 gemockte Vorher-/Nachhervergleiche mit gleichen Supabaseoperationen, Payloads, Rückgaben und Events; keine echten Datenbank-Schreibtests.
- Sechs vorhandene Jest-Suites, 47 Tests bestanden.
- Lokaler iOS-/Android-Metroexport erfolgreich. Beide Source-Maps enthalten 0 Convex-/ConvexContext-/BackendTogglemodule und weiterhin den Supabase-Client.

Das ist der lokal geprüfte Stand für den nächsten Build. Es wurde kein EAS-/Native-Build, Upload, OTA-Update oder Store-/TestFlight-Release ausgelöst. Eine Nativeabnahme bleibt Bestandteil der späteren Auslieferung.

Historisch enthielt Commit 23e9679 vom 26.01.2026 einen echten Convexclient mit Syncfunktionen; Commit 31a2e37 vom 17.02.2026 deaktivierte ihn. Das belegt frühere technische Fähigkeit, keine tatsächliche Nutzung und keine Altbestandsabwesenheit. Team laura-michelle-kuck/lottibaby und Dev merry-pony-594 bleiben mangels Zugriff ungeprüft. Für tatsächliche frühere Prod-/Dev-/Preview-, Tabellen-, Storage-, Job- und Backupkataloge ist weiterhin der bestehende Teamzugang erforderlich.

Nachweise: [Bericht](../../output/deletion-provider-followup-20261002/history/history-summary.md), [Diff gegen gesicherten dirty Ausgang](../../output/deletion-provider-followup-20261002/history/convex-removal.diff), [Validierung](../../output/deletion-provider-followup-20261002/history/convex-removal-validation.json), [20 Servicevergleiche](../../output/deletion-provider-followup-20261002/history/service-equivalence-results.json), [Dateihashes](../../output/deletion-provider-followup-20261002/history/convex-removal-changed-files.json).
