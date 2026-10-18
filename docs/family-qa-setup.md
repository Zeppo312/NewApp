# Isolierte Familienabo-Testumgebung

> **Aktualisierung 24.09.2026:** Aktueller Live-/QA-Stand, zusätzliche Migration,
> App-Korrekturen, neue Builds, den bestandenen Android→iPhone-Hauptfall
> einschließlich Entzug nach Ablauf und die verbleibenden Gerätefälle stehen im
> [Rolloutprotokoll vom 24.09.](family-subscription-test-report-20260924.md).
> Historische Befunde unten (insbesondere leerer Google-Katalog/fehlendes QA-Backend)
> gelten nicht mehr als aktueller Stand. Noch keine Produktionsfreigabe.

Stand 14.09.2026: **Cloud-Testbackend eingerichtet und geprüft; Store-/Geräteabnahme noch offen.**
Die Änderungen dieser Einrichtung betreffen das separate QA-Projekt. Es wurde kein
Produktionsrollout durchgeführt.

## Cloud-Stand

| Bestandteil | Stand |
| --- | --- |
| Supabase-Branch | `family-subscription-qa`, Projekt `ggyonianphloycmqrwvj`, eu-central-1 |
| Ausgangsdaten | Schema-only-Export des Hauptprojekts, keine Kundendaten kopiert |
| Voraussetzungen | Account-Deletion-Migration und Familienabo-Migration gezielt angewendet |
| App-Konten | Vier bestätigte normale QA-Konten, keine Admin-/Tester-Sonderrechte |
| Tarifkonfiguration | Drei Pläne, 14 Features, 42 Zuordnungen aus dem veröffentlichten Katalog |
| Functions | family-subscription-access, revenuecat-webhook, reconcile-family-subscriptions, ask-lotti, advisor-generate |
| RevenueCat | Bestehende Store-Apps und Produkte; vier neue QA-Kunden ohne Käufe |
| Sandbox-Webhook | `Family Subscription QA`, `whintgrac55f6d8e6`, Sandbox only, Authorization + HMAC |
| Reconciliation | Minütlicher QA-Cronjob; erfolgreiche HTTP-200-Aufrufe nachgewiesen |
| Produktionsjobs | Keine Cron-Daten übernommen; ausgehende HTTP-Trigger im übernommenen Schema deaktiviert |

Der Branch kostet laut bestätigter Supabase-Abfrage **0,01344 USD/Stunde**
(0,32256 USD/Tag). Er bleibt während der Abnahme bestehen. Nach Abschluss müssen
QA-Webhook, QA-Jobs und Cloud-Branch kontrolliert entfernt werden. Die lokale
Testautomation und die produktive Abo-Implementierung bleiben erhalten.

Die automatische initiale Branch-Provisionierung meldete `MIGRATIONS_FAILED`,
während das Projekt `ACTIVE_HEALTHY` war: Die alte Migrationshistorie ließ sich
nicht automatisch auf einer leeren Datenbank wiederholen. Das Schema wurde
anschließend explizit ohne Daten wiederhergestellt und die zwei Voraussetzungen
geordnet eingespielt. Der ursprüngliche Provisionierungsfehler kann weiterhin in
der Branch-Metadatenansicht erscheinen. **Diesen Branch nicht automatisch nach
Produktion mergen.** Ein Produktionsrollout benötigt die geprüften, gezielten
Migrationen und einen eigenen Rolloutplan.

## Nachweise

Die 20 Live-Cloud-Prüfungen sind bestanden. Die Ergebnisse liegen in `output/family-qa-20260914/`:

- `cloud-checks.log`: Live-REST-Prüfungen mit echten QA-Nutzer-JWTs und Provider-API;
  gefälschte Premium-Einträge, private Cache-Lesezugriffe, fremde Identitäten,
  versteckte Einladungen und ein zweiter gleichzeitiger Partner werden abgewiesen.
  Die echte Annahme inklusive Synchronisationswrapper funktioniert. Ohne Kauf
  entsteht auch für einen verknüpften Partner kein Premiumzugang.
- Webhook-Prüfungen: falsche Authorization, veränderter Body und alte Signatur
  werden abgewiesen; gültige Signatur und Wiederholungsbehandlung funktionieren.
- `revenuecat-delivery.json`: Zusätzlich echte Zustellung aus dem RevenueCat-
  Dashboard, Ereignis `D8037870-42CC-4C57-B00C-A38579CFD5A5`, HTTP 200,
  Datenbankstatus `completed`, Kennzeichnung `test_event`.
- `cron-check.json`: erfolgreicher minütlicher Abgleich.
- `native-config.log`, `archive-check.json`: native QA-Updates deaktiviert,
  eigene Runtime und geprüftes Upload-Archiv ohne private Backend-Schlüssel.
- `ios-artifact-check.json`: fertige IPA mit QA-Backend, öffentlichem iOS-SDK-Key,
  korrekter App-ID und deaktivierten Updates; `codesign --verify --deep --strict`
  erfolgreich.
- `android-artifact-check.json`: fertiges APK mit QA-Backend, öffentlichem
  Android-SDK-Key, passender Runtime, App-ID und deaktivierten Updates. Das
  extrahierte Zertifikat stimmt mit dem unabhängig dokumentierten EAS-Upload-Key
  überein; eine kryptografische APK-Signaturprüfung mit `apksigner` ist noch offen.
- `security-advisors-review.json`: zusätzliche QA-Datenbankprüfung mit 364
  Warnungen im übernommenen Schema. Die Warnung zur absichtlich für angemeldete
  Nutzer erreichbaren Familien-RPC wurde geprüft: festes `search_path`, Identität
  ausschließlich aus `auth.uid()`, kein anonymer Zugriff. Die übrigen geerbten
  Warnungen sind nicht vollständig auditiert oder behoben. Die bestandenen
  Funktionstests sind keine vollständige Sicherheitsfreigabe der gesamten App.

Reproduzieren (nur mit den privaten QA-Konfigurationsdateien):

```sh
node scripts/family-qa.mjs check
node scripts/tests/family-qa-cloud.mjs
node --test scripts/tests/family-qa-config.test.js scripts/tests/family-qa-setup.test.js
```

Der Cloud-Test erzeugt nur wegwerfbare Einladungen und signierte TEST-Ereignisse.
Einladungen werden anschließend entfernt. Es werden keine bezahlten Kaufnachweise
simuliert. Die positiven Store-Fälle sind damit ausdrücklich noch nicht bestanden.
Die früheren lokalen SQL-/Race-/App-Tests stehen im
[Testprotokoll vom 12.09.](family-subscription-test-report-20260912.md).

## Private Konfiguration

`.family-qa/` ist aus Git und EAS-Uploads ausgeschlossen. Darin liegen Zielprojekt,
vier App-Zugänge, SDK-Konfiguration und Server-Secrets. Keine Passwörter oder
Server-Schlüssel in Berichte oder Git kopieren. Ein isolierter Supabase-CLI-
Arbeitsbereich unter `.family-qa/workspace` ist mit dem QA-Projekt verknüpft.
Das Root-Arbeitsverzeichnis bleibt mit dem ursprünglichen Projekt verknüpft.

Für QA-Mutationen immer den isolierten Arbeitsbereich und explizit die QA-
Projektreferenz verwenden. SQL-Dateipfade für die CLI müssen absolut sein.
`family-qa.mjs seed` prüft normale Profile; `configure` erhält vorhandene QA-
Build-Env-Felder und aktualisiert die Server-Env-Datei. Der tatsächliche HMAC-
Schlüssel ist inzwischen gesetzt, kein Platzhalter.

`OPENAI_API_KEY` wurde am 24.09.2026 im QA-Projekt gesetzt. Die Secret-Liste
bestätigte nur den Namen, nicht den Wert. Mit normalen verknüpften QA-Konten
lieferten `ask-lotti` und `advisor-generate` danach echte positive KI-Antworten;
beide Nutzer belasteten jeweils den Tageszähler des zahlenden Kontos.
Details stehen im [Familienabo-Testprotokoll](family-subscription-test-report-20260924.md).
Die Ablehnung ohne Abo war zuvor live mit HTTP 403 geprüft worden. Die
KI-Oberflächen auf Geräten sind noch nicht visuell abgenommen.

## Native QA-Builds

Die Profile `family-qa-ios` und `family-qa-android` enthalten die tatsächliche
QA-Adresse und beide öffentlichen Store-SDK-Keys. Store-App-IDs bleiben gleich,
damit dieselben IAP-Produkte geprüft werden können. Dedizierte Testgeräte nutzen:
eine QA-Installation kann die normale App ersetzen.

Die isolierte Build-Kopie liegt unter `.family-qa/build-native`. Ein vollständiger
`expo prebuild --no-clean` scheiterte dort an einem bestehenden Apple-Targets-
Plugin (`removeFromProject`). Deshalb wurden die kopierten nativen Verzeichnisse
zurück auf den unveränderten Ausgangsstand gesetzt und ausschließlich die
benötigten QA-Werte mit `scripts/family-qa-native.mjs` gesetzt:

- Name „Lotti Baby QA“;
- iOS `EXUpdatesEnabled=false` und Android `expo.modules.updates.ENABLED=false`;
- Runtime `family-qa-1.0.24` auf beiden Plattformen.

Der Archivtest hat außerdem gezeigt: `EAS_NO_VCS=1` allein reicht in einer Kopie
unterhalb des bestehenden Git-Repos nicht aus. Die EAS-CLI kann sonst den
übergeordneten Repository-Root archivieren. **Bei allen QA-Builds zusätzlich
`EAS_PROJECT_ROOT` absolut auf `.family-qa/build-native` setzen.** Das tatsächlich
verwendete Archiv wurde danach erneut geprüft. `.mcp.json` und `supabase/.temp`
sind zusätzlich aus den EAS-Uploads ausgeschlossen.

Zwei Builds wurden ohne automatische Store-Einreichung gestartet:

- Android: `f2d4b9f3-25c0-4e39-96d6-fc8c268f7d9d`, Profil family-qa-android, APK.
- iOS: `938bd517-f8b3-4b6f-a166-dd34c1dd8ac2`, Profil family-qa-ios, Store-Signierung.

Beim Start standen im Expo-Free-Konto noch elf Builds je Plattform zur Verfügung.
Ein gestarteter Build ist kein erfolgreicher Build und keine TestFlight-Freigabe.
Beide Builds sind inzwischen `FINISHED`. Die IPA liegt privat unter
`.family-qa/family-qa-ios.ipa`; App-Version 1.0.24, Build 1.0.58. Ihre native
QA-Konfiguration, das Backendziel und die Signatur wurden am fertigen Artefakt
geprüft. Das APK liegt unter `.family-qa/family-qa-android.apk`, Version 1.0.23,
Versionscode 4; native Konfiguration, eingebettetes Backendziel und Store-SDK-Key
sind ebenfalls geprüft. Die Zertifikatszuordnung ersetzt keine vollständige
kryptografische APK-Prüfung. Es wurde kein Build bei TestFlight oder Google Play
eingereicht.

## Store-Testzugänge

- Google: Liste „Familienabo QA“ mit der gewünschten Gmail-Adresse erstellt,
  als Lizenztester aktiviert und zum internen Testtrack hinzugefügt. Bestehende
  interne Tester bleiben erhalten. Lizenzantwort `RESPOND_NORMALLY`.
- [Interner Google-Testbeitritt](https://play.google.com/apps/internaltest/4700496565960497773):
  vorhandener Store-Build ist noch nicht der neue QA-Build. Ein Testtrack-Beitritt
  ersetzt nicht die Lizenztesterfreigabe; im Kaufdialog muss die Testzahlungsart stehen.
- RevenueCat / Google Play (live geprüft am 14.09.2026): JSON ist gespeichert.
  Projekt, maskierter Schlüsselpräfix und Dienstkonto-Adresse stimmen mit dem
  eingerichteten Konto überein; Paketname ist `com.LottiBaby.app`. Erneute
  Validierung zunächst mit unzureichenden Berechtigungen fehlgeschlagen; im Verlauf
  dieser Prüfung anschließend **Valid credentials** mit allen drei Checks:
  Kaufprüfung, Produktkatalog und Abo-Katalog/Basispläne. Keine neuen Schlüssel
  oder breiteren Play-Rechte nötig. Noch keine vollständige Produktionsabnahme.
- Play-Zugang: Dienstkonto aktiv, Zugriff ohne Ablaufdatum und ausschließlich auf
  Lotti Baby. Die gespeicherten Checkboxen wurden erneut geöffnet: App-Lesezugriff,
  zugehörige App-Qualität, **Finanzdaten einsehen** und **Bestellungen und Abos
  verwalten** sind ausgewählt. Administrator-, Release- und Store-Präsenzrechte
  sind nicht ausgewählt. Rechte bei dieser Prüfung nicht erweitert.
- Google Cloud: Projekt `lotti-baby-billing-2026`, Dienstkonto
  `revenuecat-lotti-baby@lotti-baby-billing-2026.iam.gserviceaccount.com`.
  Pub/Sub Editor und Monitoring Viewer waren bereits gespeichert. Android
  Developer API ist aktiviert. Fehlende Pub/Sub- und Reporting-API wurden im
  Rahmen der freigegebenen Einrichtung aktiviert und als „Aktiviert“ bestätigt.
  Kein Abrechnungskonto und kein Cloud-Testguthaben in diesem Schritt aktiviert.
- Entwicklerbenachrichtigungen: RevenueCat zeigt **Connected to Google** für
  `projects/lotti-baby-billing-2026/topics/Play-Store-Notifications`. Zugehöriges
  Cloud-Abo: `RevenueCat-Subscriber-appa49481b191`. Play-Ereignisziel gespeichert,
  aktiv für Abos und ungültige Käufe. „Track new purchases from server-to-server
  notifications“ bleibt deaktiviert. Der erste Google-Sendetest schlug fehl;
  fehlendes themenbezogenes Publisher-Recht für
  `google-play-developer-notifications@system.gserviceaccount.com` danach mit der
  vorhandenen Nutzerfreigabe ergänzt. Google bestätigt „Richtlinie aktualisiert“
  und mögliche Übernahmezeit von einigen Minuten. Wiederholter Test erfolgreich:
  RevenueCat bestätigt **Last received 2026-09-14, 8:12 p.m. UTC** (22:12 MESZ).
- Schlüssel: Bestehender Download `lotti-baby-billing-2026-03b891c9ddd9.json`
  wurde vom Nutzer bei RevenueCat hinterlegt; nach Reload bestätigt. Kein neuer
  Schlüssel erzeugt, keine Schlüsselinhalte gelesen/ausgegeben. Frühere Probleme
  mit macOS-Downloads-Zugriff und Chrome-Dateiauswahl sind historische Befunde.
- Einordnung des ursprünglichen Fehlers: Die Kaufvalidierung wurde nach den
  API-Aktivierungen und während der Einrichtung erfolgreich. Welcher Anteil
  auf verzögerte Google-Rechteübernahme entfällt, ist nicht isoliert nachgewiesen.
  Pub/Sub-Senderechte betreffen den Ereignisweg. Der erfolgreiche Zugangstest
  und das empfangene Testereignis ersetzen keine echten Sandbox-Käufe oder
  Geräteprüfungen der Familienberechtigungen.
- Google-Abos: Der aktuelle Play-Katalog wurde erneut gelesen und ist leer.
  Produkte/Basispläne, bestätigte Preise und RevenueCat-Package-Zuordnungen fehlen
  zusätzlich. Historische Code-Fallbackpreise sind keine Preisfreigabe.
- Einordnung: Die RevenueCat-/Google-Verbindung ist gemeinsame dauerhafte
  Store-Infrastruktur und wäre auch für Produktionskäufe verwendbar. Ihre
  Einrichtung allein veröffentlicht weder eine App noch die Familienabo-Migration.
  QA-App, QA-Backend und Sandbox-Kaufnachweise bleiben getrennt. Die dauerhafte
  Store-Verbindung später nicht zusammen mit dem temporären Testbackend löschen.
- Apple: erster Sandbox-Account „Lotti QA Käufer“ in Deutschland erstellt und
  nach Reload bestätigt. Zweite gewünschte iCloud-Adresse wurde von Apple als
  bereits verwendet abgewiesen; Ersatzadresse angefragt. Passwörter gibt der
  Nutzer direkt bei Apple ein. Die Sandbox-Familie ist noch nicht eingerichtet.

Nach Einrichtung: Store-Fälle G01–G11 aus dem bisherigen Testprotokoll durchführen,
insbesondere vorhandene Apple-Familienfreigabe, beide Plattformrichtungen,
Kauf/Wiederherstellung, Ablauf/Erstattung, Partnertrennung und gemeinsam begrenzte
KI-Quoten. Produktionsfreigabe erst nach dokumentierter Geräteabnahme.

## Zusätzliche Build-Sperre

Der EAS-Post-Install-Hook ruft jetzt `scripts/check-family-qa-build.mjs` auf.
Er verlangt für QA eine getrennte Backendreferenz, das passende QA-Profil, den
öffentlichen SDK-Key der Plattform sowie deaktivierte native Updates und die
passende Runtime. Ein versehentlicher QA-Build aus den normalen nativen Root-
Verzeichnissen wird abgewiesen. Produktion ohne QA-Env bleibt unverändert.
Der Hook wurde mit negativen Fixtures und gegen Root-/QA-Archiv geprüft.
Die bereits gestarteten zwei Builds enthalten diesen nachträglich ergänzten Hook
noch nicht; deren hochgeladenes Archiv wurde vorab separat mit denselben
Isolationsanforderungen kontrolliert.
