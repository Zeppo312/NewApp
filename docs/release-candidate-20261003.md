# Produktionskandidat und Schutz der veröffentlichten Version

Stand: 3. Oktober 2026. Die Produktionsartefakte sind fertig. Die iPhone-Version ist in der bestehenden TestFlight-Gruppe verfügbar. Eine öffentliche Freigabe und die vollständige Geräteabnahme sind weiterhin offen.

Nachtrag vom 3. Oktober, 20:39 MESZ: Die überarbeiteten Schwangerschaftsansichten wurden auf Nutzerwunsch als [EAS Update](pregnancy-ota-20261003.md) für den separaten Kandidatenkanal und Runtime 1.0.25 veröffentlicht. Die folgenden Vorher-/Nachher-Nachweise dokumentieren die ursprüngliche Build-Auslieferung; der neue OTA-Nachweis bestätigt zusätzlich den unveränderten öffentlichen `main`-Branch.

## Fertige Artefakte

| Plattform | Version | Native Buildnummer | EAS-Build | Verfügbarkeit |
| --- | --- | --- | --- | --- |
| iOS | 1.0.25 | 1.0.80 | `fdd3dabd-ae10-41db-9e70-925d775402c4` | TestFlight: VALID, IN_BETA_TESTING, Gruppe Tester |
| Android | 1.0.25 | 24 | `e1fbf3c3-ec58-44d5-b5e8-712ad3b94600` | Signiertes AAB fertig; noch kein neuer Play-Release |

Beide verwenden das Produktionsbackend `kwniiyayhzgjfqjsjcfu`, den regulären App-Namen, die geprüften Produktionsschlüssel von RevenueCat, Runtime `1.0.25` und den separaten Kanal `release-candidate-20261003`. Die bisherige App-Konfiguration und alle bestehenden EAS-Profile bleiben erhalten; hinzugefügt wurde das Profil `release-candidate`.

- [iOS-Build](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/fdd3dabd-ae10-41db-9e70-925d775402c4)
- [Android-Build](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/e1fbf3c3-ec58-44d5-b5e8-712ad3b94600)
- [TestFlight-Einreichung](https://expo.dev/accounts/janzeppi/projects/LottiBaby/submissions/9b3ee498-3313-4e44-ad31-525828b6ca87)

Die tatsächlichen EAS-Archive stimmen auf beiden Plattformen in allen 1.073 Dateien mit der eingefrorenen Quelle überein. In beiden fertigen Artefakten sind alle zwölf Schwangerschaftsbilder anhand ihrer vollständigen SHA-256-Werte bestätigt. Signaturen, Backend-Ziel, Consent-RPCs, Google-Callback und neue Schwangerschaftsrouten wurden am Artefakt geprüft. Android: targetSdk 36, 70 native Bibliotheken mit 16-KiB-Ausrichtung, keine Debug-App. iOS: strikte Signaturprüfung erfolgreich.

SHA-256:

- IPA: `d10608d7eccacd91321301cf3211ff27ffaa7fce744df253fe918b810456a4c0`
- AAB: `8b21b4213e2c5b3e363d55441f2a319a070f668d6fe870bcf16c922d508547c8`

## Produktionsserver und Einwilligungen

Gezielt installiert wurden die Durchsetzungsmigration `20261001170812`, die Konten-Kohorte `20261003160141` und die Korrektur `20261003164934`. Es erfolgte kein pauschales `db push`. Globale Consent-Sperre und automatischer Löschworker sind weiterhin ausgeschaltet.

Sechs Serverfunktionen wurden bereitgestellt und anschließend aus Produktion zurückgeladen: Frag Lotti, Spracheingaben, Fürsorge und drei Benachrichtigungsfunktionen. Der Download stimmt bytegenau mit den geprüften Quellen überein. Bestehende Löschprüfungen, Benachrichtigungsauthentifizierung und der bisherige Baby-Fürsorgeablauf wurden erhalten. Die neue Schwangerschafts-Fürsorge nutzt in Produktion derzeit deterministische Hinweise: Der zusätzliche KI-Quota-RPC fehlt dort; deshalb wird keine unbegrenzte KI-Nutzung als Ersatz zugelassen.

### Korrektur der vollständigen Sperre in Build 1.0.80

Der erste Kandidat zeigte bei nicht vorab ausgewählten Konten „Diese App-Version kann gerade noch nicht verwendet werden“. Ursache war die Kopplung von sichtbarer Einwilligungsauswahl und vorab gesetzter Server-Kohorte. Dieser Kandidat hätte so nicht zur Nutzung bereitgestellt werden sollen.

Die Serverkorrektur trennt die Verfügbarkeit der Auswahl von der Konten-Durchsetzung:

1. `get_data_consents` bietet der neuen App die echte Auswahl an. Ein Read erzeugt weder Zustimmung noch Konten-Aktivierung.
2. Erst eine gültige, authentifizierte, ausdrücklich übermittelte Entscheidung aktiviert die Durchsetzung für genau dieses Konto. Ablehnung und Widerruf werden ebenfalls wirksam; eine Zustimmung wird nie automatisch gesetzt.
3. Gesundheitsdaten und KI behalten separate Entscheidungen. KI-Zustimmung braucht zuvor gültige Gesundheits-Zustimmung.
4. Revisionen, idempotente Wiederholung, Live-Account-Prüfung und Löschsperren bleiben erhalten. Eine Wiederholung eines alten Grants stellt einen späteren Widerruf nicht wieder her.
5. Bisherige Konten ohne neue Entscheidung behalten ihren bisherigen Zugriff. Nach einer ausdrücklichen Entscheidung gelten deren Widerrufe auch für weitere Sitzungen und freigegebene Daten dieses Kontos.

Die Korrektur ist serverseitig aktiv; im installierten Produktionskandidaten reicht „Erneut prüfen“. Eine Neuinstallation oder ein OTA-Update ist dafür nicht erforderlich. 26 SQL-Tests und 31 Client-Tests bestanden; der exakte Ablauf wurde zusätzlich mit synthetischen Konten in einer vollständig zurückgerollten Produktionstransaktion geprüft. Ein anschließender Live-Read bestätigt bereits eine tatsächliche Konten-Aktivierung durch eine Entscheidung. Das ersetzt keine Rückmeldung zum konkreten iPhone-Bildschirm oder die komplette native Abnahme.

Die historische private Spalte `installation_evidence` unterscheidet diese Aktivierung mit dem Präfix `explicit-choice-operation:`. Dieser Wert belegt eine authentifizierte Entscheidung, keine attestierte native Installation. Beim Konto-Reset bleiben Durchsetzung und Revisionsuntergrenze bestehen; die bestehenden Löschregeln erfassen die gesamte `user_state`-Zeile.

## Schutz der laufenden Veröffentlichung

Der frische Vorher-/Nachher-Vergleich bestätigt:

- Öffentliche iOS-Version weiterhin **1.0.23 / READY_FOR_SALE**, gleiche App-Store-Versions-ID.
- Alle vier vorher bestehenden EAS-Kanäle samt Branch-Zuordnung und stabilen Update-Daten unverändert.
- Kein neues OTA-Update veröffentlicht; die letzten 50 Update-Gruppen unverändert. Kurzlebige signierte Download-URLs und relative Zeitangaben werden beim Vergleich nicht als Inhaltsänderung gewertet.
- Produktion weiterhin auf `main`, letzte Update-Gruppe `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`.
- Neuer Kandidat auf separatem Kanal und Runtime `1.0.25`.
- Andere öffentliche Tabellen, Funktionen, Berechtigungen und bestehende Policies unverändert gegenüber dem gebundenen Produktionskatalog; hinzu kamen die gezielten Consent-Schutzregeln.
- Ein tatsächlich vorhandenes, nicht neu aktiviertes Konto hat nach der ersten echten neuen Einwilligungsentscheidung weiterhin Gesundheits- und KI-Serverzugriff.
- Keine täglichen Fürsorge-Cronjobs vorhanden. Automatischer Löschworker aus, Löschfreigabe nicht gesetzt. Elf Anbieteraufgaben stehen weiterhin auf `pending`.
- Aktueller interner Android-Release 22 wurde nicht ersetzt; für den Produktionskandidaten wurde kein neuer Play-Release hochgeladen oder ausgerollt.

Das belegt die Schutzgrenzen und die geprüfte Kompatibilität. Es ist keine vollständige Laufzeitabnahme aller Bestandsfunktionen auf allen Geräten.

## Store-Entwurf und verbleibende Freigaben

In der Play Console wurden die bestehende öffentliche Datenschutz-URL und die zutreffende Angabe „keine Behörden-App“ als Entwurf gespeichert. Die Console bestätigt 2/11 abgeschlossene Aufgaben. Diese Angaben wurden nicht zur Prüfung eingereicht. Ein DE-Storetext ist in `store-copy-de.md` vorbereitet. Die weiteren Store-Angaben sind noch nicht abgeschlossen. Review-Zugang, Zielgruppe und die vollständige Datensicherheits-/Gesundheitsdeklaration müssen wahrheitsgemäß zur realen App und ihrem Betrieb passen; fehlende Angaben werden nicht erfunden.

Die Console verlangt für diese App einen geschlossenen Test mit mindestens zwölf über mindestens 14 Tage fortlaufend angemeldeten Testpersonen. Aktuell sind null angemeldet; Produktionszugriff ist gesperrt. Interne Tests erfüllen diese Voraussetzung nicht.

Der iPhone-Simulator konnte die isolierte Release-App bauen, installieren und bis zum regulären Anmeldebildschirm starten. Der Werkzeug-Timeout beim kombinierten Build/Start wurde durch direkten Installations- und Startnachweis aufgelöst. Es waren weiterhin keine physischen iPhones oder Android-Geräte erreichbar; Kauf-/Wiederherstellung, OAuth und komplette Daten-/Familienabläufe sind damit nicht nativ abgenommen.

Für die Schwangerschaftsinhalte liegt ein quellen- und Hash-gebundenes Prüfpaket mit 42 Wochen und 24 Artikeln in DE/EN/ES vor. `EDITORIAL_REVIEW` bleibt korrekt `draft`; eine echte fachliche Freigabe durch eine Hebamme oder gynäkologische Fachperson fehlt. Medizinische Freigabe, Provider-Löschbelege und Restore-Nachweis werden nicht durch technische Tests ersetzt.

Konkrete nächste Aufträge je verbleibendem Schritt:

- **Geräte:** „Prüfe den Produktionskandidaten 1.0.25 / iOS 1.0.80 und Android 24 auf den angeschlossenen Geräten: Login, getrennte Einwilligungen/Widerruf, Familienzugriff, Käufe/Wiederherstellung, Offlinebetrieb und Schwangerschaft. Dokumentiere echte Ergebnisse.“
- **Fachliche Prüfung:** „Arbeite die tatsächliche Freigabe der fachlich qualifizierten Person in das gebundene Schwangerschafts-Prüfpaket ein; dokumentiere Person, Qualifikation, geprüfte Sprachfassungen und Datum.“
- **Play:** „Schließe die Store-Angaben mit bestätigter Zielgruppe und geeignetem Review-Zugang ab, bereite Android 24 im getrennten geschlossenen Test vor und gib den konkreten Upload zur Freigabe vor. Ersetze den bisherigen QA-Track nicht.“
- **Testpersonen:** „Starte mit den bestätigten zwölf Personen den vorgeschriebenen geschlossenen Test und dokumentiere Opt-in und 14-Tage-Verlauf. Versende Einladungen nur an ausdrücklich autorisierte Empfänger.“
- **Löschbetrieb:** „Schließe die elf tatsächlichen Anbieteraufgaben und den Restore-/Register-Nachweis; prüfe die frische Produktionsfreigabe, bevor Annahme und automatischer Worker aktiviert werden.“
- **Veröffentlichung:** „Erstelle nach allen Abnahmen den konkreten Store-Release zur finalen Freigabe und prüfe nach dem autorisierten Rollout seine tatsächliche Verfügbarkeit.“

## Nachweise

Alle öffentlichen, personenbezogen freien Berichte: `output/release-candidate-20261003/`.

- `archive-verification.json`, `ipa-verification.json`, `aab-verification.json`, `pregnancy-artifact-verification.json`
- `testflight-after.json`, `app-store-after.json`, `published-release-preservation.json`
- `backend-stage.json`, `edge-deployment.json`, `backend-preservation.json`
- `consent-self-service-tests.json`, `consent-self-service-production-preflight.json`, `consent-self-service-production-apply.json`, `consent-self-service-production-verification.json`
- `clinical-review-{de,en,es}.md`, `clinical-review-handoff.json`
- `ios-simulator-login.jpg`, `play-draft-dashboard.jpg`

Private, unveränderte Quell- und Artefaktstände: `.family-qa/release-candidate-20261003/`. Enthaltene private Konfigurations-/Credential-Daten dürfen nicht veröffentlicht werden. Die früheren QA-Artefakte bleiben separat in `.family-qa/pregnancy-build-20261003/`.
