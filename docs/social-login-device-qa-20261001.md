# Google-/Apple-Geräteabnahme – 01.10.2026

Status: **Jan-QA-Konto auf Nutzerwunsch gelöscht und über Google am Samsung neu angelegt. Android-Vollanmeldung, Rückkehr, Neustart und App-Kontowechsel Jan/Google → Levi/E-Mail → Jan/Google bestanden. Ein zuvor abgelaufener OAuth-Versuch und der dunkle Zwischenbildschirm sind dokumentierte UX-Punkte. Positiver Erhalt einer verknüpften Familie und eines aktiven Abos sowie Wechsel zwischen zwei Provider-Konten bleiben offen. Keine vollständige Abnahme.**

## Aktuell bestätigte Geräte und Umgebung

- Samsung SM-A528B, verbunden über ADB: `com.LottiBaby.app`, Version 1.0.23, VersionCode **20**, zuletzt aktualisiert am 01.10.2026 um 12:57:54 Gerätezeit.
- iPhone 16 Pro, verbunden und gekoppelt: `com.LottiBaby.app`, Version **1.0.24 (1.0.76)**, über CoreDevice live geprüft. Bedienung und Screenshots über bestehenden Appium/XCUITest-Testhelfer.
- Beide installierten Builds zeigen den Google-Button. Das iPhone zeigt zusätzlich den Apple-Button. Apple-Anmeldung ist im Android-Login nicht angeboten.
- QA-Projekt `ggyonianphloycmqrwvj`: Google und Apple über öffentliche Auth-Einstellungen aktiviert. Die geöffneten Google-Dialoge zeigen dieses QA-Projekt als Ziel.
- Keine Neuinstallation und kein Datenreset. Kein Produktions-, Store-Konto-, Regions- oder Provider-Konfigurationswechsel in diesem Durchlauf.
- Aktuelles Google-Testkonto nach Nutzerkorrektur: `Jan.niklas.zeppenfeld@gmail.com`. Die zunächst ausgewählte Levi-Adresse wurde im Google-Test ersetzt. Die Zustimmung zu Nutzungsbedingungen/Datenschutz für diese QA-Anmeldetests ist ausdrücklich freigegeben.

## Angeforderter QA-Reset und Neuanlage am Samsung

Der Nutzer hat ausdrücklich die Löschung des QA-Kontos und die Neuanlage über Samsung angefordert. Die markierte Test-ID `e1c0c591-0e5f-4d38-96d4-74998dd0efb8` wurde vor der Löschung auf exakte E-Mail, Fixture-Marker, fehlende Familienlinks, fehlendes Abo und ausschließlich eigene Baby-Mitgliedschaften geprüft. Die aktive iPhone-Sitzung wurde regulär abgemeldet; vor der Löschung waren keine Sessions dieser ID mehr vorhanden.

- QA-Auth-Konto administrativ gelöscht: **19:26:45.445 UTC**. Dies ist ein angeforderter Testkonto-Reset, kein Nachweis der nativen Konto-Löschfunktion oder der vollständigen Provider-/Retention-Löschstrecke.
- Backend-Verifikation **19:27:20 UTC**: Jan-ID, Profil, Sessions, eigenes Baby `e438a984-18cf-4fee-9ea0-5279950a7a8f` und Mitgliedschaft entfernt. Kontroll-Nutzer und Familienlinks unverändert. Nutzer **8 → 7**, Babys **6 → 5**, Mitgliedschaften **12 → 11**.
- Das unbrauchbar gewordene lokale QA-E-Mail-Passwort wurde entfernt. Die administrative Testkonto-Neuanlage ist für Jan gesperrt; das neue Konto soll ausschließlich durch den Samsung-Flow entstehen.
- Am Samsung den bisherigen Google-Versuch geschlossen, „Noch kein Konto? Registrieren“ gewählt, die bereits freigegebene Zustimmung gesetzt und Google frisch geöffnet. Die richtige Google-Adresse wurde eingegeben und übermittelt.
- Ein angebotenes Einrichten einer Displaysperre für Passkeys wurde regulär abgebrochen. Die Geräte-Sperre wurde nicht verändert. Google zeigte zunächst **„Passwort eingeben“ für `jan.niklas.zeppenfeld@gmail.com`** (Screenshot `android-google-jan-auth-ready.png`). Der Nutzer gab das Passwort direkt am Samsung ein.
- **Neues QA-Konto anschließend über Samsung angelegt**, ID `873a3eb0-7416-4975-96d1-e34e6a89ba98`, nur Provider `google`. Eine neue ID nach diesem ausdrücklich angeforderten Löschen ist erwartete Neuanlage; sie wird nicht als Identitätsverlust beim Providerwechsel gewertet.

## Samsung-Fortsetzung: abgelaufener Versuch, erfolgreicher Login und Kontowechsel

Der Nutzer meldete nach der Passworteingabe einen kurzen Anmeldebildschirm und die Rückkehr zum Login. Er präzisierte anschließend, dass dort ein Haken mit einer Erfolgsmeldung wie „Login erfolgreich“ sichtbar war. Die Codeprüfung identifiziert die passende Darstellung in **`app/auth/callback.tsx:221`**: Das grüne Haken-Emoji `✅` wird dort **bedingungslos** angezeigt, auch während Verarbeitung, bei Fehlern und ohne Session. Ohne Session setzt der Bildschirm den Status „Keine gültige Sitzung gefunden“ und wechselt nach **zwei Sekunden** zum Login (`callback.tsx:198–202`). Die tatsächlichen Übersetzungen lauten „E-Mail-Bestätigung“ und bei Erfolg „E-Mail erfolgreich bestätigt!“ (`lib/authTranslations.ts:117–120`); „Login erfolgreich“ bleibt der ungefähre Nutzerwortlaut. Damit ist die passende Codequelle in LottiBaby gefunden. Die kurz sichtbare Darstellung selbst wurde nicht aufgezeichnet. Der separat aufgezeichnete dunkle Google-Verarbeitungsbildschirm ist eine andere Beobachtung und darf damit nicht gleichgesetzt werden. Die Präzisierung ist kein Auftrag, eine neue Erfolgsanzeige einzubauen.

Screenshot `android-after-user-google-password.png` und Backend-Abgleich **19:44:02 UTC** bestätigen den Login-Bildschirm und weiterhin kein Jan-Konto. Die QA-Auth-Protokolle nennen für den Rücksprung **19:42:46 UTC** ausdrücklich `400: OAuth state has expired` am `/callback` (Weiterleitung HTTP 303). Damit ist ein abgelaufener OAuth-Versuch belegt; ein falsches Google-Passwort ist daraus nicht ableitbar. Die vom Nutzer beobachtete Erfolgsmeldung belegt keine abgeschlossene LottiBaby-Anmeldung dieses Versuchs.

Der Registrierungsversuch wurde regulär frisch gestartet: Registrierung gewählt, freigegebene Zustimmung gesetzt und Google geöffnet. Der Browser zeigte nun das bereits angemeldete richtige Google-Konto. Die Kontoauswahl wurde per Tastatur bedient, ohne erneute Passworteingabe durch den Agenten.

- Neuer Google-Login **19:47:13.562196 UTC**: QA-Nutzerzahl **7 → 8**, neue ID `873a3eb0-7416-4975-96d1-e34e6a89ba98`, Provider ausschließlich `google`; Serverprotokoll `user_signedup`, anschließender PKCE-Tokenaustausch HTTP 200. Keine administrative Neuanlage.
- Erfolgreicher Rücksprung ins native Onboarding, Screenshot `android-google-fresh-jan-return.png`. Profilfelder Name/Rolle noch leer; das Onboarding wurde nicht ausgefüllt. Nutzungsbedingungen Version `2026-08-17` gespeichert **19:47:14.073896 UTC**.
- Kaltstart: App beendet/neu gestartet, PID **17015 → 28157**. Sitzung und ID erhalten; Onboarding sowie anschließend authentifizierte „Konto & Daten verwalten“-Seite erreichbar. Screenshot `android-google-after-restart-account-controls.png`.
- Regulärer Logout über „Ausloggen“ mit nativem Bestätigungsdialog: Jan-Sessions **1 → 0**. Anmeldung mit vorhandenem Levi-E-Mail-Konto erfolgreich **19:49:17.388114 UTC**, bisherige ID `2148a8f0-6d29-4d51-bae2-13f66ef70ee3`, authentifizierte Paywall ohne Abo sichtbar.
- Levi regulär abgemeldet; Jan per Google erneut erfolgreich **19:50:21.692769 UTC**, dieselbe neue Jan-ID. Browser geschlossen, Onboarding sichtbar; Jan-Sessions **1**, Levi-Sessions **0**. Screenshot `android-google-switch-back-settled.png`.
- Kontroll-Familienlinks, Babys und Mitgliedschaften gegenüber dem Stand nach dem angeforderten Reset unverändert. Keine Käufe, Produktionsänderungen, Geräte-Datenresets oder Provider-Konfigurationsänderungen.

**Im installierten QA-Build beobachtete UX-Punkte:** Der abgelaufene Versuch landet ohne hilfreiche Erklärung wieder beim Login. Der damalige Stand von `app/auth/callback.tsx` behandelte die OAuth-Fehlerparameter nicht ausdrücklich, zeigte unabhängig vom Ergebnis einen grünen Haken und leitete ohne Session nach zwei Sekunden zum Login weiter. Der feste Haken vermittelte damit auch bei fehlgeschlagener Anmeldung ein Erfolgssignal. Beim erfolgreichen erneuten Login war außerdem der dunkle Bildschirm „Anmeldung mit Google“ sichtbar (`android-google-switch-back-return.png`); `app/auth/google-callback.tsx` lag außerhalb der hellen Theme-Override des Auth-Gruppenlayouts. Der starke Wechsel zwischen hellem Login, dunklem Zwischenbildschirm und hellem Onboarding ist damit auch visuell belegt. Während dieser nativen Geräteprüfung wurde kein App-Code geändert. Die anschließend angeforderte Codekorrektur ist getrennt unten dokumentiert.

Neuanlage und App-Kontowechsel ersetzen nicht den positiven E-Mail→Google-Erhalt einer bereits verknüpften Familie und eines aktiven Abos. Der Wechsel zwischen zwei Google-Provider-Konten wurde weiterhin nicht durchgeführt.

## Anschließende Korrektur des Anmeldeübergangs im Quellcode

Auf Nutzerwunsch wurde der feste Erfolgshaken entfernt. Die allgemeine Rückkehrseite und die Google-Rückkehrseite nutzen nun dieselbe schlichte, helle Darstellung mit den vorhandenen LottiBaby-Farben. Während der Verarbeitung erscheint eine Ladeanzeige. Erfolgreiche Anmeldungen gehen ohne künstliche Zwei-Sekunden-Pause direkt zum bestehenden Ziel weiter. Bei Fehlern bleibt eine verständliche Meldung mit „Zurück zum Login“ sichtbar; OAuth-Fehler in URL-Query und Fragment werden vor dem Lesen einer eventuell schon bestehenden Sitzung erkannt. Die Änderung behebt die Darstellung und Fehlerbehandlung, verlängert aber keine serverseitige OAuth-Frist.

E-Mail-Bestätigung, Token-Hash-Links, Token-Paar-Rückkehr und Passwort-Zurücksetzung bleiben unterstützt. Google-Tokenaustausch, gespeicherte Zustimmung, Einladung und Onboarding-Ziele sind unverändert.

- **Codeprüfung bestanden:** fünf relevante Jest-Suites mit **52 Tests**, TypeScript (`tsc --noEmit`) und ESLint für alle geänderten Quell- und Testdateien.
- **Web-Darstellung geprüft:** tatsächliche gemeinsame React-Native-Web-Komponente bei 390 × 844 und 320 × 568, Ladezustand und abgelaufener Versuch; Rückkehr-Button bedienbar, keine Browser-Laufzeitfehler. Die Vorschau lässt lediglich native Navigations- und Statusleisten aus und nutzt keine Auth-Sitzung.
- Vorschau: [Ladezustand](../output/auth-callback-ui-20261001/loading-390.png), [abgelaufener Versuch](../output/auth-callback-ui-20261001/expired-320.png), [Prüfergebnis](../output/auth-callback-ui-20261001/verification.json).
- **Geräteabnahme dieser Änderung offen:** Die installierten QA-Builds enthalten weiterhin den vorherigen Stand. Es wurde hierfür kein neuer Build erstellt, verteilt oder installiert. Die bisherigen nativen Ergebnisse gelten weiterhin für die oben genannten installierten Versionen.

## Ausgeführte native Fälle (iPhone vor dem Reset, Samsung mit Fortsetzung danach)

| Fall | Android / Google | iPhone / Google | iPhone / Apple |
| --- | --- | --- | --- |
| Provider öffnen | Bestanden: Systembrowser zeigt Google-Anmeldung zum QA-Projekt. | Bestanden: iOS-Systemdialog, danach Google-Kontoauswahl zum QA-Projekt. | Bestanden: natives Apple-Sheet mit vorhandenem Account Jan Zeppenfeld. |
| Abbrechen | Bestanden: Browser über „Tab schließen“ geschlossen. | Bestanden: sowohl iOS-Systemdialog als auch geöffneter Google-Browser abgebrochen. | Bestanden: Apple-Sheet über „Schließen“ geschlossen. |
| Rückkehr nach Abbruch | Bestanden: Login-Seite und aktivierter Google-Button wieder bedienbar. | Bestanden: Login-Seite und Provider-Buttons wieder bedienbar. | Bestanden: Login-Seite zurück; anschließend Google erneut aufrufbar. |
| Erneuter Versuch | Bestanden: Google-Dialog erneut geöffnet. | Bestanden: nach Nutzerkorrektur Jan gewählt; nach Kontowechsel wieder erfolgreich angemeldet. | Bestanden: Apple-Sheet erneut geöffnet und „Anmelden“ betätigt. |
| Vollständiger Provider-Login / erfolgreicher Rücksprung | Nach dem Reset bestanden: neue Google-ID um 19:47:13 UTC, Browser geschlossen und Onboarding sichtbar. Vorheriger Versuch mit belegtem OAuth-Timeout fehlgeschlagen. | Bestanden: Jan um 19:10:26 UTC angemeldet, Browser geschlossen und App-Paywall sichtbar; Backend-Identity `google` an bestehender E-Mail-ID. | Bestanden: Nutzer schloss Face ID ab; neue Apple-Session um 18:50:30 UTC mit bisheriger ID; App kehrte ins Onboarding zurück. |
| App-Neustart nach Provider-Login | Nach dem Reset bestanden: PID 17015 → 28157; Sitzung und neue Jan-ID erhalten. | Bestanden: App beendet und neu gestartet, PID 52754 → 52880; authentifizierte Paywall sichtbar. | Bestanden: App beendet und neu gestartet, PID 52292 → 52754; Sitzung blieb authentifiziert. |
| Reguläres Abmelden und Kontowechsel | Nach dem Reset bestanden: Jan/Google → Ausloggen → Levi/E-Mail → Ausloggen → Jan/Google; beide IDs erhalten. Wechsel zwischen zwei Google-Konten nicht getestet. | Bestanden: Jan/Google → Ausloggen → Levi/E-Mail → Ausloggen → Jan/Google; beide IDs erhalten. Wechsel zwischen zwei Google-Konten nicht getestet. | Bestanden für Apple → anderes E-Mail-Konto: nativer „Ausloggen“-Dialog, Apple-Sessions beendet, anschließend Levi mit bestehender ID angemeldet. Wechsel zwischen zwei Apple-IDs nicht getestet. |

Ein geöffneter Providerdialog oder die Rückkehr nach Abbruch belegt keinen erfolgreichen OAuth-/Apple-Login.

## Abgeschlossener E-Mail→Google-Vergleich vor dem Reset: Jan

Die vom Nutzer neu gewählte Adresse existierte im QA-Backend noch nicht. Vor dem Google-Login wurde ein bestätigtes QA-E-Mail-Konto `jan.niklas.zeppenfeld@gmail.com` mit Profilname „Jan Google QA“ vorbereitet. Die administrative E-Mail-Bestätigung ist Testvorbereitung und belegt keinen nativen Registrierungs-/Mailbestätigungsablauf. Es wurden keine Familienlinks oder Abos für dieses Konto gesetzt.

- Vergleichs-ID vor und nach Google: **`e1c0c591-0e5f-4d38-96d4-74998dd0efb8`**.
- Native E-Mail-/Passwort-Anmeldung am iPhone: **19:08:02.671260 UTC**, anschließend regulär über „Ausloggen“ beendet. Der Passwortmanager wurde mit „Später“ geschlossen.
- Backend-Ausgangsbestand **19:09:19 UTC**: Provider nur `email`; eigenes Baby samt Owner-Mitgliedschaft bereits vorhanden. Keine akzeptierte Partnerverknüpfung, kein aktives Abo.
- Native Google-Anmeldung mit Jan aus der Kontoauswahl: **19:10:26.576843 UTC**. Google fragte nur Name/Profilbild/E-Mail ab. Nach „Weiter“ schloss sich der Browser; LottiBaby zeigte die Paywall für das Konto ohne Abo.
- Danach dieselbe ID mit Providern **`email`, `google`**; Nutzerzahl **8 → 8**, kein Duplikat. Eigene Baby-ID und Mitgliedschaft, vorhandene Kontroll-Familienlinks und Abo-Zuordnungen blieben erhalten.
- App beendet/gestartet: PID **52754 → 52880**. Paywall weiterhin authentifiziert. Der anschließende native Logout beendete die Google-Session dieser ID; die Login-Seite erschien.
- Kontowechsel: Levi/E-Mail erfolgreich **19:13:31.190712 UTC** mit dessen bisheriger ID; regulär abgemeldet; Jan/Google erneut erfolgreich **19:15:10.840067 UTC** mit derselben Vergleichs-ID. Backend-Kontrolle **19:15:19 UTC** und Screenshot der App-Paywall gesichert.
- **Nutzer-ID und eigenes Babyprofil: bestanden. Verknüpfte Familie und aktives Abo: positiver Ausgangszustand fehlt.** Unveränderte Kontroll-Daten ersetzen diesen noch offenen Nachweis nicht.

## Vorheriger Levi-Versuch und E-Mail-Kontowechsel

Die zunächst ausgewählte Levi-Adresse existierte zu Beginn nicht im QA-Backend und wurde als E-Mail-Testkonto vorbereitet. Google verlangte für Levi eine Elternfreigabe. Dieser Versuch wurde nach der Nutzerkorrektur regulär geschlossen; keine Google-Identity für Levi wurde angelegt. Das Konto wurde anschließend als anderes E-Mail-Konto für den nativen Kontowechsel genutzt.

- Bestehende Vergleichs-ID: `2148a8f0-6d29-4d51-bae2-13f66ef70ee3`.
- E-Mail-/Passwort-Anmeldung auf dem iPhone erfolgreich: Backend `last_sign_in_at` **01.10.2026 17:15:48.537298 UTC**, gespeicherte Zustimmung vorhanden. Die App zeigte das Onboarding für das neu vorbereitete Konto.
- Der neu angelegte QA-Profilname wurde für den Vergleich mit einem bestehenden Konto auf „Levi QA“ gesetzt. Vorhandene `user_settings` wurden bei der Vorbereitung nicht geändert. Anschließend erschien im Backend ein eigenes Baby und dessen Owner-Mitgliedschaft für die Test-ID: Baby `d81944a5-1bb8-4c9d-8238-5f122d43725b`, Mitgliedschaft **17:18:56.884657 UTC**. Dies ist Ausgangs-Testdatenbestand, kein Verlustbefund.
- Nach gezieltem Beenden/Starten der E-Mail-Sitzung blieb die App authentifiziert und zeigte weiterhin das Onboarding. Das ist ein E-Mail-Session-Smoke-Test, kein Neustartnachweis nach Google oder Apple.
- Backend-Ausgangsabgleich **17:23:17 UTC** und erneute Kontrolle **19:02:41 UTC**: Test-ID weiterhin nur Provider `email`, noch keine Google-Identity und kein erfolgreich abgeschlossener Google-Login. Kontroll-Auth-Identitäten und bestehende Familienlinks unverändert. Neue Baby-Mitgliedschaft ausschließlich für das vorbereitete Testkonto.
- Das Testkonto besitzt **keine verknüpfte Partnerfamilie und kein aktives Abo**. Ein positiver Erhalt dieser beiden Zustände kann damit noch nicht abgenommen werden. Hierfür wird vor dem Providerwechsel ein geeignetes Konto mit bestehender Familie und aktivem QA-/Sandbox-Abo benötigt; es wurden keine Käufe oder Abo-Freigaben erzeugt.
- Der iOS-Passwortmanager fragte nach Aktualisierung eines gespeicherten Passworts; „Später“ wurde gewählt. Das lokale QA-Passwort wurde nicht dort gespeichert.

## Apple-Fortsetzung und Nachweise

Der Nutzer hat Face ID abgeschlossen. Der Live-Abgleich bestätigt die neue Apple-Anmeldung **18:50:30.058045 UTC** für die bereits vorhandene ID `44344dc2-4b2d-4fd7-b36d-943547f55099` (`jan.zeppenfeld@outlook.com`, Provider weiterhin `apple`). Kein zusätzlicher Apple-Nutzer wurde angelegt. Die App kehrte ins Onboarding zurück; das bestehende QA-Profil hat `first_name = null` und `user_role = null`. Es wurde nicht vervollständigt oder verändert.

Die App wurde über den Testhelfer gezielt beendet und aktiviert. CoreDevice belegt PID **52292 → 52754**; nach dem Start war weiterhin das authentifizierte Onboarding sichtbar. Anschließend wurde die normale Seite „Konto & Daten verwalten“ per App-Deep-Link geöffnet und ausschließlich „Ausloggen“ mit dem nativen Bestätigungsdialog betätigt. Alle Apple-Sessions dieser QA-ID waren danach im Backend beendet (2 → 0); die Login-Seite erschien. Das bestätigt auch die aktive Apple-Identität nach dem Neustart. Der Wechsel zu Levi per E-Mail/Passwort war **18:58:29.972936 UTC** erfolgreich und behielt dessen bestehende ID. Die App zeigte danach die Paywall ohne Abo. Der Passwortmanager wurde erneut mit „Später“ geschlossen.

Der Abgleich **18:58:42 UTC** bestätigt unveränderte Auth-Identitäten, Familienlinks und Baby-Mitgliedschaften gegenüber dem nach der Testvorbereitung gesicherten Ausgangsbestand. Die Abo-Zuordnung (Nutzer, Paid-Subscription-ID, Produkt und Tier) blieb unverändert; laufende Renewal-Zeitstempel sind kein Verlustbefund. Dies ersetzt keinen positiven Providerwechseltest mit aktiver Familie und aktivem Abo. Der mitgeteilte Code wurde weder verwendet noch gespeichert.

Die Samsung-Neuanlage samt Rückkehr, Neustart und App-Kontowechsel ist inzwischen abgeschlossen. Die Elternfreigabe für Levi wurde dafür nicht benötigt; Levi wurde als vorhandenes E-Mail-Konto genutzt.

- Screenshots und Ergebnis-JSON: [`output/social-login-device-qa-20261001/`](../output/social-login-device-qa-20261001/).
- Aktueller Backend-Abgleich: [`current-results.json`](../output/social-login-device-qa-20261001/current-results.json).
- Testvorbereitung: [`email-fixture-preparation.json`](../output/social-login-device-qa-20261001/email-fixture-preparation.json).
- Apple-Login/Neustart/Logout: [`apple-success-and-restart.json`](../output/social-login-device-qa-20261001/apple-success-and-restart.json).
- Jan-Testvorbereitung: [`jan-email-fixture-preparation.json`](../output/social-login-device-qa-20261001/jan-email-fixture-preparation.json).
- Google-Identität/Neustart/Kontowechsel: [`ios-google-jan-identity-and-restart.json`](../output/social-login-device-qa-20261001/ios-google-jan-identity-and-restart.json).
- Samsung-Neuanlage, Timeout und erfolgreicher Neustart/Kontowechsel: [`android-google-success-and-recovery.json`](../output/social-login-device-qa-20261001/android-google-success-and-recovery.json).
- Angeforderter QA-Reset: [`jan-qa-reset.json`](../output/social-login-device-qa-20261001/jan-qa-reset.json).
- Ergebnisstand vor dem Reset: [`results-before-requested-reset.json`](../output/social-login-device-qa-20261001/results-before-requested-reset.json).
- Private UI-Bäume, vollständige Backend-Snapshots, Sessiondaten und QA-Passwort: `.family-qa/social-login-device-qa-20261001/`; keine Tokens/Passwörter im Bericht.

**Ergebnis: Jan-QA-Reset und Neuanlage über Samsung abgeschlossen. Google-/Apple-Login, Abbruch, Rückkehr, Neustart und Wechsel zu einem vorhandenen E-Mail-Konto sind auf den jeweiligen Geräten belegt; beim iPhone zudem Erhalt der bisherigen ID und des eigenen Babys beim E-Mail→Google-Wechsel vor dem Reset. Offen bleiben positiver Erhalt einer verknüpften Familie/eines aktiven Abos, Wechsel zwischen zwei Provider-Konten und die dokumentierten UX-Punkte bei OAuth-Timeout/Google-Zwischenbildschirm.**
