# Onboarding: Baby-Anlage mit RLS – Produktions-OTA vom 14.10.2026

Der Fehler `42501: new row violates row-level security policy for table baby_info`
ist mit der Migration `20261006043754` in isoliertem PostgreSQL reproduziert.
Die SELECT-Policy nutzt einen STABLE-Snapshot, der den gerade eingefügten
Datensatz bei `INSERT ... RETURNING` noch nicht enthält. Die produktive
Policy wurde vor der Korrektur ausschließlich lesend bestätigt.

`lib/baby.ts` erzeugt für neue Babys jetzt vorab eine UUID und fordert beim
INSERT keine Zeilenrückgabe an. Erst nach erfolgreicher Serverantwort erhält
der Aufrufer die bestätigte ID und die geschriebenen Profildaten. Reguläre
Aktualisierungen laden das gespeicherte Profil. Der gemeinsame Pfad gilt für
Onboarding und weitere Baby-Anlagen. RLS, Einwilligungsprüfung, Kontolöschsperre
und Besitzer-/Partnerzuordnung bleiben wirksam.

## Veröffentlichung

Am 14.10.2026 um 12:25 Uhr MESZ im Projekt `@janzeppi/LottiBaby`
(`d7120520-e4ff-4967-a797-627a2cb3680b`), Kanal `production`, Branch `main`,
EAS-Umgebung `production`, für beide Plattformen vollständig veröffentlicht.
Die unterschiedlichen bestehenden Runtimes ergeben zwei Update-Gruppen.

| Plattform | Runtime | Gruppe | Update-ID |
| --- | --- | --- | --- |
| iOS | `1.0.24` | [0ce437d9](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/0ce437d9-37e3-4c89-8b0b-765f39569109) | `01a139f2-4c8f-7b6b-b786-5479dc780221` |
| Android | `1.0.23` | [f698b27f](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/f698b27f-662e-458f-859b-0b9edc868302) | `01a139f2-4c8f-7e1f-aefa-fed338e15c97` |

Die isolierte Quelle basiert auf dem neuesten Produktionscommit
`9cce4145656478b8df5a237bce3aaa5952849649`. Alle 3.259 Dateihashes wurden
geprüft. Gegenüber dieser Basis ändern sich nur `lib/baby.ts` und zwei
Regressionstestdateien. Native Konfiguration, Abhängigkeiten und Assets
entsprechen der Produktionsbasis; andere Arbeitskopieänderungen wurden nicht
mit veröffentlicht.

## Prüfung und Grenzen

- 75 App-Tests in sechs Suites im isolierten Stand erfolgreich.
- App-/Test-Typecheck und ESLint der geänderten TypeScript-Dateien erfolgreich.
- Zwei lokale PostgreSQL-Regressionsfälle bestätigen den ursprünglichen Fehler,
  die funktionierende Anlage, Besitzer-/Partnerzugriff sowie die Ablehnung bei
  fehlender Einwilligung oder laufender Kontolöschung.
- Beide Hermes-Exporte erfolgreich; Asset-Hashes entsprechen vollständig der
  Produktionsbasis: 120 iOS- und 125 Android-Assets, jeweils ohne Bundle.
- Produktionsmanifeste liefern HTTP 200 mit den neuen Update-IDs, passenden
  Runtimes, erwarteten Bundle-Hashes und allen Asset-Hashes.
- Kanalzuordnungen und andere Kanäle nach Veröffentlichung unverändert.
- Die produktive Datenbank wurde nicht verändert; es gab keine Migration oder
  produktiven Schreibtests. Während der OTA-Veröffentlichung gab es auch keine
  Datenbankabfragen.
- Direkte CDN-Bundleabfragen liefern HTTP 403. Die geprüften Bundle-Hashes
  stammen aus den ausgelieferten Manifesten; CDN-Bytes und Installation auf
  einem Gerät sind nicht verifiziert.

Der erste Veröffentlichungsversuch wurde vom EAS-Server wegen des expliziten
100-%-Rolloutparameters abgelehnt. Der Kanalstand blieb unverändert.
Die erfolgreiche Wiederholung verwendet den standardmäßigen vollständigen
Rollout und exakt dieselben geprüften Bundles.

Eine kompatible Produktionsinstallation online vollständig schließen und
öffnen, den Download abwarten und anschließend gegebenenfalls erneut vollständig
schließen und öffnen. Danach das Onboarding bis zur Baby-Anlage prüfen.
Die Veröffentlichung adressiert die oben angegebenen Produktionsruntimes;
andere Runtimes sind dadurch nicht automatisch versorgt.

Belege: `output/onboarding-baby-ota-20261014/`, insbesondere
`source-isolation.json`, `export-verification.json`,
`served-manifest-verification.json` und `publication-verification.json`.
Die isolierte Quelle liegt unter
`.family-qa/onboarding-baby-production-ota-20261014/source`.

Referenzen: [PostgreSQL STABLE-Snapshots](https://www.postgresql.org/docs/current/xfunc-volatility.html),
[Expo Runtime-Kompatibilität](https://docs.expo.dev/eas-update/runtime-versions/),
[Expo Update-Auslieferung](https://docs.expo.dev/eas-update/deployment/).
