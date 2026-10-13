# Home, Unser Tag und Schlaf – gemeinsames Erscheinungsbild

Umgesetzt und per EAS Update veröffentlicht am 12. Oktober 2026.

## Sichtbare Änderungen

- 106 lokale Textstile verwenden die vorhandenen gemeinsamen Textrollen bzw.
  Zahlenmodifikatoren: Titel, Beschreibungen, Hinweise und Kennzahlen bekommen
  nachvollziehbare Größen, Gewichte und Zeilenhöhen. Die Systemschrift bleibt.
- `CONTENT_LAYOUT` in `DesignGuide` legt gemeinsame Ränder, Kartenradien,
  Innenabstände und einen zurückhaltenden Schatten fest. `ContentColors` in
  `Colors` stellt lesbare warme Flächen für hell/dunkel bereit.
- `ContentCard` trennt die dekorative Blur-Ebene vom Inhalt. Der Hintergrund
  bleibt auch ohne Blur lesbar; Kategorien dürfen darüber eine dezente Tönung
  behalten. Der bestehende Android-Blur-Target-Wrapper wird weiterverwendet.
- `PeriodTabs` vereinheitlicht Tag/Woche/Monat unter dem Header von Unser Tag
  und Schlaf. Datumsauswahl, Monatszugang und Haptik bleiben bei den Screens.
  Der ausgewählte Zustand wird für native und Web-Zugänglichkeit angegeben.
- Abschnittstitel sind links ausgerichtet; kleine Hinweise bekommen vollständige
  Rollen. Kennzahlkarten können bei großer Systemschrift untereinander stehen.
  Ein langer spanischer Übersichtshinweis kann umbrechen.
- Home behält Begrüßung, Bilder, fachliche Farben, Rasterbearbeitung und
  Übersichtskarussell. Der animierte Glanz am Begrüßungskartenrand entfällt.
- Der Schlaftimer verwendet die gemeinsame Zahlenrolle und eine größere,
  themebewusste Uhrfläche. Status und Prognose stehen unter der Uhr und können
  unabhängig von ihrer Kreisgeometrie umbrechen. Start-/Stop-/Pausenlogik bleibt.
- Alltagsschnellaktionen und Schlafaufnahme benutzen gemeinsame Text-/Flächen-
  eigenschaften; Beschriftungen und Karten können in der Höhe wachsen.

Die vorhandenen Formulare und deren zuletzt veröffentlichte Vereinheitlichung
sind erhalten. Das Paket ergänzt die alltäglichen Inhaltsflächen; es ersetzt
weder Datenlogik noch die übrigen noch zu migrierenden Screens.

## Veröffentlichung

- Projekt: `d7120520-e4ff-4967-a797-627a2cb3680b`, `@janzeppi/LottiBaby`.
- Kanal/Branch: `release-candidate-20261003`, Environment `production`.
- iOS und Android, Runtime `1.0.25`, Expo SDK 57.
- Gruppe: `6daa0fe2-0c33-4767-8af3-3968a45cc994`.
- iOS: `01a130a9-6b21-7e67-95bd-745548f462b7`.
- Android: `01a130a9-6b21-7455-8503-04709e218e10`.
- [EAS Update](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/6daa0fe2-0c33-4767-8af3-3968a45cc994).

Vor der Veröffentlichung wurde ein inzwischen erschienenes Formularupdate
erkannt. Die erste vorbereitete Generation wurde aufbewahrt und die neue Quelle
auf Gruppe `19f83e20-6acc-416f-8f60-ed6915d46395` neu aufgebaut. Dadurch bleiben
Formularrahmen, feste Aktionen und der vorherige Babywechsel-Fix erhalten.
1.059 Baseline-Dateien wurden per Hash bestätigt; nur zwölf UI-/Token-/Testdateien
wurden überlagert bzw. ergänzt. Die endgültige Quelle umfasst 1.062 geprüfte
Dateien. Fremde laufende Änderungen wurden nicht pauschal veröffentlicht.

## Prüfungen und Grenzen

- App-Typecheck der eingefrorenen Quelle und des lokalen Arbeitsbaums bestehen;
  der neue Zeitraum-Test ist separat typgeprüft.
- 51 Tests in sieben Suites bestehen: Zeitraum-Auswahl, Home-Schlafsummen,
  Ernährungsübersicht, Schlaf-Reconciliation, Übersetzungen, Dialogaktionen und
  der vorhandene Formularrahmen.
- ESLint der geänderten Quellen hat keine Fehler. Im Vergleich zur vorigen
  Karten-Baseline gab es nach Normalisierung keine neuen Diagnosen. Bestehende
  Compiler-/Hooks-Warnungen der großen Screens bleiben dokumentiert.
- 33 bestehende Lade-/Speicher-/Timer-Callbacks entsprechen dem veröffentlichten
  Formular-Ausgangsstand. Übrige veröffentlichte Dateien und native
  Konfiguration, Abhängigkeiten und Assetmengen sind per Hash erhalten.
- 72 Web-Layoutvarianten bestehen: drei Ansichten, 320/390 Punkte, DE/EN/ES,
  hell/dunkel, normale und simulierte 1,6-fache Schrift. Sie verwenden tatsächliche
  Komponenten bzw. Original-JSX und Styles mit Beispieldaten und nativen
  Symbol-/Blur-Fixtures. Dies ist keine angemeldete vollständige Geräte-QA.
- Beide Hermes-Exporte wurden vor dem Upload geprüft und mit `--skip-bundler`
  unverändert veröffentlicht. Produktionsbackend, Billing-Konfiguration,
  erforderliche Einwilligungen und deaktiviertes Schlaf-Outbox-Feature sind
  unverändert.
- Ausgelieferte Multipart-Manifeste bestätigen beide Update-IDs, Runtime,
  Bundlehashes und alle 120 iOS-/125 Android-Assethashes. Die neue Gruppe war nach
  Veröffentlichung der Kandidaten-Head; Kanalzuordnungen und `main` sind erhalten.
- Direkte CDN-Bundleabrufe antworteten mit HTTP 403. Manifeste und lokale
  Prüfsummen sind bestätigt; CDN-Bytes und Installation auf Geräten sind nicht.
- Es wurden keine Pakete installiert, keine nativen Builds erstellt, keine
  Servermigrationen ausgeführt und kein Git-Push durchgeführt.

Beim abschließenden lokalen Typecheck fehlte im parallel bearbeiteten Größen-
Screen die bereits im veröffentlichten Formularstand vorhandene Definition
`isBabySubject`. Genau diese eine Definition wurde lokal wieder ergänzt;
weitere dortige Änderungen wurden erhalten. Im Update war sie bereits durch
die geprüfte Baseline vorhanden.

Schlüsselfreie Nachweise: `output/home-unity-20261012/`. Eingefrorene Quelle und
private Rohantworten: `.family-qa/home-unity-20261012/`. Die erste Generation ist
als `source-generation-1` aufbewahrt.

Layoutvergleich außerhalb des Repositorys:
`/Users/janzeppenfeld/Documents/Codex/2026-10-12/LottiBaby-Home-Unser-Tag-Schlaf/Vergleich.html`.

## Auf dem Gerät

Die Kandidaten-App mit Internet vollständig beenden und öffnen, den Download
abwarten, dann bei Bedarf erneut vollständig beenden und öffnen. Die TestFlight-
Buildnummer verändert sich durch dieses Update nicht. Native Abnahme bleibt
offen: Home → Unser Tag → Schlaf mit normaler/großer Schrift, hell/dunkel und
eigenem Hintergrund; außerdem Start/Stop, Datumsauswahl, Speichern/Abbrechen und
Tastatur prüfen.
