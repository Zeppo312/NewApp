# Release-QA – 29.09.2026

**Arbeitsstand, noch keine gemeinsame Produktionsfreigabe.**

Aktueller Stand:

- Verlängerungskorrektur im QA-Backend und in iOS70/Android16 enthalten.
  Nativer Google-Renewal und Offline-Ablauf/Netzrückkehr auf Android bestanden.
- Apple-Abo-Reihenfolge nach ausdrücklicher Freigabe live korrigiert:
  Premium 1, Standard 2, Lite 3; sechs vorhandene Produkte, keine Preisänderung.
- Zusätzliche Retry-Korrektur nach nativem Offline-Kaltstart gefunden und
  abgesichert: aktuell 136 Suiten/1.189 Tests sowie beide Typechecks grün.
- iOS70 und Android17 installiert. Android17 mit letzter Retry-Korrektur
  geprüft und im internen Play-Track veröffentlicht; Installation und
  bytegleicher JavaScript-Bundle zum geprüften AAB bestätigt.
  Offline-Retry bei drei Messpunkten sowie automatische Online-Rückkehr
  ohne Bedienung oder Neustart auf Android17 bestanden.
  iOS-Fortsetzung am 01.10.: Kontingent frei, Google-QA eingerichtet und
  gemeinsame Google-/Retry-Quelle geprüft; iOS 1.0.24 (1.0.74) mit verifiziertem
  IPA in TestFlight verarbeitet und für bestehende interne Tester verfügbar, siehe
  [aktueller Folgeauftragsbericht](ios-google-qa-20261001.md).
- Apple-Kauf unter TestFlight bestätigt; neuer Beleg ist trialing und damit
  kein bezahlter Apple-Renewal-Nachweis. Native iPhone-Offline-Abnahme, übrige
  Store-/Alt-App-Fälle und separate Release-/Löschbetriebsentscheidungen offen.

## Verlängerungskorrektur

Die separate RevenueCat-Liste `active_entitlements` fiel bei tatsächlichen
Verlängerungen vorübergehend leer aus, obwohl die Subscription weiter
`gives_access=true` meldete. Der bisherige Servercode gab deshalb 503 zurück;
nach der alten Frist wurde der Partner gesperrt.

Der Nutzer hat auf die konkrete Frage nach einer höchstens 60 Sekunden
gültigen Bestätigung durch eine frische Providerantwort angewiesen, die
sinnvollste und angenehmste Lösung umzusetzen. Die Korrektur nutzt dieses
aktuelle Zugangssignal, das [RevenueCat als maßgeblich dokumentiert](https://www.revenuecat.com/docs/api-v2/subscription-data-model).
Sie erfindet keine nächste Aboperiode. Ohne weitere erfolgreiche Abfrage
endet diese kurze Bestätigung. Ein explizites `gives_access=false` bleibt
negativ. Apple-Familienempfang, Trials und Sandbox in Produktion erzeugen
weiterhin keinen bezahlten Partnergrant.

Die neue App zieht Prüfungen bei 30 Sekunden Restfrist vor und prüft einen
nicht verfügbaren Status während aktiver Nutzung alle 15 Sekunden erneut.
Der Server liest nach einem vorgezogenen Abgleich die aktuelle Beziehung
erneut; zwischenzeitlicher Entzug oder Trennung wird nicht überschrieben.

## Bisherige Prüfungen

- 1.181 Tests in 134 explizit ausgewählten aktuellen Jest-Suiten bestanden.
  Alte QA-Quellkopien wurden nicht mitgezählt. Ein fehlender Native-SDK-Mock
  im bestehenden Abo-Screentest wurde ergänzt; alle drei Screentests laufen.
- App- und Test-Typecheck bestanden; 16 Skripttests bestanden.
- 75 echte PostgreSQL-Prüfungen mit unabhängigen Verbindungen bestanden.
- 85 PNG/JPEG-Header geprüft. Gezielter ESLint-Lauf: keine Fehler; vorhandene
  Warnungen und ausgeschlossene Edge-Dateien sind im Log sichtbar.
- Sechs QA-Funktionen aus frisch heruntergeladenen Backups aktualisiert:
  `family-subscription-access` 7, `reconcile-family-subscriptions` 7,
  `revenuecat-webhook` 15, `ask-lotti` 33, `advisor-generate` 24,
  `voice-log-parse` 31. Nur die beiden gemeinsamen Zugangsdateien ersetzt;
  jeweilige JWT-Einstellung erhalten. Keine SQL-/Produktionsänderung.
- Echter kostenloser Play-Premium-Monatskauf auf D, mit nativ belegter
  Testkarte und „Dir wird nichts in Rechnung gestellt“. Partner A bekam
  Premium. Beim Periodenende 11:06:59.255 UTC blieben alle 30 Serverproben
  von 11:02:43 bis 11:08:10 UTC aktiv. Vor und nach Periodenende erneuerte
  der Server die kurze Bestätigung; erst ab der Probe 11:07:40 lag das neue
  Provider-Ende 11:11:59.255 vor. Kein fehlgeschlagener Messpunkt.
  **Aktive API-Messung**, keine lückenlose Messung und kein isolierter
  Nachweis des neuen nativen Clients. Die Proben aktualisieren den Cache.
- Danach echter `ask-lotti`-Aufruf als Partner A: HTTP 200 mit Antwort auf
  eine allgemeine Frage zum Spaziergang. B mit eigenem Lite: beide
  Premium-KI-Endpunkte weiter HTTP 403.
- iPhone mit vorhandenem Build68 nach regulärem B→A-Wechsel: aktives
  Familien-Premium und Frag-Lotti-Eingabefeld. Spätere Automationsausfälle
  (`socket hang up`) verhindern eine durchgehende native Aussage.

Der ältere Cloudtest wurde versehentlich mit `--help` gestartet, obwohl
das Skript keinen Argumentparser hat. Sieben Auth-/Webhookprüfungen
bestanden; die folgende Negativprüfung für A schlug wegen des inzwischen
berechtigt aktiven Partner-Premiums fehl. Kein grüner Gesamtlauf behauptet;
diese Fixture setzt fehlendes Premium voraus. Separate negative B-Proben
bestätigen die Sperren. Der Lauf kann einen Fürsorge-Aufruf für A ausgelöst
haben; er ist kein Test einer unbezahlten Person.

## Builds

- iOS 1.0.24 (1.0.69): EAS `a5f57665-3b98-4801-bbd7-dfa00c00a522`, fertig.
  IPA-Signatur, QA-Ziel, Runtime `family-qa-1.0.24`, deaktivierte OTA-Updates
  und Ausschluss bekannter privater Schlüssel/QA-Passwörter geprüft.
  SHA256 `5edcad2af67324fb94ac52e6766c6d8c32bceb927550dcc582798481cac71342`.
  TestFlight-Übermittlung `ca37be37-3632-443d-9094-5fa5f8b91dda` fertig;
  Apple-Verarbeitung von Build69 abgeschlossen.
- Android 1.0.23 (15): EAS `a4a01d91-8d07-4eb6-b8be-6fd0afb68a7c`.
  Fertig, Bundletool/Signatur/Upload-Zertifikat, QA-Ziel, Runtime, OTA aus
  und bekannte private Schlüssel geprüft. SHA256
  `e2c4ccf5df459cd91c444a21c483771a4182931ed68a2cf94914e1709b5eae5e`.
  Am 29.09. um 13:30 MESZ im bestehenden internen Play-Track veröffentlicht;
  Console bestätigt „Für interne Tester verfügbar“. Installation und native
  Verlängerungsprüfung bestanden; Details unten.
- Quelle: vorhandene Build68-Stagingquelle, ausschließlich zwei neue
  Clientdateien darübergelegt; Manifest in `output/release-readiness-20260929/`.

## Zusätzliche Startkorrektur

Bei der Codeprüfung wurde ein unbeschränkter Bootstrap-Wartepfad gefunden:
Der native Splashscreen blieb bis zum Abschluss von Auth-, Kind- und
Onboarding-Auflösung sichtbar. Außerdem beendete ein fehlgeschlagener erster
Sitzungsabruf den Ladezustand mit `user=null`, obwohl ein Netzfehler keine
bestätigte Abmeldung ist.

- Nach 15 Sekunden zeigt die App eine lokalisierte Wiederholungsanzeige vor
  dem Navigator. Sie prüft bei Rückkehr in den Vordergrund und während
  aktiver Nutzung erneut; parallele Wiederholungen werden zusammengefasst.
- Ein Fehler beim ersten Sitzungsabruf bleibt ungeklärt. Nur ein erfolgreicher
  Abruf oder ein bestätigtes Auth-Ereignis löst diesen Zustand auf.
- Verspätete Sitzungsantworten dürfen keinen neueren Kontowechsel oder
  Abmeldezustand überschreiben. Explizites `SIGNED_OUT` bleibt wirksam.
- Die Anzeige erteilt keine Berechtigung und löscht keine gespeicherten Daten.
  Sie begrenzt die unsichtbare UI-Wartezeit; ein hängender SDK-Netzaufruf
  wird dadurch nicht aktiv abgebrochen.

Nach dieser Änderung: **136 Suiten / 1.187 Tests bestanden**, beide
Typechecks bestanden. Neuer gezielter ESLint-Lauf: 0 Fehler, eine bestehende
Warnung am SSR-Initialisierungspfad. Sechs neue Tests prüfen Offline-Fehler,
Wiederholung, Timeout-Anzeige, Deduplizierung, verspätete Antwort nach
Kontowechsel und expliziten Entzug. Die native Abnahme steht noch aus.
Diese zusätzliche Korrektur ist **nicht** in Build69/Android15 enthalten;
neue QA-Builds sind fertig: iOS 1.0.70
(`e0f4088b-538c-49e0-a35a-0a6e85333833`, fertig, Artefakt geprüft,
TestFlight-Übermittlung `bd5d83a1-383e-4b21-8b76-f45df4c5e182` abgeschlossen) und Android16
(`a089608b-05a3-4b7e-a94c-0e36143f0212`).

Native Vergleichsmessung mit noch installiertem Android14: WLAN und mobile
Daten aus; Android meldete keinen aktiven Standard-Netzweg. Nach einem
gezielten Lotti-Kaltstart zeigte der Messpunkt nach 20 Sekunden die
bestehende Zugangs-Wiederholungsanzeige. Netzschalter wurden anschließend
auf ihren ursprünglichen Zustand zurückgesetzt. Nach weiteren 20 Sekunden
und „Erneut versuchen“ öffnete die bestehende Sitzung die Countdown-Seite
ohne neue Anmeldung. Der unbeschränkte Auth-Wartepfad wurde in diesem
Versuch nicht reproduziert; die neue Startkorrektur ist dadurch noch nicht
nativ abgenommen. Keine Datenlöschung.

## Noch erforderliche Abnahme

Die kombinierte Startkorrektur mit iOS70/Android16 auf Geräten abnehmen.
Der native Google-Renewal mit Android15 ist bestanden (siehe unten);
Apple-Sandbox-Renewal muss gesondert wiederholt werden. Offline-Kaltstart,
iPhone-Offline-Abnahme und übrige Store-/Alt-App-Fälle aus G01–G10 bleiben
nach dem jeweils letzten belegten Stand offen. Die Apple-Rangfolge wurde nach separater ausdrücklicher Freigabe korrigiert.
Die Löschbetriebs-/Releaseentscheidungen bleiben davon unabhängig offen.

Maschinenlesbare lokale Ergebnisse liegen unter
`output/release-readiness-20260929/`, private Provider-/Gerätebelege und
Function-Backups unter `.family-qa/renewal60/`.

## Apple-Abo-Rangfolge

Am 29.09. erneut live gelesen: Standard monatlich Rang1, Standard jährlich3,
Premium monatlich4, Premium jährlich5, Lite monatlich6 und jährlich7.
Nach Erklärung, dass ausschließlich die vorhandenen Abos neu eingeordnet
werden, erteilte der Nutzer ausdrücklich die Live-Freigabe („Ahh okay ja
dann mach“). Am 29.09. gegen 14:19 MESZ gespeichert und anhand der
aktualisierten Store-Tabelle bestätigt: Premium 1, Standard 2, Lite 3,
jeweils Monat/Jahr auf derselben Stufe. Keine Abos angelegt, keine
Produkt-IDs, Laufzeiten oder Preise geändert. Screenshot:
`output/release-readiness-20260929/apple-tiers-saved.png`.

Nach Ablauf des Google-Testabos: A und D liefern am 29.09. um 11:44 UTC
HTTP200 / Familienstatus `none`. Android14 zeigte nach „Zugang aktualisieren“
die Kauf-Paywall. Die kurze Providerbestätigung führte damit nicht zu einem
unbegrenzten Grant. Dies ist eine spätere Negativprobe, keine exakte
Messung des Entzugszeitpunkts.

Build70-IPA: SHA256
`12b2dd5a9f19b2fdc76811099bc87aa2658bfa6bce2df9164763259a258d17b1`.
Signatur, QA-Runtime/Ziel, deaktivierte Updates und bekannte private
Schlüssel einschließlich QA-Passwörtern geprüft. iPhone um 14:14 MESZ
per CoreDevice auf Build70 bestätigt (automatisches TestFlight-Update);
Samsung wurde anschließend regulär über Play auf Build15 aktualisiert.
Der negative KI-Aufruf als A nach Ende des Testabos lieferte HTTP403
(`a-expired-ai-denied.json`), keine Antwort.

## Native Fortsetzung mit Android15

Build15 wurde nach einem erneuten regulären Play-Download installiert.
VersionCode15 und Installer `com.android.vending` wurden bestätigt; der aus
dem installierten Basis-APK gelesene JavaScript-Bundle stimmt bytegenau mit
dem geprüften AAB überein. Keine Lotti-Daten gelöscht.

Neuer kostenloser Play-Premium-Monatskauf auf D, native Testkarte/Nullkosten
belegt. Regulärer Wechsel D→A; A zeigt „Premium · Familienabo“, „Aktiv“ und
ein bedienbares Frag-Lotti-Eingabefeld. Lotti auf dem iPhone wurde für die
Messung gezielt beendet, Prozessabwesenheit bestätigt. Der native Monitor
liest ausschließlich UI/PID und die RevenueCat-Subscription; keine
zusätzlichen Familien-API-Aufrufe oder manuellen Cacheänderungen. Normale
App-Abfragen, Webhooks und Cron bleiben aktiv. **23 von 23 Messpunkten
bestanden**, gleicher PID17136, von 11:59:54 bis 12:05:45 UTC. Das alte
Periodenende war 12:03:56.345 UTC; RevenueCat lieferte noch um 12:04:34 das
alte Ende, erst um 12:04:50 das neue. Das Eingabefeld blieb an allen
Messpunkten bedienbar. Etwa 15 Sekunden Messabstand, keine lückenlose
Millisekundenmessung. Belegt Google-Käufer D / Android-Partner A, nicht den
separaten Apple-/iPhone-Renewal. Öffentliche Zusammenfassung:
`output/release-readiness-20260929/android15-native-renewal.json`.

Android16 ist fertig und vollständig als QA-Artefakt geprüft (SHA256
`0ddedabb8bb59dc320a36c67ad8025f287784f94ce096820cca78cd6b1f3cd1e`).
Am 29.09. um 14:10 MESZ im bestehenden internen Play-Track als Release8
veröffentlicht, „Für interne Tester verfügbar“ bestätigt. Einzige Warnung:
fehlende R8/ProGuard-Offenlegungsdatei, keine nicht mehr unterstützten Geräte.
iOS70 ist in App Store Connect als vollständig verarbeitet bestätigt.
Geräteinstallation dieser beiden kombinierten Builds bleibt separat zu prüfen.

## Native Offline-Abnahme Android15

Konto A auf Frag Lotti blieb im selben Prozess17136. WLAN und mobile Daten
wurden abgeschaltet; Android bestätigte keinen aktiven Standard-Netzweg.
Nach25/75 Sekunden war das Eingabefeld noch verfügbar, nach175,275 und335
Sekunden gesperrt. Dies ist der Ablauf des zuvor bestätigten Zugangs, keine
Behauptung einer exakten 60-Sekunden-Sperre ab Netztrennung.

Beide Netzschalter wurden im finally-Pfad auf ihren ursprünglichen Zustand
zurückgestellt. Die erste Probe um12:12:22UTC war noch gesperrt; um12:12:36UTC
war das Eingabefeld wieder bedienbar, ohne Berührung oder App-Neustart.
Keine zusätzlichen Familien-API-Proben während dieses Tests. Offline-Ablauf
und automatische Netzrückkehr sind damit für Android15 bestanden.
Beleg: `output/release-readiness-20260929/android15-native-offline.json`.

Nach Abschluss des isolierten Android-Tests wurde Lotti auf dem iPhone
um 14:13 MESZ wieder gestartet. CoreDevice bestätigt kurz darauf Build70.
Der UI-Testhelfer auf Port8101 ist weiter nicht erreichbar; Installation
ist kein Ersatz für die ausstehende native iPhone-Abnahme.

## Android16-Kaltstart und zusätzliche Retry-Korrektur

Android16 wurde regulär aus Play installiert, Installer und VersionCode16
bestätigt. Der installierte JavaScript-Bundle stimmt bytegenau mit dem
geprüften AAB überein (`android16-installed.json`). Online öffnete die
bestehende Sitzung die Home-Seite, ohne Anmeldung oder Datenreset.

Beim kalten Start mit nachweislich fehlendem Standard-Netzweg zeigte die
Probe nach 20 Sekunden die bestehende Zugangs-Wiederholungsanzeige. Beide
Netzschalter wurden zurückgestellt. Danach blieb die Zugangsprüfung länger
sichtbar; Logs belegen DNS-Fehler auch nach Rückstellung der Schalter. Eine
spätere Geräte-DNS-/Ping-Probe war erfolgreich, schließlich erholte sich die
App ohne Bedienung und ohne Neustart zur Home-Seite. Kein exakter
Netzverfügbarkeits- oder Recovery-Zeitpunkt behauptet.

Dabei wurde ein zusätzlicher UI-Fehler reproduziert: Neue Familienstatus-
Ereignisse verstecken nach einem Fehler den Retry-Knopf wieder und setzen
den Timeout der ersten Prüfung zurück. Zwei neue Regressionstests waren
vorher rot. `use-paywall-session-gate.ts` behält jetzt die Fehlerbedienung
während automatischer Prüfungen bei; die anfängliche 15-Sekunden-Frist ist
unabhängig von Statusrevisionen. Nur manuelles Wiederholen startet eine
neue sichtbare Wartefrist. Keine Berechtigung wird dadurch erteilt.

Danach **136 Suiten / 1.189 Tests bestanden**, beide Typechecks bestanden,
gezielter ESLint: 0 Fehler (bestehende Musterwarnungen). Neue QA-Artefakte
werden aus der Build70/16-Quelle plus ausschließlich diesem Hook erstellt.
Diese zusätzliche Retry-Korrektur ist noch nicht in Build70/16 enthalten.

## Build-Grenze beim abschließenden Retry-Fix

Der erste iOS-Upload brach mit EPIPE ab. Der erneute Upload erreichte EAS,
anschließend meldete der Dienst das ausgeschöpfte kostenlose iOS-Kontingent
(Reset 01.10.2026). Kein neuer iOS-Build daraus entstanden. Der Mac hat nur
etwa 4 GB freien Speicher und kein Fastlane; ein lokaler vollständiger Build
ist daher derzeit nicht verlässlich vorbereitet. Kein kostenpflichtiger
Tarifwechsel durchgeführt. Nutzerentscheidung zum weiteren Buildweg angefragt.

Android17 ist in EAS angelegt: `43f5755d-152d-46aa-a09c-4e47ba130054`,
inzwischen FINISHED. Quelle: `retry-build-source.json`. Artefaktprüfung
erfolgreich: Bundletool, Signatur und erwartetes Upload-Zertifikat,
QA-Backend/Runtime, OTA aus sowie keine bekannten privaten QA-Schlüssel
oder Passwörter. SHA256:
`e10573c17b28b56d08b1ec790fad9811f62bbeb3f00c086d32a3dcaaad19fec0`.
Am 29.09. um 15:04 MESZ als Release9 im bestehenden internen Play-Track
veröffentlicht, „Für interne Tester verfügbar“ bestätigt. Keine Änderung
der unterstützten Geräte. Einzige Warnung wie zuvor: fehlende
R8/ProGuard-Offenlegungsdatei. Beleg: `play17-internal.png`.

Nach erneuter Bestätigung des Nutzers (iPhone entsperrt/bereit) ließ sich der
iOS-Testhelfer wieder verbinden. Build70 zeigt nativ Home und Frag Lotti
mit bedienbarem Textfeld. Nach Ablauf des Google-Käuferabos wechselte das
iPhone zur Paywall. Die gesonderte Apple-Verlängerungsprüfung wird fortgesetzt.

## Terminierter iOS-Folgeauftrag und Apple-Testkauf

Auf ausdrücklichen Nutzerwunsch wird der letzte iOS-Build nach dem Reset
erstellt. Einmaliger Thread-Folgeauftrag `lotti-ios-qa-nach-kontingent-reset`
für 01.10.2026 um 03:00 Ortszeit eingerichtet: QA-Build, IPA-Prüfung,
TestFlight-Übermittlung und Verarbeitungskontrolle; keine Produktion.
Die geprüfte isolierte Buildquelle wurde zusätzlich dauerhaft unter
`.family-qa/renewal60/retry-source/` gesichert. Quellmanifest und Pfadverweis
sind aktualisiert; der Folgeauftrag ist damit nicht auf den temporären
macOS-Ordner angewiesen. Der Hash des getesteten Hook-Fixes stimmt überein.

Auf Build70 wurde Premium monatlich ausgewählt. Der erste Versuch zeigte
„Zahlungen sind aktuell nicht verfügbar“, ohne Kaufdialog. Der zweite
Versuch öffnete Apples Testdialog mit ausdrücklichem Nullkostenhinweis.
Der Nutzer bestätigte den Testkauf selbst mit der Seitentaste. Danach
war Frag Lotti auf dem iPhone mit Textfeld verfügbar. RevenueCat meldet
`app_store`, `purchased`, `trialing`, Ende 30.09.2026 07:16:50UTC.
Damit ist ein kostenloser Testkauf-/Zugangsablauf belegt, aber kein neuer
bezahlter Apple-Renewal. Normales Medienkonto blieb angemeldet.

D erhält nach diesem Trial weiterhin keinen bezahlten Partnergrant:
Familienendpunkt 200/none und `ask-lotti` 403, keine KI-Antwort
(`d-apple-trial-no-partner-ai.json`). Keine aktive API-Beobachtung eines
Verlängerungsfensters aus diesem Kauf behauptet.

Build70-Online-Kaltstart nach dem Apple-Testkauf: ausschließlich Lotti
beendet und neu gestartet, erste Aufnahme nach 2324 ms zeigt Home.
Externe Einzelmessung einschließlich Automationslatenz; keine Aussage
zur Offline-Startzeit. Beleg `ios70-online-coldstart.json`.

Anschließend echte Frag-Lotti-Frage auf Build70 über die sichtbare Eingabe
und Senden-Schaltfläche: allgemeines Einpacken für einen kurzen Spaziergang.
Antwort und „Heute noch 19 Fragen“ nativ sichtbar. Kein separat gemessener
HTTP-Status behauptet (`ios70-native-ai.json`).

Xcodes USB-Screenshot wurde als Alternative zum Testhelfer geprüft und
funktionierte online. Xcode begann dabei automatisch eine große Symbolkopie;
wegen des knappen Speichers wurde Xcode beendet und ausschließlich der in
diesem Versuch neu entstandene unvollständige 27.2-Symbolcache entfernt.
Vorhandene ältere Caches blieben erhalten; freier Speicher wieder etwa 4,2 GB.
Keine Offline-Abnahme daraus abgeleitet.

## Android17: zunächst verzögerte Verteilung

Die Play Console bestätigt Release9 mit VersionCode17 als für interne
Tester verfügbar. Auf dem Samsung wurde anschließend mehrfach die App-Seite
neu geöffnet, der Play Store neu gestartet und die reguläre Update-Liste
geprüft. Das Gerät bietet weiterhin nur „Öffnen“ und die Versionshinweise
von Build16 an; VersionCode16 und Installer `com.android.vending` sind
per Paketabfrage bestätigt. Kein Update von 17 behauptet.

Der vorbereitete Offline-Nachtest `.family-qa/renewal60/android17-retry-qa.py`
wurde deshalb noch nicht gestartet. Nach regulärem Update zunächst den
installierten JavaScript-Bundle mit `android-17.aab` vergleichen, dann den
Test ausführen: Retry nach 20/40/60 Sekunden ohne Netz, anschließend
automatische Rückkehr bei Netzverfügbarkeit im gleichen Prozess. Bei einer
UI-Hierarchie-Zeitüberschreitung die aufgezeichneten Screenshots auswerten;
der animierte Home-Screen kann den Android-Idle-Dump verhindern.

Online-Kontrolle des weiterhin installierten Build16 zeigt nach App-Neustart
Home mit Premium. WLAN und mobile Daten sind eingeschaltet; keine App-Daten
gelöscht. Lotti wurde zum Abschluss wieder geöffnet. Maschinenlesbarer
Stand: `android17-device-update-pending.json`. Diese Zwischenkontrolle
ersetzt ausdrücklich nicht den Nachtest des letzten Retry-Fixes.

## Android17: Installation nach erneuter Nutzerprüfung

Auf „Android habe ich einmal geupdated“ erneut geprüft: zunächst war noch
VersionCode16 installiert, inzwischen bot Play die neuen Retry-Versionshinweise
und „Aktualisieren“ an. Reguläres Update ausgeführt. Um 13:48 UTC bestätigt:
Version 1.0.23, VersionCode17, Installer `com.android.vending`, ohne Datenreset.
Der aus der installierten APK gelesene JavaScript-Bundle stimmt bytegenau
mit dem geprüften Android17-AAB überein. Bundle-SHA256:
`59e7c3f57422ae91a5cdfea8d284fa00acb92cb9c95b3c7606723fc23d8a134e`.
Online zeigt die vorhandene Sitzung Home mit Premium. Beleg:
`android17-installed.json`; der ältere Pending-Beleg ist damit überholt.

Android17 anschließend kalt ohne Netz gestartet; Android bestätigte keinen
aktiven Standard-Netzweg. Bei den Messpunkten nach 23, 43 und 63 Sekunden
blieb „Erneut versuchen“ sichtbar, ohne Login oder gewährten App-Zugang.
WLAN und mobile Daten wurden um 13:49:51 UTC auf den ursprünglichen
eingeschalteten Zustand zurückgestellt und abschließend erneut geprüft.

Die erste Recovery-Aufnahme zeigt Home mit Premium, ohne zwischenzeitliche
Bedienung oder App-Neustart. PID21823 blieb über den gesamten Lauf gleich.
Die Android-UI-Hierarchie erreichte keinen Idle-Zustand; deshalb meldete
das Skript zunächst ein ungeklärtes Ergebnis. Die gespeicherte Bildschirmaufnahme
wurde separat visuell geprüft und bestätigt die Rückkehr. Keine exakte
Recovery-Latenz behauptet. Dieser konkrete Offline-Retry-/Recovery-Test
ist damit bestanden; Nachweis `android17-native-retry.json` mit erhaltenem
ursprünglichem Automationsstatus und separater Screenshot-Auswertung.
