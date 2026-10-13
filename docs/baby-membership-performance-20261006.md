# Baby-Mitgliedschaftsabruf: Serveroptimierung vom 6. Oktober 2026

## Aktueller Stand

Die korrigierte Migration `20261006043754_optimize_baby_membership_private_read_policy` ist auf Produktion `kwniiyayhzgjfqjsjcfu` aktiviert und erneut aus der Datenbank verifiziert. Commit: 2026-10-06T04:41:06.369Z (06:41 Uhr MESZ). Die erste anschließende Stichprobe echter Anfragen der älteren nativen Buildkennung LottiBaby/1.0.55 ist erfolgreich; Details unten.

- SHA-256: `a81438b546ba9e82d3e5238ae9ccea0b3b26aa4cf04a59910e545eff43d0d6eb`.
- Eine permissive SELECT-Regel auf `public.baby_info` ersetzt den wiederholten Aufruf von `is_baby_member(id)` durch eine einmal je Scan ermittelte UUID-Liste eigener und zugeordneter Babys.
- Die neue Funktion `baby_access_private.current_accessible_baby_ids()` liegt in einem eigenen privaten, nicht per Data API veröffentlichten Schema. Sie nimmt keine fremde Nutzer-ID entgegen, ist STABLE, verwendet einen leeren search_path und hat keine PUBLIC-Ausführungsberechtigung.
- Der bestehende REST-Endpunkt, Tabellen, Felder, Beziehungen, Sortierung und App-Code bleiben unverändert. Keine OTA-/Store-Auslieferung.
- Restriktive Consent- und Löschregeln, alle anderen Policies, bestehende Funktionen, Trigger, Tabellenrechte und Rolleneinstellungen sind vor/nach per Kataloghash identisch. Die tatsächliche Lösch-Inventar-Prüfsumme ist ebenfalls identisch.

## Rückwärtskompatibilität und Tests

48 Tests bestanden, 0 Fehler. Die fünf geprüften alten Quell-/Buildarchive enthalten dieselbe `listBabies`-Implementierung wie der aktuelle Checkout. Die Tests vergleichen die unveränderte Mitgliedschaftsabfrage mit eingebetteten Rollen sowie den eigenen Baby-Abruf: komplette JSON-Ergebnisse, Reihenfolge, Eigentümer ohne Mitgliedschaft, Partner und unberechtigte Konten. Dazu kommen Legacy-/Kohorten-/globale Einwilligungsmodi, Widerruf, entfernte Mitgliedschaften, Kontowechsel mit generischem Prepared Statement, Eigentümerwechsel, mehr als 1.000 Mitgliedschaften, Löschsperre, unverändertes Update-/Delete-Verhalten und atomarer Abbruch bei Policy-Abweichungen.

Das ist Datenbank-/Abfragekompatibilität; ein manueller End-to-End-Test jeder alten iPhone-Installation ist damit nicht behauptet. Native User-Agent-Kennungen sind keine gesicherte Zuordnung zu Marketingversionen oder OTA-Ständen.

Synthetischer PostgreSQL/PGlite-Test mit 3.839 Babys, drei Laufzeitplänen je Variante:

| Abfrage | Median vorher | Median nachher |
|---|---:|---:|
| Mitgliedschaftsabruf | 199,637 ms | 1,879 ms |
| Eigentümerabruf | 0,719 ms | 1,185 ms |

Die Ergebnisdaten sind identisch. Der neue Plan greift über den Baby-Primärschlüssel auf die drei erlaubten Baby-Zeilen zu. Diese lokalen Zeiten sind keine Produktionszusage. Der schnelle Eigentümerabruf hat im synthetischen Vergleich einen kleinen zusätzlichen Aufwand.

Auf echter Supabase-QA wurde die vollständige Migration in einer Transaktion angewendet, der alte Abruf unter `authenticated` ausgeführt und das komplette Ergebnis vor/nach per Hash verglichen. Mitgliedschaft: 6,416 auf 3,197 ms, je ein Ergebnis; Eigentümer: 0,903 auf 1,388 ms, je ein Ergebnis. Das ist ein kleiner QA-Datensatz. Anschließend wurde die Rücknahme getestet und alles zurückgerollt; der ursprüngliche Kataloghash ist wiederhergestellt. Die Migration selbst bricht atomar ab, falls sich die Lösch-Prüfsumme ändern würde.

## Transparenz: erste Variante zurückgenommen

Die erste Variante legte dieselbe Hilfsfunktion im bestehenden `consent_private`-Schema ab. Sie wurde um 04:36:31 UTC ausgerollt. Bei der anschließenden Nachprüfung fiel auf, dass die Kontolöschung sämtliche Funktionen dieses Schemas in ihre Inventar-Prüfsumme aufnimmt. Die erste Variante wurde am 2026-10-06T04:38:08.681Z über die separate Rücknahme-Migration `20261006043717` entfernt. Beim ersten Rücknahmeversuch löste das kurze Lock-Limit aus; die Transaktion wurde abgebrochen, der nächste Versuch stellte den Ausgangszustand wieder her.

Die gespeicherte genehmigte Lösch-Prüfsumme war nach Rücknahme NULL; daraus wird keine tatsächlich fehlgeschlagene Nutzerlöschung abgeleitet. Die neue Variante in `baby_access_private` verhindert diese Prüfsummenänderung unabhängig vom Freigabestatus. Ein zusätzlicher Regressionstest verwendet die echte Produktionsdefinition von `deletion_private.fingerprint()`, erkennt das Problem der ersten Variante und bestätigt die unveränderte Prüfsumme der Korrektur. Die ursprüngliche Migration wird wegen ihrer Produktionshistorie nicht nachträglich umgeschrieben.

## Produktionsmessung vor der Änderung

6. Oktober, 06:05:48–06:35:18 MESZ, vor beiden Auslieferungen, natürliche GET-Anfragen auf `baby_info`:

| Native Kennung / Abfrage | n | Mittelwert | p95 | HTTP-5xx |
|---|---:|---:|---:|---:|
| LottiBaby/1.0.55 Mitgliedschaft | 26 | 6.989 ms | 8.264 ms | 11 |
| LottiBaby/1.0.80 Mitgliedschaft | 6 | 6.894 ms | 8.001 ms | 0 |
| LottiBaby/1.0.55 Eigentümer | 23 | 123 ms | 441 ms | 0 |
| LottiBaby/1.0.80 Eigentümer | 5 | 113 ms | 145 ms | 0 |

Vorher-/Nachher-Fenster sind nicht kontenweise gepaart. Kleine Stichproben und unterschiedliche Konten/Anfrageverteilungen begrenzen die Aussage.

## Nachweise und Rücknahme

- Endgültiger Prüfstand: `output/baby-membership-performance-20261006/v2/ready.json`.
- Tests: `v2/regression-tests.tap`; Benchmark: `v2/benchmark.json` und Pläne.
- QA: `v2/qa-preflight.json`, `v2/qa-plans.json` (IDs maskiert; keine Datensatzinhalte gespeichert).
- Produktion: `v2/production-before.json`, `v2/production-commit.json`, `v2/production-after.json`, `v2/production-verification.json`.
- Gezielte Rücknahme der endgültigen Änderung: `v2/rollback.sql`, auf lokalem PostgreSQL-Teststand und Supabase-QA geprüft.
- Historischer erster Versuch und dessen Rücknahme: gleichnamige Dateien im übergeordneten Ausgabeordner.

Reproduktion der endgültigen Migration lokal: `PGLITE_PACKAGE=/tmp/lottibaby-performance-tools/node_modules/@electric-sql/pglite node scripts/benchmark-baby-membership.mjs`. Das Skript erzeugt einen neuen Ausgabeordner. Die spezielle Testsuite benutzt die gesicherten Kataloge und die vorhandenen fünf Quellarchive; sie ist keine allgemeine CI- oder Geräteabnahme.

Offen bleiben die separat dokumentierten Schlafdaten-Probleme und die fehlerhafte Schlaf-Mitgliedschaftsregel. Diese Migration ändert keine Schlaf-Policy und verspricht keine vollständige Behebung aller App-Verzögerungen.

## Erste natürliche Anfragen nach der endgültigen Auslieferung

Messfenster 6. Oktober, **06:42:06–06:43:45 MESZ** (04:42:06.369–04:43:45.296 UTC), eine Minute Abstand zum Commit; Ende zusätzlich 30 Sekunden vor Ablesung. Nur natürliche App-Requests, keine künstliche Last und kein gefälschter User-Agent.

| Native Kennung / Abfrage | n | Mittelwert | p50 | p95 / Maximum | HTTP-5xx / 4xx |
|---|---:|---:|---:|---:|---:|
| LottiBaby/1.0.55 Mitgliedschaft | 6 | 222 ms | 145 ms | 425 ms | 0 / 0 |
| LottiBaby/1.0.55 Eigentümer | 6 | 77,8 ms | 61 ms | 152 ms | 0 / 0 |
| LottiBaby/1.0.55 sonstige Baby-Abrufe | 9 | 137,7 ms | 114 ms | 272 ms | 0 / 0 |

Damit beantwortet die endgültige Serverregel auch die unveränderten Anfragen einer älteren nativen Buildkennung erfolgreich. Der Mitgliedschafts-Mittelwert liegt in dieser kurzen Stichprobe rund 97 % unter dem Vorher-Fenster derselben Buildkennung (6.989 ms, 26 Requests, 11 Serverfehler). Unterschiedliche Anfrage-/Kontenmischungen, kleine Nachher-Stichprobe und keine Gerätezuordnung: kein gepaarter A/B-Test und keine Zusage für jeden Nutzer oder alle älteren Builds. Für die Kennung LottiBaby/1.0.24 liegen in diesem Nachher-Fenster keine Requests vor. Die Daten belegen den Serverabruf, nicht den vollständigen iPhone-Start.

Quelle: `v2/http-summary-after-final.json` und `v2/http-after-final.json`; frühere Vergleichsmessung `http-summary-before.json` im übergeordneten Ordner. Supabase-Advisors nach endgültigem Rollout: keine zusätzlichen Sicherheits- oder Performance-Hinweise; der Hinweis auf wiederholte Auth-Prüfung der geänderten SELECT-Policy ist entfallen. Bestehende projektweite Hinweise sind damit nicht vollständig behoben.

Der tatsächliche Lösch-Fingerprint wurde sowohl innerhalb der Migration als auch durch getrennte Produktionsabfragen vor/nach verglichen und ist identisch. Ein breiterer Produktionsnachweis und manuelle Geräteabnahme bleiben offen. Keine automatische Dauerüberwachung eingerichtet.
