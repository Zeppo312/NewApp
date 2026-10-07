# Android-Preview-Build: Gradle-Fehler vom 10.09.2026

## Diagnose

Der EAS-Build [7d6aed0b-3d13-45bf-9555-c0d16d0b97c8](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/7d6aed0b-3d13-45bf-9555-c0d16d0b97c8) wurde am 10.09.2026 um 13:32 UTC gestartet und ist um 14:18 UTC fehlgeschlagen. Profil: `preview`, APK. Die genaue Ursache aus `RUN_GRADLEW`:

```text
Build file '/home/expo/workingdir/build/node_modules/react-native-os/android/build.gradle' line: 7
A problem occurred evaluating project ':react-native-os'.
Could not find method jcenter() for arguments [] on repository container
```

Gradle 9 unterstützt diese Repository-Methode nicht mehr. Im aktuellen Arbeitsbaum existiert inzwischen aus Schritt 5 der Patch `patches/react-native-os+1.2.6.patch`: `jcenter()` wird durch `mavenCentral()` und die alte Dependency-Konfiguration `compile` durch `implementation` ersetzt. Dieser Patch war im fehlgeschlagenen Cloud-Build noch nicht enthalten. Kein SDK-Upgrade und kein Austausch bestehender Signierungsdaten erforderlich.

## Prüfung und Änderung in diesem Reparaturauftrag

- `patch-package --error-on-fail` erfolgreich: alle drei vorhandenen Patches, einschließlich `react-native-os@1.2.6`, angewendet.
- Bestehender Postinstall-Hook `patch-package` bleibt erhalten.
- EAS-Archivinspektion mit CLI 24 bestätigt: Patch und Postinstall-Hook enthalten, lokale `.env.local` ausgeschlossen.
- `.easignore` ergänzt: `android/app/build` ohne abschließenden Slash schließt auch den lokalen Symlink auf den USB-Stick aus. `android/app/.cxx/` verhindert die Übernahme lokaler CMake-Ausgaben. Im geprüften Archiv bleiben nur leere Cache-Verzeichnisse zurück.
- Bestehende Android-Build-Konfigurationstests: 11/11 erfolgreich.
- Schritt 5 dokumentiert bereits einen erfolgreichen lokalen Debug-Build mit dem Patch. In diesem Reparaturauftrag kein neuer vollständiger lokaler Gradle-Build: Der dafür verwendete USB-Stick ist nicht eingebunden; Buildausgabe und Teile des lokalen Gradle-Caches liegen auf diesem Datenträger.

## Zweiter Cloud-Build: neuer Ressourcenfehler

Build: [98555431-816f-4d41-bb19-efcc8b317cd8](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/98555431-816f-4d41-bb19-efcc8b317cd8), angelegt am 10.09.2026 um 19:29 UTC. Status am 11.09.2026: **ERRORED**. Der ursprüngliche `jcenter()`-Fehler tritt nicht mehr auf. Nach der nativen Kompilierung scheitert `:app:mergeReleaseResources` an `assets_images_background_hell.png` und `assets_images_lottipic.png`.

Beide Quelldateien waren JPEGs mit falscher `.png`-Endung. Der lokale Android-Compiler AAPT2 reproduziert den Fehler mit den Originaldateien: `file does not start with PNG signature`.

### Korrektur und Nachweis am 11.09.2026

- `assets/images/Background_Hell.png` und `assets/images/LottiPic.png` nach `.jpg` umbenannt. Die Bilddaten sind bytegleich geblieben, per SHA-256 geprüft.
- Alle drei Quellverweise in `BackgroundContext.tsx`, `ShareablePregnancyView.tsx` und `blog-screen.tsx` angepasst.
- `scripts/check-image-assets.js` prüft PNG/JPEG-Dateisignaturen im bestehenden `eas-build-post-install`-Hook. Alle 85 aktuellen Bilder bestehen die Prüfung. Eine absichtlich falsch benannte JPEG-Testdatei wird zuverlässig abgelehnt.
- Android-Release-Export via `expo export:embed --platform android --dev false` erfolgreich: 3807 Module, 126 kopierte Assets.
- AAPT2 kompiliert die exportierten Ressourcen erfolgreich zu 125 Ressourceneinträgen. Auch `android/app/src/main/res` lässt sich erfolgreich kompilieren.
- Bestehende Android-Build-Konfigurationstests erneut 11/11 erfolgreich.
- Kein vollständiger neuer lokaler Gradle-Build, da der verknüpfte externe Builddatenträger fehlt. Ein erfolgreicher Cloud-Build bleibt separat zu bestätigen.

Der Preview-Build veröffentlicht die App nicht bei Google Play und bestätigt keine Google-Play-Testkäufe.

## Aktueller Cloud-Build nach der Bildkorrektur

[d21a5e29-d68b-4340-9d57-0e935e66844a](https://expo.dev/accounts/janzeppi/projects/LottiBaby/builds/d21a5e29-d68b-4340-9d57-0e935e66844a), angelegt am 11.09.2026 um 04:51 UTC, Profil `preview`. Zuletzt überprüfter Status: **IN_QUEUE**. Ein erster Upload brach mit `EPIPE` ab; der erneute Upload war erfolgreich. Bestehender Remote-Keystore wiederverwendet, kein Tarifwechsel.

Vorherige Archivinspektion bestätigt beide `.jpg`-Dateien, korrigierte Endungen, den neuen Prüfhook und den bestehenden `react-native-os`-Patch im Upload. Die alten `.png`-Dateien und `.env.local` sind ausgeschlossen. Das EAS-Preview-Environment meldet weiterhin nur den iOS-RevenueCat-Key; dieser Build ist kein Android-Kaufnachweis.

Nach Abschluss `eas build:view d21a5e29-d68b-4340-9d57-0e935e66844a --json` abfragen. Bei Erfolg das APK gemäß Schritt 2 prüfen. Ein vollständiger erfolgreicher Cloud-Build ist noch nicht bestätigt. Es wurde keine automatische spätere Überwachung eingerichtet.
