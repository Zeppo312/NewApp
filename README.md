# Lotti Baby 🍼

Lotti Baby ist eine React-Native-App (iOS, Android, Web), die Eltern durch **Schwangerschaft und das erste Babyjahr** begleitet – von der Wehen-Aufzeichnung über die Schwangerschafts-Woche bis zum Tracking von Schlaf, Gewicht und Meilensteinen des Babys. Die App ist mit Expo gebaut und nutzt ein duales Backend aus Supabase und Convex.

> Historie: Die App ist aus einem reinen „Wehen-Tracker" entstanden und mittlerweile zu einem vollständigen Schwangerschafts- und Baby-Begleiter gewachsen.

## 🚀 Funktionen

### Schwangerschaft
- **Schwangerschafts-Home & Countdown**: Aktuelle SSW, Countdown bis zum errechneten Termin
- **Baby-Größe / „Baby-Size"**: Wöchentlicher Vergleich der Babygröße (z. B. mit Obst/Gemüse)
- **Wochenmoment**: Wöchentliche Momente und Updates zur Schwangerschaft
- **Wehen-Tracking**: Timer zum Starten/Stoppen von Wehen inkl. Dauer, Abständen und Warnungen bei kurzen Intervallen
- **Geburtsplan**: Erstellen und Verwalten eines persönlichen Geburtsplans
- **Babynamen**: Sammeln und Verwalten von Namensideen
- **Arztfragen / Doctor Questions**: Fragen für den nächsten Arzttermin festhalten

### Baby & Familie
- **Baby-Profil & Statistiken**: Mehrere Babys, Stammdaten, Wachstumswerte
- **Schlaf-Tracker**: Schlafphasen aufzeichnen inkl. Auswertungen und Zusammenfassungen
- **Gewichts- & Größen-Tracker**: Wachstumsverlauf dokumentieren
- **Meilensteine**: Entwicklungs-Meilensteine festhalten
- **Zahn-Tracker**: Durchbruch der Milchzähne dokumentieren
- **Tagebuch**: Persönliche Einträge und Erinnerungen
- **Rezepte**: Eigene Rezepte verwalten und Rezeptideen generieren

### Community & Sharing
- **Community & Gruppen**: Austausch mit anderen Eltern, Gruppen-Chats
- **Account-Verknüpfung**: Partner einladen und Daten teilen (z. B. zweiter Elternteil)
- **Selfcare & Blog**: Inhalte rund um Wohlbefinden und Schwangerschaft
- **Baby-Wetter**: Wetterbezogene Hinweise
- **Lottis Empfehlungen**: Kuratierte Empfehlungen
- **Benachrichtigungen & Live Activities**: Push-Erinnerungen und iOS Live Activities

### Konto & Abo
- **Benutzerkonten**: Registrierung/Anmeldung per E-Mail sowie Sign in with Apple
- **Abonnement**: Monats- und Jahresabo via RevenueCat (siehe unten)
- **Feature-Requests & Support**: Wünsche einreichen und Hilfe erhalten

## 🛠️ Technologien

- [Expo](https://expo.dev/) (SDK 55) + [React Native](https://reactnative.dev/) 0.83 – App-Framework
- [Expo Router](https://docs.expo.dev/router/introduction/) – Datei-basiertes Routing/Navigation
- [TypeScript](https://www.typescriptlang.org/) – Typsicheres JavaScript
- [Supabase](https://supabase.com/) – Auth, Datenbank, Storage
- [Convex](https://www.convex.dev/) – Reaktives Backend (parallel zu Supabase, per Admin-Schalter umschaltbar)
- [RevenueCat](https://www.revenuecat.com/) – Abo-Status & In-App-Käufe (`react-native-purchases`)
- [Sentry](https://sentry.io/) – Fehler- und Crash-Monitoring
- [Reanimated](https://docs.swmansion.com/react-native-reanimated/) & [Skia](https://shopify.github.io/react-native-skia/) – Animationen und Grafik
- `expo-notifications`, `expo-task-manager`, `expo-live-activities` – Push, Hintergrund-Tasks, Live Activities

## 🔀 Backend (Supabase + Convex)

Die App unterstützt zwei Backends parallel. Das aktive Backend wird über `BackendContext` verwaltet und in den User-Settings gespeichert; **nur Admins** können im UI zwischen `supabase` und `convex` umschalten. Standard ist `supabase`.

- Supabase-spezifische Logik liegt in `lib/` und ist in `SUPABASE_SETUP.md` dokumentiert.
- Convex-Funktionen und das Schema liegen im Verzeichnis `convex/` (siehe `CONVEX_IMPLEMENTATION.md` und `CONVEX_DEPLOYMENT_STEPS.md`).

## 💳 Abonnement (RevenueCat)

Diese App verwendet RevenueCat (`react-native-purchases`) für zwei Abos: Monatsabo und Jahresabo.

- **Entitlement:** `LottiBabyAbo` (RevenueCat-ID `ent7a7b4e9838`)
- **Offering:** `default`
- **Produkte:** `lottibaby_monthly`, `lottibaby_yearly`
- **Umgebungsvariablen (Public SDK Keys):**
  - `EXPO_PUBLIC_RC_IOS_KEY` (iOS, beginnt i. d. R. mit `appl_…`)
  - `EXPO_PUBLIC_RC_ANDROID_KEY` (Android, beginnt i. d. R. mit `goog_…`, optional sobald Android hinzugefügt wird)
- **EAS Build:** Lege die RevenueCat-Keys als EAS Secret bzw. Environment Variable an, nicht direkt in `eas.json`.
- **Hinweis zu Expo Go:** In Expo Go läuft `react-native-purchases` im Preview API Mode. Dafür muss `EXPO_PUBLIC_RC_IOS_KEY` der RevenueCat **Test Store Key** sein (beginnt mit `test_…`). Für echte Käufe benötigst du eine Development Build/TestFlight mit dem App-Store Key (`appl_…`).
- **Wichtig für EAS Update/TestFlight:** `EXPO_PUBLIC_*`-Werte landen im JS-Bundle. Veröffentliche `preview`/`production`-Builds oder OTA-Updates daher nie mit einem iOS-Test-Store-Key (`test_…`), sondern nur mit dem echten App-Store-Key (`appl_…`).

## 📋 Voraussetzungen

- [Node.js](https://nodejs.org/) (v20.19.4 oder höher – siehe `engines` in `package.json`)
- [npm](https://www.npmjs.com/)
- [Expo CLI](https://docs.expo.dev/workflow/expo-cli/) / EAS CLI
- Ein [Supabase](https://supabase.com/)-Konto (und ggf. ein [Convex](https://www.convex.dev/)-Projekt)

## 🚀 Entwicklung

```sh
# Abhängigkeiten installieren
npm install

# Entwicklungsumgebung starten
npm start

# Auf iOS starten (Dev-Build mit Hermes)
npm run ios

# Auf Android starten
npm run android

# Im Web-Browser starten
npm run web

# Linting
npm run lint

# Tests (Jest)
npm test
```

> Hinweis: Viele Funktionen (RevenueCat, Live Activities, Notifications) benötigen einen **Development Build** und laufen nicht vollständig in Expo Go.

## 📱 EAS Update

Dieses Projekt nutzt EAS Update für Over-the-Air-Updates, ohne neue App-Versionen in den Stores veröffentlichen zu müssen.

```sh
# Preview-Update: niemals ein automatisches Branch-Update verwenden.
npm run update:preview -- --message "Beschreibung der Änderung"

# Production-Update: erst nach erfolgreichem TestFlight-Test.
npm run update:production -- --message "Beschreibung der Änderung"
```

Die Update-Skripte verlangen immer einen expliziten Kanal, das passende EAS-Environment und eine Beschreibung. Ein Expo-SDK-, Berechtigungs- oder Native-Module-Update benötigt stattdessen einen neuen EAS Build und darf nicht per OTA-Update ausgeliefert werden.

## 🏗️ Builds erstellen

```sh
# Entwicklungsversion
eas build --profile development

# Vorschauversion
eas build --profile preview

# Produktionsversion
eas build --profile production
```

## 🔄 Git-Workflow

Hauptentwicklung erfolgt auf dem `master`-Branch. Pushes können (sofern GitHub Actions konfiguriert ist) automatisch ein EAS Update auslösen.

## 📂 Projektstruktur (Auszug)

```
app/            Bildschirme & Routen (Expo Router, file-based)
  (auth)/       Auth-Flows
  (tabs)/       Haupt-Tabs (Home, Baby, Tracker, Community, …)
components/     Wiederverwendbare UI-Komponenten
contexts/       React Contexts (Auth, Backend, Theme, ActiveBaby, …)
convex/         Convex-Schema & -Funktionen
lib/            Supabase-Client & Geschäftslogik
hooks/          Custom Hooks
constants/      Konstanten & Theme-Werte
plugins/        Expo Config Plugins (RevenueCat, Live Activities)
assets/         Bilder, Fonts, Icons
```

## 📝 Weitere Dokumentation

- `SUPABASE_SETUP.md` – Supabase-Einrichtung
- `CONVEX_IMPLEMENTATION.md` / `CONVEX_DEPLOYMENT_STEPS.md` – Convex-Setup & -Deployment
- `DesignGuide.md` / `DESIGN_GUIDE.md` – Design-Richtlinien
- `EXPO_SDK_54_UPDATE_GUIDE.md`, `EXPO_UPDATE_GUIDE.md` – Expo-Update-Hinweise

## 📚 Externe Ressourcen

- [Expo Router: Dokumentation](https://docs.expo.dev/router/introduction/)
- [EAS Update: Dokumentation](https://docs.expo.dev/eas-update/introduction/)
- [EAS Build: Dokumentation](https://docs.expo.dev/build/introduction/)
- [Supabase: Dokumentation](https://supabase.com/docs)
- [Convex: Dokumentation](https://docs.convex.dev/)
- [RevenueCat: Dokumentation](https://www.revenuecat.com/docs)
</content>
</invoke>
