# Schritt 2 – Android-Build und Signierung

Prüfdatum: 10.09.2026. Voraussetzung: [Schritt 1](step-01.md). Kein Store-Upload, kein OTA-Update und keine Änderung an bestehenden iOS-Signierungsdaten.

**Ergebnis: Vorbereitung umgesetzt, Abschluss über dokumentierte externe Blocker.** Letzter Status am 10.09.2026 um **14:00 UTC / 16:00 MESZ**: Preview-Auftrag seit 13:32 UTC in EAS `IN_QUEUE` / `Free Tier Queue`, keine Buildlogs und keine Artefakt-URL. Es existiert deshalb in diesem Auftrag **noch kein erzeugtes/verifiziertes APK und kein App-Startnachweis**. Der Store-AAB-Pfad ist zusätzlich durch die fehlende RevenueCat-Google-App samt SDK-Key blockiert. Die Emulator-/Werkzeugvorbereitung ist erfolgreich; der Emulator wurde nach der Prüfung beendet. Der Cloud-Build bleibt eingereiht, es läuft keine automatische spätere Artefaktprüfung.

## Buildstatus und Artefakte

- Android Preview-Build gestartet: [7d6aed0b-3d13-45bf-9555-c0d16d0b97c8](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/7d6aed0b-3d13-45bf-9555-c0d16d0b97c8).
- Profil `preview`, Distribution `internal`, APK, Kanal `preview`, EAS-Umgebung `preview`, Version `1.0.23`, **remote versionCode 3**. Der lokale Code 9 ist bei EAS nicht maßgeblich. Kein manueller Rücksetzvorgang; Store-Profile erhöhen den Remote-Code automatisch.
- Lokale Nachweise liegen unter `artifacts/android/2026-09-10/` und werden weder eingecheckt noch an EAS hochgeladen. `preview-build.log` enthält den Aufrufverlauf, `build.json` den letzten Status. Artefakt- und Startnachweis müssen nach Abschluss des Cloud-Builds mit den untenstehenden Befehlen nachgeholt werden. Die EAS-Webseite bestätigt `Queued / Free Tier Queue`, ohne angezeigte Startzeit; es wurde kein kostenpflichtiges Upgrade vorgenommen. Die [allgemeine Queue-Anzeige](https://expo.dev/eas-build-status) zeigte während der Prüfung ca. 32,9 Minuten für Android Free Tier; das ist keine garantierte Startzeit dieses Builds.
- Der APK-Build enthält den bestehenden, nicht committeten Arbeitsstand einschließlich der Android-Oberflächenarbeit aus Schritt 1. Ein Git-Commit allein reproduziert diesen Stand nicht. Keine fremden Änderungen zurückgesetzt oder gestagt.

## Konfiguration und native Quelle

| Gegenstand | Geprüfter Stand |
| --- | --- |
| Projekt | `@janzeppi/LottiBaby`, EAS-ID `d7120520-e4ff-4967-a797-627a2cb3680b` |
| Paket / Namespace | **`com.LottiBaby.app`**, Groß-/Kleinschreibung unverändert |
| Appmodul | `android/settings.gradle` bindet ausschließlich `:app` ein. Die Kopien `android/app 2` und `android/gradle 2` sind ungenutzt und nun vom EAS-Archiv ausgeschlossen |
| Native Quelle | Android und iOS sind versioniert und werden hochgeladen. EAS führt deshalb kein automatisches Prebuild aus. Änderungen an Plugins allein ändern dieses Android-Projekt nicht |
| Installiert | Expo `57.0.14`, React Native `0.86.2`, React Native Purchases `9.10.5` |
| Gradle | Wrapper `9.3.1`; AGP `8.12.0`; Kotlin `2.1.20` aus dem RN-Versionenkatalog |
| Android | minSdk `24`, compileSdk/targetSdk `36`, Build Tools `36.0.0`, NDK `27.1.12297006` aus dem eingebundenen RN-Katalog |
| ABI / Engine | `armeabi-v7a`, `arm64-v8a`, `x86`, `x86_64`; Hermes, New Architecture; nicht komprimierte native Bibliotheken |
| EAS-Image | `ubuntu-26.04-jdk-17-ndk-r27b-sdk-57`, Java 17; Node aus `.nvmrc`: `20.19.4` |
| Update-Runtime | `1.0.23`; native Android-Stringressource und Expo-Konfiguration stimmen überein |

`npx expo config --type introspect --json` löst alle Plugins erfolgreich auf. Die eigenen Live-Activity-/Widget-Plugins sind iOS-spezifisch. `withRevenueCat` ist ein Validierungsplugin; SDK-Konfiguration erfolgt im JS-Client. Keine SDK-Major-Version und keine Paketkennung geändert.

## Signierung

Zu Beginn zeigten EAS-Credentials für **dieses Paket** „No credentials set up yet“. Im Git lagen ausschließlich zwei Debug-Keystores. EAS CLI 24 erzeugte beim nichtinteraktiven Preview-Build automatisch einen neuen Remote-Keystore. Dies wurde im laufenden Auftrag offengelegt; der Nutzer bestätigte anschließend ausdrücklich, dass kein anderer Keystore existiert und ein neuer EAS-Keystore erstellt werden soll. Kein vorhandener Schlüssel wurde ersetzt, gelöscht oder rotiert.

Remote-Konfiguration: `Build Credentials 9p3_PTqU5S (Default)`, Typ JKS. Keine privaten Schlüssel oder Passwörter in dieser Dokumentation.

| Zertifikat | SHA-256 |
| --- | --- |
| EAS-Upload-Schlüssel | `20:F2:A3:59:38:A9:0B:C2:E8:2B:06:95:49:B6:0D:E2:AA:2F:FC:D9:26:1A:13:C1:88:9F:5C:04:18:81:70:C2` |
| Vorhandener Debug-Schlüssel | `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C` |

Vorher war `release.signingConfig = signingConfigs.debug` fest eingetragen. Jetzt ist lokales Debug-Signing eines Release-Builds nur mit `-Plotti.allowDebugReleaseSigning=true` ausdrücklich möglich. Vor dem Release-Packaging prüft Gradle die **effektive** Signierung; fehlende Signierung, der bekannte Debug-Pfad oder `androiddebugkey` brechen ab. Die Prüfung erfolgt nach der EAS-Injektion. EAS erzeugt `eas-build.gradle` und ersetzt die Release-Signierung durch Remote-Credentials. Die Dokumentation dieses Mechanismus allein ist noch kein Artefaktnachweis; der Fingerabdruck des APK muss zusätzlich übereinstimmen.

**Prüfgrenze:** Wegen der EAS-Warteschlange wurde Gradle noch nicht auf dem Worker ausgeführt. Die tatsächliche Injektion, die neue Gradle-Signierungssperre im realen Build und der finale APK-Fingerabdruck sind somit noch nicht praktisch verifiziert. `signing-reference.json` hält nur die unabhängig aus EAS und dem lokalen Debug-Keystore abgelesenen Referenzen fest.

Der EAS-Schlüssel ist der Upload-Schlüssel. Bei später aktivierter **Play App Signing** signiert Google die ausgelieferten APKs ggf. mit einem eigenen App-Signing-Schlüssel. Dessen Fingerabdruck muss später in Play Console separat festgehalten werden. EAS-Keystore für ein gesichertes Backup über `eas credentials --platform android` herunterladen, außerhalb des Repositories in einem geeigneten Secret-/Backup-Speicher sichern. Im Auftrag wurde kein privater Schlüssel exportiert.

## Berechtigungen

Behoben: Das native Manifest entfernte `CAMERA` und `RECORD_AUDIO` über `tools:node="remove"`. Gleichzeitig verwendet die App Barcode-/QR-Scanner und `VoiceLogModal` mit Audioaufnahme. Die Rechte sind wieder im nativen Manifest deklariert. Die Ursache im Image-Picker-Plugin (`cameraPermission: false`, `microphonePermission: false`) wurde ebenfalls korrigiert, damit ein späteres Prebuild sie nicht wieder entfernt. Doppelte Kalender-/Wake-Lock-Einträge in `app.json` wurden vereinheitlicht.

`SYSTEM_ALERT_WINDOW` ist aus dem Hauptmanifest entfernt; die Debug-Manifeste behalten es für Entwicklungswerkzeuge. Introspektion bestätigt Kamera, Mikrofon, Standort nur im Vordergrund, Kalender, Benachrichtigungs-/Wake-/Boot- und Audio-Playback-Service-Rechte. Alte Storage-Rechte bleiben auf API ≤32 begrenzt. Das **zusammengeführte Artefaktmanifest** ist maßgeblich, da Bibliotheken weitere Rechte und Metadaten hinzufügen können. Kein Hintergrundstandort, kein Exact-Alarm-Recht im App-Hauptmanifest. Runtime-Abfragen und vollständige Featuretests gehören in die späteren QA-Schritte.

## Umgebungen und Weg zum AAB

| Profil | Format / Distribution | Kanal | EAS-Environment | Kaufkonfiguration |
| --- | --- | --- | --- | --- |
| `preview` | APK / `internal` | `preview` | `preview` | Ohne Android-RC-Key als Start-/UI-Test nutzbar; keine echten Käufe |
| `store-internal` | AAB / `store` | `store-internal` | `preview` | Echter Google-RC-Key erforderlich |
| `production` | AAB / Store-Standard | `production` | `production` | Echter Google-RC-Key erforderlich |

`store-internal` erbt Remote-Signierung und `autoIncrement` von `production`, überschreibt Kanal und Environment ausdrücklich. Der Kanal ist im Profil vorbereitet; es wurde kein OTA-Update veröffentlicht. Der Update-Wrapper akzeptiert für diesen Kanal nur `--environment preview --platform android`. Der existierende Kanal `preview` zeigt auf die Branch `preview` und enthält bereits Android-/iOS-Updates mit Runtime `1.0.23`; er zeigt nicht auf Production. Beim ersten Starttest muss das eingebettete Bundle geprüft werden, ohne es durch ein bereits vorhandenes Preview-OTA zu ersetzen.

Live-Abfrage `eas env:list --environment preview production --format long`: In beiden Umgebungen existiert nur `EXPO_PUBLIC_RC_IOS_KEY` (Sensitive), kein bevorzugter oder Legacy-Android-Key. `.env.local` wird durch `.easignore` ausgeschlossen. Es wurde kein `test_`-Key eingesetzt und keine EAS-Variable verändert. Das Preview-Environment ist kein isoliertes Testbackend: die vorhandenen Backend-Adressen im Client bleiben maßgeblich.

Der neue `eas-build-post-install`-Hook validiert auf dem EAS-Worker plattformspezifisch. Store-Profile brechen ohne Google-Key ab, Release-/Preview-Profile lehnen falsche Präfixe einschließlich `test_`, `appl_` und Secret-Keys ab. Der bestehende Legacy-Fallback nach Trimmen bleibt unterstützt. Die gleiche Prüfung läuft im RevenueCat-Plugin, soweit die Build-Plattform bekannt ist. Präfixvalidierung bestätigt nicht die tatsächliche Dashboard-Zuordnung oder Produktkonfiguration.

```sh
# Installierbarer Testbuild; kein Upload zu Play
npx --yes eas-cli@24.0.0 build --platform android --profile preview --non-interactive --no-wait

# Erst nach Anlage der RC-Google-App und Hinterlegung des goog_-Keys in preview:
EAS_BUILD_PLATFORM=android EAS_BUILD_PROFILE=store-internal \
  npx --yes eas-cli@24.0.0 build --platform android --profile store-internal --non-interactive

# Öffentliche Produktionskonfiguration: goog_-Key zuvor auch in production setzen
EAS_BUILD_PLATFORM=android EAS_BUILD_PROFILE=production \
  npx --yes eas-cli@24.0.0 build --platform android --profile production --non-interactive

# Bewusst debug-signiertes lokales Release-APK; NICHT als Store-Artefakt verwenden
cd android
./gradlew :app:assembleRelease -Plotti.allowDebugReleaseSigning=true
# Ausgabe: android/app/build/outputs/apk/release/app-release.apk
```

Store-Buildversuch ausgeführt und vor dem Cloud-Build an fehlender Konfiguration abgebrochen; `store-internal-blocker.log` plus `store-key-check.log` belegen den Fehler. **Es gibt noch kein geprüftes Store-AAB.** Ein Preview-APK ist kein Ersatz für Play-internes Testen. Der reguläre EAS-Store-Befehl führt `:app:bundleRelease` aus; natives Ergebnis `android/app/build/outputs/bundle/release/app-release.aab`, Cloud-Downloadlink anschließend aus `eas build:view BUILD_ID --json` → `artifacts.buildUrl`.

Für das spätere AAB zusätzlich prüfen:

Bundletool `1.18.3` wurde aus dem [offiziellen Google-Release](https://github.com/google/bundletool/releases/tag/1.18.3) unter `/tmp/lotti-android-tools/bundletool-all-1.18.3.jar` bereitgestellt; SHA-256 `a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29` stimmt mit dem GitHub-Release-Digest überein, `java -jar … version` erfolgreich.

```sh
jarsigner -verify -verbose app-release.aab
keytool -printcert -jarfile app-release.aab
java -jar /tmp/lotti-android-tools/bundletool-all-1.18.3.jar validate --bundle=app-release.aab
java -jar /tmp/lotti-android-tools/bundletool-all-1.18.3.jar dump manifest --bundle=app-release.aab --module=base
java -jar /tmp/lotti-android-tools/bundletool-all-1.18.3.jar dump config --bundle=app-release.aab
```

AAB-Signatur muss kryptografisch gültig sein und zum obigen EAS-Fingerabdruck passen; Paket, monotoner Versionscode, Target 36, Billing-Metadaten, `store-internal`-Update-Header und 16-KB-Ausrichtung kontrollieren. Danach daraus erzeugte APKs installieren und starten. Keine dieser AAB-Prüfungen wurde ohne AAB als bestanden markiert.

## Aktuelle Play-Anforderungen / verbleibende Lücken

- Seit 31.08.2026 müssen neue Smartphone-Apps/Updates API **36** erreichen: [offizielle Target-API-Anforderung](https://developer.android.com/google/play/requirements/target-sdk). Konfiguration erfüllt dies; zusätzlich am APK bestätigen.
- Billing Library 7 hat ihre reguläre Frist am 31.08.2026 erreicht; ohne individuell bestätigte Verlängerung mindestens **Billing 8** verwenden. [Offizielle Billing-Fristen](https://developer.android.com/google/play/billing/deprecation-faq). Die tatsächlich aufgelöste Bibliothek anhand des Artefakt-Metadatums `com.google.android.play.billingclient.version` prüfen.
- 64-Bit-Bibliotheken müssen 16-KB-Seiten unterstützen. Die aktuell abgerufene [Android-Dokumentation](https://developer.android.com/guide/practices/page-sizes) nennt für nicht kompatible App-Updates inzwischen 01.02.2027; ältere Ankündigungen nennen 01.11.2025. Deshalb keine Freigabe nur anhand einer alten Frist: ELF- und ZIP-Ausrichtung tatsächlich verifizieren und später auch auf 16-KB-Gerät testen.
- Play-Konto-/App-Erstellung und RevenueCat-Google-App sind gemäß Schritt 1 extern blockiert. Keine Play-App vorhanden, kein Google-RC-Key. Kein Play-interner Kauf-/AAB-Test möglich, bis diese Voraussetzungen erfüllt sind.
- EAS zeigt weder FCM-V1-Credentials noch Google-Service-Account für Play-Submissions. Kein `google-services.json` im nativen Projekt. Remote-Push ist daher nicht als funktionsfähig belegt. Ein Play-Submission-Service-Account ist für das reine Erzeugen eines signierten AAB nicht erforderlich.
- Expo Doctor: **18/21** Checks bestanden. Offen: native/config-Synchronisation, Warnungen zu älteren/ungeprüften RN-Bibliotheken und 27 verfügbare Patchupdates. Kein pauschales Upgrade im gemeinsamen Arbeitsstand; bestehende Patches `expo-modules-core+57.0.11` und `expo-modules-jsi+57.0.4` berücksichtigen.
- `updates.codeSigningMetadata` ist vorhanden, aber kein Update-Code-Signing-Zertifikat konfiguriert. Dies ist kein Nachweis signierter OTA-Updates und von Android-App-Signing getrennt.

## Prüfungen

- `node --test scripts/tests/android-build-env.test.js`: **11/11 bestanden**.
- `npm test -- --runInBand lib/__tests__/revenuecat.test.ts`: **5/5 bestanden**.
- Expo-Konfigurationsintrospektion erfolgreich, korrigierte Rechte ohne Remove-Markierungen.
- `eas build:inspect --platform android --profile preview --stage archive --output /tmp/lotti-eas-android-archive`: Android-Appmodul und Prüf-Hook enthalten; `.env.local`, private Signierungsdateien, native Buildausgaben und ungenutzte Android-Kopien herausgefiltert (leere Verzeichnisse können verbleiben). EAS legt selbst Git-Metadaten in der Kopie an. Der erste Upload war 722 MB; Store-Medien und Marketing-Projekte sind für künftige Uploads zusätzlich ausgeschlossen.
- Update-Wrapper verweigert `store-internal` mit Environment `production` bzw. Plattform `ios`, jeweils vor Export/Veröffentlichung.
- `eas config --platform android --profile store-internal --json`: aufgelöstes Profil bestätigt `distribution=store`, `buildType=app-bundle`, `credentialsSource=remote`, `autoIncrement=true`, `channel=store-internal`, `environment=preview` und das angegebene SDK-57-Image.
- `git diff --check` erfolgreich.
- Artefaktprüfung vorbereitet: `scripts/verify-android-apk.py` prüft Signatur/Fingerabdruck, Paket, Release-Debuggability, Target-API, ZIP-Alignment und alle enthaltenen 64-Bit-ELF-Loadsegmente. Ergebnis erst nach realem APK verfügbar.

## Lokale Startumgebung

Java und Android-SDK waren anfangs nicht installiert. Für diesen Auftrag wurden aus offiziellen Quellen Temurin JDK `17.0.20.1`, Android Command Line Tools, Build Tools `36.0.0`, Platform Tools `37.0.1`, Emulator `37.1.11` und das Google-APIs-Systemimage API 36 / ARM64 Revision 7 bereitgestellt. Arbeitsverzeichnis `/tmp/lotti-android-tools`; Android CLI legt zusätzlich eigene Dateien unter `~/.android` an. Keine globale Änderung von `JAVA_HOME` oder Shell-Profilen.

AVD `lotti-step02-api36`, Pixel-6-Profil, `emulator-5554` hat erfolgreich gebootet (26 Sekunden). Bestätigt: API `36`, ABI `arm64-v8a`, **Seitengröße 4096**. Dies ist noch kein 16-KB-Laufzeittest. Der Emulator ist für den ersten Appstart offline gesetzt, um bestehende Preview-OTA-Updates auszuschließen. Ein erfolgreich gebooteter Emulator ist **kein App-Startnachweis**.

Emulator zum Ende des Auftrags sauber mit `adb emu kill` beendet. Die temporäre Archivinspektionskopie und die heruntergeladenen Installer-Archive wurden entfernt; installierte Werkzeuge, AVD und Nachweise bleiben erhalten.

```sh
# Werkzeugpfade dieser Sitzung (temporär; nach Neustart ggf. neu bereitstellen)
export JAVA_HOME=/tmp/lotti-android-tools/jdk-17.0.20.1+1/Contents/Home
export ANDROID_HOME=/tmp/lotti-android-tools/sdk
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

emulator -avd lotti-step02-api36 -no-window -no-audio -no-boot-anim \
  -no-snapshot -gpu swiftshader -memory 2048 -partition-size 2048

# Nach APK-Download:
python3 scripts/verify-android-apk.py artifacts/android/2026-09-10/app-preview.apk \
  "$ANDROID_HOME" 20F2A35938A90BC2E82B069549B60DE2AA2FFCD9261A13C1889F5C04188170C2
adb -s emulator-5554 install artifacts/android/2026-09-10/app-preview.apk
adb -s emulator-5554 shell cmd package resolve-activity --brief com.LottiBaby.app
adb -s emulator-5554 shell am start -W -n com.LottiBaby.app/.MainActivity
adb -s emulator-5554 exec-out screencap -p > artifacts/android/2026-09-10/first-launch.png
adb -s emulator-5554 logcat -d -b crash
```

## Weitere Quellen

- [EAS-Android-Build und Signierungsinjektion](https://docs.expo.dev/build-reference/android-builds/)
- [EAS-Build-Images](https://docs.expo.dev/build-reference/infrastructure/)
- [EAS-Umgebungen](https://docs.expo.dev/eas/environment-variables/)
- [Expo SDK 57 ImagePicker](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/)
