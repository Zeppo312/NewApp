# Beschwerden und SSW-bezogene Artikel

Stand: 05.10.2026. [EAS Update d9b22e35](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/d9b22e35-8985-4869-b664-3bf2b3861004) wurde um 13:37 MESZ für iOS und Android auf `release-candidate-20261003` veröffentlicht. Beide Plattformen verwenden Runtime `1.0.25` und EAS-Umgebung `production`.

## Inhalt und Oberfläche

„Wie fühlst du dich?“ bietet jetzt 17 Beschwerden. Neu sind Bauchschmerzen/Ziehen, Kopfschmerzen, Schwindel/Kreislauf, Wadenkrämpfe und häufiger Harndrang. Kopf und Kreislauf haben einen blauen Bereich; die übrigen Ergänzungen stehen bei Körper und Entlastung. Die fünf neuen Artikel enthalten mögliche Hintergründe, Alltagshilfen, Gesprächsnotizen, eine Frage für die Betreuung und konkrete Hinweise zur Abklärung. Die Bibliothek enthält nun 29 Artikel, übersetzt in Deutsch, Englisch und Spanisch.

Jede SSW von 1 bis 42 behält die beiden bisherigen Wochenartikel. Ab SSW 4 ergänzt ein redaktionell zugeordnetes Beschwerdethema die Wochenempfehlungen, auch ohne Tagebucheintrag. Die Auswahl behauptet nicht, dass diese Beschwerden in dieser Woche auftreten müssen. Für SSW 1–3 wird kein zusätzliches Beschwerdethema empfohlen.

Alle 14 Artikel, die den 17 Beschwerdeoptionen entsprechen, erhalten beim Öffnen mit einer SSW einen eigenen Abschnitt zur Schwangerschaftsphase. Die Karten zeigen dessen Inhalt als Vorschau. Es werden sinnvolle Phasen unterschieden; nicht für jede Woche neue medizinische Aussagen erfunden. Der Abschnitt benennt die genaue laufende SSW und ihren Zeitraum, etwa „25. SSW · 24+0–24+6“. Die Einordnung der ersten beiden Wochen erklärt die Zählung vor der Befruchtung.

Die Grenzen werden mit abgeschlossenen Wochen berechnet: Hinweise ab 20+0 beginnen in der 21. SSW, die Seitenlage ab 28+0 in der 29. SSW, die Einordnung möglicher Geburtsschmerzen ab 37+0 in der 38. SSW. Die 37. SSW erhält weiterhin den Hinweis zur direkten Rücksprache bei regelmäßigen Krämpfen vor 37+0. Früh stehen bei Bauchschmerzen andere Hintergründe im Vordergrund als später. Warnzeichen bleiben in jeder Woche erhalten.

Die bestehende Berechnung für den ausgewählten Tagebuchtag und die Weitergabe der SSW an die Artikelseite bleiben erhalten. Historische Einträge verwenden ihre damalige Woche. Ohne gültige SSW erscheinen allgemeine Beschwerdeartikel, ohne eine Woche zu erfinden. Die gemeinsame Bibliothek wird durch die Kontextbildung nicht verändert. Die lokalen Speicherfelder und die vorhandenen Schutzprüfungen bleiben unverändert; neue und bisherige Beschwerden sind gemeinsam speicherbar.

## Quellen

Neue Quellen wurden am 05.10.2026 aufgerufen und im Offline-Katalog mit URL und Abrufdatum hinterlegt:

- [NHS: Bauchschmerzen in der Schwangerschaft](https://www.nhs.uk/pregnancy/common-symptoms/stomach-pain/)
- [NHS: Kopfschmerzen](https://www.nhs.uk/pregnancy/common-symptoms/headaches/)
- [NHS: Häufige Schwangerschaftsbeschwerden](https://www.nhs.uk/pregnancy/common-symptoms/common-health-problems/)
- [BIÖG: Körperliche Veränderungen und Beschwerden](https://www.familienplanung.de/schwangerschaft/beschwerden-und-krankheiten/beschwerden-in-der-schwangerschaft-wie-sich-der-koerper-veraendert/)
- [NHS: Tiefe Venenthrombose](https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/)
- [CDC: Warnzeichen während und nach der Schwangerschaft](https://www.cdc.gov/hearher/maternal-warning-signs/index.html)

Die bestehenden Quellen zu Übelkeit, Schlaf, Sodbrennen, Schwellungen, Rückenschmerzen, Ausfluss und allgemeinen Schwangerschaftsbeschwerden wurden für die neuen Phasenabschnitte ebenfalls gelesen. Artikelquellen, Quellen des Phasenabschnitts und die bisherigen Wochenquellen werden gemeinsam verlinkt. Die Quellenanzeige berechnet die Abrufdaten aus den tatsächlichen Katalogeinträgen; das frühere feste Datum wurde entfernt. Neue Texte und Phasenabschnitte tragen Version `2026-10-05.1`. Es sind eigenständig formulierte, quellenbasierte redaktionelle Entwürfe; eine klinische Freigabe wird nicht behauptet.

## Prüfung und Auslieferung

Nachweise unter `output/pregnancy-complaints-20261005/`:

- `tests.log`: 72 Tests in acht Suites bestanden. Neue Prüfungen decken die fünf Artikel in allen 42 Wochen und drei Sprachen, die medizinisch relevanten Wochengrenzen, unveränderte Warnhinweise, ungültige Wochen, unveränderte Bibliotheksdaten, vollständige/doppelfreie Empfehlungen und die Speicherung aller 17 Beschwerden ab. Die bisherigen Tests für Tagebuch, Einwilligung, Datum, Terminladen und Stories bestanden ebenfalls.
- `typecheck-app.log`, `typecheck-tests.log`, `lint.log`: erfolgreiche Prüfungen in der Veröffentlichungskopie.
- `ui-verification.json`, `symptoms-390.png`, `article-25.png`, `article-38-dark-large.png`: Browserprüfung der tatsächlichen React-Native-Komponenten mit simuliertem Konto, Termin, Einwilligung und Navigation. Die 7., 25. und 38. SSW zeigen unterschiedliche passende Inhalte; Quellen und Abrufdaten sind sichtbar. Bei 320 px und 160 % simulierter Schriftgröße im Dunkelmodus wurde kein horizontaler Überlauf beobachtet. Die spanische Ansicht ohne Termin erfindet keine Woche. Keine beobachteten Browser-JavaScript-Fehler.
- `source-preparation.json`: isolierte Veröffentlichungskopie basiert auf der zuletzt veröffentlichten Gruppe `da1b84aa-7470-4fea-8f08-605291312bae`. Übernommen wurden elf Anwendungsdateien und vier Testdateien. 1.016 sonstige Baseline-Dateien blieben unverändert. Keine Änderungen an nativen Abhängigkeiten oder Runtime.
- `export-preflight.json`, `export-verification.json`: geprüfter iOS-/Android-Export mit Produktionsbackend, den Billing-Schlüsseln der jeweiligen Kandidaten-Binaries, allen 30 Bildern, den neuen Texten und den bisherigen Story-Funktionen. Genau dieser Export wurde mit `--skip-bundler` veröffentlicht.
- `published-update.json`, `served-manifest-verification.json`: Veröffentlichung erfolgreich; beide tatsächlich abgerufenen Update-Manifeste enthalten die neuen Plattform-IDs, Runtime `1.0.25`, die Prüfsummen der geprüften Bundles und alle Bilder. Die Bundle-Bytes wurden nicht zusätzlich vom Asset-CDN heruntergeladen.
- `published-release-preservation.json`: alle fünf Kanalzuordnungen unverändert, öffentlicher `main` weiterhin Gruppe `a47827a3-b732-4f64-a539-429d3709849a` mit Runtime `1.0.23`; alle vorbereiteten Quellprüfsummen stimmen. 13 separat geschützte, nicht zu dieser Änderung gehörende Dateien im Hauptarbeitsverzeichnis blieben erhalten.

Kein neuer Store-Build. Das Anwenden auf einem physischen iOS-/Android-Gerät ist noch nicht bestätigt. Zum Anwenden den vorhandenen Kandidaten vollständig schließen und öffnen; falls das Update zuerst im Hintergrund lädt, anschließend nochmals vollständig schließen und öffnen.
