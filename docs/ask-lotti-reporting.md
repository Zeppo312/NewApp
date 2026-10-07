# Meldungen zu Frag Lotti

## Abnahme vom 1. Oktober 2026

- [x] KI-Melde- und Moderationsfluss vom Betreiber manuell getestet und abgenommen.

Der Betreiber bestätigte im Chat zunächst, den Ablauf bereits getestet zu haben,
und anschließend ausdrücklich: „Sind durch damit abhaken bitte“. Der zuvor als
offen geführte Releasepunkt ist damit als manuelle Betreiberabnahme erledigt.
Es wurde dafür kein erneuter Versand durch den Agenten ausgelöst. Gerät,
App-Version, Meldungs-ID und konkreter Push-/E-Mail-Empfang wurden nicht separat
protokolliert; die Bestätigung ist kein automatisierter Zustellnachweis für einen
bestimmten Benachrichtigungskanal. Die technischen Nachweise vom 11. September
bleiben unten als historische Prüfung erhalten.

## Ablauf

Unter Lotti-Antworten öffnet „Antwort melden“ einen Dialog innerhalb der App.
Nutzer wählen einen Grund und können einen Kommentar ergänzen. Der Dialog erklärt
vor dem Senden, dass die ausgewählte Antwort inklusive Hinweis und die Angaben zur
Meldung dem Konto zugeordnet zur Moderation gespeichert werden. Chatverlauf und
strukturierte Baby-Daten werden nicht mitgesendet. Das gilt auch für lokal
gespeicherte Antworten aus älteren App-Versionen.

Die RPC `report_lotti_answer` schreibt in die vorhandene Tabelle `content_reports`
mit `target_type = 'ai_answer'`. Sie verwendet die bestehenden RLS-Regeln und
keine erhöhten Rechte. Identische Meldungen desselben Kontos liefern dieselbe ID;
bereits geprüfte Meldungen werden dadurch nicht erneut geöffnet. Der Snapshot
stammt vom meldenden Client und ist kein serverseitig verifiziertes KI-Protokoll.

Im Moderationsbereich werden diese Meldungen unter „KI-Antwort (Frag Lotti)“
angezeigt. Moderatoren können sie prüfen, Rückfragen stellen, verwerfen oder mit
„Als geprüft abschließen“ erledigen. Lösch- und Nutzersperraktionen sind für
KI-Antworten nicht vorgesehen. Erkenntnisse aus bestätigten Meldungen müssen in
die Antwortlogik und Sicherheitsfilter übernommen werden; eine Meldung ändert
den Filter nicht automatisch.

## Produktiver Fix vom 11. September 2026

Die Versandfehlermeldung wurde durch die produktiv fehlende RPC `report_lotti_answer` verursacht. Die bestehende Tabelle `content_reports` erlaubte außerdem noch keinen Zieltyp `ai_answer`. Beide Punkte wurden im verknüpften Projekt `kwniiyayhzgjfqjsjcfu` gezielt behoben: ausschließlich Migration `20270901000003_ask_lotti_answer_reports.sql`, atomar samt Migrationseintrag und PostgREST-Schema-Reload. Keine anderen ausstehenden Migrationen angewendet, keine Einwilligungssperren hinzugefügt.

Vorher wurden die tatsächlichen Tabellen-/Constraint-/Policy-Metadaten geprüft und die SQL-Tests gegen eine daraus erzeugte isolierte PostgreSQL-Testdatenbank ausgeführt. Die Funktion bleibt `SECURITY INVOKER`; RLS, die eigenen Reporter-IDs und der Duplikatschutz bleiben wirksam. Anonyme Aufrufe sind nicht erlaubt.

Nach der Bereitstellung wurden mit der tatsächlichen Rolle `authenticated` das Speichern einer synthetischen Spam-Meldung ohne optionalen Kommentar, die Bestätigung durch eine ID und die Wiederholung ohne Duplikat geprüft. Ein weiterer Test mit aktiviertem Live-Trigger bestätigte den Auftrag in `net.http_request_queue`. Alle Testberichte und Benachrichtigungsaufträge wurden vor Commit zurückgerollt; nichts wurde an Moderatoren verschickt. Der öffentliche REST-Endpunkt löst die neue Funktion auf und lehnt anonyme Aufrufe erwartungsgemäß mit HTTP 401 / SQLSTATE 42501 ab. Die produktiven Schema-Nachweise bestätigen: Funktion vorhanden, Migration erfasst, RLS aktiv, keine verbleibenden Testzeilen.

Für das Absenden aus dem bereits vorhandenen Dialog ist kein App-Update erforderlich. Bei dieser technischen Prüfung vom 11. September wurden der echte Versand vom betroffenen Gerät und die Zustellung einer Moderator-Push-/E-Mail nicht ausgelöst. Die spätere manuelle Betreiberabnahme ist oben dokumentiert. Der vorhandene Benachrichtigungsdienst bleibt unverändert; die lokal ergänzte spezifische Bezeichnung „KI-Antwort“ in `moderation-report-notify` ist ein separater Text-Rollout und keine Voraussetzung für die Annahme der Meldung.

Nachweise: `output/reporting-fix-20260911/`. Sicherheits-Advisors vor/nach dem Fix unverändert; keine neuen Befunde und keiner zur neuen RPC. Die vorhandenen allgemeinen Projektbefunde sind damit nicht behoben.

## Prüfung

Die Jest-Tests `askLottiReporting` und `askLottiReportDialog` prüfen die übertragenen
Daten, Fehler und Wiederholung, Abbrechen, Meldegrundpflicht und Doppeltippen.
`supabase/tests/ask_lotti_answer_reports.sql` prüft die RPC, Eingabegrenzen,
Duplikatschutz und Zugriffsrechte in einer isolierten Datenbank. Die SQL-Prüfung
wurde mit PGlite 0.5.8 und der vorhandenen `content_reports`-Tabellendefinition samt
RLS-Regeln ausgeführt. Sie ersetzt keinen Versandtest der veröffentlichten App.

Anforderung: [Google Play – KI-generierte Inhalte](https://support.google.com/googleplay/android-developer/answer/13985936?hl=de).

Am 11. September 2026 nach dem produktiven Fix erneut bestanden: 2 Jest-Suites / 14 Tests (`askLottiReporting`, `askLottiReportDialog`). Reproduzierbarer isolierter SQL-Test mit dem Live-Metadaten-Snapshot:

```sh
PGLITE_PACKAGE=/path/to/node_modules/@electric-sql/pglite node scripts/tests/ask-lotti-reporting-sql.test.mjs output/reporting-fix-20260911/schema-before.json
```
