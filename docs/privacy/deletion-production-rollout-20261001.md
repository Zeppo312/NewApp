# Aktuelle Fortschreibung – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Ausführung am 02.10.2026: ausgeschalteter Produktionsstand erreicht

Die neun aktuellen Kernmigrationen einschließlich Consent-Inventar wurden gezielt angewendet. Dazu kamen drei separat geprüfte Korrekturen für Cloud-Heartbeat, interne Notificationauth und RLS/Search-path. Historische Migrationen blieben unverändert. Die drei Löschfunctions und zwölf bestehende Schutzpfade wurden aus isolierten Quellen deployed und frisch zurückgelesen; kein Gesamtarbeitsbaum-Deployment.

Produktions-SMTP und separate RevenueCat-Rechte sind eingerichtet; echte Testmail, externer Cloud-Stale-Alarm und Wiederanlauf des vorhandenen Writers sind belegt. Annahme/Worker bleiben aus; kein Löschcron und kein Produktionsaccount gelöscht. Jans fachliche supervised-/Consent-Policy ist gespeichert, `approved_fingerprint/by/at` weiterhin NULL.

Nächste Aktivierungsfolge: erst projektweiten restorefesten Control-Plane-Hold verbindlich integrieren (SU-492245), dann ausdrücklich freigegebenen vorhandenen eigenen Produktionsfall mit nichtleerem dauerhaftem Register-Ack und Wiederanlauf nachweisen. Danach neue Katalog-/Quellenprüfung, tatsächliche technische Abnahme Jan/Zeit/Fingerprint und kontrollierte Annahme-/Workerprüfung. Consent-Rollout bleibt aus. Der erhaltene alte Acht-Quellen-/Vorbereitungsstand ist keine neue Deploymentanweisung.

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Gezielte Produktionsbereitstellung – vorbereiteter Stand vom 01.10.2026

Dieser Plan beschreibt die kleinste isolierte Bereitstellung des Löschbetriebs. Er ist vorbereitet und lokal geprüft; er ist keine ausgeführte Produktionsänderung. Die native QA mit tatsächlichem Worker und die anschließende QA7/8-Abnahme samt echtem externem Register-Neustart sind inzwischen bestanden. Produktion wurde nicht verändert. Keine neuen Projekte, Konten, Tarife oder kostenpflichtigen Tests sind Bestandteil dieses Plans.

## Ziel und belegter Ausgangsstand

| Gegenstand | Gelesener Stand am 01.10.2026, 12:16:25 UTC |
| --- | --- |
| Produktion | `kwniiyayhzgjfqjsjcfu`, Organisation `xqbmotyjxjdeqoisbgow`, `eu-central-1`, `ACTIVE_HEALTHY`, PostgreSQL 15.8 |
| Löschschema | `deletion_private` fehlt; die vorgesehenen Löschmigrationen sind nicht registriert. |
| Bestehender Zugriffshook | Kein `pgrst.db_pre_request`; andere Authenticator-Einstellungen bestehen und werden nicht ersetzt. |
| Legacy-RPC | `public.delete_user_data(boolean)`, Eigentümer postgres, bisher `SECURITY DEFINER`; der exakte Body und die ACL sind privat gesichert. |
| Geprüfte Spalten | Sieben neue Akteursspalten bereits nullable UUID; `direct_messages.receiver_id` bisher `NOT NULL`. |
| Schutzinventar | 118 tatsächliche Tabellenziele; Migrationen enthalten 136 Lösch-/Referenzregeln. Tabelle, Regel und freier personenbezogener Inhalt bleiben verschiedene Prüfgegenstände. |

Der Baseline-Nachweis liegt privat unter `.family-qa/deletion-production-preparation-20261001/fresh-baseline.local.json`. Vor einer Ausführung müssen Konto, Ziel, Katalog, Migrationshistorie, Funktionsquellen und Scheduler erneut gelesen werden. Ein veralteter Snapshot darf keine frische Produktionsänderung rechtfertigen.

`scripts/prepare-deletion-production-rollout.cjs` nimmt keine Argumente an und hat keinen Apply-/Enable-Befehl. Es erzeugt ausschließlich lokale SQL-Vorbereitung und den Nachweis `output/deletion-completion-20260930/production-rollout-prepared-20261001.json`. Exakte SHA-256-Werte jeder Quelle und der gesamten SQL-Datei stehen darin.

## Reihenfolge der ausgeschalteten Bereitstellung

1. Erledigten QA-Nachweis und die Wiederherstellung des ausgeschalteten Betriebs heranziehen: `native-backend-final-test-20261001.json`, `qa-seven-eight-verification-20261001.json` und `qa-durable-registry-runtime-20261001.json`. QA wurde erst nach Geräteprüfung auf acht Migrationen erweitert; keine zusätzlichen echten Konten wurden erzeugt. Der verbleibende eigene Auftrag steht wegen offener Anbieterbelege korrekt auf `needs_attention`.
2. Produktionskonto und Org über den vorhandenen korrekten CLI-/Management-Zugang abgleichen. Exakte aktuelle DDL, Legacy-RPC, ACL, Hookkonfiguration, Lösch-/Cronkatalog und alle zu ändernden Function-Bundles privat sichern. Nur Quell-/Konfigurationssicherung, kein Kunden-Rohdatenexport. Sicherheits-/Performance-Advisors vorher festhalten und nachher Änderungen vergleichen.
3. `ACCOUNT_DELETION_ENABLED=false` serverseitig setzen bzw. den ausgeschalteten Wert verifizieren. Vorhandene Lösch-/Alarmscheduler zuerst als inaktiv belegen. Kein QA-Testkonto-Env nach Produktion übernehmen. Cron-Secret darf nur in einem geschützten serverseitigen Secret Store liegen; keine Schlüssel in SQL-Dateien, Befehlsargumenten oder Nachweisen ausgeben.
4. Die acht exakten Migrationen in einem bewachten SQL-Lauf bereitstellen und nur diese Quellen in derselben Transaktion registrieren. Kein breites `supabase db push`. Die lokale Datei ist `.family-qa/deletion-production-preparation-20261001/stage-eight-migrations.local.sql`; ihre SHA-256 ist im Manifest gebunden. Das alte private Sieben-Migrationen-Artefakt ist überholt.
5. Quellenisolierte neue Functions `request-account-deletion`, `process-account-deletion`, `account-deletion-alert` aus den einzeln heruntergeladenen und mit dem getesteten QA-Stand verglichenen Bundles bereitstellen. Jede verwendet `verify_jwt=false`, prüft aber selbst das Benutzer-Token bzw. Cron-Secret; diese Einstellung ist kein anonymes Löschrecht. `ACCOUNT_DELETION_ENABLED` bleibt false.
6. Notwendige Service-Role-Zugriffssperren einzeln aus aktuellen Produktionsbundles vorbereiten/prüfen/bereitstellen. Nach jedem Upload frisch herunterladen und alle Dateien gegen den geplanten Stand vergleichen. Unabhängige aktuelle Änderungen müssen erhalten bleiben; bei Drift erneut vorbereiten. Der Arbeitsbaum enthält andere Featureänderungen und ist keine pauschale Produktionsquelle.
7. Effektive SQL-Bodies, Besitzer, ACL, RLS, Hook, 118 Guards, 136 Regeln, acht exakte Historienzeilen und Function-Quellen verifizieren. `account_deletion_readiness()` muss false bleiben; Freigabe, Fristen und Modus bleiben ungesetzt bzw. `unapproved`, Auftragsbestand leer, Scheduler inaktiv. Erneut Advisors lesen und neue Meldungen prüfen. Keine Nullabfrage als positiv zugestellten Alarm ausgeben.

Die SQL-Datei nutzt eine äußere Transaktion, Advisory-Lock, drei Sekunden Locktimeout und 30 Sekunden Statementtimeout. Vor dem ersten DDL prüft sie fehlendes Schema/History, Namenskollisionen, unveränderten Legacy-Body, Spalten und fehlenden bestehenden Hook. Danach prüft sie die ausgeschalteten Invarianten; jede Verletzung bricht den gesamten Lauf ab. Die originalen vollständigen acht Dateien werden als `statements` in der Historie registriert; keine pauschale Markierung anderer Arbeitsbaum-Migrationen.

| Reihenfolge | Migration |
| --- | --- |
| 1 | `20260911065615_account_deletion_jobs.sql` |
| 2 | `20260930055640_account_deletion_readiness.sql` |
| 3 | `20260930163849_account_deletion_alarm.sql` |
| 4 | `20260930170233_account_deletion_cdn_proof.sql` |
| 5 | `20261001051435_account_deletion_worker_aliases.sql` |
| 6 | `20261001094535_account_deletion_nullable_actor_rules.sql` |
| 7 | `20261001122517_account_deletion_supervised_provider_mode.sql` |
| 8 | `20261001124926_account_deletion_durable_registry.sql` |

Die erste Migration ersetzt die gefährliche Legacy-Implementierung durch eine harmlose Supportantwort mit `SECURITY INVOKER`. Die vorhandenen expliziten `anon`-/Service-Role-EXECUTE-Grants werden dadurch nicht stillschweigend entfernt; entscheidend ist der verifizierte neue nichtdestruktive Body. Worker, Readiness, Alarm sowie Registerexport/Ack dürfen ausschließlich Service-Rolle ausführen. Private Tabellen bleiben direkt gesperrt.

## Einzeln vorbereitete Function-Änderungen

Unter `.family-qa/deletion-production-preparation-20261001/live/` wurde jede von 14 Functions in einem eigenen Verzeichnis heruntergeladen. Die elf Zugriffsschutz-Kandidaten liegen unter `guard-candidates/<slug>/`; `guard-candidate-manifest.local.json` enthält Vorher-/Kandidatenhashes und die jeweiligen `prepared-change.patch` zeigen die einzelnen Änderungen.

| Functions | Kleinster geplanter Schutz |
| --- | --- |
| `advisor-generate`, `voice-log-parse`, `ask-lotti` | Aktiven Benutzer vor privaten Daten-/Premium-/KI-Zugriffen prüfen. Aktuelles Produktions-Premiumadapter-Verhalten erhalten; keine neue Familien-/Paid-Tabellenabhängigkeit übernehmen. |
| `send-partner-notification`, `send-planner-notification`, `send-baby-reminder-notification` | Betroffene Benutzer bzw. Partner vor Datenzugriff/Sendung prüfen. |
| `send-direct-message-notification`, `send-group-message-notification` | Absender und Empfänger prüfen; gesperrte Gruppenempfänger ausschließen. |
| `get-chat-audio-url`, `delete-chat-message` | Aufrufer vor privatem Medien-/Nachrichtenzugriff prüfen. |
| `revenuecat-webhook` | Gesperrte gültige Benutzerkennung nicht erneut mit Premiumdaten beschreiben; kein Anbieter-Löschbeleg aus einem übersprungenen Hook ableiten. |

57 TypeScript-Dateien wurden syntaktisch geprüft; 15 gezielte Prüfungen des aktuellen Premiumadapters/Zugriffsschutzes bestehen. Das ist noch keine vollständige Endpointabnahme der elf isolierten Produktionskandidaten. Vor Aktivierung müssen sämtliche relevanten Service-Role-Pfade und ihre Auth-/Empfängergrenzen abschließend geprüft sein. `moderation-review` benötigt diesen Abgleich ebenfalls; ein pauschales Ersetzen seines aktuellen Admin-Pfads ist nicht vorgesehen. `revoke-apple-token` muss für den eigenen notwendigen Anmeldewiderruf nutzbar bleiben.

Für OpenAI existiert zusätzlich ein separater `store-false-candidate/advisor-generate`: nur das Feld `store:false` in der aktuellen Produktionsquelle, acht Dateien insgesamt, sieben exakt unverändert. Drei tatsächliche Funktionsprüfungen mit synthetischem Fetch bestehen. Der Zugriffsschutz-Kandidat enthält ebenfalls dieses Feld, damit ein späterer Upload es nicht zurücksetzt. Der deployte `advisor-daily` ist deaktiviert und bleibt unverändert; der lokale abweichende Schwangerschafts-/Familienstand wird nicht mit ausgerollt. `store:false` bestätigt keine Löschung historischer Anbieterbestände.

## Voraussetzungen für die spätere Aktivierung

Der [beaufsichtigte Modus](deletion-supervised-provider-mode-20261001.md) erlaubt das unbekannte Wiederherstellungsmaximum ausdrücklich als `NULL`. Eine globale Aktivierung verlangt trotzdem konkret:

- Den aktuellen Katalog gegen jede Tabellen-, Eigentums-, JSON-/Freitext- und Medienregel prüfen; Jan als Freigeber, tatsächlichen Zeitpunkt und gewählten Modus dokumentieren. Erst dann den dazugehörigen Fingerprint setzen. Der Fingerprint umfasst Katalog, Constraints, Regeln, Storage-Origin und Modus; er bestätigt weder Anbieterfakten noch freie Inhalte, Policies oder Function-Versionen.
- Tatsächliches externes Registerverzeichnis außerhalb Repo/Supabase bestimmen, geschützte Service-Credential-Versorgung und regelmäßige Writer-Ausführung einrichten. Erstschreiben, Dateirechte, exakten Readback, Ack, Neustart/Reconciliation und Verhalten bei Writerausfall konkret nachweisen. Der vorhandene Kandidat läuft einmalig; es ist noch kein dauerhafter Produktionsprozess installiert. Root muss diesen verbleibenden technischen Schritt ausführen, bevor ein echter Auftrag destruktiv verarbeitet wird.
- Wiederherstellungsverfahren: vor jeglichem Anwendungseintritt den externen Registerstand abgleichen und Sperren/Löschungen erneut anwenden. Ein aus der Sicherung restauriertes Ack darf diesen unabhängigen Abgleich nicht ersetzen. Vorhandene externe Einträge bei einem leeren/älteren Restore erhalten. Der bestandene einmalige Test bleibt abgeschlossen.
- Betriebsprüfung `scripts/account-deletion-check.mjs` ist inzwischen lokal an ausgewählten Modus und Registerbarriere angeglichen; acht Tests und der unabhängige Review bestehen. Nach Bereitstellung ihren tatsächlichen Zielstand erneut lesen: unbekannte oder positive fehlende Acks blockieren den Konfigurationsnachweis. Produktionsfreigabe und tatsächlicher externer Pfad-/Writerbeleg bleiben stets gesonderte, bisher unbestätigte Nachweise.
- Produktions-SMTP und separaten RevenueCat-Schlüssel mit den nötigen Kunden-Löschrechten serverseitig konfigurieren; einen tatsächlichen Alarmempfang bei support@lottibaby.de und deduplizierten Wiederanlauf belegen. Kein QA-Provider-Schlüssel nach Produktion kopieren. Providerpasswörter nur im passenden Secret Store, nicht in Quell-/Testnachweisen.
- Native Ergebnisse, Zugangssperren, Schreibbarrieren, lokale Cachebereinigung und vollständige Workerphasen für die tatsächlich vorhandenen Wegwerfdaten sauber nachweisen. Gerätefolge und unterschiedliche Auftrags-IDs korrekt dokumentieren; keine angenommene Plattformabnahme aus Builds oder abgelehnter Wiederanmeldung ableiten.
- Pflichtanbieter-/Shared-Content-Fälle täglich betreuen. `completed` ausschließlich mit tatsächlichem Fallnachweis; unbekannte Aufbewahrung bleibt offen. `receipt_retention_days=90`, Modus `supervised`, unbekanntes `backup_window_days=NULL`; keine falsche automatische Belegbereinigung.

Erst nach diesen Nachweisen kann der Betreiber die globale Annahme-/Workerfreigabe und geschützte wiederkehrende Aufrufe aktivieren. Scheduler/Vault-Namen müssen das konkrete Ziel eindeutig binden und vor Aktivierung geprüft werden; dieser Kandidat erzeugt keine Cronjobs oder erfundenen Secretreferenzen.

## Rollback und Testgrenze

Vor SQL-Commit bedeutet eine Abweichung vollständiges `ROLLBACK`. Eine Datenbank-Migration und ein Function-Upload sind keine gemeinsame Transaktion: Uploads einzeln verifizieren und bei Fehlern den gesicherten isolierten vorherigen Bundle-Stand zurückspielen. Nach ausgeschaltetem Staging bleibt `ACCOUNT_DELETION_ENABLED=false`; Schema und harmlose Legacy-Antwort dürfen stehen bleiben. Die alte destruktive Legacy-RPC wird nicht wieder geöffnet.

Sobald echte Aufträge angenommen wurden, bei Fehlern zuerst neue Annahme und Scheduler stoppen, laufende Leases kontrolliert bearbeiten und bestehende Sperren, Aufträge sowie externes Register erhalten. Kein Datenbankreset, keine pauschale Kontolöschung und kein Wiederherstellen alter freier Zugänge. Eine Wiederherstellung benötigt immer Isolation und Register-Replay.

Belege: elf Modus-Tests, zwölf Registertests, 19 ursprüngliche SQL-Regressionsfälle mit acht Migrationen und vier atomare Stagingtests bestehen. Alle 46 wurden nach der ausdrücklichen Lease-/Deadline-Korrektur in einem Lauf erneut bestanden. Die Stagingtests bewahren synthetische Auth-/Profildaten und fremde Nachrichten und prüfen drei Driftabbrüche ohne Teil-DDL/Historieneintrag. Die Prüfung enthält keine Kundenlöschung, keinen echten Produktionsregisterexport und keine Livebereitstellung. Belegdateien: `supervised-provider-mode-preparation-20261001.json`, `durable-registry-preparation-20261001.json`, `production-staging-tests-20261001.json`, `production-function-guards-preparation-20261001.json` und `openai-production-storage-preparation-20261001.json` unter `output/deletion-completion-20260930/`.


## Frische Vorprüfung 02.10.2026 – zusätzliche Inventarbedingung

Produktion ist aktuell erreichbar, besitzt weiterhin kein `deletion_private`, keine acht Lösch-Historienzeilen, keine drei Löschfunctions, keinen Löschcron und keinen Zugriffshook. Lösch-Enable-, Cron-, RevenueCat-Lösch- und Alarm-SMTP-Secrets fehlen. Es wurde nichts bereitgestellt oder aktiviert.

Seit dem oben datierten Baseline-Lauf ist `20261001170732_data_consent_records` in der Produktionshistorie vorhanden. Das live bestätigte Schema `consent_private` enthält sechs Tabellen, davon vier mit `user_id` und Auth-CASCADE-FKs (`user_state`, `decisions`, `operations`, `events`). QA besitzt dieses Schema nicht. Die 118 ursprünglichen Guard-Ziele bleiben numerisch gleich, weil deren Schemafilter und der vorbereitete Fingerprint `consent_private` ausschließen. Eine unveränderte Zahl ist daher keine vollständige Inventargleichheit.

Vor jeder später ausdrücklich beauftragten Bereitstellung diese Relationen für Konto-/Datenreset, Zugang-/Schreibsperren und Belegaufbewahrung klassifizieren sowie aktuelle Bundles und Kataloge neu vergleichen. Die vorhandenen Auth-CASCADE-FKs beweisen keinen vollständigen Datenreset. Das alte bewachte SQL und dessen Tests werden weder ausgeführt noch aufgrund alter Snapshots erneut freigegeben. [Aktueller Katalog und Nachweise](deletion-current-status-20261002.md#produktion-frischer-stand-und-zusätzliche-inventarprüfung).


## Produktions-Einzelauftrag 02.10.2026 – vor Änderung abgebrochen

Dieser Auftrag erlaubte die hier beschriebene gezielte Bereitstellung ohne Aktivierung. Der frische Quellen-/Katalogvergleich bestätigt jedoch die zusätzliche Consent-Inventarlücke: vier Nutzerrelationen bleiben außerhalb Regeln, Schutzloop und Fingerprint. Deshalb wurde das alte Staging-SQL **nicht ausgeführt**. Alle acht vorbereiteten SQL-Hashes, elf Produktions-Function-Basen samt Guard-Kandidaten und drei frisch heruntergeladenen QA-Bundles stimmen mit den Manifesten überein; die Lücke betrifft die Abdeckung des inzwischen erweiterten aktuellen Katalogs.

Aktuelle DDL/ACL, Hooks, Scheduler und Function-Konfiguration sind privat gesichert; 14 tatsächliche Produktionsbundles isoliert heruntergeladen. Die historischen optionalen Labels `moderation-review` / `revoke-apple-token` sind durch den frischen Katalog als `moderation-report-notify` / `revoke-apple-sign-in` korrigiert, ohne Function-Änderung. `ACCOUNT_DELETION_ENABLED` fehlt weiterhin; kein explizites false nach dem Driftabbruch gesetzt. Modus/Freigabe ungesetzt, neue Pipeline und Löschscheduler fehlen; alte destruktive `delete_user_data`-RPC und fehlendes live `store:false` sind ausdrücklich noch nicht korrigiert.

Produktionskatalog, Auth-Hooks, Secrets, Function-Metadaten und Scheduler unverändert; Abschlussstatus `ACTIVE_HEALTHY`, keine neuen Advisorbefunde. Kein Function-Rollback nötig. Vor erneutem Staging Consent-Reset-/Retry-/Belegregeln entscheiden und die eng begrenzte Vorbereitung korrigieren, ohne historische acht Quellen zu überschreiben. [Vollständige aktuelle Klassifizierung und Restaufgaben](deletion-production-preflight-20261002.md).


## Register-Einzelauftrag 02.10.2026 – Macruntime installiert, Backend offen

Ein getrennter ausdrücklich erlaubter Registerauftrag hat die Macruntime mit externem Produktionsregisterpfad, sicherer Keychain-Versorgung und zwei wiederkehrenden LaunchAgents eingerichtet. Dieser Lauf hat **keine** der acht Migrationen, Löschfunctions, Hooks oder Secrets in Produktion geändert. Die Consent-Inventarlücke und ausgesetzte Bereitstellung bleiben offen. Export-/Ack-RPCs fehlen; alle echten Writerläufe sind blockiert und bestätigten keinen Auftrag.

Die lokale leere Erstdatei, Rechtsprüfung, automatische Starts und Prozessneustart sind echte Betriebsbelege; simulierte Ack-/Crash-/Reconciliationprüfungen sind ausschließlich neue lokale Supervisorbelege. Dauerhafter echter Produktionsauftragseintrag/Ack, ständig verfügbarer Server, tatsächliche Restore-Zugangsbindung und externe Alarmzustellung bleiben getrennt. Der Worker bleibt unaktiviert; keine Kontolöschung oder Wiederholung des Restoretests. [Neue Betriebsinstallation mit klaren Grenzen](deletion-production-registry-runtime-20261002.md).


## Consent-Einzelauftrag 02.10.2026 – aktualisierter Neun-Quellen-Kandidat

Die frühere Acht-Quellen-Vorbereitung bleibt unverändert als historischer Nachweis. Ein neuer separater Builder und additive Migration `20261002084629_account_deletion_consent_inventory.sql` schließen die vier Consent-Nutzerrelationen im **lokalen** Inventar, Guard- und Fingerprintkandidaten: 122 Guard-Ziele, 140 Regeln, neun exakt registrierte Quellen im atomaren SQL-Kandidaten. Vollständiger aktueller Produktionskatalog und Consent-Bodies sind vor dem ersten DDL gebunden; eine gleichbleibende Tabellenzahl reicht nicht. 16 gezielte lokale PostgreSQL-Prüfungen bestehen, bestehende Consent-Daten bleiben beim ausgeschalteten Staging erhalten.

Neue und alte Quellen/Nachweise nicht überschreiben oder die alte Ausführungsfreigabe umdeuten. Der heutige Auftrag erlaubt ausschließlich Vorbereitung. Für spätere ausgeschaltete Bereitstellung sind ein **neuer ausdrücklicher Neun-Quellen-Auftrag**, unmittelbar frischer Ziel-/Katalog-/Bundleabgleich, explizites Enable=false, inaktive Löschscheduler sowie vollständiger isolierter SQL-/Function-Readback erforderlich. Consent-Policy und beide Betriebsfreigaben bleiben `unapproved`/NULL; globale Consent-Einstellungen werden nicht aktiviert. Reset-/Belegentscheidungen, Produktionsregisterbetriebsbelege, SMTP/RevenueCat/Alarm, Edge-Abnahme und späterer Aktivierungsauftrag bleiben getrennt. [Consent-Inventar, Kandidat und genaue Restbedingungen](deletion-consent-inventory-20261002.md); [frischer Read und Abschluss](../../output/deletion-consent-inventory-20261002/2026-10-02T09-14-51-996Z/completion.json).
