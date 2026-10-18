# Android-Berechtigungen und notwendige Erklärungen

Geprüft: `app.json`, `app.config.js`, `android/app/src/main/AndroidManifest.xml` und lokales Zwischenartefakt `android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml`. **Kein Nachweis eines finalen Play-AAB.** Im Build liegen zusätzliche Override-Zwischenstufen; entscheidend ist später das installierte Release-Artefakt. Maschinenlesbare Aufnahme: [Manifest-Inventar](evidence/manifest-inventar.json).

| Berechtigung | Vorhanden / Zweck aus Code | Was noch nachzuweisen ist |
| --- | --- | --- |
| `INTERNET` | Auth, Sync, KI, Wetter, Medien, Shop, SDKs | Tatsächliche Release-Zielhosts/TLS |
| `CAMERA` | Scanner für Produkte, Kontoverknüpfung/Aufpasser/Karten je Screen | Scanner ohne Bild-Upload prüfen; nur bei Funktionsaufruf anfordern. Kamera wurde in Schritt 5 abgelehnt/erteilt getestet |
| `RECORD_AUDIO` | Chat-Sprachnachricht und KI-Spracheingabe | Ablehnen/Abbruch/Löschung temporärer Aufnahme; KI-Übertragung vor Aufnahme verständlich erklären |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | Wetter; Fürsorge verwendet ebenfalls Standort | Ungefähre Freigabe und manuelle Ortseingabe testen; präzise Übertragung nicht verschweigen |
| `READ_CALENDAR`, `WRITE_CALENDAR` | Kalender wählen, eigene Termine erstellen/ändern/löschen | Kein vollständiges Auslesen fremder Termine behaupten. Ablehnung/Standardkalender/Entfernung prüfen |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | Alt-Android-Datei-/Medienpfade; Quellmanifest begrenzt beide auf SDK 32 | Gelesenes Debug-Merge verliert bei WRITE die Begrenzung; spätere Override-Stufe/Release prüfen. Kein `READ_MEDIA_IMAGES`/`VIDEO` im gelesenen Merge; Fotozugriff im finalen AAB beurteilen |
| `POST_NOTIFICATIONS` | Durch Abhängigkeit im Merge; lokale Erinnerungen und Push | Systemfreigabe, Ablehnung, Zustellung/Deep Link; FCM noch offen |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK` | Quellmanifest enthält `expo.modules.audio.service.AudioControlsService` mit Typ `mediaPlayback` | **OFFEN:** tatsächlich genutzte Hintergrundwiedergabe nicht nachgewiesen. Bei Beibehaltung konkreten Ablauf samt Nutzernutzen/Video für Console belegen, andernfalls unnötige Deklaration in separater Implementierung entfernen |
| `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE` | Benachrichtigungs-/Hintergrundkomponenten, Haptik | Wiederanlauf/Erinnerungen auf Release prüfen; keine minutengenaue Garantie |
| `MODIFY_AUDIO_SETTINGS` | Audioabhängigkeit | Aufnahme/Wiedergabe auf echtem Gerät |
| `ACTIVITY_RECOGNITION` | Im Debug-Merge, `expo-sensors` installiert | Kein App-Aufruf für Schritte/Bewegung gefunden. Notwendigkeit/Entfernung im Release klären, keine Fitnesserhebung erfinden |
| `ACCESS_NETWORK_STATE`, `ACCESS_WIFI_STATE`, `CHANGE_NETWORK_STATE`, `CHANGE_WIFI_MULTICAST_STATE` | Native Netzwerk-/Dev-Abhängigkeiten im Merge | Release-Merge samt Herkunft prüfen |
| `SYSTEM_ALERT_WINDOW` | Nur im gelesenen Debug-Merge, nicht Hauptmanifest | Dev-Client-Anteil; im finalen Store-AAB prüfen, keine Produktfunktion dafür behaupten |
| `com.android.vending.BILLING` | RevenueCat/Play Billing im Merge | Play-Verbindung und Testkäufe aus Schritten 8–11 |
| `com.google.android.c2dm.permission.RECEIVE` | FCM-Empfangskomponente | FCM-Konfiguration ist kein durch diese Permission bewiesener funktionierender Push |
| `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE` | SDK-Komponente im Merge | Herkunft, aktive Nutzung, ID-/Attributionsdaten bestimmen; kein Beleg für Werbe-ID |
| Hersteller-Badge- und `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Native Benachrichtigungs-/Android-Komponenten | Vollständige Namen im JSON; keine separat erfundene Datenkategorie |

Im gelesenen Bestand fehlen `ACCESS_BACKGROUND_LOCATION`, Health-Connect-Leserechte, `AD_ID`, `READ_CONTACTS`, SMS-/Anruflistenrechte, `MANAGE_EXTERNAL_STORAGE`, `USE_FULL_SCREEN_INTENT` und exakte Alarmrechte. Das ist eine Bestandsaussage, keine Garantie für künftige Bundles.

**Console-Entwürfe:** Hintergrundstandort derzeit „nicht verwendet“; Werbe-ID derzeit „nicht nachgewiesen/Release prüfen“; Foto-/Videoberechtigungsformular nur anhand tatsächlich enthaltener Rechte bearbeiten; Foreground-Service-Erklärung bleibt offen. Keine erfundene Bildschirmaufnahme eines nicht existierenden Hintergrundablaufs erstellen. Google kann je Bundle zusätzliche Angaben verlangen. [Berechtigungsdeklaration](https://support.google.com/googleplay/android-developer/answer/9214102?hl=en), [Foreground Services](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en).

Der technische Release-Abgleich muss Manifest, SDKs, tatsächliche Funktionsaufrufe und Datensicherheit gemeinsam aktualisieren. Eine entzogene Systemberechtigung entfernt bereits hochgeladene Daten nicht.
