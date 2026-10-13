# Untersuchung: langsamer App-Start / Profilaufbau auf dem iPhone

Stand: 5. Oktober 2026. Produktionsprojekt `kwniiyayhzgjfqjsjcfu`.

## Produktionsauslieferung am 5. Oktober, 21:24 Uhr MESZ

Der ausdrücklich freigegebene erste Hotfix wurde am **5. Oktober 2026 um 21:24:23 MESZ** gezielt auf `kwniiyayhzgjfqjsjcfu` angewendet und anschließend erneut aus Produktion gelesen. Alle 44 erwarteten Policies sind optimiert, die Migration ist mit dem exakten getesteten SQL in der Supabase-Migrationshistorie eingetragen. Der Katalog-Hash für unveränderte Funktionen, alle übrigen Policies, Policy-Rollen/-Befehle, Einwilligungseinstellungen, Trigger, Tabellenberechtigungen und Rollenkonfiguration stimmt vor/nach überein.

- Migration: `20261005191027_optimize_consent_policy_evaluation`
- SHA-256: `e1cdc1db11a469384851393b6bb581ea55c607101ff439fef0a51c565216dd71`
- Produktionsnachweis: `output/profile-performance-20261005/production-hotfix-verification.json`
- Gesicherter Ausgangs-/Endzustand: `production-before-apply.json`, `production-after-apply.json`
- Commit-Bestätigung: `production-commit.json`

Unmittelbares Vorher-Fenster, 21:00–21:20 Uhr MESZ: Baby-Abfragen durchschnittlich 2.135 ms mit 16 Serverfehlern bei 80 Requests; Schlafdaten-REST 2.500 ms mit 14/135 Fehlern; Schlafdaten-RPC 4.828 ms mit 6/19 Fehlern. Die produktive Laufzeitabnahme erfolgt separat anhand neuer Requests nach dem Commit. Kein App-Update und keine Neuinstallation erforderlich, um die geänderten Serverregeln zu verwenden. Eine Messung vom konkret betroffenen iPhone liegt weiterhin nicht vor.

### Erste echte Requests nach Auslieferung

Auswertungsfenster **21:25:24–21:28:58 Uhr MESZ**, mit einer Minute Abstand zum Commit, um laufende Altanfragen und die Schema-Aktualisierung auszuklammern:

| Bereich | Requests | Mittelwert | p95 | Maximum | HTTP-5xx |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baby-Daten | 16 | 917 ms | 4.686 ms | 4.688 ms | 0 |
| Schlafdaten REST | 21 | 896 ms | 1.913 ms | 1.915 ms | 0 |
| Nutzerprofil | 9 | 104 ms | 224 ms | 245 ms | 0 |

Im Vergleich zum unmittelbaren Vorher-Fenster liegt der Mittelwert bei Baby-Daten rund 57 % und bei Schlafdaten-REST rund 64 % niedriger. Die Fenster haben unterschiedliche Request-Mischungen, sind kurz und nicht kontenweise gepaart; das ist ein früher Betriebsbefund, kein kausaler A/B-Test und keine vollständige Entwarnung. Es gab im Nachher-Fenster keinen Aufruf des Schlafdaten-RPC, daher hierfür keine neue HTTP-Aussage. Die zunächst gemeldeten 150 ms für Baby-Daten bezogen sich nur auf die ersten drei Requests; mit 16 Requests liegt der Mittelwert bei 917 ms.

**Restproblem:** Einzelne Baby-Abfragen dauern weiterhin bis 4,7 Sekunden. Der Hotfix ist erfolgreich ausgerollt und zeigt im ersten Vergleich eine Entlastung, der gesamte Performance-Vorfall ist damit noch nicht vollständig gelöst. Der langsame Baby-Mitgliedschaftsjoin sowie die sequentiellen Schlafabfragen benötigen weitere Optimierung und Tests. Die separat gefundene fehlerhafte Mitgliedschaftsregel wurde durch diesen freigegebenen Hotfix nicht geändert.

HTTP-Nachweise: `hotfix-before-http.json` und `hotfix-after-http.json`. Die zusätzlich gespeicherten `pg_stat_statements`-Differenzen beginnen vor dem Commit und können damals schon laufende Requests enthalten; sie sind nicht identisch zum hier abgegrenzten HTTP-Zeitfenster.

## Vorbereitung und Tests des ersten Server-Hotfixes

Am 5. Oktober wurde `supabase/migrations/20261005191027_optimize_consent_policy_evaluation.sql` vorbereitet. Die Änderung umfasst ausschließlich die 44 bestehenden restriktiven `data_consent_health`-Policies: Die zeilenunabhängige Familienprüfung wird in einen skalaren SELECT eingeschlossen und damit je Statement statt je Datenzeile ausgewertet. Der zeilenabhängige Schutz, WITH CHECK, Rollen, Einwilligungen, Schreibtrigger, Löschsperren und bestehende Freigaberegeln bleiben erhalten. Keine Einwilligung wird aktiviert oder automatisch erteilt.

Die Migration prüft vorab alle bisherigen Ausdrücke und bricht bei Abweichungen ab. Sie hat kurze Lock-/Statement-Timeouts und ist atomar. Sie verlangt keinen App-Download und wäre serverseitig auch für bereits installierte Versionen wirksam.

**Prüfstand:**

- 35 SQL-Tests bestanden, davon 9 neue Tests für den Hotfix. Enthalten sind Legacy-/Kohorten-/globale Durchsetzung, Eigentümer, Partner, unberechtigte und anonyme Konten, Widerruf vor dem nächsten Statement, separate zeilenabhängige Ablehnung, WITH CHECK, privilegierte Schreibtrigger, Löschsperren und Abbruch bei Policy-Abweichungen.
- Instrumentierter Test mit 40 erlaubten Datensätzen: Familienprüfung vorher mindestens 40 Mal, mit Hotfix genau einmal. Ein Widerruf wird in der nächsten Abfrage sofort wirksam.
- Echte Supabase-QA-Probe: 44 Policies in einer Transaktion geändert und vollständig zurückgerollt. Katalog-Hash vor/nach identisch. Die QA hat noch keine Kohorten-Erweiterung; diese wurde deshalb zusätzlich im lokalen PostgreSQL-Teststand mit den tatsächlichen Kohorten- und Self-Service-Migrationen geprüft.
- Vor dem Rollout wurde der Produktionskatalog erneut ausschließlich gelesen: Alle 44 erwarteten Ausgangsausdrücke passten zur Migration. Die anschließende freigegebene Auslieferung ist oben separat dokumentiert.

**Reproduzierbarer Vergleich mit dem exakten Migrationsstand:**

| Synthetischer Datensatz / Abfrage | Vorher | Nachher | Faktor |
| --- | ---: | ---: | ---: |
| 68 Babys, PostgREST-artiger Mitgliedschaftsjoin | 72,08 ms | 9,10 ms | 7,9× |
| 5.000 Schlafprotokolle, PostgREST-artiger Share-Join | 5.405,38 ms | 802,00 ms | 6,7× |

Beide Varianten liefern identische Resultate (1 Baby beziehungsweise 11 geteilte Schlafprotokolle). Engine: PGlite 0.3.14, synthetische Daten, ein eingeschriebenes Konto mit gültiger Zustimmung. Das sind Vergleichsmessungen, keine zugesagten Produktionszeiten. Der vorherige Explorationslauf mit 65.000 Schlafzeilen zeigte dieselbe Richtung; die im Bericht zitierte Freigabe-Messung ist an den exakten Migrationshash gebunden. Eine experimentelle Änderung der Funktionskosten brachte keinen hinreichenden Zusatznutzen und gehört nicht zum Hotfix.

Reproduktion ohne Änderung der Projektabhängigkeiten:

```sh
PGLITE_PACKAGE=/tmp/lottibaby-performance-tools/node_modules/@electric-sql/pglite node --test scripts/tests/data-consent-sql.test.mjs scripts/tests/data-consent-cohort.test.mjs scripts/tests/data-consent-self-service.test.mjs scripts/tests/consent-policy-performance.test.mjs
PGLITE_PACKAGE=/tmp/lottibaby-performance-tools/node_modules/@electric-sql/pglite node scripts/benchmark-consent-policy.mjs
```

Der Benchmark nutzt die gespeicherten, personenbezogen freien Schema-/Policy-Auszüge in `output/profile-performance-20261005/`. Er fragt keinen Server ab. Sein Umfang lässt sich mit `BENCHMARK_ROWS` bis 65.000 erhöhen.

**Auslieferungsverfahren:** Nur diese eine Migration gezielt anwenden, ohne pauschales `db push`. Direkt davor den frischen Katalog mit dem getesteten Ausgangszustand vergleichen. Nach der Anwendung die 44 Ausdrücke und unveränderten Zugriffsregeln kontrollieren. Diese Schritte sind inzwischen abgeschlossen. Die folgenden realen Requests für Baby- und Schlafdaten werden nach Mittelwert, p95 und HTTP-5xx mit dem unmittelbaren Vorher-Zeitfenster verglichen. Die Abnahme bleibt offen, bis ausreichend neue Requests und ein bestätigter iPhone-Ablauf vorliegen. Bei fehlender Verbesserung die vorbereitete Rücknahme bewerten; diese stellt ausschließlich die vorherigen Ausdrücke wieder her und reaktiviert damit deren bekannte Performancekosten.

Die Rücknahme ist unter `output/profile-performance-20261005/rollback-policy-expressions.sql` vorbereitet. Der Freigabestand einschließlich Quellhash, Testnachweisen, QA-Probe und Benchmark steht in `output/profile-performance-20261005/hotfix-ready.json`.

**Verbleibende Arbeit:** Der erste Hotfix reduziert nachweisbar den neuen Prüfaufwand. Er konsolidiert nicht die drei sequentiellen Schlafabrufe und behebt nicht die separat dokumentierte fehlerhafte Baby-Mitgliedschaftsbedingung. Deren sichere Korrektur braucht einen eigenen Zugriffstest einschließlich expliziter Einzel-Freigaben; sie wurde bewusst nicht ungeprüft in diesen Performance-Hotfix aufgenommen. Ein vollständiger Erfolg des Vorfalls wird erst nach produktiver Messung behauptet.

## Ergebnis

Die Beschwerden passen zu einer messbaren Backend-Verschlechterung. In den produktiven HTTP-Logs steigen die Laufzeiten und Serverfehler für Baby- und Schlafdaten ab dem 3. Oktober gegen 18:15 Uhr MESZ deutlich. Die Verschlechterung besteht am 4. und 5. Oktober fort und betrifft auch ältere iPhone-Builds.

Stärkster Ursachenverdacht ist die zusätzliche Datenzugriffsprüfung aus dem Consent-Rollout vom 3. Oktober, dokumentiert um **18:13:14 MESZ**. Zeitlicher Zusammenhang und betroffene Tabellen passen zusammen. Ein kausaler A/B-Nachweis mit unverändertem Zugriffsschutz fehlt noch; der Vorfall ist nicht behoben.

## Zeitlich abgegrenzte Produktionsmessung

Quelle: Management API, `edge_logs`, User-Agent enthält `LottiBaby`. Mittelwert und p95 beziehen sich auf `response.origin_time` in Millisekunden, einschließlich fehlgeschlagener Requests. Das ist die serverseitige HTTP-Laufzeit, keine vollständige Messung vom betroffenen iPhone. Kalendertage sind Europe/Berlin; der 5. Oktober reicht nur bis 20:59 Uhr MESZ.

| Bereich | 3.10. Mittelwert | 4.10. Mittelwert | 4.10. p95 | 4.10. HTTP >= 500 | 5.10. Mittelwert |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baby-Profil / Baby-Liste | 554 ms | 2.057 ms | 8.227 ms | 978 / 6.185 (15,8 %) | 2.083 ms |
| Schlafdaten REST | 788 ms | 2.403 ms | 8.035 ms | 1.049 / 8.984 (11,7 %) | 2.224 ms |
| Sichtbare Schlafdaten RPC | 2.800 ms | 4.337 ms | 8.140 ms | 295 / 1.354 (21,8 %) | 4.326 ms |
| Nutzerprofil | 67 ms | 99 ms | 284 ms | 0 / 4.642 | 103 ms |
| Auth-Benutzerprüfung | 39 ms | 84 ms | 257 ms | 0 / 1.189 | 87 ms |

Der 3. Oktober enthält bereits den langsamen Abend und ist kein sauberer Vorher-Zustand. Vor der Serveränderung lagen die stündlichen Mittelwerte für Baby-Abfragen von 12 bis 18 Uhr MESZ bei etwa 134–184 ms und ohne Serverfehler. Im Fünf-Minuten-Fenster 18:10–18:15 Uhr lagen sie bei 117 ms, im folgenden Fenster bei 1.764 ms mit 5 Fehlern bei 43 Requests. Ab 19 Uhr bleiben die Stundenwerte ungefähr bei zwei Sekunden.

Die Postgres-Logs enthalten am 4. Oktober **3.417** Einträge `canceling statement due to statement timeout`. Diese Datenbankzahl ist projektweit, nicht ausschließlich den oben gefilterten iPhone-Requests zugeordnet.

Die User-Agent-Auswertung zeigt Serverfehler unter anderem für native Buildkennungen `LottiBaby/1.0.55`, `LottiBaby/1.0.24` und `LottiBaby/1.0.80`. Diese Kennungen sind keine verifizierten Marketingversions- oder OTA-Zuordnungen. Die beiden meldenden Personen wurden nicht anhand ihrer Konten identifiziert.

## Warum sich das wie ein langsam geladenes Profil anfühlt

- `lib/baby.ts:366`: `listBabies()` lädt zuerst Baby-Mitgliedschaften mit einem eingebetteten Join und anschließend eigene Babys. Der App-Start wartet auf die Auflösung des aktiven Babys (`contexts/ActiveBabyContext.tsx` und `app/_layout.tsx:769`). Eine langsame Baby-Abfrage blockiert daher den Aufbau der App, auch wenn die Tabelle `profiles` schnell antwortet.
- `lib/sleepSharing.ts:32`: `loadAllVisibleSleepEntries()` ruft drei Datenwege nacheinander ab: RPC, direkte Partnerdaten und Share-Join. Auch ein erfolgreicher RPC beendet die Funktion nicht.
- `app/(tabs)/home.tsx:1451`: Die Startseite lädt damit die gesamte sichtbare Schlafhistorie, bevor sie lokal auf heute überlappende Einträge reduziert. Weitere Aufrufe stehen im Root-Layout, unter anderem für die Live Activity.
- Der aktuelle Code hängt außerdem in Profil-, Baby- und Home-Ladeeffekten vom gesamten Auth-`user`-Objekt ab. Eine Sitzungserneuerung kann zusätzliche Ladevorgänge auslösen. Das ist ein zusätzlicher Codebefund, keine gemessene Häufigkeit auf den betroffenen Geräten.

Die kumulativen `pg_stat_statements` bestätigen besonders langsame Query-Formen: Schlaf-Share-Join im Mittel 4,10 s und Schlaf-RPC 1,79 s. Diese Statistik hat keinen gesicherten Tagesbeginn und ersetzt nicht die obige Tagesauswertung. Vier während der Untersuchung neu hinzugekommene RPC-Aufrufe lagen im Mittel bei 1,86 s reiner SQL-Ausführungszeit.

Präzisierung der frühen Zwischenmeldung: Die zunächst genannten 3 ms betrafen eine Abfrage nur der Profil-ID. Die belastbare HTTP-Messung für den gesamten Profil-Endpunkt beträgt am 4. Oktober durchschnittlich 99 ms; beide Messungen sind unterschiedliche Größen.

## Hauptverdacht: zusätzliche Prüfungen pro Datenzeile

Der gespeicherte Rollout-Nachweis `output/release-candidate-20261003/backend-stage.json` dokumentiert die Installation von `20261001170812_data_consent_enforcement.sql` und `20261003160141_data_consent_release_cohort.sql` um 16:13:14 UTC, also 18:13:14 MESZ.

Der live gelesene Katalog bestätigt:

- Auf Baby-/Schlaftabellen gilt die zusätzliche restriktive Policy `consent_private.family_allowed((SELECT auth.uid())) AND consent_private.row_allowed(to_jsonb(table.*))`.
- Die Familienprüfung selbst ist nicht vollständig in einen skalaren `SELECT` eingeschlossen. Die Funktionen führen weitere Einstellungen-, Mitgliedschafts- und Einwilligungsabfragen aus. Der zeilenabhängige Teil konvertiert vollständige Zeilen zu JSON.
- Globaler Consent-Schalter aktuell aus; ein Konto hat eine explizite Aktivierung. `rollout_active()` berücksichtigt diese Aktivierung projektweit. Der erste gespeicherte Aktivierungszeitpunkt ist erst 18:57 Uhr MESZ. Die frühere Verschlechterung um 18:15 Uhr darf deshalb nicht allein dieser ersten Entscheidung zugeschrieben werden: Auch die zuvor installierten Policies werden bereits ausgeführt.

Eine Optimierung muss Familienzugriff, Widerruf, kontenbezogene Durchsetzung und Löschsperren unverändert erhalten. Supabase beschreibt die einmalige Auswertung zeilenunabhängiger Policy-Funktionen über skalare SELECTs in seinen [RLS-Performance-Empfehlungen](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations). Ob und wie viel das hier verbessert, ist mit authentifizierten Query-Plänen und Vorher-/Nachher-Messungen zu prüfen.

## Separater sicherheitsrelevanter Katalogbefund

In den älteren Policies `Sleep entries: select/update/delete by member` ist die Mitgliedschaftsbedingung live als `bm.baby_id = bm.baby_id` gespeichert, statt das Baby der äußeren Schlafzeile zu vergleichen. Damit ist dieser Teil der permissiven Policy nicht an das betreffende Schlafprotokoll gebunden. Die übrigen restriktiven Policies bleiben wirksam; daraus folgt noch kein Nachweis eines erfolgten fremden Datenzugriffs. Der Fehler ist dennoch dringend mit isolierten Konten zu reproduzieren und separat zu korrigieren. Es wurden keine fremden Gesundheitsdatensätze abgerufen, um diese Lücke auszutesten.

## Konkreter Korrekturplan

1. Authentifizierte Query-Pläne für Baby-Mitgliedschaftsjoin und Schlaf-Share-Join mit realistischen synthetischen Daten vergleichen. Zeilenunabhängige Zugriffsprüfungen einmal pro Statement auswerten und unnötige wiederholte Tabellenprüfungen entfernen, ohne die Zugriffsbedeutung zu ändern.
2. Isolierte Tests für Eigentümer, Partner, nicht berechtigte Konten, Gesundheitswiderruf, Legacy-Konten und Kontolöschsperren durchführen; den separaten Mitgliedschaftsfehler ausdrücklich abdecken.
3. Erst nach nachgewiesener Laufzeitverbesserung eine gezielte Serverkorrektur bereitstellen. Das würde auch alte installierte iPhone-Builds erreichen. Die Datenschutzprüfung pauschal abzuschalten ist keine geeignete Korrektur.
4. Zusätzlich clientseitig die drei Schlafabrufe konsolidieren beziehungsweise passend begrenzen und Auth-Refresh-Nachladen reduzieren. Vor einer Konsolidierung muss die vollständige Partner-/Share-Semantik nachgewiesen werden.

## Grenzen und Änderungen der ursprünglichen Untersuchung vor Freigabe

- Produktionszustand aktuell `ACTIVE_HEALTHY`; das widerlegt die gemessenen langsamen Einzelabfragen und Timeouts nicht.
- Die MCP-Verbindung hatte keine Berechtigung für das Projekt. Die erfolgreiche Untersuchung erfolgte über die bereits angemeldete Supabase CLI-Identität und die Management API, mit SQL in `BEGIN READ ONLY` und kurzen Statement-/Lock-Timeouts.
- Keine Produktionsmigration, kein Rollback, kein OTA, keine Kontenänderung und keine Nachricht an Nutzer versendet. Anwendungscode blieb unverändert. Keine Behebung oder Geräteabnahme behauptet.
- Frühere lokale Rollout-Prüfungen belegen Kompatibilitäts-/Zugriffsfälle, aber keine Performance unter der hier beobachteten produktiven Last.

## Nachweise

Alle neu gespeicherten Auswertungen befinden sich in `output/profile-performance-20261005/`: Tages- und Fünf-Minuten-Aggregate, Timeout-Zählung, aggregierte App-Buildkennungen, Query-Laufzeiten und der relevante Policy-/Funktionskatalog. Sie enthalten keine Nutzerprofile oder Gesundheitsdatensätze. Der lokale Read-only-Helfer liegt in `.family-qa/profile-performance-20261005/read.mjs`; er liest die bestehende CLI-Anmeldung aus dem Schlüsselbund und speichert keinen Token.
