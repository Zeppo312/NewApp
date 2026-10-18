# Unabhängiger Review der neuen Betriebsänderungen am 02.10.2026

Stand: 02.10.2026, 10:08 UTC / 12:08 Berlin. Review durch den Supabase-Teilagenten; produktive Änderungen führt der Hauptagent aus.

Die neue Monitor-Migration, die Notification-Header-Migration und der korrigierte Runtime-Heartbeat bestehen 18 neue lokale Prüfungen. Es wurden keine vorhandenen QA-, Geräte-, Lösch-, Restore- oder Register-Replaytests wiederholt und keine produktiven Mutationen durchgeführt. Die temporären Testdatenbanken und Registerdateien wurden entfernt; alle RPC-/HTTP-Aufrufe waren lokale Stubs.

## Monitor

Die ursprüngliche neue Migration ersetzte beide Vorkommen von `'needs_attention'` in der bestehenden Alarmfunktion und scheiterte lokal mit PostgreSQL-Code 42601. Zudem bestätigte ein fehlender Singleton den Heartbeat fälschlich und blieb im Alarm unauffällig. Die Originalbelege bleiben erhalten unter `output/deletion-closure-execution-20261002/supabase/2026-10-02T10-02-03-522Z-runtime-monitor-local-review.json`.

Auf ausdrückliche Anweisung des Hauptagenten wurde ausschließlich `supabase/migrations/20261002095359_account_deletion_runtime_monitor.sql` gezielt korrigiert: Die vollständige eindeutige JSON-Key-/Subquery-Sequenz muss exakt einmal vorkommen. Ein Heartbeat ohne aktualisierten Singleton wirft `registry_runtime_missing`. Ein fehlender Singleton liefert im Alarm `registry_stale_over_3m=1`.

Die korrigierte Quelle mit SHA-256 `0cfc79d8da089f011ab7b5ec0e06e9e90dd952ae7a009a0a6a5f4c0b2f35def4` wurde direkt in einer neuen temporären PostgreSQL-Instanz geprüft. Sieben Prüfungen bestanden: SQL-Anwendung, Service-only-RPC und gesperrter privater Tabellenzugriff, NULL-/Format-/Negativwertsperren, leerer Export ohne Einzelauftragsnachweis, Stale-Alarm bei NULL/>3 Minuten, genaue Anzahl sowie nichtleerer Ack mit Digest der jeweiligen Request-ID, Erhalt der alten Alarmfelder und fehlender Singleton. Beleg: `2026-10-02T10-03-19-313Z-runtime-monitor-local-review.json` im selben Belegbereich.

## Notification-Header

`supabase/migrations/20261002095721_account_deletion_notification_auth.sql`, SHA-256 `c2ae481e3dafd71d5addcb2ea3cebfa526f845bb07dcf37539b754b20cb887f8`, wurde gegen die fünf privat gesicherten Originalfunktionen geprüft. Deren Rohtexte und enthaltene historische Zugangswerte wurden nicht ausgegeben oder in öffentliche Belege kopiert.

Sieben Prüfungen bestanden: Alle fünf Originaldefinitionen treffen die genauen Gates; Drift jeder einzelnen Funktion bricht vor Helper-DDL ab; die Migration ist syntaktisch anwendbar; PUBLIC, anon, authenticated und service_role dürfen den privaten Header-Helper nicht ausführen; fehlende, NULL- und zu kurze Tokens sperren; alle fünf lokalen Senderpfade erzeugen ohne Token keine HTTP-Anfrage und setzen die beiden geplanten Sender nicht auf `sent`; ein ausschließlich synthetischer Token erzeugt fünf lokale Stub-Aufrufe mit genau einem `Bearer`-Präfix. Beleg: `2026-10-02T10-06-04-160Z-notification-auth-local-review.json`.

## Runtime

Der Hauptagent hat den Erfolgsreset nach den geprüften Heartbeat verschoben. Genau ein neuer isolierter Fehlerfall prüfte die eingefrorene Runtime mit SHA-256 `0f0085d296dcc72b53268a7f6e75a0a032ad19dce9f488d5b2d3e1006819684f`. Instrumentierte echte temporäre Datei-/Verzeichnis-fsync und Readback erfolgten vor dem gemockten Heartbeat. Sein Fehler erhöhte die vorherige Fehlerzahl von drei auf vier, erhielt den letzten erfolgreichen Sync-Zeitpunkt und schrieb den Fehlerstatus durabel. Der leere Export blieb bei Ack 0 und `confirmedEntryEvidence=false`. Vier Prüfungen bestanden. Beleg: `2026-10-02T10-07-33-933Z-runtime-heartbeat-failure-local-review.json`.

Die anschließende rein lesende Installationsprüfung bestätigte im vorhandenen `runtime-20261002`-Verzeichnis die exakte Bytegleichheit von Runtime und Registry-Writer mit dem Repository, Modus 0600 und `cloudHeartbeat=true` in der bestehenden Produktionskonfiguration. Der Reviewer änderte keine installierte Datei, startete keinen Prozess neu und las keinen Produktionsregisterinhalt. Beleg: `runtime-installed-parity-review.json`.

Diese Prüfungen belegen die neuen lokalen Komponenten und die bestehende Installationsparität. Den aktuellen produktiven Cron-/Relayzustand und die produktiven Migrationseinträge belegt der Hauptagent separat. Die globale, einen physischen Restore überdauernde REST/Auth/Storage/Realtime/Edge-Sperre bleibt eine eigene offene Anbieter-Voraussetzung; der Cloud-Heartbeat ersetzt sie nicht. Die konkrete Rückfrage wurde im vorhandenen Supabase-Verlauf SU-492245 gestellt, siehe `deletion-restore-ingress-gap-20261002.md`.
