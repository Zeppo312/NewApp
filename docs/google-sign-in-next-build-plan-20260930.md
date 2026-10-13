# Nächster QA-Build und Google-Anmeldung

Stand: 30.09.2026, Europe/Berlin. Auftrag: offene Google-Anmeldung testen und den nächsten Build 30 Minuten nach dem Expo-Kontingent-Reset vorbereiten.

> Fortsetzung am 01.10.2026: Verwendung des vorhandenen Originaldownloads vom Nutzer bestätigt. QA-Callback gespeichert, QA-Google eingerichtet, gemeinsame Quelle geprüft. iOS 1.0.24 (1.0.74) ist für bestehende interne TestFlight-Tester verfügbar; der einmalige Folgeauftrag ist beendet. [Aktueller Build- und Abnahmestand](ios-google-qa-20261001.md).

## Zeitpunkt und Auftrag

Die angemeldete Expo-Organisation ist `janzeppi`, Tarif Free, Projekt `d7120520-e4ff-4967-a797-627a2cb3680b` / LottiBaby. Live geprüft mit der installierten EAS CLI über `eas account:usage janzeppi --json --non-interactive`:

| Angabe | Verifizierter Stand |
| --- | --- |
| Aktuelles Abrechnungsfenster | 01.09.2026 00:00 UTC bis 01.10.2026 00:00 UTC |
| Reset in Deutschland | **Donnerstag, 01.10.2026, 02:00 Uhr MESZ** |
| Gewünschter Start | **01.10.2026, 02:30 Uhr MESZ** (00:30 UTC) |
| iOS im laufenden Fenster | 15 von 15 Builds verbraucht |
| Android im laufenden Fenster | 13 von 15 Builds verbraucht |
| Gleichzeitige Builds | 1 insgesamt |

Der bestehende einmalige Folgeauftrag `lotti-ios-qa-nach-kontingent-reset` im Chat „Release-Readiness herstellen“ wird für diesen Ablauf verwendet. Er war zuvor für 03:00 Uhr vorgesehen. Um 02:30 Uhr beginnt die Prüfung und Vorbereitung; der EAS-Build kann erst nach erfüllten Voraussetzungen und entsprechend der Warteschlange starten. Codex und der Mac müssen für die lokale Ausführung verfügbar sein. Vor dem Start das neue Kontingent erneut live prüfen.

## Bereits nachgewiesen

- Google ist im Produktions-Backend `kwniiyayhzgjfqjsjcfu` eingerichtet. Die öffentliche OAuth-Weiterleitung funktioniert; ein vollständiger Nutzerlogin wurde damit noch nicht nachgewiesen.
- Google-Integration: 87 relevante Jest-Tests in 13 Suites, 4 Einrichtungsskript-Tests, Typechecks, gezieltes ESLint und Datenschutz-Synchronisierung bestanden. Zusätzlich 5 Login-Tests einschließlich getrennter Apple-/Google-Handler bestanden.
- Android- und iOS-JavaScript-Exports bestanden. Das ersetzt weder einen nativen Build noch die Anmeldung auf einem Gerät.
- Apple bleibt auf iOS als eigener Button bestehen; Google wurde zusätzlich eingebaut. Apple war nach der Produktions-Provider-Einrichtung weiterhin aktiviert.
- Bestehende native QA-Builds enthalten die neue Google-Anmeldung noch nicht. Android 17 und iOS 70 sind die zuletzt gefundenen fertigen QA-Artefakte.

## 1. QA-Backend vorbereiten

Lesende Prüfung am 30.09.2026 mit `node scripts/configure-google-auth.mjs --check --project-ref ggyonianphloycmqrwvj`: Google deaktiviert, Client-ID vorhanden, Secret fehlt, nativer Callback fehlt. Ein Google-Test gegen dieses Backend ist derzeit nicht möglich.

1. Im vorhandenen Google-Web-Client im Projekt „Lotti Baby Billing“ (`lotti-baby-billing-2026`, Veröffentlichungskonto `anyhelptoolate@gmail.com`) zusätzlich `https://ggyonianphloycmqrwvj.supabase.co/auth/v1/callback` erlauben. Produktions-Callback und vorhandenen Client erhalten.
2. Autorisierte Anpassung vom 01.10.: Den vorhandenen echten Download privat unter `/Users/janzeppenfeld/.config/lottibaby/google-oauth-client.json` mit Dateirechten `600` unverändert verwenden. Google erlaubt keinen erneuten Download des bestehenden Secrets. Den bei Google gespeicherten QA-Callback stattdessen separat nach erneutem Öffnen bestätigen und einen aktuellen, an Client-ID/Projekt/Callback gebundenen Console-Nachweis mit `--callback-verification-file` übergeben. Kein Secret rotieren.
3. Mit `scripts/configure-google-auth.mjs --apply --project-ref ggyonianphloycmqrwvj --credentials-file <private Datei>` ausschließlich den QA-Google-Provider und die Redirect-Allowlist einrichten. Kein Secret in Git, Logs oder `EXPO_PUBLIC_*` übernehmen. Andere Provider/Redirects erhalten.
4. Danach `--check` und die tatsächliche öffentliche OAuth-Weiterleitung mit PKCE gegen QA prüfen: richtige Client-ID, QA-Supabase-Callback, eigener App-Callback und ausschließlich OpenID/E-Mail/Profil. Statuswerte ohne Secrets festhalten.

Falls Anmeldung bei Google oder eine erforderliche Nutzeraktion verhindert, diese Voraussetzung zu erfüllen, den konkreten Blocker melden. Keinen Build als Google-testbereit ausgeben, solange diese Prüfung fehlt.

## 2. Gemeinsame Buildquelle herstellen

Die persistierte, bereits geprüfte Retry-Quelle wird über `.family-qa/renewal60/retry-source-path.txt` und `output/release-readiness-20260929/retry-build-source.json` gefunden. Sie enthält den zusätzlichen Fix in `hooks/use-paywall-session-gate.ts`, aber noch keine Google-Integration. Der Hook entspricht aktuell dem Stand im Haupt-Checkout.

Die Google-Änderungen sind für die Zusammenführung zusätzlich unter `output/google-next-build-20260930/google-source/` gesichert. `source-manifest.json` enthält SHA-256-Werte und eine Einteilung in neue Dateien und Änderungen gegenüber dem vor Google gesicherten Stand. `google-changes.patch` enthält nur die Differenzen der gemeinsam bearbeiteten Dateien. Diese Dateien sind Vorlagen für eine geprüfte Zusammenführung, keine freigegebene vollständige Buildquelle.

1. Eine neue isolierte Kopie der geprüften Retry-Quelle erstellen; die alte Quelle und frühere QA-Artefakte erhalten.
2. Die gesicherten Google-Änderungen gezielt zusammenführen. Betroffen sind insbesondere Login, AuthContext, Supabase-Client, Router, Übersetzungen und Datenschutzquelle; neu kommen Google-Auth-Helfer, Google-Callback, Logo, Einrichtungsskript und die Google-Tests hinzu. Gemeinsam bearbeitete Dateien nicht pauschal ersetzen. Der Haupt-Checkout enthält weitere offene Arbeiten.
3. QA-Backend, QA-Runtime, deaktivierte OTA-Updates, Store-Schlüssel und den Retry-Hook-Fix erhalten. Native iOS-/Android-Konfiguration gesondert prüfen; die dynamische Expo-Konfiguration allein ist kein Nachweis für bereits vorhandene native Projekte.
4. Hash-Manifest für die endgültige Quelle speichern. Typechecks, Google-/Callback-/Auth-Lifecycle-/Apple-Koexistenz-Tests sowie die betroffenen Retry-/Paywall-Tests in dieser Quelle ausführen. Beide JS-Bundles exportieren; Datenschutz-Synchronisierung und Build-Isolierung prüfen.

Erst diese erfolgreich geprüfte gemeinsame Quelle darf gebaut werden. Bei Merge- oder Testfehlern korrigieren und gezielt erneut prüfen; kein Rückfall auf den alten Stand ohne Google.

## 3. iOS bauen und für TestFlight bereitstellen

1. Um 02:30 Uhr die Voraussetzungen oben und das erneuerte Free-Kontingent prüfen. Über EAS kontrollieren, ob bereits ein passender Build der endgültigen Quelle existiert. Falls ja, weiterverwenden und keinen doppelten Auftrag starten.
2. Aus der isolierten Quelle mit `EAS_NO_VCS=1`, `EAS_PROJECT_ROOT=<absoluter Pfad der isolierten Quelle>` und Profil `family-qa-ios` bauen. Archivwurzel und bytegleiche Dateien zuvor mit `eas build:inspect --stage archive` prüfen. Versions-/Buildnummer durch EAS vergeben lassen; keinen konkreten nächsten Wert vorab behaupten.
3. IPA herunterladen und mit dem Metadatensatz vergleichen: Signatur, Bundle-ID `com.LottiBaby.app`, QA-Backend `ggyonianphloycmqrwvj`, QA-Runtime, OTA deaktiviert, richtige öffentliche Store-Konfiguration, keine privaten Schlüssel/Secrets. Den vorhandenen Artefaktprüfer auf die tatsächlich vergebenen Dateinamen und Buildnummern anpassen; dessen alte iOS-70-Pfade nicht blind verwenden.
4. Das verifizierte IPA an TestFlight übermitteln; Verarbeitung und Verfügbarkeit für die bestehenden QA-Tester separat prüfen. Bericht und Artefaktnachweis aktualisieren. Keine öffentliche Store-Freigabe und kein OTA-Update.

## 4. Android und Geräteabnahme

Der nächste Android-Testbuild nutzt dieselbe geprüfte gemeinsame Quelle. Für den bestehenden internen Play-Test passt `family-qa-play` (AAB); für eine ausdrücklich gewählte direkte Geräteinstallation wäre `family-qa-android` (APK) passend. Dieser einmalige iOS-Folgeauftrag startet keinen zusätzlichen Android-Build automatisch. Android wird nach erfolgreicher Vorbereitung als nächster Schritt angegangen; die Plattformen werden wegen der Parallelitätsgrenze nacheinander gebaut.

Die Abnahme auf Android und iPhone umfasst:

- Neuer Google-Testnutzer: Zustimmung, Systembrowser-Anmeldung, Rückkehr zur App, Onboarding und Familieneinladung.
- Bestehendes bestätigtes E-Mail-Konto mit derselben Google-Adresse: dieselbe Supabase-Nutzer-ID, vorhandene Daten, Familienzugang und RevenueCat-Zuordnung nachweisen. Andere Adresse bzw. Apple-Relay nicht automatisch zusammenführen.
- Abbruch, erneuter Versuch, App-Neustart und abgelaufener Anmeldeversuch; verständlicher Fehler/Fallback bei Netzproblemen.
- Abmelden und Kontowechsel: keine fremden Daten oder alten Google-Versuche übernehmen.
- iOS: Apple und Google zugleich sichtbar und getrennt bedienbar; Apple-Anmeldung weiterhin erfolgreich. E-Mail-Anmeldung auf beiden Plattformen prüfen.
- Vorhandene iOS-Retry-Korrektur und Offline-/Online-Rückkehr prüfen. Google-Login benötigt eine Netzwerkverbindung.

Nur isolierte Testkonten für neue Registrierung und Kontolöschung verwenden. Bestehende Familienkonten, Store-Regionen und Gerätedaten erhalten. Ein erfolgreicher Build oder TestFlight-/Play-Upload ist noch keine Geräteabnahme.

## Öffentliche Freigabe

Nach dokumentierter nativer Google-Abnahme die Website-Datenschutzerklärung zur optionalen Google-Anmeldung veröffentlichen und Google-Zielgruppe/Branding abschließend prüfen. Die weiteren offenen Punkte aus `docs/release-readiness-20260929.md` bleiben Teil der allgemeinen Release-Abnahme. Dieser Ablauf erteilt keinen allgemeinen Produktionsfreigabestatus und keinen Auftrag für einen kostenpflichtigen Tarifwechsel.

Siehe auch `docs/google-sign-in-implementation-20260930.md` für die vollständigen bisherigen Tests und Provider-Nachweise. Expo-Tarifbeschreibung: <https://docs.expo.dev/billing/plans/>; die konkreten Konto-Zeitpunkte stammen aus der Live-CLI-Prüfung.
