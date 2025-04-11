# Wehen-Tracker App

Eine React Native App zum Aufzeichnen und Verfolgen von Wehen während der Schwangerschaft. Die App verwendet Supabase für Authentifizierung und Datenspeicherung.

## 🚀 Funktionen

- **Wehen-Tracking**: Starten und Stoppen eines Timers für Wehen
- **Verlaufsanzeige**: Anzeige der aufgezeichneten Wehen mit Dauer und Abständen
- **Warnungen**: Benachrichtigungen, wenn Wehen in kurzen Abständen auftreten
- **Benutzerkonten**: Registrierung und Anmeldung mit E-Mail und Passwort
- **Cloud-Speicherung**: Speicherung der Wehen in Supabase für Zugriff auf verschiedenen Geräten

## 🛠️ Technologien

- [React Native](https://reactnative.dev/) - Mobile App Framework
- [Expo](https://expo.dev/) - React Native Toolchain
- [Expo Router](https://docs.expo.dev/router/introduction/) - Routing und Navigation
- [Supabase](https://supabase.com/) - Backend-as-a-Service für Authentifizierung und Datenbank
- [TypeScript](https://www.typescriptlang.org/) - Typsicheres JavaScript

## 📋 Voraussetzungen

- [Node.js](https://nodejs.org/) (v18 oder höher)
- [npm](https://www.npmjs.com/) oder [yarn](https://yarnpkg.com/)
- [Expo CLI](https://docs.expo.dev/workflow/expo-cli/)
- Ein [Supabase](https://supabase.com/)-Konto

## 🚀 Entwicklung

```sh
# Starten der Entwicklungsumgebung
npm start

# Starten auf Android
npm run android

# Starten auf iOS
npm run ios

# Starten im Web-Browser
npm run web
```

## 📱 EAS Update

Dieses Projekt ist für EAS Update konfiguriert, was Over-the-Air Updates ermöglicht, ohne neue App-Versionen in den App Stores veröffentlichen zu müssen.

### Updates veröffentlichen

```sh
# Veröffentlichen eines Updates für alle Kanäle
eas update

# Veröffentlichen eines Updates für einen bestimmten Kanal
eas update --channel production
```

### Builds erstellen

```sh
# Erstellen einer Entwicklungsversion
eas build --profile development

# Erstellen einer Vorschauversion
eas build --profile preview

# Erstellen einer Produktionsversion
eas build --profile production
```

## 🔄 Git-Workflow

Das Projekt verwendet einen Master-Branch für die Hauptentwicklung. Wenn Sie Code zum Master-Branch pushen, wird automatisch ein neues EAS Update veröffentlicht (wenn GitHub Actions konfiguriert ist).

## 📝 Weitere Ressourcen

- [Expo Router: Dokumentation](https://docs.expo.dev/router/introduction/)
- [EAS Update: Dokumentation](https://docs.expo.dev/eas-update/introduction/)
- [EAS Build: Dokumentation](https://docs.expo.dev/build/introduction/)
- [Supabase: Dokumentation](https://supabase.com/docs)

## 🔧 Supabase-Einrichtung

Für detaillierte Anweisungen zur Einrichtung von Supabase für dieses Projekt, siehe die Datei `SUPABASE_SETUP.md`.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
