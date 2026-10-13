# Einheitliche Formular-Popups – EAS Update vom 12. Oktober 2026

Die Erfassungsformulare verwenden jetzt den gemeinsamen `FormSheet`-Rahmen
auf dem vorhandenen `GlassSheetSurface`. Kopf, Glasmaterial, Randabstände,
Feldflächen und Aktionsposition sind zentral definiert. Lange Überschriften
und Inhalte scrollen über dem festen Aktionsbereich. Hauptformulare verwenden
Abbrechen/Speichern; Unterdialoge behalten Fertig/Übernehmen, Timerstart seine
passende Beschriftung. Ausblenden einer eigenen Aktivität ist eine separate,
bestätigte Aktion. Die bestehenden Textrollen und das runde Plus sind erhalten.

Der Umfang und die Komponenten-API stehen in [forms.md](forms.md). Erfasst
sind Gewicht, Größe, Planer und seine Personen-/Erinnerungs-/Zeitraumdialoge,
Schlaf, Aktivitäten, eigene Aktivitäten, Zähne, manuelle Wehen, Babynamen sowie
die gemeinsamen Text-/Datumsdialoge. System-Alerts und Spezialeditoren gehören
nicht zu dieser Migration.

## Veröffentlichung

- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b`, `@janzeppi/LottiBaby`.
- Kanal und Branch: `release-candidate-20261003`.
- Environment: `production`; Runtime `1.0.25`; SDK 57; iOS und Android.
- Gruppe: `19f83e20-6acc-416f-8f60-ed6915d46395`.
- iOS: `01a1309d-f9fe-7a0b-9395-248f9596cf2b`.
- Android: `01a1309d-f9fe-73dd-b01d-da2c1aa496aa`.
- [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/19f83e20-6acc-416f-8f60-ed6915d46395).

Der aktuell fertiggestellte kompatible iOS-Store-Build hat App-Version 1.0.25,
Build 1.0.80, Runtime 1.0.25 und diesen Kandidatenkanal. Es wurde kein neuer
TestFlight-Build erzeugt. Das OTA ist für die bereits installierte kompatible
App vorgesehen; die konkrete Installation auf dem iPhone ist nicht geprüft.

## Quelle und Prüfung

Die Veröffentlichung verwendet ausschließlich den geprüften Export einer
eingefrorenen Quelle mit 1.059 durch SHA-256 überprüften Dateien. Gegenüber
dem zuletzt veröffentlichten Kandidaten sind 22 Formular-/Test-/Konfigurations-
dateien geändert beziehungsweise ergänzt. Die zuletzt veröffentlichte
Baby-Wechsler-Korrektur der Gruppe `5a909b12-377d-4adc-a52c-31fe2da5cee7`
ist erhalten. Zeitgleich laufende Karten-/Tab-Änderungen bleiben lokal und
sind nicht Teil dieser Veröffentlichung.

17 Speicher-, Lösch-, Archivierungs- und Picker-Callbacks haben dieselbe
TypeScript-AST-Struktur. Paketdateien, native Konfiguration, gemeinsame
Typografie, ThemedText, Aktionskomponenten und rundes Plus sind unverändert.
Es gab keine Paketinstallation, keinen nativen Build, Git-Commit oder Push.

86 Tests in elf Suites sowie App- und Test-Typechecks bestehen. ESLint hat
keine Fehler und keine neuen Warnungen; 102 bereits bestehende Warnungen
bleiben. Die Vergleichsprüfung umfasst 310 Web-Varianten mit 320/390 Punkten,
DE/EN/ES, hell/dunkel und simulierter großer Schrift. Die abschließende Quelle
wurde zusätzlich in 63 Varianten geprüft, darunter 54 mit vergrößerter
gesamter Schrift auf 320 × 568 Punkten. Die Prüfungen finden keine abgeschnittenen
Überschriften oder Aktionsbeschriftungen und keine außerhalb des sichtbaren
Bereichs liegenden Aktionsleisten.

Der Manifest-Endpunkt liefert auf beiden Plattformen die veröffentlichten
Update-IDs und Runtime 1.0.25. Die Bundle-Prüfsummen und alle 120 iOS-/125
Android-Asset-Prüfsummen stimmen mit dem lokalen Export überein. Kanalzuordnungen
und das Main-Update sind unverändert. Direkte CDN-Abfragen lieferten HTTP 403;
CDN-Bytes und Geräteinstallation bleiben unbestätigt.

## Vergleich und Nachweise

Die Vergleichsansicht liegt außerhalb des Repositorys:
`/Users/janzeppenfeld/Documents/Codex/2026-10-12/LottiBaby-Einheitliche-Popups/Vorher-Nachher.html`.
Sie verwendet echte Komponenten beziehungsweise originales Formular-JSX mit
Beispieldaten. Blur, native Picker und Tastaturdarstellung bleiben am Gerät zu
prüfen. Die Vorher-Bilder entsprechen dem vorherigen Popup-Kandidaten.

Schlüsselfreie Nachweise: `output/form-sheets-ota-20261012/`, insbesondere
`source-preparation.json`, `source-preservation.json`, `export-preflight.json`,
`export-verification.json`, `prepublish-verification.json`,
`served-manifest-verification.json`, `publication-verification.json`,
`layout-verification-final.json`, `lint-verification.json` und die Test-/Typechecklogs.
Eingefrorene Quelle und private Rohantworten: `.family-qa/form-sheets-ota-20261012/`.
