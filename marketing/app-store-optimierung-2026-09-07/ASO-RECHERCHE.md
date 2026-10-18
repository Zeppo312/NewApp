# Lotti Baby: ASO-Recherche und Umsetzungsplan

Stand: 7. September 2026. Schwerpunkt: deutscher Apple App Store. Recherche und lokale Entwürfe; keine Veröffentlichung bei Apple.

## Empfehlung

Lotti Baby sollte auf der Standard-Produktseite zuerst den gemeinsamen Babyalltag erklären: Stillen, Fläschchen, Schlaf und Windeln festhalten, damit beide Eltern den Überblick behalten. Schwangerschaft ist ein zweiter Einstieg mit eigener Produktseite. Das ist eine Positionierung zum Testen, kein belegtes Rankingversprechen.

Die höchste Priorität haben aktuelle, nutzenorientierte Screenshots. Danach folgen gezielt angepasste Metadaten, ein sinnvoller Bewertungszeitpunkt und getrennte Messung von Auffindbarkeit, Downloads und tatsächlicher Nutzung.

## 1. Befund: öffentlich, lokal und noch unbekannt

Die aktuell abgerufene [deutsche Produktseite](https://apps.apple.com/de/app/lotti-baby-schlaf-stillen/id6745569710) zeigt:

| Feld | Öffentlich abgerufen |
| --- | --- |
| Name | Lotti Baby: Schlaf & Stillen |
| Untertitel | Babytracker, Windeln & Wetter |
| Bewertung | 4,6 aus 35 Bewertungen |
| Version | 1.0.23 |
| Sprachen | Deutsch, Englisch, Spanisch |
| Kategorie | Gesundheit und Fitness |

Die dort sichtbaren Rezensionen erwähnen unter anderem den Partnermodus, Übersichtlichkeit und die Begleitung vor und nach der Geburt positiv. Das ist eine kleine, nicht repräsentative qualitative Stichprobe. Die Release Notes nennen weiterhin nicht verfügbare Community- und Nachrichtenbereiche.

Der ältere lokale README-Entwurf in diesem Ordner nennt noch Englisch als einzige öffentlich angezeigte Sprache und Version 1.0.16. Diese Befunde sind durch den heutigen Abruf überholt. Seine grundsätzlich sinnvolle Ausrichtung auf gemeinsamen Babyalltag bleibt eine Hypothese.

`store.config.json` enthält bereits abweichende deutsche Texte. Sie sind kein Beleg für den veröffentlichten Stand. Das versteckte Keyword-Feld der Live-Version wurde nicht eingesehen. Keine Ranking-, Suchvolumen-, Conversion- oder Umsatzdaten aus App Store Connect lagen vor.

Die Bildkritik unten bezieht sich auf die drei in der lokalen Konfiguration zuerst zugeordneten iPhone-Dateien, nicht auf eine verifizierte identische Live-Reihenfolge.

## 2. Wettbewerber: Was Lotti daraus lernen kann

| App | Sichtbares Angebot bzw. Positionierung | Konsequenz für Lotti |
| --- | --- | --- |
| [Huckleberry](https://apps.apple.com/de/app/huckleberry-baby-child/id1169136078) | Tracking, Schlafprognosen und abgestufte Zusatzleistungen; gemeinsamer Zugriff | Nicht mit unbelegter Schlafexpertise konkurrieren. Erfasste Zeiten und gemeinsame Übersicht konkret zeigen. |
| [Nara](https://apps.apple.com/de/app/nara-baby-pregnancy-tracker/id1444639029) | Ruhige Bedienung, Betreuungspersonen, Schwangerschaft und Babytracking | Partnersynchronisierung und Schwangerschaft sind nicht exklusiv. Deutsche Bedienung und der konkrete Ablauf müssen überzeugen. |
| [Baby Tracker von Nighp](https://apps.apple.com/de/app/baby-tracker-babytagebuch/id779656557?platform=ipad) | Klarer Funktionsname, Alltagstracking, schnelle Einträge und Teilen mit Betreuungspersonen | Funktionsbegriffe deutlich platzieren und zeigen, wie man letzte Ereignisse wiederfindet. |
| [Baby+](https://apps.apple.com/de/app/baby-dein-baby-tracker/id1093774002?platform=watch) | Entwicklungsbegleitung, Ratgeber, Erinnerungen und Tracker | Mit einer konkreten Alltagssituation beginnen. Die lange Funktionsliste später zeigen. |

Diese Auswahl erklärt den Wettbewerb, misst aber keine Marktanteile. Sichtbare Bewertungen und Rezensionen beweisen keine Ursache für den Erfolg. Nara-Suchergebnisse enthalten widersprüchliche historische Angaben zu kostenloser Nutzung und aktuellen In-App-Käufen; daraus wird hier kein Preisvergleich abgeleitet.

## 3. Auffindbarkeit: Metadaten mit klarer Aufgabe

Apple nennt unter anderem Titel, Untertitel, Keywords, Kategorien und Nutzerverhalten als Suchfaktoren. Das Keyword-Feld bietet 100 Zeichen; Wiederholungen aus Name und Untertitel verschwenden Platz. Werbetext beeinflusst laut Apple das Suchranking nicht. Wettbewerbernamen gehören nicht ins Keyword-Feld. [Apple: App Store Search](https://developer.apple.com/app-store/search/)

### Empfohlene erste Testfassung

**Name:** Lotti Baby: Baby Tracker

**Untertitel:** Stillen, Schlaf & Windeln

**Keyword-Feld:**

```text
schwangerschaft,fläschchen,abpumpen,wehen,tagebuch,beikost,wochenbett,entwicklung,meilensteine
```

**Werbetext:**

```text
Wann war das letzte Fläschchen? Haltet Stillen, Schlaf und Windeln gemeinsam fest – damit ihr als Eltern beide den Überblick habt.
```

Der Name erklärt die Produktart; der Untertitel benennt die wichtigsten Anwendungen. Die Partnerbotschaft steht in Werbetext und Bildern. Gegenüber dem lokalen Untertitel „Stillen, Schlaf & gemeinsam“ ist das sprachlich vollständiger und enthält einen weiteren konkreten Funktionsbegriff.

Die Alternative „Stillen & Schlaf gemeinsam“ ist ein späterer Positionierungstest. Sie ersetzt Windeln im Untertitel; dann muss das Keyword-Feld neu zusammengestellt werden. Varianten nicht beliebig kombinieren.

Der veröffentlichte Titel enthält bereits sinnvolle Suchbegriffe. Ohne Daten ist nicht belegt, dass der vorgeschlagene Name besser rankt. Vor einem Wechsel aktuelle Rankings und Akquisition dokumentieren; bei guten bestehenden Suchzugriffen können zuerst nur die Bilder verbessert werden.

### Keyword-Arbeitsliste

| Priorität | Suchintention / Kandidaten | Geplanter Einsatz |
| --- | --- | --- |
| Hoch | baby tracker, babytracker, stillen, schlaf, windeln | Kernbegriffe; Schreibweisen im deutschen Store getrennt prüfen |
| Hoch | fläschchen, abpumpen, babytagebuch | Konkrete Dokumentationsaufgaben |
| Mittel | schwangerschaft, wehen, wochenbett | Zweiter Einstieg; separate Schwangerschaftsseite |
| Mittel | beikost, meilensteine, entwicklung | Ergänzende Funktionen |
| Explorativ | baby tracker gemeinsam, stillen dokumentieren, babyschlaf protokollieren | Sprachmuster und Suchvorschläge untersuchen |
| Niedrig für den ersten Versuch | kalender, wetter, einkaufsliste | Breite bzw. ergänzende Intention, begrenzter Platz |

Priorität bedeutet hier Passung zum Produkt, nicht gemessenes Volumen oder geringe Konkurrenz. Für deutsche Komposita wie „Babytagebuch“ und „Babytracker“ keine automatische Gleichbehandlung durch Apple voraussetzen.

Validierung: je Kandidat Datum, Land, Sprache, Suchvorschläge, organische Position und relevante Top-Ergebnisse erfassen. Anzeigen separat markieren. In Apple Ads verfügbare Search-Popularity-Werte ergänzen; sie beschreiben Popularität und sind keine exakte monatliche Suchanzahl. [Apple Ads: Keyword-Empfehlungen](https://ads.apple.com/app-store/help/recommendations/0055-review-recommendations)

## 4. Screenshots: die wichtigste konkrete Überarbeitung

Visuell geprüft wurden `14.png`, `20.png` und `19.png` unter `store/apple/screenshot/de-DE/APP_IPHONE_65/`.

| Bestehendes Motiv | Problem | Ersatz |
| --- | --- | --- |
| „Baby & Kleinkind-Modus“ | Benennt einen Modus; Tippkarte nimmt viel Platz ein, letzte Ereignisse sind nicht der Schwerpunkt. | „Wann war das letzte Fläschchen?“ plus Tagesverlauf mit gut lesbarer Uhrzeit |
| „Verknüpft eure Accounts“ | Zeigt Code-Eingabe und Einrichtung statt des Ergebnisses für Eltern. | „Ihr beide habt den Überblick“ plus bereits gemeinsam nutzbare Tagesdaten |
| „Verbinde Baby & Schwangerschaft“ | Profil-Auswahldialog statt Tracking; erklärt keine zentrale Alltagshilfe. | „Schlafzeiten einfach festhalten“ plus Timer und Verlauf |

Im ersten und dritten Motiv ist noch ein Community-Tab sichtbar. Für die aktuelle Version neue Aufnahmen mit passender Navigation produzieren. Die langen Versalien-Überschriften wirken schwer; kürzere Sätze mit stärkerer Lesbarkeit in kleiner Store-Darstellung testen. Bestehende Pastellfarben können bleiben.

### Fertige Reihenfolge für die Produktion

| Nr. | Überschrift | Ergänzung | Zu zeigende echte Ansicht |
| --- | --- | --- | --- |
| 1 | Wann war das letzte Fläschchen? | Stillen, Flasche und Windeln im Blick. | „Unser Tag“ mit schlüssigen Demo-Einträgen |
| 2 | Ihr beide habt den Überblick | Baby-Daten gemeinsam nutzen. | Geteilte Daten; Einrichtung höchstens ergänzend |
| 3 | Schlafzeiten einfach festhalten | Timer starten. Verlauf ansehen. | Schlaftracker mit laufender oder beendeter Schlafphase |
| 4 | Schon vor der Geburt für dich da | Schwangerschaft und Geburt vorbereiten. | Schwangerschaftswoche und Countdown |
| 5 | Kleine Fortschritte festhalten | Gewicht, Größe und Meilensteine. | Befüllte Entwicklungsansicht |
| 6 | Euren Familienalltag organisieren | Termine und Einkaufslisten an einem Ort. | Planer oder Einkaufsliste, einen Schwerpunkt wählen |

Weitere Motive nur bei zusätzlichem Nutzen: Widget, Spracheingabe oder Dunkelmodus, jeweils nach Prüfung der eingereichten Version und des benötigten Tarifs. Lieber sechs starke Bilder als zehn ähnliche. Nutzen mit einer Überschrift verständlich machen; UI groß zeigen, Demo-Daten verwenden und zentrale Inhalte nicht vom Gerätemockup verdecken lassen.

Apple erlaubt bis zu zehn Screenshots; je nach Darstellung können die ersten ein bis drei Bilder in Suchergebnissen erscheinen. Ein vorhandenes Preview-Video kann diese Darstellung verändern. Deshalb auch dessen Vorschaubild prüfen. [Apple: Produktseite](https://developer.apple.com/app-store/product-page/)

Die konfigurierte Videodatei wurde hier nicht abgespielt. Produktionsidee: direkt mit einem Eintrag beginnen, anschließend gemeinsame Übersicht und Schlafverlauf zeigen; auch ohne Ton verständlich. Kein langes Logo-Intro. Keine erfundenen UI-Ansichten oder unbelegten Schlafverbesserungen.

## 5. Beschreibung zum Einsetzen

Wann hat euer Baby zuletzt getrunken? Wie lange hat es geschlafen? Mit Lotti Baby haltet ihr Stillen, Fläschchen, Schlaf und Windeln fest – und behaltet als Eltern gemeinsam den Überblick.

EUER BABYALLTAG AUF EINEN BLICK
Dokumentiere Mahlzeiten, Schlafphasen und Windelwechsel. In der Tagesübersicht siehst du nach, was wann passiert ist, ohne dir jede Uhrzeit merken zu müssen.

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

### Vor Verwendung der Beschreibung

Die Funktionen wurden mit Projektunterlagen und dem bestehenden lokalen Text abgeglichen, nicht vollständig auf einem Release-Gerät getestet. Insbesondere gemeinsame Nutzung und Tarifgrenzen müssen zum eingereichten Build passen. Keine pauschale kostenlose Nutzung oder feste Testdauer ergänzen, solange aktuelle Angebote und Teilnahmebedingungen nicht bestätigt sind.

## 6. Bewertungen und die ersten Minuten in der App

Ein Store-Download hilft wenig, wenn danach die Einrichtung abbricht. Für Lotti folgende Abläufe überprüfen:

1. Einstieg „Schwanger“ oder „Baby schon da“ führt direkt zum relevanten Bereich.
2. Der erste Mahlzeiten- oder Schlafeintrag gelingt ohne Suche durch viele Funktionen.
3. Partner-Einladung erklärt, welche Daten geteilt werden und welcher Tarif nötig ist.
4. Der Abo-Bildschirm erklärt Basisnutzen, Zusatzfunktionen und Kosten vor dem Kauf.
5. Einträge bleiben zuverlässig gespeichert und sind für den Partner sichtbar.

Das sind Prüf- und Verbesserungsvorschläge, keine in dieser Recherche nachgewiesenen App-Fehler.

In `app`, `hooks`, `services`, `lib`, `components` und `package.json` wurde kein Treffer für `StoreReview`, `requestReview`, `SKStoreReview` oder `expo-store-review` gefunden. Das ist ein Anhaltspunkt für eine fehlende Standardintegration, keine vollständige Prüfung sämtlichen nativen Codes.

Bewertungsanfrage als erste Produktregel beispielsweise nach drei aktiven Tagen und fünf gespeicherten Einträgen erwägen, an einer ruhigen Stelle nach Abschluss des Ablaufs. Diese Schwellen sind ein eigener Vorschlag. Apple empfiehlt passende Erfolgsmomente und begrenzt die tatsächliche Systemanzeige auf höchstens dreimal in 365 Tagen; die Anzeige ist nicht garantiert. Keine Vorabfrage, die nur zufriedene Menschen zum Store weiterleitet, und keine Belohnung für Bewertungen. [Apple: Bewertungen anfragen](https://developer.apple.com/documentation/StoreKit/requesting-app-store-reviews)

Kritische Rezensionen auf konkrete Fehler untersuchen; Antworten mit Lösungsweg vorbereiten. [Apple: Rezensionen und Antworten](https://developer.apple.com/app-store/ratings-and-reviews/)

## 7. Separate Produktseiten und Sprachen

Für zwei unterschiedliche Einstiege je eine Custom Product Page planen:

- **Gemeinsamer Babyalltag:** Partner-Reel oder Website → gemeinsame Übersicht → Tracking → Schlaf.
- **Schwangerschaft:** Schwangerschaftsinhalte → Countdown → Geburtsvorbereitung → spätere Babybegleitung.

Apple unterstützt eigene Links und die Zuordnung von Keywords aus der zuletzt genehmigten App-Version, damit eine passende Seite auch bei entsprechenden Suchen erscheinen kann. Das schafft keine zusätzlichen frei wählbaren Keyword-Felder. [Apple: Custom Product Pages konfigurieren](https://developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions)

Deutsch zuerst messen. Englisch und Spanisch separat optimieren, einschließlich tatsächlicher UI-Sprache in Bildern und passender lokaler Suchbegriffe. Die vorhandenen englischen und spanischen Dateien sind noch kein Beleg für eine erfolgreiche Lokalisierung. Die öffentlich angezeigten drei App-Sprachen sind bereits vorhanden; dafür ist aus diesem Audit kein Fix abzuleiten.

App Tags sind nach der aktuell abgerufenen Apple-Hilfe auf den US-Store beschränkt. Für Deutschland deshalb keine vorrangige Maßnahme; für en-US die zugewiesenen Tags auf Passung prüfen. [Apple: App Tags](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-tags)

Die aktuelle Hauptkategorie passt grundsätzlich zum Produkt. Nicht nur wegen eines vermeintlich leichteren Rankings wechseln. Icon zunächst auf Erkennbarkeit in kleiner Darstellung prüfen; ein neuer Entwurf wäre ein separater Versuch, kein belegter Bedarf aus dieser Recherche.

## 8. Umsetzung und Messung

| Zeitpunkt | Arbeit | Ergebnis |
| --- | --- | --- |
| Tag 1–3 | Letzte 28 Tage exportieren; Keywords erfassen; aktuelle Bilder mit Release abgleichen | Baseline und geprüfte Inhalte |
| Tag 4–7 | Sechs neue Screenshots mit echten Aufnahmen produzieren, Texte und Tarifangaben prüfen | Einreichbare Motive und Metadaten |
| Woche 2 | Korrekte aktuelle Basisbilder veröffentlichen; Beginn einer Metadatenänderung protokollieren, falls gewählt | Klarer Ausgangspunkt mit dokumentiertem Änderungsdatum |
| Woche 3–6 | Eine alternative erste Screenshot-Botschaft gegen die aktuelle Basis testen | Auswertbarer Conversion-Versuch bei ausreichendem Traffic |
| Danach | Gewinner übernehmen oder bei unklarem Ergebnis weiter messen; zweite Produktseite ausarbeiten | Schrittweise belegte Verbesserungen |

Für den visuellen Versuch: Variante A beginnt mit dem letzten Fläschchen, Variante B mit gemeinsamem Überblick. Die übrigen Bilder identisch halten. Beide Varianten müssen aktuell sein; veraltete Navigation ist kein sinnvoller Kontrollzustand. Bei wenig Traffic nur eine Alternative verwenden.

Apple beschreibt im Einrichtungsleitfaden Tests von Icon, Screenshots und Previews. Titel und Keywords werden hier deshalb als versionierte Metadatenänderung behandelt, nicht als gleichzeitiger PPO-Test. Die Analytics-Hilfe erwähnt zusätzlich Beschreibungen; die Dokumentation ist hier nicht vollständig konsistent. Verfügbare Felder vor einem Texttest im eigenen Account prüfen. [Apple: PPO-Einrichtung](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/), [Apple: PPO-Auswertung](https://developer.apple.com/help/app-store-connect-analytics/acquisition/product-page-optimization)

Wöchentlich mit identischen Filtern erfassen: Deutschland, iOS, Zeitraum, Quelle, App-Version und Kampagnen. Organische Suche, Browse und externe Kampagnen getrennt betrachten, soweit die Exporte dies ermöglichen.

| Stufe | Kennzahl | Zweck |
| --- | --- | --- |
| Sichtbarkeit | Store-Impressionen, organische Positionen der Zielbegriffe | Wird die App gefunden? |
| Interesse | Produktseiten-Aufrufe | Wird die Seite besucht? |
| Download | Erstdownloads und Apples ausgewiesene Conversion-Rate | Wird aus der Darstellung ein Download? |
| Aktivierung | Erster gespeicherter Eintrag je neuem Konto | Wird das Produkt tatsächlich benutzt? |
| Gemeinsame Nutzung | Erfolgreiche Partner-Verknüpfung je neuem Konto | Trägt die Partnerpositionierung? |
| Bindung / Geschäft | D7-Nutzung, Testabo- und Kaufabschluss nach Kohorte | Bringen die Downloads dauerhaften Nutzen? |

Kennzahldefinitionen aus Apple-Exporten übernehmen. Erstdownloads nicht pauschal durch Produktseiten-Aufrufe teilen und als Apples Conversion-Rate ausgeben: Downloads können direkt aus Suchergebnissen erfolgen. App-interne Kennzahlen brauchen passende vorhandene oder noch einzurichtende Ereignisse. Nur Ereignisanzahlen und nötige Zuordnungen messen, keine Baby-Tagebuchinhalte in Marketing-Analytics senden.

Kein fester Mindest-Uplift und keine garantierte Testdauer ohne Baseline. Apples statistische Auswertung beachten; ein unentschiedenes Ergebnis ist kein Erfolg. Vorher-nachher-Vergleiche von Metadaten bleiben durch Releases, Kampagnen und Saisonalität beeinflusst.

## Lieferumfang und' offene Arbeit

Fertig: Recherche, priorisierte Empfehlungen, deutsche Copy, Keyword-Kandidaten, Bildbriefing und Messplan. Die Datei `metadata-vorschlag.de-DE.json` enthält die vorgeschlagenen Textfelder; Feldlängen werden separat geprüft.

Noch auszuführen: tatsächliche Keyword-Messung, Analytics-Export, neue Bildschirmaufnahmen und Bildproduktion, Release-Funktionsprüfung sowie Einreichung und Experimente in App Store Connect. Diese Recherche hat weder neue Store-Bilder erstellt noch Änderungen bei Apple veröffentlicht.
