# Familienzugang – Arbeits- und Abnahmeprotokoll vom 24.09.2026

**Aktueller Nachtrag 29.09., Build1.0.68:** Echte Apple-Sandbox-Testfamilie
eingerichtet, kostenloser Premium-Kauf bestätigt. B empfängt Premium
`family_shared` neben eigenem Lite (`trialing`). Build67 verdeckte Premium
durch das länger laufende Lite; Build68 ist aus TestFlight installiert und
zeigt nativ Premium mit bedienbarer Frag-Lotti-Eingabe. Die Nicht-Weitergabe
B→C ist auf Android und per403 belegt. Dies ersetzt die früheren Aussagen,
dass überhaupt kein Apple-Familienbeleg vorliege; Alt-App-Verträglichkeit und
simultane Zwei-Apple-Geräte-Abnahme bleiben offen. Aktueller Detailbericht:
[iPhone-QA vom29.09.](iphone-qa-20260929.md). Keine Releasefreigabe.

### Fortsetzung 29.09.: Android14 verteilt/installiert, Fokus geprüft

Android1.0.23(14) fertig, mit `verify-artifacts.py android 4` bestanden, im internen Play-Track verfügbar und auf Samsung aus Play ohne Datenreset installiert. Tab fokussiert Retry, dann Abmelden, dann wieder Retry. Enter offline und Back öffnen keine verborgene Navigation; Enter/Retry online führt zur erwarteten Paywall ohne Neustart. Beleg `output/restabnahme-20260928/android14-native-retest.json`.

Zusätzlicher offener Befund: erster Offline-Kaltstart blieb vor dem Fehlergate auf Splash/„Lade …“; Online-Neustart erholte sich, frischer Offline-Wiederholungstest erreichte danach das Gate. Ursache nicht bewiesen. Recovery-Kontowechseltest wartet bei vorbereiteter QA-D-Anmeldung auf Bestätigung der expliziten Nutzungsbedingungen-Checkbox. Noch keine vollständige native Abnahme.

iOS1.0.65: bestehende Submission FINISHED, Apple VALID / IN_BETA_TESTING; Installation/individueller Testerzugang unbestätigt. Renewal-Diagnose und nächster Test in `output/restabnahme-20260928/renewal-diagnosis.md`. Keine Produktionsmutation oder Freigabe von Aufträgen5/6. Aktueller Fortsetzungspunkt: `output/restabnahme-20260928/next-steps.md`.


### Fortsetzung 20:24 MESZ: Artefakt und Store-Abgleich

- iOS **1.0.24 (1.0.65)** fertig, heruntergeladen und mit `verify-artifacts.py ios 4` erfolgreich geprüft. QA-Backend, Store-SDK-Key, Runtime, deaktivierte Updates, native Fokusisolation, begrenzter Subscription-Refresh, bekannte private QA-Secrets und Codesign geprüft. Beleg: `output/restabnahme-20260928/ios-artifact-check-recovery.json`.
- Submission **006faba3-8133-4549-8142-33fee587d2f9** für diesen Build eingereiht, zuletzt **IN_QUEUE**. Noch kein Beleg für Apple-Verarbeitung, Testerzugang oder Installation von 1.0.65.
- Ältere Submission für **1.0.64** inzwischen **FINISHED**. Lesender App-Store-Connect-Abgleich funktioniert über vorhandenen EAS-API-Zugang ohne Apple-Login; **1.0.63** dort `VALID / IN_BETA_TESTING`, 1.0.64/1.0.65 noch nicht als verfügbar gelistet. Individueller Testerzugang bleibt ungeprüft.
- Android **1.0.23 (14)** weiterhin **IN_QUEUE**. Samsung per ADB erreichbar, frisch bestätigt **1.0.23 (12)** mit Play als Installer. Keine App-Daten gelöscht; kein Update möglich, solange Build14 kein Artefakt liefert.
- Native Tab/Enter/Back/Retry- und Netz-/Kontowechsel-Abnahme der beiden Korrekturen bleibt offen. Keine Produktionsmutation; Aufträge5/6 weiterhin nicht freigegeben.


## Auftrag 7 – Restabnahme 28.09.2026

**Keine pauschale Gerätefreigabe.** Die G01–G10-Ergebnisse vom 26.09. bleiben bestehen. Neue [Einzelentscheidungsvorlage](android-play/release-entscheidung-20260928.md#einzelentscheidungen-für-fehlende-storefälle) nennt für jeden offenen Fall Ersatznachweis, Grenze, Risiko und echten Testweg. Noch keine Entscheidung eingegangen.

- G08 lokal erweitert: RootLayout-Gate bleibt gemountet, erste Zugangsprüfung schützt Inhalt; nach 15 s Fehler mit Retry/Abmelden. Bestehende erlaubte UI bleibt bei unbekanntem Ergebnis bedienbar; bestätigtes fehlendes Abo führt weiter zur Paywall. Kein Tier-/Lease-Update durch UI-Kontinuität.
- 12 Integrationstests mounten die von RootLayout verwendete Gate-Komponente mit echter Paywall-Entscheidung: Route/Vordergrund während Anfrage, Erstfehler/Retry, Timeout/Abmelden/späte Antwort, Auth-/Profil-/Providerfehler, Kontowechsel A/B/A, Logout/Neuanmeldung, Auth-Cache-Mismatch und echte Familien-Cache-Ablaufgrenze nach 301 s. Nicht das gesamte RootLayout oder native Stores gemountet. Insgesamt 60/60 Tests in fünf Suiten und App-Typecheck bestanden.
- Cloud erneut 14 bestanden; Einladungsbelegung weiterhin begründeter Skip. Android-Gerät RZCT41N7CWR verbunden; installed Play 1.0.23 (10), Daten erhalten. Neuer QA-Quellstand und Uploadmanifest geprüft; erste Cloudbuilds Android11/iOS1.0.62 an Uploadfilter gescheitert, korrigierte Quelle lokal für alle Plattformen gebündelt. Storeverfügbarkeit/Installation des Fixes noch offen.
- G09 bleibt offen: ca. 42 s reale Partnerunterbrechung vor verspätetem Renewalbeleg. Keine Storelaufzeit erfunden und keine Behebung behauptet. Getrennte Risikoannahme nötig, falls echter Test/Fix nicht geliefert wird.

Belege unter `output/restabnahme-20260928/`: `paywall-tests.log`, `typecheck.log`, `source-manifest.json`, `upload-manifest.json`, `archive2-export.log`; private Cloud-/Geräteprotokolle `.family-qa/acceptance-20260928/`.

**Noch keine Produktionsfreigabe.** Beide Richtungen des Familienzugangs wurden
mit Sandbox-Storekäufen auf Geräten und im QA-Backend bestätigt.
Positive KI-Provideraufrufe sind inzwischen belegt; weitere Releasefälle stehen noch aus.
Produktionsänderungen sind laut Auftrag erst nach vollständiger isolierter
Geräteabnahme zulässig.

Buildnachtrag: Android **1.0.23 (12)** `c9789b68-22db-4369-bbc8-d0a4c19eb0d5` und iOS **1.0.24 (1.0.63)** `674a5a6f-7f23-40bb-aa9b-585a166d3a95` sind FINISHED. Beide heruntergeladen und auf Signatur, eingebettete QA-Adresse, Store-SDK-Key, neuen Gate-Code, Runtime `family-qa-1.0.24`, ausgeschaltete Updates und bekannte private QA-Secrets geprüft. Berichte `android-artifact-check.json`/`ios-artifact-check.json`. Android im internen Play-Track veröffentlicht (15:05 MESZ); iOS-Submission `aff2d79e-cb85-4eea-b579-f4b43e9f5f16` erfolgreich an Apple übertragen; Verarbeitung/TestFlight-Verfügbarkeit noch nicht bestätigt. Android12 inzwischen aus Play installiert; iOS1.0.63-Installation weiterhin offen. Aktueller maschinenlesbarer Stand: `output/restabnahme-20260928/build-delivery.json`.

Geräteblocker um 15:06 MESZ: Samsung WLAN eingeschaltet, nicht verbunden, keine Netze im WLAN-Dialog; Play zeigt „Du bist offline“. Kein Netzwerk-/Kontowechsel und keine Datenlöschung vorgenommen. Bestehender iPhone-Hotspot/WLAN beim Nutzer angefragt. Installationsbeleg bleibt Code10; iPhone weiterhin1.0.61. Neue Build-Gerätefälle G08 bleiben offen.

### Android12: Nachtrag ab 15:49 MESZ

Hotspotverbindung wiederhergestellt, Play-Update auf **1.0.23 (12)** ohne Datenreset installiert (`android-installed12.txt`). Kaltstart online ohne Abo führt zur Paywall; Kaltstart im Flugmodus zeigt den neuen Fehler mit „Erneut versuchen“ und „Abmelden“ (`android12-offline-cold.png`). Exakte native 15-s-Dauer und direkter Retry-Tap noch nicht gemessen; Wiederverbindung erholt sich zur Paywall. Zwei frühere Offline-XML-Dumps waren wegen fehlendem UI-Idle veraltet und werden ausdrücklich nicht gewertet; der Dump-Helfer verwirft solche Ergebnisse jetzt.

**G04 zusätzlich belegt:** Kostenloser nativer Lite-Jahreskauf auf Konto D, ausgewählte Google-Identität `jan.zepp1999@gmail.com`, Testkarte und explizit „Dir wird nichts in Rechnung gestellt“ vor Bestätigung geprüft. Produkt `lottibaby_lite:yearly`; Storeperiode 13:49:17.361–14:19:17.361 UTC. Webhook empfangen 13:49:22.456, abgeschlossen 13:49:25.251. QA-API bestätigt Partner A mit `tier=lite`; D hat eigenes Lite. Der Familienendpunkt meldet bei D `none`, weil er nur abgeleiteten Partnerzugang beschreibt. Echter `advisor-generate`-Aufruf verweigert A und D jeweils HTTP403 „Feature not unlocked“. Belege: `lite-year-active.json`, `family-native-timeline.json`, `android12-lite-test-purchase.png`, `android12-after-lite.png`. Standard bleibt Bestandstarif und ist nicht als neuer Tarif in der Paywall angeboten; kein Produkt oder Preis geändert.

**G08 zusätzlich:** D blieb von 13:49:17 bis mindestens 13:54:54 UTC (336 s) in der aktiven Sitzung. Home/App-Einstellungen/Mehr/Countdown/Abo, Hintergrund/Vordergrund und Flugmodus getestet, kein globaler Paywall-Sprung. App-Einstellungen zeigte offline einen schließbaren fachlichen Ladefehler; anschließend weitere Navigation möglich. Das ist ein Käufer-Test mit eigenem Lite, kein nativer Beweis einer abgelaufenen Partner-Lease. Flugmodus zurückgesetzt, WLAN/Mobilfunk wieder eingeschaltet; Hotspot war danach nicht mehr sichtbar, Nutzer um erneutes Öffnen gebeten. Aktive Trennung noch nicht ausgeführt. Belege `android12-session.json`, `android12-active-over5min-offline.png` und private schrittspezifische UI-Dumps. Native Auth-/Profil-/RC-/Familien-Einzelfehlerinjektion bleibt offen. Nebenbefund: Abo-Seite sagt bei Lite pauschal „Alles ist freigeschaltet“ und erwähnt Standard im Vergleich; die tatsächlichen Premiumgates verweigern korrekt.

### Aktive Trennung, Kontowechsel und Renewal am 28.09.

- **G07 Android aktiv:** A um 13:59:35 UTC als Lite-Partner bestätigt. D deaktivierte die Verknüpfung über den nativen Bestätigungsdialog; Erfolg visuell bestätigt. A um 14:00:07 API `none`, D behielt in UI und echter RevenueCat-Evidenz eigenes Lite. Danach Anmeldung A auf demselben Samsung; Anmeldung blieb zwischenzeitlich in „Anmelden…“, nach datenbewahrendem Neustart A ohne Familienzugang auf Paywall. Keine Aussage zur stabilen Login-Laufzeit aus diesem Durchgang (längere Unterbrechung/Netzwechsel). A besitzt laut Backend kein eigenes Abo. iPhone-Kontowechsel bleibt offen.
- **QA-Verbindung wiederhergestellt:** Einladung mit normaler D-Session im QA-Backend erstellt; A nahm den Code nativ an, 16:48:23 UTC. Im Baby-Dialog „Alle behalten“, keine Baby-/App-Daten gelöscht. A wieder Lite-Familienzugang bestätigt; nach Renewal auf dem Samsung „Lite · Familienabo / Aktiv über dein Familienabo“ sichtbar. Belege `family-native-timeline.json`, `lite-year-unlinked.json`, `android12-own-lite-after-unlink.png`, `android12-a-unlinked-current.png`, `android12-family-lite-online.png`.
- **G09 erneut echt reproduziert:** Alte Periode endet 16:49:17.361 UTC. A API `none` von erster Probe 16:49:19.918 bis 16:49:52.846; native Paywall sichtbar. Webhook erst 16:49:54.330 empfangen, Cache 16:49:56.525 aktualisiert, Verarbeitung 16:49:56.854 fertig. Erste nächste positive API-Probe 16:49:58.439; neue Periode bis17:19:17.361. Damit erneute Unterbrechung von ungefähr40s, keine Behebung durch den UI-Fix. Cron16:49:00 lief vor Periodenende, nächster Lauf16:50:00 nach Webhook. Cron-Tabelle belegt Jobausführung, nicht Zeitpunkt des Google-/RC-Empfangs. Aktive API-Abfragen können den Providercache aktualisieren; keine rein passive Cron-Messung. Watcher nach erfolgreicher Wiederherstellung durch Host-Verbindungs-Timeout beendet, gespeicherte Beobachtungen erhalten. Belege `lite-renewal-timeline.json`, `lite-renewal-summary.json`, `lite-renewal-cron.json`, `lite-year-renewed.json`, `android12-renewal-gap.png`, `android12-family-renewed.png`.

**G08 Partner-Lease nativ:** A hatte nach Wiederverknüpfung ausschließlich Lite-Familienzugang, kein eigenes Abo. Flugmodus ohne WLAN von16:52:06 bis16:57:34 UTC (328s), Hintergrund/Vordergrund und Routenwechsel. Abo-Seite spätestens16:56:40 korrekt „Zugang derzeit nicht bestätigt / Inaktiv“ statt aktivem Familientarif; Countdown bleibt danach bedienbar, keine globale Paywall bei unbekanntem Status. Belege `android12-family-lite-online.png`, `android12-family-lease-expired.png`, `android12-family-over5min-offline.png`, `android12-session.json`. Lite verweigert Premium ohnehin; dies ersetzt keinen nativen Premium-Partner-Ablauftest.

### Zusätzlicher Erstfehler-Fokusbefund

Auf Build12 öffnete Tab/Enter im kalten Offline-Fehler den verborgenen Baby-Auswahldialog. `pointerEvents=none`, Opacity und Accessibility-Hiding allein sperrten die native Hardware-Tastatur nicht. `android12-retry-activated.png` zeigt **keinen erfolgreichen Retry**, sondern diesen Fehler; Name stammt vom Testversuch. Lokale Korrektur: gemounteter Navigator mit `display:none`, Fehler/Prüfung in eigenem RN-Vollbild-Modal, Back darf die Sperre nicht schließen. Zusätzlicher Integrationstest prüft den Modal-Vertrag, Zustandserhalt und Wegfall der Sperre nach Retry; Hardwaretastatur ist damit noch nicht nativ belegt. 61Tests/5Suiten bestanden, Typecheck bestanden. Neue QA-Builds erforderlich; Build12 nicht pauschal abgenommen.

**D wieder angemeldet / Restore-Teilbeleg:** Am17:08 UTC erfolgreich A→D zurückgewechselt, ohne Datenreset/Neustart; D zeigt eigenes Lite-Jahresabo. „Käufe wiederherstellen“ nativ ausgelöst, danach weiterhin korrekter aktiver Tarif, kein Fehler-/Keine-Käufe-Dialog. A behält im Backend Lite-Familienzugang. Zusätzliche direkte RevenueCat-Abfrage17:14 UTC: A hat keine eigene aktive Subscription, D weiterhin dieselbe Subscription mit ownership=purchased (`restore-ownership.json`). Das belegt den datenbewahrenden SDK-Restore im bestehenden Storekonto, **keinen** Restore nach App-Datenverlust/Neuinstallation.

**G04 Lite monatlich zusätzlich:** Nach Ende der Jahres-Sandboxperiode17:19:17 UTC D nativ auf Paywall und A API `none` bestätigt. Anschließend explizit kostenloses natives Lite-Monats-Testabo auf D gebucht (Jan-Testkonto und No-Charge-Text erneut geprüft); erste Periode17:22:03–17:27:03 UTC, A wieder Lite-Familienzugang. Play Billing Lab von Google aus Play installiert, Jan-Testkonto bestätigt. Der Statusdialog bietet für dieses Testabo nur „Verlängern“, keinen Grace-/Hold-Eintrag. Kein Preis/Produkt verändert. Alternativ primäre Zahlungsmethode nur dieses Testabos nativ auf „Testkarte, immer abgelehnt“ gestellt, Bestätigung dokumentiert; Provider-/Familien-Zeitachse läuft. Anleitung: [Google Billing-Tests](https://developer.android.com/google/play/billing/test). Belege `android12-lite-month-test-sheet.png`, `billing-lab-state-options.png`, `lite-month-test-card-declines.png`, `billing-issue-timeline.json`.

### G06: Kulanzphase, Zahlungssperre und Erholung – echt am 28.09.

Lite-Monats-Testabo D→A: nach fehlgeschlagener Verlängerung um17:27:03 UTC meldete RC zunächst noch die alte aktive Periode, A bereits `none`. Ab17:27:46 wurde `in_grace_period` mit nachgewiesenem Ende17:32:03.421 und A wieder aktiv beobachtet. Auch beim Übergang in Grace entsteht somit die bekannte kurze Partner-Unterbrechung; der Paywall-Fix löst sie nicht.

Nach Ende der Grace-Periode: Entzugswebhook17:32:36.461, Cache/Verarbeitung17:32:38.559/.701. Direkte Probe17:35:54 bestätigt `in_billing_retry`, `gives_access=false`, A `none`. Zwischen17:31:52 und17:35:54 gab es keine aktive Pollprobe; kein sekundengenauer Hold-Übergang behauptet. D zeigte nach „Zugang aktualisieren“ die native Paywall; echte Premium-API verweigerte A und D weiterhin403.

Nur die primäre **Testkarte dieses kostenlosen QA-Abos** wurde anschließend wieder auf „immer genehmigt“ gestellt; native Bestätigung und Play-Status dokumentiert. Erholungswebhook17:38:12.179–17:38:15.544; RC ab17:38:13 wieder aktiv, A ab17:38:24 aktiv. Die D-Paywall schloss sich bei Rückkehr/Deep Link allein nicht; über „Käufe wiederherstellen / Status prüfen“ gelangte D korrekt zur aktiven Lite-Monats-Abo-Seite. Kein Datenreset. Damit Grace/Hold/Recovery als Android-Teil vonG06 echt belegt; Refund und Apple-Fälle bleiben gesondert offen.

Belege: `billing-issue-timeline.json`, `billing-issue-summary.json`, `lite-year-grace.json`, `lite-year-hold.json`, `lite-year-recovered.json` (Dateipräfix historisch, Inhalt aktuelles Monatsabo), `android12-lite-grace-active.png`, `android12-lite-hold.png`, `lite-month-test-card-approved-restored.png`, `android12-billing-recovery-restore.png`. Keine Produkt-/Preisänderung; Samsung bleibt D, Daten erhalten, WLAN wieder verbunden.

### G06: echte kostenlose Play-Erstattung und Entzug

Genau die kostenlose D-Lite-Monats-Testbestellung mit Suffix`..0` wurde in Play zu100% erstattet und „Anspruch widerrufen“ ausgewählt; Produkt ausdrücklich`Test: Lotti Baby Lite`, kein echter Umsatz. Play bestätigt17:43:47 UTC „Erstattet“ und Abo „Abgebrochen“. RC erstmals17:44:20.815 expired; Webhooks17:44:21.027/.059, abgeschlossen22.853/23.448. Partner A erstmals17:44:31.537 `none`, ca44,5s nach Play-Bestätigung.

D zeigte nach erster Statusprüfung und Vordergrundwechsel noch zwischengespeichertes „Aktiv“; nach weiterer Statusprüfung um17:46:01 native Paywall. Deshalb kein sofortiger nativer Entzug behauptet. Kein Datenreset und keine eigene Kundenbestellung betroffen. Belege `refund-summary.json`, `lite-year-refund-confirmed.json`, `play-test-refund-confirmed.png`, `android12-refund-initially-still-active.png`, `android12-refunded-paywall.png`. Android-Refund damit zusätzlich ausgeführt; Apple-G06 bleibt offen, native Verzögerung bleibt dokumentierte Abnahmegrenze.

### Premium jährlich, Offline-Lease und zusätzlicher Clientbefund

Am28.09.17:47:59.722 UTC D kostenloses **Premium-Jahres-Testabo** gebucht, native Jan-Testidentität und „Dir wird nichts in Rechnung gestellt“ geprüft. Periode bis18:17:59.722; A API Premium-Familie, D eigener Premiumtarif. Belege `premium-year-active.json`, `family-native-timeline.json`, `android12-premium-year-test-sheet.png`.

Nach datenbewahrendem D→A-Kontowechsel zeigte die Abo-Seite „Premium · Familienabo / Aktiv“, Frag Lotti blieb trotz korrekter QA-Policy und manueller Aktualisierung gesperrt. Ein App-Neustart ohne Datenreset stellte den korrekten Zugriff her. Dieser native Widerspruch ist belegt (`android12-premium-family-ai-incorrectly-locked.png`, `premium-family-policy.json`), die genaue hängende native Anfrage nicht instrumentiert.

Gezielte Regressionstests reproduzieren hierzu passende Fehlerpfade: hängende Profil-/RC-/Policy-Anfrage belegt den Refresh-Slot dauerhaft; A→B→A verwendet alten Slot; auslaufende Lease informiert bei bereits hängendem Refresh die gemounteten Feature-Gates nicht sofort. Vor Korrektur5/5 neue Tests fehlgeschlagen. Lokal `lib/subscriptionAccess.ts` ergänzt:10s-Anfragedeadline, neue Refresh-Slots nach Kontoänderung, Identitätsprüfung gegen alte Ergebnisse/Finally sowie sofortige Lease-Entzugsmeldung. Danach74/74 Tests in8gezielten Root-Suiten und Typecheck bestanden. Ein erster breiter Jest-Pfadfilter erfasste unbeabsichtigt private alte Buildkopien und meldete dort Fehler; der maßgebliche Lauf verwendet ausdrücklich `--runTestsByPath` im aktuellen Root. Keine Abnahme der neuen Korrektur allein aus diesen Tests.

**Native Premium-Lease im bestehenden Build12:** Nach dem Neustart Frag Lotti online freigeschaltet. A ausschließlich Premium-Familienzugang, Flugmodus/WLAN-aus17:52:52–17:58:21 UTC (**329s**). Frag Lotti nach Lease-Ende gesperrt, Abo „Zugang derzeit nicht bestätigt / Inaktiv“, Countdown und Routen-/Vordergrundwechsel bedienbar, kein globaler Paywall-Sprung bei unbekanntem Status. Restliche Lease darf kürzer als5min sein; kein neuer5min-Zeitraum ab Flugmodus behauptet. WLAN anschließend wieder verbunden. Belege `premium-family-offline.json`, `android12-premium-ai-online.png`, `android12-premium-ai-offline-expired.png`, `android12-premium-family-offline-inactive.png`. Samsung zuletzt KontoA, Daten erhalten. Nach Netzrückkehr erneut Abo aktiv/KI gesperrt; datenbewahrender Neustart zur Erholung. Zusätzlicher Beleg `android12-premium-after-network-still-locked.png`.

**Neue Buildgrenze:** Wartenden Android13-Build gezielt abgebrochen, da er die zusätzliche Refresh-Korrektur nicht enthält. iOS1.0.64 fertig/signiert geprüft, bisherige Übertragung läuft, ebenfalls ohne neue Refresh-Korrektur. Neuer abgegrenzter Stand enthält10Overlays; `source-manifest-recovery.json` und `upload-manifest-recovery.json` (1020Dateien, QA-Bindung beider Plattformen/Secret-Scan bestanden). Neue Builds Android14 (`e10339f1-de7e-4504-8c7b-08d99b64811c`) und iOS1.0.65 (`7643d39f-dacc-4095-82b1-e78ed4b7fc9a`) hochgeladen; aktueller Status in `build-delivery.json`. Native Tab/Enter/Back/Retry sowie D→A→D/A mit Offline-Erholung bleiben im neuesten Build nachzutesten.

## Frisch geprüfte Umgebungen

- Produktion `kwniiyayhzgjfqjsjcfu`: ACTIVE_HEALTHY, acht Cache-Spalten,
  kein `subscription_private`, kein `deletion_private`, **52 angenommene Links**,
  42 Feature-Zuordnungen, 0 gemeinsame Legacy-Produkt-IDs. Bestehende Links und
  Konten wurden nicht verändert. Alle benötigten bisherigen Tabellen und vier
  Einladungs-/Profil-RPCs sind vorhanden; der SQL-Hotfix ist aktiv.
- Die vier Live-Bundles aus Auftrag 1 wurden einzeln erneut heruntergeladen:
  **28/28 Dateien identisch** zur Hotfix-Sicherung. Versionen weiter
  ask-lotti 28, advisor-generate 19, voice-log-parse 27, revenuecat-webhook 10.
- QA `ggyonianphloycmqrwvj`: Branch `family-subscription-qa`, ACTIVE_HEALTHY;
  das alte Provisionierungskennzeichen MIGRATIONS_FAILED ist weiterhin vorhanden.
  Die tatsächlich vorhandenen Familien-/Löschschemas sind funktionsfähig.
  Deren ältere Einrichtung ist nicht in der Migrationshistorie verzeichnet;
  daher wurde die tatsächliche Schema-Präsenz geprüft, keine Historie angenommen.
  Vier normale Profile (`is_admin=false`, keine Sonderrolle), keine kopierten Kunden.
- RevenueCat-Produkte mit dem privaten QA-Schlüssel erneut lesbar (HTTP 200):
  alle sechs Google-Produkt-/Basisplan-IDs vorhanden. Der ältere Befund eines
  leeren Google-Katalogs ist überholt. Keine Produkte, Preise oder Store-Konten geändert.

## Ergänzungen

1. Code-Einstieg ohne eigenes Abo: Account-Linking hat kein vorgeschaltetes
   Feature-Gate mehr, ist vom globalen Paywall-Redirect ausgenommen und kann
   direkt über „Familiencode einlösen“ auf der verpflichtenden Paywall geöffnet
   werden. Andere App-Seiten und die serverseitigen Feature-Gates bleiben geschützt.
2. Einlösetexte unterstützen die neuen Codes ohne falsche Acht-Zeichen-Anweisung.
   Bestehende Verbindungen zeigen die Anleitung zum Deaktivieren, erneuten
   Einladen, Prüfen der Baby-Auswahl und Aktualisieren des Abo-Status in DE/EN/ES.
3. Neue Migration `20260924074150_family_rollout_guards.sql` schützt auch
   `subscription_private.quota_owner` gegen `entl7a7b4e9838`/`LottiBabyAbo`.
   `caretaker_private.has_premium` berücksichtigt zusätzlich frisch bestätigten
   Premium-Familienzugang und Kontosperren; sein bisheriger Produkt-Guard und
   seine privaten Zugriffsrechte bleiben erhalten.
4. Der SQL-Test verwendet jetzt die **echte Account-Deletion-Migration** statt
   eines Stubs für `blocked()`. Er prüft Bestandslinks, die gezielte Reihenfolge,
   Familienzugang im Betreuer-Modus sowie dessen Ablauf, Entzug und private ACL.
5. Der alte Hotfix-Adapter enthielt in einem Kompatibilitätswrapper einen laut
   seinem Typ unerreichbaren Vergleich mit `family_subscription`. Nur diesen
   Vergleich lokal entfernt, damit der gemeinsame Typecheck besteht. Kein erneuter
   Hotfix-Deploy; die Produktionssicherung/Live-Hashes bleiben der Rollout-Ausgangspunkt.
6. `.easignore` schließt auch `tmp/` aus. Das Profil `family-qa-play` erzeugt
   ein Store-signierbares AAB mit QA-Konfiguration. Alte QA-Kopie erhalten unter
   `.family-qa/build-native-before-20260924`; neue isolierte Kopie unter
   `.family-qa/build-native`, EAS_PROJECT_ROOT explizit auf diese Kopie gesetzt.

## Geprüfte Migrationsreihenfolge

Kein vollständiger Push, Reset oder Branch-Merge. Im isolierten PostgreSQL:

1. Vorhandene Einladungswrapper, Tarifcache, KI-Quoten und Moderationsschutz.
2. `20260911065615_account_deletion_jobs.sql`.
3. `20260924064154_subscription_tier_cache_guard.sql` (in Produktion schon vorhanden).
4. `20260912185037_family_subscription_security.sql`.
5. `20260924074150_family_rollout_guards.sql`.

Die lokalen Tests verwenden ein gezieltes synthetisches Basisschema, keinen
vollständigen Produktionsklon. Alle angenommenen Alt-Links bleiben bestehen,
erhalten aber keine Mitgliederplätze. Neue gemeinsame Abo-Nutzung erfordert
beidseitige Annahme eines neuen Codes. Es erfolgte keine produktive Datenübernahme.

Der lesende Preflight ist reproduzierbar mit
`supabase/tests/family_rollout_preflight.sql`. Vor jedem Schreibschritt ist die
Referenz im gewählten CLI-Arbeitsbereich zu kontrollieren. Root bleibt Produktion;
QA-Schreibschritte liefen ausschließlich in `.family-qa/workspace` mit der QA-Referenz.

## QA-Deployment

Nur die zusätzliche Migration wurde auf QA angewandt und gezielt in dessen
Migrationshistorie eingetragen; Familien-/Löschmigrationen waren bereits vorhanden.
Danach gemeinsam bereitgestellt:

| Function | QA-Version | Gateway-JWT |
|---|---:|---|
| ask-lotti | 29 | true |
| advisor-generate | 20 | false, eigene Auth |
| voice-log-parse | 27 | false, eigene Auth |
| family-subscription-access | 3 | true |
| reconcile-family-subscriptions | 3 | false, eigenes Secret |
| revenuecat-webhook | 11 | false, Authorization und HMAC |

**55/55 erneut heruntergeladene Dateien stimmen bytegenau mit der Deploymentquelle
überein.** Der Resolver liest `product_id` sowohl beim frischen Cache als auch beim
Fehler-Fallback. Produktions-Sandbox-Sperre und QA-Konto-Allowlist bleiben aktiv.
Der minütliche Cronjob ist aktiv; drei jüngste HTTP-Antworten liefern 200.
Vault enthält `supabase_url` und `subscription_reconcile_secret`.
Die vier privaten Prüf-/Worker-RPCs sind weder für `anon` noch `authenticated`
ausführbar und haben ein festes leeres `search_path`. Die Familienmitglieder
verweisen mit `ON DELETE CASCADE` sowohl auf Auth-Nutzer als auch auf Account-Links.
Vorhandene Löschregeln decken Cache, KI-Requests, Quoten und beide Link-Seiten ab;
das ersetzt nicht die vollständige Freigabe des geerbten Löschinventars.
364 bestehende QA-Security-Advisories: 133 authenticated/120 anon Definer-Meldungen,
109 mutable search_path, zwei Auth-Konfigurationsmeldungen. Keine Vollfreigabe
aller geerbten Datenbankfunktionen; die Familien-ACLs werden gesondert getestet.

## Aktuelle Prüfungen

| Prüfung | Ergebnis | Grenze |
|---|---|---|
| Jest | 299 Tests / 15 Suites bestanden | Provider-/SDK-Fixtures |
| Nativer PostgreSQL | 71 Assertions bestanden | Einschließlich konkurrierender Quoten und Annahmen |
| PGlite | 69 Assertions bestanden | Serielle Alternative, nicht zu PostgreSQL addieren |
| Account-Deletion-SQL | 9 Tests bestanden | Synthetische Daten, keine echte Löschung |
| QA-Konfigurations-/Build-Sperren | 5 Tests bestanden | Durch Gerätesichtprüfung ergänzt |
| App- und Test-TypeScript | Bestanden | Kein nativer Buildnachweis |
| ESLint der betroffenen Dateien | 0 Fehler | Bestehende Effect-/Import-Warnungen |
| QA-Cloud vor und nach Deployment | Je 20 Prüfungen bestanden | Kein bezahlter Kaufnachweis erzeugt |
| Produktions-Hotfix-Provenienz | Bestanden | Keine erneute Reparatur |

Cloud-Fälle: normale QA-Logins, Caller-Identität, private Caches, gefälschte
Client-Tarife, unsichtbare fremde Einladungen, genau ein Partner, tatsächlicher
Annahme-/Sync-Wrapper, HMAC/Authorization, Replay, geschützter Worker und Ablehnung
von Fürsorge ohne Abo. Die temporären Einladungen wurden entfernt. **Keine manuell
gefälschten Store-Käufe oder paid_*-Einträge in der Cloud.**

Nachweise: `output/family-rollout-20260924/`, besonders die sanitierte
`device-main-case.json`; private Store-/QR-Screenshots, Quellbundles, Build-Metadaten
und Konfiguration nur unter `.family-qa/rollout-20260924/`. Keine Tokens/Passwörter
im öffentlichen Protokoll.

## Geräte und Builds

Samsung SM-A528B `RZCT41N7CWR`: am 24.09.2026 per **Play-internem Testtrack**
datenbewahrend von `1.0.23 (4)` auf **1.0.23 (6)** aktualisiert. Der Installer
bleibt `com.android.vending`; `firstInstallTime` blieb 07:11:07 und
`lastUpdateTime` ist 11:07:38 Ortszeit. Google-Testkonto ausschließlich
`jan.zepp1999@gmail.com`; kein anderes Gerätekonto verändert. Die QA-AAB wurde
als Release `6 (1.0.23)` veröffentlicht und ist für interne Tester verfügbar.
Warnung der Play Console: optionale Zuordnungsdatei fehlt; keine Änderung der
Geräteunterstützung. Kein Produktions-Play-Track verändert.

Jans iPhone 16 Pro ist wieder per CoreDevice verfügbar. `devicectl device info apps`
bestätigt die installierte App `com.LottiBaby.app` **1.0.24 (1.0.60)**; der Nutzer
hat Installation und Öffnen in TestFlight bestätigt. App-Login, QR-Einlösung und
tatsächliche Apple-Sandbox-Anmeldung waren zu diesem Zeitpunkt noch offen;
Login und QR-Einlösung sind inzwischen im Abschnitt zum echten QA-Fall belegt.

Die zunächst gestarteten Builds `32ce10f5-6c48-4a5f-95da-e2baf885f5bd` und
`c50e9232-ece2-4ad7-89ff-3eca6a22c0d1` wurden vor Fertigstellung abgebrochen,
um auch den direkten `/invite`-Link in die Paywall-Ausnahmen aufzunehmen.
Die beiden Einstiegspfade und weiterhin gesperrten Feature-Seiten sind getestet.

Neue isolierte QA-Builds erfolgreich abgeschlossen, zunächst ohne automatische Store-Einreichung:

- Android `8a7227f0-1ced-4aae-9100-9766bafdf5bf`, family-qa-play, AAB,
  am AAB bestätigte Version **1.0.23 (6)**.
- iOS `a9813112-cbfd-4894-9e2a-ce4de4e7fa97`, family-qa-ios,
  an der IPA bestätigte Version **1.0.24 (1.0.60)**.

Die Build-Kopie verwendet `family-qa-1.0.24`, deaktivierte native Updates und das QA-Backend.
Die EAS-Jobs haben die QA-Post-Install-Prüfung und die nativen
Gradle-/Fastlane-Schritte erfolgreich abgeschlossen.
Android **FINISHED**; AAB heruntergeladen, `bundletool validate` und JAR-Signatur
geprüft; SHA-256 des Zertifikats stimmt mit dem bereits dokumentierten EAS-Upload-Key
überein. Paket-ID, Version, QA-Backend, SDK-Key, neuer Code-Einstieg, QA-Runtime und
Updates=false bestätigt; bekannte private QA-Secrets nicht enthalten.
Nachweis: `android-artifact-check.json`. Anschließend über den internen Play-Track
signaturkompatibel auf dem Samsung installiert und gestartet.

iOS **FINISHED**; IPA heruntergeladen und geprüft: App-ID, Version 1.0.24 (1.0.60),
QA-Backend, öffentlicher Store-Key, neuer Code-Einstieg, QA-Runtime und deaktivierte
Updates stimmen. `codesign --verify --deep --strict` bestanden, bekannte private
QA-Secrets nicht enthalten. Nachweis: `ios-artifact-check.json`.
Nach erfolgreicher Artefaktprüfung wurde genau diese IPA über das bestehende
Profil `preview-testflight` einzeln eingereicht. Submission-ID
`95538de6-c83e-4ddc-86a4-9735f14e5246`; EAS meldet **FINISHED**, Abschluss
24.09.2026 08:07:42 UTC. Die anschließend erfolgreich ausgeführte direkte
App-Store-Connect-Statusabfrage zeigte zunächst nur ältere TestFlight-Builds.
Die erneute Abfrage ergab für 1.0.60 `VALID` und `IN_BETA_TESTING`. Die Version
ist auf Jans iPhone installiert; dieser Nachweis ersetzt noch keinen Funktionsfall.

Nach dem Apple-Sandbox-Kauf zeigte „Abo verwalten“ in iOS 1.0.60 nur die
gewöhnliche App-Store-Abo-Seite. Apple bestätigt, dass ein TestFlight-Kauf mit
normaler Apple-ID dort nicht gekündigt werden kann; dafür braucht die App das
native StoreKit-Verwaltungsblatt. `lib/subscriptionManagement.ts` öffnet dieses
Blatt auf iOS nun über `Purchases.showManageSubscriptions()` für Apple-Käufe;
Android und Käufe anderer Stores behalten ihre storebezogene Weiterleitung.
Gezielter Jest-Test, Typecheck und ESLint bestanden. Der isolierte iOS-QA-Build
`98f5fbe6-d525-4364-a1a7-b54cda785156` wurde als **1.0.24 (1.0.61)**
fertiggestellt. Am IPA wurden Bundle-ID, Version, QA-Backend, nativer Aufruf,
deaktivierte Updates und Signatur geprüft. Submission
`93e235d3-4571-4dc8-9e47-fecfdc760f1c` wurde an TestFlight übergeben;
EAS meldete anschließend `FINISHED`. Apples Verarbeitung, Geräteinstallation
und erfolgreiche Kündigung sind noch zu prüfen.

## Echter QA-Store- und Gerätefall am 24.09.

Mit dem normalen QA-Konto „Android Partner C“ wurde die Play-App erstmals
angemeldet und durch das Onboarding geführt. Das Play-Kaufblatt zeigte für
**Premium monatlich (9,99 € Listenpreis)** ausdrücklich „Testkarte, immer
genehmigt“, „Dies ist ein Testabo“ und „Dir wird nichts in Rechnung gestellt“.
Der kostenlose Kauf wurde abgeschlossen; die App zeigte Premium. Im QA-Backend
steht ein per RevenueCat bestätigter Cache mit `tier=premium`,
`product_id=lottibaby_premium:monthly` und `paid_tier=premium`. Die monatliche
Testsubscription erneuert sich in kurzen Sandbox-Intervallen; um 09:28 UTC
war `paid_expires_at=09:32:35 UTC` und der Cache frisch geprüft.

Auf Android wurde eine neue Partner-Einladung erzeugt. Die QA-Tabelle
`account_links` zeigte den offenen Link mit `relationship_type=partner`,
32-stelligem Code und Ablauf 01.10.2026. Der QR-Code lag auf dem Samsung
vor; der Code liegt nur in der privaten QA-Evidenz. Auf dem iPhone wurde die
Einladung mit dem **eigenen** normalen QA-Konto „Apple Familienmitglied B“
angenommen. `account_links.status=accepted` und `invited_id` stimmt genau mit
diesem Konto überein. Das erste beschleunigte Testabo war während der Anmeldung
abgelaufen; danach wurde auf Android ein **zweiter ausdrücklich kostenloser
Premium-Play-Testkauf** mit derselben Testkarte abgeschlossen.

Der authentifizierte Endpoint `family-subscription-access` lieferte für das
iPhone-Konto `status=active`, `tier=premium` und ein vom Store bestätigtes
`expiresAt`. Android zeigte wieder Premium. Der Nutzer bestätigte auf dem
iPhone: **Premium sichtbar, keine Kauf-Paywall**. Im privaten Tarifcache von B
blieben `tier` und `paid_tier` leer; der Kauf gehört C und wird ausschließlich
über die angenommene Partnerverbindung geteilt. Damit ist der geforderte
Hauptfall in **QA auf echten Geräten** positiv nachgewiesen, nicht in Produktion.

Mit dem echten Store-Kauf und Link wurden zusätzlich beide serverseitigen
Quoten-RPCs geprüft: je ein Aufruf von B und C erhöhte den gemeinsamen
Frag-Lotti-Tageszähler des Zahlers von 0 auf 2 und den Fürsorge-Zähler von
0 auf 2. Bei B wurde jeweils kein eigener Zähler angelegt. Dies beweist die
gemeinsame SQL-Reservierung, aber mangels Provider-Key keine erfolgreiche
KI-Antwort. Eine zusätzliche Partner-Einladung von Konto D wurde beim Versuch,
B ein zweites Mal zu verknüpfen, mit HTTP 409 abgewiesen; die temporäre
Einladung wurde entfernt.

Im Google-Play-Abo-Manager wurde die aktive Testsubscription und der
Kündigungsweg bis zum angekündigten Periodenende angezeigt. Die USB-ADB-
Autorisierung ging unmittelbar vor der Kündigungsbestätigung verloren;
eine **Kündigung** wurde deshalb nicht abgeschlossen. Das Testabo lief durch
die beschleunigten Sandbox-Zyklen später natürlich aus. Danach zeigte Play
**0 aktive Abos**; der Kaufcache von C war leer und
`family-subscription-access` lieferte für B `status=none`, während der
Partner-Link `accepted` blieb. **Entzug nach natürlichem Ablauf ist damit
serverseitig bestätigt**. Der Nutzer hat nach erneutem Öffnen der iPhone-App
zusätzlich bestätigt, dass Premium dort wieder gesperrt ist. Zugang nach
Kündigung bis Periodenende wurde anschließend vom Nutzer auf beiden Geräten
als funktionierend gemeldet. Ein separater serverseitiger Nachweis des
Kündigungsereignisses mit `will_renew=false` liegt für diesen Play-Fall nicht vor.

Der Nutzer hat `OPENAI_API_KEY` anschließend im **QA-Projekt** gesetzt;
die CLI-Abfrage bestätigte nur die Existenz des Secret-Namens, ohne den Wert
auszulesen. Mit echten Auth-Sessions der normalen Konten B und C wurden die
beiden KI-Functions danach direkt aufgerufen (keine Geräte-UI-Abnahme):

- `ask-lotti` beantwortete je eine allgemeine Schwangerschaftsfrage für C
  (Familienmitglied ohne eigenen Kauf) und B (Apple-Käufer) mit HTTP 200,
  `isFallback=false`. Beide privaten Request-Logs meldeten `completed`,
  `route=model`, einen Planner- und einen Antwortmodell-Aufruf sowie keinen
  Fehler. Der aktuelle Tageszähler des zahlenden Kontos B stand nach Cs
  Anfrage bei 1 und nach Bs Anfrage bei 2. Cs älterer eigener Tageszähler
  blieb bei 2.
- `advisor-generate` lieferte mit neutralen synthetischen QA-Signalen für
  beide Konten HTTP 200, `source=ai`, `persisted=true`. Der Fürsorge-
  Tageszähler von B stieg von 0 über 1 auf 2; Cs älterer eigener Zähler
  blieb bei 2. Die Antworten wurden als QA-Tageshinweise gespeichert.

Damit sind positive Provider-Antworten und die geteilten Kontingente in der
Richtung **Apple-Kauf → Android-Familienmitglied** serverseitig belegt.
Ein visueller Test der KI-Oberflächen auf beiden Geräten steht separat aus.

### Umgekehrte Richtung Apple → Android

Der Nutzer hat anschließend auf dem iPhone mit dem eigenen Konto B ein
Apple-Sandbox-Premiumabo gestartet und Premium auf Android-Konto C bestätigt.
Die QA-Liveprüfung zeigte für B `product_id=lottibaby_premium_monthly`,
`paid_tier=premium` und ein bestätigtes `paid_expires_at` am 25.09.2026.
C hatte weiterhin **keinen eigenen bezahlten Tarif**; der authentifizierte
Familien-Endpunkt lieferte für C `status=active`, `tier=premium` bis zum
bestätigten Apple-Ende. Der angenommene Partner-Link blieb bestehen. Dieser
Nachweis ist Apple-Sandbox → Android-QA, keine bestehende Apple-Familienfreigabe
und kein Produktionskauf. Die Kündigung des neuen Apple-Abos ist noch nicht
serverseitig bestätigt: RevenueCat meldete bei der letzten Abfrage für das
aktive Abo `auto_renewal_status=will_renew`.

### Nachprüfung am 25.09.2026

Um 09:35 UTC wurde das isolierte QA-Projekt erneut mit echten Logins und
RevenueCat gelesen. Konto **Apple Käufer A** hat im privaten Tarifcache einen
aktiven Apple-Sandbox-Kauf `lottibaby_premium_monthly` mit `paid_tier=premium`
bis **25.09.2026 12:33:11 UTC (14:33:11 MESZ)**. RevenueCat meldet für die
aktive Apple-Subscription `auto_renewal_status=will_not_renew`. Die Kündigung
ist damit serverseitig bestätigt; der Kauf gewährt bis zum Periodenende weiter
Zugang. Das mit A angenommene QA-Partnerkonto **D** hat keinen eigenen Kauf,
erhält aber über `family-subscription-access` weiterhin `status=active` und
`tier=premium` bis genau zu diesem Store-Ende. Die Backend-Lease war auf unter
fünf Minuten begrenzt. A und D waren zu diesem Zeitpunkt noch nicht beide
auf Geräten visuell geprüft; der Entzug wurde später unten bestätigt.
Die früheren Konten B und C lieferten bei dieser Nachprüfung keinen aktiven
Familienzugang; ihre privaten Kaufcaches waren leer.

App Store Connect meldete den eingereichten iOS-QA-Build **1.0.24 (1.0.61)**
als `VALID` und `IN_BETA_TESTING`. Seine Installation auf dem iPhone und der
native Kündigungsweg sind noch nicht durch einen Gerätenachweis bestätigt.
Die öffentlich ausgelieferte iOS-Version ist weiterhin 1.0.23 (1.0.55).

Eine erneute Prüfung um 09:46 UTC bestätigte: A hat weiterhin `paid_tier=premium`,
RevenueCat `status=active`, `environment=sandbox`, `will_not_renew` und
`ends_at=12:33:11 UTC`. A und D sind in QA als Partner verbunden; die
authentifizierten Familien-RPC und Edge Function liefern für **D** `active`
und `premium` bis zum Store-Ende. Die auf dem verbundenen Android-Gerät
angezeigte Kauf-Paywall ist damit **noch nicht erklärt**. Zuerst muss das dort
tatsächlich angemeldete Lotti-Konto geprüft werden: Das frühere Konto C hat
keinen aktiven Familienzugang, nur D ist mit A verbunden. Die vom Nutzer
genannte Apple-Anzeige „Zugang bis 22. November 2026“ gehört nicht zu dem
RevenueCat-Kaufnachweis dieses QA-Kontos; alle dort gelisteten Subscriptions
enden spätestens am 25.09.2026. Quelle und Apple-/Lotti-Konto dieser Anzeige
sind noch zu klären, bevor ein Geräteergebnis behauptet wird.

Am selben Tag wurde die Android-Paywall auf dem verbundenen Samsung per ADB
geprüft. Über „Familiencode einlösen“ zeigt die installierte QA-App unter
„Verknüpfte Accounts“ **Apple Familienmitglied B**. Die QA-Datenbank bestätigt
genau die angenommenen Paare **C↔B** und **A↔D**; B hat derzeit keinen eigenen
aktiven Kauf. Damit ist die Paywall des auf Android angemeldeten Kontos C
**erwartetes Verhalten**, kein nachgewiesener Fehler der A→D-Freigabe. Ein
Wechsel zu D auf dem Samsung erfordert Abmeldung von C; der App-Abmeldepfad
bereinigt persönliche lokale Gerätedaten. Bestehende lokale Testdaten wurden
deshalb nicht durch eine automatische Abmeldung verändert. Das iPhone ist
inzwischen mit iOS-QA-Build **1.0.24 (1.0.61)** installiert; `devicectl`
bestätigt diese Version. Der aktuelle Apple-Sandbox-Kauf von A und die
familienberechtigte D-Session sind serverseitig bestätigt, ein gemeinsamer
Gerätetest A→D blieb zu diesem Zeitpunkt offen.

Nach ausdrücklicher Gerätefreigabe wurde auf dem Samsung C über den normalen
App-Abmeldeweg abgemeldet und D mit dem vorhandenen QA-Login angemeldet. Der
Login funktionierte. Für D wurde das erste Onboarding mit neutralen QA-Angaben
abgeschlossen; keine Store-Buchung oder manuell gesetzte Kaufberechtigung.
Danach öffnete die App die Krankenhaus-Checkliste **ohne Paywall**. In „Mehr“
stand „Familienabo-Zugang aktiv“. Die Abo-Seite zeigte „Premium · Familienabo“,
„Aktiv über dein Familienabo“ und „Zugang bis 25.09.2026“; der geschützte
Aufpasser-Modus ließ sich ohne Kauf-Paywall öffnen. Damit ist A→D auf dem
Android-Gerät als positive Familienfreigabe bestätigt. Der Entzug nach
14:33 MESZ wurde später unten separat bestätigt. C wurde dabei nicht neu verknüpft;
die bestehenden QA-Paare A↔D und C↔B blieben erhalten.

Beim anschließenden Neustart der Android-App blieb die Abo-Seite für D
korrekt auf „Premium · Familienabo“. Auf der Startseite waren jedoch
„Lottis Fürsorge“ und Sprach-Log noch gesperrt, während „Frag Lotti“
freigeschaltet war. Ursache war ein einmalig beim Fokus gelesener
Feature-Zugang, der die später aktualisierte Familienberechtigung nicht
übernahm. Die Android-Quellen für Fürsorge, Sprach-Log und die schwebende
Sprach-Schaltfläche wurden auf die reaktive Subscription-Berechtigung
umgestellt. Ein Regressionstest für Freigabe, Entzug und Kontowechsel,
TypeScript-Prüfung und ESLint sind erfolgreich. Ein neuer QA-AAB-Build
**1.0.23 (7)** wurde dafür unter EAS-ID
`eb658906-3a3e-465d-bfdc-0e18e6e525fd` gestartet. Die Korrektur ist
erst nach Play-Installation und Gerätenachprüfung abgenommen.

Mit dem weiterhin installierten Play-QA-Build **1.0.23 (6)** öffnete D
„Frag Lotti“ ohne Paywall und erhielt auf dem Samsung zu einer
Beispielfrage eine echte, personalisierte KI-Antwort. Die Anzeige
„Heute noch 19 Fragen“ nach dieser einen Frage bestätigt die auf dem
Gerät wirksame Premium-Quote; zuvor waren 20 verfügbar. Dieser
Gerätenachweis gilt für „Frag Lotti“, nicht für die noch gesperrten
anderen zwei KI-Kacheln des alten Builds.

Der neue Android-AAB-Build **1.0.23 (7)** wurde fertiggestellt und lokal
geprüft: QA-Backend, passender RevenueCat-Schlüssel, Familiencode,
deaktivierte native Updates, Versionscode 7, EAS-Upload-Zertifikat und
Abwesenheit bekannter privater QA-Secrets wurden im Artefakt bestätigt.
SHA-256: `cc99ffc2aa5799f034ab92039d765f035cec4dd07fd863d22227b253a4dfc545`.
Der Build wurde am 25.09.2026 um 14:13 MESZ im **internen** Google-Play-
Testtrack veröffentlicht. Die Play Console meldet „Für interne Tester
verfügbar“ für Release `7 (1.0.23) Familienzugang QA`; der Produktions-
Track blieb unverändert. Die Play-signierte Universal-APK wurde aus dem
Bundle Explorer geladen und zunächst mit `adb install -r` als Update
eingespielt (SHA-256
`0770d412fe44ebac2b7f75d195909e09c107115d7b402195336e93cb20953433`).
Da Play bei diesem Zwischenstand die fehlende Installationsquelle erkannte
und die App sperrte, wurde anschließend auf dem Samsung die offizielle
Schaltfläche „Über Google Play aktualisieren“ ausgeführt. Danach meldete
Android `versionCode=7` und `installerPackageName=com.android.vending`; die
vorhandene D-Sitzung blieb bestehen. Das war eine echte Play-Aktualisierung
mit erhaltenen App-Daten, kein frisch eingerichteter Testnutzer.

Nach Kaltstart zeigte D auf der Startseite alle drei Premium-Kacheln als
freigeschaltet. „Lottis Fürsorge“ öffnete ihre Inhalte; „Per Sprache
eintragen“ öffnete den Aufnahme-Dialog. Beide zeigten keine Kauf-Paywall.
Die Abo-Seite zeigte „Premium · Familienabo“, „Aktiv“ und „Zugang bis
25.09.2026“. Damit ist die UI-Start-Race aus Version 6 für dieses Konto
auf dem Samsung behoben und positiv gerätegeprüft. Screenshots und APK
liegen privat unter `.family-qa/rollout-20260925/`.

Ein Offline-Geräteversuch mit D wurde nach mehr als fünf Minuten ohne
aktives Android-Netz durchgeführt. Nach einem erzwungenen App-Neustart
blieb Build 6 auf dem Splashscreen; deshalb ließ sich die sichtbare
Paywall-Sperre offline **nicht** abnehmen. WLAN und Mobilfunk wurden auf
ihren Ausgangszustand zurückgestellt, die App startete danach wieder.
Nach Wiederverbindung war Premium einmal vollständig sichtbar; ein
erneuter normaler App-Neustart zeigte Fürsorge und Sprach-Log jedoch auch
nach einer Minute wieder gesperrt. Das reproduziert die Start-Race in
Build 6; die zeitweilige Freigabe nach Fokuswechsel reicht nicht als Fix.
In einem zweiten Offline-Versuch blieb die Abo-Seite zunächst geöffnet.
Nach mehr als fünf Minuten ohne Netz zeigte die App nur noch eine weiße
Fläche, obwohl der Prozess lief. Nach Netz-Rückkehr brauchte sie einen
Neustart. Auch dieser Versuch liefert **keinen** sichtbaren Nachweis,
dass die abgelaufene Familien-Lease eine Paywall statt Premium zeigt.
Der Offline-Start und die weiße Ansicht sind zusätzlich vor einer
Produktionsfreigabe zu untersuchen.

Mit **Build 7** wurde ein weiterer Offline-Vordergrundtest durchgeführt:
D hatte online aktiven Familienzugang; danach wurden WLAN und Mobilfunk
abgeschaltet und Android meldete kein Standardnetz. Als die vom Server
ausgestellte kurze Familien-Lease ablief, zeigte die App eine Kauf-Paywall.
Nach Wiederherstellung des Netzes kam die Abo-Seite ohne App-Neustart
zurück und zeigte erneut „Premium · Familienabo / Aktiv“. Damit sind
sichtbarer Entzug bei Netzausfall und Online-Wiederherstellung für diesen
Fall bestätigt. Beim separaten Kaltstart ohne Netz mit dem inzwischen
abgelaufenen D-Abo blieb Build 7 nach mindestens 60 Sekunden auf der
ersten Produkt-Einführungsseite stehen. Auch nach Netzwiederkehr wechselte
die Ansicht nicht; erst ein App-Neustart zeigte die korrekte Kauf-Paywall.
Die Offline-Kaltstart-UX bleibt damit ein reproduzierbarer Fehler.
Eine nutzergebundene lokale Erinnerung an ein zuvor bestätigtes
Onboarding wurde als Korrektur ergänzt. Bei vollständig geladenen,
unvollständigen Online-Daten wird sie widerrufen, beim Abmelden mit den
lokalen Daten gelöscht. Gezielte Tests, TypeScript und ESLint bestehen.
Buildversuch 8 (`1864c115-5922-4ced-be20-f2f11c114bf9`) scheiterte,
weil das aus einem ausgeschlossenen Unterordner hochgeladene Archiv
keine `package.json` enthielt. Der nun eigenständig gepackte und vorab
inspizierte QA-Store-Build **1.0.23 (10)**
(`b28bc7ac-cf7c-426a-89fa-f90073efd734`) wurde erfolgreich fertig.
Bundletool- und Signaturprüfung des AAB mit SHA-256
`accd8c8403ab2d664b6bfea01e29520b16c8c8604deeff28e525907b26bc442e`
bestätigen QA-Backend, Familiencode, Offline-Korrektur und deaktivierte
native Updates. Google Play veröffentlichte den internen Release
**10 (1.0.23) Familienzugang QA** am 25.09.2026 um 16:15 MESZ als
„Für interne Tester verfügbar“. Das Samsung wurde mit der Play-Schaltfläche
„Aktualisieren“ datenbewahrend auf Versionscode 10 gebracht; der Installer
ist `com.android.vending`, die Erstinstallationszeit unverändert.
Bei bestehender D-Sitzung zeigte die App nach einem Kaltstart ohne Netz
bereits nach 12 Sekunden die Kauf-Paywall und blieb dort über 60 Sekunden.
Android meldete währenddessen kein Standardnetz und der Ping scheiterte;
nach Wiederverbindung blieb Premium gesperrt. Damit ist der vorherige
Onboarding-Rücksprung auf diesem Gerät behoben. Ein anschließender
Kontowechsel D → C → D zeigte für beide abgelaufenen Familienkonten die
Paywall. Beim ersten Offline-Kaltstart direkt nach dem Rückwechsel zu D
blieb die Ansicht jedoch rund 45 Sekunden leer und erreichte erst bis
etwa 75 Sekunden die Paywall. Es gab zu keinem Zeitpunkt Premium-Zugang;
die Startlatenz nach Kontowechsel bleibt als Android-UX-Befund offen.
WLAN und Mobilfunk wurden danach wieder aktiviert.

Das Apple-Sandbox-Abo von A lief planmäßig am **25.09.2026 um 12:33:11 UTC
(14:33:11 MESZ)** ab. Der authentifizierte QA-Endpunkt
`family-subscription-access` gab für D danach `status=none` zurück.
Auf dem online verbundenen Samsung mit Play-Version 7 erschien um
14:33:23 MESZ die Kauf-Paywall und blieb auch nach einem erzwungenen
App-Neustart sichtbar. Das ist der positive Gerätenachweis für den
Entzug beim Android-Partner nach Ende des gekündigten Apple-Abos.

## Erneuter Android-Kauf und Wiederherstellung am 26.09.

Auf dem unverändert Play-installierten Samsung mit **1.0.23 (10)** schloss
das normale QA-Konto C einen weiteren Premium-Monatstest ab. Das native
Google-Play-Kaufblatt bestätigte Testkarte, Testabo und **keine
Rechnungsstellung**. Die App zeigte C danach „Premium · Monatsabo“ als
aktiv. Für das bereits verbundene iPhone-Konto B lieferte der
authentifizierte Familienendpunkt `active/premium`; D blieb `none`.
Der „Käufe wiederherstellen“-Knopf wurde betätigt; der eigene Zugang
blieb aktiv. Ein Restore nach Neuinstallation oder Datenverlust ist damit
noch nicht belegt. Der Versuch, während dieses aktiven Google-Abos von
Premium monatlich auf Lite monatlich zu wechseln, wurde von der App mit
dem Hinweis auf derzeit nicht verfügbare Google-Tarifwechsel abgewiesen.
Es entstand kein zweites Abo.

Zum ersten beschleunigten Erneuerungszeitpunkt 09:08:12 UTC war B beim
Backend-Abruf vorübergehend `none`. Die Android-App zeigte C noch Premium;
RevenueCat bestätigte eine neue aktive Laufzeit bis 09:13:12 UTC. Ein
späterer Backend-Abruf um etwa 09:12 UTC gab B wieder `active/premium`,
anschließend wurde bis 09:18:12 UTC verlängert. Bei der folgenden
Verlängerung zeigte eine zehnsekündliche authentifizierte Abfrage B um
09:18:13 UTC als `none` und um 09:18:55 UTC wieder als `active/premium`
bis 09:23:12 UTC. Die rund **42 Sekunden** ohne Familienzugang sind
belegt. Der QA-Tarifcache verzeichnet einen Reconciliation-Versuch um
09:18:00 UTC und die neue Bestätigung erst um 09:18:52 UTC. Wann genau
Play beziehungsweise RevenueCat die Verlängerung bereitstellte, ist
noch offen. Der Google-Play-Abo-Manager ließ sich über die App öffnen,
lud aber zunächst trotz gültigem WLAN und erreichbarem
`play.google.com` nicht („Keine Internetverbindung“/„Zeitüberschreitung“).
Nach einem Force-Stop der Play-Store-App lud der direkte Store-Einstieg.
Das kostenlose Lotti-Testabo wurde dort um etwa **11:25 MESZ** gekündigt;
Google Play bestätigte „Gekündigt“ und das Periodenende **11:28 MESZ**.
Vor diesem Ende zeigte die Android-App C weiter Premium, der
authentifizierte Familienendpunkt B `active/premium` bis
09:28:12 UTC. Nach dem Ende meldete Google Play **0 aktive Abos**,
die App C nach Neustart die Kauf-Paywall und der Endpunkt B `none`.
Damit ist die Android-Kündigung mit Restlaufzeit und anschließendem
Entzug für beide Konten in QA abgenommen. „Käufe wiederherstellen /
Status prüfen“ auf Cs Paywall reaktivierte den abgelaufenen Kauf nicht.
Private Screenshots und die
authentifizierte Statusabfrage liegen unter `.family-qa/rollout-20260925/`.

## Noch erforderliche Abnahme und Produktionsvoraussetzungen

- Der Hauptfall G04, gemeinsames serverseitiges Kontingent und die sichtbare
  Kaufvermeidung beim iPhone-Partner sind in QA bestätigt. Nach Setzen des
  QA-OpenAI-Secrets sind auch echte positive KI-Provider-Antworten und
  gemeinsame Quoten für beide normalen Konten serverseitig bestätigt.
  „Frag Lotti“ ist für D auf Android visuell und mit echter Antwort
  bestätigt; Fürsorge und Sprach-Log sind mit Play-Version 7 nach Kaltstart
  visuell freigeschaltet und lassen sich ohne Paywall öffnen.
- Weitere Tarife/Laufzeiten, Restore nach Datenverlust, erfolgreicher
  Google-Tarifwechsel, Erstattung/Grace,
  Apple-Familie G01–G03, bestehendes eigenes Partnerabo,
  Trennung/Kontowechsel und G10/G11 sind **nicht auf Geräten abgenommen**.
  Der Netzausfall wurde im Vordergrund geprüft; der Offline-Kaltstart mit
  bestehender D-Sitzung ist mit Play-Version 10 behoben. Direkt nach einem
  Kontowechsel dauerte der Offline-Start bis zur Paywall noch bis etwa
  75 Sekunden. Die lokalen Tests und der Produktions-Lite-Test aus
  Auftrag 1 ersetzen diese Familienabnahme nicht.
- Löschinfrastruktur ist eine echte Rolloutabhängigkeit: QA hat noch keine
  Inventarfreigabe, keine Retention-Konfiguration und keinen aktiven PostgREST-
  Vorabprüfer. Produktion hat das Schema noch gar nicht. Die neue App enthält
  zusätzlich den neuen Löschablauf. Vor Produktionsrelease dessen Inventar,
  tatsächliche Fristen, Providerbetrieb und Function-/Scheduler-Bereitstellung
  gemäß `docs/privacy/deletion-runbook.md` abschließen; keine erfundenen Fristen
  oder pauschale Fingerprint-Freigabe verwenden.
- Nach Abnahme gezielt Datenbankvoraussetzungen, Familienmigration und zusätzlichen
  Guard vor den sechs oben genannten Functions bereitstellen. Weitere geänderte
  Verbraucher des Löschschutzes separat in den koordinierten Release einbeziehen:
  Nachrichten-/Planer-/Baby-Benachrichtigungen, Chat-Audio-/Löschendpunkte,
  `request-account-deletion`, `process-account-deletion`; `advisor-daily` und dessen
  geänderten Betriebszustand ebenfalls beachten. Nicht blind alle uncommitteten
  Functions deployen.
- Produktions-Reconciliation-Secret, Vault, Cron, JWT/HMAC, Löschinventar und
  tatsächliche installierbare Store-Versionen prüfen. Keine kostenpflichtige
  Produktions-Testbuchung ist beauftragt. Echter Produktions-Familiennachweis bleibt
  von Sandbox-Abnahme getrennt.
- QA bleibt während ausstehender Abnahme erhalten; nach Abschluss nur temporären
  QA-Webhook, QA-Cron und QA-Branch entfernen, niemals die dauerhafte Store-Anbindung.

Lesender Abgleich am **26.09.2026**: Das verknüpfte Produktionsprojekt ist
weiter `kwniiyayhzgjfqjsjcfu`, mit **52 angenommenen Links**, ohne
`subscription_private`, ohne `deletion_private` und ohne `paid_*`-Spalten
im Tarifcache. Das isolierte QA-Projekt ist weiterhin
`ggyonianphloycmqrwvj`; dort sind beide privaten Schemas vorhanden,
aber das Löschinventar ist nicht freigegeben, beide Aufbewahrungsfristen
sind ungesetzt und die Rolle `authenticator` hat keinen
`pgrst.db_pre_request`-Hook. Es gab keinen Produktions-Schreibschritt.

**Antwort auf die Zielfrage:** Familienzugang per Lotti-Code funktioniert
nachweislich in QA in beiden Kaufrichtungen: Android-Kauf mit Android
**1.0.23 (6)** und iOS **1.0.24 (1.0.60)**; Apple-Kauf mit derselben iOS-
Version und Android **1.0.23 (7)**. Android **1.0.23 (10)** ist ebenfalls
über Play installiert und bestätigt den erneuten Android-Kauf, den aktiven
Familienendpunkt sowie den behobenen Offline-Onboarding-Kaltstart.
Für Produktion ist der Familienzugang weiterhin **nicht freigegeben**: die
vollständige Geräteabnahme, Löschinventar-Freigabe sowie
der geordnete Datenbank-/Function-/App-Rollout stehen noch aus.

## QA-Restabnahme am 26.09.2026 (Auftrag 3, Zwischenstand)

**Entscheidung: keine Freigabe für den Produktions-Backend-Rollout.** Die
Hauptfälle mit Premium-Monatsabo bleiben durch die obigen Store- und
Gerätenachweise gültig. Die folgenden Prüfungen ergänzen sie; die offenen
Store- und Kompatibilitätsfälle sind dadurch nicht ersetzt. In Produktion
wurde nichts geschrieben, und weder Store-Produkte noch Preise wurden geändert.

### Frische Umgebung und Versionen

| Ziel | Lesender Nachweis am 26.09. | Testrolle |
| --- | --- | --- |
| QA-Supabase `ggyonianphloycmqrwvj` | CLI-Arbeitsbereich `.family-qa/workspace` auf diese Referenz verknüpft; Cron `family-subscription-rechecks` aktiv, Antworten 11:59–12:03 UTC jeweils HTTP 200. Aktive Functions: `ask-lotti` 31, `advisor-generate` 22, `voice-log-parse` 29, `revenuecat-webhook` 13, `family-subscription-access` 5, `reconcile-family-subscriptions` 5. Nach Download dieser sechs Functions stimmen die 29 Dateien in der gemeinsamen Download-Kopie bytegenau mit den lokalen Quellen überein. | Vier normale QA-App-Konten A/B/C/D, keine Sonderrolle. |
| Produktion `kwniiyayhzgjfqjsjcfu` | Root-CLI zeigt weiterhin auf Produktion; keine Produktionsmutation in dieser Restabnahme. Der oben dokumentierte lesende Produktions-Preflight bleibt der letzte Schemanachweis. | Keine Live-Konten verwendet. |
| Samsung SM-A528B `RZCT41N7CWR` | Installiert `com.LottiBaby.app` **1.0.23 (10)**, Installer `com.android.vending`; Play-Erstinstallation weiterhin 24.09.2026. QA-Buildprofil zeigt auf QA, native Updates sind deaktiviert. | App-Konten C und D; Google-Lizenztester weiterhin das einzige dokumentierte Testkonto. |
| iPhone 16 Pro | `devicectl device info apps` bestätigt **TestFlight 1.0.24 (1.0.61)**. | Visuelle B-Paywall nach Cs letztem Ablauf und natives „Abo verwalten“ wurden für diese Version noch nicht vom Nutzer bestätigt. |

### Beschleunigte Play-Erneuerung: Ursachenfenster

Der vorhandene echte kostenlose Play-Testkauf von C (Premium monatlich) ist
in RevenueCat als abgelaufene Sandbox-Subscription lesbar. Die Transaktionen
weisen die aufeinanderfolgenden Periodengrenzen **09:13:12.704** und
**09:18:12.704 UTC** aus. Das ist der wirksame Renewal-Zeitpunkt, aber kein
Beleg, wann Google die neue Transaktion an RevenueCat lieferte oder wann
RevenueCat sie erstmals per API verfügbar machte. Deren Empfangszeitpunkt
konnte nachträglich nicht ermittelt werden.

| UTC am 26.09. | Tatsächlicher Nachweis |
| --- | --- |
| 09:18:00.159 | Minütlicher QA-Cron lief erfolgreich; `net._http_response` meldet `checked:1, failed:0`, HTTP 200. Das lag **12,545 s vor** der Periodengrenze. Der private Cache hatte um 09:18:00 einen Reconciliation-Versuch. |
| 09:18:12.704 | RevenueCat-Transaktion markiert das neue Periodenende der vorigen Laufzeit. Der alte bestätigte Familiennachweis darf ab hier nicht verlängert werden. |
| 09:18:13 | Zehnsekündliche authentifizierte Abfrage des B-Familienendpunkts aus dem Geräteversuch ergab `none`; Android C zeigte noch Premium. Ein iPhone-B-Screenshot genau während der Lücke liegt nicht vor. |
| 09:18:50.528 | QA-Tabelle `lotti_revenuecat_webhook_events.received_at`: erneutes Store-Ereignis trifft ein. |
| 09:18:52.768 | Dasselbe Ereignis `completed`, ohne Fehler. Der neue private Kaufcache wurde laut vorherigem Live-Abgleich um 09:18:52 bestätigt. |
| 09:18:55 | Authentifizierter B-Endpunkt wieder `active/premium` bis 09:23:12 UTC; beobachtete Lücke etwa **42 s**. |
| 09:19:00.110 | Nächster Cron-Aufruf HTTP 200, `checked:2, failed:0`, erst nach dem Webhook. |

**Einordnung:** Die beobachtete Lücke liegt überwiegend *vor* dem Webhook;
dessen QA-Verarbeitung dauerte etwa 2,24 s. Der Minutenjob lief vor dem
Store-Ende und konnte den nächsten Versuch erst nach dem Webhook starten.
Für die genaue Aufteilung zwischen Google-Ereignisbereitstellung und
RevenueCat-Zustand fehlt ein Provider-Empfangszeitstempel. Ein nachträgliches
Korrigieren des Store-Endes oder ein unbelegter Grace-Zugang wäre mit dem
fail-closed-Vertrag unvereinbar. Es wurde deshalb kein Renewal-Code geändert.
Die Produktwirkung bleibt real: Ein Partner kann bei analog verspätetem
Renewal kurzzeitig Paywall und serverseitig verweigerte KI sehen. [RevenueCat
dokumentiert übliche Webhook-Laufzeiten von 5–60 s](https://www.revenuecat.com/docs/integrations/webhooks);
der einzelne QA-Fall
belegt weder eine garantierte Obergrenze noch die Häufigkeit in Produktion.

### Android-Kontowechsel und echte Neu-Verknüpfung

Ohne App-Datenlöschung und ohne Store-Kontowechsel wurde auf dem Play-Build 10
per normalem App-Logout/Login die Folge **D→C→D** ausgeführt. Beide Konten
hatten zu diesem Zeitpunkt abgelaufene Käufe und sahen die Paywall; der
authentifizierte Familienendpunkt lieferte für A, B, C und D je HTTP 200
mit `none`. Direkt danach wurden WLAN und Mobilfunk abgeschaltet, die App
erzwungen beendet und neu gestartet. Beim zuvor angemeldeten C sowie beim
abschließenden D zeigte der UI-Baum bereits nach ungefähr **8 s** die Paywall;
für D belegt zusätzlich ein privater Gerätescreenshot die sichtbare Paywall.
Sie blieb bis 75 s und nach Netzrückkehr ohne Premium-Zugang. Nach erneutem
Online-Kaltstart blieb D auf der Paywall. Der frühere 45-/75-Sekunden-Befund
ließ sich diesmal nicht reproduzieren; eine sporadische Startlatenz ist damit
noch nicht ausgeschlossen. Es gab keinen neuen Build und keinen unbelegten
Fix-Vermerk. Private Screenshots liegen unter `.family-qa/rollout-20260926/`.
Die verwendete ADB-Netzsperre wurde separat überprüft: kein verbundener
NetworkAgent und ein fehlgeschlagener Ping; anschließend wurden die
vorherigen Netzschalter wiederhergestellt.

Für G07 wurde auf D **in der Android-App** die bestehende A↔D-Verbindung
deaktiviert. Die QA-Datenbank zeigte danach einen `rejected`- und nur noch
einen `accepted`-Partnerlink. A erstellte über den authentifizierten
QA-Endpunkt eine neue Einladung mit serverseitig generiertem 32-Zeichen-Code;
D löste ihn in der App ein und übernahm die vorausgewählte Baby-Auswahl ohne
Löschung. Danach: zwei `accepted`-Links, ein historischer `rejected`-Link,
vier private Mitgliedszeilen und für D weiterhin `none`, da A keinen
aktuellen Store-Kauf hat. Damit sind Trennung und Neu-Verknüpfung real
geprüft. Auch nach erneutem App-Kaltstart blieb D sichtbar auf der
Kauf-Paywall; ein Entzug *während* eines aktiven Sponsorabos bleibt offen.

### G01–G10: kompakte Fallmatrix

„Gerät“ bedeutet tatsächliche Play-/TestFlight-Interaktion, „Cloud“
authentifizierte QA-Abfrage oder reale QA-Datenbank, „lokal“ Tests/Codebeleg.

| Fall | Gerät | Cloud | Lokal | Offen / Freigabewirkung |
| --- | --- | --- | --- | --- |
| G01 Apple-Familienmitglied | 1.0.61 installiert; bestehende Apple-Familie nicht auf Geräten belegt | Eigener Apple-Sandbox-Kauf A ist **kein** Familienfreigabe-Beleg | Ownership-Filter schließt `family_shared` als Sponsor aus | Apple-Familienkonstellation mit Alt-App fehlt; **blockiert** die behauptete Bestandsverträglichkeit. |
| G02 Apple-A→Android-C bei gleichzeitigem Apple-B | A→D mit eigenem Apple-Kauf zuvor auf Android positiv; geforderte Apple-Familie B parallel fehlt | Echter A→D-Endpunkt und KI-Gates zuvor positiv | Ein-Hop-Mitgliedschaft geprüft | Ohne Apple-Familie G01 kein vollständiger G02-Nachweis; **blockiert**. |
| G03 Nicht-Weitergabe durch Apple-B | Keine bestehende Apple-Familienfreigabe für B auf dem Gerät | Zweiter Partner und unbezahlte Verknüpfung in QA abgewiesen | `family_shared` erzeugt kein `paid_*` | Konkreter Apple-Familienfall fehlt; **blockiert**. |
| G04 Google-Käufer→iPhone-Partner | C→B Premium monatlich in Build 6/1.0.60 positiv; Build 10 bestätigt C-Kauf; iPhone-B nach letztem Ablauf noch visuell offen | C→B aktiv, Kündigung bis Ende und anschließend B=`none`; gemeinsame KI-Quota/Providerantwort zuvor positiv | Tarif- und Lease-Tests | Lite/Standard, Jahreslaufzeit und letzte iPhone-Entzugsansicht offen; **blockiert** vollständige Tarifabnahme. |
| G05 Partner mit eigenem Abo | Nie zwei gleichzeitig aktive eigene Käufe im Paar | Höherer Tarif nur als synthetischer Providerfall | Priorität eigenes Abo/Familie getestet | Ohne kontrollierte simultane Store-Abos kein Gerätebeleg; **blockiert** diesen Fall. |
| G06 Kündigung/Ablauf/Erstattung/Grace | Play-Kündigung mit Restlaufzeit und Entzug, Apple-A→D-Ablauf zuvor belegt | Store-Ende und Familienentzug bestätigt | Refund/Grace und Billing-Retry mit Provider-Fixtures | Echte Erstattung und Grace nicht ausgelöst; verbleibendes Widerrufsrisiko **blockiert** vollständige Store-Abnahme. |
| G07 Trennung/Neu-Link/Kontowechsel | D→C→D sowie A↔D-Trennung und Neu-Code in Play-Build 10 bestätigt | Linkzustand `accepted`→`rejected`→neues `accepted`, Mitglieder wiederhergestellt; alle vier Endpunkte ohne unbezahlten Zugang | Konkurrenz-/Unlink-Tests | Entzug während aktiven Sponsorabos und iPhone-Kontowechsel fehlen. |
| G08 Netzverlust/Wiederherstellung | Build 7: aktive Lease nach >5 min sichtbar entzogen und nach Netzrückkehr erneuert; Build 10: abgelaufener D-Zugang nach D→C→D offline zügig Paywall | Keine unbelegte Verlängerung beobachtet | Fünfminuten-Lease und Fehlerpfade | Aktive Lease auf Build 10 unter Netzverlust noch nicht erneut geprüft; sporadische Startlatenz bleibt Restrisiko. |
| G09 verlorene/doppelte/verspätete Events | Echter Play-Renewal mit 42-s-Lücke | Signierter QA-TEST-Webhook akzeptiert und Dublette erkannt; echter Renewal-Webhook um 09:18:50 verarbeitet; Cron aktiv/HTTP 200 | Verspätete Dubletten, Refund/Restore und Repair-Worker in gezielten Tests | Verlorener *echter* Store-Webhook und Provider-Ausfall nicht kontrolliert injiziert; produktseitige Renewal-Unterbrechung **blockiert** vorbehaltloses Renewal-Versprechen. |
| G10 Alt-App vor neuem Backend | Kein alter QA-gebundener Store-Build installiert; alter Produktions-Build zielt auf Produktion | QA-Backend kann Alt-App-Client ohne QA-Bindung nicht sicher erreichen | 8-/32-Zeichen-Kompatibilität und Bestandslink-Guard getestet | Geräte-Rollback/Alt-App gegen QA fehlt; **blockiert** Backend-Vorabausrollung. |

**G11:** Ausschließlich späterer Produktionsnachweis in Auftrag 6; hier
weder durchgeführt noch durch Sandbox ersetzt.

Weitere Lücken: Restore nach Neuinstallation/Datenverlust wurde nicht
ausgeführt, weil dafür die vorhandenen App-Daten des Samsung gelöscht werden
müssten; dafür wurde eine gesonderte Gerätefreigabe angefragt. Ein während
aktiven Google-Abos abgewiesener Tarifwechsel bleibt **kein** erfolgreicher
Tarifwechseltest. Kein zweites Abo wurde dafür gestartet. Der native
StoreKit-Verwaltungseinstieg in iOS 1.0.61 und die letzte visuelle
iPhone-B-Paywall werden am iPhone noch geprüft. Die für G01–G03 nötige
bestehende Apple-Familienkonstellation wurde beim Nutzer erfragt.

Für die nicht ausführbaren Fälle gilt folgende konkrete Entscheidung:
G01–G03 benötigen zuerst eine bereits bestehende Apple-Familienfreigabe
auf zwei eigenen Apple-IDs; der lokale Ownership-Filter ist nur
Ersatznachweis für Nicht-Weitergabe und lässt die Bestandswirkung offen.
G05, die Tarif-/Laufzeitvarianten und Refund/Grace benötigen kontrolliert
aktive Sandbox-Subscriptions und den jeweiligen echten Store-Zustand;
Provider-Fixtures belegen nur die Codeentscheidung. G10 benötigt einen
datenbewahrend installierbaren alten QA-gebundenen Build oder ein zweites
Testgerät; ein Produktions-Build wird nicht gegen QA umgelenkt. Für den
Restore-Fall ist die Antwort zur Löschung der Samsung-App-Daten nötig.
Diese Fälle bleiben bis zum Gerätebeleg oder einer **ausdrücklichen,
einzelfallbezogenen Risikoannahme** für Auftrag 5 gesperrt.

Der erneute gezielte Root-Testlauf bestand mit **115/115 Tests in fünf
Suites** (Familien-Client/Backend, RevenueCat-Backend, Offline-Onboarding,
Startup-Cache). Ein erster QA-Cloud-Smoke-Lauf bestand 17 Prüfungen
einschließlich Webhook-Signatur, Dublette, privater Kaufcache und
verweigerter KI. Der folgende Einladungstest stoppte, weil seine
bisherigen Annahmen freie Konten voraussetzen, während A↔D und C↔B bereits
bestehen; die temporäre Einladung wurde im `finally`-Block aufgeräumt.
Das Testskript prüft jetzt bestehende Partnerplätze vor diesem Teil und
meldet ihn sichtbar als `SKIP`. Danach bestanden **14/14 ausführbare
QA-Cloud-Prüfungen**. Der reale Trennungs-/Neu-Verknüpfungsfall wurde oben
getrennt auf Gerät und QA-Backend geprüft, nicht durch den übersprungenen
Cloud-Smoke-Abschnitt ersetzt.
Zusätzlich bestanden 79/79 gezielte lokale Tests für QA-Sandbox-Grenze und
Produktions-Tarif-Guard. Sie sind kein Produktions-Store-Nachweis.

**Übergabe an Auftrag 4/5:** Familien-QA ist **nicht releasebereit**.
Auftrag 4 kann unabhängig die Löschfreigabe vorbereiten. Auftrag 5 soll den
Familien-Backend-Rollout erst nach Gerätebelegen oder ausdrücklicher,
fallbezogener Risikoentscheidung zu G01–G06/G10, Restore und Renewal-Lücke
beginnen. Eine mögliche Risikoannahme für die Renewal-Lücke müsste eine
kurze, fail-closed Paywall/KI-Unterbrechung beim Partner akzeptieren; sie
darf nicht durch ein künstlich verlängertes Store-Ende kaschiert werden.


## Nachtrag 29.09.: echte Apple-Sandbox-Testfamilie

Testfamilie aus zwei deutschen Sandbox-Accounts erstellt und nativ bestätigt.
A kaufte Premium monatlich kostenfrei in der Apple-Sandbox; B erhielt es
als `family_shared` mit `tier=premium`, `paid_tier=null` im QA-Backend.
G03-Nachweis: akzeptiert verknüpftes Android-C bleibt ohne Familienzugang,
nativ auf Paywall (auch Frag-Lotti-Deep-Link), beide KI-Endpunkte liefern
403. Aktuelles Gerät: Android14 / QA1.0.23(14), PID28531.

G01 noch nicht abgenommen: iOS-Build67 zeigt bei gleichzeitigem eigenen
Lite weiter Lite, obwohl Apple-Familien-Premium aktiv ist. Clientauswahl
korrigiert, 98 gezielte Tests/Typechecks bestanden; Build68 zur nativen
Nachprüfung gestartet. Ein-Geräte-Storekontowechsel ersetzt weder den
simultanen Zwei-Geräte-Fall G02 noch G10/Alt-App-Kompatibilität.
Ausführlicher Stand: `docs/iphone-qa-20260929.md`; private Evidenz in
`.family-qa/iphone-automation/apple-family-c-no-forward-results.json`.
Keine gemeinsame Releasefreigabe oder Freigabe für Aufträge 5/6.

### Build1.0.68: Abschluss der gezielten Geräte-Nachprüfung am29.09.

Eigenes Lite (`trialing`) plus echtes Apple-Familien-Premium bei B: Premium-
Anzeige und Frag-Lotti-Eingabefeld jetzt korrekt. Online-Kaltstart erster
Messpunkt nach1999ms bereit. Parallel dazu A als eigener Apple-Käufer,
B als Apple-Familienmitglied und D auf Samsung als App-Partner bestätigt;
B→C-Nicht-Weitergabe zuvor nativ/API belegt. Ein physisches iPhone verwendet,
keine Alt-App-Abnahme und keine zwei gleichzeitig bezahlten eigenen Abos.

Beim anschließenden Renewal wieder zeitweilige Sperre bei D und503 wegen
fehlendem frischem Providerbeleg. Später200/aktive erneuerte Periode und
natives Eingabefeld ohne Prozessneustart; genaue Lücke unbekannt. iPhone B
behielt in den erfassten Samples das Eingabefeld. Keine volle G09-Freigabe.
Normales Medien-Konto und automatische TestFlight-Updates wiederhergestellt.
Endzustand iPhone B/Samsung D auf Frag Lotti, online. Aktueller Beleg:
`.family-qa/iphone-automation/build68-native-retest.json`.
