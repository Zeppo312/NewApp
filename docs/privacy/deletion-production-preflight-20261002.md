# Aktuelle Fortschreibung – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Nachfolgender autorisierter Auftrag: Bereitstellung ausgeführt

Der frühere Abbruch bleibt ein gültiger historischer Beleg. Nach Ergänzung des Consent-Inventars wurden alle neun aktuellen Quellen frisch geprüft und am 09:49:25 UTC gezielt angewendet; anschließend drei gesonderte Betriebs- und Sicherheitsmigrationen. Ein UUID-Default-Deparseunterschied zwischen Read-only- und Eigentümerrolle wurde durch gleichartigen Kataloglesekontext korrigiert. Der alte Acht-Quellen-Kandidat wurde nicht blind angewendet.

15 isolierte Functions und zwölf Schutzpfade sind frisch zurückgelesen. 140 Inventarregeln, 122 Schreibtrigger/Policies, fünf Service-only-RPCs, harmlose Legacy-RPC und PostgREST-Löschhook sind bestätigt. Die neuen Guards wurden an Actor-, Empfänger- und Servicepfaden geprüft; eine echte Kontolöschung oder Worker-Verarbeitung fand nicht statt. Aktueller Inventarfingerprint: `409aba7a6ac8886f89271bb8abb58884`. Exakte SQL-Quellhistorie und 173 Originalbelege sind verifiziert.

`ACCOUNT_DELETION_ENABLED=false`, Readiness false, Produktionsaufträge 0, kein Workercron. Die beiden ursprünglichen Notificationcrons bleiben aktiv; ein zusätzlicher Cloudalarmcron läuft nach echtem Produktionsmailempfang. Fachliche Consent-/supervised-Entscheidung dokumentiert, technische Fingerprintfreigabe weiterhin NULL. Die beiden Gates im Abschlussbericht bleiben konkrete externe Voraussetzungen; Consent-Rollout aus.

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Produktionsvorprüfung und kontrollierter Abbruch – 02.10.2026

Der Einzelauftrag erlaubte die gezielte ausgeschaltete Produktionsbereitstellung, ausdrücklich ohne Aktivierung. **Die frische Vorprüfung hat vor jeder Produktionsänderung abgebrochen:** Die acht vorbereiteten Quellen erfassen vier aktuelle Nutzerrelationen in `consent_private` nicht. Der unveränderte alte Katalog ist keine Ausführungsgrundlage. Kein SQL-Staging, Function-Upload, Secret-Update, Schedulerwechsel oder Kontolöschlauf wurde ausgeführt.

Maßgeblicher abschließender Nachweis: [verification.json](../../output/deletion-production-rollout-20261002/2026-10-02T07-26-04-047Z/verification.json), geprüft bis **02.10.2026, 09:36:46 MESZ / 07:36:46 UTC**. Der [erste Preflight](../../output/deletion-production-rollout-20261002/2026-10-02T07-26-04-047Z/preflight.json), [Zwischenabschluss](../../output/deletion-production-rollout-20261002/2026-10-02T07-26-04-047Z/completion.json), ursprüngliche Vorbereitung und sämtliche früheren Testbelege bleiben unverändert erhalten.

## Aktueller Produktionsstand

| Prüfgegenstand | Frischer konkreter Nachweis |
| --- | --- |
| Ziel | `kwniiyayhzgjfqjsjcfu`, Organisation `xqbmotyjxjdeqoisbgow`, `eu-central-1`; vorher und abschließend `ACTIVE_HEALTHY`. |
| Datenbank | Lesende Abfragen erfolgreich; abschließend kein Recovery-Modus und null wartende Datenbanklocks in der abgefragten Momentaufnahme. Kein DDL und keine Kundendatenänderung. Das ist keine Garantie für alle zukünftigen App-Aufrufe. |
| Löschschema / History | `deletion_private` fehlt; null der acht vorgesehenen Historienzeilen. |
| Neue Löschfunctions | `request-account-deletion`, `process-account-deletion`, `account-deletion-alert` fehlen weiterhin in Produktion. |
| Flag / Freigabe | `ACCOUNT_DELETION_ENABLED` fehlt. Ein explizites `false` wurde nach dem Driftabbruch nicht gesetzt. Die vorbereiteten Annahme-/Worker-Handler verlangen exakt `true`. Modus/Fingerprint/Freigeber/Zeit und Fristen sind ohne Löschschema ungesetzt; keine Readiness-RPC installiert. |
| Hook / Scheduler | Kein `pgrst.db_pre_request`; keine Lösch-/Alarmscheduler. Die zwei vorhandenen Benachrichtigungsjobs bleiben aktiv und unverändert. Andere Authenticator-Einstellungen und Auth-Hooks unverändert. |
| Legacy-RPC | `public.delete_user_data(boolean)` ist unverändert `SECURITY DEFINER`, enthält DELETE-Anweisungen und hat effektive EXECUTE-Berechtigungen für `anon`, `authenticated` und Service-Rolle. Sie wurde nicht aufgerufen und noch nicht durch die Supportantwort ersetzt. Die fehlende neue Pipeline bedeutet daher **keine Neutralisierung sämtlicher alter Löschpfade**. Aus ACL allein wird keine anonyme Löschbarkeit behauptet. |
| SQL-Quellen | Alle acht Dateien stimmen exakt mit den vorbereiteten SHA-256-Werten überein. Die ursprüngliche Zielabfrage zählt weiter 118; sie lässt `consent_private` aus. |
| Function-Basen | Alle elf betroffenen frisch heruntergeladenen Produktionsbundles stimmen dateiweise mit der jeweiligen vorbereiteten Basis überein. Alle Guard-Kandidaten stimmen mit ihren Kandidatenmanifesten überein. Kein fremder aktueller Quellstand wurde überschrieben. |
| Neue Function-Quellen | Alle drei QA-Bundles frisch isoliert heruntergeladen; sämtliche Quellen stimmen mit Vorbereitung und aktuellen einschlägigen Rootdateien überein. Das ist ein Quellenvergleich, kein wiederholter QA-Löschtest. |
| `advisor-generate` | Live weiterhin ohne explizites `store:false`. Der separate geprüfte Kandidat hat sieben Function-Quelldateien und ändert ausschließlich `advisorAi.ts`; alle Hashes passen. Der Guard-Kandidat enthält die Korrektur ebenfalls. Wegen des Gesamt-Abbruchs kein Upload. Historische OpenAI-Kopien bleiben getrennt offen. |
| Advisors | 401 Security- und 506 Performance-Befunde vorher/nachher; **null neue oder entfernte Befunde** nach Vergleich sämtlicher Felder außer dem Beobachtungszeitpunkt `observed_at`. Bestehende Befunde werden nicht als saubere Sicherheitsfreigabe ausgegeben. Remediation-Links stehen im Abschlussnachweis. |

## Privater Sicherungsumfang und Erhalt

Unter `.family-qa/deletion-production-rollout-20261002/2026-10-02T07-26-04-047Z/` liegen aktuelle Katalog-/DDL-/ACL-Sicherungen mit exakten Function-, Constraint-, Index-, View-, Policy- und Triggerdefinitionen, Rollen-/Datenbankkonfiguration, Migrationshistorie, Auth-Hooks/-Konfiguration, Scheduler und Function-Konfiguration. Dazu kommen **14 tatsächlich vorhandene isolierte Produktionsbundles** und die drei QA-Quellreferenzen. Keine Kunden-Rohdaten exportiert; keine Zugangsdaten im Chat oder öffentlichen Nachweis. Private Dateien `0600`, Verzeichnisse `0700`, durch Git ignoriert.

Die historischen Planlabels `moderation-review` und `revoke-apple-token` existieren nicht als aktuelle Produktionsslugs. Die ersten beiden optionalen Downloadversuche scheiterten; anschließend wurden die tatsächlich inventarisierten `moderation-report-notify` und `revoke-apple-sign-in` erfolgreich gesichert. **Es fehlt kein Zugang zu den elf betroffenen Bundles.** Der entsprechende anfängliche Backup-Blocker im ersten Preflight ist durch den ergänzenden Nachweis aufgehoben; die Inventarlücke bleibt entscheidend.

Vor-/Nachvergleich: Produktionskatalog, Function-Metadaten, Secret-Metadaten, Auth-Konfiguration und Scheduler unverändert. **173 ursprüngliche Belegdateien und das unabhängige QA-Löschregister sind hashgleich erhalten.** Kein Function-Rollback nötig, weil nichts hochgeladen wurde; die alte destruktive RPC wird nicht als Rollback wieder geöffnet.

## Klassifizierung der zusätzlichen Consent-Relationen

Alle sechs Tabellen besitzen RLS; ihre direkten Tabellen-ACLs gewähren nur dem Eigentümer Rechte. Die vier Nutzerrelationen haben live bestätigte `user_id`-Fremdschlüssel mit `ON DELETE CASCADE` auf `auth.users`. Bestehende `SECURITY DEFINER`-Consent-Funktionen vermitteln den vorgesehenen Zugriff. Diese Tatsachen ersetzen keine Löschregel oder Schreibsperre.

| Relation | Belegter Datenzweck | Kontolöschung | Datenreset / offene konkrete Entscheidung |
| --- | --- | --- | --- |
| `consent_private.settings` | Globale Betriebs-/Versionskonfiguration, keine `user_id` | Erhalten; kein kontobezogenes Löschziel. | Erhalten; nicht durch einen Nutzerreset umstellen. |
| `consent_private.documents` | Gemeinsame versionierte Zustimmungstexte, keine `user_id` | Erhalten; fremde Referenzen bleiben bestehen. | Erhalten; kein pauschales Entfernen gemeinsamer Dokumente. |
| `consent_private.user_state` | Kontobezogene Revisionsnummer | Auth-CASCADE vorhanden; noch außerhalb des Löschinventars und Fingerprints. | Behandlung der Revision zusammen mit Retry-/Idempotenzsemantik festlegen; keine sichere Resetregel in den acht Quellen. |
| `consent_private.decisions` | Aktuelle Gesundheits-/KI-Entscheidung samt Textversion und Zeitpunkt | Auth-CASCADE vorhanden; keine gesonderte Inventar-/Sperrregel. | Festlegen, ob Reset den bestehenden Zustimmungszustand erhält oder bewusst neu anfordert. Keine stillschweigende neue Zustimmung oder Wiederherstellung alter Grants. |
| `consent_private.operations` | Kontobezogene Idempotenz-/Retrybelege | Auth-CASCADE vorhanden; keine gesonderte Inventar-/Sperrregel. | Zusammen mit Revision und späteren Retries prüfen; keine isolierte Entfernung, die alte Grants erneut wirksam machen könnte. |
| `consent_private.events` | Zeit-/versionsgebundene Zustimmungs- und Widerrufshistorie | Auth-CASCADE würde alle Zeilen entfernen; daraus folgt kein eigener Aufbewahrungsentscheid. | Zweck, minimaler Belegumfang und konkrete Aufbewahrung für Konto-/Datenreset ausdrücklich festlegen. Die 90 Tage für Löschbelege sind keine automatisch übertragene Consent-Belegfrist. |

Die erste Löschmigration installiert Policies/Trigger nur in `public`, `caretaker_private` und für `storage.objects`. Der finale Fingerprint der siebten Migration berücksichtigt `public`, `caretaker_private`, `storage`, Regeln und Modus, aber **nicht `consent_private`**. Keine der acht Quellen legt dessen vier Nutzerrelationen als Lösch-/Detach-Regeln fest. Die aktuelle `record_decision`-Funktion enthält keine Prüfung von `deletion_private.blocked`; es gibt dort keine `account_deletion_guard`-Trigger. Ein Auth-CASCADE bei späterer Kontolöschung beweist weder den Datenreset bei erhaltenem Auth-Konto noch gesperrte verspätete Consent-Schreibpfade.

## Aufgaben vor erneuter Bereitstellung

- [x] Aktuelles Produktionsziel und Besitzer prüfen; DDL/ACL/Hook/Scheduler/Function-Konfiguration privat sichern.
- [x] Acht SQL-Quellen, elf isolierte Produktionsbasen, Guard-Kandidaten, `store:false` und drei aktuelle QA-Quellbundles vergleichen.
- [x] Vier zusätzliche Nutzerrelationen und zwei globale Consent-Relationen anhand aktueller DDL klassifizieren; genaue Restentscheidungen benennen.
- [x] Vor der ersten Änderung kontrolliert abbrechen und unveränderten laufenden Produktionsstand bestätigen.
- [ ] Die oben konkret benannten Consent-Reset-/Retry-/Belegentscheidungen treffen und gezielte Inventar-, Fingerprint- sowie Zugriffsschutzkorrekturen vorbereiten. Die acht historischen Quellen/Nachweise erhalten; keine stillschweigende neunte oder geänderte Produktionsmigration ausrollen.
- [ ] Den aktualisierten ausgeschalteten Stagingkandidaten einschließlich Consent-Schreibpfaden und relevanter Service-Role-Endpunkte gezielt prüfen. Die abgeschlossenen Geräte-/Lösch-/Restore-/Registertests bleiben abgeschlossen.
- [ ] Vor einem neuen Lauf Ziel, Katalog und isolierte Bundles erneut lesen. Im erfolgreichen ausgeschalteten Lauf Flag explizit `false`, Modus `unapproved`, Freigabe/Fristen ungesetzt und Löschscheduler inaktiv nachweisen; harmlose Legacy-RPC und frisch zurückgeladene Functions prüfen.

**Kein neuer Produktionszugang nötig:** Der Connector verweigerte den Projekt-Read, der vorhandene CLI-/Management-Zugang funktionierte. Eine rein lesende QA-Abfrage scheiterte zunächst an der EXECUTE-Sperre des API-Readonly-Users für die Service-only Readiness-RPC. Der bestätigte Nachread lief mit bestehender Management-Identität in einer ausdrücklich `BEGIN READ ONLY`-Transaktion. Keine Berechtigung wurde geändert; Fehlversuche und Ergänzungen bleiben getrennte Belege.

## QA-Fall und spätere Aktivierung getrennt

Frischer QA-Read am 02.10. um 07:34:24 UTC: B weiterhin `needs_attention` / `providers`, keine Lease, Readiness false, Modus `unapproved`, Freigabe/Fristen ungesetzt. RevenueCat `completed`, Apple `not_applicable`, zehn `pending`. Kein neuer Anbieterstatus, keine Nachricht, keine Kontolöschung und kein wiederholter Gerätetest, Worker-, Restore-/Replay- oder Register-Neustarttest. Unbekannte Logs, Sicherungen, Archive und fremde/geteilte Kopien bleiben offen; es wurde keine garantierte Anbieterfrist festgelegt.

Nach einer tatsächlich erfolgreichen ausgeschalteten Bereitstellung bleiben separat nötig: geschützter dauerhafter Produktionsregisterwriter und Credential-Versorgung, Betriebs-/Wiederanlaufbeleg, Produktions-SMTP und separate RevenueCat-Löschrechte, tatsächlicher Alarmempfang, aktuelle Inventar-/Modusfreigabe mit benanntem Betreiber und Zeitpunkt sowie **ein ausdrücklicher Aktivierungsauftrag**. Die vorhandenen abgeschlossenen QA-Belege werden dafür nicht erneut erzeugt oder als Produktionsinstallation ausgegeben.

Technische Referenz: [Supabase-Zugriffsregeln und Grenzen des Pre-request-Hooks](https://supabase.com/docs/guides/api/securing-your-api), [Einzelbereitstellung und Function-Download](https://supabase.com/docs/guides/functions/deploy). Diese Dokumentation ersetzt keine aktuelle Projektprüfung.


## Fortschreibung – Consent-Inventarkandidat geprüft, weiterhin kein Apply

Die vorstehende historische Abbruchursache ist jetzt **im neuen lokalen Kandidaten** behoben: vier Nutzerregeln, erhöhte pro Auftrag gebundene Reset-Revision, Annahme-/Schreibsperren, tatsächliche Consent-Readers/Writer und erweiterter Fingerprint. Neue additive neunte Migration; acht Originalquellen unverändert. 16 gezielte lokale SQL-Prüfungen bestehen, einschließlich unveränderter vorhandener Consent-Daten beim Staging und Driftabbruch auch bei identischer Tabellenzahl.

Die technische Vorbereitungsaufgabe ist erfüllt; Betreiberentscheid zu Resetwirkung und notwendiger Belegaufbewahrung bleibt unfreigegeben und separat benannt. Neues SQL hat weiterhin keine Ausführungsfreigabe. Produktion/QA bleiben nach frischem Vor-/Nachread unverändert; globales Consent-Staging aus, Produktions-Löschschema/RPCs fehlen. Keine Nachrichten, Aktivierung oder Restore und keine Wiederholung der abgeschlossenen Tests. [Consent-Inventar, Kandidat und genaue Restbedingungen](deletion-consent-inventory-20261002.md); [frischer Read und Abschluss](../../output/deletion-consent-inventory-20261002/2026-10-02T09-14-51-996Z/completion.json).
