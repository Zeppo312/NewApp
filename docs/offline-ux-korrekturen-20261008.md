# Offline-Anzeigen und Speicherfehler korrigiert

Stand: 08.10.2026. Das iOS-Korrekturupdate wurde um **15:37 MESZ** auf dem bestehenden TestFlight-Kandidatenkanal veröffentlicht.

- [EAS Update 3e930621-b7cd-4f28-9127-7e757f6fcace](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/3e930621-b7cd-4f28-9127-7e757f6fcace)
- Kanal/Branch: `release-candidate-20261003`, Runtime `1.0.25`, ausschließlich iOS.
- Bestehender kompatibler TestFlight-Build: Version `1.0.25`, Build `1.0.80`. Die native Buildnummer ändert sich durch dieses Update nicht.
- iOS-Update-ID: `01a11bbc-042a-7dec-9388-783c777c8a82`.
- Vorgänger: [erste Phase-A-Auslieferung](offline-phase-a-ota-20261008.md).

## Korrigiertes Verhalten

Die Screenshots zeigten große Statusblöcke über Home, einen Geräte-/Abmeldehinweis oberhalb des Fütterungsformulars und technische Netzwerkfehler auf „Unser Tag“ und beim Schlafspeichern.

- **Home:** Die drei Statusblöcke für Pflegeeinträge, Schlafminuten und Timer sind entfernt. Hintergrundaktualisierungen erscheinen ohne zusätzliche Textblöcke. Bestätigte Daten und die Unterscheidung zwischen unbekannten und bestätigten Kennzahlen bleiben erhalten. Der entsprechende Statusblock auf Schwangerschafts-Home ist ebenfalls entfernt.
- **Fütterungs-/Windelformular:** Geräte-/Abmeldehinweis und routinemäßiger Entwurfsstatus sind entfernt. Erforderliche Aktionen zum Wiederherstellen oder Prüfen eines unbestätigten Entwurfs stehen in einer zurückhaltenden Karte innerhalb des scrollbaren Inhalts. Der Formularkopf bleibt darüber erreichbar. Aktionen haben mindestens 44 Punkte Höhe.
- **„Unser Tag“:** Der separate Verbindungstest mit Diagnoseabfrage alle 30 Sekunden ist entfernt. Er hatte rohe Netzwerkfehler direkt angezeigt. Nach einem tatsächlichen Ladefehler erscheint ein kompakter Hinweis mit Wiederholungsaktion. Bei laufender Aktualisierung erscheint kein Statusbanner; vorhandene Tagesdaten bleiben sichtbar.
- **Speichern:** Netzwerk-/Timeoutmeldungen in den betroffenen Pflege-, Schlaf- und benutzerdefinierten Aktivitätspfaden werden durch verständliche deutsche, englische oder spanische Texte ersetzt. Native Dateipfade und Exceptiontexte erscheinen dort nicht mehr im Alert. Bei verlorener Antwort wird die Speicherung als unbestätigt behandelt: Vor einem erneuten Speichern ist der Verlauf zu prüfen, weil eine verlorene Antwort nach einer bereits erfolgten Speicherung auftreten kann.
- **Eingabeerhalt:** Das Pflegeformular schließt nach einer abgelehnten oder unbestätigten Speicherantwort nicht mehr automatisch. Ein laufender Speichervorgang blockiert weitere Übermittlungen. Auch das manuelle Schlaf-Formular bleibt nach einem fehlgeschlagenen Erstellen oder Bearbeiten geöffnet.

## Weiterhin offene Funktion

**Ein neuer Schlaf kann weiterhin nicht ohne Verbindung gestartet oder gemeinsam gespeichert werden.** Dieses Update korrigiert die Fehlermeldung und erhält Formulareingaben; es implementiert keine Warteschlange für neue Offline-Schlafstarts. Schlaf-Paket S bleibt mit `EXPO_PUBLIC_SLEEP_OFFLINE_ENABLED=false` deaktiviert. Die bisherigen Flaschen-/Windelentwürfe sind weiterhin lokale Entwürfe und benötigen bewusstes Online-Speichern für den gemeinsamen Verlauf.

Serverfreigabe, vollständige Offline-Schlaffunktion und Zwei-Geräte-Abnahme sind weiterhin offen. Die bereits vorhandenen lokalen Swift-Änderungen am Widget sind nicht Bestandteil dieser JavaScript-Auslieferung.

## Prüfungen

- **320 Tests in 30 Suiten bestanden**, einschließlich der bisherigen 300 Regressionstests und zusätzlicher Prüfungen für Speicherbestätigung, Eingabeerhalt, doppelte Übermittlung und sichere Fehlermeldungen.
- App-TypeScript, vollständiges Test-TypeScript im Hauptprojekt und App-TypeScript der isolierten veröffentlichten Quelle bestanden.
- Lint der elf betroffenen Client-/Testdateien: **0 Fehler, 118 Warnungen**. Diff-Prüfung bestanden.
- Browserprüfung der tatsächlichen Formular-/Hinweiskomponenten mit gemockten Diensten: 393 Punkte Breite, helle Ansicht, Wiederherstellung und Ladefehler; zusätzlich 320 Punkte Breite, dunkle Ansicht und Schriftfaktor 1,4. Das ist keine native Geräteabnahme.
- iOS-Hermes-Export erfolgreich. Bundle: `15.374.363` Bytes, SHA-256 `a3d2ca1e9696ae2636c27fda776797b306808e34796e694bf717b3585436e9e8`. Alle 120 Assets entsprechen dem vorherigen Kandidaten. SDK, native Paketbasis, Produktionsbackend und RevenueCat-Schlüsselübereinstimmung mit dem bestehenden Kandidaten geprüft.
- Der Update-Server liefert die neue iOS-ID. Bundlehash und sämtliche Assethashes des ausgelieferten Manifests entsprechen dem Export. Der separate direkte CDN-Abruf aus dieser Umgebung scheitert mit HTTP 403; CDN-Bytes und Installation auf dem physischen iPhone sind nicht als verifiziert markiert.
- Alle fünf Kanalzuordnungen, andere Kanalstände und der öffentliche `main`-Stand bleiben unverändert. Android erhält weiterhin `01a11656-ef91-71a3-bc06-a4c2093a1849`.
- Fremde lokale Änderungen erhalten; keine Migration, kein neuer nativer Build, kein Push oder Merge.

## Auf dem iPhone prüfen

Lotti Baby mit Internet vollständig beenden und öffnen, den Hintergrunddownload abwarten und anschließend bei Bedarf erneut vollständig beenden und öffnen. Dieses Verhalten entspricht der bestehenden Update-Konfiguration. [Expo-Dokumentation](https://docs.expo.dev/eas-update/introduction/)

Danach Home ohne Statusblöcke und ein neues Fläschchenformular ohne Gerätehinweis prüfen. Einen Tag online laden, Verbindung trennen und die erhaltenen Tagesdaten prüfen. Bei einem Schlaf-Speicherversuch ohne Verbindung müssen die Eingaben bleiben und eine verständliche Meldung erscheinen. Nach Wiederherstellung der Verbindung den Verlauf prüfen, bevor derselbe Eintrag erneut gespeichert wird.

Nachweise: `output/offline-polish-20261008/` enthält `change.patch`, Tests, TypeScript-/Lintprotokolle, Export-/Manifest-/Publikationsnachweise und Screenshots. Private CLI-Protokolle und Rohmanifeste stehen in `.family-qa/offline-polish-20261008/`.

![Fütterungsformular ohne Gerätehinweis – lokale Browservorschau](/Users/janzeppenfeld/Developer/LottiBaby/output/offline-polish-20261008/form-light-393.png)
