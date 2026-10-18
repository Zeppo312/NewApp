# Sentry, OpenAI und Convex: realer Produktionsfall 02.10.2026

Dieser separate lesende Abgleich betrifft Jans ausdrücklich ausgewähltes vorhandenes Produktionskonto, Tag `622323b692d7`, Auftrag `f5231523-5f42-4982-84f6-002ddeecbdd7`. Die privaten Zielbelege haben Dateirechte `0600`; der Tag entspricht `SHA256(UID).slice(0,12)` aus `lib/revenuecat.ts`. Kontoanlage: 06.08.2026, 16:27:26.827711 UTC. Die früheren QA-Berichte bleiben erhalten und ihre Fallzuordnungen werden nicht übertragen.

| Anbieter | Ergebnis der begrenzten Prüfung | Status |
| --- | --- | --- |
| Sentry | Exakte Hash-Freitextsuche im Projekt `4509762120056832`: keine Issues. Angeforderte 90 Tage werden tatsächlich auf 30 Tage begrenzt. Der Hash liegt im RevenueCat-Kontext, nicht als Kontotag. Erhaltene Belege enthalten keine exakte UID-/Hashzuordnung. | `pending` |
| OpenAI | Die drei sichtbaren Altcompletions im vorhandenen Default project frisch einzeln geprüft: jeweils **No metadata entries**, keine exakte UID, kein Hash und keine E-Mail im gerenderten Detail. Alle drei liegen nach der Anlage dieses realen Kontos; die frühere zeitliche Ausschlussfolgerung für QA-B gilt hier nicht. | `pending` |
| Historisches Convex | Das bereits angemeldete Jan-Team zeigt frisch ohne Suchfilter keine Projekte. Der frühere Scope `laura-michelle-kuck/lottibaby/merry-pony-594` und seine Konto-, Storage- und Backupdaten sind dadurch nicht nachgewiesen. | `pending` |

Communications fand eine Sentry-Mail vom 07.08., 20:38 Europe/Berlin, zu `LOTTI-BABY-11` mit Installationskennung `F7FE8B76-2CBA-457B-BB7A-A294FD0D4362`. Das bleibt ein unzugeordneter Zeit-/Gerätekandidat; eine Installation ist kein exklusiver Kontonachweis und dieser Zeitraum liegt außerhalb der aktuellen Sentry-Suche.

Der privat erhaltene Produktions-Advisor-Quellsnapshot stammt aus dem **Vor-Staging-Stand**. Er nennt keine expliziten Org-/Projekt-Header und keine `user`-/`metadata`-Payloadfelder; in diesem historischen Snapshot fehlt `store:false`. Der heutige Produktionsadvisor wurde inzwischen gezielt mit **`store:false` bereitgestellt und frisch zurückgelesen**, wie der Root-Abschluss belegt. Der Vor-Staging-Snapshot beschreibt daher nicht den heutigen Produktionszustand. Der tatsächlich verwendete Produktionsschlüssel ist weiterhin nicht unabhängig an das sichtbare OpenAI-Projekt gebunden. Historische Ausführung und bereits bestehende Anbieter-/Sicherheits-/Backupkopien bleiben unbekannt.

Es wurden keine Anbieterobjekte gelöscht, keine Supportanfragen gesendet, keine Credentials gelesen oder angelegt, keine Deployments oder Anbieterfallstatus verändert und keine QA-, Geräte-, Restore- oder Registertests wiederholt. Die neue Sentry-Fachantwort zum alten QA-Fall wurde nicht erneut ausgewertet. Die bereits belegte lokale Convex-Appentfernung ist ein eigener abgeschlossener Umfang und wird hier nicht als Historienabschluss verwendet.

[Maschinenlesbarer Fallabgleich](../../output/deletion-closure-execution-20261002/history/real-account-review.json) · [Frische begrenzte UI-Belege](../../output/deletion-closure-execution-20261002/history/real-account-ui-review.json) · [Sentry-Suchbeleg](../../output/deletion-closure-execution-20261002/history/real-account-sentry-search.jpg)

Für alle drei Anbieter fehlen konkrete fallbezogene Endbelege über historische und interne Kopien. Nulltreffer werden nicht als vollständige Kopienfreiheit ausgewiesen.
