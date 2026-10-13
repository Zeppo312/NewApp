# Google-Branding – Einrichtung 01.10.2026, Geräteprüfung 02.10.2026

Projekt: **Lotti Baby Billing**, `lotti-baby-billing-2026`.

Aktueller Stand: **Branding vorbereitet, eingereicht, von Google verifiziert und veröffentlicht.** Die OAuth-App steht nach ausdrücklicher Nutzerfreigabe auf „In Produktion“. Die frische sichtbare Google-Anmeldung wurde am 02.10.2026 auf Samsung und iPhone bestätigt. Beide Nachweise stammen aus den installierten QA-Builds. **Im separaten iOS-Systemdialog bleibt die technische QA-Supabase-Domain sichtbar.**

| Stufe | Status | Beleg |
| --- | --- | --- |
| Vorbereitet / gespeichert | Erledigt | Name, offizielles Logo, Kontakte und alle Website-Links gespeichert |
| Eingereicht | Erledigt | „Branding überprüfen“ gestartet; „Verification in progress…“ aufgezeichnet |
| Marke verifiziert | Erledigt | „Ihr Branding wurde überprüft, wird Nutzern aber noch nicht angezeigt“ |
| Branding veröffentlicht | Erledigt | „Ihr Branding wurde überprüft und wird Nutzern angezeigt“ |
| Samsung bestätigt | Erledigt, QA-Build | Google zeigt offizielles Logo und „Weiter zu LottiBaby“ |
| iPhone bestätigt | Erledigt, QA-Build | Google zeigt offizielles Logo und „Weiter zu LottiBaby“ |

## Live geprüfter Ausgangsstand

- Google Auth Platform enthielt „Lotti Baby“, Support- und Entwicklerkontakt `anyhelptoolate@gmail.com`, Startseite und Datenschutzerklärung. Logo und Nutzungsbedingungen fehlten.
- Zielgruppe „Extern“, Veröffentlichungsstatus „Test“, keine Testnutzer eingetragen. Überprüfungscenter und Branding-Seite erklärten, dass im Teststatus keine Überprüfung erforderlich sei; kein Verifizierungsknopf war vorhanden.
- Ein bestehender Web-Client: „Lotti Baby – Supabase Google Login“.
- Eigene Backend-Projekte für Produktion und QA, mit beiden Callbacks im selben Google-Web-Client:
  - Produktion: `https://kwniiyayhzgjfqjsjcfu.supabase.co/auth/v1/callback`
  - QA: `https://ggyonianphloycmqrwvj.supabase.co/auth/v1/callback`
- Bestehende autorisierte Domains: beide Supabase-Projektdomains und `lottibaby.de`.
- Nicht vertrauliche Scopes: `openid`, `userinfo.email`, `userinfo.profile`. Keine vertraulichen oder eingeschränkten Scopes.
- Öffentliche Website und Datenschutz-URL erreichbar. Datenschutz enthielt bisher Apple-SSO und generische SSO-Angaben, jedoch keinen ausdrücklichen Google-Anmeldeabschnitt.
- `/agb` beschreibt ausschließlich Shop-Bestellungen. `/nutzungsbedingungen` lieferte HTTP 404.

## Erledigt

- Anwendungsname auf **LottiBaby** gesetzt und gespeichert.
- Offizielles Logo aus `assets/images/icon.png` hochgeladen. Die Datei ist bytegleich mit der bestehenden Store-Quelle `docs/android-play/store/material/source/icon-1024-source.png`: 1024 × 1024 Pixel, PNG, etwa 322 KB, damit innerhalb Googles 1-MB-Grenze. Kein neues Logo erzeugt.
- Supportkontakt geprüft: Google bot ausschließlich `anyhelptoolate@gmail.com` zur Auswahl an. Diese bestehende Adresse sowie der Entwicklerkontakt wurden erhalten. Die öffentliche Website nennt weiterhin `support@lottibaby.de`. Keine Gruppen- oder IAM-Berechtigungen angelegt.
- `lottibaby.de` im verwendeten Google-Konto in Search Console als Domain-Property angelegt. Zusätzlichen TXT-Eintrag über die vorhandene Hostinger-Sitzung gespeichert. Google zeigte **„Inhaberschaft automatisch bestätigt“**. Bestehender SPF-Eintrag und bisheriger Google-Verifikationseintrag erhalten. DNS-Propagation kann zwischen Nameservern zeitversetzt erfolgen.
- Aktuelle `datenschutz.php` vollständig über den Website-Editor gesichert. Ausschließlich die vorhandenen Google-Anmeldeabschnitte aus `lib/appPrivacySections.json` samt Inhaltsübersicht in Deutsch, Englisch und Spanisch ergänzt: 27 zusätzliche Zeilen, keine entfernten Zeilen. Kontolöschungsbereich und übriger Website-Inhalt erhalten.
- Ergänzte Datenschutzdatei gespeichert. Alle drei öffentlichen Sprach-URLs liefern HTTP 200 und enthalten sämtliche drei jeweiligen Google-Absätze. Bestehender Kontolöschungsbereich ebenfalls live bestätigt.
- Bestehende deutsche App-Nutzungsbedingungen aus `app/nutzungsbedingungen.tsx` ohne inhaltliche Änderungen als HTML veröffentlicht: **https://lottibaby.de/nutzungsbedingungen.html**. Alle 13 Abschnitte und der Stand 26. August 2026 enthalten. Öffentliches HTTP 200 und Bytegleichheit mit dem vorbereiteten HTML bestätigt.
- Die neue öffentliche Nutzungsbedingungen-URL in Google Auth Platform hinterlegt und gespeichert. Startseite `https://lottibaby.de/` und Datenschutz `https://lottibaby.de/datenschutz?lang=de` erhalten.

Keine OAuth-Clients erstellt, gelöscht oder bearbeitet; keine Redirects, Scopes, Provider, QA-/Produktions-Backends oder Anmeldeberechtigungen geändert. Keine Custom Domain oder kostenpflichtige Funktion aktiviert. Keine Zugangsdaten im Repository gespeichert. Kein App-Build, OTA oder Store-Release durchgeführt.

## Freigabe und Veröffentlichung

Google dokumentiert die Reihenfolge **OAuth-App in Produktion → Branding verifizieren → erfolgreiches Ergebnis → Branding veröffentlichen**. Änderungen des Brandings allein starten diese Prüfung nicht. Der Statuswechsel der OAuth-App betrifft hier das gemeinsame Google-Projekt mit Produktions- und QA-Callback.

Der Nutzer hatte Änderungen an Anmeldeberechtigungen ausgeschlossen und Veröffentlichung erst nach erfolgreicher Prüfung verlangt. Die konkrete Freigabe zum erforderlichen vorherigen Statuswechsel wurde angefragt und mit „Ja“ erteilt. Der Statuswechsel ist live bestätigt. Anschließend wurde „Branding überprüfen“ betätigt. Google zeigte zunächst „Verification in progress…“ mit bis zu fünf Minuten. Die automatische Prüfung war erfolgreich. Danach wurde „Branding veröffentlichen“ betätigt; Google bestätigte ausdrücklich „Ihr Branding wurde überprüft und wird Nutzern angezeigt“.

Die bisherigen Callbacks und alle drei nicht vertraulichen Scopes wurden nach Veröffentlichung nochmals live gelesen und bestätigt. Die Website-Domain ist verifiziert; die automatische Markenprüfung verlangte keinen weiteren manuellen Google-Schritt.

## Geräteprüfung nach Veröffentlichung – 02.10.2026

Der Nutzer hat die konkrete App-Zustimmung für diesen QA-Test und die Bedienung über den vorhandenen Appium-Testhelfer ausdrücklich freigegeben. Die frischen Google-Browser wurden aus den installierten nativen Apps geöffnet. Screenshots wurden unverändert gespeichert und visuell geprüft.

| Gerät / installierte Version | Google-Kontoauswahl | Browseradresse | Separater Systemdialog |
| --- | --- | --- | --- |
| Samsung SM-A528B, 1.0.23, VersionCode 20 | Offizielles Logo, „Weiter zu LottiBaby“, Links zu Datenschutz und Nutzungsbedingungen | `accounts.google.com` | Kein entsprechender iOS-Dialog |
| iPhone 16 Pro, 1.0.24 (1.0.76) | Offizielles Logo, „Weiter zu LottiBaby“ | `accounts.google.com` | „LottiBaby“ möchte zum Anmelden `ggyonianphloycmqrwvj.supabase.co` verwenden |

**Ergebnis:** Die Supabase-Projektkennung wird auf der geöffneten Google-Kontoauswahl beider Geräte durch „LottiBaby“ samt offiziellem Logo ersetzt. Die Markenprüfung und Veröffentlichung sind damit auch visuell auf beiden Geräten bestätigt. Der separate iOS-Systemdialog verwendet weiterhin die technische Supabase-Projektdomain; er ist in einem eigenen Screenshot dokumentiert. Diese Anzeige wurde durch das Google-Branding nicht verändert.

- Die geprüften Geräte verwenden QA. Beim iPhone ist das QA-Ziel im frisch geöffneten Systemdialog ausdrücklich sichtbar. Beim Samsung sind VersionCode 20 und unveränderte Installationszeit live bestätigt; dieser Build wurde bereits in der vorherigen QA-Geräteabnahme dem QA-Backend zugeordnet. Zusätzlich enthält die frisch vom Gerät gelesene installierte APK weiterhin den QA-Supabase-Host im JS-Bundle. Die vorhandene Trennung der Backends bleibt erhalten.
- Ein Google-Web-Client bedient unverändert Produktions- und QA-Callback. Die Screenshots bestätigen das veröffentlichte Branding dieses Clients über die QA-Apps; eine separate Anmeldung aus einem Produktions-Build wurde hier nicht durchgeführt.
- Für die sichtbare Branding-Prüfung wurde kein Google-Konto ausgewählt und kein vollständiger Login abgeschlossen. Es wurden keine neuen Google-Berechtigungen erteilt. Beide Google-Browser wurden anschließend regulär geschlossen; die native Login-Seite und der aktivierte Google-Button waren wieder sichtbar.
- Keine weitere manuelle Voraussetzung für Googles Markenprüfung oder Veröffentlichung offen. Keine Custom Domain, App-Veröffentlichung, OTA oder Änderung der Anmelde-Scopes durchgeführt.

Die älteren Bilder in `output/social-login-device-qa-20261001/` wurden nicht als Nachweis nach der Branding-Veröffentlichung verwendet.

| Samsung nach Veröffentlichung | iPhone nach Veröffentlichung |
| --- | --- |
| ![Samsung: LottiBaby mit offiziellem Logo](../output/google-branding-20261002/samsung-google-account-picker.png) | ![iPhone: LottiBaby mit offiziellem Logo](../output/google-branding-20261002/iphone-google-account-picker.png) |

[Separater iOS-Systemdialog mit QA-Supabase-Domain](../output/google-branding-20261002/iphone-system-auth-domain.png).

## Dateien und Nachweise

- [Geräteergebnisse und Grenzen der Abnahme](../output/google-branding-20261002/device-results.json)
- [Veröffentlichung am 02.10. nochmals live bestätigt](../output/google-branding-20261002/branding-published-live.jpg)

- [Gespeicherter Name und offizielles Logo](../output/google-branding-20261001/branding-name-logo-saved.jpg)
- [Gespeicherte Branding-Links und Teststatus](../output/google-branding-20261001/branding-links-saved.jpg)
- [Erfolgreiche Domain-Bestätigung](../output/google-branding-20261001/domain-verified.jpg)
- [OAuth-App in Produktion](../output/google-branding-20261001/audience-in-production.jpg)
- [Gestartete Markenprüfung](../output/google-branding-20261001/branding-verification-in-progress.jpg)
- [Marke verifiziert, bereit zur Veröffentlichung](../output/google-branding-20261001/branding-verified-ready-to-publish.jpg)
- [Branding veröffentlicht](../output/google-branding-20261001/branding-published.jpg)
- [Früherer Teststatus](../output/google-branding-20261001/audience-still-testing.jpg)
- [Scopes nach Veröffentlichung unverändert](../output/google-branding-20261001/scopes-after-publication.jpg)
- [Client, Callbacks und Scopes nach Veröffentlichung](../output/google-branding-20261001/oauth-invariants-after-publication.json)
- [Öffentliche App-Nutzungsbedingungen](../output/google-branding-20261001/terms-published.jpg)
- [Website-Prüfung](../output/google-branding-20261001/website-live-verification.json)
- [Alle Google-Datenschutzabsätze live geprüft](../output/google-branding-20261001/privacy-live-verification.json)
- [Gesichertes Website-Original](../output/google-branding-20261001/original/datenschutz.php)
- [Datenschutzergänzung als Diff](../output/google-branding-20261001/privacy-google.patch)
- [Vorbereitungsskript](../output/google-branding-20261001/prepare-website.mjs)

Der Google-DNS-Bestätigungswert liegt ausschließlich im privaten Konfigurationsordner außerhalb des Repositorys, mit Dateirechten `600`.

Offizielle Quellen: [Google: Markenprüfung und Veröffentlichung](https://developers.google.com/identity/verification/authentication-verification), [Google: OAuth-Voraussetzungen und getrennte Projekte](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance), [Supabase: Google-Anmeldung und Branding](https://supabase.com/docs/guides/auth/social-login/auth-google).
