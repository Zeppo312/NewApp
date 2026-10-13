# iOS-QA-Folgeauftrag – 01.10.2026

Status: **Abgeschlossen: Google-QA eingerichtet; iOS 1.0.24 (1.0.74) geprüft und für bestehende interne TestFlight-Tester verfügbar. Geräteabnahme und allgemeine Release-Freigabe bleiben offen.**

## Google-Einrichtung

Der Nutzer hat die Verwendung des vorhandenen echten Originaldownloads ausdrücklich bestätigt. Die private Datei wurde unverändert verwendet. Der QA-Callback wurde im vorhandenen Google-Web-Client ergänzt, gespeichert und nach erneutem Öffnen bestätigt. Produktions-Callback und Client bleiben erhalten; kein Secret wurde neu erstellt oder rotiert.

Das Einrichtungsskript akzeptiert den Originaldownload zusätzlich zu einem höchstens 24 Stunden alten Console-Nachweis, der exakt an Client, QA-Projekt und Callback gebunden ist. Fünf Einrichtungstests prüfen auch falsche bzw. veraltete Nachweise.

QA `ggyonianphloycmqrwvj`: Google aktiv, Client-ID korrekt, Secret durch erfolgreichen PATCH aus dem Originaldownload eingerichtet, nativer Callback erlaubt. Management-GET liefert einen opaken Secretwert; kein Klartextvergleich und noch kein vollständiger Google-Login nachgewiesen. Öffentliche Einstellungen melden Google aktiv, OAuth liefert HTTP 302 zum richtigen Google-Client und QA-Supabase-Callback mit OpenID/E-Mail/Profil. Andere Provider (einschließlich Apple) und vorhandene Redirects sind unverändert.

## Quelle und Prüfungen

Isolierte Quelle: `.family-qa/ios-google-20261001/source/`, aus der persistierten Retry-Quelle und 19 manifestgeprüften Google-Dateien. Gemeinsam bearbeitete Dateien wurden anhand der rekonstruierten, hashgeprüften Google-Basis zusammengeführt. Der Haupt-Checkout wurde nicht als Buildquelle verwendet.

Beim Test wurde eine Abhängigkeit des Google-Änderungssatzes vom neueren Login-Basisstand erkannt und gezielt übernommen: vorausgefüllten Einladungscode beim Moduswechsel zur Registrierung erhalten. Zwei ältere Subscription-Testdateien wurden an die bereits vorhandene native Store-Verwaltung angepasst; die zusätzlichen Retry-Regressionstests ebenfalls übernommen. Keine weitere App-Funktion aus dem Haupt-Checkout übernommen.

- 133 Jest-Suites, 1.188 Tests bestanden.
- Beide Typechecks bestanden.
- Fünf Google-Einrichtungstests und 16 QA-/Build-Skripttests bestanden.
- Gezieltes ESLint: keine Fehler, 13 Warnungen.
- Datenschutz-Synchronisierung bestanden.
- iOS- und Android-JavaScript-Export bestanden; kein Android-Native-Build.
- Native QA-Isolierung für beide Plattformen bestanden: QA-Runtime und OTA deaktiviert.
- Retry-Hook SHA-256 unverändert: `403430d32ba1458477be1e1802de8a1fe7f544518be28ffa51d33d7b9dbe0b7b`.
- 1.030 nicht ausgeschlossene Quelldateien auf bekannte private QA-/Google-Schlüssel geprüft; kein Fund.

## Build und offene Abnahme

Expo Free am 01.10. live geprüft: neues Kontingent, iOS 0/15 und Android 0/15 vor diesem Auftrag. Aktuelle Buildliste enthält noch keinen Build mit der gemeinsamen Quelle; zuletzt iOS 1.0.70 vom 29.09. Der neue Auftrag verwendet `EAS_NO_VCS=1` und `family-qa-ios`.

IPA-Verifikation, TestFlight-Verarbeitung und Tester-Verfügbarkeit sind abgeschlossen (Nachweise unten). Native Google-/Apple-Anmeldung, Rückkehr/Abbruch/Kontowechsel und iOS-Retry-/Offline-Abnahme bleiben eigene Schritte. Der spätere Android-Build bleibt separat offen. Allgemeine Release-Blocker siehe `release-readiness-20260929.md`.

Keine Produktionsveröffentlichung, kein OTA-Update und kein Tarifwechsel. Der einmalige Folgeauftrag wurde nach dem früheren Download-Blocker pausiert; die vom Nutzer autorisierte Fortsetzung erfolgt in diesem Chat.

Nachweise: `output/ios-google-qa-20261001/`, insbesondere `backend-verification.json`, `google-callback-verification.json`, `google-callback-saved.png`, `merge-results.json`, `final-source-manifest.json`, `checks.json`, `jest.json` und `source-secret-check.json`.

## Erster Cloudversuch und Archivwurzel

Build `b2404e1f-ec1c-48c1-94c4-3b7f9d069946`, Nummer 1.0.73, scheiterte vor Installation/Kompilierung: `package.json does not exist in /Users/expo/workingdir/build/.family-qa/ios-google-20261001/source`. Die installierte EAS CLI leitet trotz `EAS_NO_VCS=1` die Archivwurzel aus dem übergeordneten Git-Repository ab, wenn `EAS_PROJECT_ROOT` fehlt. Dadurch wurde fälschlich dessen Archiv verwendet; die ausgeschlossene QA-Unterquelle war im Upload nicht enthalten. Kein IPA entstand.

Korrektur: `EAS_PROJECT_ROOT` ausdrücklich auf die isolierte Quelle setzen. Vor erneutem Build das von EAS erzeugte Archiv mit der geprüften Quelle vergleichen und auf private Schlüssel kontrollieren. Keine App-Codeänderung für diesen Fehler.

Archivprüfung bestanden: 1.030 Dateien, alle bytegleich zur geprüften Quelle, private Schlüssel ausgeschlossen. Neuer Build: `16b08bb8-b8bf-4db2-b267-55f66d21b8e3`, Version 1.0.24, Nummer 1.0.74.

## Verifiziertes IPA

Build 1.0.24 (1.0.74), EAS `16b08bb8-b8bf-4db2-b267-55f66d21b8e3`, abgeschlossen am 01.10.2026 um 06:01:02 UTC.

- Bundle-ID und Versionsnummern stimmen mit aktuellen EAS-Metadaten überein.
- `codesign --verify --deep --strict` bestanden.
- QA-Backend, öffentlicher iOS-Store-Schlüssel und Google-Callback im Bundle enthalten; Apple-/Google-Buttontexte vorhanden.
- Native OTA-Updates deaktiviert; Runtime `family-qa-1.0.24`.
- Alle 280 IPA-Dateien auf bekannte private QA-Schlüssel, QA-Passwörter und Google-Client-Secret geprüft; kein Fund.
- IPA SHA-256: `933c43d184372f2798cfde238e689687dd78dedae09ad1cd00eb9c77600e2fdd`.

Die Übermittlung genau dieses Build-IDs an TestFlight wurde nach bestandener IPA-Prüfung gestartet. Kein automatisches Erstellen einer neuen Testergruppe, keine zusätzlichen Einladungen.

Submission `ecc99b5e-7e85-436b-9fbc-27494f2dcf0c` ist `FINISHED` (01.10.2026 06:02:42 UTC). Apple hat den Build inzwischen erfolgreich verarbeitet. Die bestehenden internen Gruppen haben bereits Zugriff auf alle Builds und führen 1.0.74 jetzt in ihrer Buildliste. Keine Gruppenzuordnung wurde geändert.

Kontingent nach dem Build: Free, iOS 1/15 und Android 0/15; 0 Cent Zusatzkosten. Der vor Installation gescheiterte erste Versuch wird aktuell nicht als verbrauchter Build gezählt.

## TestFlight-Abschluss

Am 01.10.2026 um 08:14 MESZ abschließend live bestätigt:

- Apple-Build `464c9234-2212-4e38-99f3-d200b9376c6f`, Version 1.0.24 (1.0.74): `VALID`, `IN_BETA_TESTING`, nicht abgelaufen; keine offene Export-Compliance.
- Interne Gruppe **Team (Expo)**: 1 bestehender Tester, Build 1.0.74 zugeordnet. Ebenfalls automatisch in den vorhandenen internen Gruppen Tester und EarlyBirds verfügbar.
- Externe Gruppen haben diesen Build nicht; keine Einladungen und keine externe Beta-Review angestoßen.
- Upload-Endpunkt: `COMPLETE`, keine Fehler/Warnungen. Die eigentliche Build-Verarbeitung und Gruppenzuordnung wurden zusätzlich geprüft; der Uploadstatus allein wurde nicht als Verfügbarkeit gewertet.
- Öffentliche Store-Version bleibt 1.0.23 (1.0.55). Kein Produktionsrelease und kein OTA.
- Der einmalige Kontingent-Folgeauftrag ist nach Abschluss beendet; kein weiterer automatischer Build.

Nachweise: `testflight-build.json`, `testflight-groups.json`, `submission.json`, `apple-upload-state.json` und `ipa-verification.json` in `output/ios-google-qa-20261001/`.

**Nächste getrennte Schritte:** Build 1.0.74 auf dem iPhone installieren und Google-/Apple-/E-Mail-Anmeldung, Browserrückkehr, Abbruch, Einladung, Kontowechsel und Retry/Offline→Online nativ abnehmen. Danach den separaten Android-Testbuild planen. Für eine allgemeine Release-Freigabe bleiben außerdem die offenen Store-/Alt-App- und Löschbetriebsnachweise aus dem Release-QA-Bericht relevant.
