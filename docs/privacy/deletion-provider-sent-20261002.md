# Aktuelle Fortschreibung – echter eigener Produktionsfall 02.10.2026

**Jans ausgewähltes bestehendes App-Konto ist im aktiven Auth-/Appinventar entfernt; echtes nichtleeres Produktionsregister, gebundenes Ack, Verweigerung ohne Ack und Writer-Neustart sind bestanden.** Neuer Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7` / Falltag `622323b692d7` bleibt wegen elf offenen Anbieterfällen `needs_attention` / `providers`. Apple N/A betrifft ausschließlich Sign-in-Widerruf. Die Restoregrenze hat Jan für den Einzeltest zurückgestellt; sie bleibt unbelegt. Öffentliche App-/Webannahme und Cloudworker weiterhin aus, temporäre technische Freigabe wieder NULL, Readiness false und Consent aus. Keine globale Releaseabnahme. Maßgeblich: [neuer Realfallbericht](deletion-real-account-test-20261002.md) und [neuer maschinenlesbarer Stand](../../output/deletion-closure-execution-20261002/root/real-account-completion.json).

Die folgenden früheren Fortschreibungen sind erhaltene historische Stände. Ihre damaligen Null-Auftrags-/Null-Ack-/Freigabeaussagen gelten nicht für den neuen Realfall; Originalnachweise bleiben unverändert.

---

# Aktuelle Fortschreibung des Löschbetriebs – 02.10.2026

**Aktueller Status nach dem autorisierten Abschlussauftrag:** ausgeschaltet in Produktion bereitgestellt, echter Produktionsmail-/Cloudalarmnachweis vorhanden, zwei konkrete technische Gates offen. Der produktive Löschweg ist für den nächsten Release **noch nicht bereit**. Maßgeblich sind der [konsolidierte Abschlussbericht](deletion-execution-closure-20261002.md) und der [maschinenlesbare Gesamtstand](../../output/deletion-closure-execution-20261002/completion.json).

## Zusätzlicher tatsächlicher Versand im Abschlussauftrag

| Anbieter / Kanal | Tatsächlicher Versand | Umfang und Ergebnis |
| --- | --- | --- |
| OpenAI, vorhandener authentifizierter Help-Chat | 02.10.09:50:36.100 UTC; Eskalation im selben Verlauf 09:51:41.854 UTC | Minimale Herkunfts-/Kopienfrage mit vorhandenen Org-/Projekt-/Objekt-/Key-Tracking-IDs, keine Schlüssel/Prompts/Antworten/Anhänge. Generische KI-Antwort unpassend; menschliche API-/Datenschutzprüfung angefordert, Übernahme nicht bestätigt/Referenz offen. [Versandbeleg](../../output/deletion-closure-execution-20261002/history/openai-request-delivery.json) |
| Supabase, bestehender Gmail-Verlauf SU-492245 | 02.10.09:54:15.445 UTC, nachgelesen 09:54:38.822 UTC | Ausschließlich neu auftretende Restore-/Ingress-Isolationsanforderung ergänzt, kein zweites Ticket/kein Anhang; konkrete allseitige Control-Plane-Sperre ohne Tarifwechsel offen. [Versandbeleg](../../output/deletion-closure-execution-20261002/supabase/support-restore-ingress-delivery.json) |

Die inzwischen vom Nutzer bereitgestellte Sentry-Fachantwort nennt **215476206908813**, 30 Tage aktive Aufbewahrung ab Empfang und fehlende Einzelereignislöschung; eine genaue Backup-/Archivendbedingung für die fünf Ereignisse bleibt offen. RevenueCat86137 „Waiting on support“, Supabase-Eingangsbestätigung und Hostinger-GDPR-Ack um 09:41 Europe/Berlin liefern bisher keine konkreten Kopienendbedingungen. Vorhandene Fragen wurden nicht doppelt gesendet. Die vier ursprünglichen Anfragen und ihre Originalbelege bleiben unten erhalten; OpenAI ist ein zusätzlicher Anbieterfall.

## Neue Sentry-Antwort – Ticket 215476206908813

Quelle zunächst Nutzertranskription in diesem Chat, danach im vorhandenen authentifizierten Jan-Gmail-Verlauf lesend bestätigt: Stella `<support@sentry.io>`, Ticket **215476206908813**, angezeigtes Maildatum 02.10.2026 12:25, Zeitzone in Maildetails nicht unabhängig ausgewiesen. Keine daraus abgeleitete UTC-Empfangszeit, erfundene RFC822-Message-ID oder sekundengenaue Empfangszeit. [Gesicherte Antwort, Quellen und lesender Zuordnungsabgleich](deletion-sentry-support-response-20261002.md). Keine durch die Antwort bestätigte Löschung oder Anbieteränderung. Die fünf Ereignisse bleiben `pending`; Prüfung etwa 31.10.2026, konkret nach 13:35 UTC / 14:35 MEZ. Fehlende fallbezogene Backup-/Archivendbedingungen sind als [minimaler Folgeentwurf](../../output/deletion-sentry-support-20261002/followup-draft.txt) im selben Ticket vorbereitet, **nicht gesendet**. Diese Antwortauswertung hat keine neue Nachricht, Ticketanlage oder Automation ausgelöst.

## Erhaltener historischer Dokumentstand vor diesem Abschlussauftrag

Die folgenden Abschnitte und ihre damaligen Statusaussagen bleiben zur Nachvollziehbarkeit erhalten. Für heutige Aufgaben und Aktivierung gelten ausschließlich die aktuelle Fortschreibung oben und der Abschlussbericht; alte „nicht bereitgestellt“-/Zugangs-/Vorbereitungsangaben sind keine aktuellen Befunde.

### Versandjournal der vier Anbieteranfragen – 02.10.2026

Der Nutzer hat den Versand der vorbereiteten Anfragen an Sentry, Supabase, RevenueCat und Hostinger ausdrücklich beauftragt. Das ist der gesonderte Versandauftrag zur zuvor rein lesenden Inventur. Die ursprünglichen Entwürfe und Eingangsfassungen bleiben unter dem [Preservation-Index](../../output/deletion-provider-followup-20261002/root/input-preservation.json) erhalten. Angepasste Texte berücksichtigen die separate Audit- und Testmailbereinigung.

**Kein Löschabschluss.** Alle zehn Restkopienfälle bleiben pending. Keine Datenlöschung, kein erneuter RevenueCat DELETE, keine Abo-Kündigung, kein Restore, kein gemischtes Sentry-Issue, keine Kosten-/Tarifänderung und keine neue Projektzugriffsfreigabe beauftragt. Übermittelt wurden ausschließlich notwendige Provider-/Projekt-/Objekt- und Falllocators; keine Schlüssel, OTPs, Rohmails, Logkörper oder vollständigen Postfach-/Nutzerexporte. Keine Anhänge.

Die UTC-Zeit mit Millisekunden wurde unmittelbar vor der jeweiligen Sendekontrolle aufgezeichnet; Anbieter-UIs bestätigen Versand/Empfang und zeigen teils nur Minutenauflösung. Europe/Berlin hat hier UTC+02:00. [Maschinenlesbares Journal und Texthashes](../../output/deletion-provider-followup-20261002/root/delivery-log.json).

| Anbieter | Versand UTC / Europe/Berlin | Referenz | Offene Antwort |
| --- | --- | --- | --- |
| sentry | 2026-10-02T07:18:07.175Z / 2026-10-02T09:18:07.175000+02:00 | numerische Referenz noch nicht genannt; bestehender Verlauf gesichert | Versand und Empfang bestätigt; AI am 09:19 Berlin ohne konkrete Fristen; Folgemitteilung im selben Verlauf; am 09:26 Berlin Weiterleitung an Tier-1 Konto und Abrechnung bestätigt. Menschliche Fachantwort und numerische Ticketreferenz offen. |
| supabase | 2026-10-02T07:19:41.390Z / 2026-10-02T09:19:41.390000+02:00 | SU-492245 | Dashboard Support request sent, Mailack von support@supabase.com am 09:21 Berlin. Konkrete Antwort zu Audit-/Log-/Backup-/Storagebedingungen offen. |
| revenuecat | 2026-10-02T07:17:06.390Z / 2026-10-02T09:17:06.390000+02:00 | 86137 | Ticketdetail bestätigt exakten Nachrichtentext und Waiting on support. Schriftliche Archiv-/Backupbedingungen offen; aktive Kundenentfernung vom 01.10. bleibt getrennt abgeschlossen. |
| hostinger | 2026-10-02T07:25:03.196Z / 2026-10-02T09:25:03.196000+02:00 | numerische Referenz noch nicht genannt; bestehender Verlauf gesichert | Nachricht im Chat sichtbar. AI nennt passende Zustell- und drei Trash-Entfernungsvorgänge ohne Message-IDs, keine exakte Objektzuordnung oder Kopienfrist. Menschliche Prüfung abgeschlossen: die von Ray Conchas geprüfte Antwort 09:35 Berlin verweist an gdpr@hostinger.com. An diesen bestätigten Datenschutzkanal weitergegeben; konkrete Fachantwort und Ticket-/Konversationsreferenz offen. |

## Sentry: Kanal, Zuordnung und Vorprüfung

Empfänger: **support@sentry.io**. Kanal: authentifiziertes Gmail an support@sentry.io. Authentifiziertes Konto: jan.niklas.zeppenfeld@gmail.com. Scope: jan-zeppenfeld / lotti-baby / 4509762120056832; exakt fünf Ereignisse im gemischten Issue 7753273592.

Vorprüfung auf Doppelanfragen: Vor Versand allzeitige in:anywhere-Suche im authentifizierten Jan-Postfach nach support@sentry.io, compliance@sentry.io, support@supabase.com und konkreter Event-/Request-ID: 0. Breitere Provider-/Fallwortsuche zeigte nur drei nicht zugeordnete generische Backup-/Marketingnachrichten. Verbundener Gmail-Connector ist anderes Konto; dort begrenzte Suche 0, kein universeller Ticketbeleg.

Status: Versand und Empfang bestätigt; AI am 09:19 Berlin ohne konkrete Fristen; Folgemitteilung im selben Verlauf; am 09:26 Berlin Weiterleitung an Tier-1 Konto und Abrechnung bestätigt. Menschliche Fachantwort und numerische Ticketreferenz offen. [Bestehender Verlauf](https://mail.google.com/mail/u/0/#search/in%3Aanywhere+%7Bto%3Asupport%40sentry.io+from%3Asupport%40sentry.io+to%3Acompliance%40sentry.io+from%3Acompliance%40sentry.io+to%3Asupport%40supabase.com+from%3Asupport%40supabase.com+%225a5061db18f04c9389f32a91654f6e14%22+%226434ecdb-7d04-482d-a709-fd991932c142%22%7D/QgrcJHsNpWsmkQVTxDHkjRZCxhrrXVRWWmb).

Betreff: Einzelereignis- und Backupbedingungen – LottiBaby / LOTTI-BABY-3S

Exakt gesendeter Nachrichtentext:

```text
Guten Tag Sentry Support,

für die bestehende Organisation jan-zeppenfeld, Projekt lotti-baby (4509762120056832), benötigen wir eine begrenzte Klärung nach Löschung eines markierten QA-Kontos. Im gemischten Issue 7753273592 / LOTTI-BABY-3S sind genau diese fünf Ereignisse vom 01.10.2026 positiv dem Fall zugeordnet und aktuell noch sichtbar:

5a5061db18f04c9389f32a91654f6e14 – 13:34:09 UTC
600f45fed17d4cb0a9b1aa153d96d026 – 13:06:37 UTC
c916cf6b7afe4c53b341cf86aebac5d0 – 13:06:37 UTC
442bf991f306499b8b59ee2b2339f180 – 12:55:41 UTC
6f2172070efe44d58c8c0789cbb39960 – 12:53:24 UTC

Das Issue enthält aktuell 48 Ereignisse und 15 Nutzerkennungen. Bitte weder dieses gemischte Issue noch das Projekt oder andere Ereignisse löschen. Diese Anfrage beauftragt keine Löschung.

Bitte beantworten Sie ausschließlich für die fünf genannten IDs:
1. Ist eine auf genau diese Ereignisse begrenzte Behandlung möglich, und wie wäre deren aktiver Endzustand belegbar, ohne andere Ereignisse zu ändern?
2. Welche beim Eingang geltende Aufbewahrung wird angewendet, und welche zugehörigen Backup-/Archivarten, Erstellungszeitpunkte, Fristbeginne, tatsächlichen Endbedingungen und Ausnahmen gelten bei fortgesetzter Nutzung? Ein Tarifwert allein genügt nicht als Nachweis aller Kopien.
3. Bestehen weitere Anhänge, Replay-Verknüpfungen, abgeleitete Kopien oder historische Weiterleitungen zu genau diesen Ereignissen, die in den geprüften Ereignis-/Issue-Tabs nicht sichtbar sind?

Bitte keine kostenpflichtige Zusatzleistung, Tarif-/Kontoumstellung oder pauschale Projektmaßnahme auslösen. Benötigt werden schriftliche bestehende Bedingungen und die Möglichkeiten einer begrenzten Behandlung. Bitte bestätigen Sie die Anfrage mit einer Ticketreferenz. Eine Anfrage oder Antwort wird nicht als Löschabschluss gewertet.

Vielen Dank
Jan Zeppenfeld
LottiBaby
```

[Originaltext](../../output/deletion-provider-followup-20261002/root/sentry-request.txt); SHA-256 des Bodys `f1b88a014e46992128d152685856c4642e0d417d9ba2eb7b9176ba688e000874`.

[Versand-/Bearbeitungsbild](../../output/deletion-provider-followup-20261002/root/sentry-confirmed.jpg).

## Supabase: Kanal, Zuordnung und Vorprüfung

Empfänger: **Supabase authenticated dashboard support / support@supabase.com**. Kanal: authentifiziertes Supabase-Dashboard: Contact support, Type Other, Severity Low; services optional leer. Authentifiziertes Konto: jan.niklas.zeppenfeld@gmail.com. Scope: Org xqbmotyjxjdeqoisbgow; Formular-Parent kwniiyayhzgjfqjsjcfu; tatsächlicher Fall ausschließlich Branch ggyonianphloycmqrwvj / 917136d3-49fb-463b-9026-30e62b9533a5.

Vorprüfung auf Doppelanfragen: Kein Verlauf im Dashboardformular verfügbar. Jan-Postfach allzeitige enge Suche nach support@supabase.com und Falllocators 0 vor Versand; lokale ursprüngliche Entwürfe als ungesendet datiert. Keine umfassende Ticketabwesenheit behauptet.

Status: Dashboard Support request sent, Mailack von support@supabase.com am 09:21 Berlin. Konkrete Antwort zu Audit-/Log-/Backup-/Storagebedingungen offen. [Bestehender Verlauf](https://mail.google.com/mail/u/0/#search/in%3Aanywhere+%7Bfrom%3Asupabase.com+from%3Asupabase.zendesk.com+%22QA-Einzelkontol%C3%B6schung%22%7D+after%3A2026%2F10%2F01/FMfcgzQhWfXrQHJZXptCBgRhdZtrlQKq).

Der voreingeschaltete Schalter Allow support access to your project wurde vor Versand ausgeschaltet; sichtbarer Wert 0, keine zusätzliche Human-/AI-Diagnosefreigabe.

Betreff: QA-Einzelkontolöschung: konkrete Audit-, Log-, Backup- und Storagebedingungen

Exakt gesendeter Nachrichtentext:

```text
Guten Tag Supabase Support,

bitte klären Sie für unsere bestehende Pro-Organisation xqbmotyjxjdeqoisbgow die Restkopien eines gelöschten markierten QA-Kontos im fortgesetzten Betrieb. Die Formularauswahl bindet den Parent kwniiyayhzgjfqjsjcfu; der konkrete Fall betrifft ausschließlich dessen bestehende Branch family-subscription-qa, Projektref ggyonianphloycmqrwvj, Branch-ID 917136d3-49fb-463b-9026-30e62b9533a5. Produktion ist kein Löschziel.

Minimale Fallkennung: dafbeb6f-b0b1-42f7-82dd-1adbab279d6d. Signup 30.09.2026 16:09:42.751888 UTC; Auth-Löschung 01.10.2026 13:48:38.120306 UTC. Die 18 exakt zugeordneten auth.audit_log_entries wurden am 02.10.2026 06:45:29.786 UTC gezielt entfernt und ihre Abwesenheit frisch bestätigt. Externe auth_audit_logs enthalten weiterhin die 18 zugeordneten Einträge; SQL-Purge ist kein externer Logpurge. Im ursprünglichen 24h-Fenster 30.09.15:40 bis 01.10.15:40 UTC sind weiterhin 479 UID-bezogene Logtreffer sichtbar; spätere gezielte Prüfungen erzeugen weitere Spuren.

Tatsächliche QA-Backupkandidaten im aktuellen Katalog:
1831779519 – 30.09.2026 23:24:17.655 UTC, nach Signup/vor Auth-Löschung;
1841321535 – 01.10.2026 23:26:18.089 UTC, vor Auditbereinigung.
Die Inhaltszuordnung ist zeitlich abgeleitet, kein erneuter Restore-Inhaltsnachweis. PITR ist aus. Sichtbare Tageskataloge und Sieben-Tage-Tarifwerte beweisen keine maximale physische Kopienfrist.

Das einzige zugeordnete Storageobjekt wurde bereits am 01.10.2026 13:48:30.965596 UTC am Origin entfernt und exakt im CDN gepurgt: Bucket community-images, Objekt avatars/avatar_dafbeb6f-b0b1-42f7-82dd-1adbab279d6d_native-deletion-20261001.png. Original-URL aktuell 400/NoSuchKey/BYPASS, Storage-Metadaten 0. Bitte keinen weiteren Purge ausführen.

Bitte schriftlich konkret beantworten:
1. Welche physischen Backups, WAL-/Replikat-, Snapshot- und Archivkopien können dieses QA-Zeitfenster einschließlich Auditrestkopien wiederherstellen? Welche tatsächlichen Ablauf-/Entfernungsbedingungen gelten für beide Backup-IDs und spätere Kopien; wie wird der Endzustand nachweisbar?
2. Welche getrennten Aufbewahrungs-/Löschbedingungen, Fristbeginne, Endbedingungen und Ausnahmen gelten für externe Auth-Auditlogs sowie interne Auth-/Gateway-/Security-/Traffic-/Observabilitylogs nach Einzelnutzerlöschung und SQL-Auditbereinigung? Gibt es fallbezogene Bestätigungen und bekannte historische Drains-/Exportkopien? Aktuell sind keine Dashboard-Drains konfiguriert.
3. Welche internen Storage-Datei-, Wiederherstellungs- oder Replikatkopien bleiben nach Origin-DELETE und bestätigtem exaktem CDN-Purge, und welche belegbare Endbedingung gilt außerhalb separater Clientkopien?

Keine Löschung, kein Restore, kein neues Backup/Projekt, keine kostenpflichtige Leistung und keine Tarifänderung beauftragt. Projektbetrieb und minimales unabhängiges Löschregister bleiben bestehen. Bedingungen zum Vertragsende ersetzen keine Einzelfallfrist bei fortgesetzter Nutzung. Bitte Ticketreferenz angeben; Versand ist kein Löschabschluss.

Vielen Dank
Jan Zeppenfeld
LottiBaby
```

[Originaltext](../../output/deletion-provider-followup-20261002/root/supabase-request.txt); SHA-256 des Bodys `e4d173fb3daa82fd9fc5c05f498d1acbddb745cbbf49e3187d62c0db20723c93`.

[Versand-/Bearbeitungsbild](../../output/deletion-provider-followup-20261002/root/supabase-ticket.jpg).

## Revenuecat: Kanal, Zuordnung und Vorprüfung

Empfänger: **RevenueCat authenticated Help center / Lotti Baby**. Kanal: authentifiziertes RevenueCat Help center / Lotti Baby; Affected App User IDs genau Fall-UID, SDK optional leer. Authentifiziertes Konto: anyhelptoolate@gmail.com. Scope: Lotti Baby, Dashboard 46375297 / API proj46375297.

Vorprüfung auf Doppelanfragen: Get Help zeigte vor dem Versand No support tickets to display im authentifizierten Konto. Projektzuordnung Lotti Baby und Projektlink /projects/46375297/overview geprüft.

Status: Ticketdetail bestätigt exakten Nachrichtentext und Waiting on support. Schriftliche Archiv-/Backupbedingungen offen; aktive Kundenentfernung vom 01.10. bleibt getrennt abgeschlossen. [Bestehender Verlauf](https://app.revenuecat.com/settings/support/tickets/86137).

Betreff: Backup-/Archivbedingungen nach bereits bestätigter Kundenlöschung

Exakt gesendeter Nachrichtentext:

```text
Backup-/Archivbedingungen nach bereits bestätigter Kundenlöschung

Guten Tag RevenueCat Support,

für das bestehende Projekt Lotti Baby, API-Projekt-ID proj46375297 (Dashboard 46375297), benötigen wir ausschließlich eine schriftliche Klärung der internen Archiv-/Backupbedingungen.

Der exakt zugeordnete markierte QA-Kunde mit App User ID dafbeb6f-b0b1-42f7-82dd-1adbab279d6d wurde am 01.10.2026 um 13:48:56.423 UTC mit bestätigtem API DELETE und anschließender GET-404-Prüfung im tatsächlichen Löschworker entfernt. Dieser aktive Teilschritt ist abgeschlossen; seine ursprünglichen Nachweise bestehen.

Bitte KEINEN erneuten DELETE, keine Abo-Kündigung, keinen Refund und keine sonstige Änderung am Kunden-/Projekt-/Storebestand veranlassen. Diese Anfrage beauftragt keine Löschung.

Bitte benennen Sie für diesen bereits gelöschten Kunden bei fortgesetzter Projektnutzung:
1. Verbleibende Datenarten in internen Backups, Archiven, Replikaten oder sonstigen Wiederherstellungskopien.
2. Tatsächlichen Fristbeginn, konkrete Aufbewahrungsdauer bzw. überprüfbare Endbedingung, Ablauf betroffener Sicherungen und mögliche Ausnahmen.
3. Verfügbare kundenbezogene Nachweise des endgültigen Endzustands bzw. Bedingungen, unter denen Backupdaten nur isoliert aufbewahrt und bei Restore erneut entfernt werden.

Die DPA-Bedingung zum Vertragsende ersetzt keine belegte Einzelfallfrist im laufenden Betrieb. Keine kostenpflichtige Zusatzbearbeitung, neue Leistung oder Tarif-/Kontoumstellung beauftragen. Bitte bestätigen Sie diese Anfrage mit einer Ticketreferenz. Anfrage und GET 404 sind keine Bestätigung der Abwesenheit aller Archivkopien.

Vielen Dank
Jan Zeppenfeld
LottiBaby
```

[Originaltext](../../output/deletion-provider-followup-20261002/root/revenuecat-request.txt); SHA-256 des Bodys `17e5db517912ea477b271363b9f9f330e9d846cf40167ac226af87e3acc43277`.

[Versand-/Bearbeitungsbild](../../output/deletion-provider-followup-20261002/root/revenuecat-confirmed.jpg).

## Hostinger: Kanal, Zuordnung und Vorprüfung

Empfänger: **Hostinger authenticated hPanel support for lottibaby.de**. Kanal: authentifizierter hPanel Hostinger Agent / bestehender Kundensupport; kein Versand über anders zugeordneten Mail-API-Account business@zeppi.eu. Authentifiziertes Konto: bestehendes hPanel-Konto, sichtbare Begrüßung Laura-Michelle; aktiver E-Mail-Dienst lottibaby.de. Scope: support@lottibaby.de; nur drei originale RFC822-Message-IDs mit UTC-Daten.

Vorprüfung auf Doppelanfragen: Vor Fallversand sichtbare Chat History: heutige generische Onboardingunterhaltung, migrierte Begrüßung 04.09. und Casual Greeting 04.05.; kein matching Fallticket in sichtbarem Verlauf. Kein universeller Archivbeleg.

Status: Nachricht im Chat sichtbar. AI nennt passende Zustell- und drei Trash-Entfernungsvorgänge ohne Message-IDs, keine exakte Objektzuordnung oder Kopienfrist. Menschliche Prüfung abgeschlossen: die von Ray Conchas geprüfte Antwort 09:35 Berlin verweist an gdpr@hostinger.com. An diesen bestätigten Datenschutzkanal weitergegeben; konkrete Fachantwort und Ticket-/Konversationsreferenz offen. [Bestehender Verlauf](https://hpanel.hostinger.com/).

Start chatting sendete um etwa 09:10 Berlin die vorgegebene generische Frage What is Hostinger Agent and how can it help me out? Keine Fallkennungen darin. AI memory wurde mit Maybe later abgelehnt, keine Erweiterung/Premiumfunktion gebucht.

Betreff: Interne Kopien dreier entfernter Testmails bei erhaltenem Postfach

Exakt gesendeter Nachrichtentext:

```text
Guten Tag Hostinger Support,

bitte leiten Sie diese konkrete Datenschutz-/Aufbewahrungsfrage zur schriftlichen Bearbeitung an einen Customer Success-/Datenschutzmitarbeiter weiter und geben Sie eine Ticketreferenz an.

Im vorhandenen, weiter genutzten Postfach support@lottibaby.de wurden am 02.10.2026 um 06:53:03.806 UTC genau drei headergebundene QA-OTP-Testmails endgültig aus dem Papierkorb entfernt. Frische Nachprüfung bestätigt ihre Abwesenheit; das Postfach, alle übrigen sichtbaren Posteingangs-/Papierkorbzeilen und Alarmmails bestehen weiter. Keine erneute Löschung beauftragt.

Ausschließliche Falllocators (RFC822 Message-ID und Datum UTC):
<4hw0P3349jz30Vl@fr-int-smtpout27.hostinger.io> – 30.09.2026 16:09:43
<4hwWxb69bmz30Tm@fr-int-smtpout27.hostinger.io> – 01.10.2026 12:51:15
<4hwXnk0bRgzyyY@fr-int-smtpout11.hostinger.io> – 01.10.2026 13:29:30
Empfänger/Delivered-To jeweils support@lottibaby.de. Alte Ordner-UIDs sind wegen unbekannter UIDVALIDITY keine ausreichende Auswahlbasis. Aktuell sind hPanel-Forwarder sowie Webmail-Filter/Bcc leer; daraus folgt keine Abwesenheit historischer Kopien.

Bitte für genau diese drei Mails unter fortgesetztem Postfachbetrieb beantworten:
1. Welche internen Wiederherstellungs-, Archiv-, Backup-, Replikat- und SMTP-/Zustell-/Weiterleitungskopien können nach der gezielten endgültigen Entfernung bestehen?
2. Welche Fristbeginne, tatsächlichen Endbedingungen und Ausnahmen gelten, und wie lässt sich die Entfernung bzw. weitere isolierte Aufbewahrung konkreter Kopien nachweisen?
3. Welche zugehörigen Backupstände/Katalogangaben und historischen Weiterleitungsnachweise sind fallbezogen verfügbar? Die allgemeine Papierkorbfrist oder Vertragsende-Klausel allein beantwortet die Frage nicht.

Bitte keine Postfachlöschung, kein gesamtes Papierkorbleeren, keine Löschung anderer Mails, keine kostenpflichtige Leistung und keine Tarif-/Kontoumstellung auslösen. Keine Zugangsdaten, OTPs oder vollständigen Mailinhalte benötigt. Bitte schriftliche kontobezogene Bedingungen und Ticketreferenz; Versand oder generische Chatantwort ist kein Löschabschluss.

Vielen Dank
Jan Zeppenfeld
LottiBaby
```

[Originaltext](../../output/deletion-provider-followup-20261002/root/hostinger-request.txt); SHA-256 des Bodys `615398a2c001a20c92b030e360ca1b6018d494a31eddcb746d19f9bdb1cff0f6`.

[Versand-/Bearbeitungsbild](../../output/deletion-provider-followup-20261002/root/hostinger-confirmed.jpg).

## Folgemitteilungen im selben Verlauf

Die folgenden Mitteilungen betreffen denselben Fall und fordern ausschließlich die noch ausstehende Fachantwort und Referenz an. Sentry bleibt im gleichen Mailverlauf; Hostinger wurde nach menschlich geprüfter Kanalweiterleitung an den genannten Datenschutzempfänger übermittelt, da im Chat kein offizielles Ticket erzeugt wurde.

**sentry** – 2026-10-02T07:26:00.502Z / 2026-10-02T09:26:00.502000+02:00; Empfänger: support@sentry.io.

```text
Guten Tag,

bitte leiten Sie diesen bestehenden Verlauf an einen menschlichen Support-/Datenschutzmitarbeiter weiter und nennen Sie die Ticketreferenz. Die automatische Antwort beantwortet die drei konkreten Fragen nicht. Die Sichtbarkeit eines Events per vollständiger ID belegt seinen fortbestehenden aktiven Bestand, keinen Endzustand nach Entfernung.

Es bleibt ausschließlich bei den fünf bereits vollständig genannten Ereignis-IDs in jan-zeppenfeld / lotti-baby (4509762120056832), Issue 7753273592. Benötigt werden die Möglichkeit einer exakt begrenzten Behandlung, deren belegbarer Endzustand sowie konkrete bestehende Aufbewahrungs-/Backup-/Archivbedingungen und eventgebundene weitere Kopien. Bitte keine Löschung, keine Maßnahme am gemischten Issue, keine zusätzliche Zugriffsfreigabe, kostenpflichtige Leistung oder Tarifänderung ausführen.

Vielen Dank
Jan Zeppenfeld
LottiBaby

```

**hostinger** – 2026-10-02T07:27:07.716Z / 2026-10-02T09:27:07.716000+02:00; Empfänger: bestehender Hostinger-Chat.

```text
Bitte leiten Sie mein Anliegen zur schriftlichen Stellungnahme an den Kundenservice weiter.
```

**hostinger** – 2026-10-02T07:27:31.328Z / 2026-10-02T09:27:31.328000+02:00; Empfänger: bestehender Hostinger-Chat.

```text
I want to continue with a human
```

**hostinger** – 2026-10-02T07:29:23.578Z / 2026-10-02T09:29:23.578000+02:00; Empfänger: menschlicher Kundensupport im selben Hostinger-Verlauf.

```text
Bitte prüfen Sie die vollständige ursprüngliche Anfrage in diesem Verlauf zu genau drei RFC822-Message-IDs in support@lottibaby.de. Benötigt wird eine schriftliche, kontobezogene Stellungnahme zu internen Backup-/Archiv-/Replikat-/Logkopien, Fristbeginn, tatsächlicher Endbedingung, Ausnahmen und verfügbaren Katalog-/Nachweisen sowie eine Ticket- oder Konversationsreferenz. Zeitlich passende Protokolle ohne Message-ID sind keine exakte Kopienzuordnung. Keine Löschung, Postfachänderung, Zusatzfreigabe, kostenpflichtige Leistung oder Tarifänderung beauftragt. Bitte bestehende Aufbewahrungsbedingungen nennen und dieses Anliegen offen lassen, solange die drei konkreten Fragen unbeantwortet sind. Vielen Dank, Jan Zeppenfeld / LottiBaby.
```

## Eingegangene Antworten und Wiedervorlage

Sentry: erste automatische Antwort 09:19 Berlin erläutert IDs/Suche und behauptet fälschlich sichtbare Events seien der gesuchte Endzustand. Sie nennt keine konkreten Kopienfristen. Zweite automatische Antwort 09:26 Berlin bestätigt Weiterleitung an Tier-1 Konto und Abrechnung. [Gesicherter Verlauf](../../output/deletion-provider-followup-20261002/root/sentry-escalation-confirmed.txt). Keine Einzelereignisentfernung daraus ableiten.

Supabase: Eingangsbestätigung 09:21 Berlin mit **SU-492245**, noch keine inhaltliche Antwort. Antwortziel Jan-Postfach. [Ack](../../output/deletion-provider-followup-20261002/root/supabase-ack.txt). Ein angebotenes Priority-Supportpaket wurde nicht beauftragt.

RevenueCat: **86137**, Waiting on support, noch keine inhaltliche Antwort. [Ticketdetail](../../output/deletion-provider-followup-20261002/root/revenuecat-confirmed-dom.txt).

Hostinger: die AI-Antwort berichtet passende Zustellzeiten 30.09. 16:09:54 UTC / 01.10. 12:51:16 UTC / 13:29:30 UTC und drei endgültige Trash-Entfernungsvorgänge 02.10. 06:53:03 UTC. Sie sagt ausdrücklich, dass die zugänglichen Protokolle keine RFC822-IDs enthalten, kein fallgebundener Backupkatalog verfügbar ist und keine Ticketreferenz erzeugt wurde. Das sind Anbieter-AI-Angaben, keine unabhängig mit Rohprotokollen verifizierten Objektzuordnungen. [Erstantwort](../../output/deletion-provider-followup-20261002/root/hostinger-first-reply-dom.txt). Die anschließende menschliche Prüfung wurde um 09:35 Europe/Berlin abgeschlossen. Die von Ray Conchas geprüfte Antwort nennt gdpr@hostinger.com als zuständige Anlaufstelle, liefert aber keine Kopienfristen. Die ursprüngliche hPanel-Anfrage wird daher an diesen bestätigten Kanal weitergegeben. [Geprüfte Kanalweiterleitung](../../output/deletion-provider-followup-20261002/root/hostinger-reviewed-routing.txt). [Prüfstatus](../../output/deletion-provider-followup-20261002/root/hostinger-human-review.txt).

Bei Fortsetzung zuerst genau diese bestehenden Verläufe/Tickets lesen. Fehlende Nummer im vorhandenen Verlauf erfragen, keine neue Anfrage erzeugen. Antworten pro Kopientyp auf Fristbeginn, tatsächliche Endbedingung, Ausnahmen und überprüfbaren Nachweis abgleichen. Weder Sendestatus noch allgemeine Tarif-/Vertragsende-/Papierkorbfristen lösen Anbieterzeilen auf. Register bis zum belegten Ende erhalten. Keine automatische Wiedervorlage oder neue Anbietermaßnahme angelegt.

## Hostinger: bestätigte Weiterleitung an Datenschutz

Der vorhandene authentifizierte hPanel-Verlauf nannte keine Ticketnummer und leitete den Fall nicht selbst an Datenschutz weiter. Die von Ray Conchas geprüfte Antwort um **09:35 Europe/Berlin** verlangte eine schriftliche Anfrage an **gdpr@hostinger.com**. Damit ist dies die konkret bestätigte Fortsetzung derselben beauftragten Anfrage. Vor Mailversand: allzeitige enge Suche im bestehenden authentifizierten Jan-Postfach nach diesem Empfänger/Absender und den drei Message-ID-Fragmenten **0**; [Suchbeleg](../../output/deletion-provider-followup-20261002/root/hostinger-gdpr-dedupe.txt).

Empfänger **gdpr@hostinger.com**, Absender **jan.niklas.zeppenfeld@gmail.com**. Versand **2026-10-02T07:40:36.255Z UTC / 2026-10-02T09:40:36.255000+02:00 Europe/Berlin**. Betreff: Interne Kopien dreier entfernter Testmails bei erhaltenem Postfach – Weiterleitung aus hPanel. Keine Cc/Bcc oder Anhänge. Die Empfängerchip-Adresse und bytegleicher Nachrichtentext wurden vor Versand geprüft; anschließend ist der Text als gesendete Mail sichtbar.

```text
Guten Tag Hostinger Support,

Ihr authentifizierter hPanel-Support hat diese Anfrage am 02.10.2026 geprüft. Die von Ray Conchas geprüfte Antwort um 09:35 Europe/Berlin verweist uns ausdrücklich an gdpr@hostinger.com zur schriftlichen fallbezogenen Stellungnahme. Bitte führen Sie dies als denselben Fall; im Chat wurde keine Ticketreferenz genannt. Bitte bestätigen Sie Eingang und Referenz. Eine allgemeine Chatantwort hat die folgenden Fragen zu internen Kopien nicht beantwortet.

Im vorhandenen, weiter genutzten Postfach support@lottibaby.de wurden am 02.10.2026 um 06:53:03.806 UTC genau drei headergebundene QA-OTP-Testmails endgültig aus dem Papierkorb entfernt. Frische Nachprüfung bestätigt ihre Abwesenheit; das Postfach, alle übrigen sichtbaren Posteingangs-/Papierkorbzeilen und Alarmmails bestehen weiter. Keine erneute Löschung beauftragt.

Ausschließliche Falllocators (RFC822 Message-ID und Datum UTC):
<4hw0P3349jz30Vl@fr-int-smtpout27.hostinger.io> – 30.09.2026 16:09:43
<4hwWxb69bmz30Tm@fr-int-smtpout27.hostinger.io> – 01.10.2026 12:51:15
<4hwXnk0bRgzyyY@fr-int-smtpout11.hostinger.io> – 01.10.2026 13:29:30
Empfänger/Delivered-To jeweils support@lottibaby.de. Alte Ordner-UIDs sind wegen unbekannter UIDVALIDITY keine ausreichende Auswahlbasis. Aktuell sind hPanel-Forwarder sowie Webmail-Filter/Bcc leer; daraus folgt keine Abwesenheit historischer Kopien.

Bitte für genau diese drei Mails unter fortgesetztem Postfachbetrieb beantworten:
1. Welche internen Wiederherstellungs-, Archiv-, Backup-, Replikat- und SMTP-/Zustell-/Weiterleitungskopien können nach der gezielten endgültigen Entfernung bestehen?
2. Welche Fristbeginne, tatsächlichen Endbedingungen und Ausnahmen gelten, und wie lässt sich die Entfernung bzw. weitere isolierte Aufbewahrung konkreter Kopien nachweisen?
3. Welche zugehörigen Backupstände/Katalogangaben und historischen Weiterleitungsnachweise sind fallbezogen verfügbar? Die allgemeine Papierkorbfrist oder Vertragsende-Klausel allein beantwortet die Frage nicht.

Bitte keine Postfachlöschung, kein gesamtes Papierkorbleeren, keine Löschung anderer Mails, keine kostenpflichtige Leistung und keine Tarif-/Kontoumstellung auslösen. Keine Zugangsdaten, OTPs oder vollständigen Mailinhalte benötigt. Bitte schriftliche kontobezogene Bedingungen und Ticketreferenz; Versand oder generische Chatantwort ist kein Löschabschluss.

Vielen Dank
Jan Zeppenfeld
LottiBaby
```

[Originaltext](../../output/deletion-provider-followup-20261002/root/hostinger-gdpr-request.txt), [Gesendetbeleg](../../output/deletion-provider-followup-20261002/root/hostinger-gdpr-confirmed.txt), [Screenshot](../../output/deletion-provider-followup-20261002/root/hostinger-gdpr-confirmed.jpg), [bestehender Mailverlauf](https://mail.google.com/mail/u/0/#search/in%3Aanywhere+%7Bto%3Agdpr%40hostinger.com+from%3Agdpr%40hostinger.com+%224hw0P3349jz30Vl%22+%224hwWxb69bmz30Tm%22+%224hwXnk0bRgzyyY%22%7D/QgrcJHsNhNbrZFwHJbMvpbQWlZFkWFLBqnl). SHA-256 des Bodys `8f0e7d32b099adf3489e3decb0fa1b9c24726443e6c210cfef0bdb69ab892238`. Die konkrete Datenschutzantwort und numerische Ticket-/Konversationsreferenz sind weiterhin offen. Keine zweite bereinigende Aktion oder kostenpflichtige Leistung beauftragt.
