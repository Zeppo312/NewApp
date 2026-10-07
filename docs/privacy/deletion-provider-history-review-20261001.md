# Anbieterprüfung: Sentry, OpenAI und Convex – 01.10.2026

Diese lesende Prüfung betrifft den konkreten QA-Auftrag **B `6434ecdb-7d04-482d-a709-fd991932c142`** und getrennt die allgemeinen Anbieterbestände. Sie verändert keine Anbieterfälle, Produktionsdaten, Einstellungen oder Löschregister. Geräte-, Worker-, Restore- und Registertests wurden nicht wiederholt. Die belegte lokale Löschung bleibt bestanden; für alle drei hier behandelten Anbieter bleibt der Fall **`pending`**.

Maschinenlesbare Beobachtungen, Objektkennungen, Quellhashes, Zugangsgrenzen und vorbereitete Handlungen: [provider-history-review-20261001.json](../../output/deletion-completion-20260930/provider-history-review-20261001.json). Der Nachweis enthält keine API-Schlüssel und keine kopierten Prompt-/Antwortinhalte.

## Sentry

**Zugang und tatsächliche Nutzung:** Das authentifizierte Dashboard zeigt Organisation `jan-zeppenfeld`, Projekt `lotti-baby`/`4509762120056832`; die Projektkennung passt zur App-DSN. Developer ist der aktuelle Tarif. In der laufenden Organisationsperiode 28.09.–27.10. sind jetzt 43 Fehler und 68 Replays angenommen; diese Zahlen beschreiben Nutzung, keinen vollständigen aktuellen Objektbestand.

**Konkreter QA-Fall:** Die separaten Abfragen `user.id:<B-Konto-UUID>` und `user.email:support@lottibaby.de` lieferten jeweils keine Issues und keine Replays in allen Umgebungen während der zugänglichen 30 Tage. Ein angeforderter 90-Tage-Issuezeitraum wurde vom Dashboard auf 30 Tage gekürzt. Es wurden keine Daten gelöscht.

**Positiver Fallnachweis:** Die zusätzliche indexierte Suche `component:revenuecat` über zwei Tage fand sieben Kandidaten. Fünf Ereignisdetails enthalten exakt den aus der B-UUID berechneten `revenuecat.userHash` **`94ab5778f611`**. Damit ist aktiver Restbestand zu B belegt. Die App setzt die Supabase-ID nicht als `Sentry.setUser`; zudem sind benutzerdefinierte Kontexte laut [Sentry-Dokumentation](https://docs.sentry.io/product/issues/issue-details/) nicht durchsuchbar. Die leeren UID-/E-Mail-Abfragen widerlegen diese positiven Detailnachweise nicht.

| Bestätigtes B-Ereignis | Zeitpunkt UTC am 01.10.2026 |
| --- | --- |
| `5a5061db18f04c9389f32a91654f6e14` | 13:34:09 |
| `600f45fed17d4cb0a9b1aa153d96d026` | 13:06:37 |
| `c916cf6b7afe4c53b341cf86aebac5d0` | 13:06:37 |
| `442bf991f306499b8b59ee2b2339f180` | 12:55:41 |
| `6f2172070efe44d58c8c0789cbb39960` | 12:53:24 |

Das gemeinsame Issue **`LOTTI-BABY-3S` / `7753273592` enthält insgesamt 39 Ereignisse und 13 Nutzerkennungen**. Zwei frühere Kandidaten auf denselben Installationen tragen einen anderen Kontohash. Eine Installationskennung gehört deshalb nicht exklusiv zum B-Konto. Die fünf positiven Treffer sind ein gesicherter Mindestbestand; die beiden anderen Kandidaten bleiben ohne vollständige inhaltliche Zuordnung, und das gemischte Issue darf nicht gelöscht werden. Das Telemetrie-Label `production` beschreibt die App-Sentry-Umgebung; der exakte Kontohash ordnet die fünf Treffer dem QA-Konto zu.

Die drei konkret belegten Installationen wurden jeweils in der Replayliste für zwei Tage / alle Umgebungen geprüft: **keine Treffer**. Dieses Fenster umfasst die Lebensdauer des B-Kontos. Bei allen sieben Ereigniszeilen war das Replayfeld `(no value)`; in den eng geprüften Ereignisdetails waren keine Replay-/Anhanglinks vorhanden. Fremde Replays wurden nicht geöffnet. Kennungen, Hashzuordnung, Zeitpunkte, Suchgrenzen und die negativen Replaybefunde sind minimal in [provider-history-sentry-case-events-20261001.json](../../output/deletion-completion-20260930/provider-history-sentry-case-events-20261001.json) gesichert. Die fünf vorhandenen nativen Ablaufbelege enthielten keine Sentry-Identitätsmarker; Appium-/devicectl-IDs wurden nicht gleichgesetzt.

**Ältere Daten und Anhänge:** Die lesende Nutzungsansicht für 30 Tage, UI-Raster **01.09. 12:00 bis 01.10. 16:00 UTC**, zeigte 0 Byte angenommene Anhänge und Logs, 0 Spans und 0 Legacy-Profile. Für Anhänge und Legacy-Profile war auch die LottiBaby-Projektzeile null. Das Rasterende ist ein Anzeigeintervall, kein zukünftiger tatsächlicher Prüfzeitpunkt. Anhänge aller älteren Ereignisse und Anbieterbackups wurden dadurch nicht einzeln inventarisiert. Bereits vorhandene Replays wurden nicht geöffnet oder pauschal gelöscht.

**Tarifhistorie:** Die vollständig angezeigte Billing-Activityliste (beide Seitenschalter deaktiviert) enthält den normalen Trial im Dezember 2023, Developer-zu-Developer-Änderungen im Juli 2024 und August 2025 sowie einen gesonderten Seer-Trial im August 2025. Ein Business-/Team-Tarifwechsel ist darin nicht sichtbar. Deshalb wird die allgemeine Business-Regel für 13 Monate Stichproben-Spans nicht als tatsächliche LottiBaby-Frist behauptet. Die Liste ersetzt keine individuelle Vertrags- oder Backupaussage des Anbieters.

Sentry legt die Frist beim Dateneingang fest: Developer-Daten grundsätzlich 30 Tage; Fehler/Replays/Anhänge bei Team/Business 90 Tage; Business/Enterprise-Spans können 13 Monate als Stichprobe bleiben. [Offizielle Fristentabelle](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/). Eventbackups werden je Datenart 30 oder 90 Tage **nach Erstellung der jeweiligen Sicherung** entfernt; letzter betroffener Backupzeitpunkt und Fallzuordnung sind hier unbekannt. [Backupbedingungen](https://www.sentry.help/en/articles/13965019-how-frequently-is-data-backed-up).

**Vorbereitete Handlung:**

1. Die fünf bestätigten Ereignis-IDs und den letzten belegten Eingang 01.10.2026 13:34:09 UTC für die Nachverfolgung verwenden. Mindestens diese Fehlerereignisse bleiben offen. Developer-Aufbewahrung ab Eingang und Anbieterbackups getrennt behandeln; keine garantierte Gesamtfrist aus einer 30-Tage-Wiedervorlage ableiten.
2. Ausschließlich exakt zugeordnete Replays oder Anhänge können einzeln zur Löschung vorbereitet werden. Ein Fehler-Issue enthält möglicherweise mehrere Nutzer; seine Löschung entfernt alle enthaltenen Ereignisse. Einzelne Spans/Logs/Profile/Feedback lassen sich laut Anbieter nicht entsprechend entfernen. Daher keine fremden Issues und kein ganzes gemeinsames Projekt löschen. [Löschsemantik](https://www.sentry.help/en/articles/16187006-how-do-i-complete-a-gdpr-erasure-request-for-a-user-in-sentry).
3. Für verbleibende Kopien letzten betroffenen Eingang, gültigen Tarif und tatsächliche Backup-Auslaufbedingung dokumentieren. Ein neuer Prüftermin bleibt eine Wiedervorlage. Eine fallbezogene Anbieteranfrage ist vorbereitet denkbar, aber nicht beauftragt oder gesendet.

**Nutzeraktion:** Sentry-Login ist vorhanden. Eine gezielte Anfrage zur letzten Kopie der fünf Ereignisse und zur Backupbedingung erst nach gesondertem Auftrag senden. Die gemischte Issue-Löschung ist keine zulässige Handlung. Kein weiterer Gerätetest ist erforderlich.

## OpenAI

**Zugang und Organisation:** Die bestehende gespeicherte Anmeldung funktioniert. Live gelesen wurden `Personal`/`org-2sYlJINzGuteSUsXluGw0pXO` und das `Default project`/`proj_YpnYm0UmYAsJaN2GGZG1QmQ0`. Auch nach Entfernen des Active-Filters erschien nur dieses Projekt. Es zeigt **Global / Standard Retention**. Die früher dokumentierte reine Login-Sperre ist für dieses Konto überholt.

**Organisationskontrollen:** API call logging steht auf **Enabled for all projects**; die drei Sharing-Schalter für Modellfeedback, Evaluations-/Fine-tuning-Daten sowie Inputs/Outputs stehen jeweils auf **Disabled**. Die Logoberfläche ist für Organisationsinhaber sichtbar. Audit logging bietet die Schaltfläche zur Aktivierung. Keine Einstellung wurde geändert; frühere Sharing-Zustände sind nicht nachgewiesen. ZDR/MAM ist nicht bestätigt.

**Realer historischer Bestand:** Die Completions-Liste zeigt **drei gespeicherte Chat-Completions** vom 24./25.09.2026. Das geöffnete Objekt enthält den Lotti-Schwangerschaftsbegleiter-Systemprompt und einen synthetischen QA-Namensmarker; es hat **keine Metadaten** zur Kontozuordnung. Diese inhaltliche Übereinstimmung belegt App-bezogenen historischen Bestand. **Alle drei Objekte liegen vor der Anlage von Konto B am 30.09.2026, 16:09:42 UTC und sind keine Löschziele dieses Kontofalls.** Der konkrete `user_signedup`-Nachweis mit exakter B-UUID ist in [provider-supabase-audit-exact-20261001.json](../../output/deletion-completion-20260930/provider-supabase-audit-exact-20261001.json) gesichert. Ihre separate historische Eigentümerschaft bleibt zu klären.

| Gespeichertes Objekt | Angezeigte Zeit | Zuordnung B |
| --- | --- | --- |
| `chatcmpl-ERzFpeCvYcjK30Wv1an6chT1vMZuO` | 25.09.2026 14:23 | Vor Kontoanlage; kein B-Löschziel |
| `chatcmpl-ERdnYprh2OkuZOL1sI2GhoZyfpn6y` | 24.09. 15:29 | Vor Kontoanlage; kein B-Löschziel |
| `chatcmpl-ERdn9Lg1ebgNWXSMtRaY3ERLtgqP5` | 24.09. 15:28 | Vor Kontoanlage; kein B-Löschziel |

Die Anzeigezeiten werden ohne behauptete UTC-Umrechnung festgehalten. Die gezielte Suche nach diesen IDs und dem synthetischen Marker in `output`, `docs` und `.family-qa` ergab keinen lokalen Korrelationsnachweis. Keine Completion wurde gelöscht. Die wiederverwendete Betriebsadresse `support@lottibaby.de` oder ein ähnlich benannter QA-Fall reicht für eine Zuordnung nicht aus.

**Weitere zugängliche Bestände:** Responses: 0 Ergebnisse. Files: „No files found“. Vektorspeicher: leere Liste. Conversations, Agents-SDK-Traces und ChatKit-Threads: jeweilige leere Einstiegsmeldung. Diese Befunde gelten für das ausgewählte Projekt und die zugängliche Oberfläche, nicht für sämtliche historischen Konten oder Sicherheitskopien. Der Menüpunkt Assistants führt heute zur Migrationsdokumentation; daraus wird keine historische Bestandsabwesenheit abgeleitet.

**Quellen- und Kontogrenze:** Die vorhandenen Belege bestätigen ausdrücklich `store:false` für `ask-lotti`, `voice-log-parse` und den korrigierten QA-`advisor-generate`. Die minimale Produktionskorrektur ist vorbereitet, weiterhin nicht deployt. Die aktuellen lokalen `.env*` enthalten keine OpenAI-Key-/Org-/Project-Variablen, und der aktive QA-/Produktionsschlüssel ist dem sichtbaren Projekt nicht unabhängig zugeordnet. Die Zuordnung muss privat anhand der bestehenden Secretquelle/Organisation bestätigt werden, ohne Schlüssel im Chat auszugeben.

Die aktuelle offizielle Migrationsanleitung sagt, dass Chat-Completions bei neuen Konten standardmäßig gespeichert werden können und dass explizites `store:false` die Speicherung in beiden APIs deaktiviert. Es gibt hier **keinen Beleg**, dass „Enabled for all projects“ ein explizites `false` übersteuert. Es wurde kein neuer API-Aufruf als Verhaltenstest erzeugt. [OpenAI: Storage-Verhalten](https://developers.openai.com/api/docs/guides/migrate-to-responses).

`store:false` entfernt weder alte Objekte noch die getrennten Missbrauchsprotokolle. Standardmäßig können letztere bis zu 30 Tage bestehen, mit Ausnahmen für gesetzliche Pflichten oder Schutz vor Schaden. Gespeicherte Responses und persistente Conversations/Datei-/Assistant-Objekte haben unterschiedliche Regeln; ein pauschaler 30-Tage-Gesamtabschluss ist unzulässig. ZDR/MAM benötigt genehmigte Kontrollen. [OpenAI: Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data).

**Vorbereitete Handlung:**

1. QA-/Produktionskey dem bestehenden Projekt sicher zuordnen. Die drei konkreten IDs gehören in eine getrennte historische Bestandsklärung anhand ursprünglicher Advisor-Läufe; keine Löschung unter Fall B.
2. Je ausschließlich zugeordnetem und freigegebenem Objekt ist der Ablauf **GET vor Löschung → `DELETE /v1/chat/completions/{completion_id}` → `deleted:true` → GET-Abwesenheit** vorbereitet. Die Schnittstelle ist für gespeicherte Completions dokumentiert. [Offizieller DELETE-Endpunkt](https://developers.openai.com/api/reference/typescript/resources/chat/subresources/completions/methods/delete). Aktive Objektabwesenheit würde weiterhin keinen globalen Sicherheits-/Backupabschluss beweisen.
3. Historische Assistants/Threads, weitere frühere Organisationen und Sicherheitskopien bleiben eigene offene Prüfungen. Über die bestehende Org-Logging-Einstellung nur gesondert entscheiden; keine Einstellung oder Produktion im Rahmen dieser Prüfung ändern.

**Nutzeraktion:** Bestehende Organisation/Projekt der QA- und Produktions-Secretquelle sowie Eigentümerschaft der drei alten Advisor-Objekte bestätigen. Keine neue Anmeldung, kein neuer Schlüssel oder Tarif ist für den bereits sichtbaren Bestand nötig.

## Historischer Convex-Bestand

**Aktuell:** `contexts/ConvexContext.tsx` liefert weiterhin `convexClient:null`, ohne Socket/Sync. Das ist kein historischer Löschbeleg. Die bestehende lokale Konfiguration benennt **Team `laura-michelle-kuck`, Projekt `lottibaby`, Dev-Deployment `merry-pony-594`**. Das vorhandene Schema enthält unter anderem Nutzer-/Profilzuordnungen, Verknüpfungen, Babys/Mitgliedschaften, Arztfragen und Schlafdaten einschließlich geteilter Referenzen.

**Zugangsprüfung:** Das Dashboard führt zu „Bei Convex anmelden“. Zusätzlich wurde die vorhandene lokale CLI-Anmeldung geprüft, ohne ihren Token auszugeben. Der ausschließlich lesende Befehl `node_modules/.bin/convex data --deployment merry-pony-594` wurde mit **„You don't have access to the selected project“** abgewiesen. Es wurde kein `convex dev`, keine Neuanlage und kein Deployment gestartet. Aktive/historische Daten-, Storage- und Backupanzahlen sind daher **unbekannt**, nicht null.

Convex dokumentiert manuelle und tägliche Backups für sieben Tage, wöchentliche für 14 Tage. Files sind optional enthalten; heruntergeladene Kopien bleiben separat. Konfiguration und wartende geplante Funktionen sind nicht im Datensnapshot enthalten. Die Dokumentation nennt zusätzlich physische Sicherungen für dedizierte Deployments. Keine dieser Bedingungen bestätigt Tarif, aktive Einstellungen oder tatsächlich vorhandene Kopien dieses Kontos. [Offizielle Backupbedingungen](https://docs.convex.dev/database/backup-restore).

**Vorbereitete Handlung nach Anmeldung:**

1. Im bestehenden Team/Projekt alle Produktions-, Entwicklungs-, Preview- und früheren Deployments inventarisieren, einschließlich vorhandener Nachweise entfernter Deployments.
2. Tabellen zunächst über Zähler und exakte `supabase_user_id`-/`user_id`-Filter für B prüfen. Storage-Zuordnung, `_scheduled_functions`, Logs und geteilte Baby-/Schlafreferenzen gesondert erfassen. Keine pauschalen Tabellenexporte oder fremden Inhalte kopieren.
3. Backup-Liste mit Erstellung, angegebenem Ablauf, manuell/automatisch und File-Inhalt dokumentieren; zuvor heruntergeladene Kopien getrennt abgleichen. Kein neues Backup erstellen.
4. Nur ausschließlich zugeordnete Zeilen/Dateien zur Bearbeitung vorbereiten; fremde und geteilte Inhalte erhalten. Ein Ablaufdatum wird erst aus tatsächlichem Bestand und belegter Anbieterbedingung hergeleitet.

**Nutzeraktion:** Im bereitgehaltenen Convex-Tab mit dem bestehenden Konto anmelden, das Zugriff auf `laura-michelle-kuck/lottibaby` besitzt. Keine Passwörter oder Schlüssel im Chat; kein Ersatzprojekt anlegen.

## Konsolidierter Abschlussstand

| Anbieter | Belegter Status | Nachweis | Verbleibende Handlung | Erforderliche Nutzeraktion |
| --- | --- | --- | --- | --- |
| Sentry | `pending`; mindestens 5 exakt B zugeordnete Fehlerereignisse aktiv, gemischtes Issue | Exakte Event-IDs/Hash/Zeit; eigener Fallbeleg und JSON `sentry` | Individuelle Fehler nicht löschbar; Eingang/Aufbewahrung und letzte Backupkopie klären | Kein Login nötig; gezielte Anbieteranfrage nur separat beauftragen |
| OpenAI | `pending`; 3 gespeicherte Completions vor B-Kontoanlage, getrennte historische Bestände | Personal/Default, Org-Kontrollen, Objekt-IDs und B-Signup | Key-Projekt und Fallabdeckung bestätigen; alten Bestand separat zuordnen; Sicherheitskopien prüfen | Secretquelle privat zuordnen; historische Eigentümerschaft getrennt bestätigen |
| Convex | `pending`; historischer Bestand wegen fehlenden Projektzugriffs unbekannt | Bekannte Team-/Deploymentkonfiguration; Dashboard-Login und CLI-Zugriff abgewiesen | Alte Deployments, Tabellen, Storage, geplante Aufgaben und Backups inventarisieren | Mit bestehendem berechtigtem Convex-Konto anmelden |
