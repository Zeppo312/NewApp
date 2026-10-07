# App-Zugang für Google Reviewer

**Status OFFEN-NUTZER/TECHNIK:** Kein geeignetes Konto aus Schritt 5 vorhanden. Keine Konten angelegt, Rollen gesetzt oder Passwörter gespeichert. Echte Zugangsdaten gehören in die Play Console bzw. einen abgestimmten sicheren Kanal, nicht ins Repository.

Die App bietet E-Mail-/Passwortanmeldung und beschränkt persönliche Funktionen über Onboarding/Paywall. Google benötigt wiederverwendbaren, ortsunabhängigen Zugang einschließlich Bereichen hinter der Paywall. Die Zugangsanleitung soll auf Englisch vorliegen. [Google-Anforderungen](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en).

## Konkreter Kontoplan

| Zugang | Vorbereitung durch Betreiber | Status |
| --- | --- | --- |
| R1 Elternkonto / Baby geboren | Bestätigte E-Mail, dauerhaft gültiges Passwort, abgeschlossenes Onboarding, ausschließlich synthetische Daten, Premium-Funktionszugang ohne Kauf und ohne Adminrechte | OFFEN |
| R2 Schwangerschaft | Separates bestätigtes Konto mit Schwangerschaftsprofil und freigegebenen Funktionen | OFFEN |
| R3 verknüpfte Betreuungsperson | Eigenes bestätigtes Konto, nur mit Testfamilie R1 verknüpft | OFFEN |
| R4 Lösch-/Registrierungstest | Wegwerfkonto oder eigene freigegebene Testadresse; darf vollständig gelöscht werden | OFFEN |

Die Rolle `premium_tester` ist im Client vorgesehen (`lib/paywallAccess.ts`, `lib/subscriptionAccess.ts`). Ihre serverseitige Wirkung für KI/Premium muss mit dem tatsächlich deployten Backend geprüft werden; Schritt 4 ist laut Übergabe noch nicht deployed. Testrolle weder als Adminrolle noch als bezahltes Play-Abo ausgeben. Ein universeller Auth-Bypass oder produktionsweiter Gratiszugang ist nicht vorgesehen.

R1/R2 dürfen weder einen Kauf noch E-Mail-OTP, eine Apple-Anmeldung, ablaufende Einladung oder persönliche Freischaltung während der Review verlangen. Beim normalen Nutzerlogin keine Sicherheitsmaßnahmen global abschalten. Falls der vorhandene Auth-Ablauf das nicht ermöglicht, ausschließlich den Demo-Kontoweg geeignet vorbereiten und erneut prüfen.

## Englisch für „App access“ · Platzhalter vor Übernahme ersetzen

**Instruction name:** Lotti Baby – full demo access

**Username/email:** `[OFFEN: R1 demo email]`

**Password:** `[OFFEN: enter directly in Play Console; do not commit]`

> Lotti Baby is intended for parents and adult caregivers. Personal features require an account and an access entitlement.
>
> 1. Open the app and choose “Anmelden” (Sign in). Use the email and password provided above. Do not create a new account or choose Apple sign-in.
> 2. The demo account has completed onboarding and contains fictional family data. Select the demo baby “Mila Demo”.
> 3. Open the daily overview to add and edit feeding or diaper entries. Open the sleep tracker to start and stop a sleep timer and view previous entries.
> 4. Additional features include the planner, shopping list, milestones, community, “Frag Lotti” (AI assistant), and “Lottis Fürsorge”. The demo entitlement must allow access without a purchase.
> 5. For the pregnancy experience, sign out and use the second account provided in the additional access instructions. For family sharing, use the linked caregiver account.
> 6. App settings contain support, privacy information and data deletion. Use only the separate disposable account for a completed deletion test, so the main review credentials remain available.
>
> These are ordinary app features using fictional demo data. No real purchase is required for reviewing entitled functionality. Purchases and subscription management are separate flows.

**Vor Eintragung bestätigen:** Anleitung beschreibt den vorzubereitenden Zustand. Erst nach erfolgreicher Prüfung ergänzen: “These credentials are reusable, do not expire during review, work from any location, and do not require an OTP or manual approval.” Gegenwärtig ist dieser Satz **nicht belegt**.

Zusätzliche Anleitungen mit R2/R3/R4 und deren tatsächlichen Daten in der Console hinterlegen. Falls ein QR-Code zum Einstieg nötig ist, wiederverwendbares, zugängliches Material mit stabiler URL bereitstellen; temporäre Aufpasser-QRs nicht als einzigen Vollzugang einsetzen.

## Probe vor Einreichung

Frische Installation des signierten Release-Builds → R1 anmelden → kein Onboarding-/Paywall-Stillstand → Eintrag speichern/ändern → Neustart → KI serverseitig aufrufen → R3 sieht nur Freigaben → R2 sieht Schwangerschaft → Support-/Datenschutz-/Löschweg erreichbar. R4 löschen und Neuanmeldung verweigert. Kein echtes Kundenkonto und keine kostenpflichtige Bestellung verwenden.

Pro Konto intern notieren: zuständige Person, letzter erfolgreicher Login, Android-Build/Datum, freigegebene Funktionen, Wiederherstellungsweg. Zugang während der gesamten Prüfung funktionsfähig halten. Käufe mit Lizenztestern in Schritt 11 separat testen; ein Premiumtester beweist keinen funktionierenden Play-Kauf.
