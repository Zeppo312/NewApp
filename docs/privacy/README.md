# Datenschutzabgleich vom 11. September 2026

**Nachtrag:** Fürsorge-Hintergrundverarbeitung wurde serverseitig deaktiviert, Replays im neuen App-Code entfernt. Veröffentlichung und aktuelle Nachweise: [Datenschutz-Korrekturen](privacy-controls-2026-09-11.md). Die früher veröffentlichten Website-Texte unten beschreiben teilweise noch ältere App-Versionen.

Die App-spezifischen Angaben in `lib/appPrivacySections.json` werden in der deutschen,
englischen und spanischen Datenschutzerklärung angezeigt. `node scripts/sync-app-privacy.mjs`
erzeugt daraus den App-Abschnitt in `Datenschutz.html` sowie die HTML-Ergänzungen in
diesem Ordner; `--check` prüft, dass diese Ausgaben aktuell sind. Die Ergänzungen
ersetzen nicht die bestehenden Website-, Shop- und Cookie-Abschnitte der Live-Seite.

## Umsetzung und Veröffentlichung

- App: `app/datenschutz.tsx` und `lib/legalTranslations.ts` beziehen die gemeinsamen
  Abschnitte; Stand 11. September 2026. Noch kein App-Build/OTA-Update veröffentlicht.
- Website: `datenschutz.php` sowie `lang/de.php`, `lang/en.php`, `lang/es.php` am
  11. September 2026 über FTPS mit geprüftem TLS-Zertifikat aktualisiert. Nur diese
  vier Dateien wurden ersetzt. Die zentralen Übersetzungen korrigieren sowohl die
  sichtbaren FAQ als auch die daraus erzeugten strukturierten Daten auf `/` und `/app`.
- Die Website-Erklärung enthält alle acht App-Abschnitte pro Sprache zusätzlich zu
  den bisherigen Website-/Shop-Hinweisen. Nicht belegte pauschale DPF-/SCC-Zusagen
  wurden in App, HTML und Website ersetzt. Die bisherige HTML-Vorlage hatte zudem
  Platzhalter für den Verantwortlichen; diese sind durch die vorhandenen Kontaktdaten ersetzt.
- Reproduzierbare Vorbereitung: `node scripts/prepare-website-privacy.mjs QUELLORDNER ZIELORDNER`.
  Das Skript erwartet frische Originaldownloads, prüft die erwartete Ausgangsversion
  und erzeugt vier Dateien aus den gemeinsamen Abschnitten und `website-copy.json`.
- Sicherung und veröffentlichte Fassungen liegen lokal unter
  `output/privacy-website-20260911/original` bzw. `updated`. Keine Zugangsdaten gespeichert.
- Verifikation: TypeScript `npx tsc --noEmit`, PHP-Syntax aller vier geänderten Dateien,
  lokale Ausgabe aller drei Datenschutzerklärungen und Abgleich der generierten HTML-Dateien
  bestanden. Vor Upload Originaldateien auf zwischenzeitliche Änderungen geprüft;
  Uploads per SHA-256 verifiziert. Alle neun Kombinationen aus `/`, `/app`, `/datenschutz`
  und `?lang=de|en|es` lieferten HTTP 200, nannten alle vier Anbieter und enthielten keine
  alte Behauptung ausschließlich lokaler Speicherung. Ergebnisse: `output/privacy-website-20260911/live-checks.json`.

## Nachweise aus dem aktuellen Arbeitsbaum

| Dienst | Datenfluss / Auslöser | Code |
| --- | --- | --- |
| Supabase | Auth-Sitzung lokal in AsyncStorage; Konto, Familien- und Trackingdaten, Nachrichten und Uploads in der Cloud | `lib/supabase.ts`, `lib/profile.ts`, `docs/supabase_tables.md` |
| OpenAI / Frag Lotti | Frage, begrenzter Verlauf, ausgewählte Auswertungen, Alters-/Schwangerschaftskontext; Responses API mit `store: false` | `supabase/functions/ask-lotti/index.ts` |
| OpenAI / Fürsorge | Babyname, Alter, Regelfakten; Schwangerschaftsvorname, Woche, Trimester, Tage bis Geburt; nur bei geöffneter Fürsorge in aktiver App; täglicher Serverlauf stillgelegt | `supabase/functions/advisor-generate/advisorAi.ts`, `supabase/functions/advisor-daily/advisorAi.ts`, zugehörige `index.ts` |
| OpenAI / Sprache | Audio → Transkription; Text und Kontext → strukturierte Vorschläge; auch Textübernahme in den Planer | `supabase/functions/voice-log-parse/index.ts` |
| Sentry | Initialisierung beim App-Start; Fehler und technische Ereignisse; Replays im neuen Code deaktiviert; gekürzter Nutzerhash bei Abo-Fehlern | `app/_layout.tsx`, `lib/revenuecat.ts` |
| RevenueCat | Supabase-UUID als App User ID; Store-Kaufdaten und Abo-Status; Rückkanal an Supabase | `lib/revenuecat.ts`, `supabase/functions/revenuecat-webhook/handler.ts`, `supabase/functions/_shared/premiumAccess.ts` |
| Wetter | Babywetter sendet Koordinaten an OpenWeather; Fürsorge sendet gerundete Koordinaten an Open-Meteo | `lib/weatherService.ts`, `app/(tabs)/babyweather.tsx` |
| Push | Expo/Apple/Google: Token, Titel, Nachrichtenvorschau und Kennungen | `supabase/functions/send-direct-message-notification/index.ts`, weitere `send-*-notification` |
| Kontolöschung | `delete_user_data(delete_auth: true)`; zuvor Apple-Widerruf, falls erforderlich | `lib/profile.ts`, `app/dsgvo.tsx`, `app/profil.tsx`, `app/app-settings.tsx` |

## Noch vor einer Compliance-Freigabe zu erledigen

Die Textänderung ist **keine Bestätigung vollständiger DSGVO- oder Google-Play-Konformität**.
Folgende Punkte sind konkret offen und dürfen nicht durch Formulierungen als erledigt dargestellt werden:

1. **Gesonderte Einwilligung / auffällige Hinweise:** `termsConsent.ts` dokumentiert die
   Zustimmung zu Nutzungsbedingungen. Das belegt keine ausdrückliche Einwilligung zur
   Verarbeitung von Gesundheitsdaten oder deren Weitergabe an OpenAI. Vor dem ersten
   entsprechenden Datenfluss braucht es konkrete Hinweise zu Daten, Empfänger, Zweck
   und aktive Zustimmung,
   Ablehnung, Widerruf und einen technisch wirksamen Schutz vor vorzeitiger Übertragung.
   Ein Hinweis nur in den Einstellungen oder in dieser Erklärung genügt nicht.
2. **Session Replay:** im neuen App-Code entfernt. Die Abschaltung muss noch als
   App-Update ausgeliefert werden; ältere installierte Fassungen können weiter aufzeichnen. Maskierung und `sendDefaultPii: false` ersetzen
   keinen Consent und garantieren keine Anonymität von Logs/Fehlern/URLs.
3. **Betriebsnachweise:** tatsächliche Supabase-Region, AV-Verträge, konkrete Empfänger,
   Standardvertragsklauseln/ggf. Zertifizierungen und Dashboard-Aufbewahrungsfristen für
   Supabase/Sentry/RevenueCat sowie OpenAI-Datenfreigaben prüfen und dokumentieren.
   Keine festen Löschfristen oder abgeschlossenen Verträge aus SDK-Defaults ableiten.
4. **Löschung vollständig prüfen:** der Client-RPC allein belegt weder die Entfernung
   aller Storage-Objekte und neuen Tabellen noch eine Löschung bei Sentry/RevenueCat.
   Löschprozess einschließlich Dienstleistern, Backups, geteilten Inhalten und
   Ausnahmen testen; externe Anfragen an `support@lottibaby.de` organisatorisch bearbeiten.
   Keine personenbezogenen Produktionsdaten als Testdaten löschen.
5. **Play Console:** Data-Safety-Angaben anhand dieser Matrix aktualisieren. Mindestens
   personenbezogene Kontodaten/IDs, Gesundheits- und Trackingdaten, Inhalte und Medien,
   Standort, Kaufhistorie sowie Diagnose-/Nutzungsdaten prüfen. Erhebung und Weitergabe
   getrennt nach Googles Definitionen bewerten; Auftragsverarbeitung ist kein Grund,
   eine tatsächlich erfolgende Erhebung wegzulassen. Öffentliche HTML-Datenschutzerklärung
   und externe Löschmöglichkeit verlinken. Diese Console-Angaben wurden hier nicht geändert.

## Quellen

- [Google Play: User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [OpenAI: API data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Supabase: Privacy](https://supabase.com/privacy)
- [RevenueCat: End User Information](https://www.revenuecat.com/privacy)
- [RevenueCat: purchases and identifiers](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy)
- [Sentry React Native SDK](https://github.com/getsentry/sentry-react-native)

Die Aussagen zu konkreten Datenfeldern und Auslösern stammen aus dem Code; Anbieter-
Informationen belegen nicht automatisch die Konfiguration des produktiven Kontos.

## Ergänzung: öffentlicher Löschweg

Auf der bestehenden Datenschutzseite ist jetzt ganz oben der Abschnitt „Lotti Baby: Konto und Daten löschen“ mit E-Mail-Button sichtbar, jeweils in Deutsch, Englisch und Spanisch. Direkte URL: https://lottibaby.de/datenschutz#konto-loeschen. Dafür wurde nur `datenschutz.php` geändert; die bestehenden Rechtstexte blieben unverändert. Sicherung und Live-Prüfung: `output/privacy-deletion-callout/`. Die neue Backend-Löschverarbeitung ist davon getrennt und noch nicht produktiv freigegeben; siehe `deletion-runbook.md`.
