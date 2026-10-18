# Aktuelle Fortschreibung – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Jans supervised-Entscheidung in Produktion gespeichert

Produktionsmodus tatsächlich `supervised`, `backup_window_days=NULL`, Löschbelegfrist 90 Tage und genehmigte Consent-Resetregel. Die gesonderte technische Inventarfreigabe bleibt NULL, Readiness false, Annahme/Worker aus. Die reale Produktionsalarmüberwachung ist aktiv; sie ersetzt weder einen nichtleeren Produktionsregister-Ack noch die restorefeste Ingress-Sperre.

Zehn bekannte Anbieter-/Inhaltsfälle bleiben `pending`, B weiterhin `needs_attention/providers`. Unbekannte Kopienbedingungen werden beaufsichtigt bearbeitet; sie begründen keine erfundene Backupfrist oder Gesamtabschluss. RevenueCat `completed` gilt nur für den belegten aktiven Kundenbestand, Apple `not_applicable` nur für den belegten E-Mail-Anmeldewiderruf. Nach tatsächlicher technischer Abnahme darf der bereits genehmigte supervised-Modus mit diesen offen ausgewiesenen Fällen kontrolliert aktiviert werden; aktuell fehlen die zwei im Abschlussbericht benannten Gates.

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Beaufsichtigter Löschbetrieb und unabhängiges Register – QA-Stand vom 01.10.2026

Der Betreiber hat die Festlegung der Löschregeln und ihre Umsetzung beauftragt. Dieser Zusatz konkretisiert die [Betriebspolicy](deletion-policy-20261001.md) und die [Anbieterprüfung](deletion-provider-closure-20261001.md). Die beiden neuen Migrationen sind nach bestandenem echten Native-Worker-Test und Cleanup gezielt in der Familien-QA angewendet. QA bleibt ausgeschaltet, `unapproved`, ohne Freigabe oder Fristen. Der eigentliche native Test erfolgte vorher auf seinen sechs bisherigen Migrationen; QA hat jetzt acht effektive Migrationen. Produktion besitzt weiterhin kein Löschschema oder Produktionsregister; es wurde nicht aktiviert.

Aktualisierung der Anbieterbearbeitung: Der ursprüngliche Worker-/Register-Nachweis unten hielt elf offene Fälle fest. Die spätere [Bestandsprüfung](deletion-provider-closure-20261001.md) hat ausschließlich Apple für den E-Mail-Testfall administrativ als `not_applicable` abgeschlossen; zehn Fälle bleiben offen. Der Auftrag bleibt `needs_attention`, QA `unapproved` und der Worker aus. Unbekannte Fristen und unabhängige Registereinträge wurden nicht verändert.

## Ausdrücklicher Betriebsmodus

| `provider_handling_mode` | Annahmebedingung | Unbekanntes Wiederherstellungsmaximum |
| --- | --- | --- |
| `unapproved` | Keine Annahme; Ausgangswert der Migration. | Bleibt `NULL`. |
| `supervised` | Aktuell geprüfter Inventar-Fingerprint, benannter Freigeber, gespeicherter Zeitpunkt ohne Zukunftsdatum, positive Belegfrist und vorhandener Zugriffshook. Zusätzlich die tatsächlichen Betriebsnachweise aus dem Rolloutplan. | Darf `NULL` bleiben. Belege werden dann nicht automatisch bereinigt. Anbieterfälle bleiben einzeln offen. |
| `verified_retention` | Dieselben Bedingungen; zusätzlich tatsächlich belegtes positives `backup_window_days`. | Ein unbelegter Zahlenwert erfüllt die Betriebsfreigabe nicht. |

Der neue Modus fließt in den Inventar-Fingerprint ein. Ein Wechsel macht die bisherige Freigabe ungültig. Auch ein direkter Service-/Support-Aufruf von `accept` prüft Name, Datum und Modus; die Einfüge-Trigger sind kein Ersatz für diese Prüfung. Die festgelegte eigene Belegfrist beträgt weiterhin 90 Tage nach belegtem Gesamtabschluss. Sie ist keine Anbieter-Backupfrist. Weder sieben Tage Tarifentitlement noch 30 oder 90 Tage werden als unbekanntes Gesamtmaximum eingesetzt.

Die Annahme sperrt Zugang und verspätete Schreibzugriffe und beendet bestehende Sitzungen. Die ersten weiteren zerstörerischen Worker-Schritte beginnen erst nach dem unabhängigen Register-Ack. Die Annahmebestätigung bedeutet daher weder vollständige lokale Löschung noch Gesamtabschluss.

## Pflichtfälle vor Gesamtabschluss

Jede Annahme erzeugt die zwölf Pflichtfälle `revenuecat`, `apple`, `openai`, `sentry`, `push`, `support_mail`, `shop`, `external_logs`, `convex_legacy`, `backups`, `shared_content` und `storage_cdn`. Für einen Datenreset bleiben die dafür erhaltenen Auth-/Abofälle ausdrücklich als nicht anwendbar bestehen. `verify` prüft auch die Existenz aller zwölf Zeilen; eine fehlende `backups`-Zeile kann keinen Abschluss ermöglichen.

`pending` oder fehlende Pflichtfälle verhindern `completed`. `retention_pending` bleibt auch nach dem Prüftermin offen; der Termin bezeichnet eine nötige erneute Prüfung. `completed` verlangt für jeden Pflichtfall tatsächlich abgeschlossene Bearbeitung oder belegte Nichtanwendbarkeit. Eine UUID-Entfernung allein beweist keine Anonymisierung kopierter Inhalte. Die bestehenden Schutzprüfungen für gemeinsame Babys, fremde Medien, öffentliche Inhalte sowie Moderations-/Auditkopien bleiben erhalten.

Jan betreut diese Fälle täglich über support@lottibaby.de gemäß der Betriebspolicy. Bekannte Wiederherstellungsstände, weitere Kopien, Bearbeiter, nächster Prüftermin und tatsächliche Endbedingung gehören zum Fallnachweis. Der fehlende globale Anbieterhöchstwert wird nicht durch eine bloße Statusänderung ersetzt.

## Dauerhaftes Register vor dem Worker

Der bisherige einmalige Restore-Test hielt nur seine eigenen markierten Testidentitäten außerhalb der Sicherung. Er bewies keinen dauerhaften Export künftiger Produktionsaufträge. Dafür ist jetzt ein eigener Kandidat vorhanden:

- `account_deletion_registry_export()` ist nur mit Service-Rolle aufrufbar. Pro Auftrag enthält der Export ausschließlich Auftrags-ID, interne Kontokennung, Umfang, gespeicherten Annahmezeitpunkt in UTC und SHA-256-Digest. Projektursprung und Formatversion stehen am Dokument.
- Der Digest bindet Projektursprung, Auftrags-ID, Kontokennung, Umfang und den unveränderten gespeicherten UTC-Annahmezeitpunkt. Ein Worker-Neustart erzeugt dafür keinen neuen Zeitpunkt.
- `scripts/account-deletion-registry.mjs` schreibt in ein ausdrücklich ausgewähltes Verzeichnis außerhalb des Repositories und der Supabase-Sicherung: Betreiber-Eigentum, Verzeichnis `0700`, reguläre Datei `0600`, keine Symlinks oder Hardlinks. Ein exklusives Verzeichnislock verhindert verlorene Einträge durch parallele Writer.
- Schreiben erfolgt über eine neue temporäre Datei, Datei-`fsync`, atomaren Austausch, Verzeichnis-`fsync` und exakten geschützten Readback. Erst danach bestätigt der Writer jede tatsächlich gespeicherte Exportzeile über `account_deletion_registry_ack` mit ihrem gebundenen Digest und einem benannten Bearbeiter.
- `claim` gibt ohne passendes Ack keinen Auftrag an den Edge-Worker. Damit können dessen externe Auth-Sperre oder Storage-Löschung nicht vor dem Register-Nachweis beginnen. Die zerstörerischen SQL-Phasen prüfen zusätzlich das Ack und eine vorhandene aktuelle Lease mit nicht leerer, nicht abgelaufener Deadline. Ein frei gesetzter Zeitstempel allein reicht nicht.
- Ein leeres oder älteres wiederhergestelltes Datenbanksnapshot entfernt niemals vorhandene externe Registerzeilen. Wiederholte Annahme und Wiederanlauf nach einem fehlgeschlagenen Ack gleichen dieselbe Auftragsidentität ab. Abweichende Identität, Ursprung oder Umfang werden abgewiesen.

Der Writer ist ein lokaler Operatorlauf mit `--once`. In QA ist jetzt ein tatsächlicher externer Pfad für genau den bereits bekannten markierten Auftrag B belegt: `/Users/janzeppenfeld/.local/share/lottibaby-deletion-qa/durable-writer-20261001/deletion-registry-v1.json`. Erstschreiben und erneuter Lauf in einem getrennten Prozess sind bestanden, mit Dateirechten `0600`/Verzeichnis `0700`, dauerhaftem Readback, erhaltenem Eintrag und gültigem gebundenem Ack. Die unabhängige Liveprüfung bestätigt acht exakte Function-Bodies, Service-only Export/Ack, unveränderte Controls/Anbieter/Scheduler und keine Lease. Es wurde kein Claim ausgeführt; elf Anbieterfälle bleiben offen und QA bleibt `unapproved`/aus.

Ein tatsächlicher **Produktionspfad**, geschützte regelmäßige Ausführung und Credential-Versorgung sind weiterhin **nicht eingerichtet**. Der QA-Erstschreib-/Neustartnachweis wird nicht als Produktionsinstallation ausgegeben. Quellcodeexistenz oder ein SQL-Zeitstempel ersetzen diese Betriebsnachweise nicht. Vor globaler Aktivierung müssen sie konkret vorliegen. Wenn der Writer nicht erreichbar ist, bleiben angenommene Aufträge vor `claim` stehen und müssen im Alarm-/Betreiberbetrieb behandelt werden.

Ein normaler Transportfehler gibt das Writerlock wieder frei; der folgende Lauf liest die bereits dauerhaft gespeicherten Einträge und holt das fehlende Ack nach. Nach einem abrupt beendeten Prozess kann ein Lock zurückbleiben. Es wird nicht automatisch gelöscht: Betreiber muss Eigentum, PID/Nonce und das Ende des alten Prozesses prüfen und ausschließlich dessen geschützte Lockdatei und Lockverzeichnis entfernen. Die Registerdatei bleibt erhalten. Ungeprüftes `rm -rf` ist kein Wiederanlaufverfahren.

## Wiederherstellung und Aufbewahrung

Vor jedem Anwendungszugriff auf wiederhergestellte Bestände bleibt die Umgebung isoliert. Das unabhängige Register wird vollständig abgeglichen, betroffene Identitäten werden gesperrt und ihre Löschung wird erneut angewendet. Erst danach kann Anwendungseintritt geöffnet werden. Ein mitrestauriertes altes Ack ist kein Nachweis dieses Abgleichs. Der bereits bestandene verwaltete Restore-Test wird dadurch nicht wiederholt; neue Testprojekte sind nicht vorgesehen.

Bei `backup_window_days=NULL` entfernt der SQL-Purge auch einen seit 500 Tagen abgeschlossenen Beleg mit gültigem Register-Ack nicht. Bei bekanntem Maximum verlangt er weiterhin den Ablauf beider Fristen. Die externe Datei besitzt keine automatische Löschroutine: der Ablauf eines Datenbankbelegs entfernt keinen unabhängigen Registereintrag. Nötige externe Einträge werden fallbezogen bis zur belegten Endbedingung gehalten und mindestens wöchentlich auf Zweck und Entfernung geprüft; ein unbekanntes Fenster erhält keinen erfundenen Endtermin.

## Belegte Prüfungen und Grenze

Die neue Modusmigration hat elf lokale SQL-Tests bestanden, einschließlich direkter Annahme ohne gültige Freigabemetadaten, fehlender Pflichtzeilen, unveränderter `NULL`-Purge-Sperre und bestehender Zugangssperren. Zwölf Registertests prüfen reale temporäre Dateien außerhalb des Repositories, Ack-Reihenfolge, Wiederanlauf, falsche Digests, Dateiberechtigungen, Links, korrumpierten Readback, konkurrierende Writer und die Abweisung direkter Workerphasen ohne gültige Lease selbst nach echtem dauerhaftem Ack. Der aktuelle Edge-Worker wird mit echter lokaler SQL-Claim-Barriere ausgeführt: ohne passendes Ack keine Auth-Sperre und kein privater Schreibzugriff.

Zusätzlich bestehen die 19 ursprünglichen SQL-Regressionsfälle mit allen acht Migrationen. Diese Regression simuliert bereits bestätigte synthetische Register-Acks; die echte Dateidauerhaftigkeit wird gesondert durch die Registertests geprüft. Vier Tests prüfen die gesamte ausgeschaltete, atomare Produktionsvorbereitung einschließlich Abbruch bei Schema-/Hook-/Legacy-RPC-Abweichungen. Diese lokalen Suiten führten keine echten Anbieteraufrufe, Kundenexporte oder Löschungen aus. Der spätere tatsächliche Native-Test, QA7/8-Apply sowie externe QA-Writerlauf sind gesondert belegt: [QA-Stand und Nachweise](deletion-qa-registry-staging-20261001.md). Sicherheits-Advisors bleiben 372/372 ohne neue Befunde. Der [konkrete Rolloutplan](deletion-production-rollout-20261001.md) hält die verbleibenden Produktionsschritte fest; QA-Nachweise erteilen keine Produktionsfreigabe.


## Aktueller Abgleich 02.10.2026

Der [frische QA-Abgleich](../../output/deletion-status-20261002/qa-case-current.json) bestätigt unveränderte Einstellungen (`unapproved`, Freigabe/Fristen `NULL`) und unveränderte Auftrags-/Anbieterprojektionen mit zehn offenen Fällen. Der Worker ist aus. Die beiden dokumentierten externen Registerdateien sind nach Hash und Rechten erhalten; der gespeicherte Datenbank-Ack-Digest entspricht dem bestehenden externen Eintrag. Kein Registerwriter oder Neustarttest wurde wiederholt.

Der Produktionspfad/-Writer ist damit weiterhin nicht belegt. Das neue produktive Schema `consent_private` ist zusätzlich im Inventar zu berücksichtigen; QA-Nachweise decken dessen Konto-/Datenreset-/Sperrverhalten nicht ab. Unbekannte Wiederherstellungs- und Kopienbedingungen bleiben offen und erhalten keine garantierte Löschfrist. [Aktueller Stand](deletion-current-status-20261002.md).


## Produktions-Einzelauftrag 02.10.2026 – vor Änderung abgebrochen

Die ausgeschaltete Produktionsbereitstellung war jetzt ausdrücklich erlaubt, wurde aber vor jeder Mutation wegen der frisch bestätigten vier Consent-Nutzerrelationen außerhalb des vorbereiteten Inventars abgebrochen. `deletion_private`, Modus-/Freigabeeinstellungen, neue Register-RPCs und Produktionswriter sind weiterhin nicht installiert. Das Enable-Secret fehlt; die neue Pipeline ist abwesend, die alte Legacy-RPC noch nicht neutralisiert. Kein claim, Ack, Registry-Writerlauf oder Kontolöschen.

Der aktuelle QA-Read bestätigt weiterhin `unapproved`, Readiness false, keine Freigabe/Fristen, B `needs_attention` / `providers`, zehn offene Anbieterfälle. Das unabhängige Register und ursprüngliche Erstschreib-/Neustart-/Restorebelege sind hashgleich erhalten und wurden nicht wiederholt. Consent-Belegaufbewahrung ist vor einem neuen Rollout ausdrücklich zu klären; die 90-Tage-Löschbelegregel wird nicht automatisch auf Consent-Ereignisse übertragen. [Konkrete Restbedingungen und private Sicherung](deletion-production-preflight-20261002.md).


## Register-Einzelauftrag 02.10.2026 – Macruntime installiert, Backend offen

Die Aussage „kein Produktionspfad/-Writer eingerichtet“ ist für die physische Macruntime jetzt überholt: externer Pfad, dedizierte Keychain-Credential und wiederkehrende Writer-/Monitorprozesse sind installiert. **Vollständiger Produktionsregisterbetrieb bleibt offen**, da `deletion_private` und Register-Export/Ack-RPCs fehlen. Echte Läufe erhalten HTTP 404, keine Bestätigung und keinen Workeraufruf. Die tatsächlich dauerhaft geschriebene Datei ist leer und nur ein lokaler Bootstrapbeleg.

Wiederanlauf, Ack-Reihenfolge, abgewiesene lebende Locks und erhaltene Einträge bei leerem Backend sind mit neuen lokalen Supervisorprozessen geprüft; dies ist keine Wiederholung der erledigten echten QA-/Restoretests und kein Produktions-Ack. Der installierte Restore-Prüfweg verweigert Anwendungsfreigabe und akzeptiert kein restauriertes Ack als Ersatz. Die Einbindung in tatsächliche Produktions-Restore-/Ingresswege bleibt offen. QA-Register und ursprüngliche Nachweise sind erhalten, Modus/Freigabe und Worker werden nicht aktiviert. [Konkreter Betrieb und verbleibende Voraussetzungen](deletion-production-registry-runtime-20261002.md).


## Consent-Einzelauftrag – zusätzliche unfreigegebene Policybedingung

Der neue additive Consent-Kandidat ist lokal geprüft: Konto entfernt vier Nutzerbestände; Datenreset entfernt Entscheidungen/Retrybelege/Ereignisse und bewahrt die erhöhte technische Revision. Annahme- und Consent-Schreiben teilen eine Identitätssperre. Gemeinsame Texte/Einstellungen und das Registerformat bleiben erhalten. Die neue Consent-Policy bleibt `unapproved`, Freigeber/Zeit NULL; auch beaufsichtigter Betrieb benötigt später deren ausdrücklich begründete Entscheidung und aktuelle Inventarfreigabe. Keine automatisch übertragene 90-Tage-Consent-Frist und kein neuer Gesamtabschluss.

16 neue lokale SQL-Prüfungen bestehen, Produktion/QA unverändert, zehn QA-Fälle weiterhin offen. Kein Writer-Neustart, Restore, Nachricht oder Aktivierung und keine abgeschlossenen Tests wiederholt. [Consent-Inventar, Kandidat und genaue Restbedingungen](deletion-consent-inventory-20261002.md); [frischer Read und Abschluss](../../output/deletion-consent-inventory-20261002/2026-10-02T09-14-51-996Z/completion.json).
