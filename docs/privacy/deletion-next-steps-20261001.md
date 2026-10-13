# Aktuelle Fortschreibung – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Maßgebliche Aufgabenliste

**Nachprüfung 02.10., 11:33 UTC:** Beide vorhandenen Produktionskandidaten `test@lottibaby.de` und `test@zeppi.eu` existieren; eindeutige eigene Entbehrlichkeit ist noch nicht zugeordnet. Konkrete Auswahlfrage an Jan gestellt. Supabase SU-492245 weiterhin ohne fachlichen Restore-Hold-Nachweis. Annahme und Consent bleiben aus; [Nachprüfbeleg](../../output/deletion-closure-execution-20261002/root/followup-gates-recheck.json).

- [x] Neun aktuelle Kernmigrationen einschließlich Consent-Inventar gezielt ausgeschaltet bereitstellen; drei separate Betriebs- und Sicherheitskorrekturen anwenden.
- [x] 15 isolierte Functions mit zwölf Schutzpfaden deployen und tatsächliche Quellen zurücklesen; SQL, ACLs, Trigger, Consent und harmlose Legacy-RPC prüfen.
- [x] Bestehenden Macwriter mit Produktions-Export-, Ack- und Heartbeat-RPCs verbinden; vorhandenen Monitor erhalten, keine Neuinstallation.
- [x] Separate RevenueCat-Customers-only-Rechte und Produktions-SMTP sicher hinterlegen; echte Testmail UID138 sowie Cloud-Stale-Alarm UID140 und Wiederanlauf belegen.
- [x] Zugängliche Anbieterbestände mit drei Agents prüfen; Shopify-Zugang lösen, Convex-Appentfernung frisch bestätigen; neue minimale OpenAI-Anfrage und Restore-Sperren-Ergänzung in SU-492245 tatsächlich senden.
- [x] 173 Originalbelege und drei unabhängige QA-Register unverändert erhalten; abgeschlossene Geräte-, QA-, Restore- und Replaytests sowie Audit-/OTPbereinigung nicht wiederholen.
- [ ] **Gate 1:** Providerbestätigte projektweite, restorefeste Ingress-Isolation mit geschütztem Management-Replay und verbindlicher Freigabegrenze integrieren. SU-492245 enthält die konkrete offene Frage und den vorbereiteten Ablauf.
- [ ] **Gate 2:** Eine ausschließlich vorhandene, eigene und ausdrücklich entbehrliche Produktions-Account-UUID zuordnen; nach Gate 1 echten Auftrag, dauerhaftes nichtleeres Register, digestgebundenes Ack und Wiederanlauf/Ausfall belegen. Keine neue oder beliebige Testidentität.
- [ ] Danach aktuellen Quellen- und Inventarfingerprint frisch prüfen, Jan und tatsächliche technische Abnahmezeit dokumentieren und Annahme/Worker kontrolliert aktivieren. Bestehende Autorisierung genügt; Consent-Rollout bleibt aus.
- [ ] Zehn historische Anbieter-/Kopienfälle weiter beaufsichtigt bearbeiten. Unbekannte Fristen und Kopien bleiben offen; `completed` nur fallgebunden. Diese Bearbeitung ersetzt Gate 1/2 nicht.
- [x] Sentry-Fachantwort **215476206908813** und aktuelle offizielle Aufbewahrungsbedingungen auswerten: 30 Tage ab Empfang für aktive Developer-Ereignisse, keine genau fünf Ereignisse betreffende Entfernung, keine verknüpften Anhänge/Replays/Feedback laut Support. Zusätzlicher Breadcrumb-Kandidat live mit anderem Kontohash, kein sechster bestätigter B-Treffer.
- [ ] Fünf exakte Sentry-IDs am **31.10.2026 nach 13:35 UTC / 14:35 MEZ** lesend auf tatsächliche Abwesenheit prüfen. Das ist ein Prüftermin, keine Löschgarantie; kein automatischer Lauf eingerichtet. Konkrete Backup-/Archivendbedingung bleibt im bestehenden Ticket zu klären; 90 Tage ab Backuperstellung sind kein Gesamtmaximum ab Kontolöschung. [Auswertung und vorbereiteter Folgeentwurf](deletion-sentry-support-response-20261002.md).

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Abschlussstand Löschbetrieb – 01.10.2026

Die technische QA auf Android und iPhone sowie der echte Worker-Löschlauf sind bestanden. Der verwaltete Restore mit unabhängigem Löschregister-Replay ist abgeschlossen; das eigene Wegwerfprojekt ist entfernt und die Automation beendet. Keine weiteren Restore-Projekte, Testkonten oder Geräte-Builds sind für diese abgeschlossenen Prüfungen nötig. **Der gesamte Produktionsbetrieb ist noch nicht freigegeben.**

## Erledigte Tests

Die Agents haben Android 20 aus dem internen Play-Test und iOS 1.0.76 aus TestFlight auf den angeschlossenen physischen Geräten bedient. Beide Apps enthalten die geprüften Clientdateien; OTA blieb ausgeschaltet. Der Betreiber hat den Zustimmungshaken für genau das bestehende markierte QA-Wegwerfkonto ausdrücklich freigegeben. Auf beiden Geräten sind echte Anmeldung, Mailcode-Verifikation, native Auftragsannahme mit Referenz und anschließender Supportweg belegt.

Ein vorhandenes Konto wurde nacheinander verwendet. Android nahm Auftrag A an. Dessen Zugangssperre verhinderte die anschließende iOS-Zustimmung korrekt. Nach dokumentierter Entfernung ausschließlich dieses noch unverarbeiteten eigenen QA-Auftrags nahm iOS Auftrag B an. Kein zusätzliches Auth-Konto wurde erzeugt; eine gemeinsame Auftrags-ID oder native Idempotenz wird nicht behauptet. A blieb als eigener externer Registereintrag erhalten.

Für B wurde der tatsächlich deployte Worker ausgeführt: sechs erfolgreiche Phasenaufrufe entfernten Auth-Konto, Profil und die eigene Datei. Der vor B ausgestellte, noch gültige Token war vor und nach dem Worker gesperrt; ein verspäteter Schreibzugriff wurde abgewiesen. Alle sechs Kontrollkonten einschließlich Auth-Verknüpfungen und Profile blieben unverändert. Die ursprüngliche Datei-URL war anschließend nicht erreichbar. RevenueCat ist fallbezogen abgeschlossen; nach dem Worker blieben elf Anbieter-/Inhaltsaufgaben offen. Die anschließende aktuelle Anbieterprüfung hat Apple für genau diesen E-Mail-Fall belastbar als `not_applicable` dokumentiert und den QA-Belegstatus aktualisiert. **Zehn Anbieter-/Inhaltsfälle bleiben offen.** B steht weiterhin korrekt auf `needs_attention` in der Anbieterphase, nicht auf `completed`.

Belege: [Agent-Abnahme](../../output/deletion-completion-20260930/native-backend-final-test-20261001.json), [echter Worker](../../output/deletion-completion-20260930/native-backend-worker-20261001.json), [ausgeschaltete QA wiederhergestellt](../../output/deletion-completion-20260930/native-backend-cleanup-20261001.json), [iPhone-Abnahme](deletion-ios-agent-native-20261001.md). Die TestFlight-Einladung für Jans bestehendes Konto war ausdrücklich genehmigt; kein Apple-Kontowechsel, Gerätezurücksetzen oder zusätzliches Administratorrecht war erforderlich.

Der physische Supabase-Restore und Register-Replay wurden bereits mit ausschließlich eigenen Wegwerfdaten bestanden. Nachweise: `managed-restored-source-deletion.json` und `managed-restore-cleanup.json` unter `output/deletion-completion-20260930/`. Geschätzte zusätzliche Compute-Kosten: 0,16128 USD; die Rechnung ist noch nicht bestätigt. Die drei erfolgreichen Geräte-Artefakte nutzten das vorhandene kostenlose EAS-Kontingent; kein Tarifwechsel oder zusätzlicher Buildpreis wurde beobachtet.

## Registersperre in QA abgeschlossen

Nach dem Geräte-/Worker-Test wurden ausschließlich die zwei geprüften neuen Migrationen für beaufsichtigte Anbieterbearbeitung und das dauerhafte Löschregister in der bestehenden Familien-QA angewendet. Acht effektive Löschmigrationen sind vorhanden; sieben besitzen Historienzeilen. Die ursprüngliche Jobmigration wurde historisch ohne Zeile angewendet und wurde weder wiederholt noch nachgetragen.

Registerexport und Bestätigung sind ausschließlich für die Service-Rolle zugänglich. Der echte Writer speicherte genau den bekannten Auftrag B außerhalb Repository und Supabase, mit Verzeichnisrechten `0700`, Dateirechten `0600`, atomarem Schreiben, Synchronisierung und exaktem Readback. Erst danach wurde sein Digest bestätigt. Ein zweiter, eigenständiger Prozess erhielt denselben Eintrag unverändert. Anbieterstände, Kontrollkonten und Scheduler wurden erneut verglichen. Die Sicherheitsprüfung zeigte 372 bestehende Befunde und keine neuen.

Aktueller QA-Stand: sechs Auth-Konten, keine Storage-Dateien, ein Anbieterauftrag; `ACCOUNT_DELETION_ENABLED=false`, Modus `unapproved`, Fingerprint/Freigeber/Datum und beide Fristen `NULL`. Der Löschcron ist aus, der bestehende Alarmcron an. Die temporäre Einschränkung auf das Testkonto ist entfernt. Ein dauerhafter Produktionswriter ist noch nicht eingerichtet.

Belege: [QA-Migrationsprüfung](../../output/deletion-completion-20260930/qa-seven-eight-verification-20261001.json), [Register-Neustarttest](../../output/deletion-completion-20260930/qa-durable-registry-runtime-20261001.json), [QA-Registerplan](deletion-qa-registry-staging-20261001.md).

## Anbieterprüfung fortgeschrieben

Die [Anbieterübersicht](deletion-provider-closure-20261001.md) und [maschinenlesbare Abschlussliste](../../output/deletion-completion-20260930/provider-closure-20261001.json) enthalten die neue Bestandsprüfung mit drei Agents und abschließendem Hauptagenten-Abgleich. Der ursprüngliche Geräte-/Worker-/Restore-/Registertest wurde nicht wiederholt.

- **Neuer konkreter Restbestand:** 18 aktive Auth-Auditzeilen mit exakter QA-Kennung/E-Mail und 479 UID-haltige externe Supabase-Logtreffer im abgefragten Fenster. Ein auf die 18 IDs und Zeilen-Hashes begrenzter Aktionsentwurf ist vorbereitet, nicht ausgeführt. Die aktiven Auditkopien können neue Backups betreffen; sieben Tage Entitlement sind keine maximale Löschfrist.
- **Historische Anbieterbestände:** OpenAI zeigt drei gespeicherte appbezogene Completions vom 24./25.09., vor Anlage dieses Testkontos; nicht als Daten von B löschen. Sentry enthält mindestens fünf über den exakten Kontohash zugeordnete Ereignisse in einem gemischten Issue; dieselben Gerätekennungen treten auch mit anderen Konten auf. Replay- und Backupkopien bleiben getrennt offen. Keine pauschalen Issue-/Projektlöschungen.
- **Mail und Shop:** Drei zugeordnete OTP-Mails bleiben im Supportpostfach. Aktuell keine konfigurierten Hostinger-Forwarder; historische/manuelle/lokale Kopien bleiben offen. Der richtige Shopify-Shop meldet keine Kunden oder Bestellungen für die exakte E-Mail, aber Checkout-/App-/Archivkopien sind nicht abschließend geprüft.
- **Konkrete Zugangslücken:** Convex-Zugang zum früheren Team `laura-michelle-kuck/lottibaby`; Shopify-Browseranmeldung für weitergehende Kontrollen. OpenAI ist erreichbar, die serverseitigen QA-/Produktionsschlüssel müssen noch der sichtbaren Organisation `Personal / Default project` zugeordnet werden. Keine Schlüssel im Chat nötig.

Apple ist ausschließlich für den Anmeldewiderruf dieses E-Mail-Kontos `not_applicable`, RevenueCat ausschließlich für den belegten aktiven Kundenbestand `completed`. Alle unbekannten Anbieter-, Backup-, Geräte- oder geteilten Kopien bleiben offen. Die einzige neue Backendänderung war der administrative Apple-Belegstatus in QA; Auftrag, Einstellungen, Scheduler, Kontrollkonten und unabhängiges Register bleiben erhalten. Anbieteranfragen, Mail-/Audit-/historische Objektlöschungen und Produktionsänderungen wurden nicht ausgeführt.

## Noch umzusetzen

1. Den vorbereiteten Stand gezielt und zunächst ausgeschaltet in Produktion bereitstellen: acht Einzelmigrationen, isolierte Function-Bundles, Zugangshook und Schreibsperren. Produktionsquellen frisch gegenprüfen, danach SQL, Berechtigungen, Functions und Sicherheitsmeldungen verifizieren. [Konkreter Produktionsplan](deletion-production-rollout-20261001.md).
2. Den externen Registerbetrieb für Produktion einrichten: geschütztes Verzeichnis, serverseitige Zugangsdatenversorgung und wiederkehrender Writer. Erstschreiben, Neustart, Ausfall und Wiederanlauf nachweisen. Vor jedem Restore-Anwendungszugriff bleibt der unabhängige Registerabgleich verpflichtend; ein restauriertes Datenbank-Ack genügt dafür nicht.
3. Produktions-SMTP, tatsächlichen Alarmempfang bei `support@lottibaby.de` und separate RevenueCat-Löschberechtigung konfigurieren und prüfen. Die relevanten Service-Role-Endpunkte der isolierten Produktionskandidaten abschließend prüfen. QA-Schlüssel und ein QA-Empfangstest ersetzen diese Nachweise nicht.
4. Die zehn offenen Anbieter-/Shared-Content-Fälle anhand der neuen konkreten Bestands-/Aktionsliste weiterbearbeiten: insbesondere 18 aktive Auditkopien, betroffene Sicherungen, drei Testmails und historische Anbieterobjekte. Fehlende Zugänge und Zuordnungen sind einzeln benannt. Unbekannte Fristen bleiben offen. Jan übernimmt Support spätestens am nächsten Arbeitstag; Vertretung durch seine Frau erst nach wirklicher Zugriffsübergabe. [Anbieterstand](deletion-provider-closure-20261001.md).
5. Aktuellen Inventarstand und gewählten Betriebsmodus mit Betreiber, Datum und Fingerprint freigeben; anschließend Annahme und Worker kontrolliert aktivieren. Die vorhandene Arbeitsstand-Dokumentation enthält noch keine gemeinsame Produktionsfreigabe.

Die [Löschregeln](deletion-policy-20261001.md) sind festgelegt: minimale abgeschlossene Belege 90 Tage, eigene Diagnoseprotokolle sieben Tage. Der [beaufsichtigte Modus](deletion-supervised-provider-mode-20261001.md) erlaubt ein unbekanntes Wiederherstellungsmaximum als `backup_window_days=NULL`; dies erzeugt weder eine erfundene Anbieterfrist noch einen automatischen Gesamtabschluss. Unbekannte Fristen verhindern die Belegbereinigung. Jans Angabe, keine eigenen externen Datenbank-Backups/Nutzerdatenexporte zu besitzen, ist dokumentiert. Das neue minimale Löschregister erfüllt einen anderen Zweck.

Supabase-, Sentry-, OpenAI-, CDN- und historische Anbieterbelege bleiben getrennt. Supabase-Pro-Entitlements nennen sieben Tage, ersetzen aber keine garantierte maximale Wiederherstellungsfrist. Sentry-Einstellung und `store:false` schützen künftige Erfassung und belegen keine Löschung historischer Daten. Der aktive QA-Advisor ist korrigiert; die isolierte Produktionskorrektur ist vorbereitet. Der laufende Produktionsstand wurde durch diese Arbeiten nicht verändert.


## Fortschreibung 02.10.2026 – aktuelle Bestandsprüfung

Die [lesende Prüfung vom 02.10.](deletion-current-status-20261002.md) ergänzt den oben datierten Stand. Auftrag B bleibt mit exakt unveränderter Auftrags-/Anbieterprojektion `needs_attention`/`providers`: zehn offene Fälle. Alle 18 Auditzeilen sind unverändert vorhanden. Neu ist QA-Backup `1841321535` vom 01.10. 23:26:18.089 UTC als weiterer Kandidat für Auditrestkopien; sein Inhalt wurde nicht durch Restore geprüft. Zwei zusätzliche QA-Auth-Konten erhöhen den aktuellen Gesamtbestand auf acht; die gelöschte Fallkennung bleibt abwesend. Diese anderen Konten werden nicht bereinigt. Register und ursprüngliche Nachweise sind unverändert erhalten.

**Zusätzliche Aufgabe vor Rollout:** Produktion enthält nun `consent_private` mit vier Nutzerrelationen und Auth-CASCADE-FKs; QA enthält dieses Schema nicht. Die bisherigen 118 Guard-Ziele und der vorbereitete Fingerprint erfassen es nicht. Kontolöschung, Datenreset, Sperren und Belegaufbewahrung müssen im aktuellen Inventar zugeordnet werden. Die alte Vorbereitung ist damit keine aktuelle Ausführungsfreigabe. Produktionsschema/-Functions/-Secrets für den Löschbetrieb fehlen weiterhin.

Der angekündigte Einzelauftrag fehlt noch. Konkrete QA-Auditaktion, Produktionsänderungen, Nachrichtenversand und Aktivierung bleiben offen. Geräte-, Worker-, Restore-/Replay- und Register-Neustarttests wurden nicht wiederholt. [Frische Nachweise und Aufgaben](deletion-current-status-20261002.md).

## Einzelauftrag 02.10.2026 – 18 Auditzeilen und drei OTP-Mails abgeschlossen

Der anschließend ausdrücklich erteilte Einzelauftrag ist in seinem begrenzten Umfang erledigt: **18 exakt gebundene QA-Auditzeilen entfernt und frisch mit null Restbestand bestätigt; drei über aktuelle RFC822-Header zugeordnete OTP-Testmails einschließlich ihrer Papierkorbziele endgültig entfernt.** Die dritte lag bereits als Papierkorb-UID 66 statt INBOX 116 vor. Alle 553 fremden Auditzeilen und 129 geschützten QA-Relationen waren im erfolgreichen Vor-/Nachvergleich unverändert. 39 andere Posteingangs- und zwölf andere Papierkorbzeilen bleiben erhalten, einschließlich Alarmmails. Register und ursprüngliche Belege sind unverändert.

Der erste Auditlauf brach wegen einer unabhängig geänderten fremden Relation vor dem DELETE ab und wurde frisch neu vorbereitet. Originalentwurf, Abbruch und beide Vorvergleiche bleiben erhalten. QA bleibt aus / `unapproved`; Auftrag B weiterhin `needs_attention` / `providers`, zehn Fälle `pending`. Keine abgeschlossenen Tests wiederholt, keine Produktion oder Anbieterstatusauflösung, kein Versand und keine neuen Projekte/Konten/Builds/Tarife/Dienste.

Die Aufgaben „18 aktive Auditkopien behandeln“ und „drei belegte aktive Testmails entfernen“ sind damit erfüllt. **Externe/interne Logs, betroffene Sicherungen, Hostinger-Archive und unbekannte Weiterleitungen bleiben unabhängig offen**; kein Gesamtabschluss, keine garantierte Löschfrist. Produktionsvoraussetzungen bleiben eine eigene Aufgabe. [Konkrete Aufgaben und Vorher-/Nachherbelege](deletion-targeted-cleanup-20261002.md), [maschinenlesbarer Einzelabschluss](../../output/deletion-targeted-cleanup-20261002/completion.json).

## Lesender Einzelauftrag 02.10.2026 – zehn Fälle konsolidiert

Drei Sub-Agents haben Supabase-Kopien, historische Sentry/OpenAI/Convex-Bestände und Kommunikation/Shop/Sharing lesend geprüft, relevante Befunde ausgetauscht und getrennte Originalnachweise gespeichert. Die inzwischen separat erledigte aktive Audit-/OTP-Bereinigung ist frisch lesend abgeglichen: Auditziele 0, drei aktive Mailziele abwesend; betroffene Backups bleiben sichtbar. Alle zehn Anbieterfälle bleiben `pending`. Geräte-, Restore-/Replay- und Register-Neustarttests wurden nicht wiederholt.

- [x] Aktuelle zehnteilige Bestandsmatrix, konkrete Nachweise und ausführbare lesende Folgeaktionen konsolidiert.
- [x] Frühere Ereignisse, Replays/Anhänge, KI-Objektlisten, vorhandene Backupkataloge und bekannte Weiterleitungen mit Suchgrenzen geprüft. Fünf genaue Sentry-Ereignisse bleiben positiv; drei ältere OpenAI-Completions sind keine Fall-Löschziele.
- [ ] Bestehenden Zugang zu Convex `laura-michelle-kuck/lottibaby` wiederherstellen; tatsächliche frühere Deployments und Backupkataloge fehlen. Gezielte Anmeldefrage ist gestellt.
- [ ] Bestehenden Shopify-Shop anmelden und angezeigte Zustimmung selbst entscheiden; Apps/Archive fehlen. Gezielte Anmeldefrage ist gestellt.
- [ ] OpenAI-Serverkeys über nicht geheime Herkunft zu Organisation/Projekt/Schlüsselname zuordnen; Datum und sichtbarer Name sind nur Korrelation. Frage ist gestellt; keine Schlüsselwerte nötig.
- [ ] Verbleibende interne/externe Logs, Sicherungen, Archive und historische/manuelle oder Empfängerkopien konkret zuordnen. Produktionsbedingungen bleiben getrennt offen.

[Bestandsmatrix mit Nachweisen und Aktionen](deletion-provider-matrix-20261002.md). Dieser Auftrag hat keine Löschung, Anbieteranfrage, Nachricht, Aktivierung oder Produktionsänderung ausgeführt; Belege und Register sind erhalten. Prüftermine sind keine garantierten Löschfristen.


## Produktions-Einzelauftrag 02.10.2026 – vor Änderung abgebrochen

Die gezielte ausgeschaltete Bereitstellung wurde ausdrücklich beauftragt. Die aktuelle Vorprüfung hat jedoch vor der ersten Produktionsänderung kontrolliert abgebrochen: `consent_private.user_state`, `decisions`, `operations` und `events` fehlen in den acht vorbereiteten Löschregeln, Guards und im Fingerprint. Die unveränderte Zahl 118 ersetzt diese zusätzliche Inventarbedingung nicht. Acht SQL-Hashes, elf Produktionsbasen/Guard-Kandidaten und drei frische QA-Quellbundles stimmen mit der Vorbereitung überein. Kein Upload, DDL, Secretwechsel oder Schedulerwechsel.

- [x] Ziel `kwniiyayhzgjfqjsjcfu` frisch bestätigt, DDL/ACL/Hook/Scheduler sowie 14 tatsächlich vorhandene Produktionsbundles privat gesichert; laufender Stand unverändert und abschließend `ACTIVE_HEALTHY`.
- [x] Quellenvergleich, aktuelle Consent-Klassifizierung und kontrollierter Driftabbruch dokumentiert; 173 ursprüngliche Belege und unabhängiges Register erhalten.
- [ ] Consent-Reset-/Revisions-/Retrysemantik und eigenen Consent-Belegumfang/Aufbewahrung festlegen; gezielte aktuelle Inventar-, Fingerprint- und Zugriffsschutzkorrektur vorbereiten und prüfen.
- [ ] Danach erneut frisch ausgeschaltet bereitstellen: derzeit fehlt das Enable-Secret, die alte destruktive Legacy-RPC ist unverändert, `advisor-generate` weiterhin ohne explizites `store:false`. Diese Schritte wurden wegen des Abbruchs nicht als fertig markiert.
- [ ] Dauerhafter Produktionswriter, SMTP/Alarmempfang, separate RevenueCat-Rechte, Endpointprüfung und benannte Inventar-/Modusfreigabe bleiben separate Aktivierungsbedingungen; kein Aktivierungsauftrag.

QA-Fall B ist frisch weiter `needs_attention` / `providers`, zehn `pending`, Readiness false / `unapproved`, ohne Lease. Keine abgeschlossenen Tests wiederholt; unbekannte Kopien/Fristen bleiben offen. [Aktueller Ergebnisstand, konkrete Entscheidungen und Nachweise](deletion-production-preflight-20261002.md).


## Register-Einzelauftrag 02.10.2026 – Macruntime installiert, Backend offen

Der neue Einzelauftrag erlaubt Installation und wiederkehrende Ausführung des unabhängigen Writers, keine Worker-Aktivierung. Auf Jans bestehendem Mac sind ein geschützter externer Produktionspfad, isolierte Runtimekopien, ein eigener Produktions-Keychain-Eintrag sowie getrennte Writer-/Monitor-LaunchAgents im 60-Sekunden-Intervall tatsächlich eingerichtet. Automatische Starts, echter Prozessneustart, Rechte und sichere Ausfallreaktion sind belegt.

- [x] Lokalen unabhängigen Registerbetrieb samt Credential-Versorgung und separatem Statusmonitor installieren.
- [x] Echte leere Erstdatei und `0700`/`0600`, zehn Writerstarts im Prüfzeitraum, getrennte PIDs und unveränderten Registerbestand bei fehlender RPC nachweisen. Fünf neue lokale Supervisorprüfungen bestehen; keine abgeschlossenen QA-/Restoretests wiederholt.
- [ ] Produktionsschema und Export-/Ack-RPCs gezielt bereitstellen: sie fehlen weiterhin, alle echten Versuche sind `blocked_missing_backend` / HTTP 404. Keine bestätigte Produktionsauftragseintragung; `entries=0`/Ack 0 ist ausdrücklich kein solcher Nachweis.
- [ ] Echten Produktionsauftragseintrag/Ack und dessen Wiederanlauf erst bei einem tatsächlich autorisierten vorhandenen Auftrag belegen. Kein Testkonto oder Auftrag eigens erzeugt.
- [ ] Verpflichtenden externen Registerabgleich in tatsächliche Produktions-Restore-Isolation und Anwendungsfreigabe integrieren; installierter `restore-check` verweigert Freigabe, ist aber noch keine globale Zugangssperre. Kein Restore wiederholt.
- [ ] Bei erforderlicher kontinuierlicher Verfügbarkeit vorhandenen Server benennen; externe Alarmzustellung bleibt separat unbelegt. Macjobs laufen nur angemeldet/wach/mit zugänglicher Keychain.

Produktion bleibt `ACTIVE_HEALTHY`, Schema-/RPC-/Schedulerprojektion unverändert; kein Worker, keine Produktions-DDL/-Secrets, kein Versand. QA-Register und ursprüngliche Belege erhalten. [Betriebsort, Ausführung, Überwachung, Ausfallreaktion und genaue Nachweisgrenzen](deletion-production-registry-runtime-20261002.md).


## Consent-Einzelauftrag 02.10.2026 – Inventarlücke im Kandidaten geschlossen

Der aktuelle Consent-Schreibpfad und alle sechs Relationen sind frisch lesend geprüft. Die vier Nutzerrelationen sind jetzt in einer **neuen additiven neunten Migration** klassifiziert, mit explizitem Konto-/Resetumfang, monotone Revisionsuntergrenze, idempotentem Reset, Annahme-/Schreibsperren und erweitertem Fingerprint. Gemeinsame `settings`/`documents` bleiben erhalten. 16 neue lokale PostgreSQL-Prüfungen einschließlich zweier paralleler Verbindungen bestehen. Acht historische Löschquellen, zwei Consent-Quellen, 173 Originalbelege und drei bekannte unabhängige Register-/Bootstrapdateien bleiben erhalten. Das ursprüngliche `implementation.json` wurde nicht umgeschrieben.

- [x] Aktuellen Consent-Katalog, tatsächliche SQL-Schreiber, ACLs und ausgeschalteten Produktionsstand prüfen; QA-Fall unverändert bestätigen.
- [x] Konto-/Reset-, Revision-/Retry- und Zugriffsschutzregeln als gezielten **ausgeschalteten** Kandidaten vorbereiten und lokal prüfen: 122 Guards, 140 Regeln, neun exakte Löschquellen.
- [x] Consent-Belegzweck/Minimalumfang und tatsächlich fehlende Betreiberentscheidungen mit Empfehlung dokumentieren; keine pauschale Übernahme der 90-Tage-Löschbelegfrist.
- [ ] Für eine ausgeschaltete Bereitstellung neuen Einzelauftrag für die neunte Ergänzung erhalten; Ziel, vollständigen Katalog und isolierte Bundles unmittelbar davor erneut lesen, dann bereitstellen und aus/inaktiv verifizieren.
- [ ] Vor späterer Annahme Reset-Neueinwilligung und notwendigen Consent-Belegumfang nach Ende der Verarbeitung entscheiden. Empfehlung: alte Choices entfernen, nur erhöhte technische Revision behalten; ohne konkrete begründete Ausnahme keine Consent-Belege nach der Erasure halten. Policy bleibt bis dahin `unapproved`, Freigeber/Zeit NULL.
- [ ] Produktionsregister-Endpunkte und echter Eintrag/Ack/Wiederanlauf, Restore-/Ingressbindung, Edge-Endpointabnahme, SMTP/RevenueCat/Alarm sowie aktuelle Inventar-/Modusfreigabe separat abschließen; eigener Aktivierungsauftrag nötig.

Keine Produktions-/QA-Bereitstellung, Nachricht, Aktivierung, Kontolöschung oder Restore. Die abgeschlossenen Geräte-/Lösch-/Restore-/Replay-/QA-Registertests wurden nicht wiederholt. Zehn QA-Anbieterfälle und unbekannte Kopien bleiben offen. [Consent-Inventar, Kandidat und genaue Restbedingungen](deletion-consent-inventory-20261002.md); [frischer Read und Abschluss](../../output/deletion-consent-inventory-20261002/2026-10-02T09-14-51-996Z/completion.json).
