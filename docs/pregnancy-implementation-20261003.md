# Schwangerschaftsmodus: Umsetzung und Prüfstand

Stand: 3. Oktober 2026. Umsetzung auf dem vorhandenen, bereits umfangreich geänderten Arbeitsstand von `main`, Ausgangs-HEAD `0adbccd7e5751288798804dca49f5e5fc9b0d53c`. Maßgeblich sind der [abgestimmte Plan](pregnancy-redesign-plan-20260930.md) und die dort verlinkte Vorschau `lottibaby-schwangerschaft-glaskacheln.html`.

## Ergebnis im Code

Die Startseite zeigt unter dem bestehenden „Dein Tag im Überblick“ zwei Wochenkacheln für Baby und Körper. Darunter stehen zwei passende Wissenskacheln und der Zugang zu allen Themen. Die großen Motive, Pastellflächen und Glassurfaces folgen der akzeptierten Vorschau und verwenden das bestehende Hintergrund- und Themesystem. Bei großer Schrift werden Kacheln und Abschnittskopf untereinander angeordnet.

Das bestehende Übersichtskarussell einschließlich automatischem Wechsel, Begrüßung, globale Navigation und alle zehn Werkzeuge bleiben erhalten. Die bestehenden Sortier- und Ausblendpräferenzen bleiben wirksam. Premium steht hinter dem Schnellzugriff. Der Vergleich mit der vor Bearbeitung gesicherten Datei bestätigt unveränderte Renderfunktionen für Übersicht, Schnellzugriff und Premium sowie unveränderte Werkzeugdefinitionen und Präferenzlogik. Lediglich die Trimestergrenzen innerhalb der bestehenden Zahlenkarte wurden an die zentrale Zählung angepasst.

Die Leseseiten umfassen Baby, Körper, passende Artikel, Vorbereitung, zwei Fragenvorschläge, Partnerimpuls und Quellen. Vor- und Zurückwechseln ist innerhalb der Wochen 1–42 möglich. Ungültige Artikel- oder Wochenparameter bekommen einen eigenen Hinweis. Vorbereitungen öffnen die bestehenden Arztfragen, den Planer, Selfcare, die Krankenhauscheckliste oder den Geburtsplan.

Die Wissensbibliothek hat Themenfilter und eine lokale Volltextsuche, einschließlich mehrerer Suchbegriffe und Akzentnormalisierung. Merken speichert bekannte Artikel-IDs getrennt nach Konto auf diesem Gerät. Es entsteht kein neuer Serverdatensatz. Die bestehende Gesundheitsdateneinwilligung gilt auch für diese Auswahl; Entzug und Kontowechsel verhindern das Abschließen veralteter Schreibvorgänge. Bestehende lokale Abmelde-, Einwilligungs- und Löschbereinigung erfasst den neuen Storage-Schlüssel. Schreibfehler werden angezeigt und erzeugen keinen erfolgreichen Merken-Status.

Ein Artikel kann eine Frage als bearbeitbaren Entwurf an `doctor-questions` übergeben. Ein vorhandener Eingabetext wird erhalten. Gespeichert wird über den bereits vorhandenen Speichervorgang samt Berechtigungs- und Fehlerbehandlung.

Statische Wissens- und Hilfeseiten sind vom Abozugang unabhängig. Sie sind auch bei fehlender Gesundheitsdateneinwilligung erreichbar; persönliche Auswahl und geschützte Werkzeuge behalten ihre Einwilligungsgrenzen. Es gibt keine neuen Analytics-Ereignisse für Suchtexte oder Gesundheitsdaten, kein CMS, keine Migration und keine zusätzliche App-Abhängigkeit.

## Inhalte und Bilder

Das lokale, typisierte Modul `lib/pregnancy-guide` enthält Version `2026-10-03.1`: Grundlagen für die Wochen 1–3 und 39 Dossiers für die Wochen 4–42 sowie die 24 Themen des Plans. Jede Woche besitzt einen eigenen Titel, zwei Artikelbezüge, einen Vorbereitungsschritt und zwei Fragen. Drei Babyentwicklungen und zwei Körperveränderungen stammen aus ausdrücklich benannten Entwicklungsphasen. Diese Grundlagen werden zwischen passenden Wochen geteilt; sie werden nicht als 39 verschiedene, tagesgenaue medizinische Meilensteine ausgegeben.

Alle UI-Texte und redaktionellen Texte liegen auf Deutsch, Englisch und Spanisch vor. Inhalte zum deutschen Versorgungssystem kennzeichnen ihren Deutschland-Kontext unabhängig von der gewählten Sprache. Babywahrnehmung, Sodbrennen und Vorsorge sind die vertieften Pilotartikel: jeweils sechs Abschnitte, zusätzliche Hilfeinformationen, Frage und weiterführende Themen. Die übrigen Artikel bilden die kurze erste Ausbaustufe. Texte sind eigenständig formuliert; Quellen sind BIÖG, IQWiG, gesund.bund.de, DGE und NHS.

**Alle neuen medizinischen Inhalte sind redaktionelle Entwürfe.** Quellen sind keine fachliche Freigabe. Person und Datum eines klinischen Reviews sind bewusst leer; der ausstehende Review steht sichtbar in Leseseiten und Quellenbereich. Die qualifizierte Prüfung durch Hebamme bzw. gynäkologische Fachperson und eine qualitative Runde mit Nutzer und Ehefrau sind vor einem Schwangerschafts-Release erforderlich.

Die drei allgemeinen Alltagsszenen wurden aus der akzeptierten Vorschau als lokale Assets übernommen und um neun neue Illustrationen ergänzt. Die zwölf Motive zeigen Babybindung, Körper, Sodbrennen, Vorsorge, Schlaf, Ernährung, Bewegung, Wohlbefinden, Beratung, Partnerschaft, Geburtsvorbereitung und Wochenbett. Das Paarmotiv zeigt eine Schwangere mit ihrem männlichen Partner. Artikel erhalten thematisch passende Bilder; Partnerimpuls und Wochenbettabschnitt zeigen zusätzliche Motive. Pastellflächen und Glassurfaces bleiben erhalten. Wissen und Navigation funktionieren auch nach Bildfehlern. Herkunft, Dateipfade und Prompts sind in `assets/images/pregnancy-guide/README.md` und `output/pregnancy-images-20261003` dokumentiert. Die sechs fachlich geprüften Entwicklungsstadien und optionalen Erkläranimationen aus Paket C bleiben separate Produktionsschritte.

Die vorhandenen Größenbilder, Messwerte und älteren Entwicklungstexte werden nicht als medizinisch geprüft ausgegeben oder pauschal migriert. Die bestehende Größenserie reicht bis Woche 40. Ihr fachlicher Abgleich und die anatomische Bildprüfung bleiben Teil der Inhaltsfreigabe. Die neue Wochenbegleitung kann auch die Wochen 41–42 anzeigen und erklärt die Tage nach dem ET.

## Datum und Fehlerzustände

`lib/pregnancy-age.ts` berechnet Schwangerschaftsalter aus lokalem Kalenderdatum und ET. Damit werden keine 23- oder 25-Stunden-Tage als fehlerhafte Tagesbruchteile gewertet. Abgeschlossene Wochen, laufende SSW und Trimester sind getrennt: 26+1 entspricht laufender 27. SSW; Trimesterwechsel erfolgen bei 14+0 und 28+0. Am ET werden 40+0 und danach fortlaufende Tage angezeigt. Nur die Inhaltsauswahl wird auf das letzte Dossier begrenzt.

Home, Countdown-Timer, Countdown-Seite und automatische Wochenwahl der Größenansicht verwenden diese Berechnung. Fokus, Rückkehr aus dem Hintergrund und lokaler Tagwechsel aktualisieren die Anzeige. Aus gecachten ET-Werten wird das Alter erneut berechnet, statt gestrige Wochenzahlen zu übernehmen.

Für den neuen Home-Bereich sind Laden, bestätigter fehlender ET und Ladefehler verschieden. Bestehender Inhalt bleibt bei einem Fehler lesbar; ein fehlgeschlagener Abruf wird nicht als bestätigter fehlender ET dargestellt. Statische Texte und gebündelte Motive benötigen keine neue Backendabfrage.

## Verifikation

| Prüfung | Ergebnis und Grenze |
| --- | --- |
| TypeScript App und Tests | `npm run typecheck` erfolgreich. |
| Gezielte Jest-Prüfungen | 9 Suites, 45 Tests erfolgreich: Datum und Grenzen, Tagwechsel/Foreground, Katalog, Sprachen, Volltextsuche, Merken/Consent/Fehler, vorhandenes Briefing und Übersetzungen. |
| Consent-Routeninventar | 8 Tests erfolgreich; die neuen statischen Root-Routen sind ausdrücklich berücksichtigt. |
| ESLint neue Module und Countdown-Timer | Keine Fehler oder Warnungen im geprüften Umfang. |
| Erhalt vorhandener Home-Funktionen | 9 Deklarationen unverändert gegenüber dem gesicherten Arbeitsstand; alle 10 Werkzeugdefinitionen erhalten; neue Reihenfolge geprüft. |
| Komponenten und Interaktionen | 48 Prüfungen mit React Native Web: Lesen, Baby-/Körperzugang, Wochenwechsel und Grenzen, Suche/Filter/leeres Ergebnis, Merken/Entfernen, Fragenentwurf, fehlender ET, Laden, Datenfehler, Bildausfall, Offline-Lesen und Speicherfehler geprüft. |
| Layout | 320, 414 und 736 px; DE/EN/ES; hell/dunkel; normale und 160% Schrift. Zusätzlich Bibliothek und Wochenansicht bei 200% Schrift. Keine JavaScript-Fehler; Buttons passen in die Inhaltsbreite. |
| JavaScript-Bundles | Expo-/Hermes-Export für iOS und Android erfolgreich. Das ist keine EAS-Build-, Store-, Installations- oder Geräteabnahme. |

Die Komponentenprüfung rendert die tatsächlichen neuen Komponenten und Leseseiten. Authentifizierung, Locale, Einwilligung und Router werden lokal bereitgestellt; große Schrift wird simuliert. Der externe Quellenaufruf wird mit URL und Fehler/Rückkehr geprüft. Das Öffnen im echten iPhone-/Android-Browser, VoiceOver/TalkBack, native Blur-Darstellung und die vollständige Home-Navigation brauchen Geräteabnahme. Es war kein iOS-Simulator gestartet und kein neues Gerätetest-Ergebnis wurde behauptet.

Nachweise im Ordner `output/pregnancy-implementation-20261003`: `baseline.json`, `before/`, `preservation-verification.json`, `catalog-audit.json`, `source-link-check.json`, `tests.log`, `typecheck.log`, `lint.log`, `consent-routes.log`, `ui-verification.json`, Screenshots sowie `export-ios.log` und `export-android.log`. Die lokale Prüfoberfläche und ihr Script liegen ebenfalls dort und sind keine App-Route.

Die anschließende Bilderweiterung ist separat in `output/pregnancy-images-20261003` nachgewiesen. Typecheck, ESLint und die sechs Katalogtests sind erfolgreich; 98 PNG-/JPEG-Dateiköpfe wurden geprüft. Die 48 Komponentenprüfungen bleiben erfolgreich. Sieben zusätzliche Bildprüfungen bestätigen zwölf geladene Motive, alle 24 Artikelcover, die Paarillustration im Wochenbegleiter und den Wochenbettabschnitt ohne JavaScript- oder Ladefehler. Die Ausschnitte wurden visuell in den tatsächlichen Lesekomponenten geprüft und oben ausgerichtet, damit Gesichter erhalten bleiben. Ein abschließender Expo-Export für iOS, Android und Web ist erfolgreich; dieser zusätzliche Export prüft JavaScript ohne Hermes-Bytecode und ist kein installierter App-Build. 28 Dateien der vorherigen Umsetzung, einschließlich Home und der drei ursprünglichen Motive, sind per Hash unverändert. Die zwölf JPEGs belegen zusammen 3.46 MiB. `bilduebersicht.png`, `final-prompts.json`, `selected.json`, `partnership-edit.json`, `image-verification.json` und `preservation-and-assets.json` halten Vorschau, Herkunft und Verifikation fest.

## Nächste konkrete Abnahme

1. Version `2026-10-03.1`, besonders Warnzeichen, Wochenzählung, Entwicklungsphasen und Deutschland-Kontext, fachlich prüfen; alte Größen- und Entwicklungstexte gemeinsam abgleichen. Erst einen tatsächlich erfolgten Review mit Person, Qualifikation und Datum eintragen.
2. Einen aktuellen QA-Build für iPhone und Android erstellen und installieren. Lesen, Woche wechseln, Quellen öffnen, Suche/Merken, Frage speichern, Werkzeuge und Übersichtskarussell prüfen; anschließend große Schrift, VoiceOver/TalkBack und Offlinefälle abnehmen.
3. Mit Nutzer und Ehefrau Woche 27, die neue Motivserie und die drei vertieften Pilotartikel durchgehen: neues Wissen, Verständlichkeit, Hilfeauffindbarkeit und Ruhe der Startseite bewerten. Die fachlich geprüften Entwicklungsillustrationen und optionalen Animationen entsprechend Paket C produzieren.

Dieser Stand ist eine implementierte und lokal geprüfte App-Änderung. Medizinische Freigabe, Geräteabnahme und öffentliche Veröffentlichung sind separate, noch offene Schritte.
