# Dokumentation: Schwangerschaftsstatistik-Seite

## Übersicht

Die Schwangerschaftsstatistik-Seite (`pregnancy-stats.tsx`) zeigt detaillierte Informationen über den Fortschritt der Schwangerschaft an. Sie bietet eine visuelle Darstellung des Schwangerschaftsfortschritts mit einem kreisförmigen Fortschrittsbalken und zeigt verschiedene relevante Statistiken wie den errechneten Geburtstermin, die aktuelle Schwangerschaftswoche und verbleibende Tage an.

## Funktionalität

### Hauptfunktionen

1. **Fortschrittsanzeige**: 
   - Kreisförmiger Fortschrittsbalken, der den prozentualen Fortschritt der Schwangerschaft anzeigt
   - Prozentanzeige in der Mitte des Kreises
   - Herzensymbole, die den Fortschritt in 10%-Schritten visualisieren

2. **Statistiken**:
   - Errechneter Geburtstermin (EGT)
   - Aktuelle Schwangerschaftswoche (SSW) und Tag
   - Dauer der Schwangerschaft in Tagen
   - Aktuelles Trimester
   - Kalendermonat
   - Schwangerschaftsmonat
   - Verbleibende Tage bis zum EGT

3. **Fallback-Ansicht**:
   - Wenn kein Geburtstermin gesetzt ist, wird eine Hinweisseite angezeigt
   - Button zum Navigieren zur Countdown-Seite, wo der Geburtstermin eingestellt werden kann

## Technische Details

### Datenquellen

Die Seite bezieht ihre Daten aus der Supabase-Datenbank:
- Der errechnete Geburtstermin wird aus der Tabelle `user_settings` geladen
- Alle anderen Statistiken werden basierend auf diesem Datum berechnet

### Berechnungen

Die Seite führt folgende Berechnungen durch:
- **Fortschritt**: Berechnet als Verhältnis der vergangenen Tage zur Gesamtdauer der Schwangerschaft (280 Tage)
- **Schwangerschaftswoche**: Berechnet durch Division der vergangenen Tage durch 7
- **Trimester**: Bestimmt anhand der aktuellen Schwangerschaftswoche
- **Kalendermonat**: Berechnet durch Division der vergangenen Tage durch 30
- **Schwangerschaftsmonat**: Berechnet durch Division der Schwangerschaftswochen durch 4

### Komponenten

Die Seite verwendet folgende Hauptkomponenten:
- **SVG-Kreis**: Für die kreisförmige Fortschrittsanzeige
- **Statistik-Karten**: Für die Anzeige der verschiedenen Statistiken
- **IconSymbol**: Für die Herz-Symbole und andere Icons

## UI-Elemente

### Layout

Die Seite ist in folgende Abschnitte unterteilt:
1. **Header**: Mit Zurück-Button und Titel
2. **Fortschrittsbereich**: Mit kreisförmiger Anzeige und Textinformationen
3. **Geburtstermin-Bereich**: Zeigt den errechneten Geburtstermin an
4. **Statistik-Raster**: Zeigt die verschiedenen Statistiken in einem zweispaltigen Raster an

### Styling

- **Farbschema**: Beige-Töne (#F7EFE5, #E8D5C4) und Braun-Töne (#7D5A50, #5D4037)
- **Karten**: Abgerundete Ecken (20px), leichte Schatten für 3D-Effekt
- **Typografie**: Verschiedene Schriftgrößen für Hierarchie (Titel, Werte, Beschreibungen)

## Datenfluss

1. **Laden des Geburtstermins**:
   - Bei Komponenteninitialisierung wird der Geburtstermin aus Supabase geladen
   - Wenn kein Geburtstermin gefunden wird, wird die Fallback-Ansicht angezeigt

2. **Berechnung der Statistiken**:
   - Nach dem Laden des Geburtstermins werden alle Statistiken berechnet
   - Die Berechnungen werden bei Änderungen des Geburtstermins aktualisiert

3. **Rendering**:
   - Die berechneten Statistiken werden in den entsprechenden UI-Elementen angezeigt
   - Der Fortschrittskreis wird basierend auf dem berechneten Fortschrittswert gezeichnet

## Verwendung

Die Seite ist über den Router-Pfad `/pregnancy-stats` zugänglich und kann von anderen Teilen der App aus aufgerufen werden, insbesondere:
- Von der Countdown-Seite durch Klicken auf den Fortschrittskreis
- Von der Home-Seite durch entsprechende Navigation

## Fehlerbehebung

Häufige Probleme und Lösungen:
- **Kein Geburtstermin angezeigt**: Überprüfen Sie, ob der Geburtstermin in der Datenbank korrekt gesetzt ist
- **Falsche Berechnungen**: Stellen Sie sicher, dass das Datumsformat korrekt ist und die Berechnungen die richtigen Konstanten verwenden (280 Tage für die Schwangerschaft)

## Zukünftige Erweiterungen

Mögliche zukünftige Erweiterungen für diese Seite könnten sein:
- Anpassbare Farbschemata
- Zusätzliche Statistiken oder Visualisierungen
- Integration mit Kalenderfunktionen
- Möglichkeit, Meilensteine zu markieren
