# Lotti Baby 🍼

Lotti Baby begleitet Eltern durch die Schwangerschaft und den Alltag mit Baby. Die App verbindet Schwangerschaftsbegleitung, gemeinsame Baby-Tracker, Familienorganisation und Austausch mit anderen Eltern. Dazu kommen „Frag Lotti“, Spracheingaben und persönliche Hinweise aus den erfassten Alltagsdaten.

Die App wird mit React Native und Expo für iOS und Android entwickelt. Ein Web-Einstieg ist ebenfalls vorhanden; native Funktionen wie iOS-Widgets und Live Activities stehen dort nicht zur Verfügung. Die Oberfläche unterstützt **Deutsch, Englisch und Spanisch** sowie helle und dunkle Darstellung.

## Funktionen

### Schwangerschaft und Geburtsvorbereitung

- **Schwangerschafts-Startseite:** aktuelle Schwangerschaftswoche, Countdown, Größenvergleiche und Wochenmomente.
- **Schwangerschaftsverlauf:** Werte und Check-ins festhalten sowie ein persönliches Schwangerschaftsbriefing aufrufen.
- **Geburtsvorbereitung:** Wehen messen, Geburtsplan erstellen, Klinik-Checkliste pflegen, Babynamen sammeln und Fragen für Arzttermine notieren.
- **Zyklus-Tracker:** Zyklus und Periode dokumentieren.

### Baby und gemeinsamer Alltag

- **Baby-Profile:** mehrere Babys verwalten und zwischen ihnen wechseln.
- **Tagesübersicht:** Stillen, Flasche, Wickeln und weitere Aktivitäten dokumentieren; Erinnerungen unterstützen den Alltag.
- **Schlaf-Tracker:** laufende Schlafphasen, Verlauf, Auswertungen und Hinweise zu Schlaffenstern.
- **Entwicklung:** Gewicht, Größe, Meilensteine, Zähne und Tagebucheinträge festhalten.
- **Partner-Verknüpfung:** ein weiteres Elternteil einladen und Baby-Daten gemeinsam nutzen.
- **Planer:** gemeinsame Termine und Erinnerungen mit Kalender-Synchronisierung.
- **Einkauf und Vorräte:** Einkaufslisten, Bestände und Produkte per Barcode erfassen; Kundenkarten verwalten.
- **Rezepte und Baby-Wetter:** Rezeptideen und eigene Rezepte sowie wetterbezogene Kleidungshinweise.

### Lotti als Begleitung

- **Frag Lotti:** Fragen im Kontext der Schwangerschaft oder des Babys stellen und Gespräche fortführen.
- **Spracheingaben:** Alltagseinträge aus Sprache erfassen und vor der Übernahme prüfen.
- **Lottis Fürsorge:** persönliche Hinweise auf Grundlage der erfassten Daten.
- **Selfcare, Blog und Empfehlungen:** Inhalte und Anregungen für Eltern.

### Community und Gerätefunktionen

- **Community:** Beiträge, Gruppen, private Chats und Gruppen-Chats mit Sprachnachrichten sowie Melde- und Blockierfunktionen.
- **Benachrichtigungen:** Erinnerungen und Hinweise zu gemeinsamen Aktivitäten, Terminen und Nachrichten.
- **iOS-Widgets:** Schlaf, Einkaufsliste und Planer direkt auf dem Home-Bildschirm.
- **iOS Live Activities:** laufende Aktivitäten auf dem Sperrbildschirm.
- **Konto:** E-Mail-Anmeldung mit OTP-Verifizierung, Sign in with Apple, Profil- und Spracheinstellungen.

Einzelne Funktionen hängen vom Abo, der Plattform, erteilten Berechtigungen und eingerichteten Backend-Diensten ab.

## Technischer Stand

Die Versionsangaben beziehen sich auf [package.json](package.json); App-Version und native Konfiguration stehen in [app.json](app.json) und [app.config.js](app.config.js).

| Bereich | Umsetzung |
| --- | --- |
| App-Framework | Expo SDK 57, React Native 0.86.2, React 19.2.3 |
| Navigation | Expo Router mit dateibasierten Routen |
| Sprache | TypeScript 6 |
| Backend | Supabase: Auth, Postgres, Realtime, Storage und Edge Functions |
| Abonnements | RevenueCat mit `react-native-purchases` |
| Oberfläche | Reanimated, Skia und eigene UI-Komponenten |
| Native Erweiterungen | Expo Config Plugins, Swift-Module und WidgetKit-Targets |
| Fehlerberichte | Sentry |
| Prüfung | ESLint, TypeScript und Jest mit `jest-expo` |

### Backend

**Supabase ist das aktive Backend.** Der `BackendContext` setzt beim Start bzw. beim Benutzerwechsel Supabase als Backend. Der `ConvexProvider` ist deaktiviert und erzeugt weder Client noch Verbindung oder Benutzersynchronisierung.

Das Verzeichnis `convex/`, die Dependency und frühere Integrationsdokumente sind weiterhin vorhanden. Sie beschreiben keine aktuell aktive alternative Backend-Konfiguration; ein Convex-Projekt ist für den aktuellen App-Start nicht erforderlich.

- [lib/supabase.ts](lib/supabase.ts): Supabase-Client und zentrale Datenzugriffe.
- `lib/`, `hooks/` und `services/`: Fachlogik, Synchronisierung und Anbindung der App.
- `supabase/migrations/`: Datenbankschema und Migrationen.
- `supabase/functions/`: serverseitige Funktionen unter anderem für Lotti, Benachrichtigungen, Moderation und RevenueCat.

## Lokal entwickeln

### Voraussetzungen

- Node.js gemäß `engines` in [package.json](package.json): mindestens **20.19.4**. `.nvmrc` und `.node-version` sind ebenfalls auf 20.19.4 gesetzt.
- npm; das Repository enthält ein `package-lock.json`.
- Für lokale iOS-Builds: macOS, Xcode und CocoaPods.
- Für lokale Android-Builds: Android Studio mit SDK und Emulator oder ein angeschlossenes Gerät.
- Zugriff auf das vorgesehene Supabase-Projekt; für EAS-Builds und Updates zusätzlich EAS CLI und Zugriff auf das verknüpfte Expo-Projekt.

### Installation und Konfiguration

```sh
npm ci
```

Der Postinstall-Schritt wendet die Repository-Patches aus `patches/` mit `patch-package` an.

**Supabase:** Projekt-URL und öffentlicher Anon-Key sind derzeit direkt in [lib/supabase.ts](lib/supabase.ts) hinterlegt. Ein frischer Checkout verbindet sich dadurch mit dem dort konfigurierten Projekt. Für ein eigenes Backend müssen diese Werte und weitere projektspezifische Verweise geprüft sowie Schema, Storage, Auth und benötigte Edge Functions eingerichtet werden. `EXPO_PUBLIC_SUPABASE_URL` wird in Teilen der App verwendet, ersetzt aber nicht die Konfiguration des zentralen Clients.

**RevenueCat:** Für die jeweilige Plattform die öffentlichen SDK-Keys in einer lokalen, nicht versionierten `.env.local` setzen:

```dotenv
EXPO_PUBLIC_RC_IOS_KEY=appl_DEIN_PUBLIC_SDK_KEY
EXPO_PUBLIC_RC_ANDROID_KEY=goog_DEIN_PUBLIC_SDK_KEY
```

Die App akzeptiert außerdem die älteren Variablennamen `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` und `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. Serverseitige Schlüssel gehören in die Konfiguration der jeweiligen Edge Function. `EXPO_PUBLIC_*`-Werte werden in das App-Bundle übernommen und dürfen keine privaten Schlüssel enthalten.

### Startbefehle

```sh
# Metro starten
npm start

# Metro für einen vorhandenen Development Build über localhost starten
npm run start:dev-client:localhost

# Lokal für iOS bauen und starten (Hermes, eigener Start-Wrapper)
npm run ios

# Auf einem iOS-Gerät starten, ohne erzwungenen localhost-Proxy
npm run ios:device

# Lokal für Android bauen und starten
npm run android

# Web-Entwicklung starten
npm run web
```

Für die vollständige native App einen **Development Build** verwenden. Expo Go bietet keine vollständige Unterstützung für die eigenen nativen Module, Widgets und Live Activities. Die RevenueCat-Anbindung verlangt in Expo Go unter iOS einen Test-Store-Key (`test_…`); echte Käufe werden dort nicht unterstützt. Für TestFlight und App Store muss der iOS-Key mit `appl_` beginnen.

### Code prüfen

```sh
npm run lint
npm run typecheck
npm test

# Tests während der Entwicklung beobachten
npm run test:watch
```

## Abonnements

Lotti Baby unterstützt **Lite, Standard und Premium**, jeweils monatlich oder jährlich. Die Zuordnung der Funktionen wird über eine konfigurierbare Feature-Policy gesteuert. Die lokale Standardbelegung liegt in [lib/subscriptionFeaturePolicy.ts](lib/subscriptionFeaturePolicy.ts):

| Tarif | Standardmäßig enthalten |
| --- | --- |
| Lite | Basis-Tracker, Partner-Verknüpfung, Planer, Einkaufsliste und Rezepte |
| Standard | Zusätzlich Wochenmomente, PDF-Export, vollständiger Verlauf und Monatsansichten für Schlaf und Tagesübersicht |
| Premium | Zusätzlich Spracheingaben, Lottis Fürsorge, Frag Lotti und Schwangerschaftsbriefing |

Die serverseitige Policy kann diese Zuordnung ändern. Details zur Freischaltung und Durchsetzung stehen in [subscription-feature-policy-rollout.md](docs/subscription-feature-policy-rollout.md).

- **Entitlements:** `LottiBabyLite`, `LottiBabyAbo` (Standard), `LottiBabyPremium`.
- **Offering:** `default`.
- **Produkte:** `lottibaby_{lite|standard|premium}_{monthly|yearly}`.
- **Legacy-Standardprodukte:** `lottibaby_monthly`, `lottibaby_yearly`.
- **Serverseitige Verarbeitung:** `supabase/functions/revenuecat-webhook/`.

Die öffentlichen RevenueCat-Keys für Builds und OTA-Updates im passenden EAS-Environment hinterlegen. Preview und Production müssen für iOS den App-Store-Key verwenden.

## Builds und Updates

Die Profile sind in [eas.json](eas.json) definiert:

| Profil | Zweck |
| --- | --- |
| `development` | Interner Development Build |
| `development-simulator` | iOS-Simulator mit Development Client |
| `preview` | Interne Vorschau auf dem Preview-Kanal |
| `preview-testflight` | iOS-Store-Build für TestFlight auf dem Preview-Kanal |
| `production` | Produktionsbuild auf dem Production-Kanal |

```sh
# Development Build für iOS
eas build --platform ios --profile development

# TestFlight-Build auf dem Preview-Kanal
eas build --platform ios --profile preview-testflight

# Produktionsbuild für iOS
eas build --platform ios --profile production
```

OTA-Updates über die vorhandenen Skripte veröffentlichen:

```sh
npm run update:preview -- --message "Beschreibung der Änderung"

# Nach erfolgreichem Test in TestFlight
npm run update:production -- --message "Beschreibung der Änderung"
```

Diese beiden Skripte zielen ausdrücklich auf **iOS**. Der Wrapper verlangt Kanal, gleichnamiges EAS-Environment und eine Beschreibung, lehnt `--auto` und `--branch` ab und bereinigt vor dem Export `dist/`. Änderungen am Expo SDK, an nativen Modulen oder Berechtigungen benötigen einen neuen Build mit passender Runtime-Version.

**Bestehende CI-Abweichung:** [.github/workflows/eas-update.yml](.github/workflows/eas-update.yml) reagiert auf Pushes nach `master` und ruft noch direkt `eas update --auto` auf. Damit verwendet die Action nicht die Prüfungen des npm-Wrappers. Für diesen automatischen Veröffentlichungsweg ist eine gesonderte Anpassung erforderlich.

## Projektstruktur

```text
app/                  Screens und Expo-Router-Routen
  (auth)/             Anmeldung und OTP-Verifizierung
  (tabs)/             Schwangerschaft, Baby-Alltag, Tracker und weitere Bereiche
  planner/            Familienplaner
  chat/, group-chat/  Private Chats und Gruppen-Chats
components/           Wiederverwendbare UI und Feature-Komponenten
contexts/             Auth, aktives Baby, Sprache, Theme und Abo-Zugriff
hooks/                Hooks für Daten und UI-Verhalten
lib/                  Fachlogik, Übersetzungen, Caches und Backend-Zugriffe
services/             Weitere Service-Anbindungen
supabase/             Migrationen und Edge Functions
convex/               Frühere, aktuell deaktivierte Backend-Integration
native-modules/       Native Bridges für Live Activities und Widgets
plugins/              Expo Config Plugins
targets/widget/       iOS-Widgets und Live-Activity-Target
ios/, android/        Native Projekte
assets/               Bilder, Fonts und Plattform-Lokalisierungen
patches/              Dependency-Patches für den Postinstall-Schritt
scripts/              Lokale Entwicklung, Updates und Wartung
docs/                 Feature- und technische Dokumentation
store/                Store-Materialien
```

## Weiterführende Dokumentation

Die Detaildokumente stammen aus unterschiedlichen Entwicklungsständen. Bei Abweichungen sind der aktuelle Code, die Konfigurationsdateien und die Migrationen maßgeblich.

- [Supabase-Einrichtung](SUPABASE_SETUP.md) und [Tabellenübersicht](docs/supabase_tables.md).
- [Authentifizierung](docs/AUTHENTICATION_SETUP.md) und [OTP-Einrichtung](docs/OTP_SETUP_GUIDE.md).
- [Frag Lotti](docs/FRAG_LOTTI_SUPABASE_SETUP.md) und [Lottis Fürsorge](docs/ANLEITUNG_SUPABASE_FUERSORGE.md).
- [Termine und Planer](docs/termine.md) und [Schlaf-Synchronisierung](docs/sleep_tracking_sync_implementation.md).
- [Community](docs/Community.md) und [Babynamen-Übersetzungen](docs/BABY_NAMES_TRANSLATIONS.md).
- [Abo-Feature-Policy](docs/subscription-feature-policy-rollout.md).
- [Design-Richtlinien](docs/DesignGuidelines.md).

Die Dokumente `CONVEX_IMPLEMENTATION.md`, `CONVEX_DEPLOYMENT_STEPS.md` sowie die älteren Expo-SDK-Update-Guides dienen als historische Referenz.
