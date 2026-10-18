# Vom QA-Build zum finalen Produktionsstand

Aktueller Umsetzungsstand: [Produktionskandidat vom 3. Oktober](release-candidate-20261003.md). Die folgenden Angaben sind der historische Read vor der anschließenden Umsetzung.

Stand: 3. Oktober 2026, 15:25 UTC. Reiner Read; keine Produktionsänderung, Aktivierung, Nachricht oder Store-Einreichung.

Die aktuellen iPhone-/Android-Artefakte sind signierte Store-Builds. QA ist die bewusst gewählte Testkonfiguration: Backend `ggyonianphloycmqrwvj`, Profile `family-qa-ios` / `family-qa-play`, Runtime `family-qa-1.0.24`, ausgeschaltete OTA-Updates. Der Buildprozess und die Signierung sind erfolgreich geprüft. Ein Produktionsprofil ist bereits in `eas.json` vorhanden.

## Konkrete offene Arbeit

| Schritt | Belegter Stand | Was noch erforderlich ist |
| --- | --- | --- |
| Produktions-Consent | Frischer Read: `enabled=false`, keine Aktivierung oder Freigabe, Client-/Edge-Release leer. Verwaltungsmigration `20261001170732` vorhanden, Durchsetzungsmigration `20261001170812` fehlt in der Produktionshistorie. | Datenbank-Sperren und zugehörige Serverfunktionen gezielt fertigstellen und prüfen. Den Rollout mit der neuen App abstimmen, damit ältere Clients und Gastabläufe kontrolliert behandelt werden. |
| Kontolöschung im regulären Betrieb | Frischer Read: Cloud-Worker `ACCOUNT_DELETION_ENABLED=false`, kein freigegebener Fingerprint oder Freigabezeitpunkt. Der dokumentierte eigene Produktions-Einzeltest lief als lokaler Operator, nicht über die öffentliche App-/Cloudstrecke. | Den regulären Annahme-, Worker- und Betriebsweg einschließlich offener Anbieter-/Restoregrenzen zur Freigabe bringen. Den bereits bestandenen Einzeltest nicht als vollständige Aktivierung ausgeben. |
| Geräteabnahme | Die neuen Artefakte sind fertig und geprüft. Für genau iOS 1.0.79 / Android 23 liegt in dieser Aufgabe keine Installation oder native Abnahme vor. | Login, Consent/Widerruf, Familienzugriff, Kauf/Wiederherstellung, Offlinebetrieb und die neue Schwangerschaftsansicht auf iPhone und Android prüfen. |
| Schwangerschaftsinhalte | Code-Version `2026-10-03.1`: `status=draft`, `reviewedBy=null`, `reviewedAt=null`. | Fachliche Prüfung der neuen Texte nach dem abgestimmten Plan; tatsächliche Person, Qualifikation und Datum dokumentieren. |
| Produktionskonfiguration | Produktionsprofil vorhanden; vorhandene QA-Binaries sind an Testbackend und QA-Runtime gebunden. | Aus dem geprüften App-Stand eine Produktionsquelle ableiten: echtes Backend `kwniiyayhzgjfqjsjcfu`, regulärer App-Name, abgestimmter Updatekanal/Runtime und konsistente native Versionsdaten. Danach Produktionsartefakte bauen und erneut prüfen. |
| Store-Veröffentlichung | Die neuen Builds wurden noch nicht eingereicht. Letzter Play-Console-Nachweis vom 2. Oktober: App-Einrichtung 0/11, geschlossener Test nicht gestartet, Produktionszugriff gesperrt. | Aktuelle Store-Angaben und Review-Zugang abschließen. Für diese Android-App gilt nach dem dokumentierten Console-Stand die Voraussetzung von zwölf fortlaufend angemeldeten Testpersonen über mindestens 14 Tage; anschließend Produktionszugriff beantragen. Console-Status wurde in dieser Aufgabe nicht erneut live geöffnet. |

Die Store-Voraussetzungen betreffen die Veröffentlichung, nicht die Möglichkeit, ein Produktionsartefakt zu bauen. Der Produktionsbuild kann vor der abschließenden Store-Freigabe erstellt und über TestFlight bzw. Test-Tracks geprüft werden. Eine globale Aktivierung der Backend-Sperren ist mit der Client-Verfügbarkeit zu koordinieren.

## Nächster konkreter Schritt

Den Produktions-Consent-Rollout auf Basis der funktionierenden QA-Umsetzung als gezielten, überprüfbaren Kandidaten vorbereiten und die Geräteabnahme des neuen App-Stands durchführen. Kontolöschbetrieb und fachliche Inhaltsprüfung separat schließen. Danach den geprüften Stand auf die Produktionskonfiguration umstellen und einen Release-Kandidaten bauen; die Store-Freigabe bleibt ein weiterer Schritt.

## Nachweise

- Frischer Produktions-Read: `output/production-build-readiness-20261003/production-consent.json`.
- Fertige QA-Artefakte und ihre Prüfung: `docs/pregnancy-build-20261003.md` und `output/pregnancy-build-20261003`.
- Inhaltsstatus und Abnahme: `docs/pregnancy-implementation-20261003.md` und `lib/pregnancy-guide/types.ts`.
- Abgrenzung des eigenen Löschtests: `docs/privacy/deletion-real-account-test-20261002.md`.
- Letzter Store-Stand: `output/app-tester-readiness-20261002/play-release-prerequisites.json`.
- Aktuelle Google-Anforderungen: <https://support.google.com/googleplay/android-developer/answer/14151465?hl=de>.
