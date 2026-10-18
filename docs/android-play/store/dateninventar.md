# Dateninventar aus der App

Stand 10.09.2026. Geprüft wurde der lokale Arbeitsbaum einschließlich vorhandener Änderungen, nicht eine vollständige Live-Installation samt Backend-Konfiguration. Pfade beziehen sich auf das Repository. SDK-Versionen aus `package-lock.json`; Manifestnachweise separat in [Berechtigungen](berechtigungen.md).

## Datenflüsse

| Bereich | Erhebung und Speicherung | Übertragung / Empfänger | Codebeleg |
| --- | --- | --- | --- |
| Konto/Onboarding | E-Mail, Passwort bei Anmeldung, Auth-ID, Vorname, Rolle, Babyname, Geburts-/Entbindungstermin, Einstellungen und Zustimmungsstatus; Session lokal | Supabase Auth, Postgres; Passwort an Auth, keine behauptete Klartext-Passwortspeicherung | `contexts/AuthContext.tsx`, `app/(auth)/login.tsx`, `app/(auth)/getUserInfo.tsx`, `lib/supabase.ts`, `lib/termsConsent.ts` |
| Baby- und Gesundheitsdaten | Schlaf, Stillen/Flasche, Windeln, Notizen, Größe/Gewicht, Zähne, eigene Aktivitäten; Schwangerschaft, Wehen, Zyklus/Perioden/Symptome, Arztfragen, Vitamin-D-Haken | Supabase-Tabellen, teilweise lokale Caches und Realtime-Synchronisierung; freigegebene Daten an verknüpfte Nutzer | `lib/supabase.ts`, `lib/sleepData.ts`, `lib/cycleData.ts`, `lib/weight.ts`, `lib/size.ts`, `lib/toothData.ts`, `lib/customActivities.ts`, `lib/vitaminDReminder.ts` |
| Fotos | Profil-/Babybilder, Meilensteine, Rezepte und Beiträge je Funktion | Supabase Storage; einige Pfade erzeugen öffentliche URLs, keine pauschale Privatheitszusage | `lib/profile.ts`, `lib/babyPhoto.ts`, `lib/milestones.ts`, `lib/recipes.ts`, `lib/blog.ts`; Migration `20260729075057_baby_profile_images_storage.sql` |
| Familienfreigaben | Konto-Verknüpfungen, Baby-Zugriffsrechte, Einladungscodes, Aufpasser-Sitzungen | Supabase und berechtigte Partner/Aufpasser; Gastzugriff über RPC, keine reine Geräteteilung | `lib/accountLinks.ts`, `lib/caretaker-access.ts`, `lib/caretaker-guest.ts`, `lib/sleepSharing.ts` |
| Community/Chat (im aktuellen App-Code deaktiviert; historische Bestände separat beachten) | Profile, Posts, Kommentare, Gruppen, Direktnachrichten, Meldungen, Gruppentermine; Sprachnachrichten | Supabase/Realtime; `chat-audio` mit signierten Abruf-URLs und lokalem Audiocache; sichtbare Inhalte an Empfänger/Gruppe/Community | `lib/community.ts`, `lib/groupChat.ts`, `lib/groupChatEvents.ts`, `lib/chatMessages.ts`, `lib/chatAudio.ts`, `supabase/functions/get-chat-audio-url/index.ts` |
| Frag Lotti | Frage und begrenzte Historie werden gesendet; passende Gesundheits-/Familieneinträge werden serverseitig gelesen. Gesprächsverlauf liegt in AsyncStorage; Request-Metadaten in `lotti_ai_requests` | App → Supabase Function `ask-lotti` → OpenAI Responses API. `store:false` ist konfiguriert, belegt aber keine sofortige Löschung aller Anbieterlogs | `lib/askLotti/api.ts`, `lib/askLotti/chatStore.ts`, `supabase/functions/ask-lotti/index.ts` |
| Spracheingabe | Audio/Base64, Sprache, Zeit, Babybezug/-name, Kontext; Transkript und erkannte Vorschläge; bestätigte Einträge im jeweiligen Backendbereich; `voice_log_requests` für Nutzung | Supabase `voice-log-parse` → OpenAI Audio-Transkription und Chat Completions; Audioübertragung auch ohne dauerhaften App-Upload relevant | `components/VoiceLogModal.tsx`, `lib/voiceLog/api.ts`, `supabase/functions/voice-log-parse/index.ts` |
| Lottis Fürsorge | Tages-/Schwangerschaftssignale, KI-Hinweise, Mama-Check-ins, Entlastungsereignisse und Einstellungen in `advisor_*` | Supabase; KI-Zweig in `advisor-generate` → OpenAI, neue Anfragen nur in aktiver App; `advisor-daily` produktiv stillgelegt, kein automatischer täglicher Push | `lib/advisor/buildDailySignals.ts`, `lib/advisor/pregnancySignals.ts`, `lib/advisor/advisorStorage.ts`, `supabase/functions/advisor-generate/`, `supabase/functions/advisor-daily/` |
| Wetter/Standort | Aktuelle Koordinaten oder manuell Stadt/PLZ; Fürsorge verwendet gerundete Koordinaten für Open-Meteo; keine neuen Standort-Uploads zur Vorbereitung des täglichen Jobs | `babyweather` und `buildDailySignals` senden auch ungerundete Gerätekoordinaten an OpenWeather; Prognose an Open-Meteo. `advisor-daily` verarbeitet keine Daten mehr | `app/(tabs)/babyweather.tsx:902`, `lib/weatherService.ts:48`, `lib/weatherService.ts:213`, `lib/advisor/buildDailySignals.ts:94`, `lib/advisor/advisorStorage.ts` |
| Planer/Kalender | Aufgaben, Titel, Zeit, Ort, Notizen und Kalenderverweise; Kalenderliste wird gelesen | App-Planerdaten in Supabase, ausgewählte Termine zusätzlich an Systemkalender. Dieser kann seinerseits mit Google/anderen Konten synchronisieren. Kein Beleg für Upload des kompletten fremden Kalenders | `app/planner/index.tsx`, `lib/plannerCalendarSync.ts`, `lib/calendarService.ts` |
| Einkauf/Kundenkarten | Listen, Vorräte, Produktauswahl/Barcodes, Händler und Kartencodes | Supabase; Barcode-Fallback an Open Food/Beauty/Products Facts mit IP/Anfrage. Kein belegter Upload des Kameravideostreams beim Barcode-Scan | `lib/shopping.ts:933`, `lib/shopping.ts:959`, `lib/loyalty-cards.ts` |
| Benachrichtigungen | Expo-Push-Token, Nutzerbezug, Präferenzen; lokale Erinnerungen und Remote-Push | Token in Supabase; Server → Expo Push → Android/FCM. Nachrichtenpayloads können Absender, Vorschautext, Termin-/Erinnerungsinhalt und IDs enthalten | `lib/notifications.ts`, `hooks/useNotifications.ts`, `supabase/functions/send-direct-message-notification/index.ts:148`, `supabase/functions/send-baby-reminder-notification/index.ts:124` |
| Abonnement | Auth-ID als `appUserID`, Produkte, Käufe, Berechtigungen und Laufzeiten; Backendcache | RevenueCat/Google Play und Supabase-Webhooks. Android-Key/Produkte laut Schritten 1–3 noch nicht einsatzbereit; Zielrelease muss erneut geprüft werden | `lib/revenuecat.ts:165`, `lib/revenuecatProducts.ts`, `supabase/functions/revenuecat-webhook/`, `supabase/functions/_shared/revenuecatState.ts` |
| Diagnose | Fehler, Gerät-/App-Kontext, technische Interaktionen; bei RC-Fehlern Nutzerhash und Fehlermeldung | Sentry, konfigurierter US-Ingest. `sendDefaultPii:false`; Replay-Integration im neuen App-Code entfernt, beide Raten null. Noch kein App-Update veröffentlicht; bisher installierte Fassungen können weiter aufzeichnen | `app/_layout.tsx:88`, `lib/revenuecat.ts:147` |
| Support/Moderation | Support-Nachricht plus App-Version und Nutzer-ID wird im E-Mail-Programm vorbereitet; Meldungsmetadaten | Mail-App/Support-Mailanbieter nach Nutzeraktion; Moderationsalarme über Expo und optional Resend, abhängig von Server-Secrets | `app/support.tsx:69`, `lib/moderation.ts`, `supabase/functions/moderation-report-notify/index.ts`, `supabase/functions/_shared/moderationAlert.ts` |
| Updates/Medien | Laufzeit-/Updateanfragen, IP-/technische Metadaten; Abrufe externer Bilder/Videos | Expo Updates/CDN; YouTube-nocookie/YouTube-Vorschaubilder, ggf. Unsplash-Beispielbilder, konfigurierbare Inhaltslinks | `app.config.js`, Android-Manifest, `lib/recipeVideo.ts`, `lib/recipes-samples.ts`, `lib/printsShop.ts` |
| Eigener Shop in WebView | Warenkorb/Personalisierung lokal im Webspeicher; bei Bestellung Name, Kontakt, Liefer-/Rechnungsadresse, Bestell- und Zahlungsstatus; Zahlungsdaten im Checkout | `lottibaby.de?source=app&lang=…`, Shopify/Checkout/Zahlungsanbieter. Eigene WebView mit injiziertem App-CSS; deren kontrollierte Datenerhebung gehört in die App-Prüfung | `app/prints-shop.tsx:16`, `app/prints-shop.tsx:89`, `lib/printsShop.ts`; [Website-Datenschutz](https://lottibaby.de/datenschutz), [Impressum](https://lottibaby.de/impressum) |

**Wetterkorrektur:** Die Aussage „nie präziser Standort“ aus Fürsorge-Übersetzungen gilt nicht für die gesamte App. `weatherService.ts` übernimmt präzise Koordinaten unverändert. Ob ein Anbieter diese nur flüchtig verarbeitet, ist nicht im App-Code belegbar.

**Gesundheitsdaten betreffen auch Babys.** Erwachsene bedienen die App, tragen aber Gesundheits- und Profildaten anderer Personen ein. Die erwachsene Zielgruppe entfernt diese Daten nicht aus der Deklaration.

## SDK-Bestand und Laufzeitstatus

| SDK / Bibliothek | Lockfile-Version | Einordnung |
| --- | --- | --- |
| Expo / React Native | 57.0.14 / 0.86.2 | App-Laufzeit; lokale native Android-Projekte vorhanden |
| `@supabase/supabase-js` | 2.98.0 | Aktiv; Auth, DB, Storage, Realtime, Functions |
| `@sentry/react-native` | 7.11.0 | Im Root initialisiert; Fehlerdiagnose, Replay im neuen Code deaktiviert |
| `react-native-purchases` | 9.10.5 | Implementiert; Android-Konfiguration/Google-Angebote offen |
| `expo-notifications` | 57.0.12 | Lokale und Remote-Pfade; FCM-Konfiguration und Zustellung offen |
| `expo-location` | 57.0.11 | Vordergrundstandort/Wetter, keine belegte Hintergrundortung |
| `expo-audio` / `expo-camera` | 57.0.3 / 57.0.3 | Aufnahme/Wiedergabe bzw. Scanner |
| `expo-calendar` / `expo-image-picker` | 57.0.2 / 57.0.11 | Systemkalender bzw. Bildauswahl |
| `expo-updates` | 57.0.15 | Beim Start aktiviert; tatsächlicher Releasekanal offen |
| `react-native-webview` | 13.16.1 | Eigener Shop und Webinhalte |
| AsyncStorage | 2.2.0 | Session-/Inhaltscaches und lokale Frag-Lotti-Gespräche; keine vollständige lokale Verschlüsselung nachgewiesen |
| Convex | 1.42.1 | Installiert/Altpfade vorhanden; `contexts/ConvexContext.tsx` liefert ausdrücklich keinen Client/Socket/Sync. Nicht als aktive Übertragung deklarieren, solange das so bleibt |

OpenAI, Wetter und Resend sind HTTP-/Serverintegrationen, keine zusätzlich benötigten Android-SDKs. Im App-Quellcode kein AdMob-/Meta-Werbe-SDK, kein aktives Health Connect und keine Schrittmessung mit `expo-sensors` gefunden. Ein installiertes Paket oder eine Berechtigung allein beweist keine Datenerhebung. Umgekehrt können native Abhängigkeiten und WebView-Skripte zusätzliche Übertragungen verursachen: finalen AAB und Netzwerkverkehr prüfen.

## Grenzen, die vor der Deklaration geschlossen werden müssen

- Hostingregion, Backups, Logfristen, Unterauftragnehmer, SDK-Dashboardintegrationen und tatsächliche Deployments sind OFFEN-TECHNIK/OFFEN-NUTZER. Zukunftsdatierte SQL-Dateien im Repository beweisen nicht, dass sie live angewendet wurden.
- Supabase-Storage mit öffentlichen URLs und Chat mit Serverzugriff sind keine Ende-zu-Ende-Verschlüsselung. Zugriffsregeln mit zwei unabhängigen Familienkonten prüfen.
- Sentry-Maskierung verhindert keine Daten in frei formulierten Fehlern, URLs oder Breadcrumbs. Insbesondere Kalenderfunktionen protokollieren Metadaten; reale Events auf sensible Inhalte prüfen.
- Sentry beschreibt standardmäßige IP-Ableitung sowie URL-/Query- und Console-Kontext. `sendDefaultPii:false` bedeutet deshalb nicht „keine personenbezogenen Daten“. Wetter-URLs und Kalenderlogs gezielt prüfen. [Sentry-Dokumentation](https://docs.sentry.io/platforms/react-native/data-management/data-collected/).
- Shop-Cookies, Checkout-Weiterleitungen, Zahlungsanbieter, Telefonnummer-Feld, Marketing/Analytics und Aufbewahrung im tatsächlichen Android-WebView prüfen. Keine pauschale Ausnahme „externer Shop“ verwenden.
- [Löschumfang](support-und-loeschung.md) und [Datensicherheitsentscheidungen](datensicherheit.md) vervollständigen. Die technische Prüfung hier ist keine medizinische oder rechtliche Zulassungsfeststellung.
