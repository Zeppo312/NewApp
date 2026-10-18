# Schlaf-Leseoptimierung für iOS 1.0.23 – 6. Oktober 2026

Die gezielte Produktionsmigration ist seit 2026-10-06T08:50:59.220Z aktiv (10:50:59 MESZ). Zwei permissive SELECT-Regeln und zwei Indizes wurden geändert. Die Nachprüfung bestätigt beide Ausdrücke, beide Indizes und den Migrationseintrag. Alle anderen erfassten Policies, Funktionen einschließlich beider Schlaf-RPCs, Trigger, Constraints, Spalten, Rechte, Rollen- und Consent-Einstellungen sind unverändert. Der tatsächliche Lösch-Fingerprint ist unverändert.

## Version und Vertrag

App Store Connect bestätigt 1.0.23 → nativer iOS-Build 1.0.55. Die Produktionsmessung wird deshalb gezielt nach LottiBaby/1.0.55 ausgewertet. Der User-Agent belegt weder den installierten OTA-Stand noch eine physische Geräteabnahme. Die späteren geprüften Quellarchive sind kein exakter Source-Beleg des Store-Bundles.

Keine App-, OTA- oder Storeänderung. Tabellen, Felder, Beziehungen, REST-Abfrageformen, Sortierung und Paging sowie RPC-Namen, Argumente und Rückgabetypen bleiben erhalten. Ein neues App-Update ist für diesen Datenbankeingriff nicht erforderlich.

## Änderung

- Mitgliedschaften gelten für das Baby der jeweiligen Schlafzeile. Der falsche Vergleich bm.baby_id = bm.baby_id wird im SELECT ersetzt.
- Eigene Mitgliedschaften, akzeptierte Account-Link-Gegenparteien und explizite Freigaben werden je Abfrage als Mengen ermittelt. Die RLS-Regeln der Lookup-Tabellen bleiben aktiv; kein neuer SECURITY-DEFINER-Helper.
- Owner, direkte Partner- und Legacy-Felder sowie beide Linkrichtungen und sämtliche bisher zugelassenen Beziehungstypen bleiben erhalten.
- Explizite Einzel-Freigaben ohne Baby-Mitgliedschaft erhalten einen eigenen REST-Zugriffspfad. Das ist eine bewusste Berechtigungskorrektur entsprechend der bereits bestehenden RPC-Freigabe; nicht bloß eine behauptete unveränderte Policy. Fremde Daten ohne einen gültigen Freigabeweg werden nicht im SELECT geöffnet.
- Zwei partielle B-Tree-Indizes auf partner_id und shared_with_user_id ermöglichen einen Bitmap-Zugriff statt einer vollständigen Prüfung aller Schlafzeilen.
- Restriktive Consent-, Widerrufs- und Löschprüfungen sind unverändert. Keine globale Aktivierung, keine neue Einwilligungsanforderung für 1.0.23.

## Tests und neun Agenten

27 dauerhafte Tests bestanden, einschließlich: vollständige JSON-Ergebnisse und Share-Embedding; Limits/Offsets und NULL-Baby; mehr als 1.000 Mitgliedschaften; Owner/Partner/Legacy/Links/Einzelfreigaben; fremdes Baby; generische vorbereitete Pläne mit Konto-, Share-, Mitgliedschafts-, Consent- und Löschzustandswechseln; anon und authenticated mit NULL-UID; echte Pre-request-Komposition; tatsächliche Schreibberechtigungstrigger; Migrationsdrift und atomare Fehler; exakte bewachte Rücknahme.

Neun Agenten prüften getrennte Bereiche. Sie änderten keine Implementierung. Zwei wichtige Gegenprüfungen verwarfen die erste Fassung: zu geringe Beschleunigung und Verlust einer gültigen REST-Einzelfreigabe. Beide wurden behoben. Die Abschlussprüfungen sind in agent-reviews.json nachvollziehbar; neun Prüfbereiche bedeuten nicht neun unabhängige physische Gerätetests.

Die lokale PostgreSQL-Fixture (PGlite) enthält ausschließlich synthetische Daten und die relevanten realen Policies, Funktionen, Indizes und Schreibberechtigungstrigger. Sie ersetzt keine vollständige Produktionsschema-/PostgREST-/Geräteabnahme. Ein unbeabsichtigter synthetischer Self-Share wurde vor der finalen Messung durch eine gültige Owner≠Empfänger-Freigabe ersetzt.

## Lokaler Benchmark, 65.000 Schlafzeilen

Authentifizierte Rolle, gleiche Daten, je fünf EXPLAIN-ANALYZE-Wiederholungen. Vergleich mit einer unabhängigen, korrekt korrelierten und explizite Freigaben erhaltenden Referenz; nicht mit einer Berechtigungen entziehenden Baseline. Alle acht Query-/Share-Kombinationen wurden vollständig und fehlerfrei verglichen.

| Abfrage | Korrekte Referenz, Median ms | Optimiert, Median ms |
|---|---:|---:|
| Ungefilterter Share-Join, Shares leer | 6126.6 | 58.0 |
| Ungefilterter Share-Join, Shares gefüllt | 5626.8 | 57.5 |
| Direkte OR-Abfrage, ohne Babyfilter | 59.3 | 54.8 |
| Direkte OR-Abfrage, mit Babyfilter | 54.2 | 54.6 |

Lokale Zahlen sind keine zugesicherten Produktionszeiten. Die schnellere Variante nutzt für den ungefilterten Share-Join einen Bitmap Heap Scan; die relevante Ergebnismenge bleibt erhalten.

## Supabase-QA und Rollout

QA ggyonianphloycmqrwvj wurde als nichtstandardmäßiger Branch der Produktion verifiziert. Auf dem echten Supabase-PostgreSQL wurden dieselben SQL-Bytes, authentifizierte Abfragen und der echte Pre-request-Hook geprüft. Es gab kein geeignetes vorhandenes Schlafkonto und nur einen geeigneten Testnutzer. Deshalb wurde ein historischer synthetischer Schlafdatensatz ausschließlich innerhalb der später zurückgerollten Transaktion angelegt. Der geprüfte Benachrichtigungstrigger überspringt solche historischen Datensätze. Keine Nachricht oder persistente Testdaten angelegt.

QA: direkte Abfragen mit positiven Treffern, Share-Joins ohne Treffer, gleichbleibende Ergebnis-Hashes zur korrekten Referenz; vollständiger Katalogzustand nach ROLLBACK wiederhergestellt. Positive Einzelfreigaben wurden lokal umfassend getestet; auf QA fehlte dafür ein zweites geeignetes Konto. DDL-Zeit 37,806 ms auf dem kleinen QA-Bestand; kein Beleg gleicher Lockdauer unter Produktionslast.

Produktionsrollout mit kurzen Lock-/Statement-Limits, exklusivem Transaktions-Advisory-Lock, exakten alten Policy-Prädikaten, gebundenen Datei-Hashes, Vor-/Nachbedingungen und Migrationseintrag in derselben Transaktion. Kein pauschales db push. Die Indexbauten waren transaktional; keine Zero-Downtime-Garantie wird behauptet.

Migration: supabase/migrations/20261006082734_optimize_sleep_select_access.sql
SHA-256: 6f993804ae6e9da307eaec308dff531276ec362c7546eeab8ff3e97efd004fc2
Unveränderter Kataloghash: b37ad4f84558b98f2b3728bceb225ed6

Rücknahme: output/sleep-access-performance-20261006/safe-fallback.sql, exakt lokal und auf QA geprüft. Sie behält die korrekte Baby-Zuordnung und explizite Freigaben bei, entfernt die beiden neuen Indizes und kann langsamer sein. Die alte fehlerhafte Fremd-Baby-Freigabe wird nicht wiederhergestellt. Eine tatsächliche spätere Rücknahme braucht einen eigenen Migrationseintrag.

## Produktionsmessung

Unmittelbar vorher, 08:19:02–08:49:02 UTC, Build 1.0.55: 22 ungefilterte Share-Joins, alle 22 mit Serverfehler, Mittel 8.021 ms. Die Nachmessung natürlicher Requests erfolgt nach mindestens einer Minute Abstand zum Commit und mit geschlossenen Logfenstern. Erste Nachmessung 2026-10-06T08:51:59.220Z–2026-10-06T08:54:37.210Z (10:51:59–10:54:37 MESZ): 4 ungefilterte Share-Joins, 0 Serverfehler, Mittel 229 ms, Maximum 244 ms. Mit Baby-Filter 2 Share-Joins, Mittel 613 ms, keine Fehler. Direkte OR-Abfragen 32 zusammen, ebenfalls keine HTTP-Fehler. Baby-Mitgliedschaften 9, Mittel 118 ms, keine Fehler. Das unveränderte RPC bleibt mit 5 Anfragen im Mittel 3231 ms langsam (Maximum 5813 ms).

Dies ist eine kleine, kurze natürliche Stichprobe ohne Paarung derselben Konten. Sie bestätigt erste erfolgreiche Anfragen dieses nativen Builds, keine allgemeine iPhone-/App-Startzeit oder vollständige Langzeitstabilität. Beide geschlossenen Fenster wurden erneut gelesen. Im Nachher-Fenster kam zunächst eine Profilanfrage verspätet hinzu; die Schlafwerte blieben über alle drei Auslesungen identisch und die letzten beiden vollständigen Auslesungen waren stabil.

Supabase-Advisors nach Commit: keine neuen Hinweise; Sicherheit 392→392 bestehende Hinweise, Performance 626→623. Entfallen sind der fehlende Partner-FK-Index und zwei Hinweise auf zeilenweise auth.uid()-Auswertung. Beide neuen Indizes sind ready/valid (8 KiB bzw. 152 KiB); beim Snapshot keine blockierten Sitzungen. Diese Zähler sind keine vollständige Sicherheitsprüfung.

## Separat offen: vorhandene Schreib-/RPC-Probleme

Diese Migration ist eine Leseoptimierung, keine vollständige Sicherheitsfreigabe:

- UPDATE/DELETE-Policies enthalten weiterhin die falsche Membership-Korrelation. Echte Schreibtrigger beschränken Updates zusätzlich; policy-only Testresultate sind deshalb kein Produktionsnachweis erfolgreicher fremder Updates. Ein rein lokaler ungefilterter DELETE-Test bewies die Policy-Schwäche, nicht deren Ausnutzbarkeit unter dem produktiven safeupdate-/API-Pfad.
- Die zusätzliche permissive INSERT-Policy prüft nur user_id und lässt damit weiterhin falsche Baby-Zuordnungen zu, soweit keine andere Schutzschicht greift.
- Besonders dringlich: delete_sleep_entry(p_user_id uuid,p_entry_id uuid) ist ein öffentlich ausführbares SECURITY-DEFINER-RPC ohne Bindung von p_user_id an auth.uid(). Das wurde nur anhand Live-Definition/Rechten geprüft, keine reale Löschung versucht. Dies benötigt einen separaten begrenzten Fix.
- Beide Lese-RPCs bleiben unverändert und können weiterhin langsam sein. Die bestehende Nullargument-/Default-Überladung ist in SQL mehrdeutig (42725); explizite UUID-Argumente wurden getestet. Daraus wird kein neuer Produktionsfehler abgeleitet.

## Nachweise

output/sleep-access-performance-20261006/: ready.json, agent-reviews.json, regression-tests.tap, benchmark-final/, qa-preflight.json, qa-exact-fallback.json, production-before.json, production-after.json, production-verification.json, safe-fallback.sql, HTTP- und Advisor-Vergleiche.

Reproduktion: PGLITE_PACKAGE=/tmp/lottibaby-performance-tools/node_modules/@electric-sql/pglite node --test scripts/tests/sleep-access-performance.test.mjs

Fachliche Grundlage: [Supabase RLS-Performance](https://supabase.com/docs/guides/database/postgres/row-level-security-performance). Die konkrete Freigabe beruht auf obigen Tests und Live-Nachweisen.
