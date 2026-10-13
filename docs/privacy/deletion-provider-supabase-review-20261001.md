# Supabase, Logs und Storage/CDN – Fallprüfung vom 01.10.2026

**Ergebnis: `backups`, `external_logs` und `storage_cdn` bleiben für Fall B offen.** Die bereits bestandene Konto-/Originlöschung wird nicht wiederholt. Neu belegt sind **18 weiterhin aktive Auth-Auditzeilen mit UID und Test-E-Mail** sowie **479 externe Protokolle mit derselben UID**. Im Umfang dieser Supabase-Prüfung wurden keine Anbieterstände oder Produktionsdaten verändert. Das unabhängige Register und alle vorhandenen Belege bleiben erhalten.

Der aktuelle Fall ist QA `ggyonianphloycmqrwvj`, Auftrag `6434ecdb-7d04-482d-a709-fd991932c142`, Kontokennung `dafbeb6f-b0b1-42f7-82dd-1adbab279d6d`. Der Annahmezeitpunkt ist **01.10.2026 13:34:08.534569 UTC**; die Auth-Löschung wurde um **13:48:38.120306 UTC** protokolliert. Produktion `kwniiyayhzgjfqjsjcfu` wurde ausschließlich für ihre allgemeinen Einstellungen/Kataloge gelesen.

Hauptnachweis: [strukturierte Anbieterprüfung](../../output/deletion-completion-20260930/provider-supabase-review-20261001.json). Die SHA-256-Referenzen darin binden die neuen Einzelbelege. Alle SQL-Abfragen liefen über die bereits authentifizierte Management API mit `read_only:true`. Der Supabase-Connector verweigerte SQL/Logs; die vorhandene lokale Management-Authentifizierung und das Dashboard funktionierten. **Für diese Anbietergruppe ist keine Anmeldung nötig.**

## Fall- und Betriebsbestand

| Pflichtfall | Tatsächlicher Bestand und Bearbeitung | Frist / verbleibende Grenze | Handlung und Nutzerentscheidung |
| --- | --- | --- | --- |
| `backups` | Live-Katalog 15:37 UTC: **7 QA- / 8 Produktionsstände**, alle physisch und abgeschlossen, PITR aus. QA-Backup **1831779519**, 30.09. 23:24:17.655 UTC, liegt zwischen belegtem Signup und Löschung und ist damit ein konkreter betroffener Kandidat. | Sieben Tage Tarifentitlement, aber der älteste sichtbare Produktionsstand war **7,425 Tage** alt. Kein Maximum aller Kopien. Bestehende Auditzeilen können in späteren Backups erneut enthalten sein. | Katalog pro Fall fortführen, Auditrest behandeln und tatsächlichen Auslauf aller betroffenen Stände nachweisen. Register bis zur Endbedingung erhalten. Anbieterklärung ist vorbereitet; Versand braucht Auftrag. |
| `external_logs` | **18 aktive `auth.audit_log_entries`** und **479 externe UID-Treffer**. Keine aktuellen konfigurierten Log-Drains in QA/Produktion. | Externe Logaufbewahrung: sieben Tage als Tarifwert. Kein belegter Sieben-Tage-Autopurge der SQL-Audittabelle. Interne Anbieter-/Traffic-/Sicherheitskopien haben hier keine belegte maximale Einzelfallfrist. | Exakte Auditaktion mit 18 IDs/Hashes und Vor-/Nachprüfungen vorbereitet, nicht ausgeführt. Externe Protokolle bis zur tatsächlich belegten Entfernung weiterführen. Entscheidung über die gezielte QA-Auditbereinigung; Anbieteranfrage nur auf Auftrag senden. |
| `storage_cdn` | Genau ein markiertes 68-Byte-Testbild. Originentfernung und gezielter Purge waren im echten Worker erfolgreich. Aktuelle unveränderte Original-URL liefert erneut **400 / `CF-Cache-Status: BYPASS`**, Edge TXL, 15:43 UTC. | Upload `cacheControl=3600`. Anbieter dokumentiert bis 60 Sekunden Edgeinvalidierung, Browser-/Nativekopien separat. Keine universelle Kopienabwesenheit. | Keine erneute Dateilöschung und kein Bucket-Purge erforderlich. Exakte Clientkopien/Downloads und interne Storagekopien klären; unbekannte Kopien halten den Pflichtfall offen. |

## Datenbankbackups

Der live abgerufene [Backupkatalog](../../output/deletion-completion-20260930/provider-supabase-backup-catalog-20261001.json) enthält diese QA-Stände:

| ID | Katalogzeitpunkt UTC | Zuordnung zum Fall |
| --- | --- | --- |
| 1774846878 | 24.09.2026 23:27:27.096 | Vor dem belegten Signup |
| 1784352481 | 25.09.2026 23:26:06.433 | Vor dem belegten Signup |
| 1793823822 | 26.09.2026 23:25:33.801 | Vor dem belegten Signup |
| 1803268385 | 27.09.2026 23:25:14.896 | Vor dem belegten Signup |
| 1812753257 | 28.09.2026 23:24:35.498 | Vor dem belegten Signup |
| 1822288727 | 29.09.2026 23:27:52.143 | Vor dem belegten Signup |
| **1831779519** | **30.09.2026 23:24:17.655** | **Nach Signup, vor Löschung; betroffener Kandidat** |

Das Signup ist am 30.09. 16:09:42.751888 UTC in der exakt zugeordneten Auth-Auditzeile dokumentiert. Der Inhalt dieses Backups wurde **aus der Zeitlage abgeleitet**, nicht durch einen erneuten Restore untersucht. Die abgeschlossene Restore-/Registerprüfung wird nicht wiederholt. Fehlende ältere Katalogeinträge sind kein Nachweis physischer Entfernung sämtlicher interner Kopien. Neue Backups nach dem Auth-DELETE sind wegen der 18 Auditrestzeilen ebenfalls zu berücksichtigen; minimale Löschbelege und das notwendige Register haben einen gesonderten Zweck.

Die [offizielle Backupdokumentation](https://supabase.com/docs/guides/platform/backups) trennt Datenbank-/Storage-Metadaten von Storage-Dateiobjekten: Ein Datenbankrestore stellt gelöschte Dateiobjekte nicht wieder her. Der Betreiberbeleg zur Abwesenheit eigener externer regulärer Backups/Exporte bleibt unverändert gültig; das unabhängige minimale Löschregister ist keine solche Nutzerdatenkopie.

Die [aktuelle DPA, Version 1 vom 01.08.2026](https://supabase.com/legal/customer-resources/data-processing-addendum) beschreibt separate interne Audit-/Traffic-/Observability-Protokolle und unabhängige Backups. Ziffer 11.2 regelt ein 30-Tage-Rückgabefenster **nach Vertragsende** und anschließende Kopienlöschung; daraus entsteht keine 30-Tage-Einzelfallfrist bei fortgesetzter Nutzung. `backup_window_days` bleibt `NULL`.

## Aktive und externe Protokollkopien

Die [Live-Vorprüfung](../../output/deletion-completion-20260930/provider-supabase-audit-preview-20261001.json) bestätigte um 15:44 UTC alle **18 IDs und Vollzeilen-SHA-256** unverändert. 14 Zeilen tragen die Kontokennung als `payload.actor_id` und die Testadresse als `actor_username`; vier Adminereignisse tragen sie als `payload.traits.user_id` / `user_email`. Die Ereignisse umfassen zehn Logins, einen Logout, drei Recoveryanforderungen, einen Signup, zwei Änderungen und eine Löschung. Das dedizierte `ip_address`-Feld ist bei diesen 18 Zeilen leer. Keine Aussage wird daraus über externe IP-Protokolle abgeleitet.

Die [Auth-Auditdokumentation](https://supabase.com/docs/guides/auth/audit-logs) benennt externe Speicherung und zusätzliche optionale Postgres-Speicherung ausdrücklich als getrennte Bestände. Keine direkte Auditbereinigungs-Cron wurde in QA oder Produktion gefunden; indirekte oder interne Anbieterjobs sind damit nicht ausgeschlossen. Die bestehende eigene Sieben-Tage-Diagnosepolicy ist ein Betreiberauftrag, keine bereits nachgewiesene automatische Tabellenbereinigung.

Die externen Logs wurden vollständig für das 24-Stunden-Fenster **30.09. 15:40 bis 01.10. 15:40 UTC** aggregiert; es beginnt vor dem Signup. [Exakte Zuordnung](../../output/deletion-completion-20260930/provider-supabase-logs-attribution-20261001.json):

| Quelle | Exakte UID-Treffer | Nur gemeinsame Test-E-Mail ohne UID |
| --- | ---: | ---: |
| Auth-Audit | 18 | 0 |
| Auth | 33 | 0 |
| API-Gateway | 402 | 0 |
| Function HTTP | 17 | 0 |
| Postgres | 1 | 0 |
| Storage | 8 | 0 |
| **Gesamt** | **479** | **0** |

Die Adresse ist zugleich die weiter genutzte Supportadresse; E-Mail-only-Treffer würden keine sichere Einzelfallzuordnung erlauben. Die UID kann auch in administrativen SQL-Prüfungen, Pfaden oder Anfrage-Metadaten stehen. Die Zahl bezeichnet Kopien mit dieser Kennung, keine Zahl unabhängiger Nutzeraktionen. Es wurden nur Aggregate exportiert. Die [17 Function-HTTP-Treffer](../../output/deletion-completion-20260930/provider-supabase-function-logs-20261001.json) gehören alle zu `request-account-deletion`, jeweils mit genau dieser Request-Subjektkennung und vorhandenen IP-Feldern; IP-Werte wurden nicht exportiert. Kein Pushsender erscheint in diesem UID-gefilterten Satz. Das schließt Server-Sends ohne UID-Metadatum nicht aus. Der letzte Treffer im begrenzten Fenster war 13:52:02 UTC; nachfolgende gezielte Prüfungen einschließlich des URL-Aufrufs um 15:43 UTC können weitere Logs erzeugen. Dieser Zeitpunkt ist deshalb **kein garantierter letzter Eingang**.

[Entitlements](../../output/deletion-completion-20260930/provider-supabase-entitlements-20261001.json): aktuelle Pro-Organisation bestätigt `log.retention_days=7` und `backup.retention_days=7`. Das authentifizierte Dashboard zeigte für beide Projekte nur Anbieter-Hinzufügen-Karten und keine konfigurierten Log-Drains. Die neue v2-Drains-API lieferte einen Organisationszugriffsfehler, keine leere Liste; die Nullfeststellung stammt deshalb vom Dashboard. Historische entfernte Drains und fremde Exportkopien sind nicht durch diese aktuelle Anzeige ausgeschlossen.

[Katalogprüfung](../../output/deletion-completion-20260930/provider-supabase-drains-storage-20261001.json): QA keine Replikationsslots, Produktion ausschließlich zwei Supabase-Realtime-Slots; beide keine PostgreSQL-Subscriptions. Ein breiter Cron-Suchtreffer in QA ist nach Prüfung `family-subscription-rechecks` für `reconcile-family-subscriptions`, kein Export. In der gezielten Katalogprüfung wurde keine Exportcron erkannt. Die aktualisierte Logabfrage nutzt den [aktuellen `logs`-Endpunkt](https://supabase.com/docs/reference/api/v1-get-project-logs); `logs.all` ist seit 23.09.2026 entfernt.

## Konkrete vorbereitete Auditaktion

[Lesende SQL-Vorprüfung](../../output/deletion-completion-20260930/provider-supabase-audit-preview-20261001.sql) und [gezielter Aktionsentwurf](../../output/deletion-completion-20260930/provider-supabase-audit-action-prepared-20261001.sql) enthalten ausschließlich die 18 nachgewiesenen IDs und ihre SHA-256. Der Entwurf prüft den QA-Ursprung, den existierenden Fall B, Anzahl, exakte UID-Zuordnung und Vollzeilenhash; Abweichungen führen zum Abbruch. Die Nachprüfung verlangt null verbleibende exakt zugeordnete Zeilen und einen unveränderten Digest aller übrigen Auditzeilen. Er endet absichtlich mit `ROLLBACK` und wurde nicht ausgeführt.

Bei beauftragter Bereinigung sind nur diese QA-Auditzeilen zu entfernen, sofern keine konkret begründete Aufbewahrungsausnahme vorliegt. Die 90-Tage-Regel für minimale Abschlussbelege ist kein Grund, die vollständigen Authprotokolle so lange zu behalten. Falls eine Ausnahme gewählt wird, sind Zweck, tatsächliches Enddatum und wöchentliche Prüfung ausdrücklich zu dokumentieren. Das Löschen dieser SQL-Zeilen entfernt weder externe Logs noch Backups. Registry, Belege, fremde Auditzeilen und Produktionsdaten bleiben erhalten. Kein neuer Worker-/Geräte-/Restoretest ist dafür erforderlich.

## Storage/CDN und Clientkopien

[Exakte URL-Prüfung](../../output/deletion-completion-20260930/provider-supabase-cdn-read-20261001.json): Bucket `community-images`, Pfad `avatars/avatar_dafbeb6f-b0b1-42f7-82dd-1adbab279d6d_native-deletion-20261001.png`. Der live minimale Objektbeleg hält `removed_at=13:48:30.965596 UTC`. Der geprüfte Worker markiert das Objekt erst nach Originabwesenheit und erfolgreicher Antwort des exakten Cachepurges als entfernt. Aktueller URL-Status und Workerbeleg sind konkrete abgeschlossene Teilschritte, keine Bestätigung sämtlicher Browser-/Nativekopien.

[Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn) und [Cache-Purge](https://supabase.com/docs/guides/storage/cdn/purge-cdn-cache) dokumentieren bis zu 60 Sekunden Verteilung der Invalidierung. Die 3600 Sekunden im Upload betreffen Clientcache-Frische, keine garantierte physische Entfernung aus Offline-/Nativecaches oder Downloads. Unbekannte Clientkopien bleiben offen. Die Geräteabnahme enthält keine separate vollständige Cacheinventur; sie wird nicht als solche umgedeutet. Ein pauschales Appreset oder fremde Cacheentfernung ist nicht vorbereitet.

## Anbieterklärung – vorbereitet, nicht versandt

Adressat: Supabase-Support aus der bestehenden Organisation `xqbmotyjxjdeqoisbgow`. Gegenstand: Einzelkontolöschung bei fortgesetztem Pro-Betrieb, ohne Projektlöschung oder Tarifwechsel.

1. Welche physischen Sicherungen, WAL-/internen Replikat- und Snapshotkopien können Daten dieses QA-Zeitfensters wiederherstellen, über den sichtbaren Tageskatalog hinaus? Wie lässt sich die tatsächliche Entfernung des Backupkandidaten 1831779519 und späterer Auditrestkopien nachweisen? Bitte keine bloße Wiederholung des Sieben-Tage-Tarifwerts.
2. Welche Aufbewahrungs-/Löschbedingungen gelten für die internen Auth-/Gateway-/Security-/Traffic- und Observabilitykopien nach Einzelnutzerlöschung, welche Ausnahmen bestehen, und gibt es fallbezogene Löschbestätigungen? Die 18 lokalen SQL-Auditzeilen und externen Protokolle sind ausdrücklich getrennt.
3. Welche internen Storagekopien bleiben nach DELETE und bestätigtem exaktem CDN-Purge, außerhalb clientseitiger Kopien, und welche belegbare Endbedingung gilt dafür?

Die Anfrage ist ein Dokumententwurf. Sie wurde weder an Support gesendet noch in einem Anbieterticket angelegt. Vorgeschlagene nächste Betreiberprüfung: **02.10.2026, 08:00 UTC**; reine Wiedervorlage, keine garantierte Löschfrist. Kein Kalender-/Automationsauftrag wurde erzeugt; der Termin ist nicht vereinbart oder eingeplant (`reviewScheduled=false`). Die bestehende tägliche Betreuung bleibt maßgeblich.
