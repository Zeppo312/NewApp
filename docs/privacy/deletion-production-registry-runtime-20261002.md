# Aktuelle Fortschreibung – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Bestehende Runtime verbunden und unabhängig überwacht

Der installierte Macwriter wurde gezielt aktualisiert und mit Produktions-Export/Ack/Heartbeat verbunden, **nicht neu installiert**. Bestehende Keychainversorgung und beide LaunchAgents mit 60-Sekunden-Intervall bleiben erhalten. Installierte Runtime und Repositoryquelle stimmen exakt überein; Registry-/Stateverzeichnisse `0700`, private JSON-Dateien `0600`. Dauerhafter atomarer Export mit fsync/Readback erfolgt vor exaktem Ack und erst danach Cloud-Heartbeat. Heartbeatfehler erhalten den letzten Erfolgszeitpunkt und erhöhen den Fehlerzähler.

Writer und Monitor sind beim letzten Integritätsreadback gesund. Produktionsregister 0 Einträge, bestätigte echte Auftrags-/Ack-Evidenz false. Aktualisierte leere Exportzeitpunkte ändern den Bootstrapdateihash; dessen ursprünglicher Beleg bleibt erhalten, keine Einträge wurden verworfen. Alle drei unabhängigen QA-Register sind bytegleich erhalten und liefern keinen Produktionsnachweis.

Kontrollierte Pause ausschließlich des bestehenden Produktionswriters **10:17:28–10:21:38 UTC** führte zum unabhängigen Supabase-Cloudalarm und realen Supporteingang UID140; danach wieder gesund. Der Mac wurde nicht physisch abgeschaltet. Betrieb benötigt eingeloggten Benutzer, wachen Mac und verfügbaren Keychain; der Cloudcron benötigt den Mac nicht. Ohne echten dauerhaften Ack verhindert die Registerbarriere destruktive Verarbeitung.

Die verbindliche globale Restore-/Ingress-Isolation ist weiterhin **nicht** integriert. Der vorhandene lokale restore-check verweigert Freigabe korrekt, ist aber keine allseitige externe Sperre. Nächste Voraussetzungen: Gate 1 Providerhold; Gate 2 bestehender eigener freigegebener Account für nichtleeren Produktions-Ack/Wiederanlauf. Kein QA-Neustarttest oder weiterer Restore.

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Unabhängiger Produktionsregisterbetrieb – 02.10.2026

**Der Writer und ein separater Statusmonitor sind auf dem vorhandenen Mac installiert und wiederkehrend geladen. Der vollständige Produktionsregisterbetrieb ist noch blockiert:** Produktion hat weiterhin kein `deletion_private` und keine Register-Export-/Ack-RPCs. Die echten Writerläufe erhalten HTTP 404, bestätigen nichts und erhalten die Registerdatei unverändert. Die leere lokale Erstdatei ist ausdrücklich **kein bestätigter Produktionsauftrag**.

Maßgeblicher Nachweis: [verification.json](../../output/deletion-registry-production-20261002/2026-10-02T07-56-59-141Z/verification.json), geprüft am **02.10.2026 um 10:18:56 MESZ / 08:18:56 UTC**. Ziel `kwniiyayhzgjfqjsjcfu`, Organisation `xqbmotyjxjdeqoisbgow`, weiterhin `ACTIVE_HEALTHY`. Keine Produktions-DDL, kein Function-Deployment, kein Produktions-Secretwechsel und keine Worker-Aktivierung. Die vorhandenen zwei SQL-Benachrichtigungsscheduler sind unverändert. Keine neuen Projekte, Auth-/Anbieterkonten, App-Builds oder kostenpflichtigen Dienste.

## Betriebsort und Ausführung

Der aktuell zugängliche Betriebsort ist Jans bestehender Mac im Benutzerkontext `janzeppenfeld` (UID 501). Ein vorhandener anderer Server wurde bislang nicht benannt. Der Macbetrieb läuft nur bei angemeldetem Benutzer, wachem Rechner und zugänglicher Benutzer-Keychain. Eine ständig verfügbare externe Serverinstallation ist damit **nicht** belegt.

| Gegenstand | Tatsächlich eingerichteter Ort / Zustand |
| --- | --- |
| Register | `/Users/janzeppenfeld/.local/share/lottibaby-deletion-production/kwniiyayhzgjfqjsjcfu/registry/deletion-registry-v1.json` |
| Runtime | `/Users/janzeppenfeld/.local/share/lottibaby-deletion-production/runtime-20261002/` – isolierte Kopien von Writer, Supervisor und Keychain-Helfer; keine Ausführung des gesamten Arbeitsbaums. |
| Konfiguration | `runtime-20261002/config.json`, ohne Schlüssel; festes Produktionsziel, absoluter Register-/Statuspfad, benannter Writer und bestehende Interpreter. |
| Status / Logs | `/Users/janzeppenfeld/.local/share/lottibaby-deletion-production/kwniiyayhzgjfqjsjcfu/state/` – `status.json`, `monitor.json`, datierte append-only Ereignisjournale und lokale launchd-Ausgaben. Keine RPC-Antwortkörper, Schlüssel oder Nutzdaten in den Logs. |
| Writerjob | `de.lottibaby.deletion-registry.production`, geladen in `gui/501`; beim Laden und alle **60 Sekunden**, jeweils ein begrenzter Prozesslauf. |
| Monitorjob | `de.lottibaby.deletion-registry.production.monitor`, ebenfalls beim Laden und alle **60 Sekunden**; eigener Prozess ohne Credential- oder Backendzugriff. |
| LaunchAgent-Dateien | `/Users/janzeppenfeld/Library/LaunchAgents/de.lottibaby.deletion-registry.production.plist` und entsprechende `.monitor.plist`; keine Secret-Umgebung oder Secret-Befehlsargumente. |
| Rechte | Register-/Runtime-/Statusverzeichnisse `0700`; Register, Quellen, Konfiguration, Status/Journale und Logdateien `0600`, Eigentümer UID 501, reguläre Dateien mit genau einem Link. |

Die Runtime-Quelldateien sind gegen `source-manifest.json` und die einschlägigen Repositoryquellen SHA-256-geprüft. Die Node-Ausführung ist an den vorhandenen `/Users/janzeppenfeld/.nvm/versions/node/v20.19.4/bin/node` gebunden; Python an `/opt/homebrew/bin/python3`. Vor Entfernen/Ändern dieser bestehenden Interpreter müssen Runtime, Keychainzugriff, beide Jobs und Quellenbindung erneut geprüft werden. Ein stiller Interpreter- oder Quellenwechsel ist kein Betriebsnachweis.

launchd legt seine Ausgabedateien vor Anwendung des Prozess-Umask an. Die vier entstandenen Ausgabelogs wurden daher zusätzlich auf `0600` gesetzt und anschließend geprüft. Bei einer Neuinstallation diese Dateien vor `bootstrap` mit `0600` anlegen; keine laufenden Logdateien für Rotation ungeschützt neu erzeugen. Registerdatei und Status/Journale wurden von Anfang an mit `0600` geschrieben.

## Credential-Versorgung

Der vorhandene **Produktions-Service-Role-Schlüssel** liegt in einem eigenen macOS-Keychain-Eintrag: Service `de.lottibaby.deletion-registry.production.kwniiyayhzgjfqjsjcfu`, Account `registry-writer`. Der Installationslauf hat Projekt-/Rollenkennung geprüft und exakten Keychain-Readback belegt. Kein neuer Schlüssel beim Anbieter erzeugt oder bestehender Schlüssel rotiert; kein QA-Schlüssel übernommen.

Die einmalige Übernahme nutzte den bestehenden CLI-/Management-Zugang im Prozessspeicher. Der wiederkehrende Writer braucht diesen breiten Management-Zugang **nicht**: Er liest nur den dedizierten Eintrag über den installierten Keychain-Helfer in eine private Pipe. Weder Environment-/Plist-/Argumentwerte noch Dateien oder Chat enthalten den Schlüssel. Der Helper verwendet die bestehende Benutzer-File-Keychain und verweigert unbeaufsichtigte Dialoge; fehlender/gesperrter Zugriff ergibt `credential_unavailable`. Es wurde kein Keychain-Passwort abgefragt und keine globale Keychain-Sperre verändert.

Die Service-Rolle bleibt eine privilegierte Supabase-Credential. Der wiederkehrende Runtime-Client erlaubt im Code ausschließlich `account_deletion_registry_export` und `account_deletion_registry_ack`, prüft festes Ziel/Origin und folgt keinen Redirects. Er besitzt keinen Worker-, Annahme-, Lösch-, Mail- oder Projektverwaltungsaufruf. Der geschützte Betreiberprozess ist der serverseitige Aufrufer; dieser Eintrag ist keine Client-Credential.

## Dauerhafte Speicherung und Reconciliation

Die unveränderte bewährte Writerimplementierung wird von dem neuen Supervisor verwendet:

1. Geschützten Pfad, Besitzer, Dateimodus und Linkfreiheit prüfen; exklusives Writerlock anlegen.
2. Vorhandene Registerdatei geschützt lesen und jeden Eintrag anhand Origin, Auftrags-ID, Kontokennung, Scope, ursprünglichem UTC-Annahmezeitpunkt mit sechs Nachkommastellen und Digest prüfen.
3. Export lesen und Identitäten exakt abgleichen. Andere Origins oder geänderte Auftragsidentität werden abgewiesen. Ein leerer/älterer Export entfernt niemals vorhandene Einträge.
4. Neue temporäre `0600`-Datei schreiben, Datei synchronisieren, atomar umbenennen, Verzeichnis synchronisieren und exakten geschützten Readback durchführen.
5. Nur die im echten Export enthaltenen, tatsächlich dauerhaft gespeicherten Einträge mit exaktem Digest bestätigen und die Ack-Antwort an dieselbe Identität binden. Erst danach ist dieser Ack belegt.

Fehlen bekannte unabhängige Einträge im Backendexport, erhält der Supervisor `needs_reconciliation` / `independent_registry_entries_missing_from_backend`; die externe Datei bleibt erhalten. Das ist keine automatische Restore-Freigabe und keine automatische Nachlöschung. Bei bloßem Ack-Transportfehler bleibt der dauerhaft gespeicherte Eintrag erhalten; der folgende Lauf liest ihn und versucht denselben gebundenen Ack erneut.

Es gibt keine automatische Registerbereinigung. Unbekannte Kopien-/Wiederherstellungsbedingungen erhalten keinen erfundenen Endtermin. Vorhandene QA-Registereinträge werden nicht in Produktion umetikettiert; deren getrennte Datei ist hashgleich erhalten.

## Tatsächliche Nachweise und Grenzen

| Prüfung | Konkret belegt | Noch nicht belegt |
| --- | --- | --- |
| Erstschreiben | Echte lokale leere Produktions-Origin-Datei, atomarer Austausch, Datei-/Verzeichnis-Synchronisierung und exakter Readback; `entries=0`, `acknowledged=0`, `backendExportVerified=false`. | Export eines tatsächlichen Produktionsauftrags und dazu gebundener Ack. |
| Rechte | 13 Runtime-/Register-/Status-/Logdateien geprüft: `0600`, Betreiber-Eigentum, einzelne reguläre Dateien; betroffene Verzeichnisse `0700`. | Dauerhafte Verfügbarkeit eines anderen Servers. |
| Wiederkehrende Ausführung | Zehn echte Writerstarts im Abschlussfenster, zehn unterschiedliche PIDs; drei automatische Starts vor dem gezielten Neustart, geladene 60-Sekunden-Jobs. | Gesunder Produktions-RPC-Lauf; aktuell fehlen die Endpunkte. |
| Prozessneustart | Vorher PID `69079`, gezielt neu PID `69114`; beide echte Produktionsläufe zeigen dieselbe fehlende RPC, keine Bestätigung und unveränderte Datei. | Wiederanlauf mit demselben echten bestätigten Produktionsauftrag. |
| Reale Störung | HTTP 404 / `registry_rpc_missing`; `blocked_missing_backend`, Fehlerzähler und separater Monitor, Exitcode 2. Register bleibt bytegleich zum Erstschreiben. | Reale Ack-Unterbrechung/Wiederholung für einen Produktionsauftrag. |
| Neue lokale Laufzeitprüfung | Fünf Tests bestanden: Erstdatei, getrennte Prozesse/Ackfehler, Credentials-/Exportausfall, SIGKILL/Lock-Recovery, leeres Backend mit erhaltenem Eintrag, stale Monitor und verweigerter Restore-Prüfweg. Nur synthetische Dateien und lokale Prozesse. | Keine dieser simulierten Bestätigungen ist ein Produktions-Ack. |
| Restore-Grenze | Installierter `restore-check` endet mit Exitcode 2, `applicationAccessAllowed=false` und `restoredDatabaseAckIsSufficient=false`; er besitzt keinen Freigabe-/Replaybefehl. | Einbindung in sämtliche tatsächlichen Produktions-Restore-/Ingresswege und späterer konkreter frischer Replay-/Freigabenachweis. |

Die bisherigen Geräte-, tatsächlichen QA-Lösch-, Restore-/Replay- und QA-Register-Neustarttests wurden **nicht wiederholt**. Die neuen Tests prüfen den neuen Supervisor mit lokalen Dateien; keine echten Konten, keine QA-RPCs und kein Restore. Ursprüngliche Testbelege bleiben erhalten. Der frische Produktionsbackend-Vor-/Nachvergleich bestätigt unveränderte Schema-/RPC-/Schedulerprojektion.

## Überwachung und Ausfallreaktion

Jan bleibt der dokumentierte Betreiber. Der separate Monitor liest ausschließlich `status.json`; ein Fehler oder ein mehr als **180 Sekunden** alter/fehlender Status ergibt `requiresOperator=true`. `monitor.json` und datierte Journale sind konkrete lokale Störungsbelege, **kein zugestellter Supportalarm**. In diesem Auftrag wurde keine Nachricht versandt. Eine außerhalb dieses Macs wahrnehmbare Alarmzustellung und Überwachung eines ausgeschalteten/abgemeldeten Hosts bleiben offen.

- Fehlende RPCs: Kein leeres Backend vortäuschen und keinen Ack setzen. Aktuelle ausgeschaltete Backendbereitstellung einschließlich Consent-Inventarlücke vervollständigen; Writer versucht den Export im nächsten Intervall erneut.
- Transport-/Credential-/Speicherfehler: Keine Bestätigung; vorhandene Datei erhalten. Fehlerursache prüfen und nächsten Lauf beobachten. Nie die Registerdatei leeren oder ein QA-Register als Ersatz übernehmen.
- Abrupter Prozessabbruch: Ein Lock kann erhalten bleiben. Kein ungeprüftes rekursives Entfernen. `recover-lock` prüft Besitzer/Rechte, PID/Nonce, Abwesenheit des alten Prozesses, unveränderte genaue Lockdatei und gültiges Register; ein lebender oder unklarer PID verhindert Recovery. Nur dessen eine Ownerdatei und leeres Lockverzeichnis werden entfernt. Danach normal erneut ausführen.
- Fehlende unabhängige Einträge im Backend: `needs_reconciliation`; mögliche ältere Datenbank-/Belegbestände getrennt untersuchen. Keine automatische Kontolöschung und keine Anwendungsfreigabe daraus ableiten.
- Laufzeit-/Hostausfall: Status wird stale. Vor Wiederaufnahme Pfad, Quellenmanifest, Registry-Rechte, Keychain und beide Jobs prüfen. Bei erforderlicher kontinuierlicher Verfügbarkeit vorhandenen ständig verfügbaren Host mit nicht geheimer Zugangsbezeichnung bereitstellen.

Lokale Prüfkommandos, jeweils mit bestehendem Node-Pfad:

```sh
/Users/janzeppenfeld/.nvm/versions/node/v20.19.4/bin/node /Users/janzeppenfeld/.local/share/lottibaby-deletion-production/runtime-20261002/account-deletion-registry-runtime.mjs status /Users/janzeppenfeld/.local/share/lottibaby-deletion-production/runtime-20261002/config.json
launchctl print gui/501/de.lottibaby.deletion-registry.production
launchctl print gui/501/de.lottibaby.deletion-registry.production.monitor
```

Für einen **nachweislich beendeten** alten Prozess ist derselbe Runtime-Aufruf mit `recover-lock` statt `status` vorgesehen. Für erneute Ausführung `run`; bei Fehlern Exitcode 2. Keine Credential-Werte als Argumente verwenden. Jobs bei Wartung einzeln mit `launchctl bootout gui/501/<Label>` stoppen, Dateien/Register erhalten und anhand der unveränderten Plist wieder `bootstrap` ausführen. Schlaf-/Abmeldephasen nicht als erfolgreiche Writerausführung zählen.

## Verpflichtende Restore-Schranke

**Vor jeglichem Anwendungszugriff auf einen restaurierten Produktionsbestand muss dessen echte Zugangsisolation bestehen und ein frischer Abgleich des unabhängigen Registers abgeschlossen sein. Ein im Datenbankbackup restauriertes Ack und ein normaler Writerlauf ersetzen diesen Schritt nicht.**

Das Verfahren muss den tatsächlichen Restore-Vorgang und Zielzustand eindeutig binden: Register außerhalb der Sicherung geschützt lesen, seinen aktuellen Hash/Eintragsstand bewahren, alle betroffenen Identitäten je Scope mit dem restaurierten Bestand abgleichen, Sperren und nötigen Replay anwenden, deren Ergebnisse unabhängig prüfen und erst dann eine benannte aktuelle Anwendungsfreigabe erteilen. Fehlende/veränderte Einträge, fehlende Isolation oder unbelegte Endzustände halten die Umgebung gesperrt. Der externe Registerstand wird durch ein älteres Datenbank-Ack niemals ersetzt oder reduziert.

Der installierte Prüfweg verweigert derzeit jede solche Freigabe. **Er ist noch keine globale Supabase-Zugangssperre:** Ein außerhalb des Werkzeugs im Dashboard ausgelöster Restore muss vorher durch den tatsächlichen Betreiber-/Ingressprozess isoliert werden. Ein vorhandener Produktions-Restore-/Ingressworkflow mit technisch gebundener Freigabe wurde hier nicht vorgefunden oder verändert. Diese Einbindung bleibt konkret offen; die laufende Produktionsanwendung wurde nicht für einen hypothetischen Restore gesperrt. Der abgeschlossene Restore-Test bleibt abgeschlossen und wurde nicht erneut ausgeführt.

## Verbleibende Aufgaben

- [x] Externen Produktionspfad, geschützte Runtimekopien und dedizierte Keychain-Credential einrichten; vorhandene QA-Belege/Register erhalten.
- [x] Writer und getrennten Monitor wiederkehrend laden; Erstdatei/Rechte, automatische Starts, echten Prozessneustart und reale sichere Fehlversuche belegen.
- [x] Neue Supervisor-Reconciliation, Ausfall-/Ack-Reihenfolge, verifizierte Lock-Recovery und verweigerten Restore-Prüfweg lokal prüfen; Grenzen getrennt dokumentieren.
- [ ] Aktuelle ausgeschaltete Produktionsschema-/Register-RPC-Bereitstellung mit geschlossener Consent-Inventarlücke abschließen.
- [ ] Nach vorhandenem tatsächlich autorisiertem Produktionsauftrag echten Export → dauerhaften konkreten Eintrag → Readback → gebundenen Ack belegen, denselben Eintrag nach Prozessneustart wiederprüfen und echten Ack-Wiederanlauf nachweisen. Kein Auftrag/Testkonto eigens dafür erzeugt.
- [ ] Restore-Registerprüfung verpflichtend in den tatsächlichen isolierten Produktions-Restore-/Anwendungsfreigabeweg einbinden. Kein neuer Restore-Test in diesem Auftrag.
- [ ] Bei erforderlicher ständiger Verfügbarkeit vorhandenen Server benennen; extern wahrnehmbare Überwachung und Alarmempfang getrennt belegen.

Anbieterfälle, unbekannte Kopien und spätere Worker-/Modus-/Inventaraktivierung bleiben eigene Aufgaben. Dieser Registerauftrag erteilt dafür keine Freigabe.

Technische Referenzen: [Apples Benutzerkontext und Keychain-Implementierungen](https://developer.apple.com/documentation/technotes/tn3137-on-mac-keychains), [Apples launchd-Konfiguration](https://github.com/apple-oss-distributions/launchd/blob/main/man/launchd.plist.5). Die tatsächlichen installierten Zustände sind im Projektnachweis gebunden.


## Consent-Einzelauftrag – Register und Format unverändert

Die Consent-Inventarlücke ist im neuen lokalen Neun-Quellen-Kandidaten geschlossen und mit 16 gezielten lokalen SQL-Prüfungen belegt. Der Writer/Monitor, Keychain-Eintrag, Runtime und Register wurden weder geändert noch neu gestartet. Beide QA-Registerdateien und die unabhängige Produktions-Bootstrapdatei sind hashgleich erhalten. Keine Consent-Payloads oder neue Registerfelder; Digest und unabhängiger Restore-Abgleich bleiben unverändert.

Produktion besitzt nach aktuellem Read weiterhin kein `deletion_private` oder Export/Ack; eine geprüfte lokale Migration ist keine gesunde Produktionsruntime und kein Ack. Ausgeschaltete Bereitstellung braucht einen neuen Einzelauftrag und frischen Quellenabgleich. Tatsächlicher Produktionsauftragseintrag/Wiederanlauf, Restore-/Ingressintegration und externe Alarmzustellung bleiben separat offen; kein Restore und kein QA-Register-Neustarttest wiederholt. [Consent-Inventar, Kandidat und genaue Restbedingungen](deletion-consent-inventory-20261002.md); [frischer Read und Abschluss](../../output/deletion-consent-inventory-20261002/2026-10-02T09-14-51-996Z/completion.json).
