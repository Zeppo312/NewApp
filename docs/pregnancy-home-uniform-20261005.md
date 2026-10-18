# Einheitliche Schwangerschafts-Home

Stand: 05.10.2026, 07:30 MESZ. Als [EAS Update 3612ed05-566d-4fd5-bf51-b9889520d02a](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/3612ed05-566d-4fd5-bf51-b9889520d02a) für iOS und Android auf `release-candidate-20261003` veröffentlicht. Runtime `1.0.25`, EAS-Umgebung `production`. Beide tatsächlich ausgelieferten Plattform-Manifeste stimmen mit dem geprüften Export überein. Die Abnahme auf physischen Geräten bleibt offen.

## Verhalten

- „Gut zu wissen, gerade jetzt“ ist aus der Homeansicht entfernt. Die bestehenden Wissensartikel bleiben über ihre übrigen Einstiege verfügbar.
- Alle vier Slides in „Dein Tag im Überblick“ erhalten dieselbe Breite und Höhe. Die natürliche Höhe der bisherigen Zahlenkarte ist die Referenz; sie berücksichtigt Bildschirmbreite und Systemschrift. Das Rondell springt beim Blättern nicht mehr zwischen unterschiedlichen Höhen.
- „Deine Schwangerschaft diese Woche“ zeigt zwei klar begrenzte Bildkacheln für „Dein Baby“ und „Dein Körper“. Beide öffnen weiterhin den zugehörigen Abschnitt der aktuellen Woche. Ein flexibler Bildbereich verhindert die zuvor praktisch unsichtbaren Kacheln.
- „Wie fühlst du dich?“ verwendet das vorhandene Foto `listening-belly` statt `rest-tea`, einen kurzen Hinweis und den Button „Symptome eintragen“. Bild, Text und Aktion passen in die gemeinsame Kartenhöhe.
- Die neuen Slides übernehmen Material, Rundung, Innenabstand und Überschriftenstil der Zahlenkarte. Überschrift und Textspalte können auch nativ innerhalb ihrer verfügbaren Breite schrumpfen und umbrechen.
- Zahlenkarte, Countdown-Einstieg, vorhandene Shop-Empfehlung, Begrüßung und Schnellzugriffe bleiben erhalten. Berühren, Blättern oder Tippen auf einen Punkt beendet die automatische Rotation; außerhalb der fokussierten Homeansicht pausiert sie.

Das Symptom-Tagebuch und seine bestehenden Schutzmechanismen wurden funktional nicht geändert. Dieser Stand ersetzt die Home-Darstellung des Updates vom 04.10.2026.

## Prüfung

Belege liegen unter `output/pregnancy-home-uniform-20261005/`:

- `tests.log`: 61 Tests in acht Suites erfolgreich, einschließlich Symptom-Tagebuch, Einwilligung und vorhandener Wochen-/Story-Navigation.
- `typecheck-app.log` und `typecheck-pregnancy-tests.log`: erfolgreiche Anwendungsprüfung und Prüfung der ausgewählten Schwangerschaftstests in der veröffentlichten isolierten Quelle.
- `lint.json`: keine Fehler; 16 bestehende Warnungen in der Home-Datei. Neue Komponenten ohne Warnungen.
- `qa-verification.json`: tatsächliche aktuelle Wochen-, Befinden-, Zahlen- und Carousel-Komponenten in einer lokalen React-Native-Web-Prüfoberfläche. Bei 390 px sind alle vier Slides 350 × 278 px groß; bei 320 px und 160 % simulierter Schriftgröße 280 × 431 px. Beide Wochenbilder sowie Text und Aktion der Befinden-Karte sind sichtbar; keine Browser-JavaScript-Fehler. Der vierte Shop-Inhalt ist in dieser Prüfoberfläche simuliert.
- `native-week.png` und `native-feeling.png`: dieselben Komponenten in einer isolierten nativen iPhone-13-Pro-Max-Vorschau mit iOS 26.2. Vier Kartenrahmen mit 388 × 278 pt wurden gemessen. Vollständiger Überschriftenumbruch, beide Wochenbilder und Befinden-Bild/Text/Button sind sichtbar. Account/Navigation sowie der vierte Shop-Inhalt sind hier simuliert; die vollständige angemeldete App und physische iOS-/Android-Geräte sind damit nicht abgenommen.
- `week-web.png`, `feeling-web.png`, `week-small-large-font.png` und `feeling-small-large-font.png` zeigen die Browserdarstellung.

## Veröffentlichung

Die isolierte Quelle baut auf Gruppe `2bb7dc6b-68f7-406a-8f6a-f6abe478dadf` auf. Fünf Anwendungsdateien und ein Test wurden übernommen; 1.017 andere Dateien, alle 30 Schwangerschaftsbilder und die bisherigen Story-Korrekturen sind erhalten. Native Konfiguration, Abhängigkeiten, Runtime, Backend und Billing wurden nicht geändert. Der geprüfte Export wurde mit `--skip-bundler` unverändert veröffentlicht.

Die vorhandenen Kandidaten-Binaries sind iOS `1.0.25 (1.0.80)` und Android `1.0.25 (24)`, jeweils Runtime `1.0.25`. Es wurde kein neuer Store-Build erstellt. Die fünf Kanalzuordnungen bleiben unverändert; der öffentliche Branch `main` bleibt auf Gruppe `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`.

`published-update.json`, `served-manifest-verification.json`, `export-verification.json`, `overview-export-verification.json`, `source-preparation.json` und `published-release-preservation.json` dokumentieren Veröffentlichung, tatsächlich ausgelieferte Bundle-Prüfsummen, erhaltene Bilder und Quellen. 15 überprüfte Dateien außerhalb der beabsichtigten Änderung im Hauptarbeitsverzeichnis blieben unverändert.

Zum Laden den bisherigen Kandidaten vollständig schließen und öffnen. Wird das Update zunächst im Hintergrund geladen, danach nochmals vollständig schließen und öffnen.
