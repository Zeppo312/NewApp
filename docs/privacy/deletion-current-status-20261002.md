# Aktuelle Fortschreibung – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Gesamtstand nach Produktionsausführung

Die gezielte ausgeschaltete Produktionsbereitstellung ist abgeschlossen: neun Kernmigrationen und drei Betriebskorrekturen, 15 isolierte Functions/zwölf Schutzpfade, geprüfte ACLs/Schreibsperren/Consent/Legacy-RPC. Bestehender Writer verbunden und mit Cloudalarm überwacht; Produktions-Testmail UID138 und realer Stale-Alarm UID140 tatsächlich empfangen. Separate RevenueCat-Customers-only-Rechte vorhanden. Kein Produktionsaccount gelöscht, kein Workeraufruf, Annahme aus/Readiness false/Consent aus.

**Produktiver Löschweg für den nächsten Release noch nicht bereit.** Gate 1 – verbindliche allseitige restorefeste Isolation/SU-492245 – fehlt; Gate 2 – vorhandener eigener eindeutig freigegebener Produktionsaccount mit speichergebundenem nichtleerem Ack und Wiederanlauf – ist unbewiesen. Keine erneute allgemeine Freigabe erforderlich, nur diese konkreten Nachweise.

Zehn Provider-/Kopienfälle weiter `pending`; Shopify-Zugang gelöst, Convex-Appentfernung lokal fertig, historisches Laura-Team weiter unbekannt. 173 Originalbelege und drei unabhängige QA-Register unverändert. Alte Geräte-, QA-, Restore- und Replaytests sowie Audit-/OTPbereinigung nicht wiederholt.

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Lesende Bestandsprüfung – 02.10.2026

Aktuelle Abfragen: 06:17–06:23 UTC / 08:17–08:23 Europe/Berlin. Dies ist eine Bestandsprüfung und Dokumentationsfortschreibung. Der angekündigte Einzelauftrag fehlt noch. Produktionsänderungen, Aktivierung, Anbieteraktionen und Nachrichtenversand sind dadurch nicht freigegeben.

Gerätetests, tatsächliche QA-Kontolöschung, Restore/Register-Replay und QA-Register-Neustart bleiben abgeschlossen und wurden nicht wiederholt. Keine neuen Projekte, Konten, Builds, Tarife oder Dienste wurden angelegt. Das ursprüngliche `implementation.json` und die früheren Nachweise bleiben unverändert. Die sechs eingelesenen Fassungen sind zusätzlich unter [prior-inputs](../../output/deletion-status-20261002/prior-inputs/) erhalten.

## QA-Fall B und unabhängiges Register

| Gegenstand | Frisch belegter Zustand | Grenze |
| --- | --- | --- |
| Auftrag `6434ecdb-7d04-482d-a709-fd991932c142` | `needs_attention`, Phase `providers`, keine Lease, kein Abschlusszeitpunkt | Annahme/Workerabschluss wird nicht erneut getestet. |
| Anbieterzeilen | 1 `completed` (RevenueCat), 1 `not_applicable` (Apple-Anmeldewiderruf), 10 `pending`; Projektion samt Belegen unverändert zum letzten Kontrollpunkt | Keine neue Fallauflösung. Der bestehende RevenueCat-Beleg betrifft nur den aktiven Kundenbestand. |
| QA-Betrieb | `ACCOUNT_DELETION_ENABLED=false`; Modus `unapproved`; Freigeber, Datum, Fingerprint und Fristen `NULL`; Workercron aus, Alarmcron an | Readiness wurde in diesem Lauf nicht durch einen erfolgreichen RPC bestätigt. Einstellungen und Secret-Digest belegen keine Aktivierungsfreigabe. |
| QA-Bestand | 8 Auth-Konten insgesamt, 0 für die exakt gelöschte Fallkennung, 0 Fallprofile, 0 Storageobjekte, 1 Löschauftrag | Am früheren Kontrollpunkt waren es 6 Auth-Konten. Die zwei zusätzlichen Konten sind kein Ziel dieses Auftrags; Herkunft und Gleichheit aller fremden Inhalte werden aus der Anzahl nicht abgeleitet. |
| Externes Register | Beide zuvor dokumentierten Registerdateien mit unveränderten Hashes; `0600`, Elternverzeichnisse `0700`, reguläre Dateien ohne weitere Hardlinks. Datenbank-Ack entspricht dem Digest des vorhandenen dauerhaften Eintrags | Kein Writer, Export/Ack, Claim oder Neustarttest ausgeführt. Kein Produktionsregister belegt. |

[Aktueller QA-Fall](../../output/deletion-status-20261002/qa-case-current.json), [richtige Secret-Namen und reine Vorhandenseinsprüfung](../../output/deletion-status-20261002/qa-case-and-required-secrets.json), [Erhalt und exakter Projektionsvergleich](../../output/deletion-status-20261002/preservation-before-document-update.json).

## Anbieterübersicht: aktueller Nachweis und unbekannte Kopien

Die zwölf Datenbankstatus bleiben unverändert. Die folgende Prüfung ergänzt einzelne Bestände; sie ersetzt keinen Nachweis der Abwesenheit aller Kopien.

| Pflichtfall | Stand dieser Prüfung | Nächster konkreter Schritt / offene Voraussetzung |
| --- | --- | --- |
| Supabase `external_logs` | Alle 18 zuvor gebundenen Audit-IDs und Vollzeilenhashes sind aktuell unverändert; insgesamt weiterhin 18 exakt UID-bezogene Auditzeilen. Die früheren 479 externen Logtreffer stammen aus dem Fenster 30.09. 15:40–01.10. 15:40 UTC und wurden hier nicht neu gezählt. | Einzelauftrag für gezielte QA-Auditbereinigung oder konkret begründete befristete Aufbewahrung fehlt. Externe und interne Logs bleiben getrennt offen. |
| Supabase `backups` | 7 QA-/8 Produktionsbackups sichtbar, PITR aus. QA `1831779519` bleibt sichtbar. **Neu: `1841321535`, 01.10. 23:26:18.089 UTC**, nach Auth-Löschung, bei davor und danach belegten aktiven Auditkopien. Deshalb zusätzlicher Kandidat für Auditrestkopien; Inhalt nicht per Restore geprüft. Der frühere QA-Stand `1774846878` fehlt im heutigen Katalog. | Beide betroffenen Kandidaten weiterführen; Katalogabwesenheit ist kein Beleg physischer Entfernung interner Kopien. Unabhängiges Register erhalten. `backup_window_days=NULL`; Prüftermin ist keine Löschfrist. |
| Apple / RevenueCat | Bestehende eng begrenzte Abschlussbelege unverändert in QA vorhanden | Keine Wiederholung des Widerrufs-/DELETE-Tests. APNs, Store-Abos und RevenueCat-Archiv-/Backupkopien sind davon nicht geschlossen. |
| Sentry, OpenAI, Convex, Push, Support-Mail, Shop, Shared Content, Storage/CDN | Bestehende Fallstatus offen; externe Dashboards, Mailbestand, Objekt-URL und historische Objekte in diesem Lauf nicht neu geprüft | Die konkreten Belege und Zugangslücken vom 01.10. bleiben als datierte Ausgangspunkte erhalten. Keine erneute aktuelle Abwesenheit behauptet. Details in der [Anbieterübersicht](deletion-provider-closure-20261001.md) und [Aktionsliste](deletion-provider-actions-20261001.md). |

[Neue Backupkataloge, Auditvergleich und Function-Metadaten](../../output/deletion-status-20261002/live-state.json). Der dort dokumentierte fehlgeschlagene erste Fall-Read wird durch `qa-case-current.json` ersetzt; die zunächst geprüften falschen SMTP-/Testrestriktionsnamen werden ausschließlich durch `qa-case-and-required-secrets.json` korrigiert. Fehlgeschlagene Abfragen bleiben als solche erhalten und begründen keine positive Zustandsaussage.

## Produktion: frischer Stand und zusätzliche Inventarprüfung

Produktion `kwniiyayhzgjfqjsjcfu` ist in Organisation `xqbmotyjxjdeqoisbgow`, `eu-central-1`, `ACTIVE_HEALTHY` erreichbar. Weiterhin kein `deletion_private`, kein Löschworker-/Register-RPC, keine der acht Lösch-Historienzeilen, keine drei Löschfunctions, kein Löschcron und kein `pgrst.db_pre_request`. Die Legacy-RPC bleibt `SECURITY DEFINER`; sie wurde nicht aufgerufen. Ihr Definition-MD5 ist als aktueller Quellenindikator gespeichert, keine vollständige aktuelle Bundleabnahme.

`ACCOUNT_DELETION_ENABLED`, `ACCOUNT_DELETION_CRON_SECRET`, `REVENUECAT_DELETION_API_KEY` und `DELETION_ALARM_SMTP_PASSWORD` fehlen in der aktuellen Produktions-Secret-Liste. `REVENUECAT_PROJECT_ID` ist vorhanden; daraus folgen keine Löschrechte. SMTP-Empfang und Produktionsberechtigung wurden nicht getestet oder konfiguriert. Keine Secret-Werte wurden exportiert.

**Konkrete Abweichung zur Vorbereitung vom 01.10. 12:16 UTC:** Die Produktionshistorie enthält jetzt `20261001170732_data_consent_records`; `consent_private` hat sechs Tabellen. Vier enthalten `user_id` und nachweisbare `ON DELETE CASCADE`-Fremdschlüssel auf `auth.users`: `user_state`, `decisions`, `operations`, `events`. `settings` und `documents` sind davon getrennt. QA hat dieses Schema nicht. Die ursprüngliche Guard-Zielabfrage zählt weiterhin 118 Tabellen, erfasst aber `consent_private` nicht. Auch der vorbereitete Lösch-Fingerprint nennt dieses Schema nicht.

Vor einem Rollout müssen daher die Behandlung dieser vier Nutzerrelationen für Kontolöschung **und** Datenreset, Zugangssperren/Schreibpfade, Belegaufbewahrung und das aktuelle Inventar ausdrücklich zugeordnet werden. Die Auth-CASCADE-Regeln sind ein konkreter DDL-Beleg; sie beweisen keinen getesteten vollständigen Datenreset oder die Abdeckung aller Zugriffspfade. Die vorbereiteten acht Migrationen und Bundles werden nicht allein aufgrund des alten Katalogs als aktuell passend freigegeben.

[Backend-Baseline](../../output/deletion-status-20261002/backend-baseline.json), [aktueller Produktionskatalog](../../output/deletion-status-20261002/production-catalog-current.json), [Consent-Relationen und tatsächliche Guard-Zielmenge](../../output/deletion-status-20261002/consent-catalog-current.json).

## Aufgaben und Zugangslücken

1. **Einzelauftrag benennen:** Er ist in der aktuellen Nachricht noch nicht enthalten. Bis dahin bleiben gezielte Bereinigung, Produktionsbereitstellung, Konfiguration, Versand und Aktivierung offen.
2. **Lokale Vorbereitung aktualisieren, falls beauftragt:** `consent_private` in Inventar/Regel-/Datenreset-/Sperrprüfung aufnehmen; isolierte aktuelle Produktionsbundles und Kataloge erneut vergleichen. Kein altes SQL-Artefakt als frische Ausführungsfreigabe verwenden.
3. **QA-Auditaktion entscheiden:** exakt 18 unveränderte Zeilen; keine pauschale E-Mail-/Projektlöschung. Backup-/Logfälle bleiben auch nach einer gezielten Tabellenbereinigung offen.
4. **Anbieterzugänge und Zuordnungen:** bestehender Convex-Teamzugang `laura-michelle-kuck/lottibaby`, Shopify-Browseranmeldung/Zustimmungsentscheidung, Zuordnung der bestehenden QA-/Produktions-OpenAI-Schlüssel zu Organisation/Projekt und Eigentumszuordnung der drei älteren Objekte. Diese Lücken wurden nicht erneut im Dashboard geprüft. Keine Schlüssel oder Passwörter im Chat nötig.
5. **Bekannte Kopien benennen:** konkrete Mailweiterleitungen/Downloads, Pushbelege, Testbildkopien und geteilte Inhalte; unbekannte Empfänger-/Geräte-/Anbieterarchive bleiben offen.
6. **Produktionsbedingungen bleiben eigenständig:** geschützter dauerhafter Writer und Zugangsdatenversorgung, aktuelles Inventar samt benannter Freigabe/Modus, SMTP und tatsächlicher Alarmempfang, separate RevenueCat-Rechte, vollständige Endpointprüfung; danach gesondert ausdrücklich beauftragte Aktivierung.

Der Supabase-Connector verweigert alle sechs versuchten Leseoperationen mit „You do not have permission to perform this action“. Vorhandene lokale Management-Authentifizierung ermöglicht SQL (`read_only:true`), Backup-, Function- und Secret-Namensprüfungen. QA-Projektmetadaten liefern über den allgemeinen Projekt-GET 404, obwohl diese anderen QA-Endpunkte funktionieren; die vollständige QA-Org-/Projektmetadatenzuordnung bleibt in diesem Lauf unbestätigt. Produktionsidentität ist frisch bestätigt. Keine neue Anmeldung erforderlich für die hier erfolgreich erledigten Management-Reads. [Zugriffsergebnisse](../../output/deletion-status-20261002/connector-access.json).

## Spätere lesende Anbieterprüfung und paralleler Einzelauftrag

Der oben datierte Frühstand wurde in der [konsolidierten Bestandsmatrix](deletion-provider-matrix-20261002.md) mit drei Agentprüfungen und frischen Kontrollpunkten fortgeschrieben. Ein getrennter beauftragter Lauf hat inzwischen 18 aktive Auditzeilen und drei über Originalheader zugeordnete OTP-Mails entfernt. Neue lesende Prüfungen bis 07:07 UTC bestätigen Auditziele 0, ursprüngliche Mailziele abwesend und erhaltene fremde Mailkennungen plus neue Alarmmail; die zwei betroffenen QA-Backupkandidaten bleiben sichtbar. Vorstände, Abbruch-/Ausführungs-/Nachprüfbelege und Register bleiben separat erhalten.

Alle zehn Anbieterfälle und die Produktionsvoraussetzungen bleiben offen. Sentry hat fünf genaue Fallereignisse in einem gemischten Bestand; OpenAI-Altdaten vor Signup sind keine belegten Fallziele. Convex-Anmeldung, Shopify-App-/Archivzugang und nicht geheime OpenAI-Org-/Projektprovenienz fehlen konkret. Keine abgeschlossenen Tests wurden wiederholt; dieser Anbieterprüfauftrag ist rein lesend und hat keine Anbieteranfragen, Löschungen oder Produktion ausgeführt.
