# Schwangerschaftsmodus: Wochenwissen und Gestaltung

Aktueller Gestaltungsnachtrag vom 04.10.2026: Vollbildfotos, abgehobene Textflächen mit direktem Artikelaufruf und Blättern durch Tippen ohne sichtbare Pfeile sind als EAS Update auf dem bisherigen Vorschau-Kanal veröffentlicht. Die vorherige Absturzbehebung ist vom Nutzer auf seinem Gerät bestätigt. Aktueller Stand: [pregnancy-story-photo-20261004.md](pregnancy-story-photo-20261004.md).

Stand: 30. September 2026. Konzept auf Basis des aktuellen Arbeitsstands im Repo, der 20 Flo-Screenshots, der zwei Screenshots der bestehenden LottiBaby-Startseite und der Klarstellungen des Nutzers: Vor allem fehlen Informationen zum aktuellen Stand der Schwangerschaft; das bestehende Design soll erhalten bleiben.

Aktuelle Fehlerkorrektur vom 03.10.2026, 23:02 MESZ: Der Absturz beim Öffnen der Story wurde mit echter iOS-Navigation reproduziert und korrigiert. Das EAS Update betrifft ausschließlich den Vorschau-Kanal. Aktueller Stand: [pregnancy-story-crash-20261003.md](pregnancy-story-crash-20261003.md).

Aktueller Umsetzungsnachtrag vom 03.10.2026: Die Story folgt auf ausdrücklichen Wunsch dem Vollbild-Wochenreview mit laufender Zeit, Halten zum Pausieren und Wegwischen nach unten. Die aktuelle Komponentenvorschau, Prüfungen und Auslieferungsgrenzen stehen in [pregnancy-story-playback-20261003.md](pregnancy-story-playback-20261003.md). Die zwischenzeitliche Bitte um einen iPhone-Build wurde ausdrücklich zu EAS Update korrigiert; der Abbruch des zusätzlichen Builds ist in [pregnancy-story-build-20261003.md](pregnancy-story-build-20261003.md) dokumentiert. Die folgenden Konzeptabschnitte bleiben als ursprüngliche Abstimmung erhalten.

## Entscheidung

Die Schwangerschafts-Startseite wird zu einer verständlichen Begleitung für die aktuelle Woche. Ihr erster Nutzen ist Wissen: Was entwickelt sich beim Baby? Was verändert sich bei mir? Was ist gerade relevant? Gestaltung und Bilder machen dieses Wissen leichter zugänglich.

Festgelegte Gestaltungsrichtung: **Wochenbegleiter im bestehenden LottiBaby-Design**. Sternenhintergrund, Glaskarten, Pastellfarben, runde Icon-Abzeichen, Begrüßung und untere Navigation bleiben erhalten. Neue Inhaltskacheln erhalten Bilder, einen kurzen konkreten Wissensvorschau-Text und eine ausführliche Leseseite. Die Flo-Screenshots liefern Anregungen für Themenbreite und Informationshierarchie; Texte und Medien werden eigenständig entwickelt. Die früheren warmen Magazin-Mockups dienen nur noch als verworfener Vergleich für die visuelle Gestaltung.

Der vollständige Schnellzugriff bleibt als Raster mit zehn Kacheln auf der Startseite. Es gibt keine Reduktion auf vier Werkzeuge und kein Verstecken hinter „Alle Funktionen“. Die Inhaltskacheln ersetzen den großen Premiumblock vor dem Schnellzugriff; Premium folgt danach. In der App bleiben bestehende Sortier- und Ausblendpräferenzen berücksichtigt.

Klarstellung nach dem Kachelentwurf: **„Dein Tag im Überblick“ bleibt in bestehendem Aufbau, Look und Verhalten erhalten.** Die neuen Wissensblöcke kommen darunter. Der Wissensblock „Gut zu wissen, gerade jetzt“ übernimmt den Aufbau der akzeptierten Baby-/Körperkacheln: großes Bild oben, Titel, kurze Vorschau und „Mehr erfahren“. Die kleinen Icon-Karten aus der vorherigen Vorschau werden ersetzt.

Die Vorschau ist ein lokales Konzept mit Beispielzustand 26+1. Texte sind Quellen-basierte Kurzbeispiele beziehungsweise als Themenvorschläge markiert, noch keine fachlich freigegebene Inhaltsbibliothek. Persönliche Daten, Termine und Notizen in der Vorschau sind keine echten Nutzerdaten. App-Code und Backend wurden für dieses Konzept nicht geändert.

## Übergabe an einen neuen Chat

**Bestätigter Stand:** Der Nutzer hat den letzten Entwurf mit Bildkacheln ausdrücklich akzeptiert („Ja, sowas ist geil“). Die Designrichtung ist damit abgestimmt. Eine vollständige Inhaltsbibliothek, fachliche Freigabe und native Umsetzung stehen noch aus. Die reine Konzeptarbeit hat keine Schwangerschafts-App-Komponenten verändert.

Aktuelle visuelle Referenz auf diesem Mac:

`/Users/janzeppenfeld/.codex/visualizations/2026/09/30/01a0f38c-5025-7fb2-b76d-00f62d43bdfb/lottibaby-schwangerschaft-glaskacheln.html`

Diese Datei enthält die letzte akzeptierte Vorschau einschließlich eingebetteter Illustrationen. Der frühere Entwurf `lottibaby-schwangerschaft.html` mit „Wochenbegleiter“/„Wissensmagazin“ ist nicht die visuelle Referenz für die Umsetzung.

Verbindliche Gestaltungsentscheidungen aus der Abstimmung:

- Begrüßung sowie „Dein Tag im Überblick“ behalten den vorhandenen Look, Aufbau und ihr Verhalten. Die Vorschau bildet nicht jedes bestehende Verhalten nach; für diesen Bereich ist der vorhandene App-Code maßgeblich.
- Neue Wochenkacheln „Dein Baby“ und „Dein Körper“ darunter: Bild/Motiv, Titel, konkrete kurze Vorschau, „Mehr erfahren“.
- „Gut zu wissen, gerade jetzt“ bekommt denselben Aufbau mit passenden Illustrationen, statt der früheren kleinen Icon-Karten.
- Alle zehn bestehenden Schnellzugriffe bleiben als Raster auf Home; bestehende Nutzereinstellungen zum Sortieren/Ausblenden berücksichtigen.
- Premiumblock folgt nach dem Schnellzugriff. Bestehende globale Navigation und alle Hintergrund-/Theme-Einstellungen bleiben erhalten.

Vor einer späteren Umsetzung den aktuellen Git-Arbeitsstand und Projektanweisungen prüfen. Der analysierte Checkout enthielt bereits umfangreiche fremde Arbeitsänderungen; diese nicht überschreiben oder zurücksetzen. Die Zeilenangaben in diesem Plan sind Analysebelege vom 30.09.2026 und müssen gegen den dann aktuellen Code geprüft werden. Browserprüfungen der Vorschau bestätigen keine native Integration oder medizinische Abnahme. Die Erstellung dieses Plans allein autorisiert keine Veröffentlichung oder medizinische Freigabe.

## Befund im Repo

| Beobachtung | Beleg | Konsequenz |
| --- | --- | --- |
| Home zeigt Begrüßung, Übersicht, Premiumangebote und zehn Schnellzugriffe. | `app/(tabs)/pregnancy-home.tsx:1559`, Definitionen ab Zeile 295 | Babyentwicklung und Körperwissen müssen direkt in den Einstieg. |
| Die Übersicht rotiert automatisch zwischen Schwangerschaftszahlen und einer Shopkarte. | `app/(tabs)/pregnancy-home.tsx:672`, `:1114`, `:1233` | Bestehenden Überblick einschließlich Wechselverhalten auf ausdrücklichen Nutzerwunsch beibehalten; neue Wochenkacheln darunter hinzufügen. |
| Wocheninfos existieren bereits im Countdown unter Babygröße und ET-Bearbeitung. | `app/(tabs)/countdown.tsx:594`, `:687` | Bestehendes Wissen nicht als fehlend behandeln: sichtbar machen und inhaltlich erweitern. |
| Pro Woche meist ein Satz fürs Baby, ein Satz für die Mutter und eine Symptomliste. Viele Wochen teilen dieselben Symptome. | `constants/PregnancyWeekInfo.ts`, `constants/PregnancyMotherInfo.ts`, `constants/PregnancySymptoms.ts` | Symptomnamen durch verständliche Erklärungen, Alltagshilfe und passende nächste Schritte ergänzen. |
| Die Größenansicht enthält Vergleichsbild, Länge, Gewicht und einen kurzen Entwicklungstext. | `components/BabySizeDetail.tsx:240`, `lib/baby-size-data.ts` | Vorhandene Größenfunktion behalten, Einordnung und Fachprüfung ergänzen. |
| Entwicklungsdaten sind auf mehrere Dateien verteilt. Woche 4 beschreibt einmal Einnistung und einmal beginnenden Herzschlag; die Größenserie beginnt mit Befruchtung in Woche 1. | `constants/PregnancyWeekInfo.ts:3`, `lib/baby-size-data.ts:19`, `:44` | Zählweise und Entwicklungsdaten vor Erweiterung gemeinsam fachlich prüfen und vereinheitlichen. |
| Personalisierter Überblick zu Selbstfürsorge, Terminen, Arztfragen, Partneraufgaben und Vorbereitung existiert schon. | `lib/pregnancy-briefing.ts`, `lib/pregnancy-briefing-data.ts`, `app/pregnancy-briefing.tsx` | Diese Signale sinnvoll in die Wochenbegleitung integrieren. Jeder Planertermin ist zunächst ein Termin, nicht automatisch eine Vorsorgeuntersuchung. |
| Schwangerschaftsdaten werden bereits gecacht. | `lib/pregnancyCache.ts` | Redaktionelles Grundwissen lokal verfügbar machen; Bildausfall darf Wissen nicht verdecken. |

Die Zeilenangaben beziehen sich auf den bei der Analyse vorhandenen, bereits umfangreich geänderten Arbeitsstand.

## Neuer Einstieg

1. **Begrüßung und Wochenüberblick:** vorhandenen Aufbau und Look beibehalten, einschließlich großer runder Symbole, SSW-/Trimester-/Fortschrittskacheln, Öffnen-Pfeil und bestehendem Wechselverhalten. `26+1 · 27. SSW` in den neuen Wocheninhalten eindeutig erklären; den vorhandenen Überblick dafür nicht umgestalten. Keine zusätzliche Navigationsebene auf Home.
2. **Zwei neue Wochenkacheln:** „Dein Baby“ und „Dein Körper“ im vertrauten Zweispaltenraster. Bild beziehungsweise passendes Motiv, ein konkreter kurzer Wissensvorschau-Text und Zugang zum Wochendossier. Dort mehrere Entwicklungen, eingeordnete Größenangaben und mögliche Veränderungen erklären. Sprache wie „kann“ und „bei manchen“ statt Erwartungen an einen festen körperlichen Verlauf.
3. **Zwei passende Wissenskacheln:** etwa Sodbrennen und Vorsorge. Gleicher Aufbau wie Baby-/Körperkacheln mit großem Bild, Titel, kurzer Vorschau und „Mehr erfahren“. „Alle Themen“ öffnet die Wissensbibliothek. Keine tägliche künstliche Variation medizinischer Aussagen; Relevanz vor Neuigkeitsdruck.
4. **Vollständiger Schnellzugriff:** Countdown, Wehen-Tracker, Planer, Checkliste, Geburtsplan, Mama Selfcare, Meine Fragen, Mein Baby, Babynamen und Gewichtskurve im bestehenden Raster. Verfügbare Werkzeuge werden durch den Umbau nicht reduziert.
5. **Lotti Premium:** bestehende Funktionen und visuelle Gestaltung unterhalb des Schnellzugriffs. So kommen Wochenwissen und Werkzeuge früher als in der aktuellen Ansicht.

Wissensartikel und Vorbereitung werden über die passenden Kacheln geöffnet. Die globale Navigation mit Countdown, Wehen, Home, Einkaufsliste und Mehr bleibt erhalten. Die neue Vorschau zeigt die vorhandene dunkle Darstellung ausdrücklich, wie vom Nutzer als Designreferenz vorgegeben; eine App-Umsetzung muss auch die bestehenden anderen Hintergrund- und Theme-Einstellungen erhalten.

## Mehr Information, ohne die Startseite zu überladen

Inhalte werden auf drei Tiefen angeboten:

- **Sofort erfassbar:** eine kurze Antwort und wenige Stichpunkte auf der Startseite.
- **Kurz erklärt:** eine Lesekarte mit etwa 150–250 Wörtern, passend zur konkreten Frage.
- **Ausführlich:** ein Artikel mit etwa 400–700 Wörtern, Quellen und nachvollziehbaren Handlungsmöglichkeiten. Länge ist ein Richtwert; keine Fülltexte.

Jeder Beschwerdeartikel beantwortet: Was kann dahinterstecken? Was kann im Alltag helfen? Wann ist Rücksprache beziehungsweise sofortige Hilfe sinnvoll? Was möchte ich beim nächsten Termin fragen? Eine individuelle Unbedenklichkeit wird weder aus der Schwangerschaftswoche noch aus einem Check-in abgeleitet.

## Inhaltspakete

### Vollständige Wochenbegleitung

39 eigenständige Wochendossiers für die 4.–42. SSW, dazu Grundlagen zur Schwangerschaftsberechnung für die 1.–3. SSW. Ein Dossier bündelt Baby, Körper, Wohlbefinden, Vorbereitung und Quellen. Gemeinsame Grundlagenartikel werden verlinkt und müssen nicht 39-mal geschrieben werden.

Jede Woche enthält:

- einen konkreten Überblick statt einer allgemeinen Motivationszeile;
- drei fachlich belegte Entwicklungen des Babys;
- zwei bis drei mögliche körperliche Veränderungen;
- zwei passende weiterführende Wissensangebote;
- ein bis drei zeitlich passende Vorbereitungspunkte;
- zwei Vorschläge für Fragen an Hebamme oder Praxis;
- optional eine kleine Partneraufgabe;
- Quellen, Inhaltsversion und Status der fachlichen Prüfung.

### Wissensbibliothek zum Start

24 grundlegende Artikel als erste redaktionelle Ausbaustufe:

| Gruppe | Themen |
| --- | --- |
| Baby und Wahrnehmung | SSW und ET verstehen; Größen und Gewichte einordnen; Entwicklung der Sinne; Kindsbewegungen |
| Körper und Beschwerden | Übelkeit; Sodbrennen; Verdauung; Rücken und Becken; Schlaf; Ausfluss; Schwellungen; Müdigkeit |
| Alltag | Lebensmittelsicherheit; ausgewogene Ernährung; Bewegung; Reisen; Medikamente und Nahrungsergänzung als Gesprächsthema |
| Vorsorge | Mutterpass; Vorsorgetermine; Ultraschall; Screening auf Schwangerschaftsdiabetes |
| Wohlbefinden und Vorbereitung | Sorgen und Unterstützung; Nähe und Sexualität; Geburtsort, Geburtswünsche und Wochenbettplanung |

Auf der Startseite erscheinen wenige passende Artikel. Alle bleiben über Themen und Suche erreichbar. Sensible Themen wie Verlust werden respektvoll und gezielt angeboten, ohne alarmierende Überschriften im allgemeinen Entdeckungsfeed.

## Verlässlichkeit und Quellen

Redaktionelle Texte werden eigenständig aus aktuellen Fachquellen entwickelt und anschließend durch eine qualifizierte Hebamme beziehungsweise gynäkologische Fachperson geprüft. Der konkrete Prüfbedarf richtet sich nach Thema und medizinischem Risiko. Nur tatsächlich geprüfte Inhalte erhalten eine entsprechende Kennzeichnung mit Person, Qualifikation und Datum. Quellen allein sind keine fachliche Freigabe.

Geeignete Ausgangsquellen, am 30.09.2026 abgerufen:

- [BIÖG / familienplanung.de: Schwangerschaftswochen](https://www.familienplanung.de/schwangerschaft/schwangerschaftswochen/25-bis-28-schwangerschaftswoche/)
- [BIÖG / familienplanung.de: Vorsorge](https://www.familienplanung.de/schwangerschaft/schwangerschaftsvorsorge-und-begleitung/vorsorge-zur-sicherheit/)
- [gesund.bund.de: Schwangerschaftsbeschwerden](https://gesund.bund.de/typische-schwangerschaftsbeschwerden)
- [Netzwerk Gesund ins Leben: Handlungsempfehlungen](https://www.gesund-ins-leben.de/fuer-fachkreise/handlungsempfehlungen/)
- [DGE: Ernährung in Schwangerschaft und Stillzeit](https://www.dge.de/gesunde-ernaehrung/gezielte-ernaehrung/ernaehrung-in-schwangerschaft-und-stillzeit/) — verweist auf die im Juli 2026 aktualisierten Schwangerschaftsempfehlungen.

Die verlinkten BIÖG-Wochentexte sind mit CC BY-NC-ND gekennzeichnet. Sie sind fachliche Ausgangsquellen, keine frei übernehmbaren Texte oder Bilder für eine kommerzielle App. Für direkte Übernahmen wären passende Nutzungsrechte erforderlich; vorgesehen sind eigene Texte und eigene beziehungsweise passend lizenzierte Medien.

Warnzeichen und Hilfewege gehören sichtbar in die betreffenden Artikel und bleiben leicht erreichbar. Vorgesehen sind fachlich geprüfte statische Hilfetexte; ein Symptom-Check-in dient Notizen und Inhaltsauswahl. Er ersetzt keine Diagnose oder Triage. KI kann beim Schreiben und Strukturieren helfen; die veröffentlichte medizinische Inhaltsbasis bleibt versioniert und geprüft. Wesentliche Hilfeinformationen sollen unabhängig vom Abo erreichbar sein; das muss vor Umsetzung gegen die bestehenden Zugriffsregeln geprüft werden.

## Bilder und Animationen

### Erste Serie: redaktionelle Illustrationen

Die bereits erstellte Beispielillustration einer lesenden Schwangeren wird innerhalb einer bestehenden pastellfarbenen Glaskachel ausprobiert. Sie ist ein Stilversuch, keine Darstellung einer bestimmten Schwangerschaftswoche. Weitere Motive müssen zu LottiBabys vorhandenen Pastellfarben und dunklen wie hellen Hintergründen passen; sie bestimmen keine neue Farbwelt für die gesamte Startseite.

Für die angepassten Wissenskacheln wurden zwei weitere eigenständige Illustrationen als Stilentwürfe erzeugt: eine aufrecht sitzende Schwangere zum Thema Sodbrennen und eine Schwangere, die Fragen für ihren nächsten Termin aufschreibt. Die Motive sind allgemeine Alltagsszenen und stellen keine Diagnose oder persönliche Empfehlung dar. Sie werden in der Konzeptvorschau eingebettet; die finale Bildserie bleibt ein eigener Produktionsschritt.

Erste Produktion: zwölf Motive in derselben Bildsprache für Babyentwicklung, Körper, Schlaf, Ernährung, Bewegung, Gefühle, Vorsorge, Arztfragen, Partnerschaft, Geburt, Vorbereitung und Wochenbett. Unterschiedliche Hauttöne und Lebenssituationen. Cover ohne eingebrannten Text; Texte werden in der App barrierefrei gesetzt. Wiederverwendbare Motive sind möglich, solange keine falsche anatomische Wochenzuordnung entsteht.

### Entwicklungsbilder

Zunächst sechs fachlich geprüfte Referenzstadien über die Schwangerschaft verteilt. Ein Bild wird nur den Wochen zugeordnet, für die es geeignet ist; fehlende Stadien nutzen einen neutralen Größenvergleich. Danach Ausbau zu einer konsistenten Wochenserie. Bestehende Fruchtbilder können nach Prüfung weiterverwendet werden.

Für anatomische Bilder würde ich eine medizinische Illustratorin oder eine entsprechend lizenzierte, konsistente Serie einsetzen. Generierte Entwürfe benötigen dieselbe Fachprüfung. Altersstufen werden nicht durch bloßes Skalieren eines Fötusbilds simuliert. Eine vollständige 3D-Serie ist eine eigene spätere Produktion mit Modell, Animation und fachlicher Abnahme; sie ist kein schneller Zusatz zum UI-Umbau.

### Bewegung mit Zweck

Erster Ausbau: sanfter Wechsel zwischen Wochen und kurze erklärende Bildsequenzen auf ausdrückliches Öffnen. Inhalte bleiben beim Lesen stehen. Reduzierte Bewegung respektieren; statische Alternative, Pausieren, Hintergrundpause und Bild-Fallback vorsehen. Keine Bewegung als Beleg für reale Herzfrequenz oder individuelle Kindsbewegungen darstellen.

### Produktionsablauf

Stilbriefing → drei Mustercover → gemeinsame Auswahl → Motivserie → Konsistenzprüfung → gegebenenfalls medizinische Prüfung → Export für helle/dunkle Ansicht und verschiedene Größen. Quellen und Nutzungsrechte pro Asset dokumentieren. Zu anatomischen Referenzen brauche ich später eine qualifizierte Fachperson oder eine freigegebene Bildquelle; die normalen Coverentwürfe kann ich erstellen.

## Umsetzung im vorhandenen Projekt

1. **Ein Inhaltsschema:** separates, typisiertes redaktionelles Modul für Woche, Tagesbereich, Baby, Körper, Vorbereitung, Artikelbezüge, Quellen und Freigabestatus. Schwangerschaftsalter zentral aus ET und lokalem Datum ableiten; abgeschlossene Wochen, laufende SSW und Trimester explizit unterscheiden. Datenquellen erst nach Abgleich migrieren.
2. **Kleine Bildschirmkomponenten:** Wochenkopf, Baby-/Körpervorschau, Wissenskarte und Vorbereitungsliste aus `pregnancy-home.tsx` auslagern. Bestehende umfangreiche Arbeitsänderungen berücksichtigen.
3. **Wissen und Leseseite:** Themen, echte lokale Suche, Merken, Quelle und fachlicher Status. Artikel können Arztfragen vorbereiten; persönliche Speicherung nur über vorhandene, korrekt berechtigte Wege.
4. **Vorhandene Werkzeuge verbinden:** `doctor-questions`, `planner`, Selbstfürsorge, Krankenhauscheckliste und Geburtsplan. `pregnancy-briefing` als Ausgangspunkt, nicht als medizinisches Entscheidungssystem.
5. **Lokale Inhalte:** Grundwissen und aktuelle Wocheninfos beim App-Start ohne neue Netzabfrage lesbar; Medien getrennt nachladen und cachen. Fehler bei persönlichen Daten dürfen nicht als „keine Termine“ oder „alles erledigt“ dargestellt werden. Offline-Anzeige, Ladefehler und fehlendes Abo bleiben unterscheidbar.
6. **Lokalisierung:** vorhandene Sprachen Deutsch, Englisch und Spanisch mitdenken. Deutsche Vorsorgeinhalte explizit als Deutschland-Kontext kennzeichnen; Sprache allein bestimmt kein Versorgungssystem.

Kein neues CMS, neues Backend oder zusätzliche native Medienbibliothek ist nötig, um den ersten redaktionellen Wochenbegleiter zu bauen. Ein CMS wird erst sinnvoll, wenn mehrere Redakteurinnen regelmäßig Inhalte ändern. Neue native UI- oder Medienabhängigkeiten werden gezielt geprüft, nicht nebenbei eingebaut.

## Reihenfolge und Abnahme

**Paket A: Richtung und Inhaltsstandard.** Diese Vorschau, eine vollständig ausgearbeitete Beispielwoche und drei Beispielartikel, etwa Babyentwicklung, Sodbrennen und Vorsorge. Mit Nutzer und Ehefrau prüfen: Finden sie schnell mehr nützliches Wissen? Die Beispielwoche ist der Qualitätsmaßstab für den weiteren Ausbau.

**Paket B: Vollständigkeit und neuer Einstieg.** Alle Wochendossiers, zentrale Inhalte und ruhige Startseite. Medizinische Inhalte werden vor Veröffentlichung geprüft; nicht abgeschlossene Wochen nutzen transparent vorhandene Informationen, keine erfundenen individuellen Empfehlungen. Für ein endgültiges Schwangerschafts-Release muss jede erreichbare Woche ausreichend abgedeckt sein.

**Paket C: Bildserie und Vertiefung.** Zwölf Cover, passende Entwicklungsillustrationen, weitere Artikel, optionale Personalisierung und kurze Erkläranimationen. Vollständige 3D-Entwicklung erst nach gesondertem Aufwand-/Nutzenvergleich.

Vor Freigabe prüfen:

- Tagwechsel, ET-Änderung, 13+6/14+0, 27+6/28+0, ET und Tage danach; konsistente Angaben in Home, Countdown und Babygröße.
- Jede erreichbare Woche hat aktuelle, nachvollziehbare Inhalte; kein medizinisches Freigabelabel ohne tatsächlichen Review.
- Deutsch, Englisch, Spanisch; lange Titel, große Schrift, VoiceOver/TalkBack, Kontrast und reduzierte Bewegung.
- iPhone und Android: Lesen, Wochenwechsel, Quelle öffnen, Artikel finden, zurückgehen, Frage merken, vorhandenes Werkzeug öffnen.
- Fehlender ET, fehlendes Bild, Offline-Modus und Fehler persönlicher Daten mit sinnvoller Wiederherstellung.
- Kleine qualitative Runde, darunter die Ehefrau: Was ist neu gelernt? Was bleibt unklar? Wird Hilfe schnell gefunden? Ist die Seite ruhig genug?

Messbare Produktziele erst nach Ausgangsmessung festlegen. Sinnvolle Messgrößen sind gelesene Wocheninhalte, erfolgreiche Wissenssuchen und gespeicherte Arztfragen. Gesundheitsdaten und Suchtexte nicht pauschal als Analytics-Ereignisse erfassen.

## Nächster konkreter Schritt

Die bestätigte Kachelanordnung als Grundlage nehmen und eine vollständige Beispielwoche mit drei ausreichend tiefen Artikeln entwickeln. Diese Inhalte zeigen, ob der zentrale Wunsch nach deutlich mehr Information erfüllt ist. Bei einem anschließenden Umsetzungsauftrag den aktuellen Arbeitsstand prüfen und die neuen Bereiche schrittweise integrieren. Die zehn Werkzeuge bleiben erhalten; Bilder werden innerhalb der Inhaltskacheln weiterentwickelt.

## Prüfung der Konzeptvorschau

Die angepasste Vorschau im vorhandenen Glasdesign wurde bei 320, 414 und 736 Pixeln geprüft: alle zehn Werkzeugkacheln vorhanden, Wochenartikel öffnen, Wissenssuche einschließlich leerem Ergebnis, eigene und vorgeschlagene Fragen, Checkliste sowie Rückkehr zur Startseite. Bilder laden; keine JavaScript-Fehler oder horizontalen Überläufe. Die dunkle Produktdarstellung wurde in heller und dunkler Vorschauumgebung geprüft. Prüfprotokoll: `output/pregnancy-concept-20260930/glass-preview-verification.json`. Acht der bestehenden Werkzeugkacheln und die globale Navigation sind in diesem Konzept nur dargestellt; ihre bestehenden App-Funktionen wurden nicht nachgebaut. Dies bestätigt nur die genannten Konzeptinteraktionen im Browser; die native App-Integration und medizinische Abnahme stehen noch aus.

## Präzisierung vom 03.10.2026: Wochenbegleiter als Story-Einstieg

Auf ausdrückliche Rückmeldung zum Screenshot der 7. SSW verwenden die Wissensseiten nun den normalen `Header.tsx`. Die Woche erhält einen kompakten horizontalen SSW-Wechsler und getrennte Story-Einstiege für Baby, Körper, Wissen, Vorbereitung und Gemeinsam. Kurze Abschnitte führen bei Bedarf zum vollständigen Wochenartikel oder Themenartikel. Die vorhandene Home-Anordnung einschließlich „Dein Tag im Überblick“ bleibt erhalten. Umsetzungsstand, aktuelle Komponentenvorschau und Prüfungen: [pregnancy-stories-20261003.md](pregnancy-stories-20261003.md). Diese Änderung ist im Code und als iOS-/Android-Bündel geprüft, noch nicht in einem neuen installierten Build.

Die anschließende Stilkorrektur nutzt die vorhandene `GlassCard` und `DesignGuide.tsx`: transparentere Glasflächen, feinere Konturen, ruhigere Überschriften und das bestehende Marken-Lila. Bilder und Lesetext stehen in einer gemeinsamen Karte. Storys und alle bisherigen Funktionen bleiben erhalten; sichtbare Entwurfshinweise sind auf Nutzerwunsch entfernt. Aktueller Stand und abschließende Nachweise: [pregnancy-app-style-20261003.md](pregnancy-app-style-20261003.md).
