# Sentry-Fachantwort zum QA-Löschfall – 02.10.2026

**Sentry bleibt `pending`: Die aktive Aufbewahrung und die Grenzen gezielter Löschung sind geklärt, die tatsächliche Abwesenheit der Ereignisse und das Ende aller zugehörigen Kopien noch nicht belegt.** Ticket **215476206908813**, Projekt `lotti-baby` / `4509762120056832`, Issue `LOTTI-BABY-3S` / `7753273592`. Bezug ist ausschließlich QA-Auftrag B `6434ecdb-7d04-482d-a709-fd991932c142` mit Kontohash `94ab5778f611`; keine Produktions- oder fremden Inhalte werden dadurch freigegeben.

Quelle ist die vom Nutzer in diesem Chat bereitgestellte Antwort von Stella, Senior Support Engineer. [Gesicherte Nutzertranskription](../../output/deletion-sentry-support-20261002/support-reply-user-transcript.txt); Transportheader und Empfangszeit sind daraus nicht belegbar. Der historische Anbieteragent hat inzwischen den **bestehenden authentifizierten Jan-Gmail-Verlauf** lesend gegengeprüft: dieselbe Antwort und Ticketreferenz, `Stella from Sentry.io <support@sentry.io>`, angezeigtes Datum 02.10.2026 **12:25**. Die Maildetails weisen die Zeitzone nicht unabhängig aus; daraus wird **keine UTC-Empfangszeit** errechnet. Maildetail `mailed-by: outbound.intercom.sentry.io` und `signed-by: sentry.io` sind beobachtete UI-Metadaten, keine erfundene RFC822-Message-ID oder unabhängige kryptografische Prüfung. [Verlauf](https://mail.google.com/mail/u/0/#search/in%3Aanywhere+%22215476206908813%22/QgrcJHsNpWsmkQVTxDHkjRZCxhrrXVRWWmb), [authentifizierter Mailbeleg](../../output/deletion-sentry-support-20261002/attribution/support-mail-verification.json). Eigene UTC-Lesetermine und Quellenhashes werden im [maschinenlesbaren Nachweis](../../output/deletion-sentry-support-20261002/summary.json) getrennt ausgewiesen. Die Nachricht bestätigt ausdrücklich keine Löschung, Änderung, neue Zugriffsfreigabe, kostenpflichtige Leistung oder Tarifänderung.

## Aktive Bestände und Behandlung

Nach Support gibt es keine auf genau diese fünf Fehlerereignisse begrenzte Entfernung. Das Entmischen würde ganze Fingerprints betreffen; mindestens zwei der drei enthalten auch andere Ereignisse. Deshalb weder Issue noch Projekt löschen, keinen Fingerprint entmischen und keine fremden Ereignisse behandeln.

| Genaues Ereignis | Bereits belegter Ereigniszeitpunkt UTC | Vom Support genannter Fingerprint |
| --- | --- | --- |
| `5a5061db18f04c9389f32a91654f6e14` | 01.10.2026 13:34:09 | `7c503fcd34f9d2093738807a40218942` |
| `600f45fed17d4cb0a9b1aa153d96d026` | 01.10.2026 13:06:37 | `7c503fcd34f9d2093738807a40218942` |
| `c916cf6b7afe4c53b341cf86aebac5d0` | 01.10.2026 13:06:37 | `3996ba1241bf579f3f0c6b2d76fca5d2` |
| `442bf991f306499b8b59ee2b2339f180` | 01.10.2026 12:55:41 | `7c503fcd34f9d2093738807a40218942` |
| `6f2172070efe44d58c8c0789cbb39960` | 01.10.2026 12:53:24 | `cc29f0741aca54945045dafb63446a4e` |

Der zuvor frisch geprüfte aktive Mindestbestand bleibt fünf exakte B-Ereignisse im gemischten Issue; die Supportantwort löscht diese nicht. Die gesamte Issueanzahl ist kein Kontobestand. Für künftige Abwesenheitsprüfungen die fünf exakten Ereignis-URLs verwenden, mit nachweislich angemeldetem richtigem Projekt und Kontrollzugriff; Login-, Rechte-, Netzwerkfehler oder eine leere Suche sind kein Löschbeleg.

## Aufbewahrung und Prüftermin

Support bestätigt für den beim Eingang geltenden Developer-Plan **30 Tage ab Empfang** für Fehlerereignisse, Anhänge und Replays; spätere Planänderungen wirken nicht rückwirkend. Die [aktuelle offizielle Retention-Dokumentation](https://docs.sentry.io/security-legal-pii/security/data-retention-periods/) bestätigt diese allgemeine Regel. Die fünf Ereignisse wurden laut Support am 01.10. zwischen 12:53 und 13:34 UTC empfangen und seien **etwa ab 31.10.2026** nicht mehr zugänglich.

**Geplanter lesender Prüftermin: 31.10.2026 nach 13:35 UTC / 14:35 MEZ**, ohne eingerichtete Automation. Das ist eine Wiedervorlage auf Grundlage der Anbieterangabe, keine garantierte physische Löschfrist und keine neue behauptete exakte Eingangszeit. Vor der Prüfung kein `completed`. Sind Ereignisse weiterhin erreichbar oder ist die Prüfung nicht eindeutig, bleibt der aktive Teil offen und das bestehende Ticket wird für weitere Klärung genutzt. Bei belegter Abwesenheit ist ausschließlich der aktive Zugriffsumfang geschlossen; offene Backup-/Archivkopien bleiben separat erhalten.

Die [Sentry-Sicherheitsrichtlinie](https://sentry.io/security/) nennt regelmäßige Backups und deren Löschung **90 Tage nach jeweiliger Erstellung**. Das ist eine allgemeine veröffentlichte Bedingung, kein 90-Tage-Maximum ab Kontolöschung und kein bestätigter Kalendertag für diese fünf Ereignisse. Die Antwort benennt keine betroffenen Backupstände, letzten Erstellzeitpunkte oder abschließende Endbedingungen für diese konkreten Kopien. Nicht pauschal 30 plus 90 Tage als garantierten Fallabschluss berechnen. Der [DPA](https://sentry.io/legal/dpa/) liefert ebenfalls keinen objektspezifischen Abschlussnachweis.

Offizielle Seiten sind mit Quelldateien, URLs und SHA-256 unter [Quellenindex](../../output/deletion-sentry-support-20261002/official/fetch.json) und [Retention-Supplement](../../output/deletion-sentry-support-20261002/official/supplement-fetch.json) gesichert. Der Webreader scheiterte an Markdown-Content-Type; die öffentlichen Originalseiten wurden anschließend direkt lesend abgerufen.

## Verwandte Objekte und Zuordnungsgrenze

Support hat für genau die fünf Ereignisse keine verknüpften Anhänge, Replays oder Benutzerfeedback gefunden. Die drei genannten Traces `3a4b4fe808b44af5bd4e1ff49f29b825`, `8812d0734c084f7f91fcfb90428bbe8e` und `ab561be059e04147b2c9f7289bfb57a1` enthalten nach dieser Prüfung ausschließlich Fehlerereignisse und keine Performance-Spans; es seien keine separaten zuvor zusammengeführten Issues gefunden worden. Diese Antworten schließen die benannten Verknüpfungsfragen, nicht projektweite historische Bestände, unabhängige Sitzungen oder Backups.

Zusätzlich nennt der Support den Breadcrumb-Kandidaten `8152c8984730468982fada87868c9385`, 01.10.2026 12:44:55 UTC, aus derselben Sitzung wie das Android-Ereignis. Der erhaltene frühere Ereignisbeleg und die **aktuelle authentifizierte UI-Prüfung** zeigen **anderen Kontohash `6358c261ada4` statt B `94ab5778f611`**. Live hat der Kandidat den Zeitpunkt 12:44:55.805 UTC, der bekannte B-Anker 12:53:24.517 UTC; beide gehören zum Trace `ab561be059e04147b2c9f7289bfb57a1` und derselben Installation/Appsession. Die Trace-UI zeigt zwei Fehlerknoten und keine dargestellten Performance-Spans. Der JSON-Endpunkt wurde vom Browser blockiert; ein Roh-JSON-Inhaltsbeleg wird deshalb nicht behauptet.

**Keine exklusive B-Zuordnung:** Ein vorhandener B-Anmeldebeleg liegt nur rund 447 ms vor dem Kandidaten. Ein anders gesetzter oder verspätet aktualisierter SDK-Kontext kann deshalb allein keine vollständige inhaltliche B-Abwesenheit beweisen. Der Kandidat bleibt ein gemischter Sitzungs-/Tracekandidat, kein zusätzlich bestätigtes ausschließliches B-Löschziel und kein pauschal freigegebenes fremdes Löschziel. In seiner live gefilterten Breadcrumbliste ergaben UID-/Hash-/E-Mail-Suchen keine Treffer; dies beweist nur den jeweiligen sichtbaren Filterumfang. Der B-Anker enthält ältere Fehlerbreadcrumbs, der direkte ID-Verweis wurde in der aktuellen UI nicht reproduziert. Die Supportaussage bleibt als eigener Befund erhalten; keine globale Abwesenheitsbehauptung oder pauschale Löschung.

[Unabhängiger lesender Agentbericht](../../output/deletion-sentry-support-20261002/attribution/report.md), [genaue Zuordnung](../../output/deletion-sentry-support-20261002/attribution/candidate-attribution.json) und [Agent-Prüfsummen](../../output/deletion-sentry-support-20261002/attribution/manifest.json) sind vom Hauptagenten gegengeprüft. Das Sentry-Umgebungslabel `production` gehört hier zur Telemetrie der App `Lotti Baby QA`; es beweist keinen Produktionskontobezug.

Neu ausdrücklich belegte Datenarten in den fünf Ereignissen: **Standortdaten auf Stadtebene**, abgeleitet aus der Eingangs-IP, obwohl die IP selbst laut Antwort durch die SDK-Einstellungen nicht gespeichert wird; außerdem SDK-Breadcrumbs und `user.id`-Tagzusammenfassungen des Issues. Der Support nennt für die Tagzusammenfassungen dieselbe Aufbewahrungsfrist. IP-Unterdrückung ist deshalb kein Beleg für fehlende Standortdaten. Zum konkreten Stadtnamen werden keine unnötigen Daten in diesen Nachweis kopiert.

## Verbleibende konkrete Handlungen

1. Fünf exakte Ereignis-IDs zum oben benannten Termin lesend auf tatsächliche Abwesenheit prüfen; angemeldeten Scope und Kontrollzugriff belegen.
2. Breadcrumb-Kandidat und weitere Trace-/Sitzungskopien ausschließlich über konkreten Kontoinhalt zuordnen; fremde Ereignisse erhalten.
3. Im **bestehenden Ticket 215476206908813** die fallbezogenen Backup-/Archivendbedingungen sowie Restorebehandlung klären. [Minimaler Folgeentwurf](../../output/deletion-sentry-support-20261002/followup-draft.txt) ist vorbereitet und **nicht gesendet**.
4. `pending` und den unabhängigen Registereintrag erhalten. Keine Backendstatusauflösung, Worker-/Produktionsaktivierung, neue Anfrage, Planänderung oder Testwiederholung durch diese Antwortauswertung.

Die zwei separat dokumentierten Produktionsaktivierungsgates bleiben unberührt. Diese Sentry-Antwort ersetzt weder eine restorefeste Supabase-Ingress-Isolation noch einen echten nichtleeren Produktionsregister-Ack.

[Abschließende lokale Verifikation](../../output/deletion-sentry-support-20261002/verification.json): 173 Originalbelege und zwei erfasste unabhängige QA-Register hashgleich, drei Agentbelege geprüft, historische Abschluss-JSONs erhalten. Das parallel betriebene Produktionsregister wird nicht eingefroren; sein Inhalt wurde durch diese Antwortauswertung nicht verändert und seine laufende Writeraktualisierung wird nicht als unveränderter Bootstrap behauptet. Keine Nachricht, Automation, Backendänderung oder Testwiederholung in diesem Prüfschritt.
