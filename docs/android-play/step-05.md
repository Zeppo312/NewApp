# Schritt 5 – Android-QA

10.09.2026 · **Teilprüfung durchgeführt, Abschluss noch offen.** Eine echte Android-App wurde installiert und bedient; zwei Fehler wurden behoben. Das angefragte Testkonto liegt noch nicht vor. Daher fehlen authentifizierte Kernabläufe. Keine Käufe, Deployments oder Änderungen an Produktionsdaten.

## Testumgebung

Pixel-6-AVD `lotti-step02-api36`, Android **16 / API 36**, ARM64, 1080 × 2400, Englisch, 4-KB-Seiten. App **1.0.23 (9)**, Paket **`com.LottiBaby.app`**, Target 36. Lokal debug-signiertes ARM64-APK, ca. 131 MB; Paket, ABI und Signatur geprüft. Bestehender Arbeitsbaum einschließlich Schritt 3 über Metro 8083, kein Expo Go oder Mock-Abo. Schritt 4 ist laut Übergabe noch nicht deployed.

## Ergebnismatrix

| Prüfung | Ergebnis |
| --- | --- |
| Start | Installation und wiederholter Start bis zum Login erfolgreich; Crash-Buffer leer. Kaltstart über Dev-Client/Metro, **kein eigenständiger Release-Start**. |
| Login / Registrierung | Oberflächen, Registrierungswechsel, optionaler Einladungscode und gesperrter Submit ohne Zustimmung geprüft. Anmeldung, Registrierung/Verifikation, Logout und Kontowechsel **offen**. |
| Tastatur | Öffnen, Feldfokus, Scrollen und Zurück bei 100/130 % Schriftgröße geprüft; Felder und Buttons erreichbar, Header kehrt zurück. ADB-Enter fokussierte Passwort, schloss aber die Tastatur; Bildschirm-IME-„Weiter“ damit nicht separat bestätigt. |
| Onboarding | Bestehende Route direkt geöffnet: alle 17 Oberflächen „Baby geboren / Tagesübersicht“ bis zur Zusammenfassung durchlaufen, Pflichtfelder und interaktive Vorschau geprüft. **Nicht gespeichert**, Schwangerschafts-/Partnerpfad offen. Vorschau ist kein Kerntracking-Nachweis. |
| Zurück | Onboarding-Fehler behoben und erneut geprüft: erst Tastatur schließen, dann vorheriger Schritt, Name bleibt erhalten. Im Datumsdialog schließt Zurück nur den Dialog. Paywall blockiert Zurück entsprechend dem bestehenden Pflichtzugang. |
| Datum / Zeit | Nativer Geburtstagskalender: Abbrechen ohne Übernahme, erneut öffnen, 09.09.2026 bestätigen; Zukunft gesperrt. Uhrzeit und kombinierte Datum-/Zeitfolge im Tracking **offen**. |
| Kerntracking | Ohne Session korrekte Weiterleitung zum Login. Schlaf-/Still-/Flaschen-/Windeleinträge, Timer, Änderungen/Löschen, Persistenz und Synchronisierung **offen**. |
| Berechtigungen | Kamera im Gastscanner: echter Systemdialog, ablehnen, erneut anfordern, zustimmen, Kameravorschau. Manuelle Codeeingabe und gesperrter leerer Submit geprüft. Mikrofon, Fotos, Standort und Kalender **offen**. |
| Benachrichtigungen | Keine Zustellung/Navigation geprüft; Einstellungen verlangen Login, `POST_NOTIFICATIONS` blieb nicht gewährt. Lokale Erinnerungen/Schlafbenachrichtigung **offen**; Remote-Push zusätzlich ohne bestätigte FCM-Konfiguration. |
| Paywall | Monat/Jahr, Lite/Premium, Google-Play-Texte und fehlende Preise geprüft. Kaufbutton gesperrt, Tippen öffnet keinen Kaufdialog; Restore in dieser Sitzung ebenfalls deaktiviert. **Konfigurationszustand, kein Kauf-/Restore-Nachweis.** |

## Fixes und Nachprüfung

- **Build-Blocker:** Der vorhandene [EAS-Build](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/7d6aed0b-3d13-45bf-9555-c0d16d0b97c8) war an `jcenter()` in `react-native-os@1.2.6` gescheitert; lokal folgte der Fehler bei `compile()`. Neuer `patches/react-native-os+1.2.6.patch` ersetzt beide durch `mavenCentral()` / `implementation`. Danach native Kompilierung, APK, Installation und Start erfolgreich. Kein SDK-Upgrade. [Gradle-Dokumentation](https://docs.gradle.org/current/userguide/upgrading_major_version_9.html#removal_of_deprecated_jcenter).
- **Onboarding-Zurück:** Vorher führte Hardware-Zurück aus Schritt 2 zum Android-Startbildschirm. `app/(auth)/getUserInfo.tsx` nutzt jetzt einen auf den fokussierten Android-Screen begrenzten `BackHandler` mit der bestehenden Schrittlogik. Nachprüfung: Tastatur zuerst geschlossen; Schritt 2 → 1 → 2 erhält „Android-QA“; Datum-Abbruch unverändert. iOS-Verhalten bleibt bestehen.
- **Checks:** Vorab 75/75 Tests in 9 Suiten; nach Fix 43/43 in 4 relevanten Suiten. App-Typecheck und `git diff --check` erfolgreich. ESLint: 0 Fehler, 2 vorhandene Effect-Warnungen. Nach hängender Watchman-Ermittlung lief Jest mit `--watchman=false` erfolgreich.

Ein sehr früh nach Kaltstart gesendeter zusätzlicher Deep Link erzeugte eine nicht fatale React-Warnung aus `expo-router/ExpoRoot` („state update … hasn't mounted yet“). Login danach erreichbar, kein nativer Crash; diese Start-Race bleibt ungeklärt.

## Screenshots

[Login](step-05-screenshots/01-login.png) · [Tastatur 130 %](step-05-screenshots/02-keyboard-130.png) · [Zurück-Fix: Name erhalten](step-05-screenshots/03-onboarding-back-fixed.png) · [Datumsdialog](step-05-screenshots/04-date-picker.png) · [Kamera-Systemdialog](step-05-screenshots/05-camera-permission.png) · [Gesperrte Paywall](step-05-screenshots/06-paywall-disabled.png) · [Onboarding-Zusammenfassung](step-05-screenshots/07-onboarding-summary.png)

## Noch erforderlich

Testkonto mit geeigneter Testberechtigung/Testbaby und erlaubten Testeinträgen; für Neuregistrierung zusätzlich eine freigegebene E-Mail-Adresse. Damit die offenen Matrixzeilen nachholen. Für echte Käufe gelten Schritte 8–11. Vor Emulator-Benachrichtigungstests den vorhandenen `Device.isDevice`-Guard in `hooks/useNotifications.ts` prüfen: Er sperrt diesen Hook auf Emulatoren; hier nur Codebefund, kein behobener Laufzeitfall.

**Lokale Fortsetzung:** Emulator und eigener Metro auf 8083 bleiben bereit. Wegen Platzmangel liegen Systemimage, Gradle-Cache und erzeugte App-Builddateien per Symlink auf dem angeschlossenen **USB-Stick**; dieser wird weiterhin benötigt. APK: `android/app/build/outputs/apk/debug/app-debug.apk`. [Werkzeugpfade und Buildbefehl](step-05-environment.md). Vollständige XML-/Bild-/Lognachweise und APK-Hash: `artifacts/android/2026-09-10-step05/` (Git-ignoriert). Persönliche Dateien und vorhandene Metro-Server 8081/8082 blieben unberührt.

Geändert: die zwei oben genannten Code-/Patchdateien, dieser Bericht, Umgebungsnotiz und Screenshots. Vorhandene Arbeit aus 2–4 erhalten; nichts gestagt oder committet.
