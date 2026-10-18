# Schritt 5 – Lokale Testumgebung

Ergebnisse und offene Prüfungen: [QA-Bericht](step-05.md).

Der temporäre Android-SDK-Pfad bleibt `/tmp/lotti-android-tools/sdk`. Wegen mehrfach reproduziertem `No space left on device` wurden ausschließlich QA-Werkzeuge/erzeugte Ausgaben ausgelagert: `sdk/system-images`, `~/.gradle/caches/9.3.1` und `android/app/build` sind Symlinks auf den genannten USB-Ordner. **USB-Stick muss für diese Umgebung angeschlossen bleiben.** Keine persönlichen Dateien gelöscht; nur der fehlgeschlagene eigene Gradle-Download, unvollständige Packaging-Ausgaben und nach erfolgreichem Build entbehrliche C++-Objekte entfernt. Ein späterer nativer Build kann diese Objekte erneut erzeugen.

Lokaler Build (Repo-Wurzel; kein Prebuild/Store-Upload):

```sh
JAVA_HOME=/tmp/lotti-android-tools/jdk-17.0.20.1+1/Contents/Home \
ANDROID_HOME=/tmp/lotti-android-tools/sdk \
/tmp/lotti-android-tools/gradle-9.3.1/bin/gradle -p android :app:assembleDebug \
  -I artifacts/android/2026-09-10-step05/local-ndk.init.gradle \
  -PreactNativeArchitectures=arm64-v8a --max-workers=2 --console=plain
```

Die lokale Init-Datei vereinheitlicht den bereits installierten NDK r27b für Bibliotheken und filtert das APK auf ARM64. Dies sind lokale QA-Parameter, keine geänderten Store-Profile. Metro läuft separat auf 8083 mit leerem `EXPO_PUBLIC_MOCK_SUBSCRIPTION_TIER`; Verbindung per `adb reverse tcp:8083 tcp:8083` und `exp+lottibaby://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8083`. Bestehende Metro-Server auf 8081/8082 wurden nicht verändert. Schriftgröße und Android-Animationsskalen nach Prüfung auf Standard zurückgestellt.

Geänderte Projektdateien dieses Auftrags: `app/(auth)/getUserInfo.tsx`, neuer `patches/react-native-os+1.2.6.patch`, diese Übergabe und `step-05-screenshots/`. Bestehende Änderungen aus 2–4 erhalten, nichts gestagt/committet.


Nachweise einschließlich APK-SHA-256, Gerätefingerabdruck, UI-Bäumen und vollständigen Testlogs: `artifacts/android/2026-09-10-step05/`. Das APK ist lokal debug-signiert; der Onboarding-Fix wird aus dem aktuellen Arbeitsbaum über Metro geladen.
