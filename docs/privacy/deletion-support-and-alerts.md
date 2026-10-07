# Aktuelle Fortschreibung – Erinnerungsmails 04.10.2026

Auf ausdrücklichen Nutzerauftrag sind die stündlichen Erinnerungen für die beiden bekannten unveränderten Anbieterfälle in QA und Produktion quittiert. Die offenen Lösch-/Anbieterstände bleiben erhalten; neue oder geänderte Fälle und technische Störungen lösen weiter Alarm aus. Beide Alarmcrons bestätigen am 04.10. 06:35 UTC HTTP200/`healthy=true`/`sent=false`. Maßgeblich ist der [Änderungs- und Prüfbericht](deletion-alert-reminders-20261004.md).

# Erhaltener Stand – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Produktionskanal und externer Alarm belegt

Produktions-SMTP nach nutzerseitigem Secret-Handoff erfolgreich: bezeichnete Testmail an `support@lottibaby.de` mit Bodyzeit 10:14:02.201 UTC tatsächlich als UID138 empfangen. Danach minütlicher Cloudcron aktiv; kontrollierte Pause des bestehenden Produktionswriters löste echten `registry_stale_over_3m=1`-Alarm um 10:21:00.400 UTC aus. Tatsächlich als UID140 ohne TEST empfangen und an Cloud-Netrequest13115 gebunden. Nach Wiederanlauf healthy/Netrequest13116; keine physische Macabschaltung behauptet.

Vorhandene Supportverantwortung bleibt erhalten. Reale Alarm- und Testmails sind Belege, keine OTP-Löschziele. Cloudüberwachung läuft unabhängig vom Mac; Macwriter braucht Benutzersitzung, Wachzustand und Keychain. Bei Alarm Writer-/Monitorzustand, Cloudhealth/netResponse und Postfachempfang prüfen; vorhandene Sperren, Aufträge und Register erhalten. Ohne echten Ack keine Destruktion. Annahme/Worker bleiben aktuell aus; Gate 1 Restoreisolation und Gate 2 echter Produktionsregisterfall offen.

Kopienfall Support-Mail bleibt `pending`: drei Original-OTPs bereits entfernt; derzeit keine Forwarder/Filter/Bcc/Alias/Catch-all. Hostinger-GDPR hat nur den Eingang bestätigt. Fachantwort zu Archiven, Backups und Logs fehlt; keine erneute Mailbereinigung.

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Support und Löschalarme – aktualisiert 01.10.2026

## Verantwortung und Kanal

Jan Zeppenfeld übernimmt Support und Löschalarme. Seine Ehefrau vertritt ihn bei ausdrücklich übergebenen Fällen und tatsächlich vorhandenem geschütztem Zugriff. Gemeinsamer Kanal: **support@lottibaby.de**. Das aktive Postfach hat am 30.09. die vereinbarte OTP-Mail, eine als Test gekennzeichnete Alarmmail aus dem verbundenen Geschäftspostfach und anschließend den tatsächlichen serverseitigen Hostinger-SMTP-Testalarm empfangen. Der OTP wurde für die exakte Wegwerfidentität verifiziert. Der QA-Alarmcron ist aktiv und sein erster geplanter gesunder Abruf ist belegt. Individuelle Leserechte der Vertretung sind noch nicht nachgewiesen; bis dahin bleibt Jan zuständig.

Auf ausdrücklichen Auftrag vom 01.10. festgelegter interner Ablauf: Montag bis Freitag morgens und nachmittags das Postfach prüfen, neue Löschanfragen spätestens am nächsten Arbeitstag aufnehmen und einen konkreten Antworttermin erfassen. Technische Alarme beim nächsten Prüffenster priorisieren; bekannte Zugriffs-/Datenschutzprobleme sofort behandeln. Bei Ausfall eine tatsächlich erreichbare Vertretung ausdrücklich einbinden. Keine 24-Stunden-Bereitschaft zugesagt. Aufbewahrung und Datenbehandlung gemäß [festgelegten Löschregeln](deletion-policy-20261001.md): minimaler abgeschlossener Beleg 90 Tage, unnötige Rohinhalte und Anhänge entfernen. Anbieteraufbewahrung gesondert nachweisen.

## Anfrage aufnehmen und abschließen

1. Ticket-ID, Eingang, gewünschter Umfang (`account` oder `data`), zuständige Person und Antworttermin erfassen. Keine Passwörter, OTPs oder Kinderdaten per E-Mail anfordern.
2. Identität über den bestehenden Kontozugang mit frischer Verifikation prüfen. Ohne Mailzugriff den geschützten Ersatzweg aus dem [Runbook](deletion-runbook.md) anwenden; ungeklärte Identität verhindert die Annahme.
3. Nach Betriebsfreigabe einen Supportauftrag mit dem serverseitigen Werkzeug `scripts/account-deletion-operations.mjs support` und einem minimalen Identitätsbeleg anlegen. Service-Schlüssel ausschließlich in der geschützten Betreiberumgebung halten. Die derzeitige Produktionsinstanz hat diesen neuen Dienst noch nicht.
4. Manuelle Provider-, Eigentums- und Aufbewahrungsfälle mit begründetem Beleg und gegebenenfalls Enddatum bearbeiten. Ein fremder Datensatz oder eine erste Anbieter-404 ist kein Löschbeleg. Ungeklärte gemeinsame Inhalte bleiben zur Prüfung angehalten.
5. Nur einen angenommenen Auftrag bestätigen; erst bei belegtem Gesamtabschluss die Löschung bestätigen. Konkrete verbleibende Fristen nennen. Store-Abos werden durch Kontolöschung nicht automatisch gekündigt.
6. Bei Vertretung Ticket-ID, Status, nächste Handlung und Termin im geschützten Bestand übergeben; keine privaten Inhalte in Alarmmails kopieren.

Eingangsantwort als Vorlage:

> Wir haben deine Löschanfrage erhalten und prüfen jetzt deine Identität und den gewünschten Umfang. Bitte sende uns keine Passwörter oder Anmeldecodes. Deine Referenz lautet [Ticket-ID]. Wir melden uns zum weiteren Ablauf. Ein vorhandenes Store-Abo verwaltest du separat im App Store oder bei Google Play.

Annahmeantwort als Vorlage:

> Dein Löschauftrag wurde unter [Referenz] angenommen und wird bearbeitet. Das bestätigt die Annahme; der Abschluss wird gesondert bestätigt. Falls gemeinsam genutzte Inhalte oder befristete Aufbewahrungen betroffen sind, informieren wir dich über die konkrete Behandlung.

Abschlussantwort als Vorlage, erst mit tatsächlichen Belegen:

> Die Löschung im Umfang [Konto / App-Daten] ist unter [Referenz] abgeschlossen. [Konkrete weiterhin befristet gehaltene Daten mit Zweck und Enddatum oder: Es wurden keine weiteren aktiven Restbestände festgestellt.] [Belegter Backup-/Exportablauf mit konkretem Enddatum.] Ein Store-Abonnement wird separat vom jeweiligen Store verwaltet.

## Technische Status- und Alarmprüfung

Lesende Prüfung, immer mit ausdrücklicher Umgebung:

```sh
node scripts/account-deletion-check.mjs --environment qa --out output/deletion-completion-20260930/qa-status.json
node scripts/account-deletion-check.mjs --environment production --out output/deletion-completion-20260930/production-status.json
```

Exit-Code 2 bedeutet fehlende Konfiguration oder handlungsbedürftige Alarmzähler. Exit-Code 1 bedeutet, dass die Prüfung nicht verlässlich ausgeführt werden konnte. `configured: true` bedeutet lediglich technische Konfiguration; `releaseApproved` bleibt ohne die gesonderten Abnahmen falsch. Nullzähler bei null Aufträgen belegen keinen erfolgreichen Löschbetrieb.

Der Alarmrunner verarbeitet ausschließlich Zähler: `needs_attention`, `queued_over_15m`, `expired_lease_over_7m`, `lease_exceeds_contract`, `overdue_retention`. Normale noch ausstehende Providerbelege sind informativ. Ein fehlgeschlagener Statusabruf erzeugt eine eigene Betriebsmeldung. Gleichbleibende Alarme werden mit einer privaten Statusdatei höchstens stündlich erneut versandt; ein wieder gesunder Zustand setzt die Wiederholungssperre zurück.

Prüfbare Testnachricht ohne Versand:

```sh
node scripts/account-deletion-alert.mjs --environment qa --test --dry-run
```

Für echten Versand benötigt der geschützte Runner `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465` (alternativ 587 mit STARTTLS), `SMTP_USER` und `SMTP_PASSWORD` aus seinem Secret Store. Das Supabase-Auth-SMTP-Passwort ist für diesen eigenständigen Runner nicht automatisch zugänglich. Niemals in Befehlsargumente, Git oder Ausgaben schreiben. Empfänger ist fest auf support@lottibaby.de begrenzt. SMTP-Annahme bestätigt noch nicht den Empfang.

Nach Versandfreigabe und sicherer Runner-Konfiguration:

```sh
node scripts/account-deletion-alert.mjs --environment qa --test
node scripts/account-deletion-alert.mjs --environment production --state /geschuetzter-betriebsbestand/deletion-alert-state.json
```

Zusätzlich ist `supabase/functions/account-deletion-alert` in QA bereitgestellt: fester Hostinger-SMTP-Host und Port 465 mit validiertem TLS, fester Absender/Empfänger support@lottibaby.de, vorhandenes starkes `ACCOUNT_DELETION_CRON_SECRET` für den Schedulerzugang. Die private Alarm-RPC ist ausschließlich für `service_role` ausführbar; normale Nutzer und anonyme Aufrufe sind abgewiesen. Die Wiederholungssperre besitzt eine zwei Minuten gültige Lease und speichert erst nach erfolgreichem Versand einen stündlichen Sperrvermerk. Keine Benutzerkennungen in Mails.

Der Betreiber hat `DELETION_ALARM_SMTP_PASSWORD` in QA-Edge-Secrets gespeichert. Der geschützte Test lieferte HTTP 200/sent=true; Mail 113 wurde im Supportpostfach mit passendem Prüfstempel 17:57:34 UTC tatsächlich empfangen. Der Cron `account-deletion-alert-qa` ist mit fünf Minuten Takt **aktiv**. Der erste geplante Lauf um 18:00 UTC ist erfolgreich und hat eine zeitlich passende HTTP-200-Antwort mit healthy=true/sent=false. Der bestehende Löschworker bleibt inaktiv. Nachweise: `output/deletion-completion-20260930/alarm-smtp-test.json`, `alarm-first-cron-run.json`, `alarm-scheduler.json`.

Für spätere Änderungen am Transport: `node scripts/check-qa-deletion-alarm.cjs --send-approved`, wirklichen Empfang im Postfach nachweisen und `actualDeliveryVerified=true` im zugehörigen Ergebnis festhalten. Anschließend `node scripts/configure-qa-deletion-alarm.cjs --activate-after-delivery`. Das Werkzeug verweigert Aktivierung ohne erfolgreichen geschützten SMTP-Test und tatsächlichen Empfang. Danach eine gesunde serverseitige Abfrage sowie die konkrete Cron-Ausführung prüfen. Der vorhandene Gmail-Kanaltest ersetzt diese Schritte nicht.

Für Medienfälle den Pflichtprovider `storage_cdn` anhand ursprünglicher URLs, erfolgreicher Cachebereinigung, tatsächlicher Nichtverfügbarkeit und belegter Browser-/CDN-Frist auflösen. Eine Purge-Antwort mit HTTP 200 allein ist nur Annahme beim Anbieter, kein Gesamtabschluss.

## Bei Alarm

- `needs_attention`: Im geschützten Betreiberbestand Fehlercode und Provider-/Eigentumsfall prüfen; mit belastbarem Beleg auflösen und erst dann fortsetzen.
- `queued_over_15m`: Runtime-Freigabe, Scheduler, Secret und Function-Erreichbarkeit prüfen. Kein pauschales Bestätigen des Schema-Fingerprints.
- Abgelaufene oder zu lange Lease: Laufzeit und Wiederanlauf prüfen; aktive Lease nicht umgehen, denselben Auftrag idempotent weiterführen.
- `overdue_retention`: Bestand beim benannten Provider tatsächlich bereinigen und Abschlussbeleg dokumentieren; Enddatum nicht lediglich nach hinten verschieben.
- Statusprüfung fehlgeschlagen: CLI-Zugang und explizite Projektbindung wiederherstellen; unbekannter Zustand ist kein erfolgreicher Nullbefund.

Antworten sind ohne unnötige Verzögerung und grundsätzlich innerhalb eines Monats ab Eingang zu verfolgen; dafür im Ticket einen konkreten Termin erfassen. Eine technische Alarmregel ersetzt diese Fristenkontrolle nicht. Quelle: [Europäische Kommission – Anfragen betroffener Personen](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en), am 30.09.2026 geprüft. Diese Antwortfrist bestimmt nicht die zulässige Aufbewahrungsdauer einzelner Datenklassen.
