# Löschalarm abgeschaltet – 10.10.2026

Auf den Nutzerauftrag „Kannst du bitte diesen Löschalarm abschalten“ wurden die bestehenden automatischen Mailalarme um 14:29 Uhr Europe/Berlin mit `cron.alter_job(..., active => false)` pausiert.

| Umgebung | Projekt | Cronjob | Job-ID | Verifizierter Status |
| --- | --- | --- | --- | --- |
| Produktion | `kwniiyayhzgjfqjsjcfu` | `account-deletion-alert-production` | 3 | `active=false` |
| QA | `ggyonianphloycmqrwvj` | `account-deletion-alert-qa` | 4 | `active=false` |

Das pausiert alle planmäßigen Mails dieses Alarmkanals, einschließlich technischer Störungsmeldungen. Die Jobs und ihre Versandkonfiguration bleiben für eine spätere Wiederaufnahme gespeichert. Die Änderung betrifft ausschließlich ihren Aktivstatus; sie ist kein Abschluss offener Löschaufträge.

Beide Transaktionen prüften den erwarteten Jobnamen und den Aufruf der Funktion `account-deletion-alert`. Ein Hashvergleich innerhalb jeder Transaktion bestätigt unveränderte andere Cronjobs. In Produktion bleiben Planner- und Baby-Erinnerungen aktiv. In QA bleiben Abo-Nachprüfungen aktiv und der bestehende Löschworker inaktiv. Es wurden keine Löschdaten, Providerbelege, Edge Functions, Secrets oder lokalen Registerdienste verändert.

Eine unabhängige lesende Nachprüfung am 10.10. um 14:30 Uhr Europe/Berlin bestätigt für beide Projekte jeweils:

- aktive Alarmjobs: 0
- laufende Alarmjobs: 0
- wartende Alarmrequests: 0

Der letzte Produktionslauf begann um 14:29 Uhr, der letzte QA-Lauf um 14:25 Uhr. Die Ergebnisse sind in [Produktionsstatus](../../output/deletion-alert-disabled-20261010/production-paused.json), [QA-Status](../../output/deletion-alert-disabled-20261010/qa-paused.json), [Produktionsnachprüfung](../../output/deletion-alert-disabled-20261010/production-verified.json) und [QA-Nachprüfung](../../output/deletion-alert-disabled-20261010/qa-verified.json) gespeichert. Die ausgeführten SQL-Dateien liegen im selben Verzeichnis.

Für eine spätere ausdrücklich gewünschte Wiederaufnahme im jeweiligen Projekt:

```sql
-- Produktion
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'account-deletion-alert-production'),
  active => true
);

-- QA
SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'account-deletion-alert-qa'),
  active => true
);
```
