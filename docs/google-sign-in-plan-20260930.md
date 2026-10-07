# Google Sign-in: Stand und Umsetzungsplan

Stand: 30.09.2026. Der ursprüngliche Plan unten dokumentiert die Prüfung vor der Umsetzung. Die App-Integration ist inzwischen im aktuellen Checkout umgesetzt; der Web-OAuth-Client wurde im Veröffentlichungskonto erstellt, seine JSON-Datei geschützt gespeichert und Google im Produktions-Backend aktiviert. Apple bleibt vorhanden und aktiviert. Die vollständige Anmeldung auf Android/iPhone und die App-Veröffentlichung stehen noch aus. Aktueller Stand und nächste Schritte: [Umsetzungsstand](google-sign-in-implementation-20260930.md).

Die Umsetzung verwendet den eigenen Rücksprung `com.lottibaby.app://auth/google-callback?attempt=<UUID>` und die Allowlist `com.lottibaby.app://auth/google-callback?attempt=*`. Der bestehende E-Mail-Callback bleibt bestehen.

## Ursprüngliches Prüfergebnis vor der Umsetzung

**Google Sign-in ist noch nicht nutzbar.** Eine vorbereitete Funktion existiert, aber die Oberfläche, der vollständige mobile Login-Ablauf und die Provider-Aktivierung fehlen.

| Baustein | Geprüfter Stand | Konsequenz |
| --- | --- | --- |
| `lib/supabase.ts:410` | `signInWithGoogle()` ruft lediglich `signInWithOAuth({ provider: 'google' })` auf. | Vorarbeit vorhanden; keine explizite Rücksprungadresse, kein Öffnen des Systembrowsers, keine abgeschlossene mobile Session. |
| `contexts/AuthContext.tsx` | E-Mail, Apple und OTP sind eingebunden; Google fehlt. | Google muss denselben Umgang mit Sessions und laufender Abmeldung erhalten. |
| `app/(auth)/login.tsx` | E-Mail-Login und Apple-Button auf iOS; kein Google-Button/Handler. | Nutzer können Google aktuell nicht auswählen. |
| Produktions-Backend | `GET https://kwniiyayhzgjfqjsjcfu.supabase.co/auth/v1/settings` lieferte HTTP 200 und `external.google: false`; Apple und E-Mail sind aktiviert. Prüfung gegen 19:04 Uhr Europe/Berlin. | Google ist serverseitig deaktiviert. |
| `app/auth/callback.tsx` | PKCE-Code-Austausch, Session-Prüfung und Onboarding-Weiterleitung sind vorhanden. | Wiederverwendbare Grundlage; behandelt Google-Abschluss und OAuth-Fehler noch nicht vollständig. Texte beziehen sich auf E-Mail-Bestätigung. |
| Expo/native Konfiguration | SDK 57, `expo-web-browser`, `expo-linking`, AsyncStorage und PKCE sind vorhanden; Scheme `com.lottibaby.app` ist in Expo und den nativen Projekten registriert. | Der Systembrowser-Ablauf kann auf vorhandenen Bausteinen aufsetzen. |

Nicht geprüft wurde die private Google-Cloud-Konfiguration. Ob dort bereits ein passender OAuth-Client existiert, ist offen. `external.google: false` sagt nicht, ob deaktivierte Zugangsdaten hinterlegt sind. Auch die vollständige Redirect-Allowlist ist über den öffentlichen Settings-Endpunkt nicht sichtbar. Ein Google-Login auf einem installierten Store-Build wurde nicht ausgeführt.

## Empfohlener Weg

Für den ersten Ausbau Google-Anmeldung über den Systembrowser und Supabase OAuth mit dem bereits konfigurierten PKCE verwenden. Auf iOS öffnet `expo-web-browser` eine Authentifizierungssitzung, auf Android einen Browser-Tab; anschließend geht es zurück in die App. Diese APIs sind in der [Expo-Dokumentation für SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/#webbrowseropenauthsessionasyncurl-redirecturl-options) beschrieben.

Eine neue native Google-Sign-in-Bibliothek ist für diesen Weg nicht erforderlich. Ein nativer Google-Kontoauswahldialog wäre ein zusätzlicher Ausbau mit eigenen iOS-/Android-Clients und Android-Signaturkonfiguration. Er gehört nicht zum ersten Umsetzungsschritt.

## 1. Google und Supabase vorbereiten

- Bestehendes Google-Cloud-Projekt und OAuth-Clients prüfen; geeigneten Web-OAuth-Client verwenden oder erstellen.
- Google Auth Platform mit App-Name, Supportkontakt, Website, Datenschutzerklärung und passender Zielgruppe konfigurieren. Für Tests Testnutzer eintragen; vor Freigabe den Produktionsstatus prüfen.
- Nur die Login-Berechtigungen `openid`, E-Mail und Profil anfordern.
- Im Google-Web-Client diese autorisierte Redirect-URI hinterlegen: `https://kwniiyayhzgjfqjsjcfu.supabase.co/auth/v1/callback`.
- Client-ID und Client-Secret im Google-Provider von Supabase hinterlegen und diesen aktivieren. Das Secret bleibt im Backend.
- Als Rücksprung in die native App `com.lottibaby.app://auth/callback` explizit in Supabase erlauben und im Ablauf verwenden. Die Google-Redirect-URI und der App-Rücksprung sind zwei verschiedene Adressen.
- Den isolierten QA-Backend-Pfad separat konfigurieren, wenn damit getestet wird; dessen Google-Callback gehört zum QA-Projekt. Bestehende Umgebungsprüfungen beibehalten.

Die Voraussetzungen und Provider-Einstellungen folgen der [Supabase-Dokumentation für Google Sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google).

**Fertig, wenn:** Die passenden Clients und Rücksprungadressen dokumentiert sind und das jeweils verwendete Backend `external.google: true` meldet.

## 2. Den Login-Ablauf vervollständigen

Betroffene Stellen: `lib/supabase.ts`, `contexts/AuthContext.tsx`, `app/auth/callback.tsx`; bei Bedarf ein kleiner gemeinsamer OAuth-Helfer in `lib/`.

- Den OAuth-Aufruf um `redirectTo` und für native Geräte `skipBrowserRedirect: true` ergänzen; die erhaltene URL mit `WebBrowser.openAuthSessionAsync()` öffnen.
- Google über den Auth-Kontext bereitstellen. Wie bei den anderen Login-Methoden auf laufende Abmeldung und lokale Datenbereinigung warten.
- Genau eine zentrale Abschlussroutine für Code-Austausch und Weiterleitung verwenden. Browser-Ergebnis und Router-Callback dürfen denselben einmal verwendbaren Code nicht parallel tauschen.
- Den vorhandenen PKCE-Flow beibehalten und die Session an den bestehenden Auth-/RevenueCat-Ablauf übergeben.
- OAuth-Fehler, fehlenden Code, abgelaufenen Versuch und Netzwerkfehler behandeln. Bei Abbruch zur bedienbaren Login-Seite zurückkehren, ohne einen erfolgreichen Login vorzutäuschen.
- Falls Web-Login angeboten wird, dessen HTTPS-Callback und Browser-Weiterleitung getrennt vom nativen Rücksprung konfigurieren und testen.

**Fertig, wenn:** Android und iOS nach der Google-Freigabe mit einer gültigen Session in die App zurückkehren und Abbruch oder Fehler einen erneuten Versuch erlauben.

## 3. Oberfläche, Zustimmung und Onboarding integrieren

Betroffene Stellen: `app/(auth)/login.tsx`, `lib/authTranslations.ts`, `app/auth/callback.tsx`, vorhandene Consent-/Onboarding-Helfer.

- Einen Google-Button auf Android und iOS ergänzen; bei angebotener Web-Anmeldung auch dort. Texte und Fehler auf Deutsch, Englisch und Spanisch ergänzen.
- Den Button gemäß den [Google-Branding-Vorgaben](https://developers.google.com/identity/branding-guidelines) gestalten, einschließlich Original-Logo, Lesbarkeit und Sichtbarkeit neben Apple.
- Die vorhandene Zustimmung vor Login anwenden und nach erfolgreicher Anmeldung über `acceptTerms()` für die tatsächlich angemeldete Nutzer-ID speichern. Schlägt das Speichern fehl, die Anmeldung wie beim vorhandenen Apple-Ablauf abbrechen.
- Zustimmung, Registrierungsabsicht und Einladungscode über den Browserwechsel erhalten. Bei unterbrochenem/kaltem App-Start darf der Callback keine Zustimmung aus einem URL-Parameter ableiten; nötigenfalls den bestehenden Consent-Gate verwenden.
- Neue oder unvollständige Konten anhand der gemeinsamen Onboarding-Prüfung zu `getUserInfo` führen. Vollständige Konten zum zentralen Root-Router beziehungsweise zur Familienverknüpfung weiterleiten.
- Einladungscodes auch nach dem OAuth-Rücksprung an Onboarding/Familienverknüpfung übergeben. Der aktuelle allgemeine Callback erledigt das noch nicht.
- Callback-Texte passend zu Google-Anmeldung und E-Mail-Bestätigung auswählen.
- Die gemeinsame Datenschutzquelle `lib/appPrivacySections.json` und die daraus erzeugten App-/Website-Texte um die tatsächliche Google-Anmeldung ergänzen; vorhandene Google-Erwähnungen beschreiben überwiegend Käufe und weitere Dienste.

**Fertig, wenn:** Der gesamte Einstieg mit Zustimmung und optionaler Familieneinladung auf beiden Plattformen durchläuft.

## 4. Bestehende Konten und Datenzuordnung absichern

Die Supabase-Nutzer-ID ist in Lotti Baby auch für Datenzugriff und RevenueCat-Zuordnung relevant. Ein ungewolltes zweites Konto würde deshalb Daten und Abo-Zugang auseinanderziehen.

- Mit einem bestätigten E-Mail-Konto und Google unter derselben Adresse prüfen, dass die vorhandene Nutzer-ID, Baby-Daten, Familienverknüpfung und RevenueCat-Zuordnung erhalten bleiben.
- Supabase beschreibt automatisches Identity Linking bei derselben E-Mail-Adresse. Für eine andere Adresse ist eine ausdrückliche Verknüpfung im bereits angemeldeten Konto erforderlich; daraus folgt keine automatische Zusammenführung. Details: [Supabase Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
- Apple-Konten mit privater Relay-Adresse separat berücksichtigen. Google mit einer anderen Adresse kann ein anderes Konto ergeben. Eine neue Oberfläche zur manuellen Identitätsverknüpfung wäre ein eigener Ausbau; die vorhandene Familienverknüpfung erfüllt diesen Zweck nicht.
- Keine eigene Konto-Zusammenführung anhand eines Profilnamens oder ungeprüfter E-Mail-Angaben implementieren.
- Mit einem reinen Google-Konto die vorhandene E-Mail-OTP-Verifikation für Kontolöschung testen (`lib/accountDeletion.ts`). Sie verlangt aktuell kein Passwort, aber muss dieselbe Nutzer-ID bestätigen.

**Fertig, wenn:** Die Fälle mit gleichem und unterschiedlichem Konto eindeutig verifiziert sind und bestehende Daten/Abos nicht versehentlich einem neuen Konto zugeordnet werden.

## 5. Prüfen und ausrollen

| Fall | Erwartetes Ergebnis |
| --- | --- |
| Neues Google-Konto | Gültige Session, gespeicherte Zustimmung, vollständiges Onboarding. |
| Bestehendes Google-Konto | Direkter Einstieg mit bisherigen Daten. |
| Bestätigtes E-Mail-Konto mit gleicher Google-Adresse | Vorhandene Nutzer-ID und Daten bleiben erhalten. |
| Andere Google-Adresse / Apple-Relay-Konto | Kein unbeabsichtigtes Zusammenführen; Konto-Zuordnung ist nachvollziehbar. |
| Familieneinladung vor Login | Einladung bleibt nach Browserwechsel und Onboarding erhalten. |
| Abbruch, Offline-Start, Fehler, erneuter Versuch | Verständlicher Zustand; kein hängender Ladeindikator oder falscher Erfolg. |
| Doppelter Callback / App-Neustart während OAuth | Kein doppelter Code-Austausch; abgeschlossener oder sauber abgebrochener Versuch. |
| Abmelden und anderes Google-Konto anmelden | Vorherige lokale Daten werden bereinigt; neue Daten/Abos passen zur Nutzer-ID. |
| App schließen und neu öffnen | Session wird korrekt wiederhergestellt. |
| Google-Konto löschen | OTP-Verifikation und Löschauftrag funktionieren im isolierten Testkonto. |
| E-Mail, Apple, OTP und Passwort-Recovery | Vorhandene Login-Wege funktionieren weiterhin. |

Gezielte Tests für den OAuth-Abschluss, doppelte Rückkehr, Abbruch, Consent-Fehler und Einladungscode ergänzen. Bestehende Auth-Tests und Typecheck ausführen. Anschließend auf einem Android-Gerät und einem iPhone mit einem passenden nativen Testbuild prüfen; Expo Go allein reicht als Freigabenachweis nicht.

Provider-Konfiguration zuerst mit Testkonten prüfen. Danach den App-Einstieg in einem Preview-Build abnehmen und veröffentlichen. Ob ein OTA-Update ausreicht, hängt davon ab, ob die tatsächlich veröffentlichten Binaries die benötigten Module und Schemes enthalten; die Repository-Konfiguration allein beweist das nicht. Bei nötigen nativen Änderungen neue Store-Builds erstellen.

## Aufwand und offene Voraussetzung

Grobe Planung: **2–3 Entwicklungstage** für Integration und Geräte-/Regressionstests bei zugänglichem Google-Cloud-Projekt und passenden Testbuilds. Einrichtung oder eine Google-Markenprüfung kann zusätzliche Kalenderzeit benötigen. Eine manuelle Kontoverknüpfungsoberfläche oder ein nativer Google-Dialog ist darin nicht enthalten.

Der erste konkrete Umsetzungsschritt ist die Prüfung des vorhandenen Google-Cloud-Web-Clients und der privaten Supabase-Provider-/Redirect-Einstellungen. Der im Plan dokumentierte Ist-Stand wurde durch Codeprüfung und eine lesende Backend-Abfrage bestätigt; es wurde noch kein Google-Login durchgeführt.
