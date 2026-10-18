# Übersichtliche Tages-Einordnung · 5. Oktober 2026

Die Tagesauswahl und die Erklärung sind jetzt klarer gegliedert. Jede ausgewählte Beschwerde erscheint im Ergebnis als farbiger Chip und erhält eine nummerierte Karte mit der möglichen Ursache. Die Farbe folgt ihrer Beschwerdegruppe. Zusätzliche Hinweise zur SSW des ausgewählten Tages und deren Quellen lassen sich je Karte aufklappen; der vollständige Artikel bleibt direkt erreichbar.

- Die Auswahlgruppen zeigen die Anzahl ihrer gewählten Beschwerden. Alle gewählten Punkte sind auch außerhalb ihrer Gruppe als Chips sichtbar und über einen beschrifteten Entfernen-Button abwählbar.
- Nach **Meine Auswahl einordnen** springt die Ansicht zum fertig aufgebauten Ergebnis. **Auswahl ändern** führt zurück zu Stimmung und Beschwerden; **Im Tagebuch festhalten** öffnet Stärke und Notizen.
- Im fertigen Ergebnis entfällt die wiederholte Aufforderung zum Einordnen. Eine geänderte Auswahl, Stimmung, Stärke, Datierung oder ein anderer Tag entfernt die veraltete Einordnung und bietet erneutes Einordnen an.
- Die Erklärung wird in lesbare Absätze gegliedert. Ursachen und weitere SSW-Hinweise sind getrennt, ohne den Wortlaut der medizinischen Inhalte zu ändern. Die allgemeinen und beschwerdebezogenen Hilfetexte bleiben in beiden Ansichten offen sichtbar.

Die Einordnung nutzt weiterhin die lokale Tagesauswahl und bestehende quellenbasierte Inhalte. Kein zusätzlicher KI-/Serveraufruf, keine neue Diagnose, keine Änderung an Speicherung oder Einwilligungs- und Kontogrenzen. Notizen werden nicht medizinisch interpretiert. Alle neuen Bedienelemente sind auf Deutsch, Englisch und Spanisch vorhanden. Aufklappbare Buttons geben ihren erweiterten Zustand an Hilfstechnologien weiter; Entfernen-Buttons benennen die betroffene Beschwerde. Der redaktionelle Status der Artikel bleibt `draft`.

## Prüfung

**84 Tests in 9 Testgruppen bestanden.** App- und Test-TypeScript sowie ESLint bestanden im isolierten Veröffentlichungssatz. Neue Tests prüfen das Entfernen einer Beschwerde aus einer anderen Gruppe ohne Verlust von Stimmung, Stärke oder Notizen sowie das unabhängige Auf- und Zuklappen der SSW-Hinweise/Quellen. Bestehende Tests zu Tageswechseln, leeren Auswahlen, Entwurfserhalt, Speicherfehlern, Datenschutz und Beschwerdeinhalten in SSW 1–42 bleiben bestanden.

Die lokale Vorschau verwendet echte Guide-Komponenten mit synthetischen Kontodaten und simulierter Datierung. In der 25. SSW wurden Bauchschmerzen, Brustempfindlichkeit und Kopfschmerzen gemeinsam gewählt und erklärt. Der Sprung zum Ergebnis, der Rücksprung zur Auswahl, das Aufklappen der Brustquellen und das Ausblenden nach Abwählen funktionierten. Bei 320 Pixel Breite, Schriftfaktor 1,6, dunklem Design und SSW 38 kein horizontaler Überlauf; keine Browser-Konsolenfehler. Die temporäre Browsergröße wurde zurückgesetzt. Das ist Vorschau- und automatisierte Prüfung; kein physischer Gerätetest.

## Veröffentlichungssatz

Ausgangsbasis ist der geprüfte Quellstand des zuletzt veröffentlichten Kandidaten `64034c76-7953-4a56-a018-528494b7d5d6`. Darauf liegen ausschließlich sieben Dateien für diese Überarbeitung einschließlich Tests; 1.029 andere Quelldateien bleiben identisch. Native Konfiguration, Abhängigkeiten und die übrigen Änderungen im Arbeitsverzeichnis wurden nicht übernommen.

Der iOS-/Android-Export wurde auf Projekt, Runtime `1.0.25`, Produktions-Backend, wirksame Einwilligungsgrenzen, passende RevenueCat-Schlüsselfingerprints der jeweiligen Kandidaten-Binaries, Schwangerschaftsrouten, Story-Steuerung, neue UI-Texte und alle 30 Bilder geprüft. Öffentlich gespeicherte Nachweise enthalten keine API-Schlüssel.

## Veröffentlicht

**5. Oktober 2026, 16:04 MESZ:** [EAS Update 82e00a53-6b75-417a-ad09-2024d9d2098f](https://expo.dev/accounts/janzeppi/projects/LottiBaby/updates/82e00a53-6b75-417a-ad09-2024d9d2098f), Channel/Branch `release-candidate-20261003`, Environment `production`, Runtime `1.0.25`, iOS und Android.

- iOS: `01a10c61-9bc8-7e8a-97db-05257f8e68fb`
- Android: `01a10c61-9bc8-7795-bd83-54ae165af915`

Beide vom Update-Server gelieferten Manifeste stimmen mit den veröffentlichten IDs und den Bundle-Hashes des geprüften Exports überein und enthalten alle 30 Bilder. Alle fünf Channel-Zuordnungen bleiben identisch. Public `main` bleibt bei Gruppe `a47827a3-b732-4f64-a539-429d3709849a`, Runtime `1.0.23`. Quell- und geschützte Checkout-Hashes wurden nach Veröffentlichung erneut geprüft. Die Annahme und Darstellung auf physischen iOS-/Android-Geräten wurde in diesem Durchgang nicht geprüft.

Nachweise: `output/pregnancy-feeling-polish-20261005/`; private Rohdaten und Veröffentlichungssatz: `.family-qa/pregnancy-feeling-polish-20261005/`.
