# Gemeinsamer App-Teststand – 2. Oktober 2026

Die Fortsetzung wurde von Jan nach der Prüfung der wesentlichen App-Lücken beauftragt. Dieser Schritt betrifft das bestehende isolierte QA-Projekt und neue Testartefakte. Die öffentliche Produktion wird dadurch nicht aktiviert.

## Erledigt

- Im bestehenden QA-Projekt `ggyonianphloycmqrwvj` sind die zwei Consent-Migrationen installiert und aktiviert. 44 Tabellen besitzen restriktive Gesundheits- und Gastregeln sowie Schreibprüfungen. Der bestehende Kontolösch-Hook bleibt unter seinem kanonischen Namen komponiert. Keine direkten Clientrechte auf private Consent-Tabellen; keine Consent-Definer-RPCs im öffentlichen Schema.
- Sechs passende Serverfunktionen sind gezielt deployed und bytegleich zurückgelesen: `ask-lotti`, `voice-log-parse`, `advisor-generate` und die drei Gesundheits-Push-Funktionen. Die vorherige JWT-Konfiguration blieb erhalten. Für Push wurden nur Consent-Prüfungen in die frisch gesicherten QA-Quellen übernommen.
- Die Anmeldung eines bestehenden eigenen QA-Testkontos, dessen Consent-RPC und die tatsächlichen HTTP-Sperren ohne Einwilligung sind geprüft: Gesundheitsdaten und alle drei KI-Endpunkte antworten mit 403. Es wurde kein Konto angelegt und keine positive Entscheidung für vorhandene Nutzer gespeichert.
- Der zuletzt installierte QA-Stand (iOS 1.0.76 / Android 20) wurde gezielt um Consent, Login-/Offline-Korrekturen und die gewünschte Convex-Entfernung ergänzt. 148 Jest-Suites mit 1.323 Tests, beide Typechecks, 24 Consent-Skriptprüfungen, Deno-Typprüfung der sechs Serverfunktionen und iOS-/Android-Exporte bestanden. Gezieltes ESLint: keine Fehler, 83 Warnungen. Ein korrigierter Provider-Testharness wurde anschließend separat erneut geprüft.
- Die tatsächlichen EAS-Archive wurden geprüft: 1.035 bytegleich gebundene App-Dateien pro Plattform, sämtliche App-Quelldateien enthalten, Serverquellen und private Arbeitszustände ausgeschlossen. Beide korrigierten Archive wurden selbst erfolgreich für die jeweilige Plattform exportiert.

Die neuen Builds verwenden das bestehende kostenlose EAS-Kontingent. Es werden keine neuen Projekte, Konten, Tarife oder Einladungen angelegt. QA-OTA bleibt ausgeschaltet.

## Buildstatus

Der erste iOS-Versuch 1.0.77 scheiterte an einem zu breiten Archivfilter, der auch `lib/supabase` ausschloss. Das Muster ist jetzt auf den Serverordner an der Archivwurzel begrenzt. Der zugehörige Android-Versuch 21 wurde gezielt gestoppt; beide ursprünglichen Archive und Fehlernachweise bleiben erhalten.

Korrigierte Builds und tatsächliche Artefakt-/Store-Verfügbarkeit werden in `output/app-tester-readiness-20261002` dokumentiert. Ein gestarteter Build gilt nicht als installierter oder auf Geräten abgenommener Teststand.

Stand nach Artefaktprüfung und bestätigter Verfügbarkeit in beiden bestehenden internen Testkanälen:

| Plattform | Konkreter Stand | Noch offen |
| --- | --- | --- |
| iPhone | App 1.0.24, Build 1.0.78, EAS `93840d13-c4e8-4cea-8ba1-1b4aeb284167`: fertig und signiert geprüft. Einreichung `d5337278-00bc-47ef-a808-6f8f43b61983` erfolgreich. Apple meldet `VALID` und `IN_BETA_TESTING`; der konkrete Build ist in den bestehenden Gruppen „Team (Expo)“ und „Tester“ vorhanden. | Installation und Geräteabnahme. |
| Android | App 1.0.23, Versionscode 22, EAS `f888f7d4-aa7c-42de-8aec-4754ed9b7850`: fertig und geprüft. Upload-Zertifikat stimmt mit unabhängig gelesenen EAS-Angaben überein; Ziel-SDK 36, kein Debug-Build, QA-Backend/Consent/Store-SDK enthalten, OTA aus, 70 native 64-Bit-Bibliotheken 16-KB-konform. Release 11 „22 (1.0.23) – QA Consent und Login“ ist seit 2. Oktober, 19:33 Uhr, im bestehenden internen Play-Track veröffentlicht. Die Console bestätigt „Für interne Tester verfügbar“. | Installation und Geräteabnahme. |

Android behält den nativen Versionsnamen des bewährten Ausgangsstands 1.0.23. Der neue Teststand ist eindeutig über Versionscode 22, Build-ID und Artefakt-Hash zugeordnet; er enthält dieselben aktuellen App-Funktionen wie iOS 1.0.78 und verwendet den QA-Runtime-Namen `family-qa-1.0.24`. Die während der Warteschlange zunächst angezeigte EAS-Version 1.0.24 ist durch die tatsächliche native Artefaktprüfung und die endgültigen Build-Metadaten ersetzt.

Beide Builds sind abgeschlossen. Der vorhandene Play-Console-Zugang wurde für die interne Android-Veröffentlichung verwendet; kein neuer Dienstschlüssel und kein Tarifwechsel. Der bestehende EAS-API-Zugang bestätigt die TestFlight-Verfügbarkeit ohne erneute Browseranmeldung bei Apple. Die einzelne Play-Warnung betrifft eine fehlende R8/ProGuard-Zuordnungsdatei; der geprüfte Android-Ausgangsstand aktiviert R8-Minifizierung nicht. Native Debugsymbole sind im Bundle enthalten.

Die erfolgreiche interne Android-Veröffentlichung ist in [play-internal-availability.json](../output/app-tester-readiness-20261002/play-internal-availability.json) und im folgenden Console-Nachweis festgehalten:

![Android 22 für interne Tester verfügbar](../output/app-tester-readiness-20261002/play-internal-available.png)

Die letzte Prüfung meldet das gepaarte iPhone in Xcode/CoreDevice offline und kein ADB-Gerät auf Android. Beide entsperrten USB-Verbindungen wurden angefragt. Geräteabnahme und positive Einwilligungsentscheidungen bleiben offen. Der erste Funktionstest ist in [Tester-Smoke](tester-smoke-20261002.md) vorbereitet.

## Nächste Geräteabnahme

| Ablauf | Erforderlicher Nachweis |
| --- | --- |
| Consent | Start ohne Freigabe; getrennte Entscheidungen; KI ablehnen; Widerruf offline mit Ab-/Anmeldung; zweites Gerät; weiterhin erreichbare Support-, Lösch- und Aboverwaltung |
| Login und Daten | Rückkehr/Abbruch/Neustart; Wechsel zwischen vorhandenen Konten; eigenes Baby, Familienverknüpfung und aktives Abo bleiben beim richtigen Nutzer |
| Familie | Einladung, gemeinsamer Zugriff und Entfernen; keine fremden Daten; Widerruf einer Quelle verhindert Verarbeitung über Partner |
| Käufe | Ausschließlich vorgesehene Store-Sandbox: Kauf, Wiederherstellung, Verlängerung und Wegfall der Berechtigung; Apple-Trial allein reicht nicht als Verlängerungsnachweis |
| Alltag | Einträge, Timer, Erinnerungen, verweigerte Berechtigungen, Offlinebetrieb und Rückkehr in die App auf beiden Plattformen |

Erst nach einem kleinen erfolgreichen Funktionstest beginnt die breite Testrunde. Tester sollen ausschließlich erfundene Gesundheitsdaten verwenden. Weitere Abnahmen werden pro konkretem Build dokumentiert; frühere Geräteprüfungen werden nicht als Abnahme des neuen Standes übernommen.

## Öffentliche Veröffentlichung

Weiter offen bleiben der regulär betriebene Löschweg aus der App, die abgestimmte Produktions-Consent-Umstellung einschließlich alter Clients/Gastpfade sowie der Abgleich von Datenschutz-/Storeangaben und Review-Zugang. Die elf Anbieter-Nachbearbeitungen bleiben separat dokumentiert. Die zurückgestellte Restore-Freigabegrenze ist kein bestandener Nachweis.

Für diese konkrete Android-App verlangt das Play-Dashboard einen geschlossenen Test mit mindestens zwölf durchgehend angemeldeten Testpersonen über mindestens 14 Tage. Aktuell: null angemeldete geschlossene Tester, Produktionszugriff gesperrt. Der interne Funktionstest startet diese Frist nicht. [Google-Anforderungen](https://support.google.com/googleplay/android-developer/answer/14151465?hl=de)

Vor dem geschlossenen Test müssen elf Pflichtschritte abgeschlossen werden; das Dashboard zeigt aktuell 0/11 als erledigt: Datenschutzerklärung, Review-Anmeldung, Anzeigen, Inhaltsfreigabe, Zielgruppe, Datensicherheit, Behörden-Apps, Finanzfunktionen, Gesundheit, Kategorie/Kontakt und Store-Eintrag. Dies sind offene Store-Aufgaben, keine elf nachgewiesenen App-Fehler. Es wurden keine Tester eingeladen und kein geschlossener Test gestartet. Der konkrete Nachweis steht in `play-release-prerequisites.json`.

Nachweise: `candidate-validation.json`, `archive-verification.json`, `qa-consent-state.json`, `qa-consent-edge-deployed.json`, `qa-authenticated-consent-barrier.json`, `qa-http-rejections.json`, `build-tracking.json`, `ipa-verification.json`, `aab-verification.json`, `testflight-availability.json`, `play-internal-availability.json`, `play-release-prerequisites.json`, `native-device-prerequisites.json`, `tester-handoff.json` und `production-state-final.json` im genannten Output-Verzeichnis. Private Quellen, Zugangsdaten und Rohlogs liegen ausschließlich im ausgeschlossenen `.family-qa/app-tester-20261002`.
