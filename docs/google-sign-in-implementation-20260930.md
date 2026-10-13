# Google Sign-in: Umsetzung und verbleibende Einrichtung

Stand: 30.09.2026. Die App-Integration ist im aktuellen Checkout umgesetzt und der Google-Provider im Produktions-Backend eingerichtet und aktiviert. Der neue OAuth-Client liegt im Google-Konto für die Android-Veröffentlichung. **Die vollständige Anmeldung und Browserrückkehr auf Android/iPhone sind noch nicht abgenommen; es wurde kein App-Update veröffentlicht.**


> Ergänzung 01.10.2026: Auch QA-Google ist eingerichtet. Die isoliert zusammengeführte Google-/Retry-Quelle wurde als iOS 1.0.24 (1.0.74) gebaut, geprüft und für bestehende interne TestFlight-Tester bereitgestellt. Native Anmeldung bleibt offen. [Aktueller Nachweis](ios-google-qa-20261001.md).

## Umgesetzt

- „Mit Google anmelden“ auf der Login-/Registrierungsseite, mit Original-Google-Logo und Texten auf Deutsch, Englisch und Spanisch.
- Supabase OAuth mit bestehendem PKCE und Systembrowser. Keine neue native Google-Sign-in-Abhängigkeit erforderlich.
- Eigener Callback `app/auth/google-callback.tsx`. Der bisherige E-Mail-/OTP-/Recovery-Callback bleibt bestehen.
- Ein gemeinsamer Code-Austausch für Browser-Ergebnis und Deep Link; Prüfung von Rücksprungadresse, lokalem Anmeldeversuch und Ablaufzeit. Abbruch und Fehler erlauben einen erneuten Versuch.
- Zustimmung, Registrierungsabsicht und Einladungscode bleiben im lokalen Speicher über den Browserwechsel erhalten. Zustimmung wird für die tatsächliche Nutzer-ID gespeichert; URL-Parameter können keine Zustimmung erzeugen. Eine alte Zustimmungsversion wird nicht als Zustimmung zur aktuellen Version verbucht.
- Bestehende Auth-/RevenueCat-Zuordnung verwendet weiterhin die Supabase-Nutzer-ID. Anmeldung wartet auf laufende Abmeldung und lokale Datenbereinigung; Abmeldung verwirft offene Google-Versuche.
- Weiterleitung zu Onboarding, Familienverknüpfung oder Root-Router anhand der vorhandenen gemeinsamen Onboarding-Prüfung.
- Verständlicher E-Mail-Fallback, solange Google im jeweiligen Backend deaktiviert ist.
- Datenschutzquelle und daraus erzeugte App-/Website-HTML-Dateien auf Deutsch, Englisch und Spanisch ergänzt. Diese Dateien wurden lokal aktualisiert; eine Website-Veröffentlichung wurde nicht durchgeführt.
- Einrichtungsskript `scripts/configure-google-auth.mjs`: liest ein heruntergeladenes Web-OAuth-JSON, prüft den projektspezifischen Google-Callback, erhält bestehende Allowlist-Einträge und aktualisiert ausschließlich Google-Provider und Redirect-Allowlist. Secrets werden weder gedruckt noch ins Repository kopiert.

## Verifizierter Backend-Stand

Nach Einrichtung über die Management API am 30.09.2026 geprüft; öffentliche Settings- und OAuth-Weiterleitungsprüfung um 21:59 Uhr Europe/Berlin:

| Einstellung | Produktion `kwniiyayhzgjfqjsjcfu` |
| --- | --- |
| Google aktiviert | Ja |
| Client-ID vorhanden | Ja |
| Client-Secret vorhanden | Ja |
| Eigener Google-App-Callback erlaubt | Ja |
| Apple aktiviert | Ja, bestehende Konfiguration unverändert |

Der öffentliche Settings-Endpunkt liefert HTTP 200 mit Google und Apple aktiviert. Der OAuth-Einstieg mit PKCE und dem nativen Google-App-Callback liefert HTTP 302 zu `accounts.google.com`, mit der Client-ID aus der heruntergeladenen Datei und dem korrekten Supabase-Callback. Die angeforderten Berechtigungen entsprechen ausschließlich `openid`, E-Mail und Profil. Es wurde dabei keine Google-Nutzeranmeldung abgeschlossen oder ein Testkonto erstellt. Statusnachweis ohne Secrets: `output/google-oauth-setup-20260930/backend-verification.json`.

Die Apple-Provider-Felder und vorhandenen Redirect-Einträge wurden vor und nach der Einrichtung verglichen und sind erhalten geblieben. Die wiederholte identische Provider-Konfiguration hat keine weiteren Konfigurationsfelder geändert.

### Abgeschlossene Google-Cloud-Einrichtung

Der Nutzer hat die Suche und das lokale Speichern der JSON-Datei an Codex übergeben und vorgegeben, dafür dasselbe Google-Konto wie für die Android-Veröffentlichung zu verwenden.

- In Google Play Console bestätigt: `anyhelptoolate@gmail.com`, Entwicklerkonto „Lotti Baby“, App `com.LottiBaby.app` (interner Test).
- Verwendetes vorhandenes Cloud-Projekt: „Lotti Baby Billing“, ID `lotti-baby-billing-2026`. Darin war Google Auth Platform noch nicht konfiguriert; ein herunterladbarer Google-Login-Web-Client wurde dort nicht gefunden.
- Nach ausdrücklicher Bestätigung des Nutzers die Richtlinie zu Nutzerdaten für Google API-Dienste angenommen und die OAuth-Projektkonfiguration erstellt: App „Lotti Baby“, Support-/Kontaktadresse des Veröffentlichungskontos, externe Zielgruppe im Testmodus.
- Nach eigener ausdrücklicher Bestätigung des Nutzers den Web-Client „Lotti Baby – Supabase Google Login“ erstellt, dessen echte JSON-Datei bei Google heruntergeladen und außerhalb des Repositorys unter `/Users/janzeppenfeld/.config/lottibaby/google-oauth-client.json` gesichert. Verzeichnisrechte `700`, Dateirechte `600`; die Datei enthält den richtigen Projektbezug und Callback sowie das echte Client-Secret. Kein Secret wurde im Chat oder Repository ausgegeben.
- Die zuvor gespeicherte `.pending.json` war nur eine leere Vorlage und wurde nach Sicherung der echten Datei entfernt; für die Einrichtung wurde ausschließlich der echte Google-Download verwendet. Der Originaldownload wurde ebenfalls aus Downloads in den privaten Ordner verschoben und hat Dateirechte `600`.
- Google Auth Platform: die drei nicht vertraulichen Bereiche `openid`, `userinfo.email` und `userinfo.profile` gespeichert; keine vertraulichen oder eingeschränkten Bereiche hinzugefügt.
- Branding mit App-Name „Lotti Baby“, Support-/Entwicklerkontakt des Veröffentlichungskontos, Startseite `https://lottibaby.de/`, Datenschutzerklärung `https://lottibaby.de/datenschutz?lang=de` und autorisierter Domain `lottibaby.de` gespeichert. Kein Logo und keine Markenprüfung eingereicht.
- Supabase auf den neuen Client aus dem Veröffentlichungskonto umgestellt, das Secret hinterlegt, Google aktiviert und den nativen Google-Callback erlaubt. Apple bleibt vorhanden und aktiviert.

Die Google-Zielgruppe bleibt „Extern“, Veröffentlichungsstatus „Test“. Google dokumentiert für reine Anmeldung mit `openid`, E-Mail und Profil eine Ausnahme von Testnutzerliste, Warnung und siebentägiger Autorisierungsdauer. Diese Ausnahme gilt nicht bei zusätzlichen Scopes. Vor öffentlicher App-Freigabe den Veröffentlichungsstatus und das Branding abschließend abnehmen. [Google: App-Zielgruppe](https://support.google.com/cloud/answer/15549945?hl=en).

## Einrichtung wiederholen oder anderes Backend vorbereiten

Der Client ist in [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients?authuser=1&project=lotti-baby-billing-2026) vorhanden. Für diesen Systembrowser-Ablauf wird ein Web-Client benötigt, auch wenn die App auf Android/iOS läuft. Sein eingetragener Google-Callback lautet:

   ```text
   https://kwniiyayhzgjfqjsjcfu.supabase.co/auth/v1/callback
   ```

Die gesicherte JSON-Datei für eine Wiederholung verwenden. Kein Secret in Chat, Git oder `EXPO_PUBLIC_*` eintragen. Bei einem anderen QA-Supabase-Projekt zuerst dessen eigene Callback-Adresse im Google-Client hinterlegen und dessen Provider separat konfigurieren.

Die Google-Callback-Adresse oben führt zu Supabase. Supabase leitet anschließend zur App zurück. Die benötigte native Allowlist lautet:

```text
com.lottibaby.app://auth/google-callback?attempt=*
```

Die erfolgte Einrichtung ist mit dem vorbereiteten Skript wiederholbar:

```sh
node scripts/configure-google-auth.mjs --apply \
  --project-ref kwniiyayhzgjfqjsjcfu \
  --credentials-file /Users/janzeppenfeld/.config/lottibaby/google-oauth-client.json
```

Lesende Bereitschaftsprüfung:

```sh
node scripts/configure-google-auth.mjs --check --project-ref kwniiyayhzgjfqjsjcfu
```

Die Prüfung gibt nur Statuswerte aus. Exitcode 2 bedeutet unvollständige Einrichtung. Für angebotenen Web-Login zusätzlich die tatsächliche Web-Origin über `--web-origin https://…` erlauben und den Browser-Callback gesondert testen.

## Durchgeführte Prüfungen

- **87 Jest-Tests in 13 relevanten Suites bestanden:** Google-OAuth, Callback, Login-Oberfläche, Auth-/Logout-Lifecycle, bestehender Auth-Kaltstart und AppState-Refresh, Einladungen, Android-Tastatur, Onboarding, Zustimmung und Übersetzungen.
- **4 Einrichtungsskript-Tests bestanden:** Web-Client-/Projektprüfung, Erhalt anderer Einstellungen, wiederholte Einrichtung und erlaubte Web-Origin.
- Zusätzlich die Koexistenz von Google und Apple auf iOS sowie deren getrennte Anmeldehandler geprüft: alle 5 Tests in `login-google.test.tsx` bestanden. Der vorhandene Apple-Button wurde nicht ersetzt; er wird wie zuvor nur auf iOS angezeigt.
- Nach Provider-Einrichtung erneut Einrichtungsskript-Tests und `npm run typecheck` bestanden; tatsächlicher Google-OAuth-Weiterleitungstest und lesende Provider-Bereitschaftsprüfung bestanden.
- `npm run typecheck` bestanden, einschließlich Testdateien.
- Gezieltes ESLint für neue Google-Dateien, Login, Übersetzungen, Einrichtungsskript und neue Tests bestanden.
- `node scripts/sync-app-privacy.mjs --check` bestanden; HTML und gemeinsame Datenschutzquelle stimmen überein.
- Web-Login-Seite lokal gebündelt und visuell geprüft; Google-Button vorhanden und ohne Zustimmung deaktiviert.
- Android- und iOS-Produktions-JavaScript-Bundles mit Expo erfolgreich exportiert, einschließlich Google-Logo (`expo export --platform android/ios --no-bytecode`). Dies ist keine APK-/IPA-/Store-/Geräteabnahme.

## Vor Freigabe noch erforderlich

- Echten Google-Login auf Android und iPhone in passenden nativen Testbuilds durchführen: Browserrückkehr, Abbruch/erneuter Versuch, App-Neustart, Zustimmung und Familieneinladung.
- Bei bestätigtem E-Mail-Konto mit derselben Google-Adresse die bestehende Nutzer-ID, Daten, Familienzuordnung und RevenueCat-Zuordnung nachweisen. Eine andere Adresse, insbesondere Apple-Relay, nicht automatisch zusammenführen. [Supabase Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
- Kontowechsel und E-Mail-OTP-Kontolöschung mit einem isolierten Google-Testkonto prüfen.
- Google-Zielgruppe/Produktionsstatus und benötigte Store-/Preview-Verteilung abnehmen. Aktuell wurde weder ein Store-Build noch ein OTA-Update veröffentlicht.
- Die lokal ergänzte Datenschutzerklärung zur optionalen Google-Anmeldung vor öffentlicher Freigabe auf der Website veröffentlichen; die hinterlegte öffentliche URL ist erreichbar, enthält aktuell jedoch noch den bisherigen Stand vom 11.09.2026.

Android setzt Google-Login nicht voraus; Passwörter, Passkeys und Google sind unterschiedliche Anmeldeoptionen. [Android Credential Manager](https://developer.android.com/identity/credential-manager). Die Implementierung folgt dem [Supabase-Google-OAuth-Ablauf](https://supabase.com/docs/guides/auth/social-login/auth-google) mit [Expo WebBrowser für SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/).
