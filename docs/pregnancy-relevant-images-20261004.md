# Schwangerschaft: Bilder passend zum Inhalt

Die vorherige Zuordnung rotierte Baby-/Körperbilder durch alle 30 Motive. Dadurch erschien beispielsweise ein Obst-Stillleben als Titelbild der 8. SSW. Diese Zuordnung wurde ersetzt.

## Aktuelles Verhalten

- Baby-Stories und der Wochenartikel verwenden ausschließlich Schwangerschaftsmotive: werdende Eltern, Schwangere, Kontakt zum Bauch oder gemeinsames Lesen. Benachbarte Wochen zeigen unterschiedliche erste Babybilder. Die Fotos sind allgemeine Schwangerschaftsmotive und zeigen kein medizinisch genaues Entwicklungsstadium.
- Körper-Stories verwenden passende Schwangerschafts-/Alltagsszenen. Wenn ein Körperartikel zur Woche gehört, wird dessen Motiv bevorzugt; beispielsweise Ruhe bei Müdigkeit oder Bewegung bei Rückenbeschwerden.
- Wissensartikel behalten ihre eigenen Bilder. Obst erscheint ausschließlich beim Artikel zum Größenvergleich, Arzneimittel beim Arzneimittelartikel und Ernährungsmotive bei Ernährung bzw. Lebensmittelsicherheit.
- Fragen und Terminplanung zeigen Notizbuch, Gespräch oder Untersuchung. Sie erhalten keine beliebige Kliniktasche oder Küchenaufnahme als Ersatz. Selbstfürsorge zeigt Ruhe/Bewegung.
- Jede Seite innerhalb einer Story hat weiterhin ein eigenes Bild. Dasselbe passende Motiv darf zwischen verschiedenen Bereichen desselben Themas wiederkehren. Die Zuordnung bleibt beim erneuten Öffnen stabil.

Keine neuen Bilder, medizinischen Inhalte, nativen Abhängigkeiten oder Konfigurationen wurden eingeführt. Die vorherigen Gesten-/Absturzkorrekturen, Countdown, Home-Struktur und Artikeltexte bleiben unverändert. Die separate Baby-Entwicklungsdarstellung ist weiterhin im [Einbau-Prompt](pregnancy-baby-visualization-prompt-20261004.md) beschrieben und noch nicht implementiert.

## Prüfung und Lieferung

27 Jest-Tests bestanden, einschließlich Regeln für alle 42 Wochen: Schwangerschaftsmotive für Baby, keine Obst-/Arzneimittel-/Reisetaschenbilder in allgemeinen Stories, Obst nur beim Größenartikel, unterschiedliche Bilder innerhalb jeder Story und unveränderte Artikel-/Werkzeugziele. TypeScript und gezielter ESLint bestanden.

Export und Veröffentlichung erfolgten ausschließlich für den bisherigen EAS-Kandidatenkanal `release-candidate-20261003`, beide Plattformen, Runtime 1.0.25, bestehende Produktionsumgebung. Die eingefrorene Kandidatenquelle übernimmt genau zwei geänderte Dateien: `lib/pregnancy-guide/media.ts` und `lib/pregnancy-guide/stories.ts`. Alle 1.012 anderen Quelldateien und 22 geschützten Dateien im Hauptarbeitsverzeichnis sind anhand ihrer SHA-256-Prüfsummen unverändert.

Im nativen iPhone-Simulator (iPhone 13 Pro Max, iOS 26.2) wurden die 8. SSW und ihr Wochenartikel geöffnet. Beide zeigen das Schwangerschaftsmotiv mit werdenden Eltern; der Artikel zeigt kein Obstbild. Die Kontrolle verwendete einen lokalen Test-Harness mit den echten Komponenten und Testkonto-Daten. Im Laufprotokoll gab es keine Treffer für die geprüften JavaScript-/Absturzfehler. Die Prüfung auf dem physischen Gerät nach dem OTA-Download bleibt offen.

Veröffentlicht am 04.10.2026 um 17:11 MESZ: [EAS-Update ebcfb0a8-6ad1-4711-83a6-1221afca012e](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/ebcfb0a8-6ad1-4711-83a6-1221afca012e). Die tatsächlich ausgelieferten iOS-/Android-Manifeste enthalten die neuen Update-IDs, die zuvor geprüften Bundle-Prüfsummen und alle 30 Bilddateien. Alle fünf Kanalzuordnungen sind unverändert. Das öffentliche `main`-Update bleibt `a47827a3-b732-4f64-a539-429d3709849a`, Runtime 1.0.23. Kein Store-Build oder Backend wurde ersetzt.

Nachweise: `output/pregnancy-relevant-images-20261004/`, insbesondere `native-week-8.png`, `native-verification.json`, `published-release-preservation.json`, `published-update.json` und `served-manifest-verification.json`.
