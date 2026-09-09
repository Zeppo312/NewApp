# Lotti Baby: deutscher App-Store-Auftritt

Stand: 7. September 2026. Lokal vorbereitet, noch nicht zu Apple übertragen.

## Ziel

Eltern mit Baby sollen sofort erkennen: Mahlzeiten, Schlaf und Windeln an einem Ort festhalten und den Überblick mit dem anderen Elternteil teilen. Das ist eine zu prüfende Positionierung, kein belegtes Ranking- oder Downloadversprechen. Schwangerschaft bleibt als weiterer Einstieg enthalten.

## Einsetzbare Store-Texte

Die Texte sind bereits in `store.config.json` unter `apple.info.de-DE` eingetragen. Die vorherigen fünf Felder liegen in `vorher.de-DE.json`.

### App-Name

Lotti Baby: Baby Tracker

### Untertitel

Stillen, Schlaf & gemeinsam

### Werbetext

Wann war das letzte Fläschchen? Wie lange hat euer Baby geschlafen? Haltet euren Babyalltag gemeinsam fest – mit Lotti Baby habt ihr beide den Überblick.

### Beschreibung

Wann hat euer Baby zuletzt getrunken? Wie lange hat es geschlafen? Mit Lotti Baby haltet ihr Stillen, Fläschchen, Schlaf und Windeln an einem Ort fest – und behaltet als Eltern gemeinsam den Überblick.

EUER BABYALLTAG AUF EINEN BLICK
Dokumentiere Mahlzeiten, Schlafphasen und Windelwechsel. In der Tagesübersicht kannst du nachsehen, was wann passiert ist, ohne dir jede Uhrzeit merken zu müssen.

GEMEINSAM ALS ELTERN
Verknüpft eure Accounts und nutzt die Baby-Daten gemeinsam. So kann auch das andere Elternteil nachsehen, welche Einträge bereits erfasst wurden – praktisch beim Wechsel zwischen euren Betreuungszeiten.

SCHLAF EINFACH FESTHALTEN
Starte und beende Schlafphasen im Schlaftracker. Im Verlauf kannst du die erfassten Schlafzeiten nachsehen und den Tagesablauf eures Babys nachvollziehen.

SCHON IN DER SCHWANGERSCHAFT AN DEINER SEITE
Verfolge den Countdown bis zum Geburtstermin, erfasse Wehen und bereite mit Geburtsplan und Klinik-Checkliste die Ankunft deines Babys vor.

ERINNERUNGEN UND FAMILIENALLTAG
Halte Gewicht, Größe und Meilensteine fest. Gemeinsame Termine und Einkaufslisten helfen euch, den Familienalltag zu organisieren.

ABONNEMENTS
Lotti Baby bietet die Abonnements Lite, Standard und Premium. Der Funktionsumfang hängt vom gewählten Tarif ab. Preise und Laufzeiten werden dir vor dem Kauf in der App angezeigt. Abonnements kannst du über deinen Apple Account verwalten und kündigen.

Lade Lotti Baby herunter und halte euren ersten Eintrag fest.

Nutzungsbedingungen (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

### Keywords

schwangerschaft,fläschchen,windeln,wehen,meilensteine,tagebuch,geburt,beikost,wochenbett,kalender

Keywords sind zunächst thematisch passende Kandidaten; Suchvolumen und Konkurrenz wurden nicht gemessen. Name und Untertitel werden im Keyword-Feld nicht wiederholt.

## Erste drei Screenshots: fertige Texte und Motivvorgaben

Die drei Motive sind als PNGs mit 1242 × 2688 Pixeln umgesetzt und visuell geprüft. Die Store-Konfiguration verwendet weiterhin die bisherige Bildserie; es wurde nichts veröffentlicht.

- [Babyalltag](screenshots/01-babyalltag.png)
- [Gemeinsam](screenshots/02-gemeinsam.png)
- [Schlaf](screenshots/03-schlaf.png)

Die finalen Dateien werden aus editierbaren HTML-Vorlagen mit unveränderten Originalaufnahmen gerendert. Reproduktion: `node marketing/app-store-optimierung-2026-09-07/screenshots/render.cjs`. Die Vorlagen betten die Originaldateien vollständig ein. Bildgenerierung mit dem eingebauten Imagegen-Tool diente der Gestaltung; deren Ergebnisse sind wegen abweichender UI-Details nur unter `screenshots/ki-entwuerfe/` archiviert. Prompts: `screenshots/imagegen-prompts.json`.

Grenzen der vorhandenen Aufnahmen: Babyalltag zeigt einen leeren aktuellen Tag mit letzter Flasche vom Vortag; beim Schlafmotiv sind die Start-Schaltflächen nur teilweise sichtbar. Die Werte wurden nicht künstlich geändert. Für eine spätere optimierte Aufnahme einen gefüllten Demo-Tag und die Schlafsteuerung vollständig erfassen.

| Reihenfolge | Überschrift | Ergänzung | Echte App-Ansicht |
| --- | --- | --- | --- |
| 1 | Wann war das letzte Fläschchen? | Stillen, Flasche und Windeln auf einen Blick. | „Unser Tag“ mit schlüssigen Demo-Einträgen und gut lesbaren Uhrzeiten. |
| 2 | Ein Baby. Euer gemeinsamer Überblick. | Verknüpft eure Accounts und teilt die Baby-Daten. | Partner-Verknüpfung; anschließend gemeinsame Tagesübersicht. |
| 3 | Schlaf festhalten. Verlauf im Blick. | Schlafphasen einfach starten und beenden. | Schlaftracker mit Verlauf und eindeutig erkennbarer Startfunktion. |

Gestaltung: vorhandene Markenfarben und Schrift beibehalten; eine große Überschrift und eine kurze Ergänzung pro Motiv. Die App groß und lesbar zeigen. Keine Schlafverbesserung versprechen. Ausschließlich Demo-Daten verwenden. Vorhandene Simulator-Aufnahmen in `marketing/partner-post/` können als Ausgangsmaterial dienen; Darstellung und Funktionsumfang müssen zur eingereichten Version passen.

Weitere Reihenfolge: Schwangerschaft → Meilensteine → Familienorganisation. Keine Community bewerben: Die lokalen Release Notes für 1.0.23 beschreiben deren Entfernung.

## Auffälligkeit: Store-Sprache

Die öffentlich abrufbare deutsche Store-Seite zeigt „Englisch“. Das Projekt beschreibt Deutsch, Englisch und Spanisch. In `ios/LottiBaby/Info.plist` ist keine explizite Liste `CFBundleLocalizations` vorhanden. Das ist ein Anhaltspunkt, noch kein vollständiger Nachweis der Ursache. Vor dem nächsten Build die tatsächlich gebündelten Lokalisierungen und die generierte native Konfiguration prüfen; deutsche Beschreibung allein ändert die angezeigten App-Sprachen nicht automatisch.

## Erfolg prüfen

Vor dem Veröffentlichen: die letzten 28 Tage mit Store-Impressionen, Produktseiten-Aufrufen und Erstdownloads für Deutschland dokumentieren, nach Quelle soweit verfügbar. Nach Änderung wöchentlich dieselben Kennzahlen vergleichen. Kampagnen, Veröffentlichungen und Zeitraum notieren, damit saisonale Effekte nicht als Wirkung der Texte interpretiert werden.

Zunächst die Metadaten veröffentlichen und das Datum festhalten. Neue Screenshots anschließend als eigenen Versuch testen, sofern genug Traffic vorhanden ist. Ein Vorher-nachher-Vergleich allein beweist keine Ursache. Apple Product Page Optimization testet visuelle Assets, nicht Titel oder Keywords.

## Quellen

- Öffentlicher Eintrag: https://apps.apple.com/de/app/lotti-baby-tracker-schlaf/id6745569710
- Apple zu Produktseiten und Feldgrenzen: https://developer.apple.com/app-store/product-page/
- Apple zu visuellen Tests: https://developer.apple.com/app-store/product-page-optimization/
- Lokaler Funktionsabgleich: README.md, store.config.json und marketing/partner-post/README.md. Der öffentlich abrufbare Stand (1.0.16) weicht von der lokalen Version (1.0.23) ab.


## Ergänzung: vier weitere Motive

Alle sieben PNGs: [ZIP herunterladen](Lotti-Baby-Screenshots-7-Motive.zip). Die Ergänzungen nutzen dieselben Farben und Schriften, mit vergrößerten Funktionsausschnitten aus bestehenden deutschen Store-Aufnahmen. Die Bildinhalte werden in HTML nur skaliert und per Ansichtsfenster beschnitten; keine UI-Elemente oder Werte werden nachgezeichnet.

- [04 Klinik-Checkliste](screenshots/04-kliniktasche.png) — Quelle: 17.png.
- [05 Erste Zähne](screenshots/05-erste-zaehne.png) — Quelle: 23.png.
- [06 Tagesplanung](screenshots/06-tagesplanung.png) — Quelle: 15.png.
- [07 Babywetter](screenshots/07-babywetter.png) — Quelle: 22.png.

Quellenverzeichnis: `store/apple/screenshot/de-DE/APP_IPHONE_65/`. Diese Aufnahmen stammen aus einer älteren Version; die alte Navigation ist außerhalb des Ausschnitts. Vor einem Store-Upload die dargestellten Funktionsansichten mit dem einzureichenden Build abgleichen. Keine automatische Änderung der Store-Bildzuordnungen.

Prüfung: vier neue Motive einzeln visuell kontrolliert; sieben PNGs auf 1242 × 2688 Pixel geprüft. Erneut nur die vier Ergänzungen rendern: `node marketing/app-store-optimierung-2026-09-07/screenshots/render.cjs --new`.


### Korrektur: iPhone-Rahmen

Die Motive 04–07 verwenden jetzt ebenfalls den dunklen iPhone-Rahmen mit metallischer Außenkante, abgerundeten Display-Ecken und Schatten aus der bestehenden HTML-Vorlage. Der Funktionsausschnitt bleibt erhalten. Alle vier PNGs wurden neu gerendert und das ZIP mit allen sieben Motiven aktualisiert.
