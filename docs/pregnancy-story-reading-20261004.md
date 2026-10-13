# Schwangerschaft: natürliche Bilder und übersichtliche Artikel

Aktuelle Ergänzung, 04.10.2026, 11:08 MESZ: Nach positivem Nutzerfeedback zur Darstellung ist [Runterziehen zum Schließen wiederhergestellt](pregnancy-story-dismiss-20261004.md). Bilder und rahmenlose Darstellung bleiben unverändert. Die folgenden Abschnitte dokumentieren den vorherigen Stand von 09:29 MESZ.

Stand: 04.10.2026, 09:29 MESZ. Auf Nutzerwunsch umgesetzt und als [EAS Update 0a21d7f8-6075-4794-a71a-4b34108337cf](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/0a21d7f8-6075-4794-a71a-4b34108337cf) für iOS und Android veröffentlicht. Kanal/Branch `release-candidate-20261003`, Runtime `1.0.25`, EAS-Umgebung `production`.

## Umsetzung

- Vollbildbilder bleiben erhalten. Der Text steht ohne Kartenrahmen direkt über einem Verlauf, der seine Lesbarkeit verbessert. Text antippen öffnet weiterhin den passenden Wochen- oder Themenartikel.
- Wischen nach unten schließt die Story nicht mehr. Der Hinweis darauf und die Bewegung mit verkleinertem Rahmen sind entfernt. Das X und die vorhandene barrierefreie Schließen-Aktion bleiben erhalten.
- Links/rechts tippen, Fortschrittsbalken, automatische Wiedergabe, Pause, Halten, horizontale Storywechsel und die zusätzlichen Werkzeugaktionen bleiben bestehen. Quellen sind über das Info-Symbol oben erreichbar.
- Stories enthalten jeweils etwas mehr Information: vorhandene Artikelsätze sowie Erklärungen zur Wochenzählung und zu den Werkzeugen. Bestehende Wochenabsätze und Funktionen sind erhalten.
- Alle 42 Wochen verwenden innerhalb ihrer gesamten Storyfolge unterschiedliche Bilddateien pro Seite. Insgesamt stehen 18 unterschiedliche Motive zur Verfügung; Bilder können zwischen unterschiedlichen Wochen erneut vorkommen.
- Alle 18 Motive wurden in eine zurückhaltende fotografische Bildsprache überführt: Tageslicht, natürliche Haut- und Stoffstrukturen, weniger märchenhafte Ausstattung. Es sind erzeugte Bilder, keine Fotografien realer Personen. Gesichter, Hände und die Ausschnitte wurden visuell geprüft.
- Artikel und Wochenartikel verwenden den vorhandenen Header und die Glas-/Pastelloberflächen der App. Klare Überschriften, nummerierte Abschnitte, Trennlinien, kürzere Absätze und eine direkte Abschnittsauswahl erleichtern das Lesen. Themenartikel zeigen zusätzlich die geschätzte Lesezeit.
- Merken, Einwilligungs-/Speicherhinweise, Fragenentwürfe, Quellen, verwandte Artikel, Wochenwahl und Countdown bleiben erreichbar. Tests bestätigen, dass die Artikeltexte in Deutsch, Englisch und Spanisch vollständig erhalten sind.

## Prüfung

`npm run typecheck`, gezielter ESLint-Lauf ohne Warnungen sowie 25 Tests aus Schwangerschaftskatalog, Leseformatierung, Bildzuordnung, Wiedergabe und Lesezeichen bestanden.

Im Browser geprüft: 414 × 896, Artikel und Wochenartikel mit Abschnittssprüngen, Merken, Storytext → Artikel sowie ein nach unten gerichteter Drag ohne Schließen. Bei 320 × 568, spanischen Texten und Schriftfaktor 1,6 bleibt der gesamte Storytext inklusive Aktion durch Scrollen erreichbar. Keine Browser-Konsolenfehler im geprüften Ablauf.

Im iOS-26.2-Simulator mit echtem Expo Router/Native Stack geprüft: Story öffnen, automatische Wiedergabe, Pause, links/rechts tippen, Text → Themenartikel, zurück, Wochenartikel, Abschnittssprünge, Merken, Quellen über Info und Schließen über X. Account und Lesezeichen sind im isolierten Prüfprogramm simuliert; das veröffentlichte Bundle enthält diese Prüfkomponenten nicht. Die bisherige Korrektur gegen die Navigations-Renderschleife ist erhalten. Keine Treffer für `Maximum update depth exceeded`, `Unhandled JS Exception`, `RCTFatal` oder `SIGABRT` in den Logs des Prüfprozesses. Native Drag-Automation ist auf diesem Host nicht verfügbar; der entfernte Schließen-Drag wurde im Browser geprüft. Die neue Darstellung wurde noch nicht auf dem physischen Nutzergerät abgenommen.

## Bestehende Veröffentlichung

Der Export stammt aus einer isolierten Kopie des zuvor veröffentlichten Kandidaten. Native Konfiguration, Paketversionen, Runtime, Backend und Billing wurden nicht geändert. Beide Plattform-Bundles enthalten das Produktionsbackend und dieselben Billing-Schlüssel wie die jeweiligen vorhandenen Kandidaten-Binaries; alle 18 Bilder sind enthalten.

Nach Veröffentlichung per EAS erneut gelesen und verglichen: alle fünf Kanalzuordnungen unverändert; öffentlicher Branch `main` weiterhin Gruppe `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`. Kein Store-Build wurde ersetzt. Die 18 geschützten Dateien im bestehenden Arbeitsstand sowie 15 entsprechende Dateien der isolierten Kandidatenquelle sind unverändert. Insbesondere Home, „Dein Tag im Überblick“, Header, Consent-/Root-Navigation und fachliche Artikel-/Wochenquellen bleiben erhalten.

## Belege und Bilddateien

- [Prüfbericht](../output/pregnancy-story-reading-20261004/qa-verification.json)
- [EAS-Veröffentlichung](../output/pregnancy-story-reading-20261004/published-update.json) und [Schutz der Veröffentlichung](../output/pregnancy-story-reading-20261004/published-release-preservation.json)
- [Plattformexport](../output/pregnancy-story-reading-20261004/export-verification.json), [bestehender Arbeitsstand](../output/pregnancy-story-reading-20261004/source-preservation.json) und [Kandidatenquelle](../output/pregnancy-story-reading-20261004/candidate-source-preservation.json)
- [Bilddateien, Größen und Prüfsummen](../output/pregnancy-story-reading-20261004/image-verification.json)
- [Prompts und finale absolute Dateipfade](../output/pregnancy-story-reading-20261004/image-prompts.json): Erzeugung/Bearbeitung mit dem eingebauten `image_gen`-Werkzeug; keine CLI-Ausweichlösung. Optimierte JPGs liegen in `assets/images/pregnancy-guide/`, die ursprünglichen PNG-Ergebnisse bleiben erhalten.
- [Task-bezogener Patch](../output/pregnancy-story-reading-20261004/task-changes.patch)
- [Story im Simulator](../output/pregnancy-story-reading-20261004/native-story.png), [Artikel](../output/pregnancy-story-reading-20261004/native-article.png) und [Wochenabschnitt](../output/pregnancy-story-reading-20261004/native-week-section.png)

Zum Ansehen den vorhandenen Kandidaten vollständig schließen und öffnen. Falls das Update zunächst im Hintergrund geladen wird, anschließend ein zweites Mal vollständig schließen und öffnen.

## Nachprüfung der gemeldeten gleichen Bilder

Am 04.10.2026 erneut geprüft: Die drei Nutzerfotos der 7. SSW zeigen die ältere Story-Oberfläche mit identischem gemaltem Hintergrund, Textkarte, Quellen im Footer und „Nach unten wischen zum Schließen“. Diese Elemente sind im aktuellen veröffentlichten Bundle bereits entfernt. Die Update-ID des physischen Geräts ist anhand der Fotos nicht bestätigt.

Der echte EAS-Manifest-Endpunkt liefert für iOS, Runtime `1.0.25` und Kanal `release-candidate-20261003` HTTP 200 mit Update `01a105d1-ad68-7a9d-9345-fde47791de25` aus der oben genannten Gruppe. Die SHA-256-Prüfsumme des ausgelieferten Bundles stimmt mit dem veröffentlichten lokalen Hermes-Bundle überein; alle 18 aktuellen Bilddateien sind mit ihren Prüfsummen im ausgelieferten Manifest enthalten. Die Kanalzuordnung ist aktiv und weiterhin auf den Kandidatenbranch gerichtet.

Genau die gemeldeten drei „Dein Baby“-Seiten der 7. SSW wurden zusätzlich im nativen iOS-Simulator geöffnet, pausiert und einzeln aufgenommen: [Seite 1](../output/pregnancy-story-reading-20261004/week7-page1.png), [Seite 2](../output/pregnancy-story-reading-20261004/week7-page2.png), [Seite 3](../output/pregnancy-story-reading-20261004/week7-page3.png). Die Motive sind sichtbar verschieden; Textkarte und Wisch-Hinweis fehlen. Dies bestätigt die native Darstellung in der isolierten Prüf-App, nicht den Update-Start auf dem Nutzergerät.

EAS Insights meldete bei der Abfrage noch keine Installationen der neuen Gruppe. Die aggregierten Statistiken können verzögert sein und belegen weder einen konkreten Gerätedefekt noch einen erfolgreichen Start auf dem Nutzergerät. Der vorhandene Kandidaten-Build prüft beim Start auf Updates, wartet aber nicht vor dem Start auf deren Download (`EXUpdatesCheckOnLaunch=ALWAYS`, `EXUpdatesLaunchWaitMs=0`); ein heruntergeladenes Update kann deshalb erst beim nächsten vollständigen Start angewendet werden.

In dieser Nachprüfung wurden kein neues Update veröffentlicht, kein App-Code geändert und kein öffentlicher Kanal oder Backend verändert. Die 18 geschützten Checkout-Dateien sind weiterhin unverändert. [Strukturierter Auslieferungsbeleg](../output/pregnancy-story-reading-20261004/delivery-verification.json).
