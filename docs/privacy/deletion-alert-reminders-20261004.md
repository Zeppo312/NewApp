# Erinnerungsmails zu bekannten Anbieterfällen abgeschaltet – 04.10.2026

Auf Jans ausdrücklichen Auftrag werden die wiederkehrenden Erinnerungsmails für den unveränderten Anbieter-Nachbearbeitungsstand des vorhandenen QA-Falls und des eigenen Produktionsfalls unterdrückt. Dies betrifft ausschließlich `needs_attention` / `providers` / `provider_evidence_required`, gebunden an den jeweiligen Auftrag und seinen aktuellen Änderungszeitpunkt.

Die Änderung ist gezielt in QA und Produktion angewandt und in der Migrationshistorie erfasst. Beide bestehenden Alarmcrons liefen danach am 04.10. um **06:35 UTC / 08:35 Berlin** erfolgreich; ihre HTTP-200-Antworten enthalten `healthy=true`, **`sent=false`**. Der direkte authentifizierte QA-Handlerabruf bestätigt ebenfalls keinen Versand und die Ablehnung anonymer Aufrufe.

Die tatsächlichen Löschstände bleiben unverändert: je ein offener Auftrag, QA zehn und Produktion elf ausstehende Anbieteraufgaben. Hashvergleiche bestätigen unveränderte Aufträge, Anbieteraufgaben, Objektinventare, Ereignisse, Einstellungen, Workerquelle, Alarm-RPC-Berechtigungen und Cronkonfiguration. Die öffentlichen Löschwege wurden nicht aktiviert.

Neue Fälle, ein geänderter Auftragsstand oder andere Fehler werden weiterhin gemeldet. Registerausfall, überalterte Queue, abgelaufene oder überlange Leases, überfällige Aufbewahrung und fehlgeschlagene Statusabfragen bleiben technische Alarme. Die Quittierung ist kein Abschluss- oder Löschbeleg. Sie kann vom Betreiber durch Entfernung des betreffenden Eintrags aus `deletion_private.alarm_acknowledgements` aufgehoben werden.

Fünf isolierte PostgreSQL-Tests prüfen die gezielte Unterdrückung in beiden Schemafassungen, unveränderte Falldaten, erneute Alarmierung bei Änderungen/neuen Fällen, sämtliche technischen Zähler und den Schutz vor Nutzer-/Serviceclient-Quittierung. Alle fünf sind bestanden. Die Security-Advisors melden keine Befunde zu der neuen privaten Tabelle.

Nachweise und Vor-/Nachstände: [Ausführungsbelege](../../output/deletion-alert-reminders-20261004/). Umsetzung: [Migration](../../supabase/migrations/20261004062928_account_deletion_alarm_acknowledgements.sql), [Regressionstests](../../scripts/tests/account-deletion-alarm-acknowledgements.test.mjs).
